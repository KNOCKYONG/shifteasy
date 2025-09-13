import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { wards } from './wards';

export const hospitals = pgTable('hospitals', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  name: text('name').notNull(),
  timeZone: text('time_zone').notNull().default('Asia/Seoul'),
  settings: jsonb('settings').$type<{
    workHoursPerDay?: number;
    shiftPatterns?: any;
    holidaySettings?: any;
    overtimeRules?: any;
  }>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const hospitalsRelations = relations(hospitals, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [hospitals.tenantId],
    references: [tenants.id],
  }),
  wards: many(wards),
}));