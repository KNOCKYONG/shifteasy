/**
 * 공정성 점수 계산 시스템
 */

import {
  Employee,
  ScheduleAssignment,
  Shift,
  ScheduleScore,
  ScoreBreakdown,
  ScheduleMetrics,
  ConstraintViolation,
} from './types';

export class FairnessScorer {
  /**
   * 전체 스케줄 점수 계산
   */
  public calculateScheduleScore(
    assignments: ScheduleAssignment[],
    employees: Map<string, Employee>,
    shifts: Map<string, Shift>,
    violations: ConstraintViolation[]
  ): ScheduleScore {
    const metrics = this.calculateMetrics(assignments, employees, shifts);

    // 각 카테고리별 점수 계산
    const fairnessScore = this.calculateFairnessScore(metrics, employees);
    const preferenceScore = this.calculatePreferenceScore(assignments, employees, shifts);
    const coverageScore = this.calculateCoverageScore(assignments, shifts);
    const constraintScore = this.calculateConstraintSatisfactionScore(violations);

    // 전체 점수 계산 (가중 평균)
    const weights = {
      fairness: 0.3,
      preference: 0.25,
      coverage: 0.25,
      constraint: 0.2,
    };

    const total =
      fairnessScore * weights.fairness +
      preferenceScore * weights.preference +
      coverageScore * weights.coverage +
      constraintScore * weights.constraint;

    const breakdown: ScoreBreakdown[] = [
      {
        category: '공정성',
        score: fairnessScore,
        weight: weights.fairness,
        details: this.getFairnessDetails(metrics),
      },
      {
        category: '선호도 만족',
        score: preferenceScore,
        weight: weights.preference,
        details: this.getPreferenceDetails(assignments, employees, shifts),
      },
      {
        category: '커버리지',
        score: coverageScore,
        weight: weights.coverage,
        details: this.getCoverageDetails(assignments, shifts),
      },
      {
        category: '제약조건 만족',
        score: constraintScore,
        weight: weights.constraint,
        details: this.getConstraintDetails(violations),
      },
    ];

    return {
      total: Math.round(total),
      fairness: Math.round(fairnessScore),
      preference: Math.round(preferenceScore),
      coverage: Math.round(coverageScore),
      constraintSatisfaction: Math.round(constraintScore),
      breakdown,
    };
  }

  /**
   * 스케줄 메트릭 계산
   */
  public calculateMetrics(
    assignments: ScheduleAssignment[],
    employees: Map<string, Employee>,
    shifts: Map<string, Shift>
  ): ScheduleMetrics {
    const employeeWorkload: Record<string, number> = {};
    const shiftDistribution: Record<string, number> = {};
    const weekendDistribution: Record<string, number> = {};
    const nightShiftDistribution: Record<string, number> = {};

    let totalHours = 0;
    let overtimeHours = 0;

    // 직원별 집계
    for (const [empId, employee] of employees) {
      const empAssignments = assignments.filter(a => a.employeeId === empId);
      let empHours = 0;
      let weekendCount = 0;
      let nightCount = 0;

      for (const assignment of empAssignments) {
        const shift = shifts.get(assignment.shiftId);
        if (!shift) continue;

        empHours += shift.time.hours;

        // 주말 근무 카운트
        const dayOfWeek = assignment.date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          weekendCount++;
        }

        // 야간 근무 카운트
        if (shift.type === 'night') {
          nightCount++;
        }

        // 시프트 타입별 분포
        shiftDistribution[shift.type] = (shiftDistribution[shift.type] || 0) + 1;
      }

      employeeWorkload[empId] = empHours;
      weekendDistribution[empId] = weekendCount;
      nightShiftDistribution[empId] = nightCount;
      totalHours += empHours;

      // 초과근무 계산 (주 40시간 기준)
      const weeks = this.getWeekCount(assignments);
      const weeklyAverage = empHours / weeks;
      if (weeklyAverage > 40) {
        overtimeHours += (weeklyAverage - 40) * weeks;
      }
    }

