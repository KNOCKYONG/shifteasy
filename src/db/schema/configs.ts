import { pgTable, uuid, text, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants, departments } from './tenants';

/**
 * Configs - 조직 설정 마스터 데이터
 *
 * Tenant 및 Department별 설정을 저장합니다.
 * department_id가 NULL이면 tenant 전체 기본 설정,
 * department_id가 있으면 해당 부서의 설정 (오버라이드)
 *
 * Config 화면에서 관리하는 모든 설정:
 * - shift_types: 근무 타입 (부서별로 다를 수 있음)
 * - positions: 직위 (부서별로 다를 수 있음)
 * - departments: 부서 목록 (tenant 레벨)
 * - contract_types: 계약 형태
 * - position_groups: 직위 그룹
 * - employee_statuses: 직원 상태
 * - schedule_rules: 스케줄 생성 규칙 (부서별)
 * - shift_rules: 근무 규칙 (부서별)
 * - performance_thresholds: 성능 임계값
 * - staff_experience_weights: 경력 가중치
 * - team_balance_rules: 팀 밸런스 규칙 (부서별)
 * - balance_weights: 밸런스 계산 가중치
 * - staff_default_values: 직원 기본값
 */
export const configs = pgTable('configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),

  // Department ID - NULL이면 tenant 기본 설정, 값이 있으면 부서별 설정
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'cascade' }),

  // Config 키 (예: 'shift_types', 'positions', 'departments')
  configKey: text('config_key').notNull(),

  // Config 값 (JSON)
  configValue: jsonb('config_value').notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Unique constraint: (tenant_id, department_id, config_key)
  // department_id가 NULL인 경우도 고려하여 UNIQUE 설정
  configsUnique: uniqueIndex('configs_tenant_dept_key_unique')
    .on(table.tenantId, table.departmentId, table.configKey),
}));

export type Config = typeof configs.$inferSelect;
export type NewConfig = typeof configs.$inferInsert;
