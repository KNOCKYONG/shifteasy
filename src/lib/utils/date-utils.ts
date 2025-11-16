/**
 * Date 객체 또는 문자열을 Date 객체로 정규화
 * @param value - Date 객체 또는 ISO 날짜 문자열
 * @returns Date 객체
 */
export function normalizeDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Convert any Date/string to a UTC midnight Date to avoid timezone drift
 */
export function toUTCDateOnly(value: Date | string): Date {
  const date = normalizeDate(value);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Convenience helper to get a stable ISO string (UTC midnight) for a date-only value
 */
export function toUTCDateISOString(value: Date | string): string {
  return toUTCDateOnly(value).toISOString();
}
