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
  time,
  date,
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
  
  // Weekend preferences
  weekendPreference: text('weekend_preference'), // 'prefer', 'avoid', 'neutral'
  maxWeekendsPerMonth: integer('max_weekends_per_month'),
  preferAlternatingWeekends: boolean('prefer_alternating_weekends').default(false),
  
  // Holiday preferences
  holidayPreference: text('holiday_preference'), // 'prefer', 'avoid', 'neutral'
  specificHolidayPreferences: jsonb('specific_holiday_preferences').$type<{
    holidayName: string;
    preference: 'work' | 'off' | 'neutral';
  }[]>(),
  
  // ==========================================
  // Unit/Location Preferences (부서/위치 선호도)
  // ==========================================
  
  preferredUnits: jsonb('preferred_units').$type<string[]>(), // ['ICU', 'ER']
  avoidUnits: jsonb('avoid_units').$type<string[]>(),
  floatPoolWilling: boolean('float_pool_willing').default(false),
  floatPoolPreferences: jsonb('float_pool_preferences').$type<{
    preferredUnits: string[];
    avoidUnits: string[];
    maxFloatsPerMonth: number;
  }>(),
  
  // ==========================================
  // Team/Colleague Preferences (팀/동료 선호도)
  // ==========================================
  
  preferredColleagues: jsonb('preferred_colleagues').$type<string[]>(), // User IDs
  avoidColleagues: jsonb('avoid_colleagues').$type<string[]>(), // User IDs
  preferredTeamSize: text('preferred_team_size'), // 'small', 'medium', 'large'
  mentorshipPreference: text('mentorship_preference'), // 'mentor', 'mentee', 'neither'
  preferredMentors: jsonb('preferred_mentors').$type<string[]>(),
  
  // ==========================================
  // Overtime/Extra Shift Preferences (추가 근무 선호도)
  // ==========================================
  
  overtimeWilling: boolean('overtime_willing').default(false),
  maxOvertimeHoursPerMonth: integer('max_overtime_hours_per_month'),
  overtimeNoticeRequired: integer('overtime_notice_required'), // Hours in advance
  callShiftWilling: boolean('call_shift_willing').default(false),
  emergencyAvailability: boolean('emergency_availability').default(false),
  
  // ==========================================
  // Personal Constraints (개인 제약사항)
  // ==========================================
  
  // Availability constraints
  unavailableDates: jsonb('unavailable_dates').$type<{
    startDate: string;
    endDate: string;
    reason: string;
    isRecurring: boolean;
  }[]>(),
  
  // Time constraints
  earliestStartTime: time('earliest_start_time'), // 예: '06:00'
  latestEndTime: time('latest_end_time'), // 예: '23:00'
  
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
  
  // ==========================================
  // Education/Training Preferences (교육 선호도)
  // ==========================================
  
  educationInProgress: boolean('education_in_progress').default(false),
  educationSchedule: jsonb('education_schedule').$type<{
    days: string[];
    times: string[];
    endDate: string;
  }>(),
  
  trainingInterests: jsonb('training_interests').$type<string[]>(),
  certificationGoals: jsonb('certification_goals').$type<string[]>(),
  
  // ==========================================
  // Health/Accommodation Needs (건강/편의 요구사항)
  // ==========================================
  
  hasAccommodationNeeds: boolean('has_accommodation_needs').default(false),
  accommodationDetails: text('accommodation_details'), // Encrypted/protected field
  
  // Pregnancy/Maternity considerations
  pregnancyStatus: text('pregnancy_status'), // 'not_applicable', 'pregnant', 'postpartum'
  pregnancyRestrictions: jsonb('pregnancy_restrictions').$type<{
    noNightShifts: boolean;
    noOvertimeAllowed: boolean;
    maxConsecutiveDays: number;
    weightRestrictions: boolean;
    chemotherapyExposureRestriction: boolean;
  }>(),
  
  expectedReturnDate: date('expected_return_date'),
  
  // ==========================================
  // Preference Priority/Weight (선호도 가중치)
  // ==========================================
  
  preferencePriorities: jsonb('preference_priorities').$type<{
    shiftType: number; // 0-10
    consecutiveDaysOff: number;
    weekendOff: number;
    teamPreference: number;
    unitPreference: number;
    overtimeAvoidance: number;
  }>(),
  
  // ==========================================
  // Administrative Fields
  // ==========================================
  
  isActive: boolean('is_active').default(true),
  lastReviewedAt: timestamp('last_reviewed_at'),
  nextReviewDate: date('next_review_date'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  notes: text('notes'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nurseIdx: index('nurse_preferences_nurse_idx').on(table.nurseId),
  tenantIdx: index('nurse_preferences_tenant_idx').on(table.tenantId),
  departmentIdx: index('nurse_preferences_department_idx').on(table.departmentId),
  activeIdx: index('nurse_preferences_active_idx').on(table.isActive),
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
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
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
// Preference Templates (선호도 템플릿)
// ==========================================

export const preferenceTemplates = pgTable('preference_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  
  // Template info
  name: text('name').notNull(), // 예: 'New Graduate', 'Senior Nurse', 'Part-time'
  description: text('description'),
  category: text('category'), // 'experience_level', 'employment_type', 'specialty'
  
  // Template content (same structure as nursePreferences)
  templateData: jsonb('template_data').notNull(),
  
  // Usage tracking
  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
  
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').references(() => users.id),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('preference_templates_tenant_idx').on(table.tenantId),
  categoryIdx: index('preference_templates_category_idx').on(table.category),
  activeIdx: index('preference_templates_active_idx').on(table.isActive),
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
  approver: one(users, {
    fields: [nursePreferences.approvedBy],
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

export const preferenceTemplateRelations = relations(preferenceTemplates, ({ one }) => ({
  creator: one(users, {
    fields: [preferenceTemplates.createdBy],
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