#!/usr/bin/env python3
"""
Fetch the latest scheduler_payload for a department from configs
and run the Python solver with it (uses psycopg2).

Usage:
  python tests/milp-csp/run-config-payload.py <department_id> [--solver cpsat|ortools] [--timeout-ms 180000]

Environment:
  - DIRECT_URL or DATABASE_URL must be set (PostgreSQL connection string)
  - DEV_TENANT_ID (optional; defaults to common dev tenant)
  - MILP_SOLVER, MILP_SOLVE_TIMEOUT_MS can be passed, but CLI flags override them
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

try:
  import psycopg2  # type: ignore
except ImportError as exc:
  print("psycopg2 is required. Install with: pip3 install psycopg2-binary", file=sys.stderr)
  raise


DEFAULT_TENANT = os.environ.get("DEV_TENANT_ID", "3760b5ec-462f-443c-9a90-4a2b2e295e9d")


def load_payload(department_id: str, tenant_id: str):
  db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
  if not db_url:
    raise RuntimeError("DIRECT_URL or DATABASE_URL must be set")
  conn = psycopg2.connect(db_url)
  cur = conn.cursor()
  cur.execute(
    """
    select config_value
    from configs
    where tenant_id=%s and department_id=%s and config_key='scheduler_payload'
    limit 1;
    """,
    (tenant_id, department_id),
  )
  row = cur.fetchone()
  cur.close()
  conn.close()
  if not row:
    raise RuntimeError("No scheduler_payload found for department")
  config_value = row[0] if isinstance(row, (list, tuple)) else row
  if not isinstance(config_value, dict):
    raise RuntimeError("config_value is not a JSON object")
  payload = config_value.get("payload")
  if not isinstance(payload, dict):
    raise RuntimeError("payload missing in config_value")
  milp_input = payload.get("milpInput")
  if not isinstance(milp_input, dict):
    raise RuntimeError("milpInput missing in payload")
  return payload, milp_input


def run_solver(milp_input: dict, solver: str, timeout_ms: int):
  with tempfile.TemporaryDirectory(prefix="milp-payload-") as tmpdir:
    tmpdir_path = Path(tmpdir)
    milp_path = tmpdir_path / "milp-input.json"
    out_path = tmpdir_path / "assignments.json"
    milp_path.write_text(json.dumps(milp_input, ensure_ascii=False, indent=2), encoding="utf-8")
    env = os.environ.copy()
    env["MILP_SOLVER"] = solver
    env["MILP_SOLVE_TIMEOUT_MS"] = str(timeout_ms)
    cmd = ["python3", "scheduler-worker/src/run_solver.py", str(milp_path), str(out_path)]
    print(f"[solver] running: {' '.join(cmd)}")
    proc = subprocess.run(cmd, env=env, capture_output=True, text=True)
    print(proc.stdout)
    print(proc.stderr, file=sys.stderr)
    if proc.returncode != 0:
      raise RuntimeError(f"solver exited with code {proc.returncode}")
    try:
      assignments = json.loads(out_path.read_text(encoding="utf-8"))
      count = len(assignments) if isinstance(assignments, list) else 0
      print(f"[solver] assignments: {count}")
      print(f"[solver] output file: {out_path}")
    except Exception as exc:  # pragma: no cover - best-effort logging
      print(f"[solver] failed to read assignments: {exc}", file=sys.stderr)


def main():
  parser = argparse.ArgumentParser(description="Run solver using stored scheduler_payload")
  parser.add_argument("department_id", help="Department ID (UUID)")
  parser.add_argument("--tenant-id", default=DEFAULT_TENANT, help="Tenant ID (default: DEV tenant)")
  parser.add_argument("--solver", choices=["cpsat", "ortools"], default="cpsat", help="Solver to use")
  parser.add_argument("--timeout-ms", type=int, default=180000, help="Solver wall-time limit (ms)")
  args = parser.parse_args()

  payload, milp_input = load_payload(args.department_id, args.tenant_id)
  print(f"[payload] loaded for department {args.department_id}, solver={args.solver}, timeout={args.timeout_ms}ms")
  run_solver(milp_input, args.solver, args.timeout_ms)


if __name__ == "__main__":
  try:
    main()
  except Exception as exc:  # pragma: no cover - CLI helper
    print(exc, file=sys.stderr)
    sys.exit(1)