    const averageHoursPerEmployee = employees.size > 0 ? totalHours / employees.size : 0;

    // 언더/오버 스태핑 계산
    const { understaffed, overstaffed } = this.calculateStaffingGaps(assignments, shifts);

    // Jain's Fairness Index 계산
    const fairnessIndex = this.calculateJainsFairnessIndex(employeeWorkload);

    // 선호도 만족도 계산
    const preferencesSatisfied = this.calculatePreferenceSatisfaction(
      assignments,
      employees,
      shifts
    );

    return {
      totalHours,
      averageHoursPerEmployee,
      overtimeHours,
      understaffedShifts: understaffed,
      overstaffedShifts: overstaffed,
      employeeWorkload,
      shiftDistribution,
      weekendDistribution,
      nightShiftDistribution,
      fairnessIndex,
      preferencesSatisfied,
    };
  }

  /**
   * 공정성 점수 계산
   */
  private calculateFairnessScore(
    metrics: ScheduleMetrics,
    employees: Map<string, Employee>
  ): number {
    let score = 100;

    // 1. Jain's Fairness Index (0-1, 1이 완벽한 공정성)
    const fairnessDeduction = (1 - metrics.fairnessIndex) * 30;
    score -= fairnessDeduction;

    // 2. 근무시간 편차
    const workloadValues = Object.values(metrics.employeeWorkload);
    if (workloadValues.length > 0) {
      const mean = workloadValues.reduce((a, b) => a + b, 0) / workloadValues.length;
      const variance = workloadValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / workloadValues.length;
      const stdDev = Math.sqrt(variance);
      const cv = mean > 0 ? stdDev / mean : 0; // 변동계수

      // 변동계수가 높을수록 감점
      score -= cv * 20;
    }

    // 3. 주말 근무 공정성
    const weekendValues = Object.values(metrics.weekendDistribution);
    if (weekendValues.length > 0) {
      const maxWeekend = Math.max(...weekendValues);
      const minWeekend = Math.min(...weekendValues);
      const weekendGap = maxWeekend - minWeekend;

      // 주말 근무 차이가 클수록 감점
      if (weekendGap > 3) {
        score -= (weekendGap - 3) * 5;
      }
    }

    // 4. 야간 근무 공정성
    const nightValues = Object.values(metrics.nightShiftDistribution);
    if (nightValues.length > 0) {
      const maxNight = Math.max(...nightValues);
      const minNight = Math.min(...nightValues);
      const nightGap = maxNight - minNight;

      // 야간 근무 차이가 클수록 감점
      if (nightGap > 3) {
        score -= (nightGap - 3) * 5;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 선호도 만족 점수 계산
   */
  private calculatePreferenceScore(
    assignments: ScheduleAssignment[],
    employees: Map<string, Employee>,
    shifts: Map<string, Shift>
  ): number {
    let totalPreferences = 0;
    let satisfiedPreferences = 0;

    for (const [empId, employee] of employees) {
      const empAssignments = assignments.filter(a => a.employeeId === empId);

      // 선호 시프트 검사
      if (employee.preferences.preferredShifts.length > 0) {
        for (const assignment of empAssignments) {
          const shift = shifts.get(assignment.shiftId);
          if (!shift) continue;

          totalPreferences++;
          if (employee.preferences.preferredShifts.includes(shift.type)) {
            satisfiedPreferences++;
          }
        }
      }

      // 회피 시프트 검사
      if (employee.preferences.avoidShifts.length > 0) {
        for (const assignment of empAssignments) {
          const shift = shifts.get(assignment.shiftId);
          if (!shift) continue;

          totalPreferences++;
          if (!employee.preferences.avoidShifts.includes(shift.type)) {
            satisfiedPreferences++;
          }
        }
      }

      // 선호 휴무일 검사
      if (employee.preferences.preferredDaysOff.length > 0) {
        const workDays = new Set(empAssignments.map(a => a.date.getDay()));
        for (const preferredDay of employee.preferences.preferredDaysOff) {
          totalPreferences++;
          if (!workDays.has(preferredDay)) {
            satisfiedPreferences++;
          }
        }
      }

      // 야간 근무 선호도 검사
      const nightAssignments = empAssignments.filter(a => {
        const shift = shifts.get(a.shiftId);
        return shift?.type === 'night';
      });

      if (employee.preferences.preferNightShift && nightAssignments.length > 0) {
        satisfiedPreferences += nightAssignments.length * 0.5;
        totalPreferences += nightAssignments.length * 0.5;
      } else if (!employee.preferences.preferNightShift) {
        const nonNightAssignments = empAssignments.length - nightAssignments.length;
        satisfiedPreferences += nonNightAssignments * 0.5;
        totalPreferences += empAssignments.length * 0.5;
      }
    }

    return totalPreferences > 0 ? (satisfiedPreferences / totalPreferences) * 100 : 100;
  }

  /**
   * 커버리지 점수 계산
   */
  private calculateCoverageScore(
    assignments: ScheduleAssignment[],
    shifts: Map<string, Shift>
  ): number {
    const shiftCoverage = new Map<string, { required: number; assigned: number }>();

    // 시프트별 필요 인원 집계
    for (const [shiftId, shift] of shifts) {
      const assignedCount = assignments.filter(a => a.shiftId === shiftId).length;
      shiftCoverage.set(shiftId, {
        required: shift.requiredStaff,
        assigned: assignedCount,
      });
    }

    let totalRequired = 0;
    let totalSatisfied = 0;

    for (const coverage of shiftCoverage.values()) {
      totalRequired += coverage.required;
      totalSatisfied += Math.min(coverage.required, coverage.assigned);
    }

    const baseScore = totalRequired > 0 ? (totalSatisfied / totalRequired) * 100 : 100;

    // 오버스태핑 페널티
    let overstaffPenalty = 0;
    for (const coverage of shiftCoverage.values()) {
      if (coverage.assigned > coverage.required * 1.2) {
        overstaffPenalty += 5;
      }
    }

    return Math.max(0, Math.min(100, baseScore - overstaffPenalty));
  }

  /**
   * 제약조건 만족 점수 계산
   */
  private calculateConstraintSatisfactionScore(violations: ConstraintViolation[]): number {
    if (violations.length === 0) return 100;

    let score = 100;

    // 하드 제약 위반
    const hardViolations = violations.filter(v => v.type === 'hard');
    const softViolations = violations.filter(v => v.type === 'soft');

    // 하드 제약 위반은 큰 감점
    for (const violation of hardViolations) {
      switch (violation.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    // 소프트 제약 위반은 작은 감점
    for (const violation of softViolations) {
      switch (violation.severity) {
        case 'critical':
          score -= 5;
          break;
        case 'high':
          score -= 4;
          break;
        case 'medium':
          score -= 3;
          break;
        case 'low':
          score -= 1;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Jain's Fairness Index 계산
   * 값이 1에 가까울수록 공정한 분배
   */
  private calculateJainsFairnessIndex(workload: Record<string, number>): number {
    const values = Object.values(workload);
    if (values.length === 0) return 1;

    const sumSquared = Math.pow(values.reduce((a, b) => a + b, 0), 2);
    const squaredSum = values.reduce((sum, val) => sum + Math.pow(val, 2), 0);

    return sumSquared / (values.length * squaredSum);
  }

  /**
   * 선호도 만족도 계산
   */
  private calculatePreferenceSatisfaction(
    assignments: ScheduleAssignment[],
    employees: Map<string, Employee>,
    shifts: Map<string, Shift>
  ): number {
    let totalPreferences = 0;
    let satisfiedPreferences = 0;

    for (const [empId, employee] of employees) {
      const empAssignments = assignments.filter(a => a.employeeId === empId);

      for (const assignment of empAssignments) {
        const shift = shifts.get(assignment.shiftId);
        if (!shift) continue;

        // 선호 시프트 체크
        if (employee.preferences.preferredShifts.length > 0) {
          totalPreferences++;
          if (employee.preferences.preferredShifts.includes(shift.type)) {
            satisfiedPreferences++;
          }
        }

        // 회피 시프트 체크
        if (employee.preferences.avoidShifts.length > 0) {
          totalPreferences++;
          if (!employee.preferences.avoidShifts.includes(shift.type)) {
            satisfiedPreferences++;
          }
        }
      }
    }

    return totalPreferences > 0 ? (satisfiedPreferences / totalPreferences) * 100 : 100;
  }

  /**
   * 스태핑 갭 계산
   */
  private calculateStaffingGaps(
    assignments: ScheduleAssignment[],
    shifts: Map<string, Shift>
  ): { understaffed: number; overstaffed: number } {
    let understaffed = 0;
    let overstaffed = 0;

    const shiftCounts = new Map<string, number>();
    for (const assignment of assignments) {
      const key = `${assignment.date.toISOString()}-${assignment.shiftId}`;
      shiftCounts.set(key, (shiftCounts.get(key) || 0) + 1);
    }

    for (const [key, count] of shiftCounts) {
      const shiftId = key.split('-').pop()!;
      const shift = shifts.get(shiftId);
      if (!shift) continue;

      if (count < shift.requiredStaff) {
        understaffed++;
      } else if (shift.maxStaff && count > shift.maxStaff) {
        overstaffed++;
      }
    }

    return { understaffed, overstaffed };
  }

  /**
   * 주 수 계산
   */
  private getWeekCount(assignments: ScheduleAssignment[]): number {
    if (assignments.length === 0) return 1;

    const dates = assignments.map(a => a.date);
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    const diffTime = Math.abs(maxDate.getTime() - minDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.ceil(diffDays / 7) || 1;
  }

  // 상세 정보 생성 메서드들
  private getFairnessDetails(metrics: ScheduleMetrics): string {
    const parts: string[] = [];

    parts.push(`Jain's Index: ${metrics.fairnessIndex.toFixed(2)}`);
    parts.push(`평균 근무시간: ${metrics.averageHoursPerEmployee.toFixed(1)}시간`);

    const workloadValues = Object.values(metrics.employeeWorkload);
    if (workloadValues.length > 0) {
      const max = Math.max(...workloadValues);
      const min = Math.min(...workloadValues);
      parts.push(`근무시간 범위: ${min}-${max}시간`);
    }

    return parts.join(', ');
  }

  private getPreferenceDetails(
    assignments: ScheduleAssignment[],
    employees: Map<string, Employee>,
    shifts: Map<string, Shift>
  ): string {
    const satisfaction = this.calculatePreferenceSatisfaction(assignments, employees, shifts);
    return `선호도 만족률: ${satisfaction.toFixed(1)}%`;
  }

  private getCoverageDetails(
    assignments: ScheduleAssignment[],
    shifts: Map<string, Shift>
  ): string {
    const { understaffed, overstaffed } = this.calculateStaffingGaps(assignments, shifts);
    const parts: string[] = [];

    if (understaffed > 0) {
      parts.push(`인원 부족: ${understaffed}개 시프트`);
    }
    if (overstaffed > 0) {
      parts.push(`인원 초과: ${overstaffed}개 시프트`);
    }
    if (parts.length === 0) {
      parts.push('모든 시프트 적정 인원');
    }

    return parts.join(', ');
  }

  private getConstraintDetails(violations: ConstraintViolation[]): string {
    const hardCount = violations.filter(v => v.type === 'hard').length;
    const softCount = violations.filter(v => v.type === 'soft').length;

    const parts: string[] = [];
    if (hardCount > 0) {
      parts.push(`하드 제약 위반: ${hardCount}건`);
    }
    if (softCount > 0) {
      parts.push(`소프트 제약 위반: ${softCount}건`);
    }
    if (parts.length === 0) {
      parts.push('모든 제약조건 만족');
    }

    return parts.join(', ');
  }
}