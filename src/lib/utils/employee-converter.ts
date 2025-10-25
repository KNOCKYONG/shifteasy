/**
 * Utility functions to convert between UnifiedEmployee and Employee types
 */

import type { UnifiedEmployee } from "@/lib/types/unified-employee";
import type { Employee, EmployeePreferences, EmployeeAvailability } from "@/lib/scheduler/types";

/**
 * Convert UnifiedEmployee to Employee type for use with EmployeePreferencesModal
 */
export function unifiedEmployeeToEmployee(member: UnifiedEmployee): Employee {
  // UnifiedEmployee already extends Employee, so we can use it directly
  // Just ensure all required fields are present with defaults
  return {
    id: member.id,
    name: member.name,
    departmentId: member.departmentId || '',
    role: member.role || 'member',
    contractType: member.contractType || 'full-time',
    maxHoursPerWeek: member.maxHoursPerWeek || 40,
    minHoursPerWeek: member.minHoursPerWeek || 0,
    skills: member.skills || [],
    preferences: member.preferences || {
      preferredShifts: [],
      avoidShifts: [],
      preferredDaysOff: [],
      maxConsecutiveDays: 5,
      preferNightShift: false,
    },
    availability: member.availability || {
      availableDays: [true, true, true, true, true, true, true],
      unavailableDates: [],
      timeOffRequests: [],
    },
  };
}

/**
 * Convert any member object to Employee type safely
 */
export function toEmployee(member: any): Employee {
  const preferences: EmployeePreferences = {
    preferredShifts: member?.workSchedule?.preferredShifts || member?.preferences?.preferredShifts || [],
    avoidShifts: member?.avoidShifts || member?.preferences?.avoidShifts || [],
    preferredDaysOff: member?.workSchedule?.preferredDaysOff || member?.preferences?.preferredDaysOff || [],
    maxConsecutiveDays: member?.workSchedule?.maxConsecutiveDays || member?.preferences?.maxConsecutiveDays || 5,
    preferNightShift: member?.workSchedule?.preferNightShift || member?.preferences?.preferNightShift || false,
  };

  const availability: EmployeeAvailability = {
    availableDays: member?.workSchedule?.availableDays || member?.availability?.availableDays || [true, true, true, true, true, true, true],
    unavailableDates: member?.workSchedule?.unavailableDates || member?.availability?.unavailableDates || [],
    timeOffRequests: member?.availability?.timeOffRequests || [],
  };

  return {
    id: member?.id || '',
    name: member?.name || 'Unknown',
    departmentId: member?.departmentId || '',
    role: member?.role || 'member',
    contractType: 'full-time',
    maxHoursPerWeek: member?.workSchedule?.maxHoursPerWeek || 40,
    minHoursPerWeek: member?.workSchedule?.minHoursPerWeek || 0,
    skills: member?.skills || [],
    preferences,
    availability,
  };
}
