/**
 * Staff-related constants (UI only)
 * Business logic configurations moved to configs
 * See: src/lib/config/staff-config.ts
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

// Experience levels (UI display)
export const EXPERIENCE_LEVELS = {
  JUNIOR: {
    label: '신입',
    minYears: 0,
    maxYears: 2,
    color: 'green',
  },
  INTERMEDIATE: {
    label: '경력',
    minYears: 2,
    maxYears: 5,
    color: 'blue',
  },
  SENIOR: {
    label: '시니어',
    minYears: 5,
    maxYears: 10,
    color: 'purple',
  },
  EXPERT: {
    label: '전문가',
    minYears: 10,
    maxYears: null,
    color: 'gold',
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


// Staff status
export const STAFF_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ON_LEAVE: 'on_leave',
  TERMINATED: 'terminated',
} as const;