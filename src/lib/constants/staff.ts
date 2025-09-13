/**
 * Staff-related constants
 */

import type { Role } from '@/lib/types';

// Staff roles
export const STAFF_ROLES: Record<Role, { label: string; description: string; color: string }> = {
  RN: {
    label: '간호사',
    description: 'Registered Nurse',
    color: 'blue',
  },
  CN: {
    label: '수간호사',
    description: 'Charge Nurse',
    color: 'purple',
  },
  SN: {
    label: '전문간호사',
    description: 'Specialist Nurse',
    color: 'green',
  },
  NA: {
    label: '간호조무사',
    description: 'Nursing Assistant',
    color: 'gray',
  },
} as const;

// Experience levels
export const EXPERIENCE_LEVELS = {
  JUNIOR: {
    label: '신입',
    minYears: 0,
    maxYears: 2,
    color: 'green',
    weight: 1.0,
  },
  INTERMEDIATE: {
    label: '경력',
    minYears: 2,
    maxYears: 5,
    color: 'blue',
    weight: 1.2,
  },
  SENIOR: {
    label: '시니어',
    minYears: 5,
    maxYears: 10,
    color: 'purple',
    weight: 1.5,
  },
  EXPERT: {
    label: '전문가',
    minYears: 10,
    maxYears: null,
    color: 'gold',
    weight: 2.0,
  },
} as const;

// Skill levels (1-5 scale)
export const SKILL_LEVELS = {
  BEGINNER: { value: 1, label: '초급', color: 'red' },
  BASIC: { value: 2, label: '기본', color: 'orange' },
  INTERMEDIATE: { value: 3, label: '중급', color: 'yellow' },
  ADVANCED: { value: 4, label: '고급', color: 'green' },
  EXPERT: { value: 5, label: '전문가', color: 'blue' },
} as const;

// Default staff values
export const DEFAULT_STAFF_VALUES = {
  MAX_WEEKLY_HOURS: 40,
  TECHNICAL_SKILL: 3,
  LEADERSHIP: 3,
  COMMUNICATION: 3,
  ADAPTABILITY: 3,
  RELIABILITY: 3,
  ACTIVE: true,
} as const;

// Team balance thresholds
export const TEAM_BALANCE = {
  MIN_TEAM_SIZE: 3,
  OPTIMAL_TEAM_SIZE: 8,
  MAX_TEAM_SIZE: 15,
  MIN_SENIOR_RATIO: 0.3, // At least 30% should be senior/expert
  MAX_JUNIOR_RATIO: 0.4, // At most 40% should be junior
  ROLE_DISTRIBUTION: {
    RN: { min: 0.4, max: 0.6 }, // 40-60% RNs
    CN: { min: 0.1, max: 0.2 }, // 10-20% CNs
    SN: { min: 0.1, max: 0.3 }, // 10-30% SNs
    NA: { min: 0.1, max: 0.3 }, // 10-30% NAs
  },
} as const;

// Balance score weights
export const BALANCE_WEIGHTS = {
  EXPERIENCE_DISTRIBUTION: 0.3,
  ROLE_DISTRIBUTION: 0.25,
  SKILL_AVERAGE: 0.2,
  TEAM_SIZE: 0.15,
  ACTIVE_RATIO: 0.1,
} as const;

// Staff status
export const STAFF_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ON_LEAVE: 'on_leave',
  TERMINATED: 'terminated',
} as const;