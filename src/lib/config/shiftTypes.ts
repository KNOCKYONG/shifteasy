/**
 * Shift Type Configuration Helper
 * Loads shift types from tenant_configs
 */

import { db } from '@/db';
import { tenantConfigs } from '@/db/schema/tenant-configs';
import { eq, and } from 'drizzle-orm';

const DEFAULT_TENANT_ID = '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

export interface ConfigurableShiftType {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  allowOvertime: boolean;
}

// Default shift types (fallback)
const DEFAULT_SHIFT_TYPES: ConfigurableShiftType[] = [
  { code: 'D', name: '주간 근무', startTime: '07:00', endTime: '15:00', color: 'blue', allowOvertime: false },
  { code: 'E', name: '저녁 근무', startTime: '15:00', endTime: '23:00', color: 'amber', allowOvertime: false },
  { code: 'N', name: '야간 근무', startTime: '23:00', endTime: '07:00', color: 'indigo', allowOvertime: true },
  { code: 'O', name: '휴무', startTime: '00:00', endTime: '00:00', color: 'gray', allowOvertime: false },
];

// Color mapping for Tailwind CSS classes
const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900/10",
    border: "border-blue-200 dark:border-blue-900/30",
    text: "text-blue-700 dark:text-blue-300"
  },
  green: {
    bg: "bg-green-50 dark:bg-green-900/10",
    border: "border-green-200 dark:border-green-900/30",
    text: "text-green-700 dark:text-green-300"
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-900/10",
    border: "border-amber-200 dark:border-amber-900/30",
    text: "text-amber-700 dark:text-amber-300"
  },
  red: {
    bg: "bg-red-50 dark:bg-red-900/10",
    border: "border-red-200 dark:border-red-900/30",
    text: "text-red-700 dark:text-red-300"
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-900/10",
    border: "border-purple-200 dark:border-purple-900/30",
    text: "text-purple-700 dark:text-purple-300"
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-900/10",
    border: "border-indigo-200 dark:border-indigo-900/30",
    text: "text-indigo-700 dark:text-indigo-300"
  },
  pink: {
    bg: "bg-pink-50 dark:bg-pink-900/10",
    border: "border-pink-200 dark:border-pink-900/30",
    text: "text-pink-700 dark:text-pink-300"
  },
  gray: {
    bg: "bg-gray-50 dark:bg-gray-900/10",
    border: "border-gray-200 dark:border-gray-700",
    text: "text-gray-500 dark:text-gray-400"
  },
};

/**
 * Get shift types from tenant_configs
 */
export async function getShiftTypes(tenantId: string = DEFAULT_TENANT_ID): Promise<ConfigurableShiftType[]> {
  try {
    const result = await db.select()
      .from(tenantConfigs)
      .where(and(
        eq(tenantConfigs.tenantId, tenantId),
        eq(tenantConfigs.configKey, 'shift_types')
      ))
      .limit(1);

    if (result.length > 0 && result[0].configValue) {
      return result[0].configValue as ConfigurableShiftType[];
    }
  } catch (error) {
    console.error('Failed to load shift types:', error);
  }

  return [...DEFAULT_SHIFT_TYPES];
}

/**
 * Save shift types to tenant_configs
 */
export async function saveShiftTypes(shiftTypes: ConfigurableShiftType[], tenantId: string = DEFAULT_TENANT_ID): Promise<void> {
  await db.insert(tenantConfigs)
    .values({
      tenantId,
      configKey: 'shift_types',
      configValue: shiftTypes,
    })
    .onConflictDoUpdate({
      target: [tenantConfigs.tenantId, tenantConfigs.configKey],
      set: {
        configValue: shiftTypes,
        updatedAt: new Date(),
      },
    });
}

/**
 * Get shift type by code
 */
export async function getShiftType(code: string, tenantId: string = DEFAULT_TENANT_ID): Promise<ConfigurableShiftType | undefined> {
  const shiftTypes = await getShiftTypes(tenantId);
  return shiftTypes.find(s => s.code === code);
}

/**
 * Get colors for a shift type
 */
export async function getShiftColors(code: string, tenantId: string = DEFAULT_TENANT_ID): Promise<{ bg: string; border: string; text: string }> {
  const shiftType = await getShiftType(code, tenantId);
  if (!shiftType) return COLOR_MAP.gray;

  return COLOR_MAP[shiftType.color] || COLOR_MAP.gray;
}

/**
 * Get formatted shift options for UI components
 */
export async function getShiftOptions(tenantId: string = DEFAULT_TENANT_ID) {
  const shiftTypes = await getShiftTypes(tenantId);
  return shiftTypes.map(shift => ({
    value: shift.code,
    label: shift.name.split(' ')[0] || shift.name, // Get first word for short label
    fullName: shift.name,
    colors: COLOR_MAP[shift.color] || COLOR_MAP.gray,
    startTime: shift.startTime,
    endTime: shift.endTime,
    allowOvertime: shift.allowOvertime,
  }));
}

// Export defaults for initial setup
export { DEFAULT_SHIFT_TYPES };