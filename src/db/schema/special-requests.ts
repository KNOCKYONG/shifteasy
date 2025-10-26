/**
 * Special Requests Schema
 * 개인 특별 요청 스키마 (휴가, 특근 등)
 */

import {
  pgTable,
  text,
  timestamp,
  uuid,
  date,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './tenants';

// ==========================================
// Special Requests (개인 특별 요청)
// ==========================================

export const specialRequests = pgTable('special_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  employeeId: uuid('employee_id').notNull().references(() => users.id),

  // Request details
  requestType: text('request_type').notNull(), // 'vacation', 'day_off', 'overtime', 'shift_change'
  startDate: date('start_date').notNull(), // 요청 시작일
  endDate: date('end_date'), // 요청 종료일 (단일일 경우 null 가능)

  // Approval status
  status: text('status').default('approved'), // 'pending', 'approved', 'rejected'

  // Additional information
  reason: text('reason'), // 사유
  notes: text('notes'), // 관리자 메모

  // Administrative fields
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('special_requests_tenant_idx').on(table.tenantId),
  employeeIdx: index('special_requests_employee_idx').on(table.employeeId),
  dateIdx: index('special_requests_date_idx').on(table.startDate, table.endDate),
  statusIdx: index('special_requests_status_idx').on(table.status),
}));

// ==========================================
// Relations
// ==========================================

export const specialRequestsRelations = relations(specialRequests, ({ one }) => ({
  employee: one(users, {
    fields: [specialRequests.employeeId],
    references: [users.id],
  }),
}));
