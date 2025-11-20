from __future__ import annotations

import os
import tempfile
from typing import Any, Dict, List, Set

import highspy

from models import Assignment, ScheduleInput
from solver.ortools_solver import OrToolsMilpSolver
from solver.postprocessor import SchedulePostProcessor
from solver.exceptions import SolverFailure


def _solve_highs_from_lp(lp_content: str) -> tuple[highspy.HighsModelStatus, highspy.HighsSolution, List[str]]:
  with tempfile.NamedTemporaryFile("w", suffix=".lp", delete=False, encoding="utf-8") as tmp:
    tmp.write(lp_content)
    tmp.flush()
    lp_path = tmp.name
  highs = highspy.Highs()
  try:
    read_status = highs.readModel(lp_path)
    if read_status != highspy.HighsStatus.kOk:
      raise RuntimeError("HiGHS failed to read LP model")
    run_status = highs.run()
    if run_status != highspy.HighsStatus.kOk:
      raise RuntimeError("HiGHS failed to solve model")
    solution = highs.getSolution()
    lp = highs.getLp()
    col_names = list(lp.col_names_)
    return highs.getModelStatus(), solution, col_names
  finally:
    try:
      os.unlink(lp_path)
    except OSError:
      pass


def solve_with_highs(schedule: ScheduleInput) -> tuple[list[Assignment], Dict[str, Any]]:
  builder = OrToolsMilpSolver(schedule)
  builder.build_model()
  lp_content = builder.solver.ExportModelAsLpFormat(False)
  model_status, solution, col_names = _solve_highs_from_lp(lp_content)
  if model_status not in (
    highspy.HighsModelStatus.kOptimal,
    highspy.HighsModelStatus.kObjectiveBound,
    highspy.HighsModelStatus.kObjectiveTarget,
  ):
    raise SolverFailure(
      f"HiGHS solver returned status {model_status}",
      diagnostics={"preflightIssues": builder.preflight_issues},
    )

  active_names: Set[str] = set()
  for idx, value in enumerate(getattr(solution, "col_value", []) or []):
    if value >= 0.5 and idx < len(col_names):
      active_names.add(col_names[idx])

  assignments = builder.build_assignments_from_names(active_names)
  base_diagnostics = {"preflightIssues": builder.preflight_issues}
  postprocessor = SchedulePostProcessor(
    schedule,
    assignments,
    base_diagnostics,
    getattr(schedule, "options", None),
  )
  assignments, diagnostics = postprocessor.run()
  diagnostics.setdefault("preflightIssues", builder.preflight_issues)
  diagnostics.setdefault("solver", "highs")
  return assignments, diagnostics
