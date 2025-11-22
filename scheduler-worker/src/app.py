import asyncio
import sys
import time
import json
import copy
import os
import random
import gc
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Literal, Optional
from uuid import uuid4
from dataclasses import asdict

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
  sys.path.append(str(CURRENT_DIR))

from upstash_client import get_upstash_client  # noqa: E402
from loguru import logger  # noqa: E402
from models import Assignment, parse_schedule_input, ScheduleInput  # noqa: E402
from solver.ortools_solver import solve_with_ortools  # noqa: E402
from solver.cpsat_solver import solve_with_cpsat  # noqa: E402
from solver.postprocessor import SchedulePostProcessor  # noqa: E402
from solver.exceptions import SolverFailure  # noqa: E402
from solver.types import SolveResult  # noqa: E402

LOG_DIR = Path(os.environ.get("MILP_LOG_DIR", CURRENT_DIR / "logs"))


class SchedulerJobRequest(BaseModel):
  milpInput: Dict[str, Any]
  name: Optional[str] = None
  departmentId: Optional[str] = None
  solver: Optional[Literal['ortools', 'cpsat', 'hybrid']] = 'ortools'


class SchedulerJobStatus(BaseModel):
  id: str
  status: Literal['queued', 'processing', 'completed', 'failed', 'timedout', 'cancelled']
  result: Optional[Dict[str, Any]] = None
  bestResult: Optional[Dict[str, Any]] = None
  error: Optional[str] = None
  errorDiagnostics: Optional[Dict[str, Any]] = None
  createdAt: str
  updatedAt: str


class SchedulerJobResponse(BaseModel):
  jobId: str = Field(..., alias='jobId')


class CancellationToken:
  def __init__(self):
    self.cancelled = False

  def cancel(self):
    self.cancelled = True


class InternalJobState:
  def __init__(self, job_id: str):
    now = datetime.utcnow().isoformat()
    self.id = job_id
    self.status: Literal['queued', 'processing', 'completed', 'failed', 'timedout', 'cancelled'] = 'queued'
    self.result: Optional[Dict[str, Any]] = None
    self.best_result: Optional[Dict[str, Any]] = None
    self.error: Optional[str] = None
    self.error_diagnostics: Optional[Dict[str, Any]] = None
    self.created_at = now
    self.updated_at = now
    self.cancel_token = CancellationToken()

  def to_response(self) -> SchedulerJobStatus:
    return SchedulerJobStatus(
      id=self.id,
      status=self.status,
      result=self.result,
      bestResult=self.best_result,
      error=self.error,
      errorDiagnostics=self.error_diagnostics,
      createdAt=self.created_at,
      updatedAt=self.updated_at,
    )

  def mark_processing(self):
    self.status = 'processing'
    self.updated_at = datetime.utcnow().isoformat()

  def mark_completed(self, result: Dict[str, Any]):
    self.status = 'completed'
    self.result = result
    self.best_result = result
    self.updated_at = datetime.utcnow().isoformat()

  def mark_failed(self, error: str, diagnostics: Optional[Dict[str, Any]] = None):
    self.status = 'failed'
    self.error = error
    if diagnostics:
      self.error_diagnostics = diagnostics
    self.updated_at = datetime.utcnow().isoformat()

  def mark_timed_out(self, result: Optional[Dict[str, Any]], diagnostics: Optional[Dict[str, Any]] = None):
    self.status = 'timedout'
    self.result = result
    if result:
      self.best_result = result
    self.error = "Solver timed out"
    if diagnostics:
      self.error_diagnostics = diagnostics
    self.updated_at = datetime.utcnow().isoformat()

  def mark_cancelled(self, result: Optional[Dict[str, Any]] = None):
    self.status = 'cancelled'
    if result:
      self.result = result
      self.best_result = result
    self.error = "Cancelled"
    self.updated_at = datetime.utcnow().isoformat()

  def request_cancel(self):
    self.cancel_token.cancel()


app = FastAPI(title="MILP-CSP Scheduler Worker", version="0.1.0")
jobs: Dict[str, InternalJobState] = {}
JOB_RETENTION_SECONDS = int(os.environ.get("SCHEDULER_JOB_TTL_SECONDS", 300))
UPSTASH_CLIENT = get_upstash_client()
UPSTASH_QUEUE_KEY = os.environ.get("UPSTASH_QUEUE_KEY", "scheduler:queue")
UPSTASH_JOB_KEY_PREFIX = os.environ.get("UPSTASH_JOB_KEY_PREFIX", "scheduler:job:")


def _job_record_key(job_id: str) -> str:
  return f"{UPSTASH_JOB_KEY_PREFIX}{job_id}"


