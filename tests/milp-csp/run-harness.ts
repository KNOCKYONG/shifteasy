#!/usr/bin/env tsx
import { mkdtemp, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  buildMilpInput,
  evaluateScenario,
  loadAssignments,
  loadScenario,
} from './lib/evaluator';

const execFileAsync = promisify(execFile);

async function runPythonSolver(inputPath: string, outputPath: string) {
  const python = process.env.SCHEDULER_PYTHON ?? 'python3';
  const solverPath = resolve('scheduler-worker/src/run_solver.py');
  await execFileAsync(python, [solverPath, inputPath, outputPath]);
}

async function main() {
  const scenarioFile = process.argv[2];
  if (!scenarioFile) {
    console.error('Usage: npx tsx tests/milp-csp/run-harness.ts <scenario.json>');
    process.exit(1);
  }

  const scenario = await loadScenario(scenarioFile);
  const milpInput = buildMilpInput(scenario);
  const tmpDir = await mkdtemp(join(tmpdir(), 'milp-'));
  const milpPath = join(tmpDir, 'milp-input.json');
  const assignmentsPath = join(tmpDir, 'assignments.json');

  await writeFile(milpPath, JSON.stringify(milpInput, null, 2), 'utf-8');

  try {
    await runPythonSolver(milpPath, assignmentsPath);
    const assignments = await loadAssignments(assignmentsPath);
    const results = evaluateScenario(scenario, milpInput, assignments);
    let passed = true;
    for (const result of results) {
      if (!result.passed) passed = false;
      console.log(`${result.passed ? '✅' : '❌'} ${result.name}${result.message ? ` - ${result.message}` : ''}`);
    }
    if (!passed) {
      process.exit(1);
    }
  } finally {
    await unlink(milpPath).catch(() => {});
    await unlink(assignmentsPath).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
