/**
 * Utility functions to convert between UnifiedEmployee and Employee types
 */

import type { UnifiedEmployee } from "@/lib/types/unified-employee";
import type { Employee, EmployeePreferences, EmployeeAvailability } from "@/lib/scheduler/types";

/**
 * Convert UnifiedEmployee to Employee type for use with EmployeePreferencesModal
 */
export function unifiedEmployeeToEmployee(member: UnifiedEmployee): Employee {
  const workSchedule = (member as any).workSchedule || {};
  const basePreferences = member.preferences || {
    preferredShifts: [],
    avoidShifts: [],
    preferredDaysOff: [],
    maxConsecutiveDays: 5,
    preferNightShift: false,
  };

  const preferences: EmployeePreferences = {
    preferredShifts: workSchedule.preferredShifts || basePreferences.preferredShifts,
    avoidShifts: (member as any).avoidShifts || basePreferences.avoidShifts,
    preferredDaysOff: workSchedule.preferredDaysOff || basePreferences.preferredDaysOff,
    maxConsecutiveDays: workSchedule.maxConsecutiveDays || basePreferences.maxConsecutiveDays,
    preferNightShift: workSchedule.preferNightShift || basePreferences.preferNightShift,
  };

  const availability: EmployeeAvailability = member.availability || {
    availableDays: workSchedule.availableDays || [true, true, true, true, true, true, true],
    unavailableDates: workSchedule.unavailableDates || [],
    timeOffRequests: [],
  };

  const employmentType = (member as any).employmentType || member.contractType || 'full-time';
  const maxHoursPerWeek = workSchedule.maxHoursPerWeek || member.maxHoursPerWeek || 40;
  const minHoursPerWeek = workSchedule.minHoursPerWeek || member.minHoursPerWeek || 0;

  return {
    id: member.id,
    name: member.name,
    departmentId: member.departmentId || '',
    role: member.role || 'member',
    contractType: employmentType,
    maxHoursPerWeek,
    minHoursPerWeek,
    skills: member.skills || [],
    preferences,
    availability,
  };
}

/**
 * Convert any member object to Employee type safely
 */
export function toEmployee(member: any): Employee {
  const workSchedule = member?.workSchedule || {};
  const preferences: EmployeePreferences = {
    preferredShifts: workSchedule.preferredShifts || member?.preferences?.preferredShifts || [],
    avoidShifts: member?.avoidShifts || member?.preferences?.avoidShifts || [],
    preferredDaysOff: workSchedule.preferredDaysOff || member?.preferences?.preferredDaysOff || [],
    maxConsecutiveDays: workSchedule.maxConsecutiveDays || member?.preferences?.maxConsecutiveDays || 5,
    preferNightShift: workSchedule.preferNightShift || member?.preferences?.preferNightShift || false,
  };

  const availability: EmployeeAvailability = {
    availableDays: workSchedule.availableDays || member?.availability?.availableDays || [true, true, true, true, true, true, true],
    unavailableDates: workSchedule.unavailableDates || member?.availability?.unavailableDates || [],
    timeOffRequests: member?.availability?.timeOffRequests || [],
  };

  return {
    id: member?.id || '',
    name: member?.name || 'Unknown',
    departmentId: member?.departmentId || '',
    role: member?.role || 'member',
    contractType: member?.contractType || 'full-time',
    maxHoursPerWeek: workSchedule.maxHoursPerWeek || member?.maxHoursPerWeek || 40,
    minHoursPerWeek: workSchedule.minHoursPerWeek || member?.minHoursPerWeek || 0,
    skills: member?.skills || [],
    preferences,
    availability,
  };
}