def job_to_record(job: InternalJobState, request_payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
  return {
    "id": job.id,
    "status": job.status,
    "result": job.result,
    "bestResult": job.best_result,
    "error": job.error,
    "errorDiagnostics": job.error_diagnostics,
    "createdAt": job.created_at,
    "updatedAt": job.updated_at,
    "requestPayload": request_payload,
  }


def record_to_job(record: Dict[str, Any]) -> InternalJobState:
  job = InternalJobState(record["id"])
  job.status = record.get("status", "queued")
  job.result = record.get("result")
  job.best_result = record.get("bestResult")
  job.error = record.get("error")
  job.error_diagnostics = record.get("errorDiagnostics")
  job.created_at = record.get("createdAt", job.created_at)
  job.updated_at = record.get("updatedAt", job.updated_at)
  return job


async def persist_job_state(job: InternalJobState, request_payload: Optional[Dict[str, Any]] = None):
  if not UPSTASH_CLIENT:
    return
  try:
    record = job_to_record(job, request_payload)
    await asyncio.to_thread(UPSTASH_CLIENT.set, _job_record_key(job.id), record)
  except Exception as exc:  # pragma: no cover
    logger.warning(f"[Upstash] failed to persist job {job.id}: {exc}")


async def enqueue_upstash_job(job: InternalJobState, request_payload: Dict[str, Any]):
  if not UPSTASH_CLIENT:
    return False
  try:
    await persist_job_state(job, request_payload)
    await asyncio.to_thread(UPSTASH_CLIENT.rpush, UPSTASH_QUEUE_KEY, job.id)
    return True
  except Exception as exc:  # pragma: no cover
    logger.warning(f"[Upstash] enqueue failed for job {job.id}: {exc}")
    return False


async def fetch_job_record(job_id: str) -> Optional[Dict[str, Any]]:
  if not UPSTASH_CLIENT:
    return None
  try:
    return await asyncio.to_thread(UPSTASH_CLIENT.get, _job_record_key(job_id))
  except Exception:
    return None


async def _cleanup_job_later(job_id: str):
  if JOB_RETENTION_SECONDS <= 0:
    jobs.pop(job_id, None)
    gc.collect()
    return
  await asyncio.sleep(JOB_RETENTION_SECONDS)
  job_state = jobs.pop(job_id, None)
  if UPSTASH_CLIENT:
    try:
      await asyncio.to_thread(UPSTASH_CLIENT.expire, _job_record_key(job_id), 60)
    except Exception:
      pass
  if job_state:
    job_state.result = None
    job_state.best_result = None
    job_state.error_diagnostics = None
  gc.collect()


def serialize_assignments(assignments: list[Assignment]) -> list[Dict[str, Any]]:
  serialized = []
  for assignment in assignments:
    serialized.append(
      {
        "employeeId": assignment.employeeId,
        "date": assignment.date,
        "shiftId": assignment.shiftId,
        "shiftType": assignment.shiftType,
        "isLocked": assignment.isLocked,
      }
  )
  return serialized


def _build_date_range(start: date, end: date) -> list[date]:
  current = start
  days: list[date] = []
  while current <= end:
    days.append(current)
    current += timedelta(days=1)
  return days


def _normalize_shift_code(value: Optional[str]) -> str:
  if not value:
    return ""
  return value.replace("^", "").strip().upper()


def _derive_shift_code_from_id(shift_id: Optional[str]) -> str:
  if not shift_id:
    return ""
  trimmed = shift_id.strip()
  code = trimmed[6:] if trimmed.lower().startswith("shift-") else trimmed
  upper = code.upper()
  return "O" if upper == "OFF" else upper


def compute_off_accruals(schedule: ScheduleInput, assignments: list[Assignment]) -> list[Dict[str, Any]]:
  if not schedule or not assignments:
    return []

  date_range = _build_date_range(schedule.startDate, schedule.endDate)
  if not date_range:
    return []

  weekend_count = sum(1 for day in date_range if day.weekday() >= 5)
  holiday_dates = {holiday.date for holiday in (schedule.holidays or [])}
  holiday_count = sum(1 for day in date_range if day.isoformat() in holiday_dates)
  night_bonus = max(0, int(getattr(schedule, "nightIntensivePaidLeaveDays", 0) or 0))
  previous_off = getattr(schedule, "previousOffAccruals", {}) or {}
  shift_lookup = {shift.id: (shift.code or shift.name or shift.id).upper() for shift in schedule.shifts}
  off_shift_codes = {"O", "OFF"}

  actual_off_counts: dict[str, int] = defaultdict(int)
  for assignment in assignments:
    code = _normalize_shift_code(getattr(assignment, "shiftType", None))
    if not code:
      shift_id = getattr(assignment, "shiftId", None)
      if shift_id:
        code = _normalize_shift_code(shift_lookup.get(shift_id, ""))
        if not code:
          code = _derive_shift_code_from_id(shift_id)
    if not code:
      continue
    normalized = "O" if code == "OFF" else code
    if normalized not in off_shift_codes:
      continue
    actual_off_counts[assignment.employeeId] += 1

  summaries: list[Dict[str, Any]] = []
  for employee in schedule.employees:
    carry_over = max(0, int(previous_off.get(employee.id, 0) or 0))
    pattern = (getattr(employee, "workPatternType", "three-shift") or "three-shift").lower()
    guaranteed = 0
    if pattern == "three-shift":
      base = holiday_count + weekend_count
      guaranteed = base + carry_over
    elif pattern == "night-intensive":
      guaranteed = holiday_count + weekend_count + night_bonus + carry_over
    elif pattern == "weekday-only":
      guaranteed = holiday_count + carry_over
    else:
      guaranteed = holiday_count + weekend_count + carry_over
    guaranteed = max(0, int(guaranteed))
    actual = actual_off_counts.get(employee.id, 0)
    summaries.append(
      {
        "employeeId": employee.id,
        "guaranteedOffDays": guaranteed,
        "actualOffDays": actual,
        "extraOffDays": guaranteed - actual,
      }
    )
  return summaries


def log_json(prefix: str, payload: Dict[str, Any]) -> Optional[str]:
  try:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S%fZ")
    path = LOG_DIR / f"{prefix}-{timestamp}.json"
    with path.open("w", encoding="utf-8") as file:
      json.dump(payload, file, ensure_ascii=False, indent=2, default=str)
    return str(path)
  except Exception:
    return None


def build_solver_result(
  schedule: ScheduleInput,
  assignments: list[Assignment],
  computation_time: float,
  diagnostics: Optional[Dict[str, Any]] = None,
  solve_status: Optional[str] = None,
) -> Dict[str, Any]:
  diagnostics = diagnostics or {}
  effective_status = solve_status or diagnostics.get("solverStatus")
  timed_out = diagnostics.get("solverTimedOut")
  staffing_shortages = diagnostics.get("staffingShortages", [])
  team_gaps = diagnostics.get("teamCoverageGaps", [])
  career_group_gaps = diagnostics.get("careerGroupCoverageGaps", [])
  team_workload_gaps = diagnostics.get("teamWorkloadGaps", [])
  off_balance_gaps = diagnostics.get("offBalanceGaps", [])
  shift_repeat_breaks = diagnostics.get("shiftPatternBreaks", [])
  request_misses = diagnostics.get("specialRequestMisses", [])
  preflight_issues = diagnostics.get("preflightIssues", [])
  postprocess_stats = diagnostics.get("postprocess")
  off_accruals = compute_off_accruals(schedule, assignments)
  violations = [
    {
      "type": "staffingShortage",
      "date": shortage["date"],
      "shiftType": shortage["shiftType"],
      "required": shortage["required"],
      "covered": shortage["covered"],
      "shortage": shortage["shortage"],
    }
    for shortage in staffing_shortages
  ]
  violations.extend(
    [
      {
        "type": "teamCoverageGap",
        "date": gap["date"],
        "shiftType": gap["shiftType"],
        "teamId": gap["teamId"],
        "shortage": gap["shortage"],
      }
      for gap in team_gaps
    ]
  )
  violations.extend(
    [
      {
        "type": "teamWorkloadGap",
        "teamA": gap["teamA"],
        "teamB": gap["teamB"],
        "difference": gap["difference"],
        "tolerance": gap["tolerance"],
      }
      for gap in team_workload_gaps
    ]
  )
  violations.extend(
    [
      {
        "type": "careerGroupCoverageGap",
        "date": gap["date"],
        "shiftType": gap["shiftType"],
        "careerGroupAlias": gap["careerGroupAlias"],
        "shortage": gap["shortage"],
      }
      for gap in career_group_gaps
    ]
  )
  violations.extend(
    [
      {
        "type": "specialRequestMissed",
        "date": miss["date"],
        "shiftType": miss["shiftType"],
        "employeeId": miss["employeeId"],
      }
      for miss in request_misses
    ]
  )
  violations.extend(
    [
      {
        "type": "offBalanceGap",
        "teamId": gap["teamId"],
        "employeeA": gap["employeeA"],
        "employeeB": gap["employeeB"],
        "difference": gap["difference"],
        "tolerance": gap["tolerance"],
      }
      for gap in off_balance_gaps
    ]
  )
  violations.extend(
    [
      {
        "type": "shiftPatternBreak",
        "employeeId": issue["employeeId"],
        "shiftType": issue["shiftType"],
        "startDate": issue["startDate"],
        "window": issue["window"],
        "excess": issue["excess"],
      }
      for issue in shift_repeat_breaks
    ]
  )
  return {
    "assignments": serialize_assignments(assignments),
    "generationResult": {
      "iterations": 1,
      "computationTime": int(computation_time * 1000),
      "solveStatus": effective_status,
      "solverTimedOut": timed_out,
      "violations": violations,
      "score": {
        "total": 100,
        "fairness": 100,
        "preference": 100,
        "coverage": 100,
        "constraintSatisfaction": 100,
        "breakdown": [],
      },
      "offAccruals": off_accruals,
      "stats": {
        "fairnessIndex": 1.0,
        "coverageRate": 1.0,
        "preferenceScore": 1.0,
      },
      "diagnostics": {
        "staffingShortages": staffing_shortages,
        "teamCoverageGaps": team_gaps,
        "careerGroupCoverageGaps": career_group_gaps,
        "teamWorkloadGaps": team_workload_gaps,
        "offBalanceGaps": off_balance_gaps,
        "shiftPatternBreaks": shift_repeat_breaks,
        "specialRequestMisses": request_misses,
        "preflightIssues": preflight_issues,
        "postprocess": postprocess_stats,
      },
      "postprocess": postprocess_stats,
    },
    "aiPolishResult": None,
  }


def _build_failure_guidance(diagnostics: Optional[Dict[str, Any]]) -> Dict[str, list[str]]:
  guidance: Dict[str, list[str]] = {"staffing": [], "coverage": [], "requests": [], "patterns": [], "general": []}
  if not isinstance(diagnostics, dict):
    return guidance
  for issue in diagnostics.get("preflightIssues", []) or []:
    issue_type = issue.get("type")
    if issue_type == "insufficientPotentialStaff":
      guidance["staffing"].append(
        f"{issue.get('date')} {issue.get('shiftType')}: 필요 {issue.get('required')}명 > 가능 {issue.get('available')}명 → requiredStaffPerShift↓ 또는 해당 시프트 가능한 인원 추가"
      )
    elif issue_type == "teamCoverageImpossible":
      guidance["coverage"].append(
        f"{issue.get('date')} {issue.get('shiftType')} 팀 {issue.get('teamId')}: 배치 가능 0명 → 팀 커버 요구 완화 또는 팀 구성 조정"
      )
    elif issue_type == "careerGroupCoverageImpossible":
      guidance["coverage"].append(
        f"{issue.get('date')} {issue.get('shiftType')} 경력그룹 {issue.get('careerGroupAlias')}: 배치 가능 0명 → 그룹 커버 요구 완화/구성 조정"
      )
    elif issue_type == "specialRequestPatternConflict":
      guidance["requests"].append(
        f"{issue.get('date')} {issue.get('employeeId')}: 요청 시프트가 패턴과 충돌 → 요청 변경 또는 해당 직원 패턴 완화"
      )
  for miss in diagnostics.get("specialRequestMisses", []) or []:
    guidance["requests"].append(
      f"{miss.get('date')} {miss.get('employeeId')} 요청 {miss.get('shiftType')} 배정 불가 → 요청 변경 또는 requiredStaff/패턴 완화"
    )
  for short in diagnostics.get("staffingShortages", []) or []:
    guidance["staffing"].append(
      f"{short.get('date')} {short.get('shiftType')}: 필요 {short.get('required')}명, 배정 {short.get('covered')}명 → min 인원↓ 또는 offTolerance/csp 시간↑"
    )
  for gap in diagnostics.get("teamCoverageGaps", []) or []:
    guidance["coverage"].append(
      f"{gap.get('date')} {gap.get('shiftType')} 팀 {gap.get('teamId')} 부족 {gap.get('shortage')} → 팀 커버 요구 완화/팀 배치 가능 인원 추가"
    )
  for gap in diagnostics.get("careerGroupCoverageGaps", []) or []:
    guidance["coverage"].append(
      f"{gap.get('date')} {gap.get('shiftType')} 경력그룹 {gap.get('careerGroupAlias')} 부족 {gap.get('shortage')} → 그룹 커버 요구 완화/구성 조정"
    )
  for issue in diagnostics.get("shiftPatternBreaks", []) or []:
    if issue.get("shiftType", "").startswith("N->"):
      guidance["patterns"].append(
        f"{issue.get('employeeId')} {issue.get('startDate')} 야간 직후 {issue.get('shiftType')} 배치 → rest 제약 완화 또는 offTolerance↑"
      )
    else:
      guidance["patterns"].append(
        f"{issue.get('employeeId')} {issue.get('shiftType')} 연속 초과 → maxSameShift↑ 또는 가중치↓"
      )
  if not any(guidance.values()):
    guidance["general"].append("제약 가중치(staffing/team/career/off)↓, offTolerance/maxSameShift↑, requiredStaffPerShift↓ 후 재시도")
  return guidance


def serialize_schedule(schedule: ScheduleInput) -> Dict[str, Any]:
  return asdict(schedule)


def attempt_schedule_run(
  schedule: ScheduleInput, label: str, cancel_token: Optional[CancellationToken] = None
) -> SolveResult:
  start = time.perf_counter()
  log_json(f"{label}-milp-input", serialize_schedule(schedule))
  solver_result = solve_with_ortools(schedule, cancel_token)
  postprocessor = SchedulePostProcessor(
    schedule,
    solver_result.assignments,
    solver_result.diagnostics,
    getattr(schedule, "options", None),
  )
  assignments, diagnostics = postprocessor.run()
  log_json(
    f"{label}-milp-output",
    {
      "diagnostics": diagnostics,
      "assignments": serialize_assignments(assignments),
    },
  )
  postprocessor = None
  solver_meta = {
    "solverStatus": solver_result.diagnostics.get("solverStatus", solver_result.status),
    "solverTimedOut": solver_result.diagnostics.get("solverTimedOut", solver_result.timed_out),
    "solverWallTimeMs": solver_result.diagnostics.get("solverWallTimeMs"),
    "solverRawStatus": solver_result.diagnostics.get("solverRawStatus"),
  }
  for key, value in solver_meta.items():
    if value is not None:
      diagnostics.setdefault(key, value)
  elapsed_ms = int((time.perf_counter() - start) * 1000)
  return SolveResult(
    assignments=assignments,
    diagnostics=diagnostics,
    status=solver_result.status,
    solve_time_ms=elapsed_ms,
    best_objective=solver_result.best_objective,
    timed_out=solver_result.timed_out,
  )


def attempt_cpsat_schedule_run(
  schedule: ScheduleInput, label: str, cancel_token: Optional[CancellationToken] = None
) -> SolveResult:
  start = time.perf_counter()
  log_json(f"{label}-milp-input", serialize_schedule(schedule))
  solver_result = solve_with_cpsat(schedule, cancel_token)
  postprocessor = SchedulePostProcessor(
    schedule,
    solver_result.assignments,
    solver_result.diagnostics,
    getattr(schedule, "options", None),
  )
  assignments, diagnostics = postprocessor.run()
  log_json(
    f"{label}-milp-output",
    {
      "diagnostics": diagnostics,
      "assignments": serialize_assignments(assignments),
    },
  )
  postprocessor = None
  solver_meta = {
    "solverStatus": solver_result.diagnostics.get("solverStatus", solver_result.status),
    "solverTimedOut": solver_result.diagnostics.get("solverTimedOut", solver_result.timed_out),
    "solverWallTimeMs": solver_result.diagnostics.get("solverWallTimeMs"),
    "solverRawStatus": solver_result.diagnostics.get("solverRawStatus"),
  }
  for key, value in solver_meta.items():
    if value is not None:
      diagnostics.setdefault(key, value)
  elapsed_ms = int((time.perf_counter() - start) * 1000)
  return SolveResult(
    assignments=assignments,
    diagnostics=diagnostics,
    status=solver_result.status,
    solve_time_ms=elapsed_ms,
    best_objective=solver_result.best_objective,
    timed_out=solver_result.timed_out,
  )


def attempt_hybrid_schedule_run(
  schedule: ScheduleInput, label: str, cancel_token: Optional[CancellationToken] = None
) -> SolveResult:
  cpsat_result = attempt_cpsat_schedule_run(schedule, f"{label}-cpsat", cancel_token)
  ortools_result = attempt_schedule_run(schedule, f"{label}-ortools", cancel_token)
  diagnostics = ortools_result.diagnostics
  diagnostics.setdefault("preflightIssues", []).append(
    {
      "type": "solverInfo",
      "message": "Hybrid solver: CP-SAT then OR-Tools",
      "solver": "hybrid",
    }
  )
  diagnostics["hybrid"] = {"cpsatDiagnostics": cpsat_result.diagnostics}
  return SolveResult(
    assignments=ortools_result.assignments,
    diagnostics=diagnostics,
    status=ortools_result.status,
    solve_time_ms=max(ortools_result.solve_time_ms, cpsat_result.solve_time_ms),
    best_objective=ortools_result.best_objective or cpsat_result.best_objective,
    timed_out=ortools_result.timed_out or cpsat_result.timed_out,
  )


def build_relaxed_schedule(schedule: ScheduleInput, relax_level: int, diagnostics: Optional[Dict[str, Any]]) -> ScheduleInput:
  relaxed = copy.deepcopy(schedule)
  options = dict(getattr(relaxed, "options", {}) or {})
  weights = dict(options.get("constraintWeights") or {})
  decay = [0.8, 0.6, 0.4][min(relax_level, 2)]
  for key in ("staffing", "teamBalance", "careerBalance", "offBalance", "shiftPattern"):
    current = float(weights.get(key, 1.0))
    weights[key] = max(0.2, current * decay)
  options["constraintWeights"] = weights
  csp = dict(options.get("cspSettings") or {})
  base_off_tol = int(csp.get("offTolerance", 2))
  base_max_shift = int(csp.get("maxSameShift", 2))
  base_tabu = int(csp.get("tabuSize", 32))
  base_time = int(csp.get("timeLimitMs", 4000))

  if diagnostics:
    if diagnostics.get("staffingShortages"):
      csp["timeLimitMs"] = int(base_time * (1.5 + relax_level))
    if diagnostics.get("offBalanceGaps"):
      csp["offTolerance"] = base_off_tol + (2 + relax_level)
    if diagnostics.get("shiftPatternBreaks"):
      csp["maxSameShift"] = base_max_shift + 1 + relax_level
    if diagnostics.get("specialRequestMisses"):
      csp["tabuSize"] = max(8, base_tabu // (relax_level + 1))
  csp.setdefault("offTolerance", base_off_tol + relax_level)
  csp.setdefault("maxSameShift", base_max_shift + relax_level)
  csp.setdefault("tabuSize", max(8, base_tabu // (relax_level + 1)))
  csp["timeLimitMs"] = csp.get("timeLimitMs", base_time * (1.5 + relax_level))
  options["cspSettings"] = csp
  relaxed.options = options
  return relaxed


def _solve_single_attempt(
  schedule: ScheduleInput, preferred_solver: Optional[str] = None, cancel_token: Optional[CancellationToken] = None
) -> SolveResult:
  env_solver = os.environ.get("MILP_DEFAULT_SOLVER", "ortools").lower()
  solver_choice = (preferred_solver or env_solver or "ortools").lower()
  if solver_choice not in {"ortools", "cpsat", "hybrid"}:
    solver_choice = "ortools"

  def run_cpsat(phase: str):
    result = attempt_cpsat_schedule_run(schedule, phase, cancel_token)
    result.diagnostics.setdefault("preflightIssues", []).append(
      {
        "type": "solverInfo",
        "message": f"Schedule generated via CP-SAT ({phase}).",
        "solver": "cpsat",
      }
    )
    return result

  def run_hybrid():
    result = attempt_hybrid_schedule_run(schedule, "hybrid", cancel_token)
    return result

  if solver_choice == "cpsat":
    try:
      return run_cpsat("cpsat-primary")
    except Exception as cpsat_error:
      log_json("milp-error", {"phase": "cpsat-primary", "error": str(cpsat_error)})
      if preferred_solver == "cpsat":
        raise
      solver_choice = "ortools"

  if solver_choice == "hybrid":
    try:
      return run_hybrid()
    except Exception as hybrid_error:
      log_json("milp-error", {"phase": "hybrid", "error": str(hybrid_error)})
      if preferred_solver == "hybrid":
        raise
      solver_choice = "ortools"

  try:
    return attempt_schedule_run(schedule, "primary", cancel_token)
  except Exception as primary_error:
    log_json("milp-error", {"phase": "primary", "error": str(primary_error)})
    diagnostics_snapshot = getattr(primary_error, "diagnostics", None)
    for level in range(3):
      relaxed_schedule = build_relaxed_schedule(schedule, level, diagnostics_snapshot)
      try:
        result = attempt_schedule_run(relaxed_schedule, f"relaxed-{level+1}", cancel_token)
        result.diagnostics.setdefault("preflightIssues", []).append(
          {
            "type": "fallbackRelaxation",
            "message": f"Primary MILP run failed; applied relaxation level {level+1}.",
            "level": level + 1,
          }
        )
        relaxed_schedule = None
        return result
      except Exception as relaxed_error:
        log_json("milp-error", {"phase": f"relaxed-{level+1}", "error": str(relaxed_error)})
        diagnostics_snapshot = getattr(relaxed_error, "diagnostics", diagnostics_snapshot)
      finally:
        relaxed_schedule = None
    if solver_choice in {"cpsat", "ortools"}:
      try:
        return run_cpsat("cpsat-fallback")
      except Exception as cpsat_error:
        log_json("milp-error", {"phase": "cpsat-fallback", "error": str(cpsat_error)})
    raise


def _apply_weight_jitter(schedule: ScheduleInput, jitter_fraction: float, rng: random.Random):
  if jitter_fraction <= 0:
    return
  options = dict(getattr(schedule, "options", {}) or {})
  weights = dict(options.get("constraintWeights") or {})
  changed = False
  for key in ("staffing", "teamBalance", "careerBalance", "offBalance"):
    base_value = weights.get(key, 1.0)
    try:
      base_float = float(base_value)
    except (TypeError, ValueError):
      base_float = 1.0
    offset = rng.uniform(-jitter_fraction, jitter_fraction)
    weights[key] = max(0.1, base_float * (1.0 + offset))
    changed = True
  if changed:
    options["constraintWeights"] = weights
    schedule.options = options


def _safe_float(value: Any, default: float = 0.0) -> float:
  try:
    return float(value)
  except (TypeError, ValueError):
    return default


def _compute_solution_penalty(diagnostics: Optional[Dict[str, Any]]) -> float:
  if not isinstance(diagnostics, dict):
    return float("inf")
  post = diagnostics.get("postprocess")
  if isinstance(post, dict):
    final_penalty = post.get("finalPenalty")
    if isinstance(final_penalty, (int, float)):
      return float(final_penalty)
  penalty = 0.0
  for shortage in diagnostics.get("staffingShortages", []):
    penalty += 1000 * max(0.0, _safe_float(shortage.get("shortage", 0)))
  for gap in diagnostics.get("teamCoverageGaps", []):
    penalty += 400 * max(0.0, _safe_float(gap.get("shortage", 0)))
  for gap in diagnostics.get("careerGroupCoverageGaps", []):
    penalty += 350 * max(0.0, _safe_float(gap.get("shortage", 0)))
  for gap in diagnostics.get("teamWorkloadGaps", []):
    penalty += 200 * max(0.0, _safe_float(gap.get("difference", 0)))
  for gap in diagnostics.get("offBalanceGaps", []):
    penalty += 180 * max(0.0, _safe_float(gap.get("difference", 0)))
  for issue in diagnostics.get("shiftPatternBreaks", []):
    penalty += 120 * max(0.0, _safe_float(issue.get("excess", 0)))
  penalty += 150 * len(diagnostics.get("specialRequestMisses", []) or [])
  return penalty


def solve_job(
  schedule: ScheduleInput, preferred_solver: Optional[str] = None, cancel_token: Optional[CancellationToken] = None
) -> SolveResult:
  options = getattr(schedule, "options", {}) or {}
  pattern_constraints = options.get("patternConstraints") or {}
  try:
    override_consecutive = int(pattern_constraints.get("maxConsecutiveDaysThreeShift", 0))
  except (TypeError, ValueError):
    override_consecutive = 0
  if override_consecutive > 0:
    for employee in schedule.employees:
      work_pattern = getattr(employee, "workPatternType", "three-shift") or "three-shift"
      if work_pattern == "three-shift":
        employee.maxConsecutiveDaysPreferred = override_consecutive
  multi_run: Dict[str, Any] = options.get("multiRun") or {}
  try:
    attempts = int(multi_run.get("attempts", 1))
  except (ValueError, TypeError):
    attempts = 1
  attempts = max(1, min(10, attempts))
  try:
    jitter_pct = float(multi_run.get("weightJitterPct", 0.0))
  except (ValueError, TypeError):
    jitter_pct = 0.0
  jitter_fraction = max(0.0, jitter_pct) / 100.0
  try:
    requested_seed = multi_run.get("seed")
    seed_value = int(requested_seed) if requested_seed is not None else None
  except (ValueError, TypeError):
    seed_value = None
  if seed_value is None:
    seed_value = random.SystemRandom().randrange(1_000_000_000)
  rng = random.Random(seed_value)
  best_result: Optional[Dict[str, Any]] = None
  last_error: Optional[Exception] = None

  for attempt_index in range(attempts):
    if cancel_token and getattr(cancel_token, "cancelled", False):
      break
    candidate = copy.deepcopy(schedule)
    should_jitter = jitter_fraction > 0 and (attempts == 1 or attempt_index > 0)
    if should_jitter:
      _apply_weight_jitter(candidate, jitter_fraction, rng)
    try:
      result = _solve_single_attempt(candidate, preferred_solver, cancel_token)
    except Exception as exc:
      last_error = exc
      candidate = None
      continue
    penalty = _compute_solution_penalty(result.diagnostics)
    if best_result is None or penalty < best_result["penalty"]:
      best_result = {
        "result": result,
        "penalty": penalty,
        "attempt": attempt_index + 1,
      }
    candidate = None
    if penalty <= 0 and result.status in {"optimal", "feasible"}:
      break
    if cancel_token and getattr(cancel_token, "cancelled", False):
      break

  if best_result:
    result = best_result["result"]
    diagnostics = result.diagnostics
    if attempts > 1 or jitter_fraction > 0:
      diagnostics.setdefault("preflightIssues", []).append(
        {
          "type": "multiRunSummary",
          "message": f"MILP multi-run selected attempt {best_result['attempt']} / {attempts}",
          "attempts": attempts,
          "bestAttempt": best_result["attempt"],
          "bestPenalty": best_result["penalty"],
          "seed": seed_value,
          "weightJitterPct": jitter_pct,
        }
      )
    best_result = None
    gc.collect()
    return result

  gc.collect()
  if cancel_token and getattr(cancel_token, "cancelled", False):
    raise SolverFailure(
      "Solver cancelled",
      diagnostics={"solverStatus": "cancelled"},
    )
  if last_error:
    raise last_error
  raise RuntimeError("MILP solver failed for all attempts")


async def process_job(job: InternalJobState, payload: SchedulerJobRequest):
  schedule: Optional[ScheduleInput] = None
  solve_result: Optional[SolveResult] = None
  try:
    job.mark_processing()
    await persist_job_state(job, payload.model_dump())
    schedule = parse_schedule_input(payload.milpInput)
    loop = asyncio.get_running_loop()
    start_time = time.perf_counter()
    solve_result = await loop.run_in_executor(None, solve_job, schedule, payload.solver, job.cancel_token)
    elapsed = time.perf_counter() - start_time
    result_payload = build_solver_result(
      schedule,
      solve_result.assignments,
      elapsed,
      solve_result.diagnostics,
      solve_result.status,
    )
    if solve_result.status in {"optimal", "feasible"}:
      job.mark_completed(result_payload)
    elif solve_result.status == "timeout":
      job.mark_timed_out(result_payload, solve_result.diagnostics)
    elif solve_result.status == "cancelled":
      job.mark_cancelled(result_payload if solve_result.assignments else None)
    else:
      if solve_result.assignments:
        job.best_result = result_payload
        job.result = result_payload
      job.mark_failed(f"Solver returned status {solve_result.status}", solve_result.diagnostics)
    post_stats = job.result.get("generationResult", {}).get("postprocess") if job.result else None
    if post_stats:
      print(
        f"[Postprocess] job {job.id} iterations={post_stats.get('iterations')} "
        f"improvements={post_stats.get('improvements')} accepted_worse={post_stats.get('acceptedWorse')} "
        f"final_penalty={post_stats.get('finalPenalty')}"
      )
  except SolverFailure as exc:
    diag_obj = copy.deepcopy(getattr(exc, "diagnostics", None)) or {}
    guidance = _build_failure_guidance(diag_obj)
    diag_obj["guidance"] = guidance
    partial_result = None
    if solve_result and schedule:
      partial_result = build_solver_result(schedule, solve_result.assignments, 0, solve_result.diagnostics, solve_result.status)
      job.best_result = partial_result
      job.result = partial_result
    job.mark_failed(str(exc), diag_obj)
    diag_obj = None
  except Exception as exc:
    job.mark_failed(str(exc))
  finally:
    await persist_job_state(job)
    solve_result = None
    schedule = None
    asyncio.create_task(_cleanup_job_later(job.id))
    gc.collect()


@app.post("/scheduler/jobs", response_model=SchedulerJobResponse)
async def enqueue_job(request: SchedulerJobRequest):
  if "milpInput" not in request.model_dump():
    raise HTTPException(status_code=400, detail="milpInput is required")

  job_id = str(uuid4())
  job = InternalJobState(job_id)
  job.request_payload = request.model_dump()
  jobs[job_id] = job

  if UPSTASH_CLIENT:
    enqueued = await enqueue_upstash_job(job, job.request_payload)
    if enqueued:
      return SchedulerJobResponse(jobId=job_id)
    # fall back to local processing if enqueue fails

  asyncio.create_task(process_job(job, request))
  return SchedulerJobResponse(jobId=job_id)


@app.get("/scheduler/jobs/{job_id}", response_model=SchedulerJobStatus)
async def get_job_status(job_id: str):
  job = jobs.get(job_id)
  if job:
    return job.to_response()
  record = await fetch_job_record(job_id)
  if record:
    job = record_to_job(record)
    return job.to_response()
  raise HTTPException(status_code=404, detail="Job not found")


@app.post("/scheduler/jobs/{job_id}/cancel", response_model=SchedulerJobStatus)
async def cancel_job(job_id: str):
  job = jobs.get(job_id)
  if not job:
    record = await fetch_job_record(job_id)
    if not record:
      raise HTTPException(status_code=404, detail="Job not found")
    job = record_to_job(record)

  job.request_cancel()
  if job.status == 'queued':
    job.mark_cancelled(job.result)
  await persist_job_state(job)
  return job.to_response()
