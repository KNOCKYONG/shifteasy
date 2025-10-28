import { pgTable, uuid, text, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
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
 * - schedule_rules: 스케줄 생성 규칙
 * - shift_rules: 근무 규칙
 * - performance_thresholds: 성능 임계값
 * - staff_experience_weights: 경력 가중치
 * - team_balance_rules: 팀 밸런스 규칙
 * - balance_weights: 밸런스 계산 가중치
 * - staff_default_values: 직원 기본값
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
}, (table) => ({
  // Unique constraint: one config key per tenant
  tenantConfigKeyUnique: uniqueIndex('tenant_configs_tenant_id_config_key_unique').on(table.tenantId, table.configKey),
}));

export type TenantConfig = typeof tenantConfigs.$inferSelect;
export type NewTenantConfig = typeof tenantConfigs.$inferInsert;
