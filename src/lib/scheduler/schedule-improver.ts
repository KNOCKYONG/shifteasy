/**
 * 스케줄 개선 알고리즘 (Hill Climbing with Random Restarts)
 *
 * 기존 생성된 스케줄을 받아서 공정성, 효율성, 만족도를 개선
 * 기존 ai-scheduler.ts의 생성 로직과 완전히 분리된 최적화 전용 모듈
 */

import {
  Assignment,
  Employee,
  ScheduleConstraints,
  ImprovementResult,
  ImprovementReport,
  ImprovementSummary,
  MetricComparison,
  ScheduleChange,
  Recommendation,
  OptimizationOptions,
  OptimizationState,
  MetricsWithDetails,
} from './types';
import {
  calculateMetricsWithDetails,
  calculateGrade,
  assessImprovementPotential,
} from './metrics';

// ============================================================================
// ScheduleImprover 클래스
// ============================================================================

export class ScheduleImprover {
  private assignments: Assignment[];
  private employees: Employee[];
  private constraints: ScheduleConstraints;
  private options: OptimizationOptions;

  constructor(
    assignments: Assignment[],
    employees: Employee[],
    constraints: ScheduleConstraints,
    options?: Partial<OptimizationOptions>
  ) {
    this.assignments = this.cloneAssignments(assignments);
    this.employees = employees;
    this.constraints = constraints;

    // 기본 옵션 설정
    this.options = {
      maxIterations: options?.maxIterations ?? 100,
      maxNoImprovementIterations: options?.maxNoImprovementIterations ?? 10,
      minImprovementThreshold: options?.minImprovementThreshold ?? 0.5,
      weights: options?.weights ?? {
        fairness: 0.35,
        efficiency: 0.4,
        satisfaction: 0.25,
      },
      onProgress: options?.onProgress,
    };
  }

