import { db } from '@/db';
import { tenants, users } from '@/db/schema';
import type { Tenant } from '@/db/schema/tenants';
import { and, eq, isNull, sql } from 'drizzle-orm';

export type PlanId = 'guest' | 'professional' | 'enterprise';

type DbClient = typeof db;

export const PLAN_CONFIG: Record<PlanId, { maxUsers: number | null }> = {
  guest: { maxUsers: 30 },
  professional: { maxUsers: 50 },
  enterprise: { maxUsers: null },
};

export const DEFAULT_TENANT_SETTINGS: Tenant['settings'] = {
  timezone: 'Asia/Seoul',
  locale: 'ko',
  maxUsers: 30,
  maxDepartments: 3,
  features: [],
  signupEnabled: true,
};

export function normalizePlanId(plan: string | null | undefined): PlanId {
  const normalized = (plan ?? 'guest').toLowerCase();

  if (normalized === 'free') {
    return 'guest';
  }
  if (normalized === 'professional' || normalized === 'enterprise') {
    return normalized;
  }
  return 'guest';
}

export function getPlanConfig(plan: string | null | undefined) {
  return PLAN_CONFIG[normalizePlanId(plan)];
}

export function getPlanUserLimit(plan: string | null | undefined) {
  return getPlanConfig(plan).maxUsers;
}

export interface ApplyPlanSettingsOptions {
  existingSettings?: Tenant['settings'] | null;
  overrides?: Partial<Tenant['settings']>;
}

export function applyPlanSettings(
  plan: string | null | undefined,
  options?: ApplyPlanSettingsOptions
): Tenant['settings'] {
  const normalizedPlan = normalizePlanId(plan);
  const planConfig = PLAN_CONFIG[normalizedPlan];
  const { existingSettings, overrides } = options ?? {};

  const merged: Tenant['settings'] = {
    ...DEFAULT_TENANT_SETTINGS,
    ...(existingSettings ?? {}),
    ...(overrides ?? {}),
  };

  if (typeof overrides?.maxUsers !== 'undefined') {
    merged.maxUsers = overrides.maxUsers;
  } else if (typeof planConfig.maxUsers === 'number') {
    merged.maxUsers = planConfig.maxUsers;
  } else if (typeof merged.maxUsers === 'undefined') {
    delete merged.maxUsers;
  }

  return merged;
}

export class TenantUserLimitError extends Error {
  limit: number;
  usage: number;

  constructor(limit: number, usage: number) {
    super(`멤버 한도(${limit}명)를 초과했습니다. 기존 멤버를 정리하거나 플랜을 업그레이드해주세요.`);
    this.name = 'TenantUserLimitError';
    this.limit = limit;
    this.usage = usage;
  }
}

interface AssertLimitOptions {
  tenantId: string;
  additionalMembers?: number;
  dbClient?: DbClient;
}

export async function assertTenantWithinUserLimit({
  tenantId,
  additionalMembers = 1,
  dbClient = db,
}: AssertLimitOptions) {
  const [tenant] = await dbClient
    .select({
      plan: tenants.plan,
      settings: tenants.settings,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const planLimit = getPlanUserLimit(tenant.plan);
  const explicitLimit =
    typeof tenant.settings?.maxUsers === 'number'
      ? tenant.settings.maxUsers
      : undefined;

  const limit = typeof explicitLimit === 'number' ? explicitLimit : planLimit;

  if (!limit) {
    return {
      limit: null,
      usage: 0,
    };
  }

  const usageResult = await dbClient
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(
      and(
        eq(users.tenantId, tenantId),
        isNull(users.deletedAt)
      )
    );

  const currentUsage = Number(usageResult[0]?.count ?? 0);
  if (currentUsage + additionalMembers > limit) {
    throw new TenantUserLimitError(limit, currentUsage);
  }

  return {
    limit,
    usage: currentUsage,
  };
}

interface UpdateTenantPlanOptions {
  overrides?: Partial<Tenant['settings']>;
  dbClient?: DbClient;
}

export async function updateTenantPlan(
  tenantId: string,
  plan: string | null | undefined,
  options?: UpdateTenantPlanOptions
) {
  const dbClient = options?.dbClient ?? db;
  const normalizedPlan = normalizePlanId(plan);

  const [tenant] = await dbClient
    .select({
      id: tenants.id,
      settings: tenants.settings,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const updatedSettings = applyPlanSettings(normalizedPlan, {
    existingSettings: tenant.settings,
    overrides: options?.overrides,
  });

  const [updatedTenant] = await dbClient
    .update(tenants)
    .set({
      plan: normalizedPlan,
      settings: updatedSettings,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId))
    .returning();

  return updatedTenant;
}
