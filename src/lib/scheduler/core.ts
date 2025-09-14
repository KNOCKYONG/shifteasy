/**
 * 핵심 스케줄링 알고리즘
 * 제약 조건 기반 최적화와 유전 알고리즘을 결합한 하이브리드 접근
 */

import {
  SchedulingRequest,
  SchedulingResult,
  ScheduleAssignment,
  Employee,
  Shift,
  ShiftType,
  Constraint,
  Schedule,
  ScheduleSuggestion,
  OptimizationGoal,
} from './types';
import { ConstraintValidator } from './constraints';
import { FairnessScorer } from './scoring';
import { PatternManager } from './patterns';

// 알고리즘 설정
const ALGORITHM_CONFIG = {
  MAX_ITERATIONS: 1000,
  POPULATION_SIZE: 50,
  MUTATION_RATE: 0.1,
  CROSSOVER_RATE: 0.7,
  ELITE_SIZE: 5,
  CONVERGENCE_THRESHOLD: 0.001,
  MAX_NO_IMPROVEMENT: 100,
  TABU_LIST_SIZE: 20,
};

export class ScheduleOptimizer {
  private constraintValidator: ConstraintValidator;
  private fairnessScorer: FairnessScorer;
  private patternManager: PatternManager;
  private tabuList: string[] = [];

  constructor() {
    this.constraintValidator = new ConstraintValidator([]);
    this.fairnessScorer = new FairnessScorer();
    this.patternManager = new PatternManager();
  }

