from __future__ import annotations

import itertools
import time
import os
from collections import Counter, defaultdict, deque
from math import exp
import random
from datetime import date, timedelta
from typing import Any, Deque, Dict, List, Optional, Set, Tuple

from models import Assignment, Employee, ScheduleInput

MAX_SAME_SHIFT = int(os.getenv("MILP_POSTPROCESS_MAX_SAME_SHIFT", "2"))
IGNORE_SHIFT_CODES = {"O", "V"}
DEFAULT_MAX_ITERATIONS = int(os.getenv("MILP_POSTPROCESS_MAX_ITERATIONS", "400"))
DEFAULT_TIME_LIMIT_MS = int(os.getenv("MILP_POSTPROCESS_TIME_LIMIT_MS", "4000"))
DEFAULT_TABU_SIZE = int(os.getenv("MILP_POSTPROCESS_TABU_SIZE", "32"))
DEFAULT_ANNEALING_TEMP = float(os.getenv("MILP_POSTPROCESS_ANNEAL_TEMP", "5.0"))
DEFAULT_ANNEALING_COOL = float(os.getenv("MILP_POSTPROCESS_ANNEAL_COOL", "0.92"))
OFF_BALANCE_TOLERANCE = int(os.getenv("MILP_POSTPROCESS_OFF_TOLERANCE", "2"))
DEFAULT_REQUIRED_STAFF = {"D": 5, "E": 4, "N": 3}


def _normalize_shift_code(shift_code: Optional[str]) -> str:
  return (shift_code or "").replace("^", "").upper()


def _build_date_range(start: date, end: date) -> List[date]:
  current = start
  dates: List[date] = []
  while current <= end:
    dates.append(current)
    current += timedelta(days=1)
  return dates


class ScheduleState:
  def __init__(self, schedule: ScheduleInput, assignments: List[Assignment]):
    self.schedule = schedule
    self.assignments = assignments
    self.date_range = _build_date_range(schedule.startDate, schedule.endDate)
    self.day_keys = [day.isoformat() for day in self.date_range]
    self.day_lookup = {day.isoformat(): day for day in self.date_range}
    self.assignment_map: Dict[Tuple[str, str], Assignment] = {}
    self.assignments_by_day: Dict[str, Dict[str, Assignment]] = defaultdict(dict)
    for assignment in assignments:
      day_key = assignment.date
      self.assignment_map[(assignment.employeeId, day_key)] = assignment
      self.assignments_by_day[day_key][assignment.employeeId] = assignment
    self.employee_map: Dict[str, Employee] = {emp.id: emp for emp in schedule.employees}

  def swap_assignments(self, day_key: str, employee_a: str, employee_b: str) -> bool:
    assignment_a = self.assignment_map.get((employee_a, day_key))
    assignment_b = self.assignment_map.get((employee_b, day_key))
    if not assignment_a or not assignment_b:
      return False
    if assignment_a.isLocked or assignment_b.isLocked:
      return False
    new_shift_a = assignment_b.shiftType
    new_shift_b = assignment_a.shiftType
    if not self._is_shift_allowed(employee_a, day_key, new_shift_a):
      return False
    if not self._is_shift_allowed(employee_b, day_key, new_shift_b):
      return False
    assignment_a.shiftId, assignment_b.shiftId = assignment_b.shiftId, assignment_a.shiftId
    assignment_a.shiftType, assignment_b.shiftType = new_shift_a, new_shift_b
    return True

  def swap_pair(self, day_a: str, employee_a: str, day_b: str, employee_b: str) -> bool:
    if day_a == day_b:
      return self.swap_assignments(day_a, employee_a, employee_b)
    assignment_a = self.assignment_map.get((employee_a, day_a))
    assignment_b = self.assignment_map.get((employee_b, day_b))
    if not assignment_a or not assignment_b:
      return False
    if assignment_a.isLocked or assignment_b.isLocked:
      return False
    new_shift_a = assignment_b.shiftType
    new_shift_b = assignment_a.shiftType
    if not self._is_shift_allowed(employee_a, day_a, new_shift_a):
      return False
    if not self._is_shift_allowed(employee_b, day_b, new_shift_b):
      return False
    assignment_a.shiftId, assignment_b.shiftId = assignment_b.shiftId, assignment_a.shiftId
    assignment_a.shiftType, assignment_b.shiftType = new_shift_a, new_shift_b
    return True

  def _is_shift_allowed(self, employee_id: str, day_key: str, shift_code: Optional[str]) -> bool:
    employee = self.employee_map.get(employee_id)
    if not employee or not shift_code:
      return False
    upper = shift_code.replace("^", "").upper()
    day = self.day_lookup.get(day_key)
    if not day:
      return False
    if upper == "V":
      return True
    if employee.workPatternType == "night-intensive":
      return upper in {"N", "O", "V"}
    if employee.workPatternType == "weekday-only":
      if day.weekday() >= 5:
        return upper in {"O", "V"}
      return upper in {"A", "V"}
    if upper == "A":
      return False
    return True


