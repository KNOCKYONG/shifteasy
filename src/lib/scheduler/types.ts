/**
 * 스케줄 개선 시스템 타입 정의
 *
 * 기존 생성(ai-scheduler.ts)과 개선(schedule-improver.ts) 로직을 명확히 구분하기 위한 타입들
 */

// ============================================================================
// 기본 타입
// ============================================================================

export interface Assignment {
  date: string;
  employeeId: string;
  shiftId?: string;
  shiftType?: string;
}

export type WorkPatternType = 'three-shift' | 'night-intensive' | 'weekday-only';

export interface Employee {
  id: string;
  name: string;
  role?: string;
  workPatternType?: WorkPatternType;
  teamId?: string;

  // 제약 관련 필드
  maxConsecutiveDaysPreferred?: number;
  maxConsecutiveNightsPreferred?: number;
  guaranteedOffDays?: number;

  // 선호도 필드
  preferredShiftTypes?: Record<string, number>;

  preferences?: EmployeePreferences;
}

export interface EmployeePreferences {
  workPatternType?: string;
  avoidPatterns?: string[][];
}

export interface ScheduleConstraints {
  minStaff: number;
  maxConsecutiveDays: number;
  minRestDays: number;

  // 야간 근무 제약
  maxConsecutiveNights?: number; // 기본값: workPattern에 따라 다름

  // 시프트별 필수 인원
  requiredStaffPerShift?: Record<string, number>; // { 'D': 3, 'E': 2, 'N': 2 }

  // 공휴일 목록
  holidays?: string[]; // ['2024-01-01', '2024-12-25']

  // 팀/부서별 기피 패턴
  avoidPatterns?: string[][]; // [['D', 'N'], ['E', 'E']]
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

// ============================================================================
// 메트릭 상세 분석 타입
// ============================================================================

/**
 * 공정성 상세 분석
 */
export interface FairnessDetails {
  /** Gini 계수 (0 = 완벽 평등, 1 = 완전 불평등) */
  giniCoefficient: number;

  /** 직원별 근무일수 분포 */
  workloadDistribution: Array<{
    employeeId: string;
    employeeName: string;
    workDays: number;
    deviation: number; // 평균 대비 편차
  }>;

  /** 근무일수 범위 */
  workloadRange: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };

  /** 문제 직원 (과근무/과소근무) */
  problemEmployees: Array<{
    employeeId: string;
    employeeName: string;
    workDays: number;
    deviation: number;
    type: 'overworked' | 'underworked';
    severity: 'high' | 'medium' | 'low';
  }>;

  /** 개선된 문제들 (before와 비교) */
  problemsFixed?: string[];
}

/**
 * 효율성 상세 분석
 */
export interface EfficiencyDetails {
  /** 일별 인력 현황 */
  dailyStaffing: Array<{
    date: string;
    actual: number;
    target: number;
    status: 'optimal' | 'understaffed' | 'overstaffed';
  }>;

  /** 통계 */
  stats: {
    understaffedDays: number;
    overstaffedDays: number;
    optimalDays: number;
    totalDays: number;
  };

  /** 인력 문제 상세 */
  staffingProblems: Array<{
    date: string;
    actual: number;
    target: number;
    gap: number;
    severity: 'high' | 'medium' | 'low';
  }>;

  /** 개선된 문제들 */
  problemsFixed?: string[];
}

/**
 * 만족도 상세 분석
 */
export interface SatisfactionDetails {
  /** 전체 선호도 수 */
  totalPreferences: number;

  /** 충족된 선호도 수 */
  satisfiedPreferences: number;

  /** 만족률 (0-100) */
  satisfactionRate: number;

  /** 선호도 위반 목록 */
  violations: Array<{
    employeeId: string;
    employeeName: string;
    date: string;
    type: 'avoid_pattern' | 'work_pattern' | 'other';
    description: string;
    severity: 'high' | 'medium' | 'low';
  }>;

  /** 직원별 만족도 */
  employeeSatisfaction: Array<{
    employeeId: string;
    employeeName: string;
    satisfactionRate: number;
    totalPreferences: number;
    satisfiedPreferences: number;
  }>;

