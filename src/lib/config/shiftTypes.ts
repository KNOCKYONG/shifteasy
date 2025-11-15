/**
 * Shift Type Configuration Helper
 * Loads shift types from configs
 */

import { db } from '@/db';
import { configs } from '@/db/schema/configs';
import { eq, and, isNull } from 'drizzle-orm';

const DEFAULT_TENANT_ID = '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

export interface ConfigurableShiftType {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  allowOvertime: boolean;
}

// Default shift types (fallback) with distinct hex colors
const DEFAULT_SHIFT_TYPES: ConfigurableShiftType[] = [
  { code: 'D', name: '주간 근무', startTime: '07:00', endTime: '15:00', color: '#3b82f6', allowOvertime: false }, // blue
  { code: 'E', name: '저녁 근무', startTime: '15:00', endTime: '23:00', color: '#f59e0b', allowOvertime: false }, // amber
  { code: 'N', name: '야간 근무', startTime: '23:00', endTime: '07:00', color: '#6366f1', allowOvertime: true }, // indigo
  { code: 'A', name: '행정 근무', startTime: '09:00', endTime: '18:00', color: '#10b981', allowOvertime: false }, // green
  { code: 'O', name: '휴무', startTime: '00:00', endTime: '00:00', color: '#6b7280', allowOvertime: false }, // gray
  { code: 'V', name: '휴가', startTime: '00:00', endTime: '00:00', color: '#a855f7', allowOvertime: false }, // purple
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
 * Get shift types from configs (supports department-level override)
 * Automatically creates default config with department_id if not exists
 */
export async function getShiftTypes(
  tenantId: string = DEFAULT_TENANT_ID,
  departmentId?: string
): Promise<ConfigurableShiftType[]> {
  try {
    console.log(`[getShiftTypes] Called with tenantId: ${tenantId}, departmentId: ${departmentId}`);

    // Try department-specific config first if departmentId provided
    if (departmentId) {
      const deptResult = await db.select()
        .from(configs)
        .where(and(
          eq(configs.tenantId, tenantId),
          eq(configs.departmentId, departmentId),
          eq(configs.configKey, 'shift_types')
        ))
        .limit(1);

      console.log(`[getShiftTypes] Department query result count: ${deptResult.length}`);

      if (deptResult.length > 0 && deptResult[0].configValue) {
        const shiftTypes = deptResult[0].configValue as ConfigurableShiftType[];
        console.log(`[getShiftTypes] Returning department shift_types:`, shiftTypes.map(st => st.code));
        return shiftTypes;
      }

      // Department config not found - create default for this department
      console.log(`[getShiftTypes] Creating default shift_types for department ${departmentId}`);
      await saveShiftTypes([...DEFAULT_SHIFT_TYPES], tenantId, departmentId);
      return [...DEFAULT_SHIFT_TYPES];
    }

    // Fallback to tenant-level config
    const result = await db.select()
      .from(configs)
      .where(and(
        eq(configs.tenantId, tenantId),
        isNull(configs.departmentId),
        eq(configs.configKey, 'shift_types')
      ))
      .limit(1);

    if (result.length > 0 && result[0].configValue) {
      return result[0].configValue as ConfigurableShiftType[];
    }

    // Tenant-level config not found - create default for tenant
    console.log(`Creating default shift_types for tenant ${tenantId}`);
    await saveShiftTypes([...DEFAULT_SHIFT_TYPES], tenantId);
    return [...DEFAULT_SHIFT_TYPES];
  } catch (error) {
    console.error('Failed to load shift types:', error);
    return [...DEFAULT_SHIFT_TYPES];
  }
}

/**
 * Save shift types to configs (supports department-level)
 */
export async function saveShiftTypes(
  shiftTypes: ConfigurableShiftType[],
  tenantId: string = DEFAULT_TENANT_ID,
  departmentId?: string
): Promise<void> {
  await db.insert(configs)
    .values({
      tenantId,
      departmentId: departmentId || null,
      configKey: 'shift_types',
      configValue: shiftTypes,
    })
    .onConflictDoUpdate({
      target: [configs.tenantId, configs.departmentId, configs.configKey],
      set: {
        configValue: shiftTypes,
        updatedAt: new Date(),
      },
    });
}

/**
 * Get shift type by code
 */
export async function getShiftType(
  code: string,
  tenantId: string = DEFAULT_TENANT_ID,
  departmentId?: string
): Promise<ConfigurableShiftType | undefined> {
  const shiftTypes = await getShiftTypes(tenantId, departmentId);
  return shiftTypes.find(s => s.code === code);
}

/**
 * Convert hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Get colors for a shift type
 * Returns color object suitable for inline styles or Tailwind classes
 */
export async function getShiftColors(
  code: string,
  tenantId: string = DEFAULT_TENANT_ID,
  departmentId?: string
): Promise<{ bg: string; border: string; text: string; hex?: string }> {
  const shiftType = await getShiftType(code, tenantId, departmentId);
  if (!shiftType) return COLOR_MAP.gray;

  // If color is a hex code, return inline style values
  if (shiftType.color.startsWith('#')) {
    const rgb = hexToRgb(shiftType.color);
    if (rgb) {
      return {
        bg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
        border: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,
        text: shiftType.color,
        hex: shiftType.color
      };
    }
  }

  // Legacy color name support
  return COLOR_MAP[shiftType.color] || COLOR_MAP.gray;
}

/**
 * Get formatted shift options for UI components
 */
export async function getShiftOptions(
  tenantId: string = DEFAULT_TENANT_ID,
  departmentId?: string
) {
  const shiftTypes = await getShiftTypes(tenantId, departmentId);
  return shiftTypes.map(shift => {
    let colors;
    // Handle hex colors
    if (shift.color.startsWith('#')) {
      const rgb = hexToRgb(shift.color);
      if (rgb) {
        colors = {
          bg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
          border: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,
          text: shift.color
        };
      } else {
        colors = COLOR_MAP.gray;
      }
    } else {
      // Legacy color name support
      colors = COLOR_MAP[shift.color] || COLOR_MAP.gray;
    }

    return {
      value: shift.code,
      label: shift.name.split(' ')[0] || shift.name, // Get first word for short label
      fullName: shift.name,
      colors,
      hex: shift.color.startsWith('#') ? shift.color : undefined,
      startTime: shift.startTime,
      endTime: shift.endTime,
      allowOvertime: shift.allowOvertime,
    };
  });
}

// Export defaults for initial setup
export { DEFAULT_SHIFT_TYPES };
