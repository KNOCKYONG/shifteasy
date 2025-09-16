import { pgTable, uuid, timestamp, integer, text, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { staff } from './staff';
import { shiftTypeEnum } from './shifts';

export const preferences = pgTable('preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }).notNull(),

  date: timestamp('date', { withTimezone: true }).notNull(), // 선호/기피 날짜
  shiftType: shiftTypeEnum('shift_type'), // 선호 근무조 (null이면 오프 선호)
  score: integer('score').notNull(), // 선호도 점수 (-5 ~ +5, 음수는 기피)
  reason: text('reason'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  staffIdx: index('preferences_staff_id_idx').on(table.staffId),
  dateIdx: index('preferences_date_idx').on(table.date),
}));

export const preferencesRelations = relations(preferences, ({ one }) => ({
  staff: one(staff, {
    fields: [preferences.staffId],
    references: [staff.id],
  }),
}));