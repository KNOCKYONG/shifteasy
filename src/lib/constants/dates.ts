/**
 * Date and time-related constants
 */

// Days of week
export const DAYS_OF_WEEK = {
  KO: ['일', '월', '화', '수', '목', '금', '토'],
  EN: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  JA: ['日', '月', '火', '水', '木', '金', '土'],
} as const;

// Full day names
export const FULL_DAY_NAMES = {
  KO: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  EN: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  JA: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
} as const;

// Months
export const MONTHS = {
  KO: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  EN: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  JA: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
} as const;

// Date formats
export const DATE_FORMATS = {
  ISO: 'yyyy-MM-dd',
  ISO_WITH_TIME: 'yyyy-MM-dd HH:mm:ss',
  DISPLAY_KO: 'yyyy년 M월 d일',
  DISPLAY_EN: 'MMM d, yyyy',
  DISPLAY_JA: 'yyyy年M月d日',
  SHORT_KO: 'M/d',
  SHORT_EN: 'M/d',
  SHORT_JA: 'M/d',
  TIME_24H: 'HH:mm',
  TIME_12H: 'h:mm a',
} as const;

// Time constants
export const TIME_CONSTANTS = {
  MILLISECONDS_IN_SECOND: 1000,
  SECONDS_IN_MINUTE: 60,
  MINUTES_IN_HOUR: 60,
  HOURS_IN_DAY: 24,
  DAYS_IN_WEEK: 7,
  DAYS_IN_MONTH_AVG: 30,
  WEEKS_IN_MONTH_AVG: 4.33,
  MONTHS_IN_YEAR: 12,
  WEEKS_IN_YEAR: 52,
} as const;

// Week start configuration
export const WEEK_START = {
  SUNDAY: 0,
  MONDAY: 1,
  SATURDAY: 6,
} as const;

// Time zones
export const TIME_ZONES = {
  KST: 'Asia/Seoul',
  JST: 'Asia/Tokyo',
  UTC: 'UTC',
} as const;

// Work hours
export const WORK_HOURS = {
  DAY_SHIFT_START: 7,
  DAY_SHIFT_END: 15,
  EVENING_SHIFT_START: 15,
  EVENING_SHIFT_END: 23,
  NIGHT_SHIFT_START: 23,
  NIGHT_SHIFT_END: 7,
  STANDARD_SHIFT_HOURS: 8,
  OVERTIME_THRESHOLD: 40, // hours per week
} as const;