#!/usr/bin/env tsx
import { loadScenario, loadAssignments, buildMilpInput, evaluateScenario } from './lib/evaluator';

async function main() {
  const [scenarioFile, assignmentsFile] = process.argv.slice(2);
  if (!scenarioFile || !assignmentsFile) {
    console.error('Usage: npx tsx tests/milp-csp/evaluate.ts <scenario.json> <assignments.json>');
    process.exit(1);
  }

  const scenario = await loadScenario(scenarioFile);
  const milpInput = buildMilpInput(scenario);
  const assignments = await loadAssignments(assignmentsFile);
  const results = evaluateScenario(scenario, milpInput, assignments);

  console.log(`Scenario: ${scenario.description}`);
  let passed = true;
  for (const result of results) {
    if (!result.passed) {
      passed = false;
    }
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}${result.message ? ` - ${result.message}` : ''}`);
  }
  if (!passed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
