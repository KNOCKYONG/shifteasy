/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Utility functions to convert between UnifiedEmployee and Employee types
 */

import type { UnifiedEmployee } from "@/lib/types/unified-employee";
import type { Employee, EmployeePreferences, EmployeeAvailability } from "@/lib/types/scheduler";

/**
 * Convert UnifiedEmployee to Employee type for use with EmployeePreferencesModal
 */
export function unifiedEmployeeToEmployee(member: UnifiedEmployee): Employee {
  return {
    id: member.id,
    name: member.name,
    departmentId: member.departmentId || '',
    role: member.role || 'member',
    workPatternType: member.workPatternType || 'three-shift',
  };
}

/**
 * Convert any member object to Employee type safely
 */
export function toEmployee(member: any): Employee {
  return {
    id: member?.id || '',
    name: member?.name || 'Unknown',
    departmentId: member?.departmentId || '',
    role: member?.role || 'member',
    workPatternType: member?.workPatternType || 'three-shift',
  } as any;
}
