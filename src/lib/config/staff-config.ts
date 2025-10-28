/**
 * Staff Configuration Helper
 * Loads staff-related configurations from tenant_configs
 */

import { db } from '@/db';
import { tenantConfigs } from '@/db/schema/tenant-configs';
import { eq, and } from 'drizzle-orm';

const DEFAULT_TENANT_ID = '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

// Default values (fallback)
const DEFAULT_EXPERIENCE_WEIGHTS = {
  JUNIOR: { weight: 1.0 },
  INTERMEDIATE: { weight: 1.2 },
  SENIOR: { weight: 1.5 },
  EXPERT: { weight: 2.0 },
} as const;

const DEFAULT_TEAM_BALANCE = {
  MIN_TEAM_SIZE: 3,
  OPTIMAL_TEAM_SIZE: 8,
  MAX_TEAM_SIZE: 15,
  MIN_SENIOR_RATIO: 0.3,
  MAX_JUNIOR_RATIO: 0.4,
  ROLE_DISTRIBUTION: {
    RN: { min: 0.4, max: 0.6 },
    CN: { min: 0.1, max: 0.2 },
    SN: { min: 0.1, max: 0.3 },
    NA: { min: 0.1, max: 0.3 },
  },
} as const;

const DEFAULT_BALANCE_WEIGHTS = {
  EXPERIENCE_DISTRIBUTION: 0.3,
  ROLE_DISTRIBUTION: 0.25,
  SKILL_AVERAGE: 0.2,
  TEAM_SIZE: 0.15,
  ACTIVE_RATIO: 0.1,
} as const;

const DEFAULT_STAFF_VALUES = {
  MAX_WEEKLY_HOURS: 40,
  TECHNICAL_SKILL: 3,
  LEADERSHIP: 3,
  COMMUNICATION: 3,
  ADAPTABILITY: 3,
  RELIABILITY: 3,
  ACTIVE: true,
} as const;

// Types
export interface ExperienceWeights {
  JUNIOR: { weight: number };
  INTERMEDIATE: { weight: number };
  SENIOR: { weight: number };
  EXPERT: { weight: number };
}

export interface TeamBalance {
  MIN_TEAM_SIZE: number;
  OPTIMAL_TEAM_SIZE: number;
  MAX_TEAM_SIZE: number;
  MIN_SENIOR_RATIO: number;
  MAX_JUNIOR_RATIO: number;
  ROLE_DISTRIBUTION: {
    RN: { min: number; max: number };
    CN: { min: number; max: number };
    SN: { min: number; max: number };
    NA: { min: number; max: number };
  };
}

export interface BalanceWeights {
  EXPERIENCE_DISTRIBUTION: number;
  ROLE_DISTRIBUTION: number;
  SKILL_AVERAGE: number;
  TEAM_SIZE: number;
  ACTIVE_RATIO: number;
}

export interface StaffDefaultValues {
  MAX_WEEKLY_HOURS: number;
  TECHNICAL_SKILL: number;
  LEADERSHIP: number;
  COMMUNICATION: number;
  ADAPTABILITY: number;
  RELIABILITY: number;
  ACTIVE: boolean;
}

/**
 * Get experience weights from tenant_configs
 */
export async function getExperienceWeights(tenantId: string = DEFAULT_TENANT_ID): Promise<ExperienceWeights> {
  try {
    const result = await db.select()
      .from(tenantConfigs)
      .where(and(
        eq(tenantConfigs.tenantId, tenantId),
        eq(tenantConfigs.configKey, 'staff_experience_weights')
      ))
      .limit(1);

    if (result.length > 0 && result[0].configValue) {
      return result[0].configValue as ExperienceWeights;
    }
  } catch (error) {
    console.error('Failed to load experience weights:', error);
  }

  return { ...DEFAULT_EXPERIENCE_WEIGHTS };
}

/**
 * Get team balance rules from tenant_configs
 */
