/**
 * Utility functions to convert between Staff and Employee types
 */

import type { Staff } from "@/lib/types";
import type { Employee, EmployeePreferences, EmployeeAvailability } from "@/lib/scheduler/types";

/**
 * Convert Staff type to Employee type for use with EmployeePreferencesModal
 */
export function staffToEmployee(staff: Staff): Employee {
  // Extract preferences if they exist
  const preferences: EmployeePreferences = {
    preferredShifts: [],
    avoidShifts: [],
    preferredDaysOff: [],
    maxConsecutiveDays: 5,
    preferNightShift: false,
  };

  // Default availability
  const availability: EmployeeAvailability = {
    availableDays: [true, true, true, true, true, true, true], // All days available by default
    unavailableDates: [],
    timeOffRequests: [],
  };

  return {
    id: staff.id,
    name: staff.name,
    departmentId: staff.wardId || '', // Map wardId to departmentId
    role: staff.role,
    workPatternType: 'three-shift',
  };
}

/**
 * Convert Employee preferences back to Staff format for saving
 */
export function employeePreferencesToStaffPreferences(
  employeeId: string,
  preferences: Partial<EmployeePreferences>
): any {
  // This will be used to save to the database
  // Format will depend on your preference schema
  return {
    staffId: employeeId,
    preferredShifts: preferences.preferredShifts || [],
    avoidShifts: preferences.avoidShifts || [],
    preferredDaysOff: preferences.preferredDaysOff || [],
    maxConsecutiveDays: preferences.maxConsecutiveDays || 5,
    preferNightShift: preferences.preferNightShift || false,
  };
}
