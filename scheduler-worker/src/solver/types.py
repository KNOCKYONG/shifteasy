from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional, Protocol

from models import Assignment

SolveStatus = Literal["optimal", "feasible", "timeout", "cancelled", "infeasible", "error"]


class CancellationToken(Protocol):
  """Lightweight protocol to share cancellation intent across solver threads."""

  cancelled: bool


@dataclass
class SolveResult:
  assignments: List[Assignment]
  diagnostics: Dict[str, Any]
  status: SolveStatus
  solve_time_ms: int
  best_objective: Optional[float] = None
  timed_out: bool = False
