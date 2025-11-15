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
  { code: 'E', name: '저녁 근무', startTime: '15:00', endTime: '23:00', color: '#fb923c', allowOvertime: false }, // orange
  { code: 'N', name: '야간 근무', startTime: '23:00', endTime: '07:00', color: '#6366f1', allowOvertime: true }, // indigo
  { code: 'A', name: '행정 근무', startTime: '09:00', endTime: '18:00', color: '#10b981', allowOvertime: false }, // green
  { code: 'O', name: '휴무', startTime: '00:00', endTime: '00:00', color: '#6b7280', allowOvertime: false }, // gray
  { code: 'V', name: '휴가', startTime: '00:00', endTime: '00:00', color: '#a855f7', allowOvertime: false }, // purple
];

// Default gray color for fallback
const DEFAULT_GRAY_HEX = '#6b7280';

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
 * Returns color object suitable for inline styles (hex only)
 */
export async function getShiftColors(
  code: string,
  tenantId: string = DEFAULT_TENANT_ID,
  departmentId?: string
): Promise<{ bg: string; border: string; text: string; hex: string }> {
  const shiftType = await getShiftType(code, tenantId, departmentId);
  const hexColor = shiftType?.color || DEFAULT_GRAY_HEX;

  const rgb = hexToRgb(hexColor);
  if (!rgb) {
    // Fallback to default gray if hex parsing fails
    const defaultRgb = hexToRgb(DEFAULT_GRAY_HEX)!;
    return {
      bg: `rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.1)`,
      border: `rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.3)`,
      text: DEFAULT_GRAY_HEX,
      hex: DEFAULT_GRAY_HEX
    };
  }

  return {
    bg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
    border: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,
    text: hexColor,
    hex: hexColor
  };
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
    const hexColor = shift.color || DEFAULT_GRAY_HEX;
    const rgb = hexToRgb(hexColor);

    let colors;
    if (rgb) {
      colors = {
        bg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
        border: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,
        text: hexColor
      };
    } else {
      // Fallback to default gray
      const defaultRgb = hexToRgb(DEFAULT_GRAY_HEX)!;
      colors = {
        bg: `rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.1)`,
        border: `rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.3)`,
        text: DEFAULT_GRAY_HEX
      };
    }

    return {
      value: shift.code,
      label: shift.name.split(' ')[0] || shift.name, // Get first word for short label
      fullName: shift.name,
      colors,
      hex: hexColor,
      startTime: shift.startTime,
      endTime: shift.endTime,
      allowOvertime: shift.allowOvertime,
    };
  });
}

// Export defaults for initial setup
export { DEFAULT_SHIFT_TYPES };
