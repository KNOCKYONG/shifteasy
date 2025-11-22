import json
import os
import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
  sys.path.append(str(CURRENT_DIR))

from models import Assignment, parse_schedule_input
from solver.ortools_solver import solve_with_ortools
from solver.cpsat_solver import solve_with_cpsat
from solver.exceptions import SolverFailure
from solver.types import SolveResult


def load_input(path: Path):
  with path.open("r", encoding="utf-8") as f:
    return json.load(f)


def assignments_to_json(assignments: list[Assignment]):
  return [
    {
      "employeeId": assignment.employeeId,
      "date": assignment.date,
      "shiftId": assignment.shiftId,
      "shiftType": assignment.shiftType,
      "isLocked": assignment.isLocked,
    }
    for assignment in assignments
  ]


def main():
  if len(sys.argv) < 3:
    print("Usage: python -m scheduler-worker.src.run_solver <milp-input.json> <output.json>")
    sys.exit(1)

  input_path = Path(sys.argv[1])
  output_path = Path(sys.argv[2])

  payload = load_input(input_path)
  schedule = parse_schedule_input(payload)

  solver_choice = os.environ.get("MILP_SOLVER", "ortools").lower()
  result: SolveResult
  try:
    if solver_choice == "cpsat":
      result = solve_with_cpsat(schedule)
    else:
      result = solve_with_ortools(schedule)
  except SolverFailure as exc:
    print(f"[MILP] Solver failed: {exc}")
    if getattr(exc, "diagnostics", None):
      print(json.dumps({"diagnostics": exc.diagnostics}, ensure_ascii=False, indent=2))
    raise
  assignments = result.assignments
  diagnostics = result.diagnostics
  output = assignments_to_json(assignments)

  with output_path.open("w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

  print(f"Generated {len(assignments)} assignments → {output_path}")
  if diagnostics.get("staffingShortages"):
    print("Staffing shortages detected:")
    for shortage in diagnostics["staffingShortages"]:
      print(
        f"  {shortage['date']} {shortage['shiftType']}: "
        f"required {shortage['required']}, covered {shortage['covered']} (short {shortage['shortage']})"
      )
  if diagnostics.get("teamCoverageGaps"):
    print("Team coverage gaps detected:")
    for gap in diagnostics["teamCoverageGaps"]:
      print(f"  {gap['date']} {gap['shiftType']} team {gap['teamId']}: shortage {gap['shortage']}")
  if diagnostics.get("offBalanceGaps"):
    print("Off-day balance deviations:")
    for gap in diagnostics["offBalanceGaps"]:
      print(
        f"  team {gap['teamId']} {gap['employeeA']} vs {gap['employeeB']}: "
        f"diff {gap['difference']} (allowed {gap['tolerance']})"
      )
  if diagnostics.get("careerGroupCoverageGaps"):
    print("Career group coverage gaps detected:")
    for gap in diagnostics["careerGroupCoverageGaps"]:
      print(f"  {gap['date']} {gap['shiftType']} group {gap['careerGroupAlias']}: shortage {gap['shortage']}")
  if diagnostics.get("shiftPatternBreaks"):
    print("Shift repetition issues:")
    for issue in diagnostics["shiftPatternBreaks"]:
      print(
        f"  {issue['employeeId']} {issue['shiftType']} starting {issue['startDate']}: "
        f"excess {issue['excess']} over window {issue['window']}"
      )
  if diagnostics.get("specialRequestMisses"):
    print("Special requests not satisfied:")
    for miss in diagnostics["specialRequestMisses"]:
      print(f"  {miss['date']} employee {miss['employeeId']} expected {miss['shiftType']}")


if __name__ == "__main__":
  main()
