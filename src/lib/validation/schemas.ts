/**
 * Zod 스키마를 사용한 데이터 검증 시스템
 */

import { z } from 'zod';

// ==================== 기본 타입 ====================

export const ShiftTypeSchema = z.enum(['day', 'evening', 'night', 'off', 'leave', 'custom']);

export const EmployeeStatusSchema = z.enum(['active', 'on-leave', 'inactive']);

export const OptimizationGoalSchema = z.enum(['fairness', 'preference', 'coverage', 'cost', 'balanced']);

// ==================== Employee 관련 스키마 ====================

export const EmployeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  role: z.string().optional(),
  position: z.string().optional(),
  workPatternType: z.enum(['three-shift', 'night-intensive', 'weekday-only']).optional(),
  status: EmployeeStatusSchema.optional(),
  avatar: z.string().url().optional(),
});

// ==================== ComprehensivePreferences 스키마 ====================

export const WorkPreferencesSchema = z.object({
  preferredShifts: z.array(ShiftTypeSchema).min(1),
  maxConsecutiveDays: z.number().min(1).max(7),
  minRestDays: z.number().min(1).max(4),
  preferredWorkload: z.enum(['light', 'moderate', 'heavy', 'flexible']),
  weekendPreference: z.enum(['prefer', 'avoid', 'neutral']),
  holidayPreference: z.enum(['prefer', 'avoid', 'neutral']),
  overtimeWillingness: z.enum(['never', 'emergency', 'sometimes', 'always']),
});

export const PersonalCircumstancesSchema = z.object({
  hasYoungChildren: z.boolean(),
  childrenAges: z.array(z.number()).optional(),
  isSingleParent: z.boolean(),
  hasCaregivingResponsibilities: z.boolean(),
  caregivingDetails: z.string().optional(),
  isStudying: z.boolean(),
  studySchedule: z.object({
    days: z.array(z.string()),
    timeSlots: z.array(z.string()),
  }).optional(),
  pregnancyStatus: z.enum(['none', 'early', 'late', 'postpartum']).optional(),
  weddingPlanned: z.date().optional(),
});

export const HealthConsiderationsSchema = z.object({
  hasChronicCondition: z.boolean(),
  conditionDetails: z.string().optional(),
  needsFrequentBreaks: z.boolean(),
  mobilityRestrictions: z.boolean(),
  visualImpairment: z.boolean(),
  hearingImpairment: z.boolean(),
  mentalHealthSupport: z.boolean(),
  medicationSchedule: z.array(z.string()).optional(),
  recentSurgery: z.date().optional(),
  recoveryPeriod: z.number().optional(),
});

export const CommutePreferencesSchema = z.object({
  commuteTime: z.number().min(0).max(180),
  transportMode: z.enum(['car', 'public', 'walk', 'bike', 'mixed']),
  parkingRequired: z.boolean(),
  nightTransportDifficulty: z.boolean(),
  weatherSensitive: z.boolean(),
  needsTransportAssistance: z.boolean(),
  carpoolInterested: z.boolean(),
  preferredCarpoolPartners: z.array(z.string()).optional(),
});

export const TeamPreferencesSchema = z.object({
  preferredPartners: z.array(z.string()),
  avoidPartners: z.array(z.string()),
  mentorshipRole: z.enum(['mentor', 'mentee', 'both', 'none']),
  preferredMentor: z.string().optional(),
  languagePreferences: z.array(z.string()),
  communicationStyle: z.enum(['direct', 'gentle', 'detailed', 'brief']),
  conflictResolution: z.enum(['immediate', 'planned', 'mediator', 'avoid']),
});

export const PrioritiesSchema = z.object({
  workLifeBalance: z.number().min(1).max(10),
  careerGrowth: z.number().min(1).max(10),
  teamHarmony: z.number().min(1).max(10),
  incomeMaximization: z.number().min(1).max(10),
  healthWellbeing: z.number().min(1).max(10),
  familyTime: z.number().min(1).max(10),
});

