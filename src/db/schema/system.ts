import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

// 감사 로그 (모든 중요 작업 기록)
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id'),
  actorId: text('actor_id'),
  action: text('action').notNull(), // CREATE_SCHEDULE, MODIFY_ASSIGNMENT 등
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),

  before: jsonb('before').$type<any>(),
  after: jsonb('after').$type<any>(),
  metadata: jsonb('metadata').$type<{
    ipAddress?: string;
    userAgent?: string;
  }>(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('audit_log_tenant_id_idx').on(table.tenantId),
  actorIdx: index('audit_log_actor_id_idx').on(table.actorId),
  entityIdx: index('audit_log_entity_idx').on(table.entityType, table.entityId),
  createdIdx: index('audit_log_created_at_idx').on(table.createdAt),
}));

// 시스템 설정
export const systemConfig = pgTable('system_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').unique().notNull(),
  value: jsonb('value').$type<any>().notNull(),

  description: text('description'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  keyIdx: index('system_config_key_idx').on(table.key),
}));