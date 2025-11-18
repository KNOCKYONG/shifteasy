#!/usr/bin/env tsx
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serializeMilpCspInput } from '@/lib/scheduler/milp-csp/serializer';

interface ScenarioFile {
  scheduleInput: any;
  careerGroupsConfig?: any[];
  yearsOfService?: Record<string, number>;
}

const loadScenario = async (fileName: string): Promise<ScenarioFile> => {
  const filePath = join(process.cwd(), 'tests', 'milp-csp', fileName);
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as ScenarioFile;
};

async function main() {
  const [scenarioFile, outputPath] = process.argv.slice(2);
  if (!scenarioFile || !outputPath) {
    console.error('Usage: npx tsx tests/milp-csp/prepare-milp-input.ts <scenario.json> <output.json>');
    process.exit(1);
  }

  const scenario = await loadScenario(scenarioFile);
  const startDate = new Date(scenario.scheduleInput.startDate);
  const endDate = new Date(scenario.scheduleInput.endDate);

  const milpInput = serializeMilpCspInput(
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

  await writeFile(outputPath, JSON.stringify(milpInput, null, 2), 'utf-8');
  console.log(`Milp input written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
