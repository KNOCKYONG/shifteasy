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
import { users, departments } from './tenants';

// ==========================================
// Nurse Schedule Preferences (간호사 스케줄 선호도)
// ==========================================

export const nursePreferences = pgTable('nurse_preferences', {
  // ==========================================
  // Basic Information (기본 정보)
  // ==========================================
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  nurseId: uuid('nurse_id').notNull().references(() => users.id),
  departmentId: uuid('department_id'), // User's department from users table

  // ==========================================
  // Shift Preferences (근무 선호도)
  // ==========================================

  // Work pattern type
  workPatternType: text('work_pattern_type').default('three-shift'), // 'three-shift', 'night-intensive', 'weekday-only'

  // Shift pattern preferences
  preferredPatterns: jsonb('preferred_patterns').$type<{
    pattern: string; // 예: 'DD-EE-NN-OFF'
    preference: number; // 0-10
  }[]>(),

  // Avoid patterns (기피 근무 패턴 - 개인)
  avoidPatterns: jsonb('avoid_patterns').$type<string[][]>(), // 기피하는 근무 패턴 배열

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
// COMMENTED OUT - Not currently needed
/*
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
*/

// ==========================================
// Off-Balance Ledger (잔여 OFF 기록)
// ==========================================

export const offBalanceLedger = pgTable('off_balance_ledger', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  nurseId: uuid('nurse_id').notNull().references(() => users.id),
  departmentId: uuid('department_id').references(() => departments.id),

  // Period information
  year: integer('year').notNull(), // 연도: 2024
  month: integer('month').notNull(), // 월: 1-12
  periodStart: timestamp('period_start').notNull(), // 기간 시작일
  periodEnd: timestamp('period_end').notNull(), // 기간 종료일

  // OFF day tracking
  guaranteedOffDays: integer('guaranteed_off_days').notNull(), // 보장 받은 OFF 일수
  actualOffDays: integer('actual_off_days').notNull().default(0), // 실제 배정된 OFF 일수
  remainingOffDays: integer('remaining_off_days').notNull().default(0), // 잔여 OFF 일수 (보장 - 실제)
  accumulatedOffDays: integer('accumulated_off_days').notNull().default(0), // 누적 잔여 OFF (현 사이클)
  allocatedToAccumulation: integer('allocated_to_accumulation').notNull().default(0), // 적립 분
  allocatedToAllowance: integer('allocated_to_allowance').notNull().default(0), // 수당 분

  // Compensation details
  compensationType: text('compensation_type'), // 'allowance' | 'accumulate' | null (not yet processed)
  compensationAmount: integer('compensation_amount'), // 수당 금액 (compensationType이 'allowance'인 경우)
  compensationProcessedAt: timestamp('compensation_processed_at'), // 보상 처리 일시

  // Status tracking
  status: text('status').default('pending'), // 'pending', 'processed', 'cancelled'
  allocationStatus: text('allocation_status').default('pending'), // 배분 상태
  allocationUpdatedAt: timestamp('allocation_updated_at'),
  allocationUpdatedBy: uuid('allocation_updated_by').references(() => users.id),
  scheduleId: uuid('schedule_id'), // 연관된 스케줄 ID (있는 경우)

  // Metadata
  notes: text('notes'), // 메모 또는 특이사항
  processedBy: uuid('processed_by').references(() => users.id), // 처리한 관리자 ID

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nurseIdx: index('off_balance_ledger_nurse_idx').on(table.nurseId),
  tenantIdx: index('off_balance_ledger_tenant_idx').on(table.tenantId),
  periodIdx: index('off_balance_ledger_period_idx').on(table.year, table.month),
  departmentIdx: index('off_balance_ledger_department_idx').on(table.departmentId),
  statusIdx: index('off_balance_ledger_status_idx').on(table.status),
}));

// ==========================================
// Relations
// ==========================================

export const nursePreferenceRelations = relations(nursePreferences, ({ one }) => ({
  nurse: one(users, {
    fields: [nursePreferences.nurseId],
    references: [users.id],
  }),
  // history: many(preferenceHistory), // COMMENTED OUT
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

// COMMENTED OUT - preferenceHistory relations
/*
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
*/

export const offBalanceLedgerRelations = relations(offBalanceLedger, ({ one }) => ({
  nurse: one(users, {
    fields: [offBalanceLedger.nurseId],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [offBalanceLedger.departmentId],
    references: [departments.id],
  }),
  processedBy: one(users, {
    fields: [offBalanceLedger.processedBy],
    references: [users.id],
  }),
  allocationUpdatedByUser: one(users, {
    fields: [offBalanceLedger.allocationUpdatedBy],
    references: [users.id],
  }),
}));
