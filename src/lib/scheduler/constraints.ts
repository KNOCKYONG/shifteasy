/**
 * 제약조건 검증 시스템
 */

import {
  Employee,
  ScheduleAssignment,
  Constraint,
  ConstraintViolation,
  ConstraintType,
  ShiftType,
  Shift,
  TimeOffRequest,
} from './types';

// 한국 근로기준법 상수
const KOREAN_LABOR_LAW = {
  MAX_HOURS_PER_WEEK: 52,           // 주 최대 근로시간
  MAX_HOURS_PER_DAY: 12,            // 일 최대 근로시간 (연장근로 포함)
  STANDARD_HOURS_PER_WEEK: 40,      // 주 기준 근로시간
  STANDARD_HOURS_PER_DAY: 8,        // 일 기준 근로시간
  MIN_REST_BETWEEN_SHIFTS: 11,      // 교대 간 최소 휴식시간
  MAX_CONSECUTIVE_DAYS: 6,          // 최대 연속 근무일
  MIN_WEEKLY_REST_DAYS: 1,          // 주 최소 휴무일
  NIGHT_SHIFT_HOURS: { start: 22, end: 6 }, // 야간근로 시간
};

export class ConstraintValidator {
  private constraints: Map<string, Constraint>;

  constructor(constraints: Constraint[]) {
    this.constraints = new Map(constraints.map(c => [c.id, c]));
  }

  /**
   * 전체 제약조건 검증
   */
  public validateSchedule(
    assignments: ScheduleAssignment[],
    employees: Map<string, Employee>,
    shifts: Map<string, Shift>,
    startDate: Date,
    endDate: Date
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // 하드 제약조건 검증
    violations.push(...this.validateHardConstraints(assignments, employees, shifts, startDate, endDate));

    // 소프트 제약조건 검증
    violations.push(...this.validateSoftConstraints(assignments, employees, shifts, startDate, endDate));

    return violations;
  }

  /**
   * 하드 제약조건 검증 (반드시 지켜야 하는 제약)
   */
  private validateHardConstraints(
    assignments: ScheduleAssignment[],
    employees: Map<string, Employee>,
    shifts: Map<string, Shift>,
    startDate: Date,
    endDate: Date
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // 직원별 배정 그룹화
    const assignmentsByEmployee = this.groupAssignmentsByEmployee(assignments);

    for (const [employeeId, empAssignments] of assignmentsByEmployee) {
      const employee = employees.get(employeeId);
      if (!employee) continue;

      // 1. 법정 근로시간 검증
      violations.push(...this.validateLegalWorkingHours(employee, empAssignments, shifts));

      // 2. 연속 근무일 검증
      violations.push(...this.validateConsecutiveWorkDays(employee, empAssignments));

      // 3. 교대 간 휴식시간 검증
      violations.push(...this.validateRestBetweenShifts(employee, empAssignments, shifts));

      // 4. 휴가/휴무 요청 검증
      violations.push(...this.validateTimeOffRequests(employee, empAssignments));

      // 5. 가용성 검증
      violations.push(...this.validateAvailability(employee, empAssignments));

      // 6. 중복 배정 검증
      violations.push(...this.validateDuplicateAssignments(employee, empAssignments));
    }

    // 7. 최소 인원 검증
    violations.push(...this.validateMinimumStaffing(assignments, shifts, startDate, endDate));

    return violations;
  }

  /**
   * 소프트 제약조건 검증 (선호사항)
   */
  private validateSoftConstraints(
    assignments: ScheduleAssignment[],
    employees: Map<string, Employee>,
    shifts: Map<string, Shift>,
    startDate: Date,
    endDate: Date
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    const assignmentsByEmployee = this.groupAssignmentsByEmployee(assignments);

    for (const [employeeId, empAssignments] of assignmentsByEmployee) {
      const employee = employees.get(employeeId);
      if (!employee) continue;

      // 1. 선호 시프트 검증
      violations.push(...this.validatePreferredShifts(employee, empAssignments, shifts));

      // 2. 회피 시프트 검증
      violations.push(...this.validateAvoidShifts(employee, empAssignments, shifts));

      // 3. 선호 휴무일 검증
      violations.push(...this.validatePreferredDaysOff(employee, empAssignments));

      // 4. 주말 근무 공정성
      violations.push(...this.validateWeekendFairness(employee, empAssignments));

      // 5. 야간 근무 공정성
      violations.push(...this.validateNightShiftFairness(employee, empAssignments, shifts));
    }

    return violations;
  }

