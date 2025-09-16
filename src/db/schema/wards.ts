import { pgTable, uuid, text, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { hospitals } from './hospitals';
import { staff } from './staff';
import { shifts } from './shifts';
import { wardSchedules } from './schedules';
import { requests } from './requests';

export const wards = pgTable('wards', {
  id: uuid('id').primaryKey().defaultRandom(),
  hospitalId: uuid('hospital_id').references(() => hospitals.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  code: text('code').notNull(), // 병동 코드 (예: 3A, 5B)

  // 병동별 규칙 (JSON으로 저장)
  hardRules: jsonb('hard_rules').$type<{
    minStaffPerShift?: number;
    maxConsecutiveShifts?: number;
    minRestBetweenShifts?: number;
    requiredSkillMix?: any;
  }>().default({}),

  softRules: jsonb('soft_rules').$type<{
    preferredStaffRatio?: number;
    targetFairnessScore?: number;
    maxOvertimeHours?: number;
  }>().default({}),

  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  hospitalIdx: index('wards_hospital_id_idx').on(table.hospitalId),
  codeIdx: index('wards_code_idx').on(table.code),
}));

export const wardsRelations = relations(wards, ({ one, many }) => ({
  hospital: one(hospitals, {
    fields: [wards.hospitalId],
    references: [hospitals.id],
  }),
  staff: many(staff),
  shifts: many(shifts),
  schedules: many(wardSchedules),
  requests: many(requests),
}));