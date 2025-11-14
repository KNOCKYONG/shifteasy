/**
 * 스케줄 메트릭 계산 및 상세 분석
 *
 * 공정성, 효율성, 만족도를 계산하고 각각에 대한 상세 분석 정보를 제공
 */

import {
  Assignment,
  Employee,
  ScheduleConstraints,
  FairnessDetails,
  EfficiencyDetails,
  SatisfactionDetails,
  MetricsWithDetails,
  Grade,
} from './types';

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 휴무 여부 확인
 */
function isOffDay(assignment: Assignment): boolean {
  if (!assignment.shiftId && !assignment.shiftType) return true;

  const offCodes = ['off', 'O', 'OFF', 'LEAVE', 'VAC', '연차', 'HOLIDAY'];
  const shiftId = assignment.shiftId?.toUpperCase() || '';
  const shiftType = assignment.shiftType?.toUpperCase() || '';

  return offCodes.includes(shiftId) || offCodes.includes(shiftType);
}

/**
 * 직원별 근무일수 계산
 */
function calculateWorkDays(
  assignments: Assignment[],
  employees: Employee[]
): Map<string, number> {
  const workDays = new Map<string, number>();

  // 모든 직원 초기화
  employees.forEach((emp) => workDays.set(emp.id, 0));

  // 근무일수 계산
  assignments.forEach((assignment) => {
    if (!isOffDay(assignment)) {
      const current = workDays.get(assignment.employeeId) || 0;
      workDays.set(assignment.employeeId, current + 1);
    }
  });

  return workDays;
}

/**
 * Gini 계수 계산 (불평등 지수)
 * 0 = 완벽 평등, 1 = 완전 불평등
 */
function calculateGiniCoefficient(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;

  if (mean === 0) return 0;

  let numerator = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      numerator += Math.abs(sorted[i] - sorted[j]);
    }
  }

  const gini = numerator / (2 * n * n * mean);
  return gini;
}

/**
 * 중앙값 계산
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// ============================================================================
// 공정성 계산
// ============================================================================

/**
 * 공정성 계산 및 상세 분석
 */
export function calculateFairnessWithDetails(
  assignments: Assignment[],
  employees: Employee[]
): { score: number; details: FairnessDetails } {
  const workDaysMap = calculateWorkDays(assignments, employees);
  const workDaysArray = Array.from(workDaysMap.values());

  if (workDaysArray.length === 0) {
    return {
      score: 0,
      details: {
        giniCoefficient: 0,
        workloadDistribution: [],
        workloadRange: { min: 0, max: 0, avg: 0, median: 0 },
        problemEmployees: [],
      },
    };
  }

  // Gini 계수 계산
  const gini = calculateGiniCoefficient(workDaysArray);

  // 통계 계산
  const min = Math.min(...workDaysArray);
  const max = Math.max(...workDaysArray);
  const avg = workDaysArray.reduce((a, b) => a + b, 0) / workDaysArray.length;
  const median = calculateMedian(workDaysArray);

  // 근무일수 분포 생성
  const workloadDistribution = employees.map((emp) => {
    const workDays = workDaysMap.get(emp.id) || 0;
    return {
      employeeId: emp.id,
      employeeName: emp.name,
      workDays,
      deviation: workDays - avg,
    };
  });

  // 문제 직원 식별
  const threshold = Math.max(2, avg * 0.15); // 평균의 15% 또는 최소 2일
  const problemEmployees = workloadDistribution
    .filter((item) => Math.abs(item.deviation) > threshold)
    .map((item) => {
      const absDeviation = Math.abs(item.deviation);
      return {
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        workDays: item.workDays,
        deviation: item.deviation,
        type: (item.deviation > 0 ? 'overworked' : 'underworked') as
          | 'overworked'
          | 'underworked',
        severity: (absDeviation > threshold * 2
          ? 'high'
          : absDeviation > threshold * 1.5
            ? 'medium'
            : 'low') as 'high' | 'medium' | 'low',
      };
    })
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

  // Gini 계수를 점수로 변환
  // Gini 0 (완벽 평등) → 100점
  // Gini 0.3 (높은 불평등) → 0점
  const score = Math.max(0, Math.min(100, 100 - (gini / 0.3) * 100));

  return {
    score,
    details: {
      giniCoefficient: gini,
      workloadDistribution,
      workloadRange: { min, max, avg, median },
      problemEmployees,
    },
  };
}

// ============================================================================
// 효율성 계산
// ============================================================================

/**
 * 일별 인력 현황 계산
 */
