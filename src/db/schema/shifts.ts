import { pgTable, uuid, text, timestamp, integer, pgEnum, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { wards } from './wards';
import { wardAssignments } from './assignments';

// Enum for shift types
export const shiftTypeEnum = pgEnum('shift_type', ['D', 'E', 'N', 'O']);

export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  wardId: uuid('ward_id').references(() => wards.id, { onDelete: 'cascade' }).notNull(),
  type: shiftTypeEnum('type').notNull(),
  label: text('label').notNull(), // 표시명 (예: "Day Shift")

  startTime: text('start_time'), // "07:00" (Off는 null)
  endTime: text('end_time'), // "15:00"
  duration: integer('duration'), // 근무 시간 (분 단위)

  // 근무조별 최소 인원
  minStaff: integer('min_staff').notNull().default(0),

  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  wardIdx: index('shifts_ward_id_idx').on(table.wardId),
  typeIdx: index('shifts_type_idx').on(table.type),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  ward: one(wards, {
    fields: [shifts.wardId],
    references: [wards.id],
  }),
  assignments: many(wardAssignments),
}));

