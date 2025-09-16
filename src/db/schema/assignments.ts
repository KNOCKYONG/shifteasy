import { pgTable, uuid, timestamp, boolean, real, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { wardSchedules } from './schedules';
import { staff } from './staff';
import { shifts } from './shifts';

export const wardAssignments = pgTable('ward_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  scheduleId: uuid('schedule_id').references(() => wardSchedules.id, { onDelete: 'cascade' }).notNull(),
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id, { onDelete: 'cascade' }).notNull(),

  date: timestamp('date', { withTimezone: true }).notNull(), // 근무 날짜

  // 배치 메타 정보
  isOvertime: boolean('is_overtime').notNull().default(false),
  isReplacement: boolean('is_replacement').notNull().default(false),
  confidence: real('confidence'), // AI 추천 신뢰도 (0-1)

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  scheduleIdx: index('ward_assignments_schedule_id_idx').on(table.scheduleId),
  staffIdx: index('ward_assignments_staff_id_idx').on(table.staffId),
  shiftIdx: index('ward_assignments_shift_id_idx').on(table.shiftId),
  dateIdx: index('ward_assignments_date_idx').on(table.date),
}));

export const wardAssignmentsRelations = relations(wardAssignments, ({ one }) => ({
  schedule: one(wardSchedules, {
    fields: [wardAssignments.scheduleId],
    references: [wardSchedules.id],
  }),
  staff: one(staff, {
    fields: [wardAssignments.staffId],
    references: [staff.id],
  }),
  shift: one(shifts, {
    fields: [wardAssignments.shiftId],
    references: [shifts.id],
  }),
}));