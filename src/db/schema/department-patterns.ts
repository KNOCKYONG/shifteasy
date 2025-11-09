import { pgTable, uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { departments } from './tenants';

export const departmentPatterns = pgTable('department_patterns', {
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

  // 기피 근무 패턴 (JSON 배열로 저장) - 스케줄 생성 시 피해야 할 연속 시프트 조합
  // 예: [['N', 'N', 'D']] = 야간 2일 후 바로 주간 근무는 피해야 함
  avoidPatterns: jsonb('avoid_patterns').$type<string[][]>().default([]),

  // 메타 정보
  totalMembers: integer('total_members').notNull().default(15),
  isActive: text('is_active').notNull().default('true'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  departmentIdx: index('department_patterns_department_idx').on(table.departmentId),
  activeIdx: index('department_patterns_active_idx').on(table.isActive),
}));

export const departmentPatternsRelations = relations(departmentPatterns, ({ one }) => ({
  department: one(departments, {
    fields: [departmentPatterns.departmentId],
    references: [departments.id],
  }),
}));
