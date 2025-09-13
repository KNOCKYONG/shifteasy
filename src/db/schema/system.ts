import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

// 감사 로그 (모든 중요 작업 기록)
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id'),
  action: text('action').notNull(), // CREATE_SCHEDULE, MODIFY_ASSIGNMENT 등
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),

  oldData: jsonb('old_data').$type<any>(),
  newData: jsonb('new_data').$type<any>(),
  metadata: jsonb('metadata').$type<{
    ipAddress?: string;
    userAgent?: string;
  }>(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 시스템 설정
export const systemConfig = pgTable('system_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').unique().notNull(),
  value: jsonb('value').$type<any>().notNull(),

  description: text('description'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});