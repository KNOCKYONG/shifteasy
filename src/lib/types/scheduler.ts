/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * 스케줄링 시스템 타입 정의
 */

// 근무 시프트 타입
export type ShiftType =
  | 'day'      // 주간 (07:00 - 15:00)
  | 'evening'  // 저녁 (15:00 - 23:00)
  | 'night'    // 야간 (23:00 - 07:00)
  | 'off'      // 휴무
  | 'leave'    // 휴가
  | 'custom';  // 커스텀

// 시프트 시간 정의
export interface ShiftTime {
  start: string;  // HH:mm 형식
  end: string;    // HH:mm 형식
  hours: number;  // 근무 시간
  breakMinutes?: number; // 휴식 시간
}

// 시프트 정의
export interface Shift {
  id: string;
  code?: string;
  type: ShiftType;
  name: string;
  time: ShiftTime;
  color: string;
  requiredStaff: number;
  minStaff?: number;
  maxStaff?: number;
}

// 직원 정보
export interface Employee {
  id: string;
  name: string;
  departmentId: string;
  role: string;
  teamId?: string | null;
  workPatternType?: 'three-shift' | 'night-intensive' | 'weekday-only';
  preferredShiftTypes?: {
    D?: number;
    E?: number;
    N?: number;
  };
  maxConsecutiveDaysPreferred?: number;
  maxConsecutiveNightsPreferred?: number;
}

// 직원 선호도 - 스케줄링에 실제 사용되는 핵심 필드만 유지
export interface EmployeePreferences {
  workPatternType?: 'three-shift' | 'night-intensive' | 'weekday-only';
  preferredShifts?: ShiftType[];
  avoidShifts?: ShiftType[];
  preferredDaysOff?: number[]; // 0-6 (일-토)
  maxConsecutiveDays?: number;
  preferNightShift?: boolean;
  preferredPatterns?: string[];
  avoidPatterns?: string[][];
}

// 직원 가용성 - 간소화
export interface EmployeeAvailability {
  availableDays?: boolean[];  // 7일 (일-토)
  unavailableDates?: Date[];   // 특정 날짜 불가능
  timeOffRequests?: TimeOffRequest[];
}

// 휴가/휴무 요청
export interface TimeOffRequest {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  type: 'vacation' | 'sick' | 'personal' | 'other';
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
}

// 스케줄 배정
export interface ScheduleAssignment {
  employeeId: string;
  shiftId: string;
  date: Date;
  isLocked: boolean;  // 수동으로 고정된 배정
  shiftType?: string; // 휴무 계산 등을 위한 시프트 코드
  isSwapRequested?: boolean;
  swapRequestId?: string;
  isSpecialRequest?: boolean;
}

// 주간/월간 스케줄
export interface Schedule {
  id: string;
  departmentId: string;
  startDate: Date;
  endDate: Date;
  assignments: ScheduleAssignment[];
  status: 'draft' | 'published' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  approvedBy?: string;
}

// 제약조건 타입
export type ConstraintType = 'hard' | 'soft';

export interface Constraint {
  id: string;
  name: string;
  type: ConstraintType;
  category: ConstraintCategory;
  weight: number;  // 소프트 제약의 가중치 (0-1)
  active: boolean;
  config?: Record<string, any>;
}

export type ConstraintCategory =
  | 'legal'        // 법적 제약
  | 'contractual'  // 계약상 제약
  | 'operational'  // 운영상 제약
  | 'preference'   // 선호도
  | 'fairness';    // 공정성

// 제약조건 위반
export interface ConstraintViolation {
  constraintId: string;
  constraintName: string;
  type: ConstraintType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  affectedEmployees: string[];
  affectedDates: Date[];
  cost: number;  // 위반 비용 (최적화용)
}

export interface StaffingShortageInfo {
  date: string;
  shiftType: string;
  required: number;
  covered: number;
  shortage: number;
}

export interface TeamCoverageGapInfo {
  date: string;
  shiftType: string;
  teamId: string;
  shortage: number;
}

export interface SpecialRequestMissInfo {
  employeeId: string;
  date: string;
  shiftType: string;
}

export interface CareerGroupCoverageGapInfo {
  date: string;
  shiftType: string;
  careerGroupAlias: string;
  shortage: number;
}

export interface OffBalanceGapInfo {
  teamId: string;
  employeeA: string;
  employeeB: string;
  difference: number;
  tolerance: number;
}

export interface ShiftPatternBreakInfo {
  employeeId: string;
  shiftType: string;
  startDate: string;
  window: number;
  excess: number;
}

