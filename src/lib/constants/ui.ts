/**
 * UI-related constants
 */

// View modes
export const VIEW_MODES = {
  WEEK: 'week',
  MONTH: 'month',
  DAY: 'day',
} as const;

// UI limits
export const UI_LIMITS = {
  MAX_STAFF_PER_PAGE: 20,
  MAX_NOTIFICATIONS: 50,
  MAX_PRESETS: 10,
  ANIMATION_DURATION: 300, // ms
  TOAST_DURATION: 3000, // ms
  DEBOUNCE_DELAY: 500, // ms
} as const;

// Grid configurations
export const GRID_CONFIG = {
  SCHEDULE_COLS: 7, // Days of week
  SCHEDULE_ROWS_MIN: 5,
  SCHEDULE_ROWS_MAX: 30,
  MONTH_VIEW_WEEKS: 6,
} as const;

// Breakpoints
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const;

// Z-index layers
export const Z_INDEX = {
  DROPDOWN: 10,
  STICKY: 20,
  OVERLAY: 30,
  MODAL: 40,
  POPOVER: 50,
  TOOLTIP: 60,
  TOAST: 70,
} as const;

// Status colors
export const STATUS_COLORS = {
  SUCCESS: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
  },
  WARNING: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
  },
  ERROR: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
  },
  INFO: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
  },
} as const;