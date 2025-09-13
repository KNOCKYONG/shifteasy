/**
 * 시프트 패턴 관리 시스템
 */

import {
  ShiftPattern,
  ShiftType,
  Employee,
  ScheduleAssignment,
  Shift,
} from './types';

// 사전 정의된 패턴 템플릿
export const PREDEFINED_PATTERNS: ShiftPattern[] = [
  {
    id: 'pattern-2shift-basic',
    name: '2교대 기본',
    description: '주간/야간 2교대 패턴 (7일 주기)',
    type: '2-shift',
    cycleLength: 14,
    shifts: [
      'day', 'day', 'day', 'day', 'off', 'off', 'off',
      'night', 'night', 'night', 'night', 'off', 'off', 'off',
    ],
    minStaffPerShift: {
      day: 3,
      night: 2,
      evening: 0,
      off: 0,
      leave: 0,
      custom: 0,
    },
  },
  {
    id: 'pattern-2shift-compressed',
    name: '2교대 압축',
    description: '12시간 압축 2교대 패턴',
    type: '2-shift',
    cycleLength: 8,
    shifts: [
      'day', 'day', 'off', 'off',
      'night', 'night', 'off', 'off',
    ],
    minStaffPerShift: {
      day: 4,
      night: 3,
      evening: 0,
      off: 0,
      leave: 0,
      custom: 0,
    },
  },
  {
    id: 'pattern-3shift-basic',
    name: '3교대 기본',
    description: '주간/저녁/야간 3교대 패턴 (21일 주기)',
    type: '3-shift',
    cycleLength: 21,
    shifts: [
      // Week 1: 주간
      'day', 'day', 'day', 'day', 'day', 'off', 'off',
      // Week 2: 저녁
      'evening', 'evening', 'evening', 'evening', 'evening', 'off', 'off',
      // Week 3: 야간
      'night', 'night', 'night', 'night', 'night', 'off', 'off',
    ],
    minStaffPerShift: {
      day: 3,
      evening: 3,
      night: 2,
      off: 0,
      leave: 0,
      custom: 0,
    },
  },
  {
    id: 'pattern-3shift-rotating',
    name: '3교대 순환',
    description: '빠른 순환 3교대 패턴 (9일 주기)',
    type: '3-shift',
    cycleLength: 9,
    shifts: [
      'day', 'day', 'day',
      'evening', 'evening', 'evening',
      'night', 'night', 'off',
    ],
    minStaffPerShift: {
      day: 4,
      evening: 4,
      night: 3,
      off: 0,
      leave: 0,
      custom: 0,
    },
  },
  {
    id: 'pattern-weekend',
    name: '주말 전담',
    description: '주말만 근무하는 패턴',
    type: 'custom',
    cycleLength: 7,
    shifts: [
      'off', 'off', 'off', 'off', 'off', 'day', 'day',
    ],
    minStaffPerShift: {
      day: 2,
      evening: 0,
      night: 0,
      off: 0,
      leave: 0,
      custom: 0,
    },
  },
  {
    id: 'pattern-flexible',
    name: '유연 근무',
    description: '주 5일 유연 근무 패턴',
    type: 'custom',
    cycleLength: 7,
    shifts: [
      'day', 'day', 'day', 'day', 'day', 'off', 'off',
    ],
    minStaffPerShift: {
      day: 5,
      evening: 0,
      night: 0,
      off: 0,
      leave: 0,
      custom: 0,
    },
  },
];

export class PatternManager {
  private patterns: Map<string, ShiftPattern>;

  constructor() {
    this.patterns = new Map();
    // 사전 정의된 패턴 로드
    PREDEFINED_PATTERNS.forEach(pattern => {
      this.patterns.set(pattern.id, pattern);
    });
  }

  /**
   * 패턴 추가
   */
  public addPattern(pattern: ShiftPattern): void {
    this.validatePattern(pattern);
    this.patterns.set(pattern.id, pattern);
  }

