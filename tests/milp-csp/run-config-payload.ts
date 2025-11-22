#!/usr/bin/env tsx
/**
 * Fetches the latest scheduler payload stored in configs (config_key='scheduler_payload')
 * for the given department_id, then runs the Python MILP solver with that payload.
 *
 * Usage:
 *   npx tsx tests/milp-csp/run-config-payload.ts <departmentId> [pythonBin]
 *
 * Notes:
 * - Requires DATABASE_URL (or .env.local) to be set so Drizzle can connect.
 * - Payload must include `milpInput` or the script will abort.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { configs } from '@/db/schema/configs';

const execFileAsync = promisify(execFile);

async function main() {
  const departmentId = process.argv[2];
  const pythonBin = process.argv[3] || process.env.SCHEDULER_PYTHON || 'python3';
  if (!departmentId) {
    console.error('Usage: npx tsx tests/milp-csp/run-config-payload.ts <departmentId> [pythonBin]');
    process.exit(1);
  }

  console.log(`[payload] loading scheduler_payload for department ${departmentId}`);
  const rows = await db
    .select()
    .from(configs)
    .where(
      and(
        eq(configs.departmentId, departmentId),
        eq(configs.configKey, 'scheduler_payload'),
      )
    )
    .limit(1);

  if (!rows.length) {
    console.error('No scheduler_payload found for department');
    process.exit(1);
  }

  const configValue = rows[0]!.configValue as Record<string, unknown>;
  const payload = (configValue as { payload?: unknown }).payload;
  if (!payload || typeof payload !== 'object') {
    console.error('scheduler_payload exists but payload is missing');
    process.exit(1);
  }
  const milpInput = (payload as { milpInput?: unknown }).milpInput;
  if (!milpInput || typeof milpInput !== 'object') {
    console.error('scheduler_payload is missing milpInput');
    process.exit(1);
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'milp-payload-'));
  const payloadPath = path.join(tmpDir, 'payload.json');
  const milpPath = path.join(tmpDir, 'milp-input.json');
  const outputPath = path.join(tmpDir, 'assignments.json');
  await fs.writeFile(payloadPath, JSON.stringify(payload, null, 2), 'utf-8');
  await fs.writeFile(milpPath, JSON.stringify(milpInput, null, 2), 'utf-8');
  console.log(`[payload] saved payload → ${payloadPath}`);
  console.log(`[payload] saved milpInput → ${milpPath}`);

  const solverScript = path.resolve('scheduler-worker/src/run_solver.py');
  console.log(`[solver] running ${pythonBin} ${solverScript}`);
  const proc = await execFileAsync(pythonBin, [solverScript, milpPath, outputPath], {
    env: { ...process.env },
    maxBuffer: 10 * 1024 * 1024,
  });
  process.stdout.write(proc.stdout);
  process.stderr.write(proc.stderr);

  try {
    const assignments = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
    console.log(`[solver] assignments generated: ${Array.isArray(assignments) ? assignments.length : 0}`);
    console.log(`[solver] assignments file: ${outputPath}`);
  } catch (error) {
    console.warn('Failed to load assignments output', error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
