import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { configs, users } from '@/db/schema';
import type { MilpCspCareerGroup } from '@/lib/scheduler/milp-csp/types';

export interface CareerGroupConfig {
  code?: string;
  name?: string;
  minYears?: number;
  maxYears?: number;
  description?: string;
}

const normalizeCareerGroup = (
  group: CareerGroupConfig,
  index: number
): MilpCspCareerGroup => {
  const alias = `CG${index + 1}`;
  return {
    code: (group.code ?? alias).toUpperCase(),
    name: group.name ?? `경력 그룹 ${index + 1}`,
    alias,
    minYears:
      typeof group.minYears === 'number' && group.minYears >= 0 ? group.minYears : undefined,
    maxYears:
      typeof group.maxYears === 'number' && group.maxYears >= 0 ? group.maxYears : undefined,
    description: group.description,
  };
};

export async function loadCareerGroups(
  tenantId: string,
  departmentId?: string
): Promise<MilpCspCareerGroup[]> {
  if (!tenantId) {
    return [];
  }

  const deptRows = departmentId
    ? await db
        .select({ value: configs.configValue })
        .from(configs)
        .where(
          and(
            eq(configs.tenantId, tenantId),
            eq(configs.departmentId, departmentId),
            eq(configs.configKey, 'career_groups')
          )
        )
        .limit(1)
    : [];

  const globalRows = await db
    .select({ value: configs.configValue })
    .from(configs)
    .where(
      and(eq(configs.tenantId, tenantId), isNull(configs.departmentId), eq(configs.configKey, 'career_groups'))
    )
    .limit(1);

  const rawValue = deptRows[0]?.value ?? globalRows[0]?.value;

  const groups: CareerGroupConfig[] = Array.isArray(rawValue) ? rawValue : [];
  if (!groups.length) {
    return [];
  }

  return groups.map((group, index) => normalizeCareerGroup(group, index));
}

export async function loadYearsOfServiceMap(
  tenantId: string,
  employeeIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!tenantId || employeeIds.length === 0) {
    return map;
  }

  const rows = await db
    .select({
      id: users.id,
      yearsOfService: users.yearsOfService,
    })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), inArray(users.id, employeeIds)));

  rows.forEach((row) => {
    if (row.id && typeof row.yearsOfService === 'number' && row.yearsOfService >= 0) {
      map.set(row.id, row.yearsOfService);
    }
  });

  return map;
}
