import asyncio
import sys
import time
import json
import copy
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Literal, Optional
from uuid import uuid4
from dataclasses import asdict

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
  sys.path.append(str(CURRENT_DIR))

from models import Assignment, parse_schedule_input, ScheduleInput  # noqa: E402
from solver.ortools_solver import solve_with_ortools  # noqa: E402
from solver.highs_solver import solve_with_highs  # noqa: E402
from solver.postprocessor import SchedulePostProcessor  # noqa: E402

LOG_DIR = Path(os.environ.get("MILP_LOG_DIR", CURRENT_DIR / "logs"))


class SchedulerJobRequest(BaseModel):
  milpInput: Dict[str, Any]
  name: Optional[str] = None
  departmentId: Optional[str] = None
  solver: Optional[Literal['auto', 'ortools', 'highs']] = 'auto'


class SchedulerJobStatus(BaseModel):
  id: str
  status: Literal['queued', 'processing', 'completed', 'failed']
  result: Optional[Dict[str, Any]] = None
  error: Optional[str] = None
  createdAt: str
  updatedAt: str


class SchedulerJobResponse(BaseModel):
  jobId: str = Field(..., alias='jobId')


class InternalJobState:
  def __init__(self, job_id: str):
    now = datetime.utcnow().isoformat()
    self.id = job_id
    self.status: Literal['queued', 'processing', 'completed', 'failed'] = 'queued'
    self.result: Optional[Dict[str, Any]] = None
    self.error: Optional[str] = None
    self.created_at = now
    self.updated_at = now

  def to_response(self) -> SchedulerJobStatus:
    return SchedulerJobStatus(
      id=self.id,
      status=self.status,
      result=self.result,
      error=self.error,
      createdAt=self.created_at,
      updatedAt=self.updated_at,
    )

  def mark_processing(self):
    self.status = 'processing'
    self.updated_at = datetime.utcnow().isoformat()

  def mark_completed(self, result: Dict[str, Any]):
    self.status = 'completed'
    self.result = result
    self.updated_at = datetime.utcnow().isoformat()

  def mark_failed(self, error: str):
    self.status = 'failed'
    self.error = error
    self.updated_at = datetime.utcnow().isoformat()


app = FastAPI(title="MILP-CSP Scheduler Worker", version="0.1.0")
jobs: Dict[str, InternalJobState] = {}


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
  assignments: list[Assignment],
  computation_time: float,
  diagnostics: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
  diagnostics = diagnostics or {}
  staffing_shortages = diagnostics.get("staffingShortages", [])
  team_gaps = diagnostics.get("teamCoverageGaps", [])
  career_group_gaps = diagnostics.get("careerGroupCoverageGaps", [])
  team_workload_gaps = diagnostics.get("teamWorkloadGaps", [])
  off_balance_gaps = diagnostics.get("offBalanceGaps", [])
  shift_repeat_breaks = diagnostics.get("shiftPatternBreaks", [])
  request_misses = diagnostics.get("specialRequestMisses", [])
  preflight_issues = diagnostics.get("preflightIssues", [])
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
      "violations": violations,
      "score": {
        "total": 100,
        "fairness": 100,
        "preference": 100,
        "coverage": 100,
        "constraintSatisfaction": 100,
        "breakdown": [],
      },
      "offAccruals": [],
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


def serialize_schedule(schedule: ScheduleInput) -> Dict[str, Any]:
  return asdict(schedule)


