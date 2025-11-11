/**
 * 통합 직원 데이터 모델
 */

import type { Employee, EmployeePreferences, ShiftType } from '@/lib/types/scheduler';
import type { SimplifiedPreferences } from '@/components/department/MyPreferencesPanel';
import type { SpecialRequest } from '@/components/department/SpecialRequestModal';

/**
 * 통합된 직원 인터페이스
 * 스케줄러, UI, DB 간 데이터 일관성 보장
 */
export interface UnifiedEmployee extends Employee {
  // UI 표시용 추가 필드
  email: string;
  phone: string;
  position: string;
  department: string;
  joinDate: string;
  avatar?: string;
  status: 'active' | 'on-leave' | 'inactive';

  // 간소화된 선호도 (선택적)
  simplifiedPreferences?: SimplifiedPreferences;

  // 특별 요청 목록
  specialRequests?: SpecialRequest[];

  // 실제 근무 통계 (읽기 전용)
  statistics?: EmployeeStatistics;
}

/**
 * 직원 통계 정보
 */
export interface EmployeeStatistics {
  totalHoursThisMonth: number;
  averageHoursPerWeek: number;
  nightShiftsCount: number;
  weekendShiftsCount: number;
  consecutiveDaysWorked: number;
  lastDayOff: Date;
  overtimeHours: number;
  preferenceMatchRate: number; // 0-100%
  fairnessScore: number; // 0-100
}

/**
 * 스케줄 설정 (UI에서 실제 사용되는 필드 포함)
 */
export interface EnhancedScheduleConfig {
  // 기본 설정
  departmentId: string;
  startDate: Date;
  endDate: Date;

  // 시프트 설정 (breakMinutes 활성화)
  shifts: Array<{
    id: string;
    type: ShiftType;
    name: string;
    time: {
      start: string;
      end: string;
      hours: number;
      breakMinutes: number; // 실제 사용하도록 활성화
    };
    color: string;
    requiredStaff: number;
    minStaff: number; // 실제 사용하도록 활성화
    maxStaff: number; // 실제 사용하도록 활성화
  }>;

  // 최적화 설정
  optimizationGoal: 'fairness' | 'preference' | 'coverage' | 'cost' | 'balanced';

  // 제약조건 가중치
  weights: {
    fairness: number; // 0-100
    preference: number; // 0-100
    coverage: number; // 0-100
    cost: number; // 0-100
  };

  // 자동화 설정
  automation: {
    autoBalance: boolean;
    weekendRotation: boolean;
    nightShiftRotation: boolean;
    considerHealthConditions: boolean;
    considerCommute: boolean;
    respectSpecialRequests: boolean;
  };

  // 관리자 정보 (승인 시스템용)
  approvedBy?: string;
  publishedAt?: Date;
  status: 'draft' | 'pending' | 'published' | 'archived';
}

/**
 * 데이터 변환 유틸리티 타입
 */
export type EmployeeTransform<T> = {
  [K in keyof T]: T[K];
};

/**
 * 검증 결과 (통합)
 */
export interface UnifiedValidationResult {
  isValid: boolean;
  errors: Array<{
    code: string;
    message: string;
    field?: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
  }>;
  suggestions?: string[];
}

/**
 * 데이터 동기화 상태
 */
export interface DataSyncStatus {
  lastSynced: Date;
  pendingChanges: number;
  syncErrors: string[];
  isOnline: boolean;
}

/**
 * 통합 스케줄 요청 (모든 정보 포함)
 */
export interface UnifiedScheduleRequest {
  // 기본 정보
  departmentId: string;
  startDate: Date;
  endDate: Date;

  // 통합된 직원 정보
  employees: UnifiedEmployee[];

  // 향상된 설정
  config: EnhancedScheduleConfig;

  // 특별 요청 고려
  specialRequests: SpecialRequest[];

  // 기존 스케줄 (수정 시)
  existingSchedule?: {
    id: string;
    assignments: any[];
    lockedAssignments: any[];
  };

  // 메타데이터
  requestedBy: string;
  requestedAt: Date;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  notes?: string;
}

/**
 * 통합 스케줄 응답
 */
export interface UnifiedScheduleResponse {
  success: boolean;
  schedule?: {
    id: string;
    assignments: any[];
    metrics: {
      fairnessIndex: number;
      coverageRate: number;
      preferenceMatchRate: number;
      totalCost: number;
    };
  };
  validation: UnifiedValidationResult;
  suggestions: string[];
  processingTime: number;
}

/**
 * Helper 타입들
 */
export type PartialEmployee = Partial<UnifiedEmployee>;
export type RequiredEmployee = Required<UnifiedEmployee>;
export type EmployeeWithPreferences = UnifiedEmployee & {
  simplifiedPreferences: SimplifiedPreferences;
};

/**
 * 타입 가드 함수들
 */
export const isUnifiedEmployee = (obj: any): obj is UnifiedEmployee => {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.email === 'string';
};

export const hasSimplifiedPreferences = (
  employee: UnifiedEmployee
): employee is EmployeeWithPreferences => {
  return employee.simplifiedPreferences !== undefined;
};

export const isActiveEmployee = (employee: UnifiedEmployee): boolean => {
  return employee.status === 'active';
};

/**
 * 기본값 생성 함수
 */
export const createDefaultEmployee = (): Partial<UnifiedEmployee> => ({
  status: 'active',
});
