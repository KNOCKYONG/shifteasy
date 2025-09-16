import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { wards } from './wards';

export const hospitals = pgTable('hospitals', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  timeZone: text('time_zone').notNull().default('Asia/Seoul'),
  settings: jsonb('settings').$type<{
    workHoursPerDay?: number;
    shiftPatterns?: any;
    holidaySettings?: any;
    overtimeRules?: any;
  }>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  tenantIdx: index('hospitals_tenant_id_idx').on(table.tenantId),
}));

export const hospitalsRelations = relations(hospitals, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [hospitals.tenantId],
    references: [tenants.id],
  }),
  wards: many(wards),
}));