export const ComprehensivePreferencesSchema = z.object({
  workPreferences: WorkPreferencesSchema,
  personalCircumstances: PersonalCircumstancesSchema,
  healthConsiderations: HealthConsiderationsSchema,
  commutePreferences: CommutePreferencesSchema,
  teamPreferences: TeamPreferencesSchema,
  professionalDevelopment: z.object({
    specializations: z.array(z.string()),
    certifications: z.array(z.string()),
    trainingInterests: z.array(z.string()),
    careerGoals: z.string(),
    preferredDepartments: z.array(z.string()),
    avoidDepartments: z.array(z.string()),
    teachingInterest: z.boolean(),
    researchInterest: z.boolean(),
    administrativeInterest: z.boolean(),
  }),
  specialRequests: z.object({
    religiousObservances: z.object({
      needed: z.boolean(),
      details: z.string().optional(),
      dates: z.array(z.date()).optional(),
    }),
    culturalConsiderations: z.string(),
    dietaryRestrictions: z.string().optional(),
    emergencyContact: z.object({
      name: z.string(),
      relationship: z.string(),
      phone: z.string(),
    }),
    temporaryRequests: z.array(z.object({
      reason: z.string(),
      startDate: z.date(),
      endDate: z.date(),
      details: z.string(),
    })),
  }),
  priorities: PrioritiesSchema,
});

// ==================== Schedule 관련 스키마 ====================

export const ShiftTimeSchema = z.object({
  start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  hours: z.number().min(0).max(24),
  breakMinutes: z.number().min(0).max(120).optional(),
});

export const ShiftSchema = z.object({
  id: z.string(),
  type: ShiftTypeSchema,
  name: z.string(),
  time: ShiftTimeSchema,
  color: z.string(),
  requiredStaff: z.number().min(0),
  minStaff: z.number().min(0).optional(),
  maxStaff: z.number().min(0).optional(),
}).refine(data => {
  if (data.minStaff && data.maxStaff) {
    return data.minStaff <= data.maxStaff;
  }
  return true;
}, {
  message: "최소 인원은 최대 인원보다 작거나 같아야 합니다",
  path: ["minStaff"],
});

export const ScheduleAssignmentSchema = z.object({
  employeeId: z.string(),
  shiftId: z.string(),
  date: z.date(),
  isLocked: z.boolean(),
  isSwapRequested: z.boolean().optional(),
  swapRequestId: z.string().optional(),
});

export const SchedulingRequestSchema = z.object({
  departmentId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  employees: z.array(EmployeeSchema),
  shifts: z.array(ShiftSchema),
  constraints: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['hard', 'soft']),
    category: z.enum(['legal', 'contractual', 'operational', 'preference', 'fairness']),
    weight: z.number().min(0).max(1),
    active: z.boolean(),
    config: z.record(z.string(), z.any()).optional(),
  })),
  optimizationGoal: OptimizationGoalSchema,
  existingSchedule: z.object({
    id: z.string(),
    assignments: z.array(ScheduleAssignmentSchema),
    lockedAssignments: z.array(ScheduleAssignmentSchema).optional(),
  }).optional(),
}).refine(data => data.startDate <= data.endDate, {
  message: "시작일은 종료일보다 이전이어야 합니다",
  path: ["startDate"],
});

// ==================== 검증 유틸리티 함수 ====================

/**
 * 직원 데이터 검증
 */
export function validateEmployee(data: unknown): { success: boolean; data?: any; errors?: string[] } {
  try {
    const result = EmployeeSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return {
      success: false,
      errors: ['알 수 없는 검증 오류'],
    };
  }
}

/**
 * 선호도 데이터 검증
 */
export function validateComprehensivePreferences(data: unknown): { success: boolean; data?: any; errors?: string[] } {
  try {
    const result = ComprehensivePreferencesSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return {
      success: false,
      errors: ['알 수 없는 검증 오류'],
    };
  }
}

/**
 * 스케줄 요청 검증
 */
export function validateSchedulingRequest(data: unknown): { success: boolean; data?: any; errors?: string[] } {
  try {
    const result = SchedulingRequestSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return {
      success: false,
      errors: ['알 수 없는 검증 오류'],
    };
  }
}

/**
 * 부분 검증 (특정 필드만)
 */
export function validatePartial<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fieldPath?: string
): { success: boolean; data?: T; errors?: string[] } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues
        .filter(e => !fieldPath || e.path.join('.').startsWith(fieldPath))
        .map(e => `${e.path.join('.')}: ${e.message}`);
      return {
        success: false,
        errors,
      };
    }
    return {
      success: false,
      errors: ['알 수 없는 검증 오류'],
    };
  }
}

/**
 * 타입 추론 헬퍼
 */
export type InferEmployee = z.infer<typeof EmployeeSchema>;
export type InferComprehensivePreferences = z.infer<typeof ComprehensivePreferencesSchema>;
export type InferSchedulingRequest = z.infer<typeof SchedulingRequestSchema>;
export type InferShift = z.infer<typeof ShiftSchema>;
