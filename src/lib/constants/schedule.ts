/**
 * Schedule-related constants (UI only)
 * Business logic configurations moved to tenant_configs
 * See: src/lib/config/schedule-config.ts
 */

import type { ShiftType } from '@/lib/types';

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

// Shift patterns (UI display)
export const DEFAULT_SHIFT_PATTERNS = [
  { id: "5-day", name: "5일 근무", description: "주 5일 근무, 2일 휴무", daysOn: 5, daysOff: 2 },
  { id: "4-day", name: "4일 근무", description: "주 4일 근무, 3일 휴무", daysOn: 4, daysOff: 3 },
  { id: "3-shift", name: "3교대", description: "주간/저녁/야간 순환", daysOn: 5, daysOff: 2 },
] as const;