  /**
   * 법정 근로시간 검증
   */
  private validateLegalWorkingHours(
    employee: Employee,
    assignments: ScheduleAssignment[],
    shifts: Map<string, Shift>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const weeklyHours = this.calculateWeeklyHours(assignments, shifts);

    for (const [weekStart, hours] of weeklyHours) {
      if (hours > KOREAN_LABOR_LAW.MAX_HOURS_PER_WEEK) {
        violations.push({
          constraintId: 'legal-max-hours-week',
          constraintName: '주 최대 근로시간 초과',
          type: 'hard',
          severity: 'critical',
          message: `${employee.name}의 주 근로시간이 ${hours}시간으로 법정 최대 ${KOREAN_LABOR_LAW.MAX_HOURS_PER_WEEK}시간을 초과합니다.`,
          affectedEmployees: [employee.id],
          affectedDates: this.getWeekDates(weekStart),
          cost: 1000,
        });
      }

      if (hours > employee.maxHoursPerWeek) {
        violations.push({
          constraintId: 'contract-max-hours-week',
          constraintName: '계약상 주 최대 근로시간 초과',
          type: 'hard',
          severity: 'high',
          message: `${employee.name}의 주 근로시간이 ${hours}시간으로 계약상 최대 ${employee.maxHoursPerWeek}시간을 초과합니다.`,
          affectedEmployees: [employee.id],
          affectedDates: this.getWeekDates(weekStart),
          cost: 800,
        });
      }
    }

    // 일 최대 근로시간 검증
    const dailyHours = this.calculateDailyHours(assignments, shifts);
    for (const [date, hours] of dailyHours) {
      if (hours > KOREAN_LABOR_LAW.MAX_HOURS_PER_DAY) {
        violations.push({
          constraintId: 'legal-max-hours-day',
          constraintName: '일 최대 근로시간 초과',
          type: 'hard',
          severity: 'critical',
          message: `${employee.name}의 일 근로시간이 ${hours}시간으로 법정 최대 ${KOREAN_LABOR_LAW.MAX_HOURS_PER_DAY}시간을 초과합니다.`,
          affectedEmployees: [employee.id],
          affectedDates: [new Date(date)],
          cost: 900,
        });
      }
    }

    return violations;
  }

  /**
   * 연속 근무일 검증
   */
  private validateConsecutiveWorkDays(
    employee: Employee,
    assignments: ScheduleAssignment[]
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const sortedAssignments = [...assignments].sort((a, b) =>
      a.date.getTime() - b.date.getTime()
    );

    let consecutiveDays = 1;
    let startDate = sortedAssignments[0]?.date;

    for (let i = 1; i < sortedAssignments.length; i++) {
      const dayDiff = this.getDayDifference(
        sortedAssignments[i - 1].date,
        sortedAssignments[i].date
      );

      if (dayDiff === 1) {
        consecutiveDays++;
        if (consecutiveDays > KOREAN_LABOR_LAW.MAX_CONSECUTIVE_DAYS) {
          violations.push({
            constraintId: 'legal-max-consecutive-days',
            constraintName: '최대 연속 근무일 초과',
            type: 'hard',
            severity: 'critical',
            message: `${employee.name}이(가) ${consecutiveDays}일 연속 근무로 법정 최대 ${KOREAN_LABOR_LAW.MAX_CONSECUTIVE_DAYS}일을 초과합니다.`,
            affectedEmployees: [employee.id],
            affectedDates: this.getDateRange(startDate, sortedAssignments[i].date),
            cost: 950,
          });
        }
      } else {
        consecutiveDays = 1;
        startDate = sortedAssignments[i].date;
      }
    }

    // 직원 개인 선호 최대 연속 근무일 검증
    if (employee.preferences?.maxConsecutiveDays) {
      consecutiveDays = 1;
      for (let i = 1; i < sortedAssignments.length; i++) {
        const dayDiff = this.getDayDifference(
          sortedAssignments[i - 1].date,
          sortedAssignments[i].date
        );

        if (dayDiff === 1) {
          consecutiveDays++;
          if (consecutiveDays > employee.preferences.maxConsecutiveDays) {
            violations.push({
              constraintId: 'pref-max-consecutive-days',
              constraintName: '선호 최대 연속 근무일 초과',
              type: 'soft',
              severity: 'medium',
              message: `${employee.name}이(가) ${consecutiveDays}일 연속 근무로 선호 최대 ${employee.preferences.maxConsecutiveDays}일을 초과합니다.`,
              affectedEmployees: [employee.id],
              affectedDates: this.getDateRange(startDate, sortedAssignments[i].date),
              cost: 50,
            });
          }
        } else {
          consecutiveDays = 1;
          startDate = sortedAssignments[i].date;
        }
      }
    }

    return violations;
  }

