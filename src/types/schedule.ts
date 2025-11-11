/**
 * Schedule Domain Type Definitions
 * 스케줄 관련 타입 정의
 */

// Types used for type reference only
// import type { Employee, ScheduleAssignment } from "@/lib/types/scheduler";

/**
 * 시프트 배정 정보
 */
export interface Assignment {
  id?: string;
  date: string;
  employeeId: string;
  shiftId: string | null;
  shiftType?: string;
  isLocked?: boolean;
  isPreference?: boolean;
  notes?: string;
  isSwapRequested?: boolean;
  swapRequestId?: string;
}

/**
 * 스태프 정보
 */
export interface Staff {
  id: string;
  name: string;
  role?: string;
  position?: string;
  departmentId?: string;
  teamId?: string | null;
  skills?: string[];
  preferences?: StaffPreferences;
  availability?: StaffAvailability[];
  constraints?: StaffConstraints;
  isFullTime?: boolean;
  hoursPerWeek?: number;
  seniority?: string;
}

/**
 * 스태프 선호도
 */
export interface StaffPreferences {
  preferredShifts?: string[];
  blockedDates?: string[];
  maxHoursPerWeek?: number;
  maxConsecutiveDays?: number;
  minRestHours?: number;
}

/**
 * 스태프 가용성
 */
export interface StaffAvailability {
  date: string;
  available: boolean;
  reason?: string;
}

/**
 * 스태프 제약조건
 */
export interface StaffConstraints {
  maxHoursPerWeek?: number;
  maxConsecutiveDays?: number;
  minRestHours?: number;
  canWorkWeekends?: boolean;
  canWorkNights?: boolean;
}

/**
 * 시프트 교환 요청
 */
export interface SwapShift {
  date: string;
  employeeId: string;
  employeeName: string;
  shiftId: string;
  shiftName: string;
}

/**
 * 시프트 교환 정보
 */
export interface SwapRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  targetId?: string;
  targetName?: string;
  fromShift: SwapShift;
  toShift?: SwapShift;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 필터 옵션
 */
export interface FilterOptions {
  search?: string;
  department?: string;
  team?: string | null;
  shiftType?: string;
  position?: string;
  showOnlyIssues?: boolean;
}

/**
 * 스케줄 통계
 */
export interface ScheduleStats {
  totalAssignments: number;
  totalHours: number;
  coverage: {
    [shiftId: string]: {
      required: number;
      assigned: number;
      percentage: number;
    };
  };
  violations: {
    hard: number;
    soft: number;
    total: number;
  };
  fairness: {
    weekendDistribution: {
      [employeeId: string]: number;
    };
    hourDistribution: {
      [employeeId: string]: number;
    };
  };
}

/**
 * 스케줄 검증 결과
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score?: number;
}

/**
 * 검증 에러
 */
export interface ValidationError {
  id: string;
  type: 'legal' | 'coverage' | 'conflict';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  affectedEmployees?: string[];
  affectedDates?: string[];
  suggestion?: string;
}

/**
 * 검증 경고
 */
export interface ValidationWarning {
  id: string;
  type: 'preference' | 'fairness' | 'optimization';
  message: string;
  affectedEmployees?: string[];
  affectedDates?: string[];
  suggestion?: string;
}

/**
 * AI 생성 결과
 */
export interface AIGenerationResult {
  success: boolean;
  message: string;
  assignments?: Assignment[];
  stats?: ScheduleStats;
  validation?: ValidationResult;
  generatedAt: Date;
  processingTime?: number;
}

/**
 * 스케줄 메타데이터
 */
export interface ScheduleMetadata {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  departmentId?: string;
  teamId?: string | null;
  status: 'draft' | 'published' | 'archived';
  isLocked: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  version?: number;
}

/**
 * 이벤트 핸들러 타입들
 */
export type AssignmentClickHandler = (
  employeeId: string,
  date: string,
  currentShiftId: string | null
) => void;

export type AssignmentChangeHandler = (
  employeeId: string,
  date: string,
  shiftId: string | null
) => void;

export type DateRangeChangeHandler = (
  startDate: Date,
  endDate: Date
) => void;

export type FilterChangeHandler = (
  filters: Partial<FilterOptions>
) => void;

/**
 * 모달 상태 타입들
 */
export interface ModalStates {
  import: boolean;
  export: boolean;
  validation: boolean;
  report: boolean;
  manage: boolean;
  swapRequest: boolean;
  scheduleSwap: boolean;
  employeePreferences: boolean;
  confirmation: boolean;
}

/**
 * 선택된 직원 정보
 */
export interface SelectedEmployee {
  id: string;
  name: string;
  date?: string;
  currentShiftId?: string | null;
}

/**
 * 확인 다이얼로그 설정
 */
export interface ConfirmationConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: 'danger' | 'warning' | 'info';
}
