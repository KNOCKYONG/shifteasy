from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

from ortools.sat.python import cp_model

from models import Assignment, ScheduleInput
from solver.exceptions import SolverFailure

DEFAULT_REQUIRED_STAFF = {"D": 5, "E": 4, "N": 3}


class CpSatScheduler:
  def __init__(self, schedule: ScheduleInput):
    self.schedule = schedule
    self.options = getattr(schedule, "options", {}) or {}
    self.constraint_weights = self.options.get("constraintWeights", {}) or {}
    self.csp_options = self.options.get("cspSettings", {}) or {}
    self.date_range = self._build_date_range()
    self.special_request_targets = self._build_special_request_targets()
    self.special_request_codes = {code for (_, _, code) in self.special_request_targets}
    self.required_staff_map = self._build_required_staff_map()
    self.default_required_staff = DEFAULT_REQUIRED_STAFF
    self.shift_codes = self._build_shift_codes()
    self.shift_code_set = {code.upper() for code in self.shift_codes}
    self.model = cp_model.CpModel()
    self.variables: Dict[Tuple[str, str, str], cp_model.IntVar] = {}
    self.variable_name_map: Dict[str, Tuple[str, str, str]] = {}
    self.staffing_requirements: Dict[Tuple[str, str], int] = {}
    self.shift_min_staff: Dict[str, int] = {}
    self.shift_max_staff: Dict[str, int] = {}
    self.team_slacks: Dict[Tuple[str, str, str], cp_model.IntVar] = {}
    self.team_requirements: Dict[Tuple[str, str, str], int] = {}
    self.special_request_slacks: Dict[Tuple[str, str, str], cp_model.IntVar] = {}
    self.career_group_slacks: Dict[Tuple[str, str, str], cp_model.IntVar] = {}
    self.off_balance_slacks: List[cp_model.IntVar] = []
    self.off_count_vars: Dict[str, cp_model.IntVar] = {}
    self.shift_repeat_entries: List[Dict[str, Any]] = []
    self.rest_after_night_entries: List[Dict[str, Any]] = []
    self.shift_balance_entries: List[Dict[str, Any]] = []
    self.preference_penalty_map: Dict[Tuple[str, str, str], float] = {}
    self.team_total_vars: Dict[str, cp_model.IntVar] = {}
    self.team_balance_entries: List[Dict[str, Any]] = []
    self.team_ids: List[str] = sorted(
      {emp.teamId for emp in self.schedule.employees if getattr(emp, "teamId", None)}
    )
    self.team_members_map: Dict[str, List[Any]] = {}
    for emp in self.schedule.employees:
      if emp.teamId:
        self.team_members_map.setdefault(emp.teamId, []).append(emp)
    self.career_group_aliases: List[str] = sorted(
      {emp.careerGroupAlias for emp in self.schedule.employees if getattr(emp, "careerGroupAlias", None)}
    )
    self.career_group_total_vars: Dict[str, cp_model.IntVar] = {}
    self.career_group_balance_slacks: List[cp_model.IntVar] = []
    self.holiday_set = {holiday.date for holiday in (schedule.holidays or [])}
    self.team_coverage_shift_codes = {
      code
      for code, value in self.required_staff_map.items()
      if value and code not in {"O", "A"}
    }
    self.career_group_balance_shift_codes = {
      code
      for code, value in self.required_staff_map.items()
      if value and code not in {"O", "A", "N"}
    }
    for shift in self.schedule.shifts:
      code = (shift.code or shift.name or shift.id).upper()
      if shift.minStaff is not None:
        self.shift_min_staff[code] = max(0, int(shift.minStaff))
      if shift.maxStaff is not None:
        self.shift_max_staff[code] = max(0, int(shift.maxStaff))
    self.max_same_shift = self._get_max_same_shift()
    self.shift_balance_tolerance = self._get_shift_balance_tolerance()
    self.required_off = self._calculate_required_off_days()
    self.preflight_issues = self._run_preflight_checks()
    self._init_preference_penalties()
    self.total_staff_capacity = 0

  def _build_date_range(self) -> List[date]:
    current = self.schedule.startDate
    dates: List[date] = []
    while current <= self.schedule.endDate:
      dates.append(current)
      current += timedelta(days=1)
    return dates

  @staticmethod
  def _sanitize_shift_code(code: Optional[str]) -> Optional[str]:
    if not code:
      return None
    normalized = code.replace("^", "").strip().upper()
    return normalized or None

  @staticmethod
  def _normalize_day_key(raw: str) -> str:
    try:
      return date.fromisoformat(raw).isoformat()
    except ValueError:
      return raw

  def _build_special_request_targets(self) -> Set[Tuple[str, str, str]]:
    targets: Set[Tuple[str, str, str]] = set()
    for request in self.schedule.specialRequests or []:
      shift_code = self._sanitize_shift_code(request.shiftTypeCode)
      if not shift_code:
        continue
      day_key = self._normalize_day_key(request.date)
      targets.add((request.employeeId, day_key, shift_code))
    return targets

  def _build_required_staff_map(self) -> Dict[str, int]:
    required: Dict[str, int] = {}
    raw_required = self.schedule.requiredStaffPerShift or {}
    for code, value in raw_required.items():
      if not code:
        continue
      try:
        parsed = int(value)
      except (TypeError, ValueError):
        continue
      required[code.upper()] = max(0, parsed)
    for code, default_value in DEFAULT_REQUIRED_STAFF.items():
      required.setdefault(code, default_value)
    return required

  def _build_shift_codes(self) -> List[str]:
    codes: Set[str] = {
      code for code, value in self.required_staff_map.items() if value and value > 0
    }
    if any(emp.workPatternType == "weekday-only" for emp in self.schedule.employees):
      codes.add("A")
    codes.add("O")
    codes.update(self.special_request_codes)
    return sorted(codes)

  def _var_name(self, employee_id: str, date_key: str, shift_code: str) -> str:
    safe_emp = employee_id.replace("-", "_")
    safe_date = date_key.replace("-", "_")
    safe_shift = shift_code.replace("-", "_")
    return f"x_{safe_emp}_{safe_date}_{safe_shift}"

  def _get_shift_id(self, shift_code: str) -> str:
    upper = shift_code.upper()
    for shift in self.schedule.shifts:
      code = (shift.code or shift.name or "").upper()
      if code == upper:
        return shift.id
    return f"shift-{upper.lower()}"

  @staticmethod
  def _is_weekend(day: date) -> bool:
    return day.weekday() >= 5

  def _is_weekend_or_holiday(self, day: date) -> bool:
    return self._is_weekend(day) or day.isoformat() in self.holiday_set

  def _is_shift_allowed(self, emp, day: date, shift_code: str) -> bool:
    upper = shift_code.replace("^", "").upper()
    if upper == "V":
      return True
    if emp.workPatternType == "night-intensive":
      return upper in ("N", "O", "V")
    if emp.workPatternType == "weekday-only":
      if self._is_weekend_or_holiday(day):
        return upper in ("O", "V")
      return upper in ("A", "V")
    if upper == "A":
      return False
    return True

  def _calculate_required_off_days(self) -> Dict[str, int]:
    required: Dict[str, int] = {}
    weekend_holiday_count = sum(1 for day in self.date_range if self._is_weekend_or_holiday(day))
    night_bonus = max(0, int(getattr(self.schedule, "nightIntensivePaidLeaveDays", 0) or 0))
    for emp in self.schedule.employees:
      base = max(0, self.schedule.previousOffAccruals.get(emp.id, 0))
      if emp.workPatternType == "three-shift":
        target = weekend_holiday_count + base
        if target > 0:
          required[emp.id] = target
      elif emp.workPatternType == "night-intensive":
        target = weekend_holiday_count + base + night_bonus
        if target > 0:
          required[emp.id] = target
    return required

  def _get_max_same_shift(self) -> int:
    raw = self.csp_options.get("maxSameShift")
    try:
      parsed = int(raw)
      return max(1, min(parsed, 10))
    except (TypeError, ValueError):
      return 2

  def _get_shift_balance_tolerance(self) -> int:
    raw = self.csp_options.get("shiftBalanceTolerance")
    try:
      parsed = int(raw)
      return max(1, min(parsed, 20))
    except (TypeError, ValueError):
      return 4

  def _create_variables(self):
    for emp in self.schedule.employees:
      for day in self.date_range:
        day_key = day.isoformat()
        for code in self.shift_codes:
          var = self.model.NewBoolVar(self._var_name(emp.id, day_key, code))
          self.variables[(emp.id, day_key, code)] = var
          self.variable_name_map[var.Name()] = (emp.id, day_key, code)

  def _init_preference_penalties(self):
    team_pattern = getattr(self.schedule, "teamPattern", None)
    pattern_sequence: List[str] = []
    if team_pattern and getattr(team_pattern, "pattern", None):
      pattern_sequence = [
        str(code).upper() for code in team_pattern.pattern if isinstance(code, str) and code.strip()
      ]
    team_pattern_penalty = 40.0
    preference_penalty_base = 20.0
    for day_index, day in enumerate(self.date_range):
      day_key = day.isoformat()
      expected_shift = None
      if pattern_sequence:
        expected_shift = pattern_sequence[day_index % len(pattern_sequence)]
      for emp in self.schedule.employees:
        pref_map: Dict[str, float] = {}
        if emp.preferredShiftTypes:
          pref_map = {
            key.upper(): float(value)
            for key, value in emp.preferredShiftTypes.items()
            if isinstance(key, str) and isinstance(value, (int, float))
          }
        for code in self.shift_codes:
          upper = code.upper()
          penalty = 0.0
          if expected_shift and emp.workPatternType == "three-shift":
            if upper != expected_shift:
              penalty += team_pattern_penalty
          if pref_map:
            weight = pref_map.get(upper)
            if weight is not None:
              penalty += max(0.0, 1.0 - max(0.0, min(1.0, weight))) * preference_penalty_base
          if penalty > 0:
            self.preference_penalty_map[(emp.id, day_key, upper)] = penalty

  def _add_daily_assignment_constraints(self):
    for emp in self.schedule.employees:
      for day in self.date_range:
        day_key = day.isoformat()
        vars_for_day = [self.variables[(emp.id, day_key, code)] for code in self.shift_codes]
        self.model.Add(sum(vars_for_day) == 1)

  def _add_special_request_constraints(self):
    for req_index, req in enumerate(self.schedule.specialRequests or []):
      if not req.shiftTypeCode:
        continue
      target_code = self._sanitize_shift_code(req.shiftTypeCode)
      if not target_code:
        continue
      day_key = self._normalize_day_key(req.date)
      var = self.variables.get((req.employeeId, day_key, target_code))
      if var is None:
        continue
      slack = self.model.NewBoolVar(f"special_req_slack_{req.employeeId}_{day_key}_{target_code}_{req_index}")
      self.model.Add(var + slack >= 1)
      self.special_request_slacks[(req.employeeId, day_key, target_code)] = slack

  def _restrict_special_only_shifts(self):
    special_only_codes = {
      code for code in self.special_request_codes if code not in self.required_staff_map and code not in {"A", "O"}
    }
    if not special_only_codes:
      return
    for emp in self.schedule.employees:
      for day in self.date_range:
        day_key = day.isoformat()
        for code in special_only_codes:
          if (emp.id, day_key, code) in self.special_request_targets:
            continue
          var = self.variables.get((emp.id, day_key, code))
          if var is not None:
            self.model.Add(var == 0)

  def _add_pattern_constraints(self):
    for emp in self.schedule.employees:
      for day in self.date_range:
        day_key = day.isoformat()
        for code in self.shift_codes:
          var = self.variables[(emp.id, day_key, code)]
          if not self._is_shift_allowed(emp, day, code):
            self.model.Add(var == 0)

  def _add_avoid_pattern_constraints(self):
    team_pattern = getattr(self.schedule, "teamPattern", None)
    avoid_patterns = getattr(team_pattern, "avoidPatterns", None) if team_pattern else None
    if not avoid_patterns:
      return
    normalized_patterns: List[List[str]] = []
    for pattern in avoid_patterns:
      if not isinstance(pattern, list):
        continue
      normalized = [str(code).upper() for code in pattern if isinstance(code, str) and code.strip()]
      if normalized:
        normalized_patterns.append(normalized)
    if not normalized_patterns:
      return
    for emp in self.schedule.employees:
      for pattern in normalized_patterns:
        pattern_length = len(pattern)
        if pattern_length > len(self.date_range):
          continue
        for start in range(0, len(self.date_range) - pattern_length + 1):
          terms: List[cp_model.IntVar] = []
          for offset, code in enumerate(pattern):
            day_key = self.date_range[start + offset].isoformat()
            var = self.variables.get((emp.id, day_key, code))
            if var is not None:
              terms.append(var)
          if terms:
            self.model.Add(sum(terms) <= pattern_length - 1)

  def _add_staffing_constraints(self):
    self.total_staff_capacity = 0
    required = self.required_staff_map
    for day in self.date_range:
      day_key = day.isoformat()
      for code in self.shift_codes:
        upper = code.upper()
        eligible_count = sum(1 for emp in self.schedule.employees if self._is_shift_allowed(emp, day, code))
        min_required = required.get(upper)
        if min_required is None:
          min_required = self.shift_min_staff.get(upper)
        if min_required is None:
          min_required = self.default_required_staff.get(upper)
        if min_required is not None and eligible_count == 0:
          min_required = None
        max_allowed = self.shift_max_staff.get(upper)
        if min_required is not None:
          if max_allowed is None:
            max_allowed = min_required
          else:
            max_allowed = max(max_allowed, min_required)
        if min_required is None and max_allowed is None:
          continue
        if min_required is not None:
          constraint_vars = [self.variables[(emp.id, day_key, code)] for emp in self.schedule.employees]
          self.model.Add(sum(constraint_vars) >= min_required)
          self.staffing_requirements[(day_key, code)] = min_required
        if max_allowed is not None:
          constraint_vars = [self.variables[(emp.id, day_key, code)] for emp in self.schedule.employees]
          self.model.Add(sum(constraint_vars) <= max_allowed)
          self.total_staff_capacity += max_allowed

  def _add_team_coverage_constraints(self):
    if not self.team_ids:
      return
    for day in self.date_range:
      day_key = day.isoformat()
      for code in self.shift_codes:
        for team_id in self.team_ids:
          if code.upper() not in self.team_coverage_shift_codes:
            continue
          eligible = [
            emp for emp in self.schedule.employees if emp.teamId == team_id and self._is_shift_allowed(emp, day, code)
          ]
          if not eligible:
            continue
          slack_var = self.model.NewIntVar(0, len(eligible), f"team_cover_slack_{day_key}_{code}_{team_id}")
          self.team_slacks[(day_key, code, team_id)] = slack_var
          vars_for_team = [self.variables[(emp.id, day_key, code)] for emp in eligible]
          self.model.Add(sum(vars_for_team) + slack_var >= 1)
          self.team_requirements[(day_key, code, team_id)] = 1

  def _add_career_group_constraints(self):
    if not self.career_group_aliases:
      return
    for day in self.date_range:
      day_key = day.isoformat()
      for code in self.shift_codes:
        if code.upper() not in self.team_coverage_shift_codes:
          continue
        for group_alias in self.career_group_aliases:
          eligible = [
            emp
            for emp in self.schedule.employees
            if emp.careerGroupAlias == group_alias and self._is_shift_allowed(emp, day, code)
          ]
          if not eligible:
            continue
          slack_var = self.model.NewIntVar(0, len(eligible), f"career_cover_slack_{day_key}_{code}_{group_alias}")
          self.career_group_slacks[(day_key, code, group_alias)] = slack_var
          vars_for_group = [self.variables[(emp.id, day_key, code)] for emp in eligible]
          self.model.Add(sum(vars_for_group) + slack_var >= 1)

  def _add_career_group_balance_constraints(self, tolerance: int = 1):
    if len(self.career_group_aliases) < 2 or not self.career_group_balance_shift_codes:
      return
    total_days = len(self.date_range)
    max_assignments = total_days * len(self.schedule.employees)
    for alias in self.career_group_aliases:
      total_var = self.model.NewIntVar(0, max_assignments, f"career_group_total_{alias}")
      self.career_group_total_vars[alias] = total_var
      terms: List[cp_model.IntVar] = []
      for emp in self.schedule.employees:
        if emp.careerGroupAlias != alias:
          continue
        for day in self.date_range:
          day_key = day.isoformat()
          for code in self.career_group_balance_shift_codes:
            var = self.variables.get((emp.id, day_key, code))
            if var is not None:
              terms.append(var)
      if terms:
        self.model.Add(total_var == sum(terms))
    for i in range(len(self.career_group_aliases)):
      for j in range(i + 1, len(self.career_group_aliases)):
        alias_i = self.career_group_aliases[i]
        alias_j = self.career_group_aliases[j]
        slack_ij = self.model.NewIntVar(0, total_days * len(self.schedule.employees), f"career_group_balance_{alias_i}_{alias_j}")
        self.model.Add(self.career_group_total_vars[alias_i] - self.career_group_total_vars[alias_j] - slack_ij <= tolerance)
        self.career_group_balance_slacks.append(slack_ij)
        slack_ji = self.model.NewIntVar(0, total_days * len(self.schedule.employees), f"career_group_balance_{alias_j}_{alias_i}")
        self.model.Add(self.career_group_total_vars[alias_j] - self.career_group_total_vars[alias_i] - slack_ji <= tolerance)
        self.career_group_balance_slacks.append(slack_ji)

  def _add_team_balance_constraints(self, tolerance: int = 2):
    if len(self.team_ids) < 2:
      return
    total_days = len(self.date_range)
    relevant_shifts = {code for code in self.shift_codes if code.upper() not in {"O", "A"}}
    for team_id in self.team_ids:
      total_var = self.model.NewIntVar(0, len(self.schedule.employees) * total_days, f"team_total_{team_id}")
      self.team_total_vars[team_id] = total_var
      terms: List[cp_model.IntVar] = []
      for emp in self.schedule.employees:
        if emp.teamId != team_id:
          continue
        for day in self.date_range:
          day_key = day.isoformat()
          for code in relevant_shifts:
            var = self.variables.get((emp.id, day_key, code))
            if var is not None:
              terms.append(var)
      if terms:
        self.model.Add(total_var == sum(terms))
    for i in range(len(self.team_ids)):
      for j in range(i + 1, len(self.team_ids)):
        team_i = self.team_ids[i]
        team_j = self.team_ids[j]
        slack_ij = self.model.NewIntVar(0, len(self.date_range) * len(self.schedule.employees), f"team_balance_{team_i}_{team_j}")
        self.model.Add(self.team_total_vars[team_i] - self.team_total_vars[team_j] - slack_ij <= tolerance)
        self.team_balance_entries.append(
          {"var": slack_ij, "teamA": team_i, "teamB": team_j, "tolerance": tolerance}
        )
        slack_ji = self.model.NewIntVar(0, len(self.date_range) * len(self.schedule.employees), f"team_balance_{team_j}_{team_i}")
        self.model.Add(self.team_total_vars[team_j] - self.team_total_vars[team_i] - slack_ji <= tolerance)
        self.team_balance_entries.append(
          {"var": slack_ji, "teamA": team_j, "teamB": team_i, "tolerance": tolerance}
        )

  def _add_off_day_constraints(self):
    total_assignments = len(self.schedule.employees) * len(self.date_range)
    off_eligible_count = sum(1 for emp in self.schedule.employees if emp.workPatternType != "weekday-only")
    off_per_employee_hint = 0
    if off_eligible_count > 0:
      off_per_employee_hint = math.ceil(max(0, total_assignments - self.total_staff_capacity) / off_eligible_count)

    for emp in self.schedule.employees:
      off_count_var = self.model.NewIntVar(0, len(self.date_range), f"off_count_{emp.id}")
      self.off_count_vars[emp.id] = off_count_var
      off_terms: List[cp_model.IntVar] = []
      for day in self.date_range:
        day_key = day.isoformat()
        off_terms.append(self.variables[(emp.id, day_key, "O")])
        vacation_var = self.variables.get((emp.id, day_key, "V"))
        if vacation_var is not None:
          off_terms.append(vacation_var)
      if off_terms:
        self.model.Add(off_count_var == sum(off_terms))
      target = self.required_off.get(emp.id)
      if target is None:
        continue
      if emp.workPatternType == "night-intensive":
        self.model.Add(off_count_var >= target)
      else:
        lower_bound = max(0, target - 2)
        upper_bound = max(target + 2, off_per_employee_hint, lower_bound)
        upper_bound = min(upper_bound, len(self.date_range))
        self.model.Add(off_count_var >= lower_bound)
        self.model.Add(off_count_var <= upper_bound)

  def _add_off_balance_constraints(self, tolerance: int = 2):
    for team_id, members in self.team_members_map.items():
      if len(members) < 2:
        continue
      for i in range(len(members)):
        for j in range(i + 1, len(members)):
          emp_a = members[i]
          emp_b = members[j]
          if emp_a.id not in self.off_count_vars or emp_b.id not in self.off_count_vars:
            continue
          slack_ab = self.model.NewIntVar(0, len(self.date_range), f"off_balance_{team_id}_{emp_a.id}_{emp_b.id}")
          self.model.Add(self.off_count_vars[emp_a.id] - self.off_count_vars[emp_b.id] - slack_ab <= tolerance)
          self.off_balance_slacks.append(slack_ab)
          slack_ba = self.model.NewIntVar(0, len(self.date_range), f"off_balance_{team_id}_{emp_b.id}_{emp_a.id}")
          self.model.Add(self.off_count_vars[emp_b.id] - self.off_count_vars[emp_a.id] - slack_ba <= tolerance)
          self.off_balance_slacks.append(slack_ba)

  def _add_shift_repeat_constraints(self, max_same_shift: int = 2):
    window = max_same_shift + 1
    for emp in self.schedule.employees:
      if window > len(self.date_range):
        continue
      for code in self.shift_codes:
        upper = code.upper()
        if upper in {"O"}:
          continue
        for start in range(0, len(self.date_range) - window + 1):
          vars_in_window: List[cp_model.IntVar] = []
          for offset in range(window):
            day_key = self.date_range[start + offset].isoformat()
            var = self.variables.get((emp.id, day_key, code))
            if var is not None:
              vars_in_window.append(var)
          if not vars_in_window:
            continue
          slack = self.model.NewIntVar(0, window, f"repeat_slack_{emp.id}_{upper}_{start}")
          self.model.Add(sum(vars_in_window) - slack <= max_same_shift)
          self.shift_repeat_entries.append(
            {
              "kind": "repeat",
              "employeeId": emp.id,
              "shiftType": upper,
              "startDate": self.date_range[start].isoformat(),
              "window": window,
              "var": slack,
            }
          )

  def _add_consecutive_constraints(self):
    total_days = len(self.date_range)
    for emp in self.schedule.employees:
      max_consecutive_days = getattr(emp, "maxConsecutiveDaysPreferred", None)
      if isinstance(max_consecutive_days, int) and max_consecutive_days >= 0:
        window = max_consecutive_days + 1
        if window <= total_days:
          for start in range(0, total_days - max_consecutive_days):
            off_terms: List[cp_model.IntVar] = []
            for offset in range(window):
              day_key = self.date_range[start + offset].isoformat()
              off_terms.append(self.variables[(emp.id, day_key, "O")])
              vacation_var = self.variables.get((emp.id, day_key, "V"))
              if vacation_var is not None:
                off_terms.append(vacation_var)
            if off_terms:
              self.model.Add(sum(off_terms) >= 1)
      max_consecutive_nights = getattr(emp, "maxConsecutiveNightsPreferred", None)
      if (
        isinstance(max_consecutive_nights, int)
        and max_consecutive_nights >= 0
        and "N" in self.shift_code_set
      ):
        window = max_consecutive_nights + 1
        if window <= total_days:
          for start in range(0, total_days - max_consecutive_nights):
            night_terms: List[cp_model.IntVar] = []
            for offset in range(window):
              day_key = self.date_range[start + offset].isoformat()
              night_var = self.variables.get((emp.id, day_key, "N"))
              if night_var is not None:
                night_terms.append(night_var)
            if night_terms:
              self.model.Add(sum(night_terms) <= max_consecutive_nights)

  def _add_night_intensive_pattern_constraints(self):
    total_days = len(self.date_range)
    if total_days == 0:
      return
    for emp in self.schedule.employees:
      if emp.workPatternType != "night-intensive":
        continue
      if total_days >= 4:
        for start in range(0, total_days - 3):
          night_terms: List[cp_model.IntVar] = []
          for offset in range(4):
            day_key = self.date_range[start + offset].isoformat()
            night_var = self.variables.get((emp.id, day_key, "N"))
            if night_var is not None:
              night_terms.append(night_var)
          if night_terms:
            slack = self.model.NewIntVar(0, len(night_terms), f"night_limit_slack_{emp.id}_{start}")
            self.model.Add(sum(night_terms) - slack <= 3)
            self.shift_repeat_entries.append(
              {
                "kind": "night_limit",
                "employeeId": emp.id,
                "shiftType": "N",
                "startDate": self.date_range[start].isoformat(),
                "window": 4,
                "var": slack,
              }
            )
      if total_days >= 5:
        for start in range(0, total_days - 4):
          off_terms: List[cp_model.IntVar] = []
          for offset in range(5):
            day_key = self.date_range[start + offset].isoformat()
            off_var = self.variables.get((emp.id, day_key, "O"))
            if off_var is not None:
              off_terms.append(off_var)
          if off_terms:
            slack = self.model.NewIntVar(0, len(off_terms), f"night_off_slack_{emp.id}_{start}")
            self.model.Add(sum(off_terms) + slack >= 2)
            self.shift_repeat_entries.append(
              {
                "kind": "night_off_buffer",
                "employeeId": emp.id,
                "shiftType": "O",
                "startDate": self.date_range[start].isoformat(),
                "window": 5,
                "var": slack,
              }
            )

  def _add_rest_after_night_constraints(self):
    if "N" not in self.shift_code_set:
      return
    for emp in self.schedule.employees:
      for day_index, day in enumerate(self.date_range[:-1]):
        day_key = day.isoformat()
        next_key = self.date_range[day_index + 1].isoformat()
        night_var = self.variables.get((emp.id, day_key, "N"))
        if night_var is None:
          continue
        for early_shift in ("D", "E"):
          next_var = self.variables.get((emp.id, next_key, early_shift))
          if next_var is None:
            continue
          slack = self.model.NewIntVar(0, 1, f"rest_after_night_{emp.id}_{day_key}_{early_shift}")
          self.model.Add(night_var + next_var - slack <= 1)
          self.rest_after_night_entries.append(
            {
              "employeeId": emp.id,
              "shiftType": f"N->{early_shift}",
              "startDate": day_key,
              "window": 2,
              "var": slack,
            }
          )

  def _add_shift_balance_constraints(self, tolerance: Optional[int] = None):
    effective_tolerance = tolerance if tolerance is not None else self.shift_balance_tolerance
    core_shifts = [code for code in ("D", "E", "N") if code in self.shift_code_set]
    if len(core_shifts) < 2:
      return
    total_days = len(self.date_range)
    for emp in self.schedule.employees:
      if emp.workPatternType != "three-shift":
        continue
      counts: Dict[str, cp_model.IntVar] = {}
      for code in core_shifts:
        count_var = self.model.NewIntVar(0, total_days, f"shift_count_{emp.id}_{code}")
        counts[code] = count_var
        terms: List[cp_model.IntVar] = []
        for day in self.date_range:
          day_key = day.isoformat()
          var = self.variables.get((emp.id, day_key, code))
          if var is not None:
            terms.append(var)
        if terms:
          self.model.Add(count_var == sum(terms))
        else:
          self.model.Add(count_var == 0)
      for i in range(len(core_shifts)):
        for j in range(i + 1, len(core_shifts)):
          code_i = core_shifts[i]
          code_j = core_shifts[j]
          slack_ij = self.model.NewIntVar(0, total_days, f"shift_balance_{emp.id}_{code_i}_{code_j}")
          self.model.Add(counts[code_i] - counts[code_j] - slack_ij <= effective_tolerance)
          self.shift_balance_entries.append(
            {
              "var": slack_ij,
              "employeeId": emp.id,
              "shiftA": code_i,
              "shiftB": code_j,
              "tolerance": effective_tolerance,
            }
          )
          slack_ji = self.model.NewIntVar(0, total_days, f"shift_balance_{emp.id}_{code_j}_{code_i}")
          self.model.Add(counts[code_j] - counts[code_i] - slack_ji <= effective_tolerance)
          self.shift_balance_entries.append(
            {
              "var": slack_ji,
              "employeeId": emp.id,
              "shiftA": code_j,
              "shiftB": code_i,
              "tolerance": effective_tolerance,
            }
          )

  def _run_preflight_checks(self) -> List[Dict[str, Any]]:
    issues: List[Dict[str, Any]] = []
    required = {code: value for code, value in self.required_staff_map.items() if value and value > 0}
    employee_map = {emp.id: emp for emp in self.schedule.employees}
    total_days = len(self.date_range)

    for emp in self.schedule.employees:
      target = self.required_off.get(emp.id)
      if target and target > total_days:
        issues.append(
          {
            "type": "offRequirementImpossible",
            "employeeId": emp.id,
            "requiredOffDays": target,
            "availableDays": total_days,
          }
        )

    for day in self.date_range:
      day_key = day.isoformat()
      for code, min_required in required.items():
        available = sum(1 for emp in self.schedule.employees if self._is_shift_allowed(emp, day, code))
        if available < min_required:
          issues.append(
            {
              "type": "insufficientPotentialStaff",
              "date": day_key,
              "shiftType": code.upper(),
              "required": min_required,
              "available": available,
            }
          )
        for team_id in self.team_ids:
          if code.upper() not in self.team_coverage_shift_codes:
            continue
          team_available = sum(
            1
            for emp in self.schedule.employees
            if emp.teamId == team_id and self._is_shift_allowed(emp, day, code)
          )
          if team_available == 0:
            issues.append(
              {
                "type": "teamCoverageImpossible",
                "date": day_key,
                "shiftType": code.upper(),
                "teamId": team_id,
              }
            )
        for group_alias in self.career_group_aliases:
          if code.upper() not in self.team_coverage_shift_codes:
            continue
          group_available = sum(
            1
            for emp in self.schedule.employees
            if emp.careerGroupAlias == group_alias and self._is_shift_allowed(emp, day, code)
          )
          if group_available == 0:
            issues.append(
              {
                "type": "careerGroupCoverageImpossible",
                "date": day_key,
                "shiftType": code.upper(),
                "careerGroupAlias": group_alias,
              }
            )

    for req in self.schedule.specialRequests or []:
      if not req.shiftTypeCode:
        continue
      emp = employee_map.get(req.employeeId)
      if not emp:
        issues.append({"type": "specialRequestUnknownEmployee", "employeeId": req.employeeId, "date": req.date})
        continue
      try:
        req_date = date.fromisoformat(req.date)
      except ValueError:
        issues.append({"type": "specialRequestInvalidDate", "employeeId": req.employeeId, "date": req.date})
        continue
      if not self._is_shift_allowed(emp, req_date, req.shiftTypeCode):
        issues.append(
          {
            "type": "specialRequestPatternConflict",
            "employeeId": emp.id,
            "date": req.date,
            "requestedShift": req.shiftTypeCode,
            "workPatternType": emp.workPatternType,
          }
        )

    return issues

  def build_model(self):
    self._create_variables()
    self._add_daily_assignment_constraints()
    self._add_special_request_constraints()
    self._restrict_special_only_shifts()
    self._add_pattern_constraints()
    self._add_avoid_pattern_constraints()
    self._add_staffing_constraints()
    self._add_team_coverage_constraints()
    self._add_career_group_constraints()
    self._add_career_group_balance_constraints()
    if self.team_ids:
      self._add_team_balance_constraints()
    self._add_off_day_constraints()
    self._add_off_balance_constraints()
    self._add_shift_repeat_constraints(self.max_same_shift)
    self._add_consecutive_constraints()
    self._add_night_intensive_pattern_constraints()
    self._add_rest_after_night_constraints()
    self._add_shift_balance_constraints()

  def _collect_staffing_shortages(self, solver: cp_model.CpSolver):
    shortages = []
    if not self.staffing_requirements:
      return shortages
    coverage: Dict[Tuple[str, str], float] = {}
    for (employee_id, day_key, code), var in self.variables.items():
      key = (day_key, code)
      if key not in self.staffing_requirements:
        continue
      value = solver.Value(var)
      if value <= 0:
        continue
      coverage[key] = coverage.get(key, 0.0) + value
    for (day_key, code), required in self.staffing_requirements.items():
      covered_value = coverage.get((day_key, code), 0.0)
      if covered_value + 1e-6 < required:
        shortages.append(
          {
            "date": day_key,
            "shiftType": code.upper(),
            "required": required,
            "covered": int(round(covered_value)),
            "shortage": int(round(required - covered_value)),
          }
        )
    return shortages

  def _collect_team_shortages(self, solver: cp_model.CpSolver):
    gaps = []
    for (day_key, code, team_id), slack_var in self.team_slacks.items():
      shortage = solver.Value(slack_var)
      if shortage > 0:
        gaps.append(
          {
            "date": day_key,
            "shiftType": code.upper(),
            "teamId": team_id,
            "shortage": int(round(shortage)),
          }
        )
    return gaps

  def _collect_career_group_gaps(self, solver: cp_model.CpSolver):
    gaps = []
    for (day_key, code, group_alias), slack_var in self.career_group_slacks.items():
      shortage = solver.Value(slack_var)
      if shortage > 0:
        gaps.append(
          {
            "date": day_key,
            "shiftType": code.upper(),
            "careerGroupAlias": group_alias,
            "shortage": int(round(shortage)),
          }
        )
    return gaps

  def _collect_special_request_misses(self, solver: cp_model.CpSolver):
    misses = []
    for (employee_id, day_key, code), slack_var in self.special_request_slacks.items():
      value = solver.Value(slack_var)
      if value > 0:
        misses.append(
          {
            "employeeId": employee_id,
            "date": day_key,
            "shiftType": code,
          }
        )
    return misses

  def _collect_off_balance_gaps(self, solver: cp_model.CpSolver, tolerance: int = 2):
    gaps = []
    for team_id, members in self.team_members_map.items():
      if len(members) < 2:
        continue
      for i in range(len(members)):
        for j in range(i + 1, len(members)):
          if members[i].id not in self.off_count_vars or members[j].id not in self.off_count_vars:
            continue
          count_a = solver.Value(self.off_count_vars[members[i].id])
          count_b = solver.Value(self.off_count_vars[members[j].id])
          diff = abs(count_a - count_b)
          if diff > tolerance + 1e-6:
            gaps.append(
              {
                "teamId": team_id,
                "employeeA": members[i].id,
                "employeeB": members[j].id,
                "difference": int(round(diff)),
                "tolerance": tolerance,
              }
            )
    return gaps

  def _collect_team_balance_gaps(self, solver: cp_model.CpSolver):
    gaps = []
    for entry in self.team_balance_entries:
      value = solver.Value(entry["var"])
      if value is None or value <= 0:
        continue
      gaps.append(
        {
          "teamA": entry["teamA"],
          "teamB": entry["teamB"],
          "difference": int(round(value + entry["tolerance"])),
          "tolerance": entry["tolerance"],
        }
      )
    return gaps

  def _collect_shift_pattern_breaks(self, solver: cp_model.CpSolver):
    violations = []
    for entry in self.shift_repeat_entries + self.rest_after_night_entries:
      slack_var = entry["var"]
      value = solver.Value(slack_var)
      if value is None or value <= 0:
        continue
      violations.append(
        {
          "employeeId": entry["employeeId"],
          "shiftType": entry.get("shiftType"),
          "startDate": entry["startDate"],
          "window": entry["window"],
          "excess": int(round(value)),
        }
      )
    return violations

  def _collect_shift_balance_gaps(self, solver: cp_model.CpSolver):
    gaps = []
    for entry in self.shift_balance_entries:
      value = solver.Value(entry["var"])
      if value is None or value <= 0:
        continue
      gaps.append(
        {
          "employeeId": entry["employeeId"],
          "shiftA": entry["shiftA"],
          "shiftB": entry["shiftB"],
          "difference": int(round(value + entry["tolerance"])),
          "tolerance": entry["tolerance"],
        }
      )
    return gaps

  def solve(self) -> Tuple[List[Assignment], Dict[str, Any]]:
    self.build_model()
    staffing_penalty = 1000 * self._weight_scalar("staffing", 1.0)
    team_penalty = 500 * self._weight_scalar("teamBalance", 1.0)
    special_request_penalty = 1200
    career_group_penalty = 450 * self._weight_scalar("careerBalance", 1.0)
    career_group_balance_penalty = 600 * self._weight_scalar("careerBalance", 1.0)
    off_balance_penalty = 800 * self._weight_scalar("offBalance", 1.0)
    shift_repeat_penalty = 350 * self._weight_scalar("shiftPattern", 1.0)
    rest_penalty = 500 * self._weight_scalar("shiftPattern", 1.0)
    shift_balance_penalty = 250 * self._weight_scalar("shiftPattern", 1.0)

    terms: List[cp_model.LinearExpr] = []
    for (employee_id, day_key, shift_code), var in self.variables.items():
      penalty = self.preference_penalty_map.get((employee_id, day_key, shift_code.upper()), 0.0)
      if penalty:
        terms.append(penalty * var)
    for slack_var in self.team_slacks.values():
      terms.append(team_penalty * slack_var)
    for slack_var in self.special_request_slacks.values():
      terms.append(special_request_penalty * slack_var)
    for slack_var in self.career_group_slacks.values():
      terms.append(career_group_penalty * slack_var)
    for slack_var in self.career_group_balance_slacks:
      terms.append(career_group_balance_penalty * slack_var)
    for entry in self.team_balance_entries:
      terms.append(team_penalty * entry["var"])
    for slack_var in self.off_balance_slacks:
      terms.append(off_balance_penalty * slack_var)
    for entry in self.shift_repeat_entries:
      terms.append(shift_repeat_penalty * entry["var"])
    for entry in self.rest_after_night_entries:
      terms.append(rest_penalty * entry["var"])
    for entry in self.shift_balance_entries:
      terms.append(shift_balance_penalty * entry["var"])
    if terms:
      self.model.Minimize(sum(terms))

    solver = cp_model.CpSolver()
    max_time_ms = self.options.get("maxSolveTimeMs") if isinstance(self.options, dict) else None
    if isinstance(max_time_ms, (int, float)) and max_time_ms > 0:
      solver.parameters.max_time_in_seconds = max_time_ms / 1000.0
    status = solver.Solve(self.model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
      raise SolverFailure(
        "CP-SAT solver failed to find feasible schedule",
        diagnostics={"preflightIssues": self.preflight_issues},
      )
    assignments: List[Assignment] = []
    for (employee_id, day_key, shift_code), var in self.variables.items():
      if solver.Value(var) >= 1:
        is_locked = (employee_id, day_key, shift_code.upper()) in self.special_request_targets
        assignments.append(
          Assignment(
            employeeId=employee_id,
            date=day_key,
            shiftId=self._get_shift_id(shift_code),
            shiftType=shift_code.upper(),
            isLocked=is_locked,
          )
        )
    diagnostics: Dict[str, Any] = {
      "staffingShortages": self._collect_staffing_shortages(solver),
      "teamCoverageGaps": self._collect_team_shortages(solver),
      "careerGroupCoverageGaps": self._collect_career_group_gaps(solver),
      "teamWorkloadGaps": self._collect_team_balance_gaps(solver),
      "offBalanceGaps": self._collect_off_balance_gaps(solver),
      "shiftPatternBreaks": self._collect_shift_pattern_breaks(solver),
      "specialRequestMisses": self._collect_special_request_misses(solver),
      "shiftBalanceGaps": self._collect_shift_balance_gaps(solver),
      "preflightIssues": self.preflight_issues,
    }
    return assignments, diagnostics

  def build_assignments_from_names(self, active_names: Set[str]) -> List[Assignment]:
    assignments: List[Assignment] = []
    for name in active_names:
      key = self.variable_name_map.get(name)
      if not key:
        continue
      employee_id, day_key, shift_code = key
      is_locked = (employee_id, day_key, shift_code.upper()) in self.special_request_targets
      assignments.append(
        Assignment(
          employeeId=employee_id,
          date=day_key,
          shiftId=self._get_shift_id(shift_code),
          shiftType=shift_code.upper(),
          isLocked=is_locked,
        )
      )
    return assignments

  def _weight_scalar(self, key: str, default: float) -> float:
    value = self.constraint_weights.get(key)
    if value is None:
      return default
    try:
      scalar = float(value)
      return max(0.1, scalar)
    except (TypeError, ValueError):
      return default


def solve_with_cpsat(schedule: ScheduleInput) -> Tuple[List[Assignment], Dict[str, Any]]:
  solver = CpSatScheduler(schedule)
  return solver.solve()
