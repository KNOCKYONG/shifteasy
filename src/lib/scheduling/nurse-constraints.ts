/**
 * Nurse-Specific Constraint System
 * 간호사 전용 제약조건 시스템
 */

import { z } from 'zod';

// ==========================================
// Core Types
// ==========================================

export type ShiftType = 'D' | 'E' | 'N' | 'OFF';
export type SkillLevel = 'junior' | 'intermediate' | 'senior' | 'expert';
export type UnitType = 'ICU' | 'ER' | 'OR' | 'PACU' | 'GENERAL' | 'PEDIATRIC' | 'MATERNITY';
export type CertificationType = 'BLS' | 'ACLS' | 'PALS' | 'CCRN' | 'CEN' | 'CNOR';

// ==========================================
// Hard Constraints (반드시 지켜야 하는 제약)
// ==========================================

export interface NursingHardConstraints {
  // 연속 근무 제한
  maxConsecutiveDays: number; // 최대 연속 근무일 (기본: 5일)
  maxConsecutiveNights: number; // 최대 연속 야간 근무 (기본: 3일)

  // 휴식 시간 보장
  minRestBetweenShifts: number; // 교대 간 최소 휴식 시간 (기본: 11시간)
  minRestAfterNight: number; // 야간 근무 후 최소 휴식 (기본: 24시간)

  // 근무 시간 제한
  maxWeeklyHours: number; // 주당 최대 근무 시간 (기본: 52시간)
  maxMonthlyHours: number; // 월간 최대 근무 시간 (기본: 184시간)
  maxMonthlyNights: number; // 월간 최대 야간 근무 수 (기본: 8개)
  maxMonthlyWeekends: number; // 월간 최대 주말 근무 수 (기본: 2개)

  // 금지된 교대 패턴
  forbiddenTransitions: string[]; // 예: ['N→D', 'N→E'] - 야간 후 주간/저녁 금지
  forbiddenPatterns: string[]; // 예: ['NNNNN'] - 5일 연속 야간 금지

  // 간호사 대 환자 비율
  nurseToPatientRatio: {
    [key in UnitType]: string; // 예: 'ICU': '1:2'
  };

  // 필수 스킬 요구사항
  requiredSkillsPerShift: {
    unit: UnitType;
    shift: ShiftType;
    requiredSkills: SkillLevel[];
    minCount: number;
  }[];

  // 법적 요구사항
  mandatoryBreakDuration: number; // 필수 휴식 시간 (분)
  mandatoryBreakAfterHours: number; // 몇 시간 근무 후 휴식 필요
  minAgeForNightShift: number; // 야간 근무 최소 연령
  pregnancyRestrictions: {
    noNightShift: boolean;
    maxConsecutiveDays: number;
    noOvertimeAllowed: boolean;
  };
}

// ==========================================
// Soft Constraints (선호사항/최적화 대상)
// ==========================================

export interface NursingSoftConstraints {
  // 선호 근무 패턴
  preferredPatterns: {
    pattern: string; // 예: 'DD-EE-NN-OFF'
    weight: number; // 선호도 가중치 (0-1)
  }[];

  // 공정성 지표
  fairness: {
    weekendDistribution: boolean; // 주말 근무 공정 분배
    nightShiftDistribution: boolean; // 야간 근무 공정 분배
    holidayDistribution: boolean; // 공휴일 근무 공정 분배
    targetVariance: number; // 허용 편차 범위 (0-1)
  };

  // 팀 선호도
  teamPreferences: {
    preferSameTeam: boolean; // 같은 팀 선호
    preferredColleagues: string[]; // 선호 동료 ID
    avoidColleagues: string[]; // 비선호 동료 ID
    weight: number; // 가중치
  };

  // 스킬 매칭 최적화
  skillOptimization: {
    balanceSkillLevels: boolean; // 스킬 레벨 균형 맞추기
    mentorshipPairing: boolean; // 멘토-멘티 매칭
    crossTrainingOpportunities: boolean; // 교차 교육 기회
  };

  // 개인 선호도
  personalPreferences: {
    preferredShifts: ShiftType[];
    preferredDaysOff: number[]; // 0-6 (일-토)
    preferredConsecutiveDaysOff: number;
    avoidBackToBack: boolean; // 연속 교대 회피
  };

  // 연속성 관리
  continuityOfCare: {
    maxPatientsPerNurse: number; // 간호사당 최대 환자 수
    preferContinuousCare: boolean; // 지속적인 케어 선호
    targetContinuityRate: number; // 목표 연속성 비율 (0-1)
  };
}

// ==========================================
// Validation Schemas
// ==========================================

