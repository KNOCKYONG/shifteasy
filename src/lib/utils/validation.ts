/**
 * Validation utility functions
 */

import { VALIDATION, VALIDATION_MESSAGES } from '@/lib/constants';

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; message?: string } {
  if (!email) {
    return { valid: false, message: VALIDATION_MESSAGES.REQUIRED };
  }
  if (!VALIDATION.EMAIL_PATTERN.test(email)) {
    return { valid: false, message: VALIDATION_MESSAGES.INVALID_EMAIL };
  }
  if (email.length > VALIDATION.EMAIL_MAX_LENGTH) {
    return { valid: false, message: 'Email too long' };
  }
  return { valid: true };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password) {
    return { valid: false, message: VALIDATION_MESSAGES.REQUIRED };
  }
  if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
    return { valid: false, message: VALIDATION_MESSAGES.PASSWORD_TOO_SHORT };
  }
  if (password.length > VALIDATION.PASSWORD_MAX_LENGTH) {
    return { valid: false, message: 'Password too long' };
  }
  if (!VALIDATION.PASSWORD_PATTERN.test(password)) {
    return { valid: false, message: VALIDATION_MESSAGES.INVALID_PASSWORD };
  }
  return { valid: true };
}

/**
 * Validate name
 */
export function validateName(name: string): { valid: boolean; message?: string } {
  if (!name) {
    return { valid: false, message: VALIDATION_MESSAGES.REQUIRED };
  }
  if (name.length < VALIDATION.NAME_MIN_LENGTH) {
    return { valid: false, message: VALIDATION_MESSAGES.NAME_TOO_SHORT };
  }
  if (name.length > VALIDATION.NAME_MAX_LENGTH) {
    return { valid: false, message: VALIDATION_MESSAGES.NAME_TOO_LONG };
  }
  if (!VALIDATION.NAME_PATTERN.test(name)) {
    return { valid: false, message: VALIDATION_MESSAGES.INVALID_NAME };
  }
  return { valid: true };
}

/**
 * Validate employee ID
 */
export function validateEmployeeId(id: string): boolean {
  return VALIDATION.EMPLOYEE_ID_PATTERN.test(id);
}

/**
 * Validate ward ID
 */
export function validateWardId(id: string): boolean {
  return (
    VALIDATION.WARD_ID_PATTERN.test(id) &&
    id.length >= VALIDATION.WARD_ID_MIN_LENGTH &&
    id.length <= VALIDATION.WARD_ID_MAX_LENGTH
  );
}

/**
 * Validate rating (1-5 scale)
 */
export function validateRating(rating: number): boolean {
  return rating >= VALIDATION.RATING_MIN && rating <= VALIDATION.RATING_MAX;
}

/**
 * Validate preference score
 */
export function validatePreferenceScore(score: number): boolean {
  return score >= VALIDATION.PREFERENCE_SCORE_MIN && score <= VALIDATION.PREFERENCE_SCORE_MAX;
}

/**
 * Validate team size
 */
export function validateTeamSize(size: number): { valid: boolean; message?: string } {
  if (size < VALIDATION.TEAM_MIN_SIZE) {
    return { valid: false, message: VALIDATION_MESSAGES.TEAM_TOO_SMALL };
  }
  if (size > VALIDATION.TEAM_MAX_SIZE) {
    return { valid: false, message: VALIDATION_MESSAGES.TEAM_TOO_LARGE };
  }
  return { valid: true };
}

/**
 * Validate date is not in past
 */
export function validateFutureDate(date: Date): { valid: boolean; message?: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    return { valid: false, message: VALIDATION_MESSAGES.DATE_IN_PAST };
  }

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + VALIDATION.REQUEST_MAX_DAYS_AHEAD);

  if (date > maxDate) {
    return { valid: false, message: VALIDATION_MESSAGES.DATE_TOO_FAR };
  }

  return { valid: true };
}

/**
 * Sanitize input string (remove potential XSS)
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate required field
 */
export function validateRequired(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}