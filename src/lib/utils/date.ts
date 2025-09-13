/**
 * Date utility functions
 */

import { format, Locale } from 'date-fns';
import { ko, enUS, ja } from 'date-fns/locale';
import { DATE_FORMATS, TIME_CONSTANTS, WEEK_START } from '@/lib/constants';

/**
 * Get locale object based on language code
 */
export function getLocale(language: string): Locale {
  const localeMap: Record<string, Locale> = {
    ko: ko,
    en: enUS,
    ja: ja,
  };
  return localeMap[language] || ko;
}

/**
 * Format date with locale support
 */
export function formatDate(
  date: Date | string,
  formatStr: string = DATE_FORMATS.ISO,
  language: string = 'ko'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, formatStr, { locale: getLocale(language) });
}

/**
 * Get localized date format
 */
export function getDateFormat(language: string = 'ko'): string {
  const formatMap: Record<string, string> = {
    ko: DATE_FORMATS.DISPLAY_KO,
    en: DATE_FORMATS.DISPLAY_EN,
    ja: DATE_FORMATS.DISPLAY_JA,
  };
  return formatMap[language] || DATE_FORMATS.ISO;
}

/**
 * Check if date is weekend
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Get week number of the year
 */
export function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const daysSinceFirstDay = Math.floor(
    (date.getTime() - firstDayOfYear.getTime()) /
    (TIME_CONSTANTS.MILLISECONDS_IN_SECOND * TIME_CONSTANTS.SECONDS_IN_MINUTE * TIME_CONSTANTS.MINUTES_IN_HOUR * TIME_CONSTANTS.HOURS_IN_DAY)
  );
  return Math.ceil((daysSinceFirstDay + firstDayOfYear.getDay() + 1) / TIME_CONSTANTS.DAYS_IN_WEEK);
}

/**
 * Add business days to a date (excluding weekends)
 */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let daysAdded = 0;

  while (daysAdded < days) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) {
      daysAdded++;
    }
  }

  return result;
}

/**
 * Calculate days between two dates
 */
export function daysBetween(start: Date, end: Date): number {
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (TIME_CONSTANTS.MILLISECONDS_IN_SECOND * TIME_CONSTANTS.SECONDS_IN_MINUTE * TIME_CONSTANTS.MINUTES_IN_HOUR * TIME_CONSTANTS.HOURS_IN_DAY));
}

/**
 * Get start of week based on locale
 */
export function getStartOfWeek(date: Date, weekStartsOn: number = WEEK_START.SUNDAY): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}