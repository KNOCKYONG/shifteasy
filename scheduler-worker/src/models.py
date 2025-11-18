from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Dict, List, Optional, Sequence, Any


WorkPatternType = str  # 'three-shift' | 'night-intensive' | 'weekday-only'


@dataclass
class ShiftTime:
  start: str
  end: str
  hours: float


@dataclass
class Shift:
  id: str
  code: Optional[str]
  name: str
  type: str
  color: Optional[str]
  time: ShiftTime
  requiredStaff: int = 0
  minStaff: Optional[int] = None
  maxStaff: Optional[int] = None


@dataclass
class Employee:
  id: str
  name: str
  role: str
  departmentId: Optional[str] = None
  teamId: Optional[str] = None
  workPatternType: WorkPatternType = "three-shift"
  preferredShiftTypes: Optional[Dict[str, float]] = None
  maxConsecutiveDaysPreferred: Optional[int] = None
  maxConsecutiveNightsPreferred: Optional[int] = None
  guaranteedOffDays: Optional[int] = None
  alias: Optional[str] = None
  teamAlias: Optional[str] = None
  yearsOfService: Optional[int] = None
  careerGroupCode: Optional[str] = None
  careerGroupAlias: Optional[str] = None
  careerGroupName: Optional[str] = None
  previousOffCarry: Optional[int] = None


@dataclass
class SpecialRequest:
  employeeId: str
  date: str
  requestType: str
  shiftTypeCode: Optional[str] = None


@dataclass
class Holiday:
  date: str
  name: str


@dataclass
class TeamPattern:
  pattern: List[str]
  avoidPatterns: Optional[List[List[str]]] = None


@dataclass
class CareerGroup:
  code: str
  name: str
  alias: str
  minYears: Optional[int] = None
  maxYears: Optional[int] = None
  description: Optional[str] = None


@dataclass
class AliasMaps:
  employeeAliasMap: Dict[str, str]
  teamAliasMap: Dict[str, str]
  careerGroupAliasMap: Dict[str, str]


@dataclass
class ScheduleInput:
  departmentId: str
  startDate: date
  endDate: date
  employees: List[Employee]
  shifts: List[Shift]
  constraints: Optional[Sequence[dict]] = None
  specialRequests: Optional[List[SpecialRequest]] = None
  holidays: Optional[List[Holiday]] = None
  teamPattern: Optional[TeamPattern] = None
  requiredStaffPerShift: Optional[Dict[str, int]] = None
  nightIntensivePaidLeaveDays: Optional[int] = None
  previousOffAccruals: Dict[str, int] = field(default_factory=dict)
  careerGroups: Optional[List[CareerGroup]] = None
  aliasMaps: Optional[AliasMaps] = None
  options: Optional[Dict[str, Any]] = None


@dataclass
class Assignment:
  employeeId: str
  date: str
  shiftId: str
  shiftType: str
  isLocked: bool = False


def parse_schedule_input(payload: dict) -> ScheduleInput:
  start = datetime.fromisoformat(payload["startDate"])
  end = datetime.fromisoformat(payload["endDate"])
  employees = [Employee(**emp) for emp in payload["employees"]]
  shifts = [
    Shift(
      id=shift["id"],
      code=shift.get("code"),
      name=shift["name"],
      type=shift["type"],
      color=shift.get("color"),
      time=ShiftTime(**shift["time"]),
      requiredStaff=shift.get("requiredStaff", 0),
      minStaff=shift.get("minStaff"),
      maxStaff=shift.get("maxStaff"),
    )
    for shift in payload["shifts"]
  ]
  special_requests = [SpecialRequest(**req) for req in payload.get("specialRequests", [])]
  holidays = [Holiday(**holiday) for holiday in payload.get("holidays", [])]
  team_pattern = (
    TeamPattern(**payload["teamPattern"]) if payload.get("teamPattern") else None
  )
  career_groups = [
    CareerGroup(**group) for group in payload.get("careerGroups", [])
  ]
  alias_maps = (
    AliasMaps(**payload["aliasMaps"]) if payload.get("aliasMaps") else None
  )
  options = payload.get("options")

  return ScheduleInput(
    departmentId=payload["departmentId"],
    startDate=start.date(),
    endDate=end.date(),
    employees=employees,
    shifts=shifts,
    constraints=payload.get("constraints"),
    specialRequests=special_requests,
    holidays=holidays,
    teamPattern=team_pattern,
    requiredStaffPerShift=payload.get("requiredStaffPerShift"),
    nightIntensivePaidLeaveDays=payload.get("nightIntensivePaidLeaveDays"),
    previousOffAccruals=payload.get("previousOffAccruals", {}),
    careerGroups=career_groups,
    aliasMaps=alias_maps,
    options=options,
  )