  /**
   * 교대 간 휴식시간 검증
   */
  private validateRestBetweenShifts(
    employee: Employee,
    assignments: ScheduleAssignment[],
    shifts: Map<string, Shift>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const sortedAssignments = [...assignments].sort((a, b) =>
      a.date.getTime() - b.date.getTime()
    );

    for (let i = 1; i < sortedAssignments.length; i++) {
      const prevShift = shifts.get(sortedAssignments[i - 1].shiftId);
      const currShift = shifts.get(sortedAssignments[i].shiftId);

      if (!prevShift || !currShift) continue;

      const restHours = this.calculateRestHours(
        sortedAssignments[i - 1].date,
        prevShift,
        sortedAssignments[i].date,
        currShift
      );

      if (restHours < KOREAN_LABOR_LAW.MIN_REST_BETWEEN_SHIFTS) {
        violations.push({
          constraintId: 'legal-min-rest-hours',
          constraintName: '최소 휴식시간 미달',
          type: 'hard',
          severity: 'critical',
          message: `${employee.name}의 교대 간 휴식시간이 ${restHours}시간으로 법정 최소 ${KOREAN_LABOR_LAW.MIN_REST_BETWEEN_SHIFTS}시간 미달입니다.`,
          affectedEmployees: [employee.id],
          affectedDates: [sortedAssignments[i - 1].date, sortedAssignments[i].date],
          cost: 900,
        });
      }
    }

    return violations;
  }

  /**
   * 휴가/휴무 요청 검증
   */
  private validateTimeOffRequests(
    employee: Employee,
    assignments: ScheduleAssignment[]
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const approvedTimeOffs = employee.availability.timeOffRequests
      .filter(req => req.status === 'approved');

    for (const timeOff of approvedTimeOffs) {
      const conflictingAssignments = assignments.filter(a => {
        const assignDate = a.date.getTime();
        return assignDate >= timeOff.startDate.getTime() &&
               assignDate <= timeOff.endDate.getTime();
      });

      if (conflictingAssignments.length > 0) {
        violations.push({
          constraintId: 'timeoff-conflict',
          constraintName: '휴가/휴무 요청 충돌',
          type: 'hard',
          severity: 'critical',
          message: `${employee.name}의 승인된 휴가/휴무 기간에 근무가 배정되었습니다.`,
          affectedEmployees: [employee.id],
          affectedDates: conflictingAssignments.map(a => a.date),
          cost: 1000,
        });
      }
    }

    return violations;
  }

  /**
   * 가용성 검증
   */
  private validateAvailability(
    employee: Employee,
    assignments: ScheduleAssignment[]
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const assignment of assignments) {
      const dayOfWeek = assignment.date.getDay();

      // 요일별 가용성 확인
      if (!employee.availability.availableDays[dayOfWeek]) {
        violations.push({
          constraintId: 'availability-day',
          constraintName: '가용 요일 위반',
          type: 'hard',
          severity: 'high',
          message: `${employee.name}은(는) ${this.getDayName(dayOfWeek)}에 근무 불가능합니다.`,
          affectedEmployees: [employee.id],
          affectedDates: [assignment.date],
          cost: 800,
        });
      }

      // 특정 날짜 불가능 확인
      const isUnavailable = employee.availability.unavailableDates.some(
        date => this.isSameDate(date, assignment.date)
      );

      if (isUnavailable) {
        violations.push({
          constraintId: 'availability-date',
          constraintName: '특정 날짜 근무 불가',
          type: 'hard',
          severity: 'high',
          message: `${employee.name}은(는) ${this.formatDate(assignment.date)}에 근무 불가능합니다.`,
          affectedEmployees: [employee.id],
          affectedDates: [assignment.date],
          cost: 850,
        });
      }
    }

