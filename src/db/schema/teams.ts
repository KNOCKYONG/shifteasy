import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants, departments, users } from './tenants';

/**
 * Teams table - 팀 관리
 * manager가 자유롭게 팀을 추가/삭제하고 이름을 설정할 수 있습니다.
 */
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'cascade' }),

  name: text('name').notNull(), // 팀 이름 (예: "A팀", "주간팀", "간호1팀" 등)
  code: text('code').notNull(), // 팀 코드 (예: "A", "B", "C", "DAY1" 등)
  color: text('color').notNull().default('#3B82F6'), // 팀 색상

  displayOrder: integer('display_order').notNull().default(0), // 표시 순서
  isActive: text('is_active').notNull().default('true'), // 활성 여부

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  tenantIdx: index('teams_tenant_id_idx').on(table.tenantId),
  departmentIdx: index('teams_department_id_idx').on(table.departmentId),
  codeIdx: index('teams_code_idx').on(table.code),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [teams.tenantId],
    references: [tenants.id],
  }),
  department: one(departments, {
    fields: [teams.departmentId],
    references: [departments.id],
  }),
  members: many(users),
}));