  /**
   * 메인 개선 함수
   */
  async improve(): Promise<ImprovementResult> {
    const startTime = Date.now();

    try {
      // 초기 상태 평가
      const originalAssignments = this.cloneAssignments(this.assignments);
      const beforeMetrics = calculateMetricsWithDetails(
        originalAssignments,
        this.employees,
        this.constraints,
        this.options.weights
      );

      // Hill Climbing 실행
      const { bestAssignments, changes, iterations } =
        await this.hillClimbing(beforeMetrics.totalScore);

      // 최종 상태 평가
      const afterMetrics = calculateMetricsWithDetails(
        bestAssignments,
        this.employees,
        this.constraints,
        this.options.weights
      );

      const processingTime = Date.now() - startTime;

      // 리포트 생성
      const report = this.generateReport(
        beforeMetrics,
        afterMetrics,
        changes,
        iterations,
        processingTime
      );

      return {
        improved: bestAssignments,
        report,
        success: true,
      };
    } catch (error) {
      console.error('Schedule improvement failed:', error);
      return {
        improved: this.assignments,
        report: this.generateEmptyReport(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Hill Climbing 알고리즘
   */
  private async hillClimbing(initialScore: number): Promise<{
    bestAssignments: Assignment[];
    changes: ScheduleChange[];
    iterations: number;
  }> {
    let bestAssignments = this.cloneAssignments(this.assignments);
    let bestScore = initialScore;
    const allChanges: ScheduleChange[] = [];

    const state: OptimizationState = {
      currentIteration: 0,
      bestScore: initialScore,
      noImprovementCount: 0,
      startTime: Date.now(),
      changes: [],
    };

    while (
      state.currentIteration < this.options.maxIterations &&
      state.noImprovementCount < this.options.maxNoImprovementIterations
    ) {
      // 이웃 해 생성
      const { neighbor, change } = this.generateNeighbor(bestAssignments);

      // 제약 조건 검증
      if (!this.isValid(neighbor)) {
        state.currentIteration++;
        continue;
      }

      // 점수 계산
      const neighborMetrics = calculateMetricsWithDetails(
        neighbor,
        this.employees,
        this.constraints,
        this.options.weights
      );

      const neighborScore = neighborMetrics.totalScore;

      // 개선되었으면 채택
      if (neighborScore > bestScore + this.options.minImprovementThreshold) {
        const improvement = neighborScore - bestScore;

        // 변경 사항 기록
        if (change) {
          const enhancedChange: ScheduleChange = {
            ...change,
            impact: {
              fairness: 0,
              efficiency: 0,
              satisfaction: 0,
              total: improvement,
            },
          };
          allChanges.push(enhancedChange);
        }

        bestAssignments = neighbor;
        bestScore = neighborScore;
        state.noImprovementCount = 0;

        // 진행 상황 콜백
        if (this.options.onProgress) {
          this.options.onProgress(state.currentIteration, bestScore);
        }
      } else {
        state.noImprovementCount++;
      }

      state.currentIteration++;
    }

    return {
      bestAssignments,
      changes: allChanges,
      iterations: state.currentIteration,
    };
  }

  /**
   * 이웃 해 생성
   */
  private generateNeighbor(schedule: Assignment[]): {
    neighbor: Assignment[];
    change: ScheduleChange | null;
  } {
    const operations = [
      () => this.swapShifts(schedule),
      () => this.reassignShift(schedule),
      () => this.balanceWorkload(schedule),
    ];

    // 랜덤하게 연산 선택
    const operation = operations[Math.floor(Math.random() * operations.length)];
    return operation();
  }

  /**
   * 연산 1: 시프트 교환
   */
  private swapShifts(schedule: Assignment[]): {
    neighbor: Assignment[];
    change: ScheduleChange | null;
  } {
    const neighbor = this.cloneAssignments(schedule);

    // 같은 날짜의 두 직원 선택
    const dates = Array.from(new Set(schedule.map((a) => a.date)));
    const randomDate = dates[Math.floor(Math.random() * dates.length)];

    const assignmentsOnDate = neighbor.filter((a) => a.date === randomDate);
    if (assignmentsOnDate.length < 2) {
      return { neighbor, change: null };
    }

    // 랜덤하게 두 직원 선택
    const idx1 = Math.floor(Math.random() * assignmentsOnDate.length);
    let idx2 = Math.floor(Math.random() * assignmentsOnDate.length);
    while (idx2 === idx1 && assignmentsOnDate.length > 1) {
      idx2 = Math.floor(Math.random() * assignmentsOnDate.length);
    }

    const assignment1 = assignmentsOnDate[idx1];
    const assignment2 = assignmentsOnDate[idx2];

    // 시프트 교환
    const temp = {
      shiftId: assignment1.shiftId,
      shiftType: assignment1.shiftType,
    };
    assignment1.shiftId = assignment2.shiftId;
    assignment1.shiftType = assignment2.shiftType;
    assignment2.shiftId = temp.shiftId;
    assignment2.shiftType = temp.shiftType;

    const emp1 = this.employees.find((e) => e.id === assignment1.employeeId);
    const emp2 = this.employees.find((e) => e.id === assignment2.employeeId);

    const change: ScheduleChange = {
      type: 'swap',
      date: randomDate,
      employees: [
        {
          id: assignment1.employeeId,
          name: emp1?.name || 'Unknown',
          before: temp.shiftId || temp.shiftType,
          after: assignment1.shiftId || assignment1.shiftType,
        },
        {
          id: assignment2.employeeId,
          name: emp2?.name || 'Unknown',
          before: assignment2.shiftId || assignment2.shiftType,
          after: temp.shiftId || temp.shiftType,
        },
      ],
      reason: '시프트 교환을 통한 최적화',
      description: `${emp1?.name} ↔ ${emp2?.name} 시프트 교환`,
      impact: { fairness: 0, efficiency: 0, satisfaction: 0, total: 0 },
    };

    return { neighbor, change };
  }

  /**
   * 연산 2: 시프트 재배정
   */
  private reassignShift(schedule: Assignment[]): {
    neighbor: Assignment[];
    change: ScheduleChange | null;
  } {
    const neighbor = this.cloneAssignments(schedule);

    // 랜덤 배정 선택
    const randomIdx = Math.floor(Math.random() * neighbor.length);
    const assignment = neighbor[randomIdx];

    const emp = this.employees.find((e) => e.id === assignment.employeeId);
    const beforeShift = assignment.shiftId || assignment.shiftType;

    // 시프트 변경 (간단한 예시: OFF와 근무 토글)
    const isCurrentlyOff = !assignment.shiftId && !assignment.shiftType;

    if (isCurrentlyOff) {
      // OFF → 근무로 변경
      assignment.shiftType = 'D'; // 주간 근무
    } else {
      // 근무 → OFF로 변경
      assignment.shiftId = undefined;
      assignment.shiftType = undefined;
    }

    const afterShift = assignment.shiftId || assignment.shiftType || 'OFF';

    const change: ScheduleChange = {
      type: 'reassign',
      date: assignment.date,
      employees: [
        {
          id: assignment.employeeId,
          name: emp?.name || 'Unknown',
          before: beforeShift,
          after: afterShift,
        },
      ],
      reason: '인력 조정',
      description: `${emp?.name}: ${beforeShift || 'OFF'} → ${afterShift}`,
      impact: { fairness: 0, efficiency: 0, satisfaction: 0, total: 0 },
    };

    return { neighbor, change };
  }

  /**
   * 연산 3: 근무량 균형화
   */
  private balanceWorkload(schedule: Assignment[]): {
    neighbor: Assignment[];
    change: ScheduleChange | null;
  } {
    const neighbor = this.cloneAssignments(schedule);

    // 근무일수 계산
    const workDays = new Map<string, number>();
    this.employees.forEach((emp) => workDays.set(emp.id, 0));

    neighbor.forEach((assignment) => {
      const isOff =
        !assignment.shiftId && !assignment.shiftType;
      if (!isOff) {
        const current = workDays.get(assignment.employeeId) || 0;
        workDays.set(assignment.employeeId, current + 1);
      }
    });

    // 평균 계산
    const total = Array.from(workDays.values()).reduce((a, b) => a + b, 0);
    const avg = total / workDays.size;

    // 과근무/과소근무 직원 찾기
    const overworked = Array.from(workDays.entries())
      .filter(([_, days]) => days > avg + 1.5)
      .map(([id]) => id);

    const underworked = Array.from(workDays.entries())
      .filter(([_, days]) => days < avg - 1.5)
      .map(([id]) => id);

    if (overworked.length === 0 || underworked.length === 0) {
      return { neighbor, change: null };
    }

    // 과근무 직원의 근무일 하나를 과소근무 직원에게 이전
    const overworkedId = overworked[0];
    const underworkedId = underworked[0];

    const overworkedAssignment = neighbor.find(
      (a) => a.employeeId === overworkedId && (a.shiftId || a.shiftType)
    );

    const underworkedAssignment = neighbor.find(
      (a) => a.employeeId === underworkedId && !a.shiftId && !a.shiftType
    );

    if (!overworkedAssignment || !underworkedAssignment) {
      return { neighbor, change: null };
    }

    // 교환
    const temp = {
      shiftId: overworkedAssignment.shiftId,
      shiftType: overworkedAssignment.shiftType,
    };

    overworkedAssignment.shiftId = undefined;
    overworkedAssignment.shiftType = undefined;

    underworkedAssignment.shiftId = temp.shiftId;
    underworkedAssignment.shiftType = temp.shiftType;

    const emp1 = this.employees.find((e) => e.id === overworkedId);
    const emp2 = this.employees.find((e) => e.id === underworkedId);

    const change: ScheduleChange = {
      type: 'swap',
      date: overworkedAssignment.date,
      employees: [
        {
          id: overworkedId,
          name: emp1?.name || 'Unknown',
          before: temp.shiftId || temp.shiftType,
          after: 'OFF',
        },
        {
          id: underworkedId,
          name: emp2?.name || 'Unknown',
          before: 'OFF',
          after: temp.shiftId || temp.shiftType,
        },
      ],
      reason: '근무일수 균형 조정',
      description: `${emp1?.name}(과근무) → ${emp2?.name}(과소근무) 시프트 이전`,
      impact: { fairness: 0, efficiency: 0, satisfaction: 0, total: 0 },
    };

    return { neighbor, change };
  }

  /**
   * 제약 조건 검증 (ai-scheduler.ts의 모든 중요 제약 반영)
   */
  private isValid(schedule: Assignment[]): boolean {
    // 기본 상수 정의
    const DEFAULT_MAX_CONSECUTIVE_NIGHTS = {
      'three-shift': 2,
      'night-intensive': 4,
      'weekday-only': 1,
    };

    const NIGHT_INTENSIVE_RECOVERY_MIN_STREAK = 3;
    const NIGHT_INTENSIVE_MIN_RECOVERY_DAYS = 2;
    const NIGHT_BLOCK_MIN_NON_PREF = 2;
    const NIGHT_BLOCK_RECOVERY_DAYS = 2;

    // ========================================================================
    // 1. 직원별 제약 검증
    // ========================================================================
    const employeeSchedules = new Map<string, Assignment[]>();

    schedule.forEach((assignment) => {
      if (!employeeSchedules.has(assignment.employeeId)) {
        employeeSchedules.set(assignment.employeeId, []);
      }
      employeeSchedules.get(assignment.employeeId)!.push(assignment);
    });

    for (const [employeeId, assignments] of employeeSchedules) {
      const employee = this.employees.find((e) => e.id === employeeId);
      if (!employee) continue;

      const sorted = [...assignments].sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      const workPattern = employee.workPatternType || 'three-shift';
      const maxConsecutiveNights =
        employee.maxConsecutiveNightsPreferred ??
        this.constraints.maxConsecutiveNights ??
        DEFAULT_MAX_CONSECUTIVE_NIGHTS[workPattern];

      let consecutiveWorkDays = 0;
      let consecutiveNights = 0;
      let consecutiveOffDays = 0;
      let nightRecoveryNeeded = 0;
      let lastShift: string | null = null;
      let offDaysCount = 0;

      for (let i = 0; i < sorted.length; i++) {
        const assignment = sorted[i];
        const shiftCode = this.extractShiftCode(assignment);
        const isOff = this.isOffShift(shiftCode);
        const isNight = shiftCode === 'N';

        // OFF 카운트
        if (isOff) {
          offDaysCount++;
        }

        // 연속 근무/휴무 카운트
        if (isOff) {
          consecutiveOffDays++;
          consecutiveWorkDays = 0;
          consecutiveNights = 0;

          if (nightRecoveryNeeded > 0) {
            nightRecoveryNeeded--;
          }
        } else {
          consecutiveWorkDays++;
          consecutiveOffDays = 0;

          if (isNight) {
            consecutiveNights++;
          } else {
            consecutiveNights = 0;
          }
        }

        // ----------------------------------------------------------------
        // 검증 1: 최대 연속 근무일 초과
        // ----------------------------------------------------------------
        if (consecutiveWorkDays > this.constraints.maxConsecutiveDays) {
          return false;
        }

        // ----------------------------------------------------------------
        // 검증 2: 최대 연속 야간 근무일 초과
        // ----------------------------------------------------------------
        if (consecutiveNights > maxConsecutiveNights) {
          return false;
        }

        // ----------------------------------------------------------------
        // 검증 3: N → D 직접 전환 금지
        // ----------------------------------------------------------------
        if (lastShift === 'N' && shiftCode === 'D') {
          return false;
        }

        // ----------------------------------------------------------------
        // 검증 4: 야간 회복 휴무 필요
        // ----------------------------------------------------------------
        // night-intensive의 경우
        if (workPattern === 'night-intensive' && lastShift === 'N' && !isNight && !isOff) {
          if (consecutiveNights >= NIGHT_INTENSIVE_RECOVERY_MIN_STREAK) {
            return false; // 야간 후 회복 휴무 없이 다른 근무 배정 불가
          }
        }

        // 일반 직원의 야간 블록
        if (
          workPattern !== 'night-intensive' &&
          lastShift === 'N' &&
          !isNight &&
          !isOff
        ) {
          const prevConsecutiveNights = consecutiveNights; // 이전 연속 야간
          if (prevConsecutiveNights >= NIGHT_BLOCK_MIN_NON_PREF) {
            return false; // 야간 블록 후 회복 휴무 필요
          }
        }

        // ----------------------------------------------------------------
        // 검증 5: 직원 유형별 규칙
        // ----------------------------------------------------------------
        // night-intensive는 야간(N)만 가능
        if (workPattern === 'night-intensive' && !isOff && shiftCode !== 'N') {
          return false;
        }

        // weekday-only는 주말/공휴일에 근무 불가
        if (workPattern === 'weekday-only' && !isOff) {
          const date = assignment.date;
          const dayOfWeek = new Date(date).getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isHoliday = this.constraints.holidays?.includes(date) ?? false;

          if (isWeekend || isHoliday) {
            return false;
          }
        }

        // ----------------------------------------------------------------
        // 검증 6: 최소 휴무일 (엄격하게)
        // ----------------------------------------------------------------
        if (
          consecutiveOffDays > 0 &&
          consecutiveOffDays < this.constraints.minRestDays &&
          i < sorted.length - 1 &&
          !this.isOffShift(this.extractShiftCode(sorted[i + 1]))
        ) {
          // 다음 날이 근무인데 최소 휴무일을 채우지 못함
          return false;
        }

        lastShift = shiftCode;
      }

      // ----------------------------------------------------------------
      // 검증 7: 보장 휴무일 침해 금지
      // ----------------------------------------------------------------
      if (employee.guaranteedOffDays && offDaysCount < employee.guaranteedOffDays) {
        // 보장 휴무일보다 적으면 거부
        return false;
      }
    }

    // ========================================================================
    // 2. 일별 인력 커버리지 검증
    // ========================================================================
    if (this.constraints.requiredStaffPerShift) {
      const dailyShifts = new Map<string, Map<string, number>>();

      schedule.forEach((assignment) => {
        const date = assignment.date;
        const shiftCode = this.extractShiftCode(assignment);

        if (this.isOffShift(shiftCode)) return;

        if (!dailyShifts.has(date)) {
          dailyShifts.set(date, new Map());
        }

        const dateShifts = dailyShifts.get(date)!;
        dateShifts.set(shiftCode, (dateShifts.get(shiftCode) || 0) + 1);
      });

      // 각 날짜별로 필수 인원 체크
      for (const [date, shifts] of dailyShifts) {
        for (const [shiftCode, required] of Object.entries(
          this.constraints.requiredStaffPerShift
        )) {
          const actual = shifts.get(shiftCode) || 0;
          if (actual < required) {
            // 필수 인원 미달
            return false;
          }
        }
      }
    }

    // ========================================================================
    // 3. 기피 패턴 검증
    // ========================================================================
    if (this.constraints.avoidPatterns && this.constraints.avoidPatterns.length > 0) {
      for (const [employeeId, assignments] of employeeSchedules) {
        const sorted = [...assignments].sort((a, b) =>
          a.date.localeCompare(b.date)
        );

        for (let i = 0; i < sorted.length - 1; i++) {
          const currentShift = this.extractShiftCode(sorted[i]);
          const nextShift = this.extractShiftCode(sorted[i + 1]);

          for (const pattern of this.constraints.avoidPatterns) {
            if (pattern.length === 2 && pattern[0] === currentShift && pattern[1] === nextShift) {
              // 기피 패턴 발견
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  /**
   * 시프트 코드 추출
   */
  private extractShiftCode(assignment: Assignment): string {
    if (assignment.shiftType) {
      return assignment.shiftType.toUpperCase();
    }
    if (assignment.shiftId) {
      const id = assignment.shiftId.toLowerCase();
      if (id.startsWith('shift-')) {
        return id.replace('shift-', '').toUpperCase();
      }
      return id.toUpperCase();
    }
    return 'O'; // 기본값: OFF
  }

  /**
   * OFF 시프트 여부 확인
   */
  private isOffShift(shiftCode: string): boolean {
    const normalized = shiftCode.toUpperCase();
    return (
      normalized === 'O' ||
      normalized === 'OFF' ||
      normalized === 'L' ||
      normalized === 'LEAVE'
    );
  }

  /**
   * 리포트 생성
   */
  private generateReport(
    before: MetricsWithDetails,
    after: MetricsWithDetails,
    changes: ScheduleChange[],
    iterations: number,
    processingTime: number
  ): ImprovementReport {
    // 요약 생성
    const summary: ImprovementSummary = {
      totalImprovement: after.totalScore - before.totalScore,
      gradeChange: {
        from: before.grade,
        to: after.grade,
        improved: after.totalScore > before.totalScore,
      },
      iterations,
      processingTime,
      totalChanges: changes.length,
      furtherImprovementPotential: assessImprovementPotential(
        after.totalScore,
        before.totalScore,
        iterations
      ),
    };

    // 메트릭 비교
    const metrics: MetricComparison = {
      before,
      after,
      improvements: {
        fairness: {
          scoreDelta: after.fairness.score - before.fairness.score,
          percentageImprovement:
            before.fairness.score > 0
              ? ((after.fairness.score - before.fairness.score) /
                  before.fairness.score) *
                100
              : 0,
          keyImprovements: this.generateFairnessImprovements(before, after),
        },
        efficiency: {
          scoreDelta: after.efficiency.score - before.efficiency.score,
          percentageImprovement:
            before.efficiency.score > 0
              ? ((after.efficiency.score - before.efficiency.score) /
                  before.efficiency.score) *
                100
              : 0,
          keyImprovements: this.generateEfficiencyImprovements(before, after),
        },
        satisfaction: {
          scoreDelta: after.satisfaction.score - before.satisfaction.score,
          percentageImprovement:
            before.satisfaction.score > 0
              ? ((after.satisfaction.score - before.satisfaction.score) /
                  before.satisfaction.score) *
                100
              : 0,
          keyImprovements: this.generateSatisfactionImprovements(before, after),
        },
      },
    };

    // 추천 사항 생성
    const recommendations = this.generateRecommendations(summary, after);

    return {
      summary,
      metrics,
      changes,
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 공정성 개선 사항 생성
   */
  private generateFairnessImprovements(
    before: MetricsWithDetails,
    after: MetricsWithDetails
  ): string[] {
    const improvements: string[] = [];

    const giniImprovement =
      before.fairness.details.giniCoefficient -
      after.fairness.details.giniCoefficient;

    if (giniImprovement > 0.05) {
      improvements.push(
        `Gini 계수 ${giniImprovement.toFixed(2)} 감소 (불평등도 개선)`
      );
    }

    const beforeRange =
      before.fairness.details.workloadRange.max -
      before.fairness.details.workloadRange.min;
    const afterRange =
      after.fairness.details.workloadRange.max -
      after.fairness.details.workloadRange.min;

    if (afterRange < beforeRange) {
      improvements.push(
        `근무일수 격차 ${beforeRange}일 → ${afterRange}일로 감소`
      );
    }

    const problemReduction =
      before.fairness.details.problemEmployees.length -
      after.fairness.details.problemEmployees.length;

    if (problemReduction > 0) {
      improvements.push(`문제 직원 ${problemReduction}명 해결`);
    }

    return improvements.length > 0
      ? improvements
      : ['공정성 유지 또는 소폭 개선'];
  }

  /**
   * 효율성 개선 사항 생성
   */
  private generateEfficiencyImprovements(
    before: MetricsWithDetails,
    after: MetricsWithDetails
  ): string[] {
    const improvements: string[] = [];

    const understaffedReduction =
      before.efficiency.details.stats.understaffedDays -
      after.efficiency.details.stats.understaffedDays;

    if (understaffedReduction > 0) {
      improvements.push(`인력 부족 일수 ${understaffedReduction}일 감소`);
    }

    const overstaffedReduction =
      before.efficiency.details.stats.overstaffedDays -
      after.efficiency.details.stats.overstaffedDays;

    if (overstaffedReduction > 0) {
      improvements.push(`과잉 인력 일수 ${overstaffedReduction}일 감소`);
    }

    const optimalIncrease =
      after.efficiency.details.stats.optimalDays -
      before.efficiency.details.stats.optimalDays;

    if (optimalIncrease > 0) {
      improvements.push(`최적 인력 일수 ${optimalIncrease}일 증가`);
    }

    return improvements.length > 0
      ? improvements
      : ['효율성 유지 또는 소폭 개선'];
  }

  /**
   * 만족도 개선 사항 생성
   */
  private generateSatisfactionImprovements(
    before: MetricsWithDetails,
    after: MetricsWithDetails
  ): string[] {
    const improvements: string[] = [];

    const violationReduction =
      before.satisfaction.details.violations.length -
      after.satisfaction.details.violations.length;

    if (violationReduction > 0) {
      improvements.push(`선호도 위반 ${violationReduction}건 해소`);
    }

    const rateImprovement =
      after.satisfaction.details.satisfactionRate -
      before.satisfaction.details.satisfactionRate;

    if (rateImprovement > 5) {
      improvements.push(
        `만족률 ${rateImprovement.toFixed(1)}% 향상`
      );
    }

    return improvements.length > 0
      ? improvements
      : ['만족도 유지 또는 소폭 개선'];
  }

  /**
   * 추천 사항 생성
   */
  private generateRecommendations(
    summary: ImprovementSummary,
    after: MetricsWithDetails
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // 추가 개선 가능성
    if (summary.furtherImprovementPotential === 'high') {
      recommendations.push({
        type: 'continue_improving',
        message: '추가 개선 가능성이 높습니다. "개선" 버튼을 한 번 더 클릭해보세요.',
        priority: 'high',
        actionable: true,
      });
    } else if (summary.furtherImprovementPotential === 'medium') {
      recommendations.push({
        type: 'continue_improving',
        message: '조금 더 개선할 수 있습니다. 필요시 한 번 더 실행해보세요.',
        priority: 'medium',
        actionable: true,
      });
    } else if (summary.furtherImprovementPotential === 'none') {
      recommendations.push({
        type: 'excellent',
        message: '현재 상태가 거의 최적입니다. 추가 개선이 어려울 수 있습니다.',
        priority: 'low',
        actionable: false,
      });
    }

    // 등급별 안내
    if (after.grade === 'S' || after.grade === 'A') {
      recommendations.push({
        type: 'excellent',
        message: `현재 등급 ${after.grade}는 상위 10% 수준입니다. 훌륭합니다!`,
        priority: 'low',
        actionable: false,
      });
    } else if (after.grade === 'B') {
      recommendations.push({
        type: 'satisfactory',
        message: '평균 이상의 좋은 스케줄입니다.',
        priority: 'medium',
        actionable: false,
      });
    } else {
      recommendations.push({
        type: 'warning',
        message: '스케줄에 개선이 필요합니다. 추가 최적화를 권장합니다.',
        priority: 'high',
        actionable: true,
      });
    }

    return recommendations;
  }

  /**
   * 빈 리포트 생성 (에러 시)
   */
  private generateEmptyReport(): ImprovementReport {
    const emptyMetrics: MetricsWithDetails = {
      fairness: {
        score: 0,
        details: {
          giniCoefficient: 0,
          workloadDistribution: [],
          workloadRange: { min: 0, max: 0, avg: 0, median: 0 },
          problemEmployees: [],
        },
      },
      efficiency: {
        score: 0,
        details: {
          dailyStaffing: [],
          stats: {
            understaffedDays: 0,
            overstaffedDays: 0,
            optimalDays: 0,
            totalDays: 0,
          },
          staffingProblems: [],
        },
      },
      satisfaction: {
        score: 0,
        details: {
          totalPreferences: 0,
          satisfiedPreferences: 0,
          satisfactionRate: 0,
          violations: [],
          employeeSatisfaction: [],
        },
      },
      totalScore: 0,
      grade: 'F',
    };

    return {
      summary: {
        totalImprovement: 0,
        gradeChange: { from: 'F', to: 'F', improved: false },
        iterations: 0,
        processingTime: 0,
        totalChanges: 0,
        furtherImprovementPotential: 'none',
      },
      metrics: {
        before: emptyMetrics,
        after: emptyMetrics,
        improvements: {
          fairness: {
            scoreDelta: 0,
            percentageImprovement: 0,
            keyImprovements: [],
          },
          efficiency: {
            scoreDelta: 0,
            percentageImprovement: 0,
            keyImprovements: [],
          },
          satisfaction: {
            scoreDelta: 0,
            percentageImprovement: 0,
            keyImprovements: [],
          },
        },
      },
      changes: [],
      recommendations: [
        {
          type: 'warning',
          message: '개선 중 오류가 발생했습니다.',
          priority: 'high',
          actionable: false,
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 배정 복사
   */
  private cloneAssignments(assignments: Assignment[]): Assignment[] {
    return assignments.map((a) => ({ ...a }));
  }
}
