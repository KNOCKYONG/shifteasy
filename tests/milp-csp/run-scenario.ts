#!/usr/bin/env tsx
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serializeMilpCspInput } from '@/lib/scheduler/milp-csp/serializer';
import type { MilpCspScheduleInput } from '@/lib/scheduler/milp-csp/types';

type ScenarioFile = {
  description: string;
  scheduleInput: any;
  careerGroupsConfig?: any[];
  yearsOfService?: Record<string, number>;
  checks?: string[];
};

async function loadScenario(fileName: string): Promise<ScenarioFile> {
  const filePath = join(process.cwd(), 'tests', 'milp-csp', fileName);
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as ScenarioFile;
}

async function main() {
  const fileName = process.argv[2];
  if (!fileName) {
    console.error('Usage: tsx tests/milp-csp/run-scenario.ts <scenario-file>');
    process.exit(1);
  }

  const scenario = await loadScenario(fileName);
  const startDate = new Date(scenario.scheduleInput.startDate);
  const endDate = new Date(scenario.scheduleInput.endDate);

  const milpInput: MilpCspScheduleInput = serializeMilpCspInput(
    {
      ...scenario.scheduleInput,
      startDate,
      endDate,
      teamPattern: scenario.scheduleInput.teamPattern ?? null,
    },
    {
      previousOffAccruals: {},
      careerGroups: scenario.careerGroupsConfig?.map((group, index) => ({
        code: group.code ?? `CG${index + 1}`,
        name: group.name ?? `경력 그룹 ${index + 1}`,
        alias: `CG${index + 1}`,
        minYears: group.minYears,
        maxYears: group.maxYears,
        description: group.description,
      })),
      yearsOfServiceMap: new Map(Object.entries(scenario.yearsOfService ?? {})),
    }
  );

  console.log(`Scenario: ${scenario.description}`);
  console.log(`Employees: ${milpInput.employees.length}, Dates: ${milpInput.startDate.toISOString()} - ${milpInput.endDate.toISOString()}`);
  console.log('Alias Maps:', milpInput.aliasMaps);
  console.log('Checks:', scenario.checks ?? []);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