export const HardConstraintsSchema = z.object({
  maxConsecutiveDays: z.number().min(1).max(7).default(5),
  maxConsecutiveNights: z.number().min(1).max(5).default(3),
  minRestBetweenShifts: z.number().min(8).max(24).default(11),
  minRestAfterNight: z.number().min(16).max(48).default(24),
  maxWeeklyHours: z.number().min(35).max(60).default(52),
  maxMonthlyHours: z.number().min(140).max(220).default(184),
  maxMonthlyNights: z.number().min(4).max(12).default(8),
  maxMonthlyWeekends: z.number().min(1).max(4).default(2),
  forbiddenTransitions: z.array(z.string()).default(['N→D', 'N→E']),
  forbiddenPatterns: z.array(z.string()).default(['NNNNN', 'DDDDDD']),
  mandatoryBreakDuration: z.number().min(15).max(60).default(30),
  mandatoryBreakAfterHours: z.number().min(4).max(8).default(6),
  minAgeForNightShift: z.number().min(18).max(21).default(18),
});

export const SoftConstraintsSchema = z.object({
  preferredPatterns: z.array(z.object({
    pattern: z.string(),
    weight: z.number().min(0).max(1),
  })).default([]),
  fairness: z.object({
    weekendDistribution: z.boolean().default(true),
    nightShiftDistribution: z.boolean().default(true),
    holidayDistribution: z.boolean().default(true),
    targetVariance: z.number().min(0).max(1).default(0.2),
  }),
  personalPreferences: z.object({
    preferredShifts: z.array(z.enum(['D', 'E', 'N', 'OFF'])).default([]),
    preferredDaysOff: z.array(z.number().min(0).max(6)).default([]),
    preferredConsecutiveDaysOff: z.number().min(1).max(3).default(2),
    avoidBackToBack: z.boolean().default(false),
  }),
});

// ==========================================
// Constraint Violation Types
// ==========================================

export interface ConstraintViolation {
  type: 'hard' | 'soft';
  constraint: string;
  nurseId: string;
  date: Date;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  suggestedFix?: string;
}

// ==========================================
// Constraint Checker Interface
// ==========================================

export interface IConstraintChecker {
  checkHardConstraints(
    schedule: any, // Schedule type을 나중에 정의
    nurse: any, // Nurse type을 나중에 정의
    constraints: NursingHardConstraints
  ): ConstraintViolation[];

  checkSoftConstraints(
    schedule: any,
    nurse: any,
    constraints: NursingSoftConstraints
  ): ConstraintViolation[];

  validateSchedule(schedule: any): {
    isValid: boolean;
    hardViolations: ConstraintViolation[];
    softViolations: ConstraintViolation[];
    score: number; // 0-100
  };
}

// ==========================================
// Default Constraints
// ==========================================

export const DEFAULT_HARD_CONSTRAINTS: NursingHardConstraints = {
  maxConsecutiveDays: 5,
  maxConsecutiveNights: 3,
  minRestBetweenShifts: 11,
  minRestAfterNight: 24,
  maxWeeklyHours: 52,
  maxMonthlyHours: 184,
  maxMonthlyNights: 8,
  maxMonthlyWeekends: 2,
  forbiddenTransitions: ['N→D', 'N→E'],
  forbiddenPatterns: ['NNNNN', 'DDDDDD'],
  nurseToPatientRatio: {
    ICU: '1:2',
    ER: '1:4',
    OR: '1:1',
    PACU: '1:2',
    GENERAL: '1:5',
    PEDIATRIC: '1:4',
    MATERNITY: '1:4',
  },
  requiredSkillsPerShift: [],
  mandatoryBreakDuration: 30,
  mandatoryBreakAfterHours: 6,
  minAgeForNightShift: 18,
  pregnancyRestrictions: {
    noNightShift: true,
    maxConsecutiveDays: 3,
    noOvertimeAllowed: true,
  },
};

export const DEFAULT_SOFT_CONSTRAINTS: NursingSoftConstraints = {
  preferredPatterns: [
    { pattern: 'DD-EE-NN-OFF', weight: 0.8 },
    { pattern: 'DDD-OFF-EEE-OFF', weight: 0.7 },
  ],
  fairness: {
    weekendDistribution: true,
    nightShiftDistribution: true,
    holidayDistribution: true,
    targetVariance: 0.2,
  },
  teamPreferences: {
    preferSameTeam: true,
    preferredColleagues: [],
    avoidColleagues: [],
    weight: 0.5,
  },
  skillOptimization: {
    balanceSkillLevels: true,
    mentorshipPairing: true,
    crossTrainingOpportunities: true,
  },
  personalPreferences: {
    preferredShifts: [],
    preferredDaysOff: [0, 6], // 주말
    preferredConsecutiveDaysOff: 2,
    avoidBackToBack: true,
  },
  continuityOfCare: {
    maxPatientsPerNurse: 5,
    preferContinuousCare: true,
    targetContinuityRate: 0.7,
  },
};