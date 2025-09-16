import { pgTable, uuid, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { wards } from './wards';
import { staff } from './staff';
import { shiftTypeEnum } from './shifts';

// Enums for request management
export const requestTypeEnum = pgEnum('request_type', [
  'ANNUAL_LEAVE',
  'SICK_LEAVE',
  'SHIFT_PREFERENCE',
  'SHIFT_AVOIDANCE',
  'OVERTIME'
]);

export const requestStatusEnum = pgEnum('request_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
]);

export const requestPriorityEnum = pgEnum('request_priority', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
]);

export const requests = pgTable('requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  wardId: uuid('ward_id').references(() => wards.id, { onDelete: 'cascade' }).notNull(),
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }).notNull(),

  type: requestTypeEnum('type').notNull(),
  status: requestStatusEnum('status').notNull().default('PENDING'),
  priority: requestPriorityEnum('priority').notNull().default('MEDIUM'),

  // 요청 내용
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  shiftType: shiftTypeEnum('shift_type'), // 근무 관련 요청의 경우

  reason: text('reason'),
  description: text('description'),

  // 승인 관련
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectedReason: text('rejected_reason'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  wardIdx: index('requests_ward_id_idx').on(table.wardId),
  staffIdx: index('requests_staff_id_idx').on(table.staffId),
  statusIdx: index('requests_status_idx').on(table.status),
  dateRangeIdx: index('requests_date_range_idx').on(table.startDate, table.endDate),
}));

export const requestsRelations = relations(requests, ({ one }) => ({
  ward: one(wards, {
    fields: [requests.wardId],
    references: [wards.id],
  }),
  staff: one(staff, {
    fields: [requests.staffId],
    references: [staff.id],
  }),
}));