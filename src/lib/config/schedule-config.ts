/**
 * Schedule Configuration Helper
 * Loads schedule-related configurations from tenant_configs
 */

import { db } from '@/db';
import { tenantConfigs } from '@/db/schema/tenant-configs';
import { eq, and } from 'drizzle-orm';

const DEFAULT_TENANT_ID = '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

// Default values (fallback)
const DEFAULT_SCHEDULE_CONFIG = {
  MAX_CONSECUTIVE_DAYS: 5,
  MIN_REST_HOURS: 11,
  MAX_WEEKLY_HOURS: 52,
  FAIRNESS_WEIGHT: 0.7,
  PREFERENCE_WEIGHT: 0.3,
} as const;

const DEFAULT_SHIFT_RULES = [
  { id: "max-consecutive", name: "최대 연속 근무", type: "limit", value: 5, enabled: true },
  { id: "min-rest", name: "최소 휴식 시간", type: "minimum", value: 11, enabled: true },
  { id: "weekend-fairness", name: "주말 공평 배분", type: "balance", value: 1, enabled: true },
  { id: "night-limit", name: "월 야간 근무 제한", type: "limit", value: 8, enabled: true },
] as const;

const DEFAULT_PERFORMANCE_THRESHOLDS = {
  PROCESSING_TIME_GOOD: 5000, // ms
  PROCESSING_TIME_WARNING: 10000, // ms
  COVERAGE_RATE_GOOD: 0.9,
  COVERAGE_RATE_WARNING: 0.7,
  DISTRIBUTION_BALANCE_GOOD: 0.8,
  DISTRIBUTION_BALANCE_WARNING: 0.6,
} as const;

// Types
export interface ScheduleConfig {
  MAX_CONSECUTIVE_DAYS: number;
  MIN_REST_HOURS: number;
  MAX_WEEKLY_HOURS: number;
  FAIRNESS_WEIGHT: number;
  PREFERENCE_WEIGHT: number;
}

export interface ShiftRule {
  id: string;
  name: string;
  type: 'limit' | 'minimum' | 'balance';
  value: number;
  enabled: boolean;
}

export interface PerformanceThresholds {
  PROCESSING_TIME_GOOD: number;
  PROCESSING_TIME_WARNING: number;
  COVERAGE_RATE_GOOD: number;
  COVERAGE_RATE_WARNING: number;
  DISTRIBUTION_BALANCE_GOOD: number;
  DISTRIBUTION_BALANCE_WARNING: number;
}

/**
 * Get schedule configuration from tenant_configs
 */
export async function getScheduleConfig(tenantId: string = DEFAULT_TENANT_ID): Promise<ScheduleConfig> {
  try {
    const result = await db.select()
      .from(tenantConfigs)
      .where(and(
        eq(tenantConfigs.tenantId, tenantId),
        eq(tenantConfigs.configKey, 'schedule_rules')
      ))
      .limit(1);

    if (result.length > 0 && result[0].configValue) {
      return result[0].configValue as ScheduleConfig;
    }
  } catch (error) {
    console.error('Failed to load schedule config:', error);
  }

  return { ...DEFAULT_SCHEDULE_CONFIG };
}

/**
 * Get shift rules from tenant_configs
 */
export async function getShiftRules(tenantId: string = DEFAULT_TENANT_ID): Promise<ShiftRule[]> {
  try {
    const result = await db.select()
      .from(tenantConfigs)
      .where(and(
        eq(tenantConfigs.tenantId, tenantId),
        eq(tenantConfigs.configKey, 'shift_rules')
      ))
      .limit(1);

    if (result.length > 0 && result[0].configValue) {
      return result[0].configValue as ShiftRule[];
    }
  } catch (error) {
    console.error('Failed to load shift rules:', error);
  }

  return [...DEFAULT_SHIFT_RULES];
}

/**
 * Get performance thresholds from tenant_configs
 */
export async function getPerformanceThresholds(tenantId: string = DEFAULT_TENANT_ID): Promise<PerformanceThresholds> {
  try {
    const result = await db.select()
      .from(tenantConfigs)
      .where(and(
        eq(tenantConfigs.tenantId, tenantId),
        eq(tenantConfigs.configKey, 'performance_thresholds')
      ))
      .limit(1);

    if (result.length > 0 && result[0].configValue) {
      return result[0].configValue as PerformanceThresholds;
    }
  } catch (error) {
    console.error('Failed to load performance thresholds:', error);
  }

  return { ...DEFAULT_PERFORMANCE_THRESHOLDS };
}

/**
 * Save schedule configuration to tenant_configs
 */
export async function saveScheduleConfig(config: ScheduleConfig, tenantId: string = DEFAULT_TENANT_ID): Promise<void> {
  await db.insert(tenantConfigs)
    .values({
      tenantId,
      configKey: 'schedule_rules',
      configValue: config,
    })
    .onConflictDoUpdate({
      target: [tenantConfigs.tenantId, tenantConfigs.configKey],
      set: {
        configValue: config,
        updatedAt: new Date(),
      },
    });
}

/**
 * Save shift rules to tenant_configs
 */
export async function saveShiftRules(rules: ShiftRule[], tenantId: string = DEFAULT_TENANT_ID): Promise<void> {
  await db.insert(tenantConfigs)
    .values({
      tenantId,
      configKey: 'shift_rules',
      configValue: rules,
    })
    .onConflictDoUpdate({
      target: [tenantConfigs.tenantId, tenantConfigs.configKey],
      set: {
        configValue: rules,
        updatedAt: new Date(),
      },
    });
}

/**
 * Save performance thresholds to tenant_configs
 */
export async function savePerformanceThresholds(thresholds: PerformanceThresholds, tenantId: string = DEFAULT_TENANT_ID): Promise<void> {
  await db.insert(tenantConfigs)
    .values({
      tenantId,
      configKey: 'performance_thresholds',
      configValue: thresholds,
    })
    .onConflictDoUpdate({
      target: [tenantConfigs.tenantId, tenantConfigs.configKey],
      set: {
        configValue: thresholds,
        updatedAt: new Date(),
      },
    });
}

// Export defaults for initial setup
export {
  DEFAULT_SCHEDULE_CONFIG,
  DEFAULT_SHIFT_RULES,
  DEFAULT_PERFORMANCE_THRESHOLDS,
};