    return violations;
  }

  /**
   * 중복 배정 검증
   */
  private validateDuplicateAssignments(
    employee: Employee,
    assignments: ScheduleAssignment[]
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const dateMap = new Map<string, ScheduleAssignment[]>();

    for (const assignment of assignments) {
      const dateKey = this.formatDate(assignment.date);
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(assignment);
    }

    for (const [dateKey, dayAssignments] of dateMap) {
      if (dayAssignments.length > 1) {
        violations.push({
          constraintId: 'duplicate-assignment',
          constraintName: '중복 배정',
          type: 'hard',
          severity: 'critical',
          message: `${employee.name}이(가) ${dateKey}에 ${dayAssignments.length}개의 시프트에 중복 배정되었습니다.`,
          affectedEmployees: [employee.id],
          affectedDates: [new Date(dateKey)],
          cost: 1000,
        });
      }
    }

    return violations;
  }

  /**
   * 최소 인원 검증
   */
  private validateMinimumStaffing(
    assignments: ScheduleAssignment[],
    shifts: Map<string, Shift>,
    startDate: Date,
    endDate: Date
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const shiftCounts = this.countStaffPerShift(assignments);

    for (const [key, count] of shiftCounts) {
      const [dateStr, shiftId] = key.split('|');
      const shift = shifts.get(shiftId);

      if (!shift) continue;

      const minStaff = shift.minStaff || shift.requiredStaff;
      if (count < minStaff) {
        violations.push({
          constraintId: 'min-staffing',
          constraintName: '최소 인원 미달',
          type: 'hard',
          severity: 'high',
          message: `${dateStr} ${shift.name} 시프트의 인원이 ${count}명으로 최소 ${minStaff}명 미달입니다.`,
          affectedEmployees: [],
          affectedDates: [new Date(dateStr)],
          cost: 700,
        });
      }
    }

    return violations;
  }

  /**
   * 선호 시프트 검증
   */
  private validatePreferredShifts(
    employee: Employee,
    assignments: ScheduleAssignment[],
    shifts: Map<string, Shift>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const preferredShifts = employee.preferences?.preferredShifts || [];

    if (preferredShifts.length === 0) return violations;

    for (const assignment of assignments) {
      const shift = shifts.get(assignment.shiftId);
      if (!shift) continue;

      if (!preferredShifts.includes(shift.type)) {
        violations.push({
          constraintId: 'preferred-shift',
          constraintName: '선호 시프트 불일치',
          type: 'soft',
          severity: 'low',
          message: `${employee.name}이(가) 선호하지 않는 ${shift.name} 시프트에 배정되었습니다.`,
          affectedEmployees: [employee.id],
          affectedDates: [assignment.date],
          cost: 20,
        });
      }
    }

    return violations;
  }

  /**
   * 회피 시프트 검증
   */
  private validateAvoidShifts(
    employee: Employee,
    assignments: ScheduleAssignment[],
    shifts: Map<string, Shift>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const avoidShifts = employee.preferences?.avoidShifts || [];

    if (avoidShifts.length === 0) return violations;

    for (const assignment of assignments) {
      const shift = shifts.get(assignment.shiftId);
      if (!shift) continue;

      if (avoidShifts.includes(shift.type)) {
        violations.push({
          constraintId: 'avoid-shift',
          constraintName: '회피 시프트 배정',
          type: 'soft',
          severity: 'medium',
          message: `${employee.name}이(가) 회피하려는 ${shift.name} 시프트에 배정되었습니다.`,
          affectedEmployees: [employee.id],
          affectedDates: [assignment.date],
          cost: 40,
        });
      }
    }

    return violations;
  }

  /**
   * 선호 휴무일 검증
   */
  private validatePreferredDaysOff(
    employee: Employee,
    assignments: ScheduleAssignment[]
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const preferredDaysOff = employee.preferences?.preferredDaysOff || [];

    if (preferredDaysOff.length === 0) return violations;

    for (const assignment of assignments) {
      const dayOfWeek = assignment.date.getDay();

      if (preferredDaysOff.includes(dayOfWeek)) {
        violations.push({
          constraintId: 'preferred-dayoff',
          constraintName: '선호 휴무일 근무',
          type: 'soft',
          severity: 'low',
          message: `${employee.name}이(가) 선호 휴무일인 ${this.getDayName(dayOfWeek)}에 근무가 배정되었습니다.`,
          affectedEmployees: [employee.id],
          affectedDates: [assignment.date],
          cost: 30,
        });
      }
    }

    return violations;
  }

  /**
   * 주말 근무 공정성 검증
   */
  private validateWeekendFairness(
    employee: Employee,
    assignments: ScheduleAssignment[]
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const weekendCount = assignments.filter(a => {
      const day = a.date.getDay();
      return day === 0 || day === 6; // 일요일 또는 토요일
    }).length;

    const totalDays = assignments.length;
    const weekendRatio = totalDays > 0 ? weekendCount / totalDays : 0;

    // 주말 근무 비율이 40% 초과 시 경고
    if (weekendRatio > 0.4) {
      violations.push({
        constraintId: 'weekend-fairness',
        constraintName: '주말 근무 과다',
        type: 'soft',
        severity: 'medium',
        message: `${employee.name}의 주말 근무 비율이 ${(weekendRatio * 100).toFixed(1)}%로 과도합니다.`,
        affectedEmployees: [employee.id],
        affectedDates: [],
        cost: 60,
      });
    }

    return violations;
  }

  /**
   * 야간 근무 공정성 검증
   */
  private validateNightShiftFairness(
    employee: Employee,
    assignments: ScheduleAssignment[],
    shifts: Map<string, Shift>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    const nightShiftCount = assignments.filter(a => {
      const shift = shifts.get(a.shiftId);
      return shift?.type === 'night';
    }).length;

    const totalDays = assignments.length;
    const nightRatio = totalDays > 0 ? nightShiftCount / totalDays : 0;

    // 야간 근무를 선호하지 않는 직원이 30% 이상 야간 근무 시 경고
    if (!employee.preferences?.preferNightShift && nightRatio > 0.3) {
      violations.push({
        constraintId: 'night-shift-fairness',
        constraintName: '야간 근무 과다',
        type: 'soft',
        severity: 'medium',
        message: `${employee.name}의 야간 근무 비율이 ${(nightRatio * 100).toFixed(1)}%로 과도합니다.`,
        affectedEmployees: [employee.id],
        affectedDates: [],
        cost: 70,
      });
    }

    return violations;
  }

  // 유틸리티 메서드들
  private groupAssignmentsByEmployee(
    assignments: ScheduleAssignment[]
  ): Map<string, ScheduleAssignment[]> {
    const grouped = new Map<string, ScheduleAssignment[]>();

    for (const assignment of assignments) {
      if (!grouped.has(assignment.employeeId)) {
        grouped.set(assignment.employeeId, []);
      }
      grouped.get(assignment.employeeId)!.push(assignment);
    }

    return grouped;
  }

  private calculateWeeklyHours(
    assignments: ScheduleAssignment[],
    shifts: Map<string, Shift>
  ): Map<Date, number> {
    const weeklyHours = new Map<Date, number>();

    for (const assignment of assignments) {
      const shift = shifts.get(assignment.shiftId);
      if (!shift) continue;

      const weekStart = this.getWeekStart(assignment.date);
      const current = weeklyHours.get(weekStart) || 0;
      weeklyHours.set(weekStart, current + shift.time.hours);
    }

    return weeklyHours;
  }

  private calculateDailyHours(
    assignments: ScheduleAssignment[],
    shifts: Map<string, Shift>
  ): Map<string, number> {
    const dailyHours = new Map<string, number>();

    for (const assignment of assignments) {
      const shift = shifts.get(assignment.shiftId);
      if (!shift) continue;

      const dateKey = this.formatDate(assignment.date);
      const current = dailyHours.get(dateKey) || 0;
      dailyHours.set(dateKey, current + shift.time.hours);
    }

    return dailyHours;
  }

  private calculateRestHours(
    prevDate: Date,
    prevShift: Shift,
    currDate: Date,
    currShift: Shift
  ): number {
    const prevEnd = this.parseTime(prevDate, prevShift.time.end);
    const currStart = this.parseTime(currDate, currShift.time.start);

    const diffMs = currStart.getTime() - prevEnd.getTime();
    return diffMs / (1000 * 60 * 60); // 밀리초를 시간으로 변환
  }

  private countStaffPerShift(
    assignments: ScheduleAssignment[]
  ): Map<string, number> {
    const counts = new Map<string, number>();

    for (const assignment of assignments) {
      const key = `${this.formatDate(assignment.date)}|${assignment.shiftId}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return counts;
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  private getWeekDates(weekStart: Date): Date[] {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  }

  private getDayDifference(date1: Date, date2: Date): number {
    const diffMs = date2.getTime() - date1.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  private getDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getDayName(dayIndex: number): string {
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    return days[dayIndex];
  }

  private parseTime(date: Date, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }
}