def attempt_schedule_run(schedule: ScheduleInput, label: str) -> tuple[list[Assignment], Dict[str, Any]]:
  log_json(f"{label}-milp-input", serialize_schedule(schedule))
  assignments, diagnostics = solve_with_ortools(schedule)
  postprocessor = SchedulePostProcessor(
    schedule,
    assignments,
    diagnostics,
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
  return assignments, diagnostics


def attempt_highs_schedule_run(schedule: ScheduleInput, label: str) -> tuple[list[Assignment], Dict[str, Any]]:
  log_json(f"{label}-milp-input", serialize_schedule(schedule))
  assignments, diagnostics = solve_with_highs(schedule)
  log_json(
    f"{label}-milp-output",
    {
      "diagnostics": diagnostics,
      "assignments": serialize_assignments(assignments),
    },
  )
  return assignments, diagnostics


def build_relaxed_schedule(schedule: ScheduleInput, relax_level: int, diagnostics: Optional[Dict[str, Any]]) -> ScheduleInput:
  relaxed = copy.deepcopy(schedule)
  options = dict(getattr(relaxed, "options", {}) or {})
  weights = dict(options.get("constraintWeights") or {})
  decay = [0.8, 0.6, 0.4][min(relax_level, 2)]
  for key in ("staffing", "teamBalance", "careerBalance", "offBalance"):
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


def solve_job(schedule: ScheduleInput, preferred_solver: Optional[str] = None) -> tuple[list[Assignment], Dict[str, Any]]:
  env_solver = os.environ.get("MILP_DEFAULT_SOLVER", "auto").lower()
  solver_choice = (preferred_solver or env_solver or "auto").lower()
  if solver_choice not in {"auto", "ortools", "highs"}:
    solver_choice = "auto"

  def run_highs(phase: str):
    assignments, diagnostics = attempt_highs_schedule_run(schedule, phase)
    diagnostics.setdefault("preflightIssues", []).append(
      {
        "type": "solverInfo",
        "message": f"Schedule generated via HiGHS ({phase}).",
        "solver": "highs",
      }
    )
    return assignments, diagnostics

  if solver_choice == "highs":
    try:
      return run_highs("highs-primary")
    except Exception as highs_error:
      log_json("milp-error", {"phase": "highs-primary", "error": str(highs_error)})
      if preferred_solver == "highs":
        raise
      solver_choice = "auto"

  try:
    return attempt_schedule_run(schedule, "primary")
  except Exception as primary_error:
    log_json("milp-error", {"phase": "primary", "error": str(primary_error)})
    diagnostics_snapshot = getattr(primary_error, "diagnostics", None)
    for level in range(3):
      relaxed_schedule = build_relaxed_schedule(schedule, level, diagnostics_snapshot)
      try:
        assignments, diagnostics = attempt_schedule_run(relaxed_schedule, f"relaxed-{level+1}")
        diagnostics.setdefault("preflightIssues", []).append(
          {
            "type": "fallbackRelaxation",
            "message": f"Primary MILP run failed; applied relaxation level {level+1}.",
            "level": level + 1,
          }
        )
        return assignments, diagnostics
      except Exception as relaxed_error:
        log_json("milp-error", {"phase": f"relaxed-{level+1}", "error": str(relaxed_error)})
        diagnostics_snapshot = getattr(relaxed_error, "diagnostics", diagnostics_snapshot)
    if solver_choice in {"auto", "highs"}:
      try:
        return run_highs("highs-fallback")
      except Exception as highs_error:
        log_json("milp-error", {"phase": "highs-fallback", "error": str(highs_error)})
    raise


async def process_job(job: InternalJobState, payload: SchedulerJobRequest):
  job.mark_processing()
  try:
    schedule = parse_schedule_input(payload.milpInput)
    loop = asyncio.get_running_loop()
    start_time = time.perf_counter()
    assignments, diagnostics = await loop.run_in_executor(None, solve_job, schedule, payload.solver)
    elapsed = time.perf_counter() - start_time
    job.mark_completed(build_solver_result(assignments, elapsed, diagnostics))
    post_stats = job.result.get("generationResult", {}).get("postprocess") if job.result else None
    if post_stats:
      print(
        f"[Postprocess] job {job.id} iterations={post_stats.get('iterations')} "
        f"improvements={post_stats.get('improvements')} accepted_worse={post_stats.get('acceptedWorse')} "
        f"final_penalty={post_stats.get('finalPenalty')}"
      )
  except Exception as exc:
    job.mark_failed(str(exc))


@app.post("/scheduler/jobs", response_model=SchedulerJobResponse)
async def enqueue_job(request: SchedulerJobRequest):
  if "milpInput" not in request.model_dump():
    raise HTTPException(status_code=400, detail="milpInput is required")

  job_id = str(uuid4())
  job = InternalJobState(job_id)
  jobs[job_id] = job
  asyncio.create_task(process_job(job, request))
  return SchedulerJobResponse(jobId=job_id)


@app.get("/scheduler/jobs/{job_id}", response_model=SchedulerJobStatus)
async def get_job_status(job_id: str):
  job = jobs.get(job_id)
  if not job:
    raise HTTPException(status_code=404, detail="Job not found")
  return job.to_response()
