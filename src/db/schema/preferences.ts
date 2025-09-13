import { pgTable, uuid, timestamp, integer, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { staff } from './staff';
import { shiftTypeEnum } from './shifts';

export const preferences = pgTable('preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').references(() => staff.id).notNull(),

  date: timestamp('date').notNull(), // 선호/기피 날짜
  shiftType: shiftTypeEnum('shift_type'), // 선호 근무조 (null이면 오프 선호)
  score: integer('score').notNull(), // 선호도 점수 (-5 ~ +5, 음수는 기피)
  reason: text('reason'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const preferencesRelations = relations(preferences, ({ one }) => ({
  staff: one(staff, {
    fields: [preferences.staffId],
    references: [staff.id],
  }),
}));