import { type Staff, type Assignment, type ShiftType, type WeekSchedule } from '@/lib/types';
import { addDays, startOfWeek, format } from 'date-fns';
import { differenceInHours } from 'date-fns/differenceInHours';

export interface ValidationResult {
  isValid: boolean;
  violations: Array<{
    type: 'hard' | 'soft';
    rule: string;
    message: string;
    staffId?: string;
    date?: string;
  }>;
  score: number;
}

export interface OptimizationConfig {
  maxConsecutiveDays: number;
  minRestHours: number;
  maxWeeklyHours: number;
  minStaffPerShift: Record<ShiftType, number>;
  fairnessWeight: number;
  preferenceWeight: number;
}

export interface OptimizedSchedule {
  schedule: WeekSchedule;
  fairnessScore: number;
  validationResult: ValidationResult;
  metrics: {
    coverageRate: number;
    preferenceRate: number;
    distributionBalance: number;
    processingTime: number;
  };
}

export class ScheduleOptimizer {
  private config: OptimizationConfig;
  private staff: Staff[];
  private startDate: Date;

  constructor(staff: Staff[], startDate: Date, config: Partial<OptimizationConfig> = {}) {
    this.staff = staff;
    this.startDate = startOfWeek(startDate, { weekStartsOn: 0 });
    this.config = {
      maxConsecutiveDays: 5,
      minRestHours: 11,
      maxWeeklyHours: 52,
      minStaffPerShift: { D: 3, E: 2, N: 2, O: 0 },
      fairnessWeight: 0.7,
      preferenceWeight: 0.3,
      ...config
    };
  }

  /**
   * 제약 조건 검증
   */
  validateConstraints(schedule: WeekSchedule): ValidationResult {
    const violations: ValidationResult['violations'] = [];
    let score = 100;

    for (const [staffId, shifts] of Object.entries(schedule)) {
      const staff = this.staff.find(s => s.id === staffId);
      if (!staff) continue;

      // 1. 연속 근무 일수 체크
      let consecutiveDays = 0;
      for (let day = 0; day < 7; day++) {
        if (shifts[day] && shifts[day] !== 'O') {
          consecutiveDays++;
          if (consecutiveDays > this.config.maxConsecutiveDays) {
            violations.push({
              type: 'hard',
              rule: 'maxConsecutiveDays',
              message: `${staff.name}님이 ${consecutiveDays}일 연속 근무 (최대 ${this.config.maxConsecutiveDays}일)`,
              staffId,
              date: format(addDays(this.startDate, day), 'yyyy-MM-dd')
            });
            score -= 10;
          }
        } else {
          consecutiveDays = 0;
        }
      }

      // 2. 주간 근무 시간 체크
      const weeklyHours = this.calculateWeeklyHours(shifts);
      if (weeklyHours > this.config.maxWeeklyHours) {
        violations.push({
          type: 'hard',
          rule: 'maxWeeklyHours',
          message: `${staff.name}님의 주간 근무 시간 ${weeklyHours}시간 (최대 ${this.config.maxWeeklyHours}시간)`,
          staffId
        });
        score -= 15;
      }

      // 3. 휴식 시간 체크 (연속 근무 간)
      for (let day = 0; day < 6; day++) {
        const currentShift = shifts[day];
        const nextShift = shifts[day + 1];

        if (currentShift && nextShift && currentShift !== 'O' && nextShift !== 'O') {
          const restHours = this.calculateRestHours(currentShift, nextShift);
          if (restHours < this.config.minRestHours) {
            violations.push({
              type: 'hard',
              rule: 'minRestHours',
              message: `${staff.name}님의 휴식 시간 부족 (${restHours}시간, 최소 ${this.config.minRestHours}시간)`,
              staffId,
              date: format(addDays(this.startDate, day), 'yyyy-MM-dd')
            });
            score -= 8;
          }
        }
      }
    }

    // 4. 최소 인원 배치 체크
    for (let day = 0; day < 7; day++) {
      const shiftCounts = this.countStaffPerShift(schedule, day);

      for (const [shift, minCount] of Object.entries(this.config.minStaffPerShift)) {
        if (shift === 'O') continue;
        const actualCount = shiftCounts[shift as ShiftType] || 0;
        if (actualCount < minCount) {
          violations.push({
            type: 'hard',
            rule: 'minStaffPerShift',
            message: `${format(addDays(this.startDate, day), 'MM/dd')} ${shift} 근무 인원 부족 (${actualCount}명, 최소 ${minCount}명)`,
            date: format(addDays(this.startDate, day), 'yyyy-MM-dd')
          });
          score -= 12;
        }
      }
    }

    return {
      isValid: violations.filter(v => v.type === 'hard').length === 0,
      violations,
      score: Math.max(0, score)
    };
  }

