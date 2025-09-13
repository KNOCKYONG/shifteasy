/**
 * Schedule-related constants
 */

import type { ShiftType } from '@/lib/types';

// Schedule generation configuration
export const SCHEDULE_CONFIG = {
  MAX_CONSECUTIVE_DAYS: 5,
  MIN_REST_HOURS: 11,
  MAX_WEEKLY_HOURS: 52,
  MIN_STAFF_PER_SHIFT: {
    D: 3, // Day shift
    E: 2, // Evening shift
    N: 2, // Night shift
    O: 0, // Off duty
  },
  FAIRNESS_WEIGHT: 0.7,
  PREFERENCE_WEIGHT: 0.3,
} as const;

// Shift colors for UI
export const SHIFT_COLORS: Record<ShiftType, {
  bg: string;
  border: string;
  text: string;
}> = {
  D: {
    bg: "bg-blue-50 dark:bg-blue-900/10",
    border: "border-blue-200 dark:border-blue-900/30",
    text: "text-blue-700 dark:text-blue-300"
  },
  E: {
    bg: "bg-amber-50 dark:bg-amber-900/10",
    border: "border-amber-200 dark:border-amber-900/30",
    text: "text-amber-700 dark:text-amber-300"
  },
  N: {
    bg: "bg-indigo-50 dark:bg-indigo-900/10",
    border: "border-indigo-200 dark:border-indigo-900/30",
    text: "text-indigo-700 dark:text-indigo-300"
  },
  O: {
    bg: "bg-gray-50 dark:bg-gray-900/10",
    border: "border-gray-200 dark:border-gray-700",
    text: "text-gray-500 dark:text-gray-400"
  },
};

// Shift types
export const SHIFT_TYPES: Record<ShiftType, string> = {
  D: 'Day',
  E: 'Evening',
  N: 'Night',
  O: 'Off',
} as const;

// Shift patterns
export const DEFAULT_SHIFT_PATTERNS = [
  { id: "5-day", name: "5일 근무", description: "주 5일 근무, 2일 휴무", daysOn: 5, daysOff: 2 },
  { id: "4-day", name: "4일 근무", description: "주 4일 근무, 3일 휴무", daysOn: 4, daysOff: 3 },
  { id: "3-shift", name: "3교대", description: "주간/저녁/야간 순환", daysOn: 5, daysOff: 2 },
] as const;

// Shift rules
export const DEFAULT_SHIFT_RULES = [
  { id: "max-consecutive", name: "최대 연속 근무", type: "limit", value: 5, enabled: true },
  { id: "min-rest", name: "최소 휴식 시간", type: "minimum", value: 11, enabled: true },
  { id: "weekend-fairness", name: "주말 공평 배분", type: "balance", value: 1, enabled: true },
  { id: "night-limit", name: "월 야간 근무 제한", type: "limit", value: 8, enabled: true },
] as const;

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  PROCESSING_TIME_GOOD: 5000, // ms
  PROCESSING_TIME_WARNING: 10000, // ms
  COVERAGE_RATE_GOOD: 0.9,
  COVERAGE_RATE_WARNING: 0.7,
  DISTRIBUTION_BALANCE_GOOD: 0.8,
  DISTRIBUTION_BALANCE_WARNING: 0.6,
} as const;