import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { wards } from './wards';
import { users } from './tenants';
import { wardAssignments } from './assignments';

// Enum for schedule status
export const scheduleStatusEnum = pgEnum('schedule_status', ['DRAFT', 'PENDING_APPROVAL', 'CONFIRMED', 'ARCHIVED']);

export const wardSchedules = pgTable('ward_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  wardId: uuid('ward_id').references(() => wards.id).notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),

  name: text('name').notNull(), // 스케줄명 (예: "2025년 3월 3A병동")
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: scheduleStatusEnum('status').notNull().default('DRAFT'),
  version: text('version').notNull().default('draft'),

  // 생성 시 사용된 규칙/설정 스냅샷
  rulesSnapshot: jsonb('rules_snapshot').$type<{
    hardRules?: any;
    softRules?: any;
    constraints?: any;
  }>().default({}),

  // 메타 정보
  generatedAt: timestamp('generated_at'),
  confirmedAt: timestamp('confirmed_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const wardSchedulesRelations = relations(wardSchedules, ({ one, many }) => ({
  ward: one(wards, {
    fields: [wardSchedules.wardId],
    references: [wards.id],
  }),
  creator: one(users, {
    fields: [wardSchedules.createdBy],
    references: [users.id],
  }),
  assignments: many(wardAssignments),
}));