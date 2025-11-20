#!/usr/bin/env tsx
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pLimit from 'p-limit';

const execFileAsync = promisify(execFile);
const concurrency = parseInt(process.env.MILP_RUN_ALL_CONCURRENCY || '2', 10);
// 기본 15분; 긴 시나리오가 포함되면 env로 조정
const perTestTimeoutMs = parseInt(process.env.MILP_RUN_TIMEOUT_MS || '900000', 10);

async function runScenario(file: string) {
  try {
    const { stdout } = await execFileAsync('npx', ['tsx', 'tests/milp-csp/run-harness.ts', file], {
      env: process.env,
      timeout: perTestTimeoutMs,
    });
    process.stdout.write(`[PASS] ${file}\n${stdout}`);
    return true;
  } catch (error: any) {
    process.stderr.write(`[FAIL] ${file}\n${error?.stdout || ''}${error?.stderr || error}\n`);
    return false;
  }
}

async function main() {
  const dir = join(process.cwd(), 'tests', 'milp-csp');
  const files = readdirSync(dir).filter((f) => f.startsWith('scenario-') && f.endsWith('.json'));
  const limit = pLimit(Math.max(1, concurrency));
  let passed = true;
  const results = await Promise.all(
    files.map((file) =>
      limit(async () => {
        const ok = await runScenario(file);
        if (!ok) passed = false;
      })
    )
  );
  if (!passed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
