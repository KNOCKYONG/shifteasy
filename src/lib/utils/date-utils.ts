/**
 * Date 객체 또는 문자열을 Date 객체로 정규화
 * @param value - Date 객체 또는 ISO 날짜 문자열
 * @returns Date 객체
 */
export function normalizeDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}