function calculateDailyStaffingMap(
  assignments: Assignment[]
): Map<string, number> {
  const dailyStaffing = new Map<string, number>();

  assignments.forEach((assignment) => {
    if (!isOffDay(assignment)) {
      const current = dailyStaffing.get(assignment.date) || 0;
      dailyStaffing.set(assignment.date, current + 1);
    }
  });

  return dailyStaffing;
}

/**
 * 효율성 계산 및 상세 분석
 */
export function calculateEfficiencyWithDetails(
  assignments: Assignment[],
  constraints: ScheduleConstraints
): { score: number; details: EfficiencyDetails } {
  const dailyStaffingMap = calculateDailyStaffingMap(assignments);
  const target = constraints.minStaff;

  // 모든 날짜 추출
  const allDates = Array.from(new Set(assignments.map((a) => a.date))).sort();

  if (allDates.length === 0) {
    return {
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
    };
  }

  // 일별 인력 상세 정보
  const dailyStaffing = allDates.map((date) => {
    const actual = dailyStaffingMap.get(date) || 0;
    return {
      date,
      actual,
      target,
      status: (actual < target
        ? 'understaffed'
        : actual > target + 2
          ? 'overstaffed'
          : 'optimal') as 'optimal' | 'understaffed' | 'overstaffed',
    };
  });

  // 통계 계산
  const stats = {
    understaffedDays: dailyStaffing.filter((d) => d.status === 'understaffed')
      .length,
    overstaffedDays: dailyStaffing.filter((d) => d.status === 'overstaffed')
      .length,
    optimalDays: dailyStaffing.filter((d) => d.status === 'optimal').length,
    totalDays: allDates.length,
  };

  // 인력 문제 식별
  const staffingProblems = dailyStaffing
    .filter((d) => d.status !== 'optimal')
    .map((d) => {
      const gap = Math.abs(d.actual - d.target);
      return {
        date: d.date,
        actual: d.actual,
        target: d.target,
        gap,
        severity: (gap >= 3 ? 'high' : gap >= 2 ? 'medium' : 'low') as
          | 'high'
          | 'medium'
          | 'low',
      };
    })
    .sort((a, b) => b.gap - a.gap);

  // 효율성 점수 계산
  let totalEfficiency = 0;
  dailyStaffing.forEach((day) => {
    const { actual, target } = day;

    if (actual === target) {
      // 최적
      totalEfficiency += 100;
    } else if (actual < target) {
      // 인력 부족 - 심각한 문제
      totalEfficiency += Math.max(0, (actual / target) * 100 - 20);
    } else {
      // 과잉 인력 - 비효율적이지만 안전
      const excess = actual - target;
      totalEfficiency += Math.max(0, 100 - excess * 10);
    }
  });

  const score = totalEfficiency / allDates.length;

  return {
    score,
    details: {
      dailyStaffing,
      stats,
      staffingProblems,
    },
  };
}

// ============================================================================
// 만족도 계산
// ============================================================================

/**
 * 직원의 선호도 충족 여부 확인
 */
function checkEmployeePreferences(
  employee: Employee,
  employeeAssignments: Assignment[]
): {
  totalPreferences: number;
  satisfiedPreferences: number;
  violations: Array<{
    date: string;
    type: 'avoid_pattern' | 'work_pattern' | 'other';
    description: string;
    severity: 'high' | 'medium' | 'low';
  }>;
} {
  const violations: Array<{
    date: string;
    type: 'avoid_pattern' | 'work_pattern' | 'other';
    description: string;
    severity: 'high' | 'medium' | 'low';
  }> = [];

  let totalPreferences = 0;
  let satisfiedPreferences = 0;

  // 선호도가 없으면 100% 만족으로 간주
  if (!employee.preferences) {
    return { totalPreferences: 0, satisfiedPreferences: 0, violations: [] };
  }

  // 기피 패턴 확인
  if (employee.preferences.avoidPatterns) {
    const avoidPatterns = employee.preferences.avoidPatterns;

    employeeAssignments.forEach((assignment, idx) => {
      if (isOffDay(assignment)) return;

      // 연속 패턴 확인
      avoidPatterns.forEach((pattern) => {
        if (pattern.length <= 1) return;

        totalPreferences++;

        // 패턴 매칭 확인
        const matches = pattern.every((shiftType, offset) => {
          const targetAssignment = employeeAssignments[idx + offset];
          if (!targetAssignment) return false;

          return (
            targetAssignment.shiftType === shiftType ||
            targetAssignment.shiftId === shiftType
          );
        });

        if (matches) {
          violations.push({
            date: assignment.date,
            type: 'avoid_pattern',
            description: `기피 패턴 발생: ${pattern.join(' → ')}`,
            severity: 'high',
          });
        } else {
          satisfiedPreferences++;
        }
      });
    });
  }

  // 선호 근무 패턴 확인
  if (employee.preferences.workPatternType) {
    const preferredPattern = employee.preferences.workPatternType;

    employeeAssignments.forEach((assignment) => {
      if (isOffDay(assignment)) return;

      totalPreferences++;

      const matches =
        assignment.shiftType === preferredPattern ||
        assignment.shiftId === preferredPattern;

      if (matches) {
        satisfiedPreferences++;
      } else {
        violations.push({
          date: assignment.date,
          type: 'work_pattern',
          description: `선호 패턴 미충족: ${preferredPattern} 선호`,
          severity: 'medium',
        });
      }
    });
  }

  return { totalPreferences, satisfiedPreferences, violations };
}

