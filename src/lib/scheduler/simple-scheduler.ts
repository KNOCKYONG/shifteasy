/**
 * SimpleScheduler - Sequential Schedule Generation
 *
 * 순차적 스케줄 생성 알고리즘:
 * 1. 근무일 계산 (전체 일수 - 주말 - 법정 공휴일)
 * 2. 개인 특별 요청 선분배
 * 3. 개인 선호 패턴 분배 (직급 간 매칭 고려)
 * 4. 팀 패턴으로 공백 채우기
 */

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';

export interface Employee {
  id: string;
  name: string;
  role: 'RN' | 'CN' | 'SN' | 'NA';
  experienceLevel?: string;
  workPatternType?: 'three-shift' | 'night-intensive' | 'weekday-only';
  preferredShiftTypes?: {
    D?: number;
    E?: number;
    N?: number;
  };
  maxConsecutiveDaysPreferred?: number;
  maxConsecutiveNightsPreferred?: number;
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

export interface SpecialRequest {
  employeeId: string;
  requestType: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
}

export interface TeamPattern {
  pattern: string[]; // Example: ['D', 'D', 'E', 'E', 'N', 'N', 'OFF', 'OFF']
}

export interface ScheduleAssignment {
  date: string; // YYYY-MM-DD
  employeeId: string;
  shift: 'D' | 'E' | 'N' | 'OFF';
}

export interface SimpleSchedulerConfig {
  year: number;
  month: number; // 1-12
  employees: Employee[];
  holidays: Holiday[];
  specialRequests: SpecialRequest[];
  teamPattern?: TeamPattern;
  requiredStaffPerShift?: {
    D: number;
    E: number;
    N: number;
  };
}

export class SimpleScheduler {
  private config: SimpleSchedulerConfig;
  private workDays: Date[];
  private schedule: Map<string, Map<string, 'D' | 'E' | 'N' | 'OFF'>>; // date -> employeeId -> shift
  private roleRatios: Map<string, number>; // role -> count

  constructor(config: SimpleSchedulerConfig) {
    this.config = config;
    this.workDays = [];
    this.schedule = new Map();
    this.roleRatios = this.calculateRoleRatios();
  }

  /**
   * Main scheduling method
   */
  public async generate(): Promise<ScheduleAssignment[]> {
    // Step 1: Calculate work days
    this.calculateWorkDays();

    // Step 2: Assign special requests
    this.assignSpecialRequests();

    // Step 3: Assign preferred patterns with role ratio matching
    this.assignPreferredPatterns();

    // Step 4: Fill gaps with team pattern
    this.assignTeamPattern();

    // Convert to array format
    return this.convertToAssignments();
  }

  /**
   * Step 1: Calculate work days (total days - weekends - holidays)
   */
  private calculateWorkDays(): void {
    const startDate = startOfMonth(new Date(this.config.year, this.config.month - 1));
    const endDate = endOfMonth(startDate);

    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    const holidaySet = new Set(this.config.holidays.map(h => h.date));

    this.workDays = allDays.filter(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const isHoliday = holidaySet.has(dateStr);
      const isWeekendDay = isWeekend(day);

      return !isWeekendDay && !isHoliday;
    });