  /** 개선된 위반들 */
  violationsFixed?: string[];
}

/**
 * 상세 분석이 포함된 메트릭
 */
export interface MetricsWithDetails {
  fairness: {
    score: number;
    details: FairnessDetails;
  };
  efficiency: {
    score: number;
    details: EfficiencyDetails;
  };
  satisfaction: {
    score: number;
    details: SatisfactionDetails;
  };
  totalScore: number;
  grade: Grade;
}

// ============================================================================
// 변경 추적 타입
// ============================================================================

/**
 * 스케줄 변경 기록
 */
export interface ScheduleChange {
  /** 변경 유형 */
  type: 'swap' | 'reassign' | 'add' | 'remove';

  /** 변경 날짜 */
  date: string;

  /** 관련 직원 */
  employees: Array<{
    id: string;
    name: string;
    before?: string; // 이전 시프트
    after?: string;  // 이후 시프트
  }>;

  /** 변경 이유 */
  reason: string;

  /** 변경 영향도 */
  impact: {
    fairness: number;
    efficiency: number;
    satisfaction: number;
    total: number;
  };

  /** 변경 설명 */
  description: string;
}

// ============================================================================
// 개선 결과 타입
// ============================================================================

/**
 * 개선 요약
 */
export interface ImprovementSummary {
  /** 총 개선 점수 */
  totalImprovement: number;

  /** 등급 변화 */
  gradeChange: {
    from: Grade;
    to: Grade;
    improved: boolean;
  };

  /** 반복 횟수 */
  iterations: number;

  /** 처리 시간 (ms) */
  processingTime: number;

  /** 총 변경 건수 */
  totalChanges: number;

  /** 개선 가능성 평가 */
  furtherImprovementPotential: 'high' | 'medium' | 'low' | 'none';
}

/**
 * 메트릭 비교 분석
 */
export interface MetricComparison {
  before: MetricsWithDetails;
  after: MetricsWithDetails;
  improvements: {
    fairness: {
      scoreDelta: number;
      percentageImprovement: number;
      keyImprovements: string[];
    };
    efficiency: {
      scoreDelta: number;
      percentageImprovement: number;
      keyImprovements: string[];
    };
    satisfaction: {
      scoreDelta: number;
      percentageImprovement: number;
      keyImprovements: string[];
    };
  };
}

/**
 * 추천 사항
 */
export interface Recommendation {
  type: 'continue_improving' | 'satisfactory' | 'excellent' | 'warning';
  message: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
}

/**
 * 완전한 개선 리포트
 */
export interface ImprovementReport {
  /** 요약 */
  summary: ImprovementSummary;

  /** 메트릭 비교 */
  metrics: MetricComparison;

  /** 변경 사항 목록 */
  changes: ScheduleChange[];

  /** 추천 사항 */
  recommendations: Recommendation[];

  /** 생성 시각 */
  generatedAt: string;
}

/**
 * 개선 결과 (API 응답)
 */
export interface ImprovementResult {
  /** 개선된 스케줄 */
  improved: Assignment[];

  /** 상세 리포트 */
  report: ImprovementReport;

  /** 성공 여부 */
  success: boolean;

  /** 에러 메시지 (실패 시) */
  error?: string;
}

// ============================================================================
// Hill Climbing 알고리즘 타입
// ============================================================================

/**
 * 이웃 해 생성 전략
 */
export type NeighborStrategy = 'swap' | 'reassign' | 'balance';

/**
 * 최적화 옵션
 */
export interface OptimizationOptions {
  /** 최대 반복 횟수 */
  maxIterations: number;

  /** 개선 없이 허용되는 최대 반복 횟수 */
  maxNoImprovementIterations: number;

  /** 최소 개선 점수 (이보다 작으면 종료) */
  minImprovementThreshold: number;

  /** 가중치 */
  weights: {
    fairness: number;
    efficiency: number;
    satisfaction: number;
  };

  /** 진행 상황 콜백 */
  onProgress?: (iteration: number, score: number) => void;
}

/**
 * 최적화 상태
 */
export interface OptimizationState {
  currentIteration: number;
  bestScore: number;
  noImprovementCount: number;
  startTime: number;
  changes: ScheduleChange[];
}