  /**
   * 공정성 점수 계산 (Gini 계수 기반)
   */
  calculateFairness(schedule: WeekSchedule): number {
    const workloads: number[] = [];
    const nightShifts: number[] = [];
    const weekendShifts: number[] = [];

    for (const staffId of this.staff.map(s => s.id)) {
      const shifts = schedule[staffId] || {};
      let totalHours = 0;
      let nightCount = 0;
      let weekendCount = 0;

      for (let day = 0; day < 7; day++) {
        const shift = shifts[day];
        if (shift && shift !== 'O') {
          totalHours += this.getShiftHours(shift);
          if (shift === 'N') nightCount++;
          if (day === 0 || day === 6) weekendCount++; // 일요일, 토요일
        }
      }

      workloads.push(totalHours);
      nightShifts.push(nightCount);
      weekendShifts.push(weekendCount);
    }

    // Gini 계수 계산 (0: 완전 평등, 1: 완전 불평등)
    const workloadGini = this.calculateGiniCoefficient(workloads);
    const nightGini = this.calculateGiniCoefficient(nightShifts);
    const weekendGini = this.calculateGiniCoefficient(weekendShifts);

    // 공정성 점수 (100점 만점, Gini가 낮을수록 높은 점수)
    const fairnessScore = 100 * (1 - (workloadGini * 0.5 + nightGini * 0.3 + weekendGini * 0.2));

    return Math.round(fairnessScore);
  }

  /**
   * 스케줄 최적화 (탐욕 알고리즘 + 국소 탐색)
   */
  optimize(): OptimizedSchedule {
    const startTime = Date.now();

    // 1단계: 탐욕 알고리즘으로 초기 스케줄 생성
    let schedule = this.generateInitialSchedule();

    // 2단계: 국소 탐색으로 개선
    const maxIterations = 100;
    let bestSchedule = schedule;
    let bestScore = this.evaluateSchedule(schedule);

    for (let i = 0; i < maxIterations; i++) {
      const newSchedule = this.localSearch(schedule);
      const newScore = this.evaluateSchedule(newSchedule);

      if (newScore > bestScore) {
        bestSchedule = newSchedule;
        bestScore = newScore;
        schedule = newSchedule;
      }
    }

    const validationResult = this.validateConstraints(bestSchedule);
    const fairnessScore = this.calculateFairness(bestSchedule);
    const processingTime = Date.now() - startTime;

    return {
      schedule: bestSchedule,
      fairnessScore,
      validationResult,
      metrics: {
        coverageRate: this.calculateCoverageRate(bestSchedule),
        preferenceRate: this.calculatePreferenceRate(bestSchedule),
        distributionBalance: fairnessScore / 100,
        processingTime
      }
    };
  }

  /**
   * 초기 스케줄 생성 (탐욕 알고리즘)
   */
  private generateInitialSchedule(): WeekSchedule {
    const schedule: WeekSchedule = {};
    const shiftPattern: ShiftType[] = ['D', 'D', 'E', 'E', 'N', 'O', 'O'];

    // 각 직원에게 균등하게 시프트 배정
    this.staff.forEach((staff, index) => {
      schedule[staff.id] = {};

      for (let day = 0; day < 7; day++) {
        // 순환 패턴으로 초기 배정
        const patternIndex = (index + day) % shiftPattern.length;
        schedule[staff.id][day] = shiftPattern[patternIndex];
      }
    });

    return schedule;
  }