  /**
   * 패턴 조회
   */
  public getPattern(id: string): ShiftPattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * 모든 패턴 조회
   */
  public getAllPatterns(): ShiftPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * 패턴 삭제
   */
  public removePattern(id: string): boolean {
    return this.patterns.delete(id);
  }

  /**
   * 패턴을 기반으로 스케줄 생성
   */
  public generateScheduleFromPattern(
    pattern: ShiftPattern,
    employees: Employee[],
    shifts: Map<string, Shift>,
    startDate: Date,
    endDate: Date
  ): ScheduleAssignment[] {
    const assignments: ScheduleAssignment[] = [];
    const cycleDays = pattern.cycleLength;
    const employeeCount = employees.length;

    // 직원을 그룹으로 나누기
    const groupSize = Math.ceil(employeeCount / this.getRequiredGroups(pattern));
    const employeeGroups = this.divideIntoGroups(employees, groupSize);

    // 날짜 순회
    let currentDate = new Date(startDate);
    let dayIndex = 0;

    while (currentDate <= endDate) {
      const patternDay = dayIndex % cycleDays;
      const shiftType = pattern.shifts[patternDay];

      if (shiftType !== 'off' && shiftType !== 'leave') {
        // 해당 시프트 찾기
        const shift = this.findShiftByType(shifts, shiftType);
        if (!shift) continue;

        // 이 날짜에 근무할 그룹 결정
        const groupIndex = Math.floor(dayIndex / cycleDays) % employeeGroups.length;
        const workingGroup = employeeGroups[groupIndex];

        // 그룹의 직원들을 배정
        for (const employee of workingGroup) {
          // 직원의 가용성 확인
          if (this.isEmployeeAvailable(employee, currentDate)) {
            assignments.push({
              employeeId: employee.id,
              shiftId: shift.id,
              date: new Date(currentDate),
              isLocked: false,
            });
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
      dayIndex++;
    }

    return this.optimizeAssignments(assignments, pattern, employees);
  }

  /**
   * 커스텀 패턴 생성
   */
  public createCustomPattern(
    name: string,
    description: string,
    shifts: ShiftType[],
    minStaffPerShift?: Partial<Record<ShiftType, number>>
  ): ShiftPattern {
    const pattern: ShiftPattern = {
      id: `pattern-custom-${Date.now()}`,
      name,
      description,
      type: 'custom',
      cycleLength: shifts.length,
      shifts,
      minStaffPerShift: {
        day: minStaffPerShift?.day || 0,
        evening: minStaffPerShift?.evening || 0,
        night: minStaffPerShift?.night || 0,
        off: 0,
        leave: 0,
        custom: minStaffPerShift?.custom || 0,
      },
    };

    this.validatePattern(pattern);
    return pattern;
  }

  /**
   * 패턴 검증
   */
  public validatePattern(pattern: ShiftPattern): void {
    // 기본 검증
    if (!pattern.id || !pattern.name) {
      throw new Error('패턴 ID와 이름은 필수입니다.');
    }

    if (pattern.cycleLength !== pattern.shifts.length) {
      throw new Error('패턴 주기와 시프트 배열 길이가 일치하지 않습니다.');
    }

    if (pattern.cycleLength < 1 || pattern.cycleLength > 42) {
      throw new Error('패턴 주기는 1-42일 사이여야 합니다.');
    }

    // 연속 근무일 검증
    let consecutiveWorkDays = 0;
    let maxConsecutive = 0;

    for (const shift of pattern.shifts) {
      if (shift !== 'off' && shift !== 'leave') {
        consecutiveWorkDays++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveWorkDays);
      } else {
        consecutiveWorkDays = 0;
      }
    }

    if (maxConsecutive > 6) {
      throw new Error('패턴에 7일 이상 연속 근무가 포함되어 있습니다.');
    }

    // 휴무일 검증
    const offDays = pattern.shifts.filter(s => s === 'off' || s === 'leave').length;
    const workDays = pattern.cycleLength - offDays;

    if (workDays / pattern.cycleLength > 6 / 7) {
      throw new Error('패턴에 충분한 휴무일이 없습니다.');
    }

    // 야간 근무 후 충분한 휴식 검증
    for (let i = 0; i < pattern.shifts.length; i++) {
      if (pattern.shifts[i] === 'night') {
        const nextIndex = (i + 1) % pattern.shifts.length;
        if (pattern.shifts[nextIndex] === 'day' || pattern.shifts[nextIndex] === 'evening') {
          console.warn(`경고: 야간 근무 후 즉시 ${pattern.shifts[nextIndex]} 근무가 배정됩니다.`);
        }
      }
    }
  }

  /**
   * 패턴 분석
   */
  public analyzePattern(pattern: ShiftPattern): {
    workDaysPerCycle: number;
    offDaysPerCycle: number;
    avgHoursPerWeek: number;
    nightShiftRatio: number;
    weekendWorkRatio: number;
    consecutiveWorkDays: number[];
  } {
    const offDays = pattern.shifts.filter(s => s === 'off' || s === 'leave').length;
    const workDays = pattern.cycleLength - offDays;

    // 야간 근무 비율
    const nightShifts = pattern.shifts.filter(s => s === 'night').length;
    const nightShiftRatio = nightShifts / workDays;

    // 주당 평균 근무시간 (8시간 기준)
    const avgHoursPerWeek = (workDays * 8) / (pattern.cycleLength / 7);

    // 연속 근무일 패턴
    const consecutiveWorkDays: number[] = [];
    let currentStreak = 0;

    for (const shift of pattern.shifts) {
      if (shift !== 'off' && shift !== 'leave') {
        currentStreak++;
      } else if (currentStreak > 0) {
        consecutiveWorkDays.push(currentStreak);
        currentStreak = 0;
      }
    }
    if (currentStreak > 0) {
      consecutiveWorkDays.push(currentStreak);
    }

    // 주말 근무 비율 (간단히 계산)
    const weekendWorkRatio = this.estimateWeekendWorkRatio(pattern);

    return {
      workDaysPerCycle: workDays,
      offDaysPerCycle: offDays,
      avgHoursPerWeek,
      nightShiftRatio,
      weekendWorkRatio,
      consecutiveWorkDays,
    };
  }

  /**
   * 패턴 추천
   */
  public recommendPattern(
    employeeCount: number,
    requiredCoverage: Record<ShiftType, number>,
    preferences?: {
      maxConsecutiveDays?: number;
      preferredCycleLength?: number;
      avoidNightShift?: boolean;
    }
  ): ShiftPattern[] {
    const recommendations: ShiftPattern[] = [];

    for (const pattern of this.patterns.values()) {
      // 직원 수 확인
      const requiredGroups = this.getRequiredGroups(pattern);
      if (employeeCount < requiredGroups * 2) {
        continue; // 최소 인원 부족
      }

      // 선호사항 확인
      if (preferences) {
        if (preferences.maxConsecutiveDays) {
          const analysis = this.analyzePattern(pattern);
          const maxConsecutive = Math.max(...analysis.consecutiveWorkDays);
          if (maxConsecutive > preferences.maxConsecutiveDays) {
            continue;
          }
        }

        if (preferences.avoidNightShift && pattern.shifts.includes('night')) {
          continue;
        }

        if (preferences.preferredCycleLength) {
          const diff = Math.abs(pattern.cycleLength - preferences.preferredCycleLength);
          if (diff > 7) {
            continue;
          }
        }
      }

      // 커버리지 확인
      let coverageMet = true;
      for (const [shiftType, required] of Object.entries(requiredCoverage)) {
        const patternProvides = pattern.minStaffPerShift[shiftType as ShiftType] || 0;
        if (patternProvides < required) {
          coverageMet = false;
          break;
        }
      }

      if (coverageMet) {
        recommendations.push(pattern);
      }
    }

    // 점수를 기준으로 정렬
    return recommendations.sort((a, b) => {
      const scoreA = this.scorePattern(a, employeeCount, requiredCoverage, preferences);
      const scoreB = this.scorePattern(b, employeeCount, requiredCoverage, preferences);
      return scoreB - scoreA;
    });
  }

  // Private 헬퍼 메서드들

  private getRequiredGroups(pattern: ShiftPattern): number {
    // 패턴에서 필요한 최소 그룹 수 계산
    const shiftCounts = new Map<ShiftType, number>();

    for (const shift of pattern.shifts) {
      if (shift !== 'off' && shift !== 'leave') {
        shiftCounts.set(shift, (shiftCounts.get(shift) || 0) + 1);
      }
    }

    let maxRequired = 0;
    for (const [shiftType, count] of shiftCounts) {
      const minStaff = pattern.minStaffPerShift[shiftType] || 0;
      const required = Math.ceil((minStaff * pattern.cycleLength) / count);
      maxRequired = Math.max(maxRequired, required);
    }

    return maxRequired || 1;
  }

  private divideIntoGroups(employees: Employee[], groupSize: number): Employee[][] {
    const groups: Employee[][] = [];
    const shuffled = [...employees].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffled.length; i += groupSize) {
      groups.push(shuffled.slice(i, i + groupSize));
    }

    return groups;
  }

  private findShiftByType(shifts: Map<string, Shift>, type: ShiftType): Shift | undefined {
    for (const shift of shifts.values()) {
      if (shift.type === type) {
        return shift;
      }
    }
    return undefined;
  }

  private isEmployeeAvailable(employee: Employee, date: Date): boolean {
    // 요일 가용성 확인
    const dayOfWeek = date.getDay();
    if (!employee.availability.availableDays[dayOfWeek]) {
      return false;
    }

    // 특정 날짜 불가능 확인
    for (const unavailableDate of employee.availability.unavailableDates) {
      if (this.isSameDate(unavailableDate, date)) {
        return false;
      }
    }

    // 승인된 휴가 확인
    for (const timeOff of employee.availability.timeOffRequests) {
      if (timeOff.status === 'approved' &&
          date >= timeOff.startDate &&
          date <= timeOff.endDate) {
        return false;
      }
    }

    return true;
  }

  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  private optimizeAssignments(
    assignments: ScheduleAssignment[],
    pattern: ShiftPattern,
    employees: Employee[]
  ): ScheduleAssignment[] {
    // 기본 최적화: 공정한 분배
    const assignmentCount = new Map<string, number>();

    for (const assignment of assignments) {
      const count = assignmentCount.get(assignment.employeeId) || 0;
      assignmentCount.set(assignment.employeeId, count + 1);
    }

    // 평균 계산
    const totalAssignments = assignments.length;
    const avgPerEmployee = totalAssignments / employees.length;

    // 재분배가 필요한 경우 처리
    // (실제 구현에서는 더 복잡한 최적화 로직이 필요)

    return assignments;
  }

  private estimateWeekendWorkRatio(pattern: ShiftPattern): number {
    // 간단한 추정: 전체 근무일 중 주말 비율
    const workDays = pattern.shifts.filter(s => s !== 'off' && s !== 'leave').length;
    const weekendEstimate = (workDays * 2) / 7; // 주말은 주 7일 중 2일
    return weekendEstimate / workDays;
  }

  private scorePattern(
    pattern: ShiftPattern,
    employeeCount: number,
    requiredCoverage: Record<ShiftType, number>,
    preferences?: any
  ): number {
    let score = 100;

    const analysis = this.analyzePattern(pattern);

    // 근무 시간 균형
    const idealHoursPerWeek = 40;
    const hoursDiff = Math.abs(analysis.avgHoursPerWeek - idealHoursPerWeek);
    score -= hoursDiff * 2;

    // 연속 근무일
    const maxConsecutive = Math.max(...analysis.consecutiveWorkDays);
    if (maxConsecutive > 5) {
      score -= (maxConsecutive - 5) * 10;
    }

    // 야간 근무 비율
    if (analysis.nightShiftRatio > 0.3) {
      score -= (analysis.nightShiftRatio - 0.3) * 50;
    }

    // 주말 근무 비율
    if (analysis.weekendWorkRatio > 0.4) {
      score -= (analysis.weekendWorkRatio - 0.4) * 30;
    }

    return Math.max(0, score);
  }
}