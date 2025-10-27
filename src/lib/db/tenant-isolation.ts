import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  tenants,
  users,
  departments,
  schedules,
  swapRequests,
  notifications,
  auditLogs,
  shiftTypes,
  patterns
} from '@/db/schema/tenants';
import type { SQL } from 'drizzle-orm';

/**
 * 테넌트 격리를 위한 유틸리티 함수들
 * 모든 DB 쿼리에서 tenant_id를 자동으로 필터링합니다
 */

export class TenantIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantIsolationError';
  }
}

/**
 * 테넌트 컨텍스트 타입
 */
export interface TenantContext {
  tenantId: string;
  userId?: string;
  role?: string;
}

/**
 * 테넌트별로 격리된 데이터베이스 쿼리 헬퍼
 */
export class ScopedDb {
  constructor(private context: TenantContext) {
    if (!context.tenantId) {
      throw new TenantIsolationError('Tenant ID is required for scoped queries');
    }
  }

  /**
   * 테넌트 ID를 포함한 WHERE 조건 생성
   */
  private withTenant<T extends { tenantId: any }>(
    table: T,
    additionalConditions?: SQL
  ): SQL {
    const tenantCondition = eq(table.tenantId, this.context.tenantId);

    if (additionalConditions) {
      return and(tenantCondition, additionalConditions)!;
    }

    return tenantCondition;
  }

