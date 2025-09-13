/**
 * Formatting utility functions
 */

import { SHIFT_TYPES, STAFF_ROLES, EXPERIENCE_LEVELS } from '@/lib/constants';
import type { ShiftType, Role } from '@/lib/types';

/**
 * Format shift type to display name
 */
export function formatShiftType(shift: ShiftType, language: string = 'ko'): string {
  const shiftLabels = {
    ko: { D: '주간', E: '저녁', N: '야간', O: '휴무' },
    en: { D: 'Day', E: 'Evening', N: 'Night', O: 'Off' },
    ja: { D: '日勤', E: '夕勤', N: '夜勤', O: '休み' },
  };

  return shiftLabels[language as keyof typeof shiftLabels]?.[shift] || SHIFT_TYPES[shift];
}

/**
 * Format role to display name
 */
export function formatRole(role: Role): string {
  return STAFF_ROLES[role]?.label || role;
}

/**
 * Format experience level
 */
export function formatExperienceLevel(level: keyof typeof EXPERIENCE_LEVELS, language: string = 'ko'): string {
  const experienceLabels = {
    ko: {
      JUNIOR: '신입',
      INTERMEDIATE: '경력',
      SENIOR: '시니어',
      EXPERT: '전문가',
    },
    en: {
      JUNIOR: 'Junior',
      INTERMEDIATE: 'Intermediate',
      SENIOR: 'Senior',
      EXPERT: 'Expert',
    },
    ja: {
      JUNIOR: '新人',
      INTERMEDIATE: '経験者',
      SENIOR: 'シニア',
      EXPERT: 'エキスパート',
    },
  };

  return experienceLabels[language as keyof typeof experienceLabels]?.[level] || EXPERIENCE_LEVELS[level]?.label || level;
}

/**
 * Format number with comma separators
 */
export function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format hours to readable format
 */
export function formatHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}분`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) {
    return `${h}시간`;
  }
  return `${h}시간 ${m}분`;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Format phone number
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 11) {
    // Mobile: 010-1234-5678
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    // Landline: 02-1234-5678 or 031-123-4567
    if (cleaned.startsWith('02')) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  return phone;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Convert to title case
 */
export function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * Generate initials from name
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}