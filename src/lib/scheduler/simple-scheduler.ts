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
  shiftTypeCode?: string | null; // Config 화면의 customShiftTypes code (shift_request용)
}

export interface TeamPattern {
  pattern: string[]; // Example: ['D', 'D', 'E', 'E', 'N', 'N', 'OFF', 'OFF']
}

export interface ScheduleAssignment {
  date: string; // YYYY-MM-DD
  employeeId: string;
  shift: 'D' | 'E' | 'N' | 'A' | 'OFF'; // A = 행정 근무 (평일 근무자용)
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
  private schedule: Map<string, Map<string, 'D' | 'E' | 'N' | 'A' | 'OFF'>>; // date -> employeeId -> shift
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
   * Step 1: Calculate work days
   * 3교대는 주말을 포함한 모든 날짜에 근무 배정이 필요합니다.
   * 주말과 공휴일에는 최소 인원만 배치됩니다.
   */
  private calculateWorkDays(): void {
    const startDate = startOfMonth(new Date(this.config.year, this.config.month - 1));
    const endDate = endOfMonth(startDate);

    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    // 모든 날짜를 workDays에 포함 (주말, 공휴일 모두 근무 배정 필요)
    this.workDays = allDays;

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
          // Assign specific shift for shift_request
          else if (request.requestType === 'shift_request' && request.shiftTypeCode) {
            const mappedShift = this.mapShiftCode(request.shiftTypeCode);
            daySchedule.set(request.employeeId, mappedShift);
          }
        }
      }
    }
  }

  /**
   * Map custom shift type code to standard shift type (D, E, N, OFF)
   */
  private mapShiftCode(code: string): 'D' | 'E' | 'N' | 'OFF' {
    switch (code.toUpperCase()) {
      case 'D':
        return 'D';
      case 'E':
        return 'E';
      case 'N':
        return 'N';
      case 'O': // 휴무
        return 'OFF';
      default:
        // 기타 커스텀 코드(교육 등)는 OFF로 처리
        return 'OFF';
    }
  }

  /**
   * Step 3: Assign shifts with work pattern type consideration
   * 근무 패턴에 따라 다르게 배치:
   * - weekday-only: 평일에만 A(행정) 근무
   * - three-shift: D, E, N 시프트 순환
   * - night-intensive: 야간 위주
   */
  private assignPreferredPatterns(): void {
    const requiredPerShift = this.config.requiredStaffPerShift || { D: 5, E: 4, N: 3 };
    const holidaySet = new Set(this.config.holidays.map(h => h.date));

    // Track OFF count per employee for fair distribution
    const offCounts = new Map<string, number>();
    this.config.employees.forEach(emp => offCounts.set(emp.id, 0));

    // Separate employees by work pattern type
    const weekdayOnlyEmployees = this.config.employees.filter(
      emp => emp.workPatternType === 'weekday-only'
    );
    const shiftEmployees = this.config.employees.filter(
      emp => emp.workPatternType !== 'weekday-only'
    );

    console.log(`👥 Employee breakdown: ${weekdayOnlyEmployees.length} 평일근무, ${shiftEmployees.length} 교대근무`);

    for (const day of this.workDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const daySchedule = this.schedule.get(dateStr);
      if (!daySchedule) continue;

      // Check if weekend or holiday
      const isWeekendDay = isWeekend(day);
      const isHoliday = holidaySet.has(dateStr);
      const isSpecialDay = isWeekendDay || isHoliday;
      const isWeekday = !isWeekendDay;

      // 1. 평일 근무자 처리
      for (const emp of weekdayOnlyEmployees) {
        if (daySchedule.has(emp.id)) continue; // Already assigned by special request

        if (isWeekday && !isHoliday) {
          // 평일(공휴일 제외): A(행정) 근무 배치
          daySchedule.set(emp.id, 'A');
        } else {
          // 주말 또는 공휴일: OFF
          daySchedule.set(emp.id, 'OFF');
          offCounts.set(emp.id, (offCounts.get(emp.id) || 0) + 1);
        }
      }

      // 2. 교대 근무자 처리 (3교대, 나이트 집중)
      const unassignedShiftEmployees = shiftEmployees.filter(
        emp => !daySchedule.has(emp.id)
      );

      // Assign D shift with experience balance
      this.assignShiftWithExperienceBalance(
        unassignedShiftEmployees,
        daySchedule,
        'D',
        requiredPerShift.D,
        isSpecialDay
      );

      // Assign E shift with experience balance
      const afterD = unassignedShiftEmployees.filter(emp => !daySchedule.has(emp.id));
      this.assignShiftWithExperienceBalance(
        afterD,
        daySchedule,
        'E',
        requiredPerShift.E,
        isSpecialDay
      );

      // Assign N shift with experience balance
      const afterE = afterD.filter(emp => !daySchedule.has(emp.id));
      this.assignShiftWithExperienceBalance(
        afterE,
        daySchedule,
        'N',
        requiredPerShift.N,
        isSpecialDay
      );

      // Remaining shift employees get OFF
      const remaining = afterE.filter(emp => !daySchedule.has(emp.id));
      remaining.forEach(emp => {
        daySchedule.set(emp.id, 'OFF');
        offCounts.set(emp.id, (offCounts.get(emp.id) || 0) + 1);
      });
    }

    console.log('📊 OFF distribution:', Array.from(offCounts.entries()).map(([id, count]) => {
      const emp = this.config.employees.find(e => e.id === id);
      return `${emp?.name} (${emp?.workPatternType || '3교대'}): ${count}일`;
    }));
  }

  /**
   * Helper: Assign shift with experience level balance
   * 경력별 균형을 고려하여 신입이 몰리지 않도록 배치
   */
  private assignShiftWithExperienceBalance(
    employees: Employee[],
    daySchedule: Map<string, 'D' | 'E' | 'N' | 'OFF' | 'A'>,
    shift: 'D' | 'E' | 'N',
    requiredCount: number,
    isSpecialDay: boolean
  ): void {
    // Filter unassigned employees
    const available = employees.filter(emp => !daySchedule.has(emp.id));

    // Sort by experience (senior first) and preference
    const sorted = available.sort((a, b) => {
      // Experience level priority (senior > mid > junior)
      const aExp = this.getExperienceScore(a);
      const bExp = this.getExperienceScore(b);
      if (aExp !== bExp) return bExp - aExp; // Higher experience first

      // Then by shift preference
      const aPref = this.getShiftPreference(a, shift);
      const bPref = this.getShiftPreference(b, shift);
      if (aPref !== bPref) return bPref - aPref;

      // Then by role (RN > CN > SN > NA)
      const roleOrder: Record<string, number> = { RN: 4, CN: 3, SN: 2, NA: 1 };
      return (roleOrder[b.role] || 0) - (roleOrder[a.role] || 0);
    });

    let assigned = 0;
    const experienceLevels = new Map<string, number>(); // Track experience distribution

    // Assign with experience balance
    for (const employee of sorted) {
      if (assigned >= requiredCount) break;

      const expLevel = employee.experienceLevel || 'junior';
      const currentExpCount = experienceLevels.get(expLevel) || 0;

      // Calculate target distribution (aim for proportional distribution)
      const targetExpCount = Math.ceil(requiredCount / 3); // Rough balance

      // Prefer balanced distribution
      if (currentExpCount < targetExpCount || assigned < requiredCount) {
        daySchedule.set(employee.id, shift);
        experienceLevels.set(expLevel, currentExpCount + 1);
        assigned++;
      }
    }

    // Fill remaining slots if needed
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
   * Get experience score for sorting (higher = more senior)
   */
  private getExperienceScore(employee: Employee): number {
    const level = (employee.experienceLevel || 'junior').toLowerCase();
    if (level.includes('senior') || level.includes('expert')) return 3;
    if (level.includes('mid') || level.includes('intermediate')) return 2;
    return 1; // junior or default
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
