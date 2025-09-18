/**
 * Utility functions for loading and managing employee statuses
 */

export interface ConfigurableEmployeeStatus {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  allowScheduling: boolean;
  color: string;
}

const DEFAULT_EMPLOYEE_STATUSES: ConfigurableEmployeeStatus[] = [
  { code: 'ACTIVE', name: '활성', description: '정상 근무', isActive: true, allowScheduling: true, color: 'green' },
  { code: 'LEAVE', name: '휴가', description: '휴가 중', isActive: false, allowScheduling: false, color: 'amber' },
  { code: 'SICK', name: '병가', description: '병가 중', isActive: false, allowScheduling: false, color: 'red' },
  { code: 'TRAINING', name: '교육', description: '교육 참여 중', isActive: true, allowScheduling: false, color: 'blue' },
];

// Color mapping for status badges
const STATUS_COLOR_MAP: Record<string, { bg: string; text: string }> = {
  green: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400"
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400"
  },
  amber: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-400"
  },
  red: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400"
  },
  gray: {
    bg: "bg-gray-100 dark:bg-gray-900/30",
    text: "text-gray-700 dark:text-gray-400"
  },
  purple: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-400"
  },
};

/**
 * Load custom employee statuses from localStorage
 */
export function loadEmployeeStatuses(): ConfigurableEmployeeStatus[] {
  if (typeof window === 'undefined') return DEFAULT_EMPLOYEE_STATUSES;

  try {
    const saved = localStorage.getItem('customEmployeeStatuses');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading employee statuses:', error);
  }

  return DEFAULT_EMPLOYEE_STATUSES;
}

/**
 * Get employee status by code
 */
export function getEmployeeStatus(code: string): ConfigurableEmployeeStatus | undefined {
  const statuses = loadEmployeeStatuses();
  return statuses.find(s => s.code === code);
}

/**
 * Get colors for a status
 */
export function getStatusColors(code: string): { bg: string; text: string } {
  const status = getEmployeeStatus(code);
  if (!status) return STATUS_COLOR_MAP.gray;

  return STATUS_COLOR_MAP[status.color] || STATUS_COLOR_MAP.gray;
}

/**
 * Save employee statuses to localStorage
 */
export function saveEmployeeStatuses(statuses: ConfigurableEmployeeStatus[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('customEmployeeStatuses', JSON.stringify(statuses));
  }
}

/**
 * Get formatted employee status options for UI components
 */
export function getEmployeeStatusOptions() {
  const statuses = loadEmployeeStatuses();
  return statuses.map(status => ({
    value: status.code,
    label: status.name,
    description: status.description,
    isActive: status.isActive,
    allowScheduling: status.allowScheduling,
    colors: STATUS_COLOR_MAP[status.color] || STATUS_COLOR_MAP.gray,
  }));
}

/**
 * Get schedulable statuses only
 */
export function getSchedulableStatuses(): ConfigurableEmployeeStatus[] {
  const statuses = loadEmployeeStatuses();
  return statuses.filter(s => s.allowScheduling);
}