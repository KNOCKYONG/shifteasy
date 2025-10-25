import { pgTable, uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { departments } from './tenants';

export const teamPatterns = pgTable('team_patterns', {
  id: uuid('id').primaryKey().defaultRandom(),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'cascade' }).notNull(),

  // 시프트별 필요 인원
  requiredStaffDay: integer('required_staff_day').notNull().default(5),
  requiredStaffEvening: integer('required_staff_evening').notNull().default(4),
  requiredStaffNight: integer('required_staff_night').notNull().default(3),

  // 기본 근무 패턴 (JSON 배열로 저장)
  defaultPatterns: jsonb('default_patterns').$type<string[][]>().notNull().default([
    ['D', 'D', 'D', 'OFF', 'OFF']
  ]),

  // 메타 정보
  totalMembers: integer('total_members').notNull().default(15),
  isActive: text('is_active').notNull().default('true'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  departmentIdx: index('team_patterns_department_idx').on(table.departmentId),
  activeIdx: index('team_patterns_active_idx').on(table.isActive),
}));

export const teamPatternsRelations = relations(teamPatterns, ({ one }) => ({
  department: one(departments, {
    fields: [teamPatterns.departmentId],
    references: [departments.id],
  }),
}));