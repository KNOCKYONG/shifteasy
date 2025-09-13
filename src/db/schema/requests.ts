import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
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
  wardId: uuid('ward_id').references(() => wards.id).notNull(),
  staffId: uuid('staff_id').references(() => staff.id).notNull(),

  type: requestTypeEnum('type').notNull(),
  status: requestStatusEnum('status').notNull().default('PENDING'),
  priority: requestPriorityEnum('priority').notNull().default('MEDIUM'),

  // 요청 내용
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  shiftType: shiftTypeEnum('shift_type'), // 근무 관련 요청의 경우

  reason: text('reason'),
  description: text('description'),

  // 승인 관련
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at'),
  rejectedReason: text('rejected_reason'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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