    // Initialize schedule map for all days
    allDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      this.schedule.set(dateStr, new Map());
    });
  }

  /**
   * Step 2: Assign special requests first (highest priority)
   */
  private assignSpecialRequests(): void {
    for (const request of this.config.specialRequests) {
      const startDate = new Date(request.startDate);
      const endDate = request.endDate ? new Date(request.endDate) : startDate;

      const requestDays = eachDayOfInterval({ start: startDate, end: endDate });

      for (const day of requestDays) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const daySchedule = this.schedule.get(dateStr);

        if (daySchedule) {
          // Assign OFF for vacation/day_off requests
          if (request.requestType === 'vacation' || request.requestType === 'day_off') {
            daySchedule.set(request.employeeId, 'OFF');
          }
        }
      }
    }
  }

  /**
   * Step 3: Assign based on individual preferences with role ratio matching
   */
  private assignPreferredPatterns(): void {
    const requiredPerShift = this.config.requiredStaffPerShift || { D: 3, E: 3, N: 2 };

    for (const day of this.workDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const daySchedule = this.schedule.get(dateStr);
      if (!daySchedule) continue;

      // Count current assignments by shift
      const shiftCounts = { D: 0, E: 0, N: 0 };
      const rolesByShift = {
        D: new Map<string, number>(),
        E: new Map<string, number>(),
        N: new Map<string, number>(),
      };

      // Get unassigned employees
      const unassignedEmployees = this.config.employees.filter(
        emp => !daySchedule.has(emp.id)
      );

      // Assign D shift
      this.assignShiftWithRoleBalance(
        unassignedEmployees,
        daySchedule,
        'D',
        requiredPerShift.D,
        rolesByShift.D
      );

      // Assign E shift
      const afterD = unassignedEmployees.filter(emp => !daySchedule.has(emp.id));
      this.assignShiftWithRoleBalance(
        afterD,
        daySchedule,
        'E',
        requiredPerShift.E,
        rolesByShift.E
      );

      // Assign N shift
      const afterE = unassignedEmployees.filter(emp => !daySchedule.has(emp.id));
      this.assignShiftWithRoleBalance(
        afterE,
        daySchedule,
        'N',
        requiredPerShift.N,
        rolesByShift.N
      );

      // Remaining employees get OFF
      const remaining = unassignedEmployees.filter(emp => !daySchedule.has(emp.id));
      remaining.forEach(emp => daySchedule.set(emp.id, 'OFF'));
    }
  }

  /**
   * Helper: Assign shift with role balance consideration
   */
  private assignShiftWithRoleBalance(
    employees: Employee[],
    daySchedule: Map<string, 'D' | 'E' | 'N' | 'OFF'>,
    shift: 'D' | 'E' | 'N',
    requiredCount: number,
    roleCount: Map<string, number>
  ): void {
    // Sort by preference for this shift
    const sorted = employees
      .filter(emp => !daySchedule.has(emp.id))
      .sort((a, b) => {
        const aPref = this.getShiftPreference(a, shift);
        const bPref = this.getShiftPreference(b, shift);
        return bPref - aPref;
      });

    let assigned = 0;

    // Try to maintain role ratio
    for (const employee of sorted) {
      if (assigned >= requiredCount) break;

      const currentRoleCount = roleCount.get(employee.role) || 0;
      const targetRoleCount = Math.ceil(requiredCount * (this.roleRatios.get(employee.role) || 0));

      // Prefer assigning if we haven't met role target yet
      if (currentRoleCount < targetRoleCount || assigned < requiredCount) {
        daySchedule.set(employee.id, shift);
        roleCount.set(employee.role, currentRoleCount + 1);
        assigned++;
      }
    }

    // If we still need more staff, assign regardless of ratio
    if (assigned < requiredCount) {
      for (const employee of sorted) {
        if (assigned >= requiredCount) break;
        if (!daySchedule.has(employee.id)) {
          daySchedule.set(employee.id, shift);
          assigned++;
        }
      }
    }
  }

  /**
   * Get preference score for a shift
   */
  private getShiftPreference(employee: Employee, shift: 'D' | 'E' | 'N'): number {
    if (!employee.preferredShiftTypes) return 5; // neutral

    return employee.preferredShiftTypes[shift] || 5;
  }

  /**
   * Step 4: Fill remaining gaps with team pattern
   */
  private assignTeamPattern(): void {
    if (!this.config.teamPattern) return;

    const pattern = this.config.teamPattern.pattern;
    let patternIndex = 0;

    for (const day of this.workDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const daySchedule = this.schedule.get(dateStr);
      if (!daySchedule) continue;

      // Check if any employee is still unassigned
      for (const employee of this.config.employees) {
        if (!daySchedule.has(employee.id)) {
          const shiftFromPattern = pattern[patternIndex % pattern.length];
          if (shiftFromPattern === 'D' || shiftFromPattern === 'E' || shiftFromPattern === 'N' || shiftFromPattern === 'OFF') {
            daySchedule.set(employee.id, shiftFromPattern);
          }
        }
      }

      patternIndex++;
    }
  }

  /**
   * Calculate role ratios based on employee composition
   */
  private calculateRoleRatios(): Map<string, number> {
    const ratios = new Map<string, number>();
    const roleCounts = new Map<string, number>();
    const total = this.config.employees.length;

    for (const emp of this.config.employees) {
      const count = roleCounts.get(emp.role) || 0;
      roleCounts.set(emp.role, count + 1);
    }

    for (const [role, count] of roleCounts.entries()) {
      ratios.set(role, count / total);
    }

    return ratios;
  }

  /**
   * Convert schedule map to array format
   */
  private convertToAssignments(): ScheduleAssignment[] {
    const assignments: ScheduleAssignment[] = [];

    for (const [date, daySchedule] of this.schedule.entries()) {
      for (const [employeeId, shift] of daySchedule.entries()) {
        assignments.push({
          date,
          employeeId,
          shift,
        });
      }
    }

    return assignments;
  }

  /**
   * Get schedule statistics for logging
   */
  public getStatistics(): {
    totalWorkDays: number;
    totalAssignments: number;
    shiftDistribution: Record<string, number>;
    roleDistribution: Record<string, number>;
  } {
    const shiftDist: Record<string, number> = { D: 0, E: 0, N: 0, OFF: 0 };
    const roleDist: Record<string, number> = {};

    for (const [, daySchedule] of this.schedule.entries()) {
      for (const [employeeId, shift] of daySchedule.entries()) {
        shiftDist[shift] = (shiftDist[shift] || 0) + 1;

        const employee = this.config.employees.find(e => e.id === employeeId);
        if (employee) {
          roleDist[employee.role] = (roleDist[employee.role] || 0) + 1;
        }
      }
    }

    return {
      totalWorkDays: this.workDays.length,
      totalAssignments: Array.from(this.schedule.values()).reduce(
        (sum, day) => sum + day.size,
        0
      ),
      shiftDistribution: shiftDist,
      roleDistribution: roleDist,
    };
  }
}