  /**
   * 테넌트 정보 조회
   */
  async getTenant() {
    return await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, this.context.tenantId))
      .limit(1);
  }

  /**
   * 사용자 조회 (테넌트 격리)
   */
  async getUsers(conditions?: SQL) {
    return await db
      .select()
      .from(users)
      .where(this.withTenant(users, conditions));
  }

  /**
   * 단일 사용자 조회
   */
  async getUserById(userId: string) {
    const result = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.tenantId, this.context.tenantId)
        )
      )
      .limit(1);

    if (result.length === 0) {
      throw new TenantIsolationError('User not found or access denied');
    }

    return result[0];
  }

  /**
   * 부서 조회 (테넌트 격리)
   */
  async getDepartments(conditions?: SQL) {
    return await db
      .select()
      .from(departments)
      .where(this.withTenant(departments, conditions));
  }

  /**
   * 스케줄 조회 (테넌트 격리)
   */
  async getSchedules(conditions?: SQL) {
    return await db
      .select()
      .from(schedules)
      .where(this.withTenant(schedules, conditions));
  }

  /**
   * 교대 유형 조회 (테넌트 격리)
   */
  async getShiftTypes(conditions?: SQL) {
    return await db
      .select()
      .from(shiftTypes)
      .where(this.withTenant(shiftTypes, conditions));
  }

  /**
   * 패턴 조회 (테넌트 격리)
   */
  async getPatterns(conditions?: SQL) {
    return await db
      .select()
      .from(patterns)
      .where(this.withTenant(patterns, conditions));
  }

  /**
   * 스왑 요청 조회 (테넌트 격리)
   */
  async getSwapRequests(conditions?: SQL) {
    return await db
      .select()
      .from(swapRequests)
      .where(this.withTenant(swapRequests, conditions));
  }

  /**
   * 알림 조회 (테넌트 격리)
   */
  async getNotifications(conditions?: SQL) {
    return await db
      .select()
      .from(notifications)
      .where(this.withTenant(notifications, conditions));
  }

  /**
   * 데이터 생성 시 테넌트 ID 자동 추가
   */
  async create<T extends Record<string, any>>(
    table: any,
    data: Omit<T, 'tenantId'>
  ): Promise<T> {
    const dataWithTenant = {
      ...data,
      tenantId: this.context.tenantId,
    };

    const result = await db
      .insert(table)
      .values(dataWithTenant)
      .returning();

    // 감사 로그 기록
    await this.logAudit('create', table.name, result[0].id, null, result[0]);

    return result[0] as T;
  }

  /**
   * 데이터 업데이트 시 테넌트 검증
   */
  async update<T extends Record<string, any>>(
    table: any,
    id: string,
    data: Partial<T>
  ): Promise<T> {
    // 먼저 해당 레코드가 현재 테넌트에 속하는지 확인
    const existing = await db
      .select()
      .from(table)
      .where(
        and(
          eq(table.id, id),
          eq(table.tenantId, this.context.tenantId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      throw new TenantIsolationError('Record not found or access denied');
    }

    const result = await db
      .update(table)
      .set(data)
      .where(
        and(
          eq(table.id, id),
          eq(table.tenantId, this.context.tenantId)
        )
      )
      .returning();

    // 감사 로그 기록
    await this.logAudit('update', table.name, id, existing[0], result[0]);

    return result[0] as T;
  }

  /**
   * 데이터 삭제 시 테넌트 검증
   */
  async delete(table: any, id: string): Promise<void> {
    // 먼저 해당 레코드가 현재 테넌트에 속하는지 확인
    const existing = await db
      .select()
      .from(table)
      .where(
        and(
          eq(table.id, id),
          eq(table.tenantId, this.context.tenantId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      throw new TenantIsolationError('Record not found or access denied');
    }

    await db
      .delete(table)
      .where(
        and(
          eq(table.id, id),
          eq(table.tenantId, this.context.tenantId)
        )
      );

    // 감사 로그 기록
    await this.logAudit('delete', table.name, id, existing[0], null);
  }

  /**
   * Soft delete 구현
   */
  async softDelete(table: any, id: string): Promise<void> {
    await this.update(table, id, {
      deletedAt: new Date(),
    });
  }

  /**
   * 감사 로그 기록
   */
  private async logAudit(
    action: string,
    entityType: string,
    entityId: string,
    before: any,
    after: any
  ): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        tenantId: this.context.tenantId,
        actorId: this.context.userId,
        action,
        entityType,
        entityId,
        before,
        after,
        metadata: {},
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // 감사 로그 실패가 메인 작업을 막지 않도록 함
    }
  }

  /**
   * 트랜잭션 내에서 테넌트 격리 유지
   */
  async transaction<T>(
    callback: (tx: ScopedDb) => Promise<T>
  ): Promise<T> {
    // 트랜잭션 내에서도 동일한 테넌트 컨텍스트 유지
    return await db.transaction(async () => {
      return await callback(this);
    });
  }

  /**
   * 대량 작업 시 테넌트 검증
   */
  async bulkCreate<T extends Record<string, any>>(
    table: any,
    items: Omit<T, 'tenantId'>[]
  ): Promise<T[]> {
    const itemsWithTenant = items.map(item => ({
      ...item,
      tenantId: this.context.tenantId,
    }));

    const result = await db
      .insert(table)
      .values(itemsWithTenant)
      .returning();

    // 대량 감사 로그
    for (const item of result) {
      await this.logAudit('bulk_create', table.name, item.id, null, item);
    }

    return result as T[];
  }

  /**
   * 테넌트 간 데이터 누출 방지를 위한 검증
   */
  async validateAccess(table: any, id: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(
        and(
          eq(table.id, id),
          eq(table.tenantId, this.context.tenantId)
        )
      );

    return result[0].count > 0;
  }
}

/**
 * 현재 요청의 테넌트 컨텍스트를 가져오는 헬퍼
 */
export function createScopedDb(context: TenantContext): ScopedDb {
  return new ScopedDb(context);
}

/**
 * 테넌트 ID 검증 미들웨어용 헬퍼
 */
export async function validateTenantId(tenantId: string): Promise<boolean> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  return result[0].count > 0;
}

/**
 * 크로스 테넌트 쿼리 방지를 위한 타입
 */
export type TenantScoped<T> = T & { __tenant: never };

/**
 * 테넌트 격리 검증을 위한 테스트 헬퍼
 */
export async function testTenantIsolation(
  tenantId1: string,
  tenantId2: string
): Promise<{ passed: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // 테넌트 1의 컨텍스트로 테넌트 2의 데이터 접근 시도
    const scopedDb1 = new ScopedDb({ tenantId: tenantId1 });
    const users2 = await db
      .select()
      .from(users)
      .where(eq(users.tenantId, tenantId2));

    // scopedDb를 통하지 않은 직접 쿼리는 차단되어야 함
    if (users2.length > 0) {
      errors.push('Direct query without scoped DB allowed cross-tenant access');
    }

    // 다른 테넌트의 ID로 직접 접근 시도
    try {
      const user2 = await scopedDb1.getUserById('user-from-tenant-2');
      errors.push('Cross-tenant user access was not blocked');
    } catch (error) {
      // 예상된 에러 - 정상
    }

    return {
      passed: errors.length === 0,
      errors,
    };
  } catch (error) {
    errors.push(`Test failed with error: ${error}`);
    return {
      passed: false,
      errors,
    };
  }
}
