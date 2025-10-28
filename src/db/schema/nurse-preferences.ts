/**
 * Nurse Preferences Schema
 * 간호사 선호도 및 제약사항 스키마
 */

import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './tenants';

// ==========================================
// Nurse Schedule Preferences (간호사 스케줄 선호도)
// ==========================================

export const nursePreferences = pgTable('nurse_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  nurseId: uuid('nurse_id').notNull().references(() => users.id),
  departmentId: uuid('department_id'), // User's department from users table

  // ==========================================
  // Shift Preferences (근무 선호도)
  // ==========================================

  // Work pattern type
  workPatternType: text('work_pattern_type').default('three-shift'), // 'three-shift', 'night-intensive', 'weekday-only'

  // Preferred shift types
  preferredShiftTypes: jsonb('preferred_shift_types').$type<{
    D: number; // Day preference (0-10)
    E: number; // Evening preference (0-10)
    N: number; // Night preference (0-10)
  }>(),

  // Shift pattern preferences
  preferredPatterns: jsonb('preferred_patterns').$type<{
    pattern: string; // 예: 'DD-EE-NN-OFF'
    preference: number; // 0-10
  }[]>(),

  // Consecutive shifts preferences
  maxConsecutiveDaysPreferred: integer('max_consecutive_days_preferred').default(4),
  maxConsecutiveNightsPreferred: integer('max_consecutive_nights_preferred').default(2),
  preferConsecutiveDaysOff: integer('prefer_consecutive_days_off').default(2),
  avoidBackToBackShifts: boolean('avoid_back_to_back_shifts').default(false),

  // ==========================================
  // Day/Time Preferences (요일/시간 선호도)
  // ==========================================

  // Weekday preferences (0-10 scale)
  weekdayPreferences: jsonb('weekday_preferences').$type<{
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
  }>(),

  // Off day preferences
  offPreference: text('off_preference'), // 'prefer', 'avoid', 'neutral' - general off day preference

  // Weekend preferences
  weekendPreference: text('weekend_preference'), // 'prefer', 'avoid', 'neutral'
  maxWeekendsPerMonth: integer('max_weekends_per_month'),
  preferAlternatingWeekends: boolean('prefer_alternating_weekends').default(false),

  // Holiday preferences
  holidayPreference: text('holiday_preference'), // 'prefer', 'avoid', 'neutral'
  specificHolidayPreferences: jsonb('specific_holiday_preferences').$type<{
    dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
    preference: 'work' | 'off' | 'neutral';
  }[]>(),

  // ==========================================
  // Team/Colleague Preferences (팀/동료 선호도)
  // ==========================================

  preferredColleagues: jsonb('preferred_colleagues').$type<string[]>(), // User IDs
  avoidColleagues: jsonb('avoid_colleagues').$type<string[]>(), // User IDs
  preferredTeamSize: text('preferred_team_size'), // 'small', 'medium', 'large'
  mentorshipPreference: text('mentorship_preference'), // 'mentor', 'mentee', 'neither'

  // ==========================================
  // Personal Constraints (개인 제약사항)
  // ==========================================

  // Transportation constraints
  hasTransportationIssues: boolean('has_transportation_issues').default(false),
  transportationNotes: text('transportation_notes'),

  // Family/Care responsibilities
  hasCareResponsibilities: boolean('has_care_responsibilities').default(false),
  careResponsibilityDetails: jsonb('care_responsibility_details').$type<{
    type: 'childcare' | 'eldercare' | 'other';
    affectedTimes: string[];
    flexibilityLevel: 'none' | 'low' | 'medium' | 'high';
  }>(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nurseIdx: index('nurse_preferences_nurse_idx').on(table.nurseId),
  tenantIdx: index('nurse_preferences_tenant_idx').on(table.tenantId),
  departmentIdx: index('nurse_preferences_department_idx').on(table.departmentId),
}));

// ==========================================
// Schedule Requests (스케줄 요청)
// ==========================================

export const scheduleRequests = pgTable('schedule_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  nurseId: uuid('nurse_id').notNull().references(() => users.id),

  // Request details
  requestType: text('request_type').notNull(), // 'time_off', 'shift_swap', 'shift_preference', 'overtime'
  status: text('status').default('pending'), // 'pending', 'approved', 'denied', 'cancelled'
  priority: text('priority').default('normal'), // 'low', 'normal', 'high', 'urgent'

  // Date/Time specifics
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  specificShifts: jsonb('specific_shifts').$type<string[]>(), // ['2024-01-15-D', '2024-01-16-E']

  // Swap requests
  swapWithNurseId: uuid('swap_with_nurse_id').references(() => users.id),
  swapAgreed: boolean('swap_agreed').default(false),

  // Request reason and details
  reason: text('reason').notNull(),
  category: text('category'), // 'personal', 'medical', 'education', 'family', 'other'
  urgencyLevel: integer('urgency_level').default(1), // 1-5

  // Supporting documentation
  hasDocumentation: boolean('has_documentation').default(false),
  documentationUrl: text('documentation_url'),

  // Approval workflow
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),

  // Alternative arrangements
  alternativeSuggested: jsonb('alternative_suggested').$type<{
    dates: string[];
    shifts: string[];
    notes: string;
  }>(),
  alternativeAccepted: boolean('alternative_accepted').default(false),

  // Tracking
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  lastModifiedAt: timestamp('last_modified_at').defaultNow().notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nurseRequestIdx: index('schedule_requests_nurse_idx').on(table.nurseId),
  statusIdx: index('schedule_requests_status_idx').on(table.status),
  dateIdx: index('schedule_requests_date_idx').on(table.startDate, table.endDate),
}));

// ==========================================
// Preference History (선호도 이력)
// ==========================================

export const preferenceHistory = pgTable('preference_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  nurseId: uuid('nurse_id').notNull().references(() => users.id),
  preferenceId: uuid('preference_id').notNull().references(() => nursePreferences.id),

  // Change tracking
  changeType: text('change_type').notNull(), // 'create', 'update', 'delete'
  changedFields: jsonb('changed_fields').$type<string[]>(),
  previousValues: jsonb('previous_values'),
  newValues: jsonb('new_values'),

  // Metadata
  changedBy: uuid('changed_by').references(() => users.id),
  changeReason: text('change_reason'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  nurseHistoryIdx: index('preference_history_nurse_idx').on(table.nurseId),
  preferenceIdx: index('preference_history_pref_idx').on(table.preferenceId),
  dateIdx: index('preference_history_date_idx').on(table.createdAt),
}));

// ==========================================
// Relations
// ==========================================

export const nursePreferenceRelations = relations(nursePreferences, ({ one, many }) => ({
  nurse: one(users, {
    fields: [nursePreferences.nurseId],
    references: [users.id],
  }),
  history: many(preferenceHistory),
}));

export const scheduleRequestRelations = relations(scheduleRequests, ({ one }) => ({
  nurse: one(users, {
    fields: [scheduleRequests.nurseId],
    references: [users.id],
  }),
  swapWithNurse: one(users, {
    fields: [scheduleRequests.swapWithNurseId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [scheduleRequests.reviewedBy],
    references: [users.id],
  }),
}));

export const preferenceHistoryRelations = relations(preferenceHistory, ({ one }) => ({
  nurse: one(users, {
    fields: [preferenceHistory.nurseId],
    references: [users.id],
  }),
  preference: one(nursePreferences, {
    fields: [preferenceHistory.preferenceId],
    references: [nursePreferences.id],
  }),
  changedBy: one(users, {
    fields: [preferenceHistory.changedBy],
    references: [users.id],
  }),
}));
