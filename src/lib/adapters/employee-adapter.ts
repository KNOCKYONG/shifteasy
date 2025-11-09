/**
 * Employee 데이터 모델 간 변환 어댑터 (간소화됨)
 */

import type { Employee, EmployeePreferences, EmployeeAvailability } from '@/lib/scheduler/types';
import type { SimplifiedPreferences } from '@/components/department/MyPreferencesPanel';
import type { UnifiedEmployee, EmployeeStatistics } from '@/lib/types/unified-employee';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  departmentId?: string;
  departmentName?: string;
  role?: string;
  status?: string;
  skills?: string[];
  joinedAt?: string;
  avatar?: string;
  workSchedule?: {
    preferredShifts?: string[];
    maxHoursPerWeek?: number;
    minHoursPerWeek?: number;
    availableDays?: number[];
    unavailableDates?: string[];
  };
}

/**
 * 다양한 Employee 형식 간 변환을 담당하는 어댑터 (간소화됨)
 */
export class EmployeeAdapter {
  /**
   * TeamMember를 UnifiedEmployee로 변환
   */
  static fromMockToUnified(
    member: TeamMember,
    simplifiedPrefs?: SimplifiedPreferences,
    statistics?: EmployeeStatistics
  ): UnifiedEmployee {
    return {
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone || '',
      position: member.position || '',
      department: member.departmentName || member.department || '',
      departmentId: member.departmentId || '',
      role: member.role === 'admin' ? 'admin' : member.role === 'manager' ? 'manager' : 'staff',
      contractType: 'full-time' as any,
      status: member.status as any || 'active',
      joinDate: member.joinedAt || new Date().toISOString(),
      avatar: member.avatar || '',
      maxHoursPerWeek: member.workSchedule?.maxHoursPerWeek || 40,
      minHoursPerWeek: member.workSchedule?.minHoursPerWeek || 30,
      skills: member.skills || [],
      preferences: {
        preferredShifts: (member.workSchedule?.preferredShifts || []) as any,
        avoidShifts: [],
        preferredDaysOff: [0, 6],
        maxConsecutiveDays: 5,
        preferNightShift: (member.workSchedule?.preferredShifts || []).includes('night')
      },
      availability: {
        availableDays: [true, true, true, true, true, true, false],
        unavailableDates: [],
        timeOffRequests: [],
      },
      simplifiedPreferences: simplifiedPrefs,
      statistics,
      specialRequests: [],
    };
  }

  /**
   * UnifiedEmployee를 스케줄러용 Employee로 변환
   */
  static toSchedulerEmployee(unified: UnifiedEmployee): Employee {
    const preferences = unified.simplifiedPreferences
      ? this.convertSimplifiedToBasic(unified.simplifiedPreferences)
      : unified.preferences;

    let workPatternType: 'three-shift' | 'night-intensive' | 'weekday-only' | undefined;

    if (unified.simplifiedPreferences) {
      workPatternType = unified.simplifiedPreferences.workPatternType;
    }

    return {
      id: unified.id,
      name: unified.name,
      departmentId: unified.departmentId,
      role: unified.position,
      contractType: unified.contractType,
      maxHoursPerWeek: unified.maxHoursPerWeek,
      minHoursPerWeek: unified.minHoursPerWeek,
      skills: unified.skills,
      preferences,
      availability: unified.availability,
      workPatternType,
    };
  }

  /**
   * SimplifiedPreferences를 기본 EmployeePreferences로 변환
   */
  static convertSimplifiedToBasic(
    simplified: SimplifiedPreferences
  ): EmployeePreferences {
    return {
      preferredShifts: [],
      avoidShifts: [],
      preferredDaysOff: [0, 6],
      maxConsecutiveDays: 5,
      preferNightShift: false,
      preferredPatterns: simplified.preferredPatterns?.map(p => p.pattern),
      avoidPatterns: simplified.avoidPatterns,
    };
  }