  /**
   * 국소 탐색 (스왑을 통한 개선)
   */
  private localSearch(schedule: WeekSchedule): WeekSchedule {
    const newSchedule = JSON.parse(JSON.stringify(schedule));
    const staffIds = Object.keys(newSchedule);

    // 랜덤하게 두 직원의 특정 날짜 시프트를 교환
    const staff1 = staffIds[Math.floor(Math.random() * staffIds.length)];
    const staff2 = staffIds[Math.floor(Math.random() * staffIds.length)];
    const day = Math.floor(Math.random() * 7);

    if (staff1 !== staff2) {
      const temp = newSchedule[staff1][day];
      newSchedule[staff1][day] = newSchedule[staff2][day];
      newSchedule[staff2][day] = temp;
    }

    return newSchedule;
  }

  /**
   * 스케줄 평가
   */
  private evaluateSchedule(schedule: WeekSchedule): number {
    const validation = this.validateConstraints(schedule);
    const fairness = this.calculateFairness(schedule);

    // 제약 조건 위반이 있으면 큰 페널티
    const constraintScore = validation.isValid ? validation.score : validation.score * 0.5;

    // 종합 점수 계산
    return constraintScore * 0.6 + fairness * 0.4;
  }

  /**
   * 유틸리티 함수들
   */
  private calculateWeeklyHours(shifts: Record<number, ShiftType>): number {
    let totalHours = 0;
    for (const shift of Object.values(shifts)) {
      if (shift && shift !== 'O') {
        totalHours += this.getShiftHours(shift);
      }
    }
    return totalHours;
  }

  private getShiftHours(shift: ShiftType): number {
    const hours: Record<ShiftType, number> = {
      D: 8,
      E: 8,
      N: 10,
      O: 0
    };
    return hours[shift] || 0;
  }

  private calculateRestHours(currentShift: ShiftType, nextShift: ShiftType): number {
    const shiftEndTimes: Record<ShiftType, number> = {
      D: 15, // 3 PM
      E: 23, // 11 PM
      N: 7,  // 7 AM (next day)
      O: 0
    };

    const shiftStartTimes: Record<ShiftType, number> = {
      D: 7,  // 7 AM
      E: 15, // 3 PM
      N: 23, // 11 PM
      O: 0
    };

    if (currentShift === 'O' || nextShift === 'O') {
      return 24;
    }

    const endTime = shiftEndTimes[currentShift];
    let startTime = shiftStartTimes[nextShift];

    // 야간 근무 후 주간 근무의 경우
    if (currentShift === 'N' && nextShift === 'D') {
      startTime += 24; // 다음날 아침
    }

    return Math.abs(startTime - endTime);
  }

  private countStaffPerShift(schedule: WeekSchedule, day: number): Record<ShiftType, number> {
    const counts: Record<ShiftType, number> = { D: 0, E: 0, N: 0, O: 0 };

    for (const shifts of Object.values(schedule)) {
      const shift = shifts[day];
      if (shift) {
        counts[shift]++;
      }
    }

    return counts;
  }

  private calculateGiniCoefficient(values: number[]): number {
    if (values.length === 0) return 0;

    const sortedValues = [...values].sort((a, b) => a - b);
    const n = sortedValues.length;
    const totalSum = sortedValues.reduce((sum, val) => sum + val, 0);

    if (totalSum === 0) return 0;

    let cumulativeSum = 0;
    let giniSum = 0;

    for (let i = 0; i < n; i++) {
      cumulativeSum += sortedValues[i];
      giniSum += (n - i) * sortedValues[i];
    }

    return (n + 1 - 2 * giniSum / totalSum) / n;
  }

  private calculateCoverageRate(schedule: WeekSchedule): number {
    let totalRequired = 0;
    let totalFilled = 0;

    for (let day = 0; day < 7; day++) {
      const counts = this.countStaffPerShift(schedule, day);

      for (const [shift, minCount] of Object.entries(this.config.minStaffPerShift)) {
        if (shift !== 'O') {
          totalRequired += minCount;
          totalFilled += Math.min(counts[shift as ShiftType], minCount);
        }
      }
    }

    return totalRequired > 0 ? totalFilled / totalRequired : 1;
  }

  private calculatePreferenceRate(schedule: WeekSchedule): number {
    // 선호도 충족률 계산 (추후 선호도 데이터와 연동)
    // 현재는 임시로 70% 반환
    return 0.7;
  }
}