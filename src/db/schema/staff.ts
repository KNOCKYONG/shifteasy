import { pgTable, uuid, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { wards } from './wards';
import { users } from './tenants';
import { preferences } from './preferences';
import { wardAssignments } from './assignments';
import { requests } from './requests';

// Enum for staff roles
export const staffRoleEnum = pgEnum('staff_role', ['RN', 'CN', 'SN', 'NA']);

export const staff = pgTable('staff', {
  id: uuid('id').primaryKey().defaultRandom(),
  wardId: uuid('ward_id').references(() => wards.id).notNull(),
  userId: uuid('user_id').references(() => users.id).unique(),

  name: text('name').notNull(),
  role: staffRoleEnum('role').notNull(),
  employeeId: text('employee_id'),
  hireDate: timestamp('hire_date'),

  // 기본 정보
  maxWeeklyHours: integer('max_weekly_hours').notNull().default(40),
  skills: text('skills').array(),

  // 역량 평가 (1-5 척도)
  technicalSkill: integer('technical_skill').notNull().default(3),
  leadership: integer('leadership').notNull().default(3),
  communication: integer('communication').notNull().default(3),
  adaptability: integer('adaptability').notNull().default(3),
  reliability: integer('reliability').notNull().default(3),

  // 경력 레벨
  experienceLevel: text('experience_level').notNull().default('JUNIOR'), // NEWBIE, JUNIOR, SENIOR, EXPERT

  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const staffRelations = relations(staff, ({ one, many }) => ({
  ward: one(wards, {
    fields: [staff.wardId],
    references: [wards.id],
  }),
  user: one(users, {
    fields: [staff.userId],
    references: [users.id],
  }),
  preferences: many(preferences),
  assignments: many(wardAssignments),
  requests: many(requests),
}));

// 팀 궁합 매트릭스
export const staffCompatibility = pgTable('staff_compatibility', {
  id: uuid('id').primaryKey().defaultRandom(),
  staff1Id: uuid('staff1_id').notNull(),
  staff2Id: uuid('staff2_id').notNull(),

  // 궁합 지수 (1-5, 5가 최고)
  compatibilityScore: real('compatibility_score').notNull(),

  // 협업 이력
  totalShiftsTogether: integer('total_shifts_together').notNull().default(0),
  successfulShifts: integer('successful_shifts').notNull().default(0),

  // 평가 기준별 점수
  communicationScore: real('communication_score'),
  workStyleScore: real('work_style_score'),
  reliabilityScore: real('reliability_score'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

import { boolean, real } from 'drizzle-orm/pg-core';