class SchedulePostProcessor:
  def __init__(
    self,
    schedule: ScheduleInput,
    assignments: List[Assignment],
    base_diagnostics: Dict[str, List[Dict[str, str]]],
    solver_options: Optional[Dict[str, Any]] = None,
  ):
    self.schedule = schedule
    self.options = solver_options or {}
    self.state = ScheduleState(schedule, assignments)
    raw_required = schedule.requiredStaffPerShift or {}
    normalized_required: Dict[str, int] = {}
    for code, value in raw_required.items():
      if not code:
        continue
      try:
        parsed = int(value)
      except (TypeError, ValueError):
        continue
      normalized_required[code.upper()] = max(0, parsed)
    for code, default_value in DEFAULT_REQUIRED_STAFF.items():
      normalized_required.setdefault(code, default_value)
    self.required_staff = {code: value for code, value in normalized_required.items() if value > 0}
    self.team_ids = sorted({emp.teamId for emp in schedule.employees if emp.teamId})
    self.team_members: Dict[str, List[Employee]] = defaultdict(list)
    for emp in schedule.employees:
      if emp.teamId:
        self.team_members[emp.teamId].append(emp)
    self.career_group_aliases = sorted(
      {emp.careerGroupAlias for emp in schedule.employees if getattr(emp, "careerGroupAlias", None)}
    )
    self.team_coverage_shift_codes = {
      code.upper() for code, value in self.required_staff.items() if value and code.upper() not in {"O", "A"}
    }
    team_pattern = getattr(schedule, "teamPattern", None)
    raw_avoid = getattr(team_pattern, "avoidPatterns", None) if team_pattern else None
    self.avoid_patterns: List[List[str]] = []
    if raw_avoid:
      for pattern in raw_avoid:
        if not isinstance(pattern, list):
          continue
        normalized = [str(code).upper() for code in pattern if isinstance(code, str) and code.strip()]
        if normalized:
          self.avoid_patterns.append(normalized)
    self.preflight_issues = base_diagnostics.get("preflightIssues", []) if base_diagnostics else []
    csp_options = self.options.get("cspSettings", {}) or {}
    self.constraint_weight_map = self.options.get("constraintWeights", {}) or {}
    self.max_iterations = int(csp_options.get("maxIterations", DEFAULT_MAX_ITERATIONS))
    self.time_limit_ms = int(csp_options.get("timeLimitMs", DEFAULT_TIME_LIMIT_MS))
    self.tabu_size = max(0, int(csp_options.get("tabuSize", DEFAULT_TABU_SIZE)))
    self.max_same_shift = int(csp_options.get("maxSameShift", MAX_SAME_SHIFT))
    self.off_balance_tolerance = int(csp_options.get("offTolerance", OFF_BALANCE_TOLERANCE))
    self.team_workload_tolerance = max(1, self.off_balance_tolerance)
    self.tabu_queue: Deque[Tuple[Tuple[str, str], Tuple[str, str]]] = deque(maxlen=self.tabu_size)
    self.tabu_set: Set[Tuple[Tuple[str, str], Tuple[str, str]]] = set()
    self.current_penalty = None
    self.initial_penalty = None
    self.iterations = 0
    self.improvements = 0
    self.accepted_worse_moves = 0
    annealing_options = csp_options.get("annealing", {}) or {}
    self.temperature = float(annealing_options.get("temperature", DEFAULT_ANNEALING_TEMP))
    default_cool = DEFAULT_ANNEALING_COOL if 0 < DEFAULT_ANNEALING_COOL < 1 else 0.9
    self.cool_rate = float(annealing_options.get("coolingRate", default_cool))

  def run(self) -> Tuple[List[Assignment], Dict[str, List[Dict[str, str]]]]:
    start = time.perf_counter()
    penalty, diagnostics = self._evaluate(with_diagnostics=True)
    self.initial_penalty = penalty
    self.current_penalty = penalty
    latest_diagnostics = diagnostics
    time_limit_sec = self.time_limit_ms / 1000
    while self.iterations < self.max_iterations and (time.perf_counter() - start) < time_limit_sec:
      violation = self._pick_violation(latest_diagnostics)
      if not violation:
        break
      result = self._resolve_violation(violation)
      self.iterations += 1
      if result:
        new_penalty, latest_diagnostics = result
        if new_penalty + 1e-6 < (self.current_penalty or float("inf")):
          self.improvements += 1
        self.current_penalty = new_penalty
      else:
        continue
      self.temperature *= self.cool_rate
    latest_diagnostics["preflightIssues"] = self.preflight_issues
    latest_diagnostics["postprocess"] = {
      "initialPenalty": self.initial_penalty,
      "finalPenalty": self.current_penalty,
      "iterations": self.iterations,
      "improvements": self.improvements,
      "acceptedWorse": self.accepted_worse_moves,
      "temperature": self.temperature,
    }
    return self.state.assignments, latest_diagnostics

  def _pick_violation(self, diagnostics: Dict[str, List[Dict[str, str]]]) -> Optional[Dict[str, Dict[str, str]]]:
    priority_order = [
      ("staffingShortages", "staffingShortage"),
      ("shiftPatternBreaks", "shiftPatternBreak"),
      ("teamCoverageGaps", "teamCoverage"),
      ("careerGroupCoverageGaps", "careerGroup"),
      ("teamWorkloadGaps", "teamWorkload"),
      ("offBalanceGaps", "offBalance"),
      ("avoidPatternViolations", "avoidPattern"),
      ("specialRequestMisses", "specialRequest"),
    ]
    for key, violation_type in priority_order:
      entries = diagnostics.get(key) or []
      if entries:
        return {"type": violation_type, "data": entries[0]}
    return None

  def _resolve_violation(self, violation: Dict[str, Dict[str, str]]) -> Optional[Tuple[float, Dict[str, List[Dict[str, str]]]]]:
    violation_type = violation["type"]
    data = violation["data"]
    if violation_type == "teamCoverage":
      return self._resolve_team_gap(data)
    if violation_type == "careerGroup":
      return self._resolve_career_gap(data)
    if violation_type == "teamWorkload":
      return self._resolve_team_workload_gap(data)
    if violation_type == "offBalance":
      return self._resolve_off_balance_gap(data)
    if violation_type == "shiftPatternBreak":
      return self._resolve_shift_violation(data)
    if violation_type == "avoidPattern":
      return self._resolve_avoid_pattern_violation(data)
    if violation_type == "staffingShortage":
      return self._resolve_staffing_shortage(data)
    if violation_type == "specialRequest":
      return self._resolve_special_request(data)
    return None

  def _resolve_shift_violation(self, violation: Dict[str, str]) -> Optional[Tuple[float, Dict[str, List[Dict[str, str]]]]]:
    employee_id = violation["employeeId"]
    start_date = violation["startDate"]
    window = violation["window"]
    try:
      start_index = self.state.day_keys.index(start_date)
    except ValueError:
      return False
    window_keys = self.state.day_keys[start_index : min(len(self.state.day_keys), start_index + window)]
    candidates: List[Tuple[str, str, str, str]] = []
    for day_key in window_keys:
      assignment = self.state.assignment_map.get((employee_id, day_key))
      if not assignment:
        continue
      if _normalize_shift_code(assignment.shiftType) != _normalize_shift_code(violation["shiftType"]):
        continue
      day_assignments = self.state.assignments_by_day.get(day_key, {})
      for other_id, other_assignment in day_assignments.items():
        if other_id == employee_id or other_assignment.isLocked:
          continue
        if _normalize_shift_code(other_assignment.shiftType) == _normalize_shift_code(violation["shiftType"]):
          continue
        if _normalize_shift_code(other_assignment.shiftType) in {"O", "V"}:
          candidates.insert(0, (day_key, employee_id, day_key, other_id))
        else:
          candidates.append((day_key, employee_id, day_key, other_id))
    return self._apply_best_swap(candidates)

  def _evaluate(self, with_diagnostics: bool = False) -> Tuple[float, Optional[Dict[str, List[Dict[str, str]]]]]:
    diagnostics = self._collect_diagnostics()
    penalty = self._score_from_diagnostics(diagnostics)
    if with_diagnostics:
      return penalty, diagnostics
    return penalty, None

  def _resolve_team_gap(self, violation: Dict[str, str]) -> Optional[Tuple[float, Dict[str, List[Dict[str, str]]]]]:
    day_key = violation["date"]
    shift_code = violation["shiftType"]
    team_id = violation["teamId"]
    day_assignments = self.state.assignments_by_day.get(day_key, {})
    target_assignments = [
      assignment for assignment in day_assignments.values() if _normalize_shift_code(assignment.shiftType) == shift_code
    ]
    other_assignments = [
      assignment
      for assignment in day_assignments.values()
      if _normalize_shift_code(assignment.shiftType) != shift_code and self._employee_in_team(assignment.employeeId, team_id)
    ]
    candidates: List[Tuple[str, str, str, str]] = []
    for assignment in target_assignments:
      if self._employee_in_team(assignment.employeeId, team_id):
        continue
      for other in other_assignments:
        candidates.append((day_key, assignment.employeeId, day_key, other.employeeId))
    return self._apply_best_swap(candidates)

  def _resolve_staffing_shortage(self, violation: Dict[str, str]) -> Optional[Tuple[float, Dict[str, List[Dict[str, str]]]]]:
    day_key = violation["date"]
    shift_code = violation["shiftType"]
    candidates: List[Tuple[str, str, str, str]] = []
    for employee in self.schedule.employees:
      assignment_today = self.state.assignment_map.get((employee.id, day_key))
      if not assignment_today or assignment_today.isLocked:
        continue
      for other_day in self.state.day_keys:
        if other_day == day_key:
          continue
        other_assignment = self.state.assignment_map.get((employee.id, other_day))
        if not other_assignment or other_assignment.isLocked:
          continue
        if _normalize_shift_code(other_assignment.shiftType) != shift_code:
          continue
        candidates.append((day_key, employee.id, other_day, employee.id))
    return self._apply_best_swap(candidates)

  def _resolve_team_workload_gap(self, violation: Dict[str, str]) -> Optional[Tuple[float, Dict[str, List[Dict[str, str]]]]]:
    donor_team = violation["teamA"]
    receiver_team = violation["teamB"]
    donor_members = self.team_members.get(donor_team, [])
    receiver_members = self.team_members.get(receiver_team, [])
    if not donor_members or not receiver_members:
      return None
    candidates: List[Tuple[str, str, str, str]] = []
    # Same-day swaps where receiver has OFF/행정
    for day_key in self.state.day_keys:
      day_assignments = self.state.assignments_by_day.get(day_key, {})
      for donor in donor_members:
        donor_assignment = day_assignments.get(donor.id)
        if not donor_assignment or donor_assignment.isLocked:
          continue
        if _normalize_shift_code(donor_assignment.shiftType) in {"O"}:
          continue
        for receiver in receiver_members:
          receiver_assignment = day_assignments.get(receiver.id)
          if not receiver_assignment or receiver_assignment.isLocked:
            continue
          if _normalize_shift_code(receiver_assignment.shiftType) in {"O", "A"}:
            candidates.append((day_key, donor.id, day_key, receiver.id))
    # Cross-day swap: donor working day ↔ receiver off day
    max_candidates = 80
    for donor in donor_members:
      donor_work_days = [
        day_key
        for day_key in self.state.day_keys
        if (assignment := self.state.assignment_map.get((donor.id, day_key)))
        and not assignment.isLocked
        and _normalize_shift_code(assignment.shiftType) not in {"O", "A"}
      ]
      if not donor_work_days:
        continue
      for receiver in receiver_members:
        receiver_off_days = [
          day_key
          for day_key in self.state.day_keys
          if (assignment := self.state.assignment_map.get((receiver.id, day_key)))
          and not assignment.isLocked
          and _normalize_shift_code(assignment.shiftType) in {"O", "A"}
        ]
        for donor_day in donor_work_days:
          if len(candidates) >= max_candidates:
            break
          for receiver_day in receiver_off_days:
            candidates.append((donor_day, donor.id, receiver_day, receiver.id))
            if len(candidates) >= max_candidates:
              break
    if not candidates:
      return None
    return self._apply_best_swap(candidates)

  def _resolve_avoid_pattern_violation(self, violation: Dict[str, str]) -> Optional[Tuple[float, Dict[str, List[Dict[str, str]]]]]:
    employee_id = violation["employeeId"]
    start_index = violation.get("startIndex")
    pattern = violation.get("pattern") or []
    if start_index is None or not pattern:
      return None
    candidates: List[Tuple[str, str, str, str]] = []
    for offset, shift_code in enumerate(pattern):
      day_position = start_index + offset
      if day_position >= len(self.state.day_keys):
        break
      day_key = self.state.day_keys[day_position]
      day_assignments = self.state.assignments_by_day.get(day_key, {})
      for other_id, assignment in day_assignments.items():
        if other_id == employee_id or assignment.isLocked:
          continue
        if _normalize_shift_code(assignment.shiftType) == shift_code:
          continue
        candidates.append((day_key, employee_id, day_key, other_id))
    if not candidates:
      return None
    return self._apply_best_swap(candidates)

  def _resolve_special_request(self, violation: Dict[str, str]) -> Optional[Tuple[float, Dict[str, List[Dict[str, str]]]]]:
    employee_id = violation["employeeId"]
    day_key = violation["date"]
    shift_code = violation["shiftType"]
    candidates: List[Tuple[str, str, str, str]] = []
    current_assignment = self.state.assignment_map.get((employee_id, day_key))
    if current_assignment:
      if _normalize_shift_code(current_assignment.shiftType) != shift_code and not current_assignment.isLocked:
        day_assignments = self.state.assignments_by_day.get(day_key, {})
        for other_id, assignment in day_assignments.items():
          if assignment.isLocked:
            continue
          if _normalize_shift_code(assignment.shiftType) == shift_code:
            candidates.append((day_key, employee_id, day_key, other_id))
    for other_day in self.state.day_keys:
      if other_day == day_key:
        continue
      other_assignment = self.state.assignment_map.get((employee_id, other_day))
      if not other_assignment or other_assignment.isLocked:
        continue
      if _normalize_shift_code(other_assignment.shiftType) == shift_code:
        candidates.append((other_day, employee_id, day_key, employee_id))
    return self._apply_best_swap(candidates)

  def _resolve_career_gap(self, violation: Dict[str, str]) -> Optional[Tuple[float, Dict[str, List[Dict[str, str]]]]]:
    day_key = violation["date"]
    shift_code = violation["shiftType"]
    alias = violation["careerGroupAlias"]
    day_assignments = self.state.assignments_by_day.get(day_key, {})
    target_assignments = [
      assignment for assignment in day_assignments.values() if _normalize_shift_code(assignment.shiftType) == shift_code
    ]
    other_assignments = [
      assignment
      for assignment in day_assignments.values()
      if _normalize_shift_code(assignment.shiftType) != shift_code and self._employee_in_career_group(assignment.employeeId, alias)
    ]
    candidates: List[Tuple[str, str, str, str]] = []
    for assignment in target_assignments:
      if self._employee_in_career_group(assignment.employeeId, alias):
        continue
      for other in other_assignments:
        candidates.append((day_key, assignment.employeeId, day_key, other.employeeId))
    return self._apply_best_swap(candidates)

  def _resolve_off_balance_gap(self, violation: Dict[str, str]) -> Optional[Tuple[float, Dict[str, List[Dict[str, str]]]]]:
    team_id = violation["teamId"]
    employee_a = violation["employeeA"]
    employee_b = violation["employeeB"]
    counts = self._off_day_counts()
    if counts.get(employee_a, 0) >= counts.get(employee_b, 0):
      donor, receiver = employee_a, employee_b
    else:
      donor, receiver = employee_b, employee_a
    candidates: List[Tuple[str, str, str, str]] = []
    for day_key in self.state.day_keys:
      donor_assignment = self.state.assignment_map.get((donor, day_key))
      receiver_assignment = self.state.assignment_map.get((receiver, day_key))
      if not donor_assignment or not receiver_assignment:
        continue
      if _normalize_shift_code(donor_assignment.shiftType) != "O":
        continue
      if _normalize_shift_code(receiver_assignment.shiftType) == "O":
        continue
      candidates.append((day_key, donor, day_key, receiver))
    return self._apply_best_swap(candidates)

  def _collect_diagnostics(self) -> Dict[str, List[Dict[str, str]]]:
    diagnostics: Dict[str, List[Dict[str, str]]] = {
      "staffingShortages": [],
      "teamCoverageGaps": [],
      "careerGroupCoverageGaps": [],
      "specialRequestMisses": [],
      "offBalanceGaps": [],
      "shiftPatternBreaks": [],
      "teamWorkloadGaps": [],
      "avoidPatternViolations": [],
    }
    shift_lookup: Dict[Tuple[str, str], List[Assignment]] = defaultdict(list)
    for assignment in self.state.assignments:
      shift_code = _normalize_shift_code(assignment.shiftType)
      shift_lookup[(assignment.date, shift_code)].append(assignment)
    for day_key in self.state.day_keys:
      for code, min_required in self.required_staff.items():
        upper = code.upper()
        assigned = shift_lookup.get((day_key, upper), [])
        covered = len(assigned)
        if min_required and covered < min_required:
          diagnostics["staffingShortages"].append(
            {
              "date": day_key,
              "shiftType": upper,
              "required": int(min_required),
              "covered": covered,
              "shortage": int(min_required - covered),
            }
          )
        if upper not in self.team_coverage_shift_codes:
          continue
        for team_id in self.team_ids:
          if not self._team_has_eligible_member(team_id, day_key, upper):
            continue
          if any(self._employee_in_team(a.employeeId, team_id) for a in assigned):
            continue
          diagnostics["teamCoverageGaps"].append(
            {
              "date": day_key,
              "shiftType": upper,
              "teamId": team_id,
              "shortage": 1,
            }
          )
        for alias in self.career_group_aliases:
          if not self._career_group_has_eligible(alias, day_key, upper):
            continue
          if any(self._employee_in_career_group(a.employeeId, alias) for a in assigned):
            continue
          diagnostics["careerGroupCoverageGaps"].append(
            {
              "date": day_key,
              "shiftType": upper,
              "careerGroupAlias": alias,
              "shortage": 1,
            }
          )
    diagnostics["shiftPatternBreaks"] = self._detect_shift_pattern_breaks()
    diagnostics["specialRequestMisses"] = self._detect_special_request_misses()
    diagnostics["offBalanceGaps"] = self._detect_off_balance_gaps()
    diagnostics["teamWorkloadGaps"] = self._detect_team_workload_gaps()
    diagnostics["avoidPatternViolations"] = self._detect_avoid_pattern_violations()
    return diagnostics

  def _team_has_eligible_member(self, team_id: str, day_key: str, shift_code: str) -> bool:
    members = self.team_members.get(team_id, [])
    day = self.state.day_lookup.get(day_key)
    if not day:
      return False
    for member in members:
      if self._is_shift_allowed(member, day, shift_code):
        return True
    return False

  def _career_group_has_eligible(self, alias: str, day_key: str, shift_code: str) -> bool:
    day = self.state.day_lookup.get(day_key)
    if not day:
      return False
    for emp in self.schedule.employees:
      if emp.careerGroupAlias == alias and self._is_shift_allowed(emp, day, shift_code):
        return True
    return False

  def _detect_special_request_misses(self) -> List[Dict[str, str]]:
    misses: List[Dict[str, str]] = []
    lookup = self.state.assignment_map
    for request in self.schedule.specialRequests or []:
      shift = _normalize_shift_code(request.shiftTypeCode)
      day_key = request.date
      try:
        day_key = date.fromisoformat(request.date).isoformat()
      except ValueError:
        pass
      assignment = lookup.get((request.employeeId, day_key))
      if not assignment:
        misses.append({"employeeId": request.employeeId, "date": day_key, "shiftType": shift})
        continue
      if shift and _normalize_shift_code(assignment.shiftType) != shift:
        misses.append({"employeeId": request.employeeId, "date": day_key, "shiftType": shift})
    return misses

  def _detect_off_balance_gaps(self) -> List[Dict[str, str]]:
    counts = self._off_day_counts()
    gaps: List[Dict[str, str]] = []
    for team_id, members in self.team_members.items():
      if len(members) < 2:
        continue
      for emp_a, emp_b in itertools.combinations(members, 2):
        diff = abs(counts.get(emp_a.id, 0) - counts.get(emp_b.id, 0))
        if diff > self.off_balance_tolerance:
          gaps.append(
            {
              "teamId": team_id,
              "employeeA": emp_a.id,
              "employeeB": emp_b.id,
              "difference": diff,
              "tolerance": self.off_balance_tolerance,
            }
          )
    return gaps

  def _detect_team_workload_gaps(self) -> List[Dict[str, str]]:
    workloads: Counter[str] = Counter()
    for assignment in self.state.assignments:
      employee = self.state.employee_map.get(assignment.employeeId)
      if not employee or not employee.teamId:
        continue
      code = _normalize_shift_code(assignment.shiftType)
      if code in {"O", "A", "V"}:
        continue
      workloads[employee.teamId] += 1
    gaps: List[Dict[str, str]] = []
    for i in range(len(self.team_ids)):
      for j in range(i + 1, len(self.team_ids)):
        team_a = self.team_ids[i]
        team_b = self.team_ids[j]
        diff = abs(workloads.get(team_a, 0) - workloads.get(team_b, 0))
        if diff > self.team_workload_tolerance:
          if workloads.get(team_a, 0) >= workloads.get(team_b, 0):
            donor, receiver = team_a, team_b
          else:
            donor, receiver = team_b, team_a
          gaps.append(
            {
              "teamA": donor,
              "teamB": receiver,
              "difference": diff,
              "tolerance": self.team_workload_tolerance,
            }
          )
    return gaps

  def _detect_avoid_pattern_violations(self) -> List[Dict[str, str]]:
    if not self.avoid_patterns:
      return []
    violations: List[Dict[str, str]] = []
    total_days = len(self.state.day_keys)
    for emp in self.schedule.employees:
      for pattern in self.avoid_patterns:
        pattern_length = len(pattern)
        if pattern_length == 0 or pattern_length > total_days:
          continue
        for start in range(0, total_days - pattern_length + 1):
          matches = True
          for offset, code in enumerate(pattern):
            day_key = self.state.day_keys[start + offset]
            assignment = self.state.assignment_map.get((emp.id, day_key))
            if not assignment or _normalize_shift_code(assignment.shiftType) != code:
              matches = False
              break
          if matches:
            violations.append(
              {
                "employeeId": emp.id,
                "startDate": self.state.day_keys[start],
                "pattern": pattern,
                "startIndex": start,
              }
            )
            break
    return violations

  def _off_day_counts(self) -> Dict[str, int]:
    counts: Dict[str, int] = Counter()
    for assignment in self.state.assignments:
      code = _normalize_shift_code(assignment.shiftType)
      if code in {"O", "V"}:
        counts[assignment.employeeId] += 1
    return counts

  def _detect_shift_pattern_breaks(self) -> List[Dict[str, str]]:
    violations: List[Dict[str, str]] = []
    for emp in self.schedule.employees:
      last_code = None
      streak = 0
      for idx, day_key in enumerate(self.state.day_keys):
        assignment = self.state.assignment_map.get((emp.id, day_key))
        if not assignment:
          continue
        code = _normalize_shift_code(assignment.shiftType)
        if code in IGNORE_SHIFT_CODES:
          last_code = code
          streak = 1
          continue
        if code == last_code:
          streak += 1
        else:
          streak = 1
          last_code = code
        if streak > self.max_same_shift:
          start_index = max(0, idx - self.max_same_shift)
          violations.append(
            {
              "employeeId": emp.id,
              "shiftType": code,
              "startDate": self.state.day_keys[start_index],
              "window": self.max_same_shift + 1,
              "excess": streak - self.max_same_shift,
            }
          )
    return violations

  def _score_from_diagnostics(self, diagnostics: Dict[str, List[Dict[str, str]]]) -> float:
    return (
      100 * len(diagnostics["staffingShortages"]) * self._weight("staffing")
      + 50 * len(diagnostics["teamCoverageGaps"]) * self._weight("teamBalance")
      + 40 * len(diagnostics["careerGroupCoverageGaps"]) * self._weight("careerBalance")
      + 35 * len(diagnostics["teamWorkloadGaps"]) * self._weight("teamBalance")
      + 30 * len(diagnostics["specialRequestMisses"])
      + 20 * len(diagnostics["offBalanceGaps"]) * self._weight("offBalance")
      + 10 * len(diagnostics["shiftPatternBreaks"]) * self._weight("shiftPattern")
      + 10 * len(diagnostics["avoidPatternViolations"])
    )

  def _apply_best_swap(self, candidates: List[Tuple[str, str, str, str]]) -> Optional[Tuple[float, Dict[str, List[Dict[str, str]]]]]:
    best_improvement: Optional[Tuple[float, str, str, str, str]] = None
    best_worse: Optional[Tuple[float, str, str, str, str]] = None
    for day_a, emp_a, day_b, emp_b in candidates:
      penalty = self._assess_swap_penalty(day_a, emp_a, day_b, emp_b)
      if penalty is None:
        continue
      current = self.current_penalty if self.current_penalty is not None else penalty
      delta = penalty - current
      if delta < -1e-6:
        if not best_improvement or penalty < best_improvement[0]:
          best_improvement = (penalty, day_a, emp_a, day_b, emp_b)
      else:
        if not best_worse or penalty < best_worse[0]:
          best_worse = (penalty, day_a, emp_a, day_b, emp_b)
    chosen = None
    if best_improvement:
      chosen = best_improvement
    elif best_worse and self._accept_worse_move(best_worse[0]):
      chosen = best_worse
      self.accepted_worse_moves += 1
    if not chosen:
      return None
    _, day_a, emp_a, day_b, emp_b = chosen
    if not self.state.swap_pair(day_a, emp_a, day_b, emp_b):
      return None
    self._register_tabu(day_a, emp_a, day_b, emp_b)
    penalty, diagnostics = self._evaluate(with_diagnostics=True)
    return penalty, diagnostics

  def _resolve_pattern_violation(self, violation: Dict[str, str]) -> Optional[Tuple[float, Dict[str, List[Dict[str, str]]]]]:
    employee_id = violation["employeeId"]
    shift_code = violation["shiftType"]
    candidates: List[Tuple[str, str, str, str]] = []
    # swap 해당 직원의 한 날짜와 다른 직원의 다른 날짜
    for other_day in self.state.day_keys:
      other_assignment = self.state.assignment_map.get((employee_id, other_day))
      if not other_assignment or other_assignment.isLocked:
        continue
      if _normalize_shift_code(other_assignment.shiftType) != shift_code:
        continue
      for third_day in self.state.day_keys:
        if third_day == other_day:
          continue
        third_assignments = self.state.assignments_by_day.get(third_day, {})
        for other_emp, assignment in third_assignments.items():
          if other_emp == employee_id or assignment.isLocked:
            continue
          candidates.append((other_day, employee_id, third_day, other_emp))
    return self._apply_best_swap(candidates)

  def _resolve_multi_staffing(self, violation: Dict[str, str]) -> Optional[Tuple[float, Dict[str, List[Dict[str, str]]]]]:
    day_key = violation["date"]
    shift_code = violation["shiftType"]
    candidates: List[Tuple[str, str, str, str]] = []
    day_assignments = self.state.assignments_by_day.get(day_key, {})
    # try swapping any two employees across different days to free up staff for the shortage shift
    for emp_id, assignment in day_assignments.items():
      if _normalize_shift_code(assignment.shiftType) == shift_code:
        continue
      if assignment.isLocked:
        continue
      for other_day in self.state.day_keys:
        if other_day == day_key:
          continue
        other_assignment = self.state.assignment_map.get((emp_id, other_day))
        if not other_assignment or other_assignment.isLocked:
          continue
        if _normalize_shift_code(other_assignment.shiftType) == shift_code:
          candidates.append((other_day, emp_id, day_key, emp_id))
    return self._apply_best_swap(candidates)

  def _assess_swap_penalty(self, day_a: str, emp_a: str, day_b: str, emp_b: str) -> Optional[float]:
    if self._is_tabu(day_a, emp_a, day_b, emp_b):
      return None
    if not self.state.swap_pair(day_a, emp_a, day_b, emp_b):
      return None
    penalty, _ = self._evaluate(with_diagnostics=False)
    self.state.swap_pair(day_a, emp_a, day_b, emp_b)
    return penalty

  def _tabu_key(self, day_a: str, emp_a: str, day_b: str, emp_b: str) -> Tuple[Tuple[str, str], Tuple[str, str]]:
    ordered = tuple(sorted([(day_a, emp_a), (day_b, emp_b)]))
    return ordered  # type: ignore

  def _is_tabu(self, day_a: str, emp_a: str, day_b: str, emp_b: str) -> bool:
    if self.tabu_size <= 0:
      return False
    return self._tabu_key(day_a, emp_a, day_b, emp_b) in self.tabu_set

  def _register_tabu(self, day_a: str, emp_a: str, day_b: str, emp_b: str):
    if self.tabu_size <= 0:
      return
    key = self._tabu_key(day_a, emp_a, day_b, emp_b)
    if key in self.tabu_set:
      return
    if len(self.tabu_queue) >= self.tabu_size:
      expired = self.tabu_queue.popleft()
      self.tabu_set.discard(expired)
    self.tabu_queue.append(key)
    self.tabu_set.add(key)

  def _accept_worse_move(self, candidate_penalty: float) -> bool:
    if self.current_penalty is None or self.temperature <= 1e-6:
      return False
    delta = candidate_penalty - self.current_penalty
    if delta <= 0:
      return True
    probability = exp(-delta / max(1e-6, self.temperature))
    return random.random() < probability

  def _weight(self, key: str, default: float = 1.0) -> float:
    value = self.constraint_weight_map.get(key) if hasattr(self, "constraint_weight_map") else None
    if value is None:
      return default
    try:
      scalar = float(value)
      return max(0.1, scalar)
    except (TypeError, ValueError):
      return default

  @staticmethod
  def _is_shift_allowed(employee: Employee, day: date, shift_code: str) -> bool:
    upper = shift_code.replace("^", "").upper()
    if upper == "V":
      return True
    if employee.workPatternType == "night-intensive":
      return upper in {"N", "O", "V"}
    if employee.workPatternType == "weekday-only":
      if day.weekday() >= 5:
        return upper in {"O", "V"}
      return upper in {"A", "V"}
    if upper == "A":
      return False
    return True

  def _employee_in_team(self, employee_id: str, team_id: str) -> bool:
    employee = self.state.employee_map.get(employee_id)
    return bool(employee and employee.teamId == team_id)

  def _employee_in_career_group(self, employee_id: str, alias: str) -> bool:
    employee = self.state.employee_map.get(employee_id)
    return bool(employee and employee.careerGroupAlias == alias)