export async function getTeamBalance(tenantId: string = DEFAULT_TENANT_ID): Promise<TeamBalance> {
  try {
    const result = await db.select()
      .from(tenantConfigs)
      .where(and(
        eq(tenantConfigs.tenantId, tenantId),
        eq(tenantConfigs.configKey, 'team_balance_rules')
      ))
      .limit(1);

    if (result.length > 0 && result[0].configValue) {
      return result[0].configValue as TeamBalance;
    }
  } catch (error) {
    console.error('Failed to load team balance rules:', error);
  }

  return { ...DEFAULT_TEAM_BALANCE };
}

/**
 * Get balance weights from tenant_configs
 */
export async function getBalanceWeights(tenantId: string = DEFAULT_TENANT_ID): Promise<BalanceWeights> {
  try {
    const result = await db.select()
      .from(tenantConfigs)
      .where(and(
        eq(tenantConfigs.tenantId, tenantId),
        eq(tenantConfigs.configKey, 'balance_weights')
      ))
      .limit(1);

    if (result.length > 0 && result[0].configValue) {
      return result[0].configValue as BalanceWeights;
    }
  } catch (error) {
    console.error('Failed to load balance weights:', error);
  }

  return { ...DEFAULT_BALANCE_WEIGHTS };
}

/**
 * Get default staff values from tenant_configs
 */
export async function getStaffDefaultValues(tenantId: string = DEFAULT_TENANT_ID): Promise<StaffDefaultValues> {
  try {
    const result = await db.select()
      .from(tenantConfigs)
      .where(and(
        eq(tenantConfigs.tenantId, tenantId),
        eq(tenantConfigs.configKey, 'staff_default_values')
      ))
      .limit(1);

    if (result.length > 0 && result[0].configValue) {
      return result[0].configValue as StaffDefaultValues;
    }
  } catch (error) {
    console.error('Failed to load staff default values:', error);
  }

  return { ...DEFAULT_STAFF_VALUES };
}

/**
 * Save experience weights to tenant_configs
 */
export async function saveExperienceWeights(weights: ExperienceWeights, tenantId: string = DEFAULT_TENANT_ID): Promise<void> {
  await db.insert(tenantConfigs)
    .values({
      tenantId,
      configKey: 'staff_experience_weights',
      configValue: weights,
    })
    .onConflictDoUpdate({
      target: [tenantConfigs.tenantId, tenantConfigs.configKey],
      set: {
        configValue: weights,
        updatedAt: new Date(),
      },
    });
}

/**
 * Save team balance rules to tenant_configs
 */
export async function saveTeamBalance(balance: TeamBalance, tenantId: string = DEFAULT_TENANT_ID): Promise<void> {
  await db.insert(tenantConfigs)
    .values({
      tenantId,
      configKey: 'team_balance_rules',
      configValue: balance,
    })
    .onConflictDoUpdate({
      target: [tenantConfigs.tenantId, tenantConfigs.configKey],
      set: {
        configValue: balance,
        updatedAt: new Date(),
      },
    });
}

/**
 * Save balance weights to tenant_configs
 */
export async function saveBalanceWeights(weights: BalanceWeights, tenantId: string = DEFAULT_TENANT_ID): Promise<void> {
  await db.insert(tenantConfigs)
    .values({
      tenantId,
      configKey: 'balance_weights',
      configValue: weights,
    })
    .onConflictDoUpdate({
      target: [tenantConfigs.tenantId, tenantConfigs.configKey],
      set: {
        configValue: weights,
        updatedAt: new Date(),
      },
    });
}

/**
 * Save default staff values to tenant_configs
 */
export async function saveStaffDefaultValues(values: StaffDefaultValues, tenantId: string = DEFAULT_TENANT_ID): Promise<void> {
  await db.insert(tenantConfigs)
    .values({
      tenantId,
      configKey: 'staff_default_values',
      configValue: values,
    })
    .onConflictDoUpdate({
      target: [tenantConfigs.tenantId, tenantConfigs.configKey],
      set: {
        configValue: values,
        updatedAt: new Date(),
      },
    });
}

// Export defaults for initial setup
export {
  DEFAULT_EXPERIENCE_WEIGHTS,
  DEFAULT_TEAM_BALANCE,
  DEFAULT_BALANCE_WEIGHTS,
  DEFAULT_STAFF_VALUES,
};
