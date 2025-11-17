/**
 * 게스트 → Professional 플랜 마이그레이션 유틸리티
 *
 * 게스트 계정 감지, 마이그레이션 가능 여부 확인, 데이터 검증 등의 기능을 제공합니다.
 */

import { db } from '@/db';
import { tenants, users, configs, teams, nursePreferences, holidays, schedules } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { normalizePlanId } from '@/lib/billing/plan-limits';

type TenantSettings = {
  isGuestTrial?: boolean;
  migratedFrom?: string | null;
  [key: string]: unknown;
};

function parseTenantSettings(settings: unknown): TenantSettings {
  if (typeof settings === 'object' && settings !== null) {
    return settings as TenantSettings;
  }
  return {};
}

/**
 * 게스트 계정 여부 확인
 */
export interface GuestAccountInfo {
  isGuest: boolean;
  tenantId: string | null;
  tenantName: string | null;
  departmentId: string | null;
  canMigrate: boolean;
  alreadyMigrated: boolean;
}

/**
 * 사용자의 게스트 계정 정보 조회
 */
export async function checkGuestAccount(userId: string): Promise<GuestAccountInfo> {
  try {
    // 사용자 정보 조회 (authUserId로 검색)
    const user = await db.query.users.findFirst({
      where: eq(users.authUserId, userId),
      with: {
        tenant: true,
        department: true,
      },
    });

    if (!user || !user.tenant) {
      return {
        isGuest: false,
        tenantId: null,
        tenantName: null,
        departmentId: null,
        canMigrate: false,
        alreadyMigrated: false,
      };
    }

    const tenant = user.tenant;
    const tenantSettings = parseTenantSettings(tenant.settings);
    const isGuestTrial = tenantSettings.isGuestTrial === true;
    const migratedFrom = tenantSettings.migratedFrom;

    const normalizedPlan = normalizePlanId(tenant.plan);

    return {
      isGuest: isGuestTrial && normalizedPlan === 'guest',
      tenantId: tenant.id,
      tenantName: tenant.name,
      departmentId: user.departmentId || null,
      canMigrate: isGuestTrial && normalizedPlan === 'guest' && !migratedFrom,
      alreadyMigrated: !!migratedFrom,
    };
  } catch (error) {
    console.error('Error checking guest account:', error);
    throw error;
  }
}

/**
 * 마이그레이션 가능 여부 확인 (더 상세한 검증)
 */
export interface MigrationEligibility {
  eligible: boolean;
  reason?: string;
  dataStats?: {
    configs: number;
    teams: number;
    users: number;
    preferences: number;
    holidays: number;
    schedules: number;
  };
}

/**
 * 마이그레이션 자격 확인
 */
export async function checkMigrationEligibility(
  userId: string,
  tenantId: string
): Promise<MigrationEligibility> {
  try {
    // 1. 사용자가 해당 테넌트의 소유자인지 확인
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.authUserId, userId),
        eq(users.tenantId, tenantId)
      ),
    });

    if (!user) {
      return {
        eligible: false,
        reason: 'User not found in this tenant',
      };
    }

    // guest 역할 또는 manager/admin/owner 역할을 가진 사용자만 마이그레이션 가능
    if (!['guest', 'manager', 'admin', 'owner'].includes(user.role)) {
      return {
        eligible: false,
        reason: 'User does not have permission to migrate',
      };
    }

    // 2. 테넌트가 게스트 체험판인지 확인
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      return {
        eligible: false,
        reason: 'Tenant not found',
      };
    }

    const tenantSettings = parseTenantSettings(tenant.settings);

    if (normalizePlanId(tenant.plan) !== 'guest' || tenantSettings.isGuestTrial !== true) {
      return {
        eligible: false,
        reason: 'Tenant is not a guest trial account',
      };
    }

    // 3. 이미 마이그레이션된 계정인지 확인
    if (tenantSettings.migratedFrom) {
      return {
        eligible: false,
        reason: 'This account has already been migrated',
      };
    }

    // 4. 마이그레이션 가능한 데이터 통계 조회
    const [
      configsList,
      teamsList,
      usersList,
      preferencesList,
      holidaysList,
      schedulesList,
    ] = await Promise.all([
      db.query.configs.findMany({ where: eq(configs.tenantId, tenantId) }),
      db.query.teams.findMany({ where: eq(teams.tenantId, tenantId) }),
      db.query.users.findMany({ where: eq(users.tenantId, tenantId) }),
      db.query.nursePreferences.findMany({ where: eq(nursePreferences.tenantId, tenantId) }),
      db.query.holidays.findMany({ where: eq(holidays.tenantId, tenantId) }),
      db.query.schedules.findMany({ where: eq(schedules.tenantId, tenantId) }),
    ]);

    return {
      eligible: true,
      dataStats: {
        configs: configsList.length,
        teams: teamsList.length,
        users: usersList.length,
        preferences: preferencesList.length,
        holidays: holidaysList.length,
        schedules: schedulesList.length,
      },
    };
  } catch (error) {
    console.error('Error checking migration eligibility:', error);
    return {
      eligible: false,
      reason: 'Error checking eligibility: ' + (error as Error).message,
    };
  }
}

/**
 * 시크릿 코드 생성 (XXX-XXX-XXX 형식)
 */
export function generateSecretCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const generateSegment = () => {
    return Array.from({ length: 3 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  };

  return `${generateSegment()}-${generateSegment()}-${generateSegment()}`;
}

/**
 * 마이그레이션 옵션 타입
 */
export interface MigrationOptions {
  migrateConfigs: boolean;
  migrateTeams: boolean;
  migrateUsers: boolean;
  migratePreferences: boolean;
  migrateHolidays: boolean;
  migrateSchedules: boolean;
  migrateSpecialRequests: boolean;
}

/**
 * 기본 마이그레이션 옵션
 */
export const DEFAULT_MIGRATION_OPTIONS: MigrationOptions = {
  migrateConfigs: true,
  migrateTeams: true,
  migrateUsers: true,
  migratePreferences: true,
  migrateHolidays: true,
  migrateSchedules: false, // 스케줄은 기본적으로 복사하지 않음
  migrateSpecialRequests: false, // 특별 요청도 기본적으로 복사하지 않음
};

/**
 * 마이그레이션 진행 상태
 */
export enum MigrationStep {
  CREATING_TENANT = 'creating_tenant',
  CREATING_DEPARTMENT = 'creating_department',
  MIGRATING_CONFIGS = 'migrating_configs',
  MIGRATING_TEAMS = 'migrating_teams',
  MIGRATING_USERS = 'migrating_users',
  MIGRATING_PREFERENCES = 'migrating_preferences',
  MIGRATING_HOLIDAYS = 'migrating_holidays',
  MIGRATING_SCHEDULES = 'migrating_schedules',
  MIGRATING_SPECIAL_REQUESTS = 'migrating_special_requests',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * 마이그레이션 진행 정보
 */
export interface MigrationProgress {
  step: MigrationStep;
  current: number;
  total: number;
  message: string;
}

/**
 * 마이그레이션 결과
 */
export interface MigrationResult {
  success: boolean;
  newTenantId?: string;
  newDepartmentId?: string;
  secretCode?: string;
  migratedData?: {
    configs: number;
    teams: number;
    users: number;
    preferences: number;
    holidays: number;
    schedules: number;
    specialRequests: number;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * 에러 코드
 */
export enum MigrationErrorCode {
  NOT_GUEST_ACCOUNT = 'NOT_GUEST_ACCOUNT',
  ALREADY_MIGRATED = 'ALREADY_MIGRATED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}
