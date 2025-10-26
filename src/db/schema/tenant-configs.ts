import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

/**
 * Tenant Configs - Tenant별 설정 마스터 데이터
 *
 * Config 화면에서 관리하는 모든 설정을 tenant별로 저장합니다:
 * - shift_types: 근무 타입
 * - positions: 직위
 * - departments: 부서
 * - contract_types: 계약 형태
 * - position_groups: 직위 그룹
 * - employee_statuses: 직원 상태
 */
export const tenantConfigs = pgTable('tenant_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),

  // Config 키 (예: 'shift_types', 'positions', 'departments')
  configKey: text('config_key').notNull(),

  // Config 값 (JSON)
  configValue: jsonb('config_value').notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type TenantConfig = typeof tenantConfigs.$inferSelect;
export type NewTenantConfig = typeof tenantConfigs.$inferInsert;