export interface TeamWorkloadGapInfo {
  teamA: string;
  teamB: string;
  difference: number;
  tolerance: number;
}

export interface AvoidPatternViolationInfo {
  employeeId: string;
  startDate: string;
  pattern: string[];
}

export interface PostprocessStats {
  initialPenalty?: number;
  finalPenalty?: number;
  iterations?: number;
  improvements?: number;
  acceptedWorse?: number;
  temperature?: number;
}

export interface GenerationDiagnostics {
  staffingShortages?: StaffingShortageInfo[];
  teamCoverageGaps?: TeamCoverageGapInfo[];
  careerGroupCoverageGaps?: CareerGroupCoverageGapInfo[];
  specialRequestMisses?: SpecialRequestMissInfo[];
  offBalanceGaps?: OffBalanceGapInfo[];
  shiftPatternBreaks?: ShiftPatternBreakInfo[];
  teamWorkloadGaps?: TeamWorkloadGapInfo[];
  avoidPatternViolations?: AvoidPatternViolationInfo[];
  preflightIssues?: Array<Record<string, unknown>>;
  postprocess?: PostprocessStats;
}

// 패턴 정의
export interface ShiftPattern {
  id: string;
  name: string;
  description: string;
  type: '2-shift' | '3-shift' | 'custom';
  cycleLength: number;  // 패턴 주기 (일)
  shifts: ShiftType[];  // 패턴 시퀀스
  minStaffPerShift: Record<ShiftType, number>;
  requiredSkills?: string[];
}

// 스케줄링 요청
export interface SchedulingRequest {
  departmentId: string;
  startDate: Date;
  endDate: Date;
  employees: Employee[];
  shifts: Shift[];
  pattern?: ShiftPattern;
  constraints: Constraint[];
  existingSchedule?: Schedule;  // 기존 스케줄 (수정 시)
  lockedAssignments?: ScheduleAssignment[];  // 고정된 배정
  optimizationGoal: OptimizationGoal;
}

// 최적화 목표
export type OptimizationGoal =
  | 'fairness'       // 공정성 최대화
  | 'preference'     // 선호도 만족 최대화
  | 'coverage'       // 커버리지 최대화
  | 'cost'           // 비용 최소화
  | 'balanced';      // 균형잡힌 최적화

// 스케줄링 결과
export interface SchedulingResult {
  success: boolean;
  schedule?: Schedule;
  violations: ConstraintViolation[];
  score: ScheduleScore;
  iterations: number;
  computationTime: number;  // ms
  suggestions?: ScheduleSuggestion[];
  offAccruals?: OffAccrualSummary[];
  diagnostics?: GenerationDiagnostics;
  stats?: {
    fairnessIndex?: number;
    coverageRate?: number;
    preferenceScore?: number;
  };
  postprocess?: PostprocessStats;
}

// 스케줄 점수
export interface ScheduleScore {
  total: number;  // 0-100
  fairness: number;
  preference: number;
  coverage: number;
  constraintSatisfaction: number;
  breakdown: ScoreBreakdown[];
}

// 점수 세부사항
export interface ScoreBreakdown {
  category: string;
  score: number;
  weight: number;
  details: string;
}

// 개선 제안
export interface ScheduleSuggestion {
  type: 'swap' | 'adjustment' | 'pattern';
  priority: 'high' | 'medium' | 'low';
  description: string;
  impact: string;
  affectedEmployees?: string[];
  proposedChange?: any;
}

// 스왑 요청
export interface SwapRequest {
  id: string;
  requesterId: string;
  targetEmployeeId?: string;
  originalAssignment: ScheduleAssignment;
  targetAssignment?: ScheduleAssignment;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: Date;
  decidedAt?: Date;
  decidedBy?: string;
  comments?: string;
}

// 통계 및 메트릭
export interface ScheduleMetrics {
  totalHours: number;
  averageHoursPerEmployee: number;
  overtimeHours: number;
  understaffedShifts: number;
  overstaffedShifts: number;
  employeeWorkload: Record<string, number>;
  shiftDistribution: Record<ShiftType, number>;
  weekendDistribution: Record<string, number>;
  nightShiftDistribution: Record<string, number>;
  fairnessIndex: number;  // Jain's fairness index
  preferencesSatisfied: number;  // percentage
}

// 스케줄 검증 결과
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'error';
  context?: any;
}

export interface ValidationWarning {
  code: string;
  message: string;
  severity: 'warning' | 'info';
  context?: any;
}
export interface OffAccrualSummary {
  employeeId: string;
  extraOffDays: number;
  guaranteedOffDays: number;
  actualOffDays: number;
}
