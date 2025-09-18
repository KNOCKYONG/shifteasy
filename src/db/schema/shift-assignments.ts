import { pgTable, uuid, text, timestamp, integer, boolean, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants, users, schedules, shiftTypes } from './tenants';

// Shift Assignments table - 실제 근무 배정
export const shiftAssignments = pgTable('shift_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  scheduleId: uuid('schedule_id').references(() => schedules.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  shiftTypeId: uuid('shift_type_id').references(() => shiftTypes.id, { onDelete: 'restrict' }).notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),

  // 실제 근무 시간 (수정 가능)
  startTime: text('start_time').notNull(), // "07:00"
  endTime: text('end_time').notNull(), // "15:00"
  breakMinutes: integer('break_minutes').default(0),

  // 상태
  status: text('status').notNull().default('scheduled'), // scheduled, confirmed, completed, absent, cancelled

  // 메타데이터
  notes: text('notes'),
  metadata: jsonb('metadata').$type<{
    originalShiftTypeId?: string;
    swapRequestId?: string;
    modifiedBy?: string;
    modifiedAt?: string;
    reason?: string;
  }>(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  tenantIdx: index('shift_assignments_tenant_id_idx').on(table.tenantId),
  scheduleIdx: index('shift_assignments_schedule_id_idx').on(table.scheduleId),
  userIdx: index('shift_assignments_user_id_idx').on(table.userId),
  dateIdx: index('shift_assignments_date_idx').on(table.date),
  statusIdx: index('shift_assignments_status_idx').on(table.status),
  // Composite index for efficient queries
  userDateIdx: index('shift_assignments_user_date_idx').on(table.userId, table.date),
  scheduleDateIdx: index('shift_assignments_schedule_date_idx').on(table.scheduleId, table.date),
}));

// Shift Preferences table - 직원 선호도
export const shiftPreferences = pgTable('shift_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // 선호 근무
  preferredShiftTypes: jsonb('preferred_shift_types').$type<string[]>().default([]),
  preferredDaysOfWeek: jsonb('preferred_days_of_week').$type<number[]>().default([]), // 0-6 (일-토)

  // 제약사항
  maxShiftsPerWeek: integer('max_shifts_per_week'),
  maxConsecutiveDays: integer('max_consecutive_days'),
  minRestHoursBetweenShifts: integer('min_rest_hours_between_shifts').default(11),

  // 특정 날짜 불가
  unavailableDates: jsonb('unavailable_dates').$type<string[]>().default([]),

  // 유효 기간
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }),

  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  tenantIdx: index('shift_preferences_tenant_id_idx').on(table.tenantId),
  userIdx: index('shift_preferences_user_id_idx').on(table.userId),
  activeIdx: index('shift_preferences_active_idx').on(table.active),
}));

// Leave Requests table - 휴가 신청
export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  type: text('type').notNull(), // annual, sick, personal, maternity, other
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),

  reason: text('reason'),
  status: text('status').notNull().default('pending'), // pending, approved, rejected, cancelled

  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),

  metadata: jsonb('metadata').$type<{
    attachments?: string[];
    notes?: string;
  }>(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  tenantIdx: index('leave_requests_tenant_id_idx').on(table.tenantId),
  userIdx: index('leave_requests_user_id_idx').on(table.userId),
  statusIdx: index('leave_requests_status_idx').on(table.status),
  dateRangeIdx: index('leave_requests_date_range_idx').on(table.startDate, table.endDate),
}));

// Relations
export const shiftAssignmentsRelations = relations(shiftAssignments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [shiftAssignments.tenantId],
    references: [tenants.id],
  }),
  schedule: one(schedules, {
    fields: [shiftAssignments.scheduleId],
    references: [schedules.id],
  }),
  user: one(users, {
    fields: [shiftAssignments.userId],
    references: [users.id],
  }),
  shiftType: one(shiftTypes, {
    fields: [shiftAssignments.shiftTypeId],
    references: [shiftTypes.id],
  }),
}));

export const shiftPreferencesRelations = relations(shiftPreferences, ({ one }) => ({
  tenant: one(tenants, {
    fields: [shiftPreferences.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [shiftPreferences.userId],
    references: [users.id],
  }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  tenant: one(tenants, {
    fields: [leaveRequests.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [leaveRequests.userId],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [leaveRequests.approvedBy],
    references: [users.id],
  }),
}));

// Type exports
export type ShiftAssignment = typeof shiftAssignments.$inferSelect;
export type NewShiftAssignment = typeof shiftAssignments.$inferInsert;
export type ShiftPreference = typeof shiftPreferences.$inferSelect;
export type NewShiftPreference = typeof shiftPreferences.$inferInsert;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type NewLeaveRequest = typeof leaveRequests.$inferInsert;