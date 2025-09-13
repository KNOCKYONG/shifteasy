/**
 * Validation-related constants
 */

// Input validation
export const VALIDATION = {
  // Name constraints
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  NAME_PATTERN: /^[a-zA-Z가-힣\s]+$/,

  // Password constraints
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  PASSWORD_PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]+$/,

  // Email constraints
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  EMAIL_MAX_LENGTH: 254,

  // Employee ID constraints
  EMPLOYEE_ID_PATTERN: /^[A-Z0-9]{4,20}$/,

  // Ward ID constraints
  WARD_ID_PATTERN: /^ward-[a-zA-Z0-9]+$/,
  WARD_ID_MIN_LENGTH: 7,
  WARD_ID_MAX_LENGTH: 20,

  // Team constraints
  TEAM_MIN_SIZE: 3,
  TEAM_MAX_SIZE: 50,

  // Schedule constraints
  SCHEDULE_MIN_DAYS: 1,
  SCHEDULE_MAX_DAYS: 365,
  SCHEDULE_MAX_WEEKS_AHEAD: 12,

  // Shift constraints
  SHIFT_MIN_HOURS: 4,
  SHIFT_MAX_HOURS: 12,
  SHIFT_MIN_STAFF: 1,
  SHIFT_MAX_STAFF: 20,

  // Request constraints
  REQUEST_REASON_MIN_LENGTH: 10,
  REQUEST_REASON_MAX_LENGTH: 500,
  REQUEST_MAX_DAYS_AHEAD: 90,

  // Skills
  SKILL_MIN_LENGTH: 2,
  SKILL_MAX_LENGTH: 30,
  SKILLS_MAX_COUNT: 10,

  // Ratings (1-5 scale)
  RATING_MIN: 1,
  RATING_MAX: 5,

  // Preference score
  PREFERENCE_SCORE_MIN: -5,
  PREFERENCE_SCORE_MAX: 5,
} as const;

// Error messages
export const VALIDATION_MESSAGES = {
  REQUIRED: '필수 입력 항목입니다',
  INVALID_EMAIL: '올바른 이메일 형식이 아닙니다',
  INVALID_PASSWORD: '비밀번호는 대소문자, 숫자를 포함해야 합니다',
  PASSWORD_TOO_SHORT: `비밀번호는 최소 ${VALIDATION.PASSWORD_MIN_LENGTH}자 이상이어야 합니다`,
  NAME_TOO_SHORT: `이름은 최소 ${VALIDATION.NAME_MIN_LENGTH}자 이상이어야 합니다`,
  NAME_TOO_LONG: `이름은 최대 ${VALIDATION.NAME_MAX_LENGTH}자까지 가능합니다`,
  INVALID_NAME: '이름은 한글, 영문, 공백만 가능합니다',
  INVALID_EMPLOYEE_ID: '직원 ID는 대문자와 숫자로만 구성되어야 합니다',
  TEAM_TOO_SMALL: `팀은 최소 ${VALIDATION.TEAM_MIN_SIZE}명 이상이어야 합니다`,
  TEAM_TOO_LARGE: `팀은 최대 ${VALIDATION.TEAM_MAX_SIZE}명까지 가능합니다`,
  INVALID_DATE: '올바른 날짜 형식이 아닙니다',
  DATE_IN_PAST: '과거 날짜는 선택할 수 없습니다',
  DATE_TOO_FAR: '너무 먼 미래의 날짜입니다',
  INVALID_RATING: `평가는 ${VALIDATION.RATING_MIN}에서 ${VALIDATION.RATING_MAX} 사이여야 합니다`,
} as const;