/**
 * 만족도 계산 및 상세 분석
 */
export function calculateSatisfactionWithDetails(
  assignments: Assignment[],
  employees: Employee[]
): { score: number; details: SatisfactionDetails } {
  let totalPreferences = 0;
  let satisfiedPreferences = 0;
  const allViolations: Array<{
    employeeId: string;
    employeeName: string;
    date: string;
    type: 'avoid_pattern' | 'work_pattern' | 'other';
    description: string;
    severity: 'high' | 'medium' | 'low';
  }> = [];

  const employeeSatisfaction = employees.map((emp) => {
    const empAssignments = assignments
      .filter((a) => a.employeeId === emp.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    const result = checkEmployeePreferences(emp, empAssignments);

    totalPreferences += result.totalPreferences;
    satisfiedPreferences += result.satisfiedPreferences;

    // 위반 사항 추가
    result.violations.forEach((v) => {
      allViolations.push({
        employeeId: emp.id,
        employeeName: emp.name,
        ...v,
      });
    });

    const satisfactionRate =
      result.totalPreferences > 0
        ? (result.satisfiedPreferences / result.totalPreferences) * 100
        : 100; // 선호도 없으면 100%

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      satisfactionRate,
      totalPreferences: result.totalPreferences,
      satisfiedPreferences: result.satisfiedPreferences,
    };
  });

  // 전체 만족률 계산
  const satisfactionRate =
    totalPreferences > 0 ? (satisfiedPreferences / totalPreferences) * 100 : 100;

  // 위반 사항을 심각도 순으로 정렬
  const violations = allViolations.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });

  return {
    score: satisfactionRate,
    details: {
      totalPreferences,
      satisfiedPreferences,
      satisfactionRate,
      violations,
      employeeSatisfaction,
    },
  };
}

// ============================================================================
// 통합 메트릭 계산
// ============================================================================

/**
 * 등급 계산
 */
export function calculateGrade(score: number): Grade {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

/**
 * 모든 메트릭 계산 (상세 분석 포함)
 */
export function calculateMetricsWithDetails(
  assignments: Assignment[],
  employees: Employee[],
  constraints: ScheduleConstraints,
  weights: { fairness: number; efficiency: number; satisfaction: number } = {
    fairness: 0.35,
    efficiency: 0.4,
    satisfaction: 0.25,
  }
): MetricsWithDetails {
  const fairness = calculateFairnessWithDetails(assignments, employees);
  const efficiency = calculateEfficiencyWithDetails(assignments, constraints);
  const satisfaction = calculateSatisfactionWithDetails(assignments, employees);

  // 총점 계산
  const totalScore =
    fairness.score * weights.fairness +
    efficiency.score * weights.efficiency +
    satisfaction.score * weights.satisfaction;

  // 등급 계산
  const grade = calculateGrade(totalScore);

  return {
    fairness,
    efficiency,
    satisfaction,
    totalScore,
    grade,
  };
}

/**
 * 개선 가능성 평가
 */
export function assessImprovementPotential(
  currentScore: number,
  previousScore: number,
  iteration: number
): 'high' | 'medium' | 'low' | 'none' {
  const improvement = currentScore - previousScore;

  if (currentScore >= 95) return 'none'; // 이미 거의 완벽
  if (improvement < 0.5 && iteration > 50) return 'none'; // 더 이상 개선 없음
  if (currentScore < 70) return 'high'; // 아직 많이 개선 가능
  if (currentScore < 85) return 'medium'; // 중간 정도 개선 가능
  return 'low'; // 조금 개선 가능
}
