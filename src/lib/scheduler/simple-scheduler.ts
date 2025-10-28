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
  shift: 'D' | 'E' | 'N' | 'A' | 'OFF'; // A = 행정 근무 (평일 행정 업무, 주말/공휴일 휴무)
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
  private workCounts: Map<string, number>; // employeeId -> work day count
  private offCounts: Map<string, number>; // employeeId -> OFF day count

  constructor(config: SimpleSchedulerConfig) {
    this.config = config;
    this.workDays = [];
    this.schedule = new Map();
    this.roleRatios = this.calculateRoleRatios();
    this.workCounts = new Map();
    this.offCounts = new Map();

    // Initialize work/OFF counts to 0 for all employees
    this.config.employees.forEach(emp => {
      this.workCounts.set(emp.id, 0);
      this.offCounts.set(emp.id, 0);
    });
  }

  /**
   * Main scheduling method
   */
  public async generate(): Promise<ScheduleAssignment[]> {
    console.log('\n🚀 ===== 스케줄 생성 시작 =====');
    console.log(`📅 대상 기간: ${this.config.year}년 ${this.config.month}월`);
    console.log(`👥 총 직원 수: ${this.config.employees.length}명`);
    console.log(`📝 특별 요청: ${this.config.specialRequests.length}건`);
    console.log(`🎉 공휴일: ${this.config.holidays.length}일`);

    // Step 1: Calculate work days
    console.log('\n📊 Step 1: 근무일 계산 중...');
    this.calculateWorkDays();

    // Step 2: Assign special requests
    console.log('\n🎯 Step 2: 특별 요청 배정 중...');
    this.assignSpecialRequests();

    // Step 3: Assign preferred patterns with role ratio matching
    console.log('\n⚙️ Step 3: 선호 패턴 배정 중...');
    this.assignPreferredPatterns();

    // Step 4: Fill gaps with team pattern
    console.log('\n🔧 Step 4: 팀 패턴으로 빈 자리 채우기...');
    this.assignTeamPattern();

    // Final statistics
    const stats = this.getStatistics();
    console.log('\n✅ ===== 스케줄 생성 완료 =====');
    console.log(`📊 총 배정: ${stats.totalAssignments}건`);
    console.log(`📈 시프트 분포: D=${stats.shiftDistribution.D}, E=${stats.shiftDistribution.E}, N=${stats.shiftDistribution.N}, OFF=${stats.shiftDistribution.OFF}, A=${stats.shiftDistribution.A || 0}`);
    console.log('=============================\n');

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

    const weekendCount = allDays.filter(d => isWeekend(d)).length;
    const holidaySet = new Set(this.config.holidays.map(h => h.date));
    const holidayCount = this.config.holidays.length;

    console.log(`   ✓ 총 ${allDays.length}일 (평일: ${allDays.length - weekendCount}일, 주말: ${weekendCount}일, 공휴일: ${holidayCount}일)`);

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
    let requestCount = 0;

    for (const request of this.config.specialRequests) {
      const employee = this.config.employees.find(e => e.id === request.employeeId);
      const empName = employee?.name || request.employeeId;

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
            console.log(`   📝 ${empName}: ${dateStr} → OFF (${request.requestType})`);
            // Update OFF count
            this.offCounts.set(request.employeeId, (this.offCounts.get(request.employeeId) || 0) + 1);
            requestCount++;
          }
          // Assign specific shift for shift_request
          else if (request.requestType === 'shift_request' && request.shiftTypeCode) {
            const mappedShift = this.mapShiftCode(request.shiftTypeCode);
            daySchedule.set(request.employeeId, mappedShift);
            console.log(`   📝 ${empName}: ${dateStr} → ${mappedShift} (shift_request)`);
            // Update work count if not OFF
            if (mappedShift !== 'OFF') {
              this.workCounts.set(request.employeeId, (this.workCounts.get(request.employeeId) || 0) + 1);
            } else {
              this.offCounts.set(request.employeeId, (this.offCounts.get(request.employeeId) || 0) + 1);
            }
            requestCount++;
          }
        }
      }
    }

    if (requestCount === 0) {
      console.log('   ℹ️ 특별 요청 없음');
    } else {
      console.log(`   ✓ ${requestCount}건 배정 완료`);
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

    // Separate employees by work pattern type
    const weekdayOnlyEmployees = this.config.employees.filter(
      emp => emp.workPatternType === 'weekday-only'
    );
    const shiftEmployees = this.config.employees.filter(
      emp => emp.workPatternType !== 'weekday-only'
    );

    console.log(`   👥 직원 구성: 행정 ${weekdayOnlyEmployees.length}명, 교대 ${shiftEmployees.length}명`);
    console.log(`   📊 필요 인원: D=${requiredPerShift.D}, E=${requiredPerShift.E}, N=${requiredPerShift.N}`);

    // Check if we have enough staff
    const totalRequired = requiredPerShift.D + requiredPerShift.E + requiredPerShift.N;
    if (shiftEmployees.length < totalRequired) {
      console.warn(`⚠️ 인원 부족: 필요 ${totalRequired}명, 실제 ${shiftEmployees.length}명 (주말/공휴일 제외 평일은 전원 근무 필요)`);
    }

    for (const day of this.workDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const daySchedule = this.schedule.get(dateStr);
      if (!daySchedule) continue;

      const isWeekendDay = isWeekend(day);
      const isHoliday = holidaySet.has(dateStr);
      const isSpecialDay = isWeekendDay || isHoliday;
      const isWeekday = !isWeekendDay;

      const dayType = isHoliday ? '공휴일' : isWeekendDay ? '주말' : '평일';
      console.log(`\n   📅 ${dateStr} (${dayType})`);

      // 1. 행정 근무자 처리
      const adminAssignments: string[] = [];
      for (const emp of weekdayOnlyEmployees) {
        if (daySchedule.has(emp.id)) {
          console.log(`      ${emp.name}: ${daySchedule.get(emp.id)} (특별 요청)`);
          continue; // Already assigned by special request
        }

        if (isWeekday && !isHoliday) {
          daySchedule.set(emp.id, 'A');
          this.workCounts.set(emp.id, (this.workCounts.get(emp.id) || 0) + 1);
          adminAssignments.push(emp.name);
        } else {
          daySchedule.set(emp.id, 'OFF');
          this.offCounts.set(emp.id, (this.offCounts.get(emp.id) || 0) + 1);
        }
      }

      if (adminAssignments.length > 0) {
        console.log(`      행정(A): ${adminAssignments.join(', ')}`);
      }

      // 2. 교대 근무자 시프트 배치 (team pattern 기준)
      const unassignedShiftEmployees = shiftEmployees.filter(emp => !daySchedule.has(emp.id));

      // Determine required staff based on day type
      let adjustedD = requiredPerShift.D;
      let adjustedE = requiredPerShift.E;
      let adjustedN = requiredPerShift.N;

      // On weekends/holidays, reduce required staff (minimum staffing)
      if (isSpecialDay) {
        // Reduce to ~40% of regular staffing on weekends/holidays
        adjustedD = Math.max(1, Math.ceil(requiredPerShift.D * 0.4));
        adjustedE = Math.max(1, Math.ceil(requiredPerShift.E * 0.4));
        adjustedN = Math.max(1, Math.ceil(requiredPerShift.N * 0.4));
      }

      const totalRequiredToday = adjustedD + adjustedE + adjustedN;
      const availableCount = unassignedShiftEmployees.length;

      // If not enough staff, scale down proportionally
      if (availableCount < totalRequiredToday) {
        const ratio = availableCount / totalRequiredToday;
        adjustedD = Math.max(0, Math.round(adjustedD * ratio));
        adjustedE = Math.max(0, Math.round(adjustedE * ratio));
        adjustedN = Math.max(0, availableCount - adjustedD - adjustedE);
      }

      // 3. 시프트 배치 (D, E, N 순서대로)
      this.assignShiftWithExperienceBalance(unassignedShiftEmployees, daySchedule, 'D', adjustedD, isSpecialDay);
      const dAssignments = unassignedShiftEmployees
        .filter(emp => daySchedule.get(emp.id) === 'D')
        .map(emp => `${emp.name}(${emp.role})`)
        .join(', ');
      if (dAssignments) {
        console.log(`      주간(D): ${dAssignments}`);
      }

      const afterD = unassignedShiftEmployees.filter(emp => !daySchedule.has(emp.id));
      this.assignShiftWithExperienceBalance(afterD, daySchedule, 'E', adjustedE, isSpecialDay);
      const eAssignments = afterD
        .filter(emp => daySchedule.get(emp.id) === 'E')
        .map(emp => `${emp.name}(${emp.role})`)
        .join(', ');
      if (eAssignments) {
        console.log(`      저녁(E): ${eAssignments}`);
      }

      const afterE = afterD.filter(emp => !daySchedule.has(emp.id));
      this.assignShiftWithExperienceBalance(afterE, daySchedule, 'N', adjustedN, isSpecialDay);
      const nAssignments = afterE
        .filter(emp => daySchedule.get(emp.id) === 'N')
        .map(emp => `${emp.name}(${emp.role})`)
        .join(', ');
      if (nAssignments) {
        console.log(`      야간(N): ${nAssignments}`);
      }

      // 4. 시프트 배치 후 남은 사람들은 OFF
      const remainingAfterShifts = afterE.filter(emp => !daySchedule.has(emp.id));
      const offAssignments = remainingAfterShifts.map(emp => emp.name).join(', ');
      if (offAssignments) {
        console.log(`      휴무(OFF): ${offAssignments}`);
      }
      remainingAfterShifts.forEach(emp => {
        daySchedule.set(emp.id, 'OFF');
        this.offCounts.set(emp.id, (this.offCounts.get(emp.id) || 0) + 1);
      });

      // Update work counts
      unassignedShiftEmployees.forEach(emp => {
        if (daySchedule.has(emp.id) && daySchedule.get(emp.id) !== 'OFF' && daySchedule.get(emp.id) !== 'A') {
          this.workCounts.set(emp.id, (this.workCounts.get(emp.id) || 0) + 1);
        }
      });
    }

    console.log('\n   📊 근무 통계 요약:');
    Array.from(this.workCounts.entries())
      .filter(([id]) => this.config.employees.some(e => e.id === id))
      .forEach(([id, work]) => {
        const emp = this.config.employees.find(e => e.id === id);
        const off = this.offCounts.get(id) || 0;
        console.log(`      ${emp?.name}: 근무 ${work}일, OFF ${off}일`);
      });
  }

  /**
   * Helper: Assign shift with fair rotation and experience balance
   * 공정한 순환 배치: 적게 일한 사람부터 우선 배치
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

    // Sort by workload fairness FIRST, then experience/preference
    const sorted = available.sort((a, b) => {
      // 1. 근무 횟수가 적은 사람 우선 (공정성)
      const aWork = this.workCounts.get(a.id) || 0;
      const bWork = this.workCounts.get(b.id) || 0;
      if (aWork !== bWork) return aWork - bWork; // Less work first

      // 2. OFF 횟수가 많은 사람 우선 (더 쉰 사람이 일해야 함)
      const aOff = this.offCounts.get(a.id) || 0;
      const bOff = this.offCounts.get(b.id) || 0;
      if (aOff !== bOff) return bOff - aOff; // More OFF = work now

      // 3. Experience level (senior for quality)
      const aExp = this.getExperienceScore(a);
      const bExp = this.getExperienceScore(b);
      if (aExp !== bExp) return bExp - aExp;

      // 4. Shift preference
      const aPref = this.getShiftPreference(a, shift);
      const bPref = this.getShiftPreference(b, shift);
      if (aPref !== bPref) return bPref - aPref;

      // 5. Role (RN > CN > SN > NA)
      const roleOrder: Record<string, number> = { RN: 4, CN: 3, SN: 2, NA: 1 };
      return (roleOrder[b.role] || 0) - (roleOrder[a.role] || 0);
    });

    let assigned = 0;

    // Assign up to requiredCount
    for (const employee of sorted) {
      if (assigned >= requiredCount) break;
      daySchedule.set(employee.id, shift);
      assigned++;
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
    if (!this.config.teamPattern) {
      console.log('   ℹ️ 팀 패턴 없음 - 건너뜀');
      return;
    }

    const pattern = this.config.teamPattern.pattern;
    let patternIndex = 0;
    let filledCount = 0;

    // 행정 근무자(weekday-only)를 제외한 교대 근무자만 대상
    const shiftEmployees = this.config.employees.filter(
      emp => emp.workPatternType !== 'weekday-only'
    );

    console.log(`   📋 팀 패턴: [${pattern.join(', ')}]`);
    console.log(`   👥 팀 패턴 적용 대상: 교대 근무자 ${shiftEmployees.length}명`);

    for (const day of this.workDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const daySchedule = this.schedule.get(dateStr);
      if (!daySchedule) continue;

      // Check if any employee is still unassigned
      const unassigned: string[] = [];
      for (const employee of shiftEmployees) {
        if (!daySchedule.has(employee.id)) {
          const shiftFromPattern = pattern[patternIndex % pattern.length];
          if (shiftFromPattern === 'D' || shiftFromPattern === 'E' || shiftFromPattern === 'N' || shiftFromPattern === 'OFF') {
            daySchedule.set(employee.id, shiftFromPattern);
            unassigned.push(`${employee.name} → ${shiftFromPattern}`);
            filledCount++;
          }
        }
      }

      if (unassigned.length > 0) {
        console.log(`   ${dateStr}: ${unassigned.join(', ')}`);
      }

      patternIndex++;
    }

    if (filledCount === 0) {
      console.log('   ✓ 모든 직원 배정 완료 (팀 패턴 불필요)');
    } else {
      console.log(`   ✓ ${filledCount}건 추가 배정 완료`);
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
    const shiftDist: Record<string, number> = { D: 0, E: 0, N: 0, A: 0, OFF: 0 };
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
