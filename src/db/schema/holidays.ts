/**
 * Holidays Schema
 * 법정 공휴일 및 휴무일 스키마
 */

import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  date,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==========================================
// Holidays (법정 공휴일)
// ==========================================

export const holidays = pgTable('holidays', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),

  // Holiday details
  date: date('date').notNull(), // 휴일 날짜 (YYYY-MM-DD)
  name: text('name').notNull(), // 휴일 명칭 (예: "설날", "추석")

  // Recurrence
  isRecurring: boolean('is_recurring').default(false), // 매년 반복 여부

  // Administrative fields
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('holidays_tenant_idx').on(table.tenantId),
  dateIdx: index('holidays_date_idx').on(table.date),
  tenantDateIdx: index('holidays_tenant_date_idx').on(table.tenantId, table.date),
}));

// ==========================================
// Relations
// ==========================================

export const holidaysRelations = relations(holidays, ({ one }) => ({}));