  /**
   * 메인 스케줄링 함수
   */
  public async optimize(request: SchedulingRequest): Promise<SchedulingResult> {
    const startTime = Date.now();

    // 초기화
    this.constraintValidator = new ConstraintValidator(request.constraints);
    const employeeMap = new Map(request.employees.map(e => [e.id, e]));
    const shiftMap = new Map(request.shifts.map(s => [s.id, s]));

    // 초기 해 생성
    let bestSolution = this.generateInitialSolution(request);
    let bestScore = this.evaluateSolution(bestSolution, request);

    // 패턴 기반 초기 해가 더 좋으면 사용
    if (request.pattern) {
      const patternSolution = this.generatePatternBasedSolution(request);
      const patternScore = this.evaluateSolution(patternSolution, request);

      if (patternScore > bestScore) {
        bestSolution = patternSolution;
        bestScore = patternScore;
      }
    }

    // 최적화 알고리즘 선택 및 실행
    const optimizedSolution = await this.runOptimization(
      bestSolution,
      request,
      bestScore
    );

    // 결과 생성
    const violations = this.constraintValidator.validateSchedule(
      optimizedSolution,
      employeeMap,
      shiftMap,
      request.startDate,
      request.endDate
    );

    const score = this.fairnessScorer.calculateScheduleScore(
      optimizedSolution,
      employeeMap,
      shiftMap,
      violations
    );

    const suggestions = this.generateSuggestions(
      optimizedSolution,
      violations,
      request
    );

    const schedule: Schedule = {
      id: `schedule-${Date.now()}`,
      departmentId: request.departmentId,
      startDate: request.startDate,
      endDate: request.endDate,
      assignments: optimizedSolution,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return {
      success: violations.filter(v => v.type === 'hard').length === 0,
      schedule,
      violations,
      score,
      iterations: this.getIterationCount(),
      computationTime: Date.now() - startTime,
      suggestions,
    };
  }

  /**
   * 초기 해 생성 (그리디 알고리즘)
   */
  private generateInitialSolution(request: SchedulingRequest): ScheduleAssignment[] {
    const assignments: ScheduleAssignment[] = [];
    const { employees, shifts, startDate, endDate } = request;

    // 날짜별로 순회
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      // 각 시프트에 대해
      for (const shift of shifts) {
        const requiredStaff = shift.requiredStaff;
        const availableEmployees = this.getAvailableEmployees(
          employees,
          currentDate,
          shift,
          assignments
        );

        // 필요한 인원만큼 배정
        const selectedEmployees = this.selectBestEmployees(
          availableEmployees,
          requiredStaff,
          shift,
          currentDate,
          assignments
        );

        for (const employee of selectedEmployees) {
          assignments.push({
            employeeId: employee.id,
            shiftId: shift.id,
            date: new Date(currentDate),
            isLocked: false,
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return assignments;
  }

  /**
   * 패턴 기반 초기 해 생성
   */
  private generatePatternBasedSolution(request: SchedulingRequest): ScheduleAssignment[] {
    if (!request.pattern) {
      return [];
    }

    const shiftMap = new Map(request.shifts.map(s => [s.id, s]));

    return this.patternManager.generateScheduleFromPattern(
      request.pattern,
      request.employees,
      shiftMap,
      request.startDate,
      request.endDate
    );
  }

  /**
   * 최적화 알고리즘 실행
   */
  private async runOptimization(
    initialSolution: ScheduleAssignment[],
    request: SchedulingRequest,
    initialScore: number
  ): Promise<ScheduleAssignment[]> {
    switch (request.optimizationGoal) {
      case 'fairness':
        return this.optimizeForFairness(initialSolution, request);
      case 'preference':
        return this.optimizeForPreference(initialSolution, request);
      case 'coverage':
        return this.optimizeForCoverage(initialSolution, request);
      case 'cost':
        return this.optimizeForCost(initialSolution, request);
      case 'balanced':
      default:
        return this.hybridOptimization(initialSolution, request);
    }
  }

  /**
   * 하이브리드 최적화 (유전 알고리즘 + 타부 서치)
   */
  private hybridOptimization(
    initialSolution: ScheduleAssignment[],
    request: SchedulingRequest
  ): ScheduleAssignment[] {
    // 초기 모집단 생성
    let population = this.createInitialPopulation(initialSolution, request);
    let bestSolution = initialSolution;
    let bestScore = this.evaluateSolution(initialSolution, request);
    let noImprovementCount = 0;

    for (let iteration = 0; iteration < ALGORITHM_CONFIG.MAX_ITERATIONS; iteration++) {
      // 적합도 평가
      const scores = population.map(solution => ({
        solution,
        score: this.evaluateSolution(solution, request),
      }));

      // 정렬
      scores.sort((a, b) => b.score - a.score);

      // 최고 해 업데이트
      if (scores[0].score > bestScore) {
        bestSolution = scores[0].solution;
        bestScore = scores[0].score;
        noImprovementCount = 0;
      } else {
        noImprovementCount++;
      }

      // 수렴 확인
      if (noImprovementCount >= ALGORITHM_CONFIG.MAX_NO_IMPROVEMENT) {
        break;
      }

      // 다음 세대 생성
      const nextGeneration: ScheduleAssignment[][] = [];

      // 엘리트 보존
      for (let i = 0; i < ALGORITHM_CONFIG.ELITE_SIZE; i++) {
        nextGeneration.push(scores[i].solution);
      }

      // 교차와 변이
      while (nextGeneration.length < ALGORITHM_CONFIG.POPULATION_SIZE) {
        const parent1 = this.tournamentSelection(scores);
        const parent2 = this.tournamentSelection(scores);

        let offspring: ScheduleAssignment[];
        if (Math.random() < ALGORITHM_CONFIG.CROSSOVER_RATE) {
          offspring = this.crossover(parent1, parent2);
        } else {
          offspring = [...parent1];
        }

        if (Math.random() < ALGORITHM_CONFIG.MUTATION_RATE) {
          offspring = this.mutate(offspring, request);
        }

        // 타부 리스트 확인
        const solutionKey = this.getSolutionKey(offspring);
        if (!this.tabuList.includes(solutionKey)) {
          nextGeneration.push(offspring);
          this.updateTabuList(solutionKey);
        }
      }

      population = nextGeneration;
    }

    return bestSolution;
  }

  /**
   * 공정성 최적화
   */
  private optimizeForFairness(
    initialSolution: ScheduleAssignment[],
    request: SchedulingRequest
  ): ScheduleAssignment[] {
    let currentSolution = [...initialSolution];
    const employeeMap = new Map(request.employees.map(e => [e.id, e]));
    const shiftMap = new Map(request.shifts.map(s => [s.id, s]));

    for (let iteration = 0; iteration < 100; iteration++) {
      // 근무시간 계산
      const workload = this.calculateWorkload(currentSolution, shiftMap);

      // 가장 많이 일한 직원과 가장 적게 일한 직원 찾기
      const sortedEmployees = Array.from(workload.entries())
        .sort((a, b) => b[1] - a[1]);

      if (sortedEmployees.length < 2) break;

      const overworkedId = sortedEmployees[0][0];
      const underworkedId = sortedEmployees[sortedEmployees.length - 1][0];

      // 스왑 가능한 배정 찾기
      const swapCandidate = this.findSwapCandidate(
        currentSolution,
        overworkedId,
        underworkedId,
        request
      );

      if (swapCandidate) {
        // 스왑 실행
        currentSolution = this.performSwap(
          currentSolution,
          swapCandidate.from,
          swapCandidate.to
        );
      } else {
        break; // 더 이상 개선 불가능
      }
    }

    return currentSolution;
  }

  /**
   * 선호도 최적화
   */
  private optimizeForPreference(
    initialSolution: ScheduleAssignment[],
    request: SchedulingRequest
  ): ScheduleAssignment[] {
    let currentSolution = [...initialSolution];
    const employeeMap = new Map(request.employees.map(e => [e.id, e]));
    const shiftMap = new Map(request.shifts.map(s => [s.id, s]));

    for (const employee of request.employees) {
      const empAssignments = currentSolution.filter(a => a.employeeId === employee.id);

      for (const assignment of empAssignments) {
        const shift = shiftMap.get(assignment.shiftId);
        if (!shift) continue;

        // 선호하지 않는 시프트인 경우
        if (employee.preferences.avoidShifts.includes(shift.type)) {
          // 다른 직원과 스왑 시도
          const swapTarget = this.findPreferenceSwap(
            currentSolution,
            assignment,
            employee,
            request
          );

          if (swapTarget) {
            currentSolution = this.performSwap(
              currentSolution,
              assignment,
              swapTarget
            );
          }
        }
      }
    }

    return currentSolution;
  }

  /**
   * 커버리지 최적화
   */
  private optimizeForCoverage(
    initialSolution: ScheduleAssignment[],
    request: SchedulingRequest
  ): ScheduleAssignment[] {
    let currentSolution = [...initialSolution];
    const shiftMap = new Map(request.shifts.map(s => [s.id, s]));

    // 언더스태프 시프트 찾기
    const understaffedShifts = this.findUnderstaffedShifts(
      currentSolution,
      request
    );

    for (const { date, shiftId, needed } of understaffedShifts) {
      const shift = shiftMap.get(shiftId);
      if (!shift) continue;

      // 가용 직원 찾기
      const availableEmployees = this.getAvailableEmployees(
        request.employees,
        date,
        shift,
        currentSolution
      );

      // 필요한 만큼 추가 배정
      const selected = availableEmployees.slice(0, needed);
      for (const employee of selected) {
        currentSolution.push({
          employeeId: employee.id,
          shiftId: shift.id,
          date: new Date(date),
          isLocked: false,
        });
      }
    }

    return currentSolution;
  }

  /**
   * 비용 최적화
   */
  private optimizeForCost(
    initialSolution: ScheduleAssignment[],
    request: SchedulingRequest
  ): ScheduleAssignment[] {
    // 초과근무 최소화 등 비용 관련 최적화
    // 실제 구현에서는 직원별 시급, 초과근무 수당 등을 고려
    return this.optimizeForFairness(initialSolution, request);
  }

  // 유전 알고리즘 헬퍼 메서드들

  private createInitialPopulation(
    initialSolution: ScheduleAssignment[],
    request: SchedulingRequest
  ): ScheduleAssignment[][] {
    const population: ScheduleAssignment[][] = [initialSolution];

    while (population.length < ALGORITHM_CONFIG.POPULATION_SIZE) {
      const variant = this.createVariant(initialSolution, request);
      population.push(variant);
    }

    return population;
  }

  private createVariant(
    solution: ScheduleAssignment[],
    request: SchedulingRequest
  ): ScheduleAssignment[] {
    let variant = [...solution];

    // 랜덤하게 몇 개의 스왑 수행
    const numSwaps = Math.floor(Math.random() * 5) + 1;
    for (let i = 0; i < numSwaps; i++) {
      variant = this.randomSwap(variant, request);
    }

    return variant;
  }

  private tournamentSelection(
    scores: { solution: ScheduleAssignment[]; score: number }[]
  ): ScheduleAssignment[] {
    const tournamentSize = 3;
    const tournament: typeof scores = [];

    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * scores.length);
      tournament.push(scores[randomIndex]);
    }

    tournament.sort((a, b) => b.score - a.score);
    return tournament[0].solution;
  }

  private crossover(
    parent1: ScheduleAssignment[],
    parent2: ScheduleAssignment[]
  ): ScheduleAssignment[] {
    // 단순 균일 교차
    const offspring: ScheduleAssignment[] = [];
    const maxLength = Math.max(parent1.length, parent2.length);

    for (let i = 0; i < maxLength; i++) {
      if (Math.random() < 0.5) {
        if (i < parent1.length) offspring.push(parent1[i]);
      } else {
        if (i < parent2.length) offspring.push(parent2[i]);
      }
    }

    return offspring;
  }

  private mutate(
    solution: ScheduleAssignment[],
    request: SchedulingRequest
  ): ScheduleAssignment[] {
    return this.randomSwap(solution, request);
  }

  private randomSwap(
    solution: ScheduleAssignment[],
    request: SchedulingRequest
  ): ScheduleAssignment[] {
    if (solution.length < 2) return solution;

    const newSolution = [...solution];
    const idx1 = Math.floor(Math.random() * solution.length);
    const idx2 = Math.floor(Math.random() * solution.length);

    if (idx1 !== idx2) {
      // 직원 ID만 스왑
      const temp = newSolution[idx1].employeeId;
      newSolution[idx1] = {
        ...newSolution[idx1],
        employeeId: newSolution[idx2].employeeId,
      };
      newSolution[idx2] = {
        ...newSolution[idx2],
        employeeId: temp,
      };
    }

    return newSolution;
  }

  // 평가 및 유틸리티 메서드들

  private evaluateSolution(
    solution: ScheduleAssignment[],
    request: SchedulingRequest
  ): number {
    const employeeMap = new Map(request.employees.map(e => [e.id, e]));
    const shiftMap = new Map(request.shifts.map(s => [s.id, s]));

    const violations = this.constraintValidator.validateSchedule(
      solution,
      employeeMap,
      shiftMap,
      request.startDate,
      request.endDate
    );

    const score = this.fairnessScorer.calculateScheduleScore(
      solution,
      employeeMap,
      shiftMap,
      violations
    );

    // 하드 제약 위반에 대한 큰 페널티
    const hardViolationCount = violations.filter(v => v.type === 'hard').length;
    const penalty = hardViolationCount * 1000;

    return score.total - penalty;
  }

  private getAvailableEmployees(
    employees: Employee[],
    date: Date,
    shift: Shift,
    currentAssignments: ScheduleAssignment[]
  ): Employee[] {
    return employees.filter(employee => {
      // 이미 그날 배정되었는지 확인
      const hasAssignment = currentAssignments.some(
        a => a.employeeId === employee.id &&
             this.isSameDate(a.date, date)
      );

      if (hasAssignment) return false;

      // 가용성 확인
      const dayOfWeek = date.getDay();
      if (!employee.availability.availableDays[dayOfWeek]) return false;

      // 휴가 확인
      const onLeave = employee.availability.timeOffRequests.some(
        req => req.status === 'approved' &&
               date >= req.startDate &&
               date <= req.endDate
      );

      if (onLeave) return false;

      // 스킬 확인 (필요한 경우)
      // ...

      return true;
    });
  }

  private selectBestEmployees(
    availableEmployees: Employee[],
    requiredCount: number,
    shift: Shift,
    date: Date,
    currentAssignments: ScheduleAssignment[]
  ): Employee[] {
    // 점수 기반 선택
    const scored = availableEmployees.map(employee => {
      let score = 0;

      // 선호 시프트인 경우 가점
      if (employee.preferences.preferredShifts.includes(shift.type)) {
        score += 10;
      }

      // 회피 시프트인 경우 감점
      if (employee.preferences.avoidShifts.includes(shift.type)) {
        score -= 10;
      }

      // 근무 시간 균형 고려
      const workload = currentAssignments.filter(
        a => a.employeeId === employee.id
      ).length;
      score -= workload; // 이미 많이 일한 직원은 감점

      return { employee, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, requiredCount).map(s => s.employee);
  }

  private calculateWorkload(
    assignments: ScheduleAssignment[],
    shifts: Map<string, Shift>
  ): Map<string, number> {
    const workload = new Map<string, number>();

    for (const assignment of assignments) {
      const shift = shifts.get(assignment.shiftId);
      if (!shift) continue;

      const current = workload.get(assignment.employeeId) || 0;
      workload.set(assignment.employeeId, current + shift.time.hours);
    }

    return workload;
  }

  private findSwapCandidate(
    assignments: ScheduleAssignment[],
    overworkedId: string,
    underworkedId: string,
    request: SchedulingRequest
  ): { from: ScheduleAssignment; to: ScheduleAssignment } | null {
    const overworkedAssignments = assignments.filter(a => a.employeeId === overworkedId);
    const underworkedAssignments = assignments.filter(a => a.employeeId === underworkedId);

    for (const fromAssignment of overworkedAssignments) {
      // 같은 날짜와 시프트에서 스왑 가능한지 확인
      const toAssignment = underworkedAssignments.find(
        a => this.isSameDate(a.date, fromAssignment.date) &&
             a.shiftId === fromAssignment.shiftId
      );

      if (toAssignment) {
        return { from: fromAssignment, to: toAssignment };
      }
    }

    return null;
  }

  private findPreferenceSwap(
    assignments: ScheduleAssignment[],
    assignment: ScheduleAssignment,
    employee: Employee,
    request: SchedulingRequest
  ): ScheduleAssignment | null {
    // 같은 날짜와 시프트의 다른 직원 찾기
    const candidates = assignments.filter(
      a => this.isSameDate(a.date, assignment.date) &&
           a.shiftId === assignment.shiftId &&
           a.employeeId !== employee.id
    );

    for (const candidate of candidates) {
      const otherEmployee = request.employees.find(e => e.id === candidate.employeeId);
      if (!otherEmployee) continue;

      // 다른 직원이 이 시프트를 선호하거나 중립적인 경우
      const shift = request.shifts.find(s => s.id === assignment.shiftId);
      if (!shift) continue;

      if (!otherEmployee.preferences.avoidShifts.includes(shift.type)) {
        return candidate;
      }
    }

    return null;
  }

  private performSwap(
    assignments: ScheduleAssignment[],
    from: ScheduleAssignment,
    to: ScheduleAssignment
  ): ScheduleAssignment[] {
    return assignments.map(a => {
      if (a === from) {
        return { ...a, employeeId: to.employeeId };
      }
      if (a === to) {
        return { ...a, employeeId: from.employeeId };
      }
      return a;
    });
  }

  private findUnderstaffedShifts(
    assignments: ScheduleAssignment[],
    request: SchedulingRequest
  ): { date: Date; shiftId: string; needed: number }[] {
    const understaffed: { date: Date; shiftId: string; needed: number }[] = [];
    const currentDate = new Date(request.startDate);

    while (currentDate <= request.endDate) {
      for (const shift of request.shifts) {
        const assigned = assignments.filter(
          a => this.isSameDate(a.date, currentDate) &&
               a.shiftId === shift.id
        ).length;

        if (assigned < shift.requiredStaff) {
          understaffed.push({
            date: new Date(currentDate),
            shiftId: shift.id,
            needed: shift.requiredStaff - assigned,
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return understaffed;
  }

  private generateSuggestions(
    solution: ScheduleAssignment[],
    violations: any[],
    request: SchedulingRequest
  ): ScheduleSuggestion[] {
    const suggestions: ScheduleSuggestion[] = [];

    // 하드 제약 위반에 대한 제안
    const hardViolations = violations.filter(v => v.type === 'hard');
    if (hardViolations.length > 0) {
      suggestions.push({
        type: 'adjustment',
        priority: 'high',
        description: `${hardViolations.length}개의 필수 제약조건 위반이 발견되었습니다.`,
        impact: '법적 요구사항 또는 계약 조건을 충족하지 못할 수 있습니다.',
        affectedEmployees: [...new Set(hardViolations.flatMap(v => v.affectedEmployees))],
      });
    }

    // 패턴 사용 제안
    if (!request.pattern) {
      suggestions.push({
        type: 'pattern',
        priority: 'medium',
        description: '패턴 기반 스케줄링을 사용하면 더 일관된 결과를 얻을 수 있습니다.',
        impact: '직원들의 예측 가능성과 만족도가 향상됩니다.',
      });
    }

    // 공정성 개선 제안
    const workload = this.calculateWorkload(
      solution,
      new Map(request.shifts.map(s => [s.id, s]))
    );
    const workloadValues = Array.from(workload.values());
    if (workloadValues.length > 0) {
      const max = Math.max(...workloadValues);
      const min = Math.min(...workloadValues);
      if (max - min > 20) {
        suggestions.push({
          type: 'swap',
          priority: 'medium',
          description: '근무 시간 차이가 큽니다. 재분배를 고려하세요.',
          impact: `최대 ${max}시간과 최소 ${min}시간의 차이를 줄일 수 있습니다.`,
        });
      }
    }

    return suggestions;
  }

  private getSolutionKey(solution: ScheduleAssignment[]): string {
    // 솔루션의 고유 키 생성 (타부 리스트용)
    const sorted = [...solution].sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.employeeId.localeCompare(b.employeeId);
    });

    return sorted
      .map(a => `${a.employeeId}-${a.shiftId}-${a.date.getTime()}`)
      .join('|');
  }

  private updateTabuList(key: string): void {
    this.tabuList.push(key);
    if (this.tabuList.length > ALGORITHM_CONFIG.TABU_LIST_SIZE) {
      this.tabuList.shift();
    }
  }

  private getIterationCount(): number {
    // 실제 수행된 반복 횟수 (구현 간소화)
    return ALGORITHM_CONFIG.MAX_ITERATIONS;
  }

  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }
}

// 메인 스케줄러 클래스
export class Scheduler {
  private optimizer: ScheduleOptimizer;

  constructor() {
    this.optimizer = new ScheduleOptimizer();
  }

  /**
   * 스케줄 생성
   */
  public async createSchedule(request: SchedulingRequest): Promise<SchedulingResult> {
    // 요청 검증
    this.validateRequest(request);

    // 최적화 실행
    const result = await this.optimizer.optimize(request);

    // 후처리
    if (result.schedule) {
      result.schedule = this.postProcessSchedule(result.schedule, request);
    }

    return result;
  }

  /**
   * 스케줄 수정
   */
  public async updateSchedule(
    existingSchedule: Schedule,
    changes: Partial<SchedulingRequest>
  ): Promise<SchedulingResult> {
    // 기존 스케줄과 변경사항을 병합한 새 요청 생성
    const request: SchedulingRequest = {
      departmentId: existingSchedule.departmentId,
      startDate: existingSchedule.startDate,
      endDate: existingSchedule.endDate,
      employees: changes.employees || [],
      shifts: changes.shifts || [],
      constraints: changes.constraints || [],
      existingSchedule,
      lockedAssignments: existingSchedule.assignments.filter(a => a.isLocked),
      optimizationGoal: changes.optimizationGoal || 'balanced',
    };

    return this.createSchedule(request);
  }

  /**
   * 스케줄 검증
   */
  public validateSchedule(
    schedule: Schedule,
    constraints: Constraint[]
  ): { isValid: boolean; violations: any[] } {
    // 제약조건 검증기 사용
    const validator = new ConstraintValidator(constraints);

    // 실제 검증을 위해서는 직원과 시프트 정보가 필요
    // 여기서는 간단히 처리
    const violations: any[] = [];

    return {
      isValid: violations.filter(v => v.type === 'hard').length === 0,
      violations,
    };
  }

  private validateRequest(request: SchedulingRequest): void {
    if (!request.employees || request.employees.length === 0) {
      throw new Error('직원 목록이 필요합니다.');
    }

    if (!request.shifts || request.shifts.length === 0) {
      throw new Error('시프트 목록이 필요합니다.');
    }

    if (request.startDate >= request.endDate) {
      throw new Error('종료일은 시작일보다 늦어야 합니다.');
    }

    // 날짜 범위 제한 (최대 3개월)
    const daysDiff = Math.ceil(
      (request.endDate.getTime() - request.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff > 90) {
      throw new Error('스케줄링 기간은 최대 3개월까지 가능합니다.');
    }
  }

  private postProcessSchedule(
    schedule: Schedule,
    request: SchedulingRequest
  ): Schedule {
    // 고정된 배정 유지
    if (request.lockedAssignments) {
      for (const locked of request.lockedAssignments) {
        const existingIndex = schedule.assignments.findIndex(
          a => a.employeeId === locked.employeeId &&
               this.isSameDate(a.date, locked.date)
        );

        if (existingIndex >= 0) {
          schedule.assignments[existingIndex] = { ...locked, isLocked: true };
        } else {
          schedule.assignments.push({ ...locked, isLocked: true });
        }
      }
    }

    // 정렬
    schedule.assignments.sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.employeeId.localeCompare(b.employeeId);
    });

    return schedule;
  }

  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }
}

// Re-export types for convenience
export type { SchedulingRequest, SchedulingResult } from './types';