  /**
   * 통계 정보 계산 (스케줄 기반)
   */
  static calculateStatistics(
    employeeId: string,
    assignments: any[],
    shifts: any[]
  ): EmployeeStatistics {
    const employeeAssignments = assignments.filter(a => a.employeeId === employeeId);

    const totalHours = employeeAssignments.reduce((sum, assignment) => {
      const shift = shifts.find(s => s.id === assignment.shiftId);
      return sum + (shift?.time.hours || 0);
    }, 0);

    const nightShifts = employeeAssignments.filter(a => {
      const shift = shifts.find(s => s.id === a.shiftId);
      return shift?.type === 'night';
    }).length;

    const weekendShifts = employeeAssignments.filter(a => {
      const day = new Date(a.date).getDay();
      return day === 0 || day === 6;
    }).length;

    const consecutiveDays = this.calculateConsecutiveDays(employeeAssignments);
    const lastDayOff = this.findLastDayOff(employeeAssignments);

    return {
      totalHoursThisMonth: totalHours,
      averageHoursPerWeek: totalHours / 4,
      nightShiftsCount: nightShifts,
      weekendShiftsCount: weekendShifts,
      consecutiveDaysWorked: consecutiveDays,
      lastDayOff: lastDayOff,
      overtimeHours: Math.max(0, totalHours - 160),
      preferenceMatchRate: 75,
      fairnessScore: 85,
    };
  }

  private static calculateConsecutiveDays(assignments: any[]): number {
    if (assignments.length === 0) return 0;

    const sorted = [...assignments].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let maxConsecutive = 1;
    let currentConsecutive = 1;

    for (let i = 1; i < sorted.length; i++) {
      const prevDate = new Date(sorted[i - 1].date);
      const currDate = new Date(sorted[i].date);
      const dayDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (dayDiff === 1) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 1;
      }
    }

    return maxConsecutive;
  }

  private static findLastDayOff(assignments: any[]): Date {
    if (assignments.length === 0) return new Date();

    const sorted = [...assignments].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const latestWork = new Date(sorted[0].date);
    const today = new Date();

    if (latestWork < today) {
      return today;
    }

    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = new Date(sorted[i].date);
      const next = new Date(sorted[i + 1].date);
      const dayDiff = Math.floor((curr.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));

      if (dayDiff > 1) {
        const dayOff = new Date(next);
        dayOff.setDate(dayOff.getDate() + 1);
        return dayOff;
      }
    }

    const oldestWork = new Date(sorted[sorted.length - 1].date);
    const dayBefore = new Date(oldestWork);
    dayBefore.setDate(dayBefore.getDate() - 1);
    return dayBefore;
  }

  /**
   * 일괄 변환 유틸리티
   */
  static batchConvert(
    members: TeamMember[],
    preferencesMap?: Map<string, SimplifiedPreferences>
  ): UnifiedEmployee[] {
    return members.map(member => {
      const prefs = preferencesMap?.get(member.id);
      return this.fromMockToUnified(member, prefs);
    });
  }

  /**
   * 검증 유틸리티
   */
  static validateEmployee(employee: Partial<UnifiedEmployee>): string[] {
    const errors: string[] = [];

    if (!employee.id) errors.push('ID는 필수입니다');
    if (!employee.name) errors.push('이름은 필수입니다');
    if (!employee.email) errors.push('이메일은 필수입니다');
    if (!employee.departmentId) errors.push('부서 ID는 필수입니다');

    if (employee.maxHoursPerWeek && employee.minHoursPerWeek) {
      if (employee.maxHoursPerWeek < employee.minHoursPerWeek) {
        errors.push('최대 근무시간은 최소 근무시간보다 커야 합니다');
      }
    }

    if (employee.maxHoursPerWeek && employee.maxHoursPerWeek > 52) {
      errors.push('주당 최대 근무시간은 52시간을 초과할 수 없습니다');
    }

    return errors;
  }
}
