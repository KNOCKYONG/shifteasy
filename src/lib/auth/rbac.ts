/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * RBAC (Role-Based Access Control) 시스템
 * 역할별 권한 관리 및 접근 제어
 */

import { getCurrentTenantContext } from '../auth';

/**
 * 시스템 역할
 */
export enum Role {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  MEMBER = 'member',
}

/**
 * 권한 타입
 */
export enum Permission {
  // 테넌트 관리
  TENANT_MANAGE = 'tenant:manage',
  TENANT_BILLING = 'tenant:billing',
  TENANT_DELETE = 'tenant:delete',

  // 사용자 관리
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_MANAGE_ROLES = 'user:manage_roles',

  // 부서 관리
  DEPARTMENT_CREATE = 'department:create',
  DEPARTMENT_READ = 'department:read',
  DEPARTMENT_UPDATE = 'department:update',
  DEPARTMENT_DELETE = 'department:delete',

  // 스케줄 관리
  SCHEDULE_CREATE = 'schedule:create',
  SCHEDULE_READ = 'schedule:read',
  SCHEDULE_UPDATE = 'schedule:update',
  SCHEDULE_DELETE = 'schedule:delete',
  SCHEDULE_PUBLISH = 'schedule:publish',
  SCHEDULE_APPROVE = 'schedule:approve',

  // 교대 관리
  SHIFT_CREATE = 'shift:create',
  SHIFT_READ = 'shift:read',
  SHIFT_UPDATE = 'shift:update',
  SHIFT_DELETE = 'shift:delete',

  // 스왑 요청
  SWAP_CREATE = 'swap:create',
  SWAP_READ = 'swap:read',
  SWAP_APPROVE = 'swap:approve',
  SWAP_REJECT = 'swap:reject',

  // 보고서
  REPORT_VIEW = 'report:view',
  REPORT_EXPORT = 'report:export',
  REPORT_ANALYTICS = 'report:analytics',

  // 설정
  SETTINGS_VIEW = 'settings:view',
  SETTINGS_UPDATE = 'settings:update',

  // 감사 로그
  AUDIT_VIEW = 'audit:view',
  AUDIT_EXPORT = 'audit:export',
}

/**
 * 역할별 권한 매트릭스
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: [
    // Owner는 모든 권한을 가짐
    ...Object.values(Permission),
  ],

  [Role.ADMIN]: [
    // Admin은 테넌트 삭제와 일부 민감한 권한을 제외한 모든 권한
    Permission.TENANT_MANAGE,
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.USER_MANAGE_ROLES,
    Permission.DEPARTMENT_CREATE,
    Permission.DEPARTMENT_READ,
    Permission.DEPARTMENT_UPDATE,
    Permission.DEPARTMENT_DELETE,
    Permission.SCHEDULE_CREATE,
    Permission.SCHEDULE_READ,
    Permission.SCHEDULE_UPDATE,
    Permission.SCHEDULE_DELETE,
    Permission.SCHEDULE_PUBLISH,
    Permission.SCHEDULE_APPROVE,
    Permission.SHIFT_CREATE,
    Permission.SHIFT_READ,
    Permission.SHIFT_UPDATE,
    Permission.SHIFT_DELETE,
    Permission.SWAP_CREATE,
    Permission.SWAP_READ,
    Permission.SWAP_APPROVE,
    Permission.SWAP_REJECT,
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT,
    Permission.REPORT_ANALYTICS,
    Permission.SETTINGS_VIEW,
    Permission.SETTINGS_UPDATE,
    Permission.AUDIT_VIEW,
    Permission.AUDIT_EXPORT,
  ],

  [Role.MANAGER]: [
    // Manager는 일상적인 운영 권한
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.DEPARTMENT_READ,
    Permission.SCHEDULE_CREATE,
    Permission.SCHEDULE_READ,
    Permission.SCHEDULE_UPDATE,
    Permission.SCHEDULE_PUBLISH,
    Permission.SHIFT_CREATE,
    Permission.SHIFT_READ,
    Permission.SHIFT_UPDATE,
    Permission.SWAP_CREATE,
    Permission.SWAP_READ,
    Permission.SWAP_APPROVE,
    Permission.SWAP_REJECT,
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT,
    Permission.SETTINGS_VIEW,
  ],

  [Role.MEMBER]: [
    // Member는 기본적인 읽기 권한과 자신의 스왑 요청
    Permission.USER_READ,
    Permission.DEPARTMENT_READ,
    Permission.SCHEDULE_READ,
    Permission.SHIFT_READ,
    Permission.SWAP_CREATE,
    Permission.SWAP_READ,
    Permission.REPORT_VIEW,
    Permission.SETTINGS_VIEW,
  ],
};

/**
 * 리소스별 필요 권한 매핑
 */
const RESOURCE_PERMISSIONS = {
  // API 엔드포인트별 필요 권한
  'GET /api/users': Permission.USER_READ,
  'POST /api/users': Permission.USER_CREATE,
  'PUT /api/users/:id': Permission.USER_UPDATE,
  'DELETE /api/users/:id': Permission.USER_DELETE,

  'GET /api/departments': Permission.DEPARTMENT_READ,
  'POST /api/departments': Permission.DEPARTMENT_CREATE,
  'PUT /api/departments/:id': Permission.DEPARTMENT_UPDATE,
  'DELETE /api/departments/:id': Permission.DEPARTMENT_DELETE,

  'GET /api/schedules': Permission.SCHEDULE_READ,
  'POST /api/schedules': Permission.SCHEDULE_CREATE,
  'PUT /api/schedules/:id': Permission.SCHEDULE_UPDATE,
  'DELETE /api/schedules/:id': Permission.SCHEDULE_DELETE,
  'POST /api/schedules/:id/publish': Permission.SCHEDULE_PUBLISH,

  'GET /api/swaps': Permission.SWAP_READ,
  'POST /api/swaps': Permission.SWAP_CREATE,
  'PUT /api/swaps/:id/approve': Permission.SWAP_APPROVE,
  'PUT /api/swaps/:id/reject': Permission.SWAP_REJECT,

  'GET /api/reports': Permission.REPORT_VIEW,
  'POST /api/reports/export': Permission.REPORT_EXPORT,

  'GET /api/audit-logs': Permission.AUDIT_VIEW,
};

/**
 * 권한 검사 클래스
 */
export class PermissionChecker {
  private role: Role;
  private permissions: Set<Permission>;

  constructor(role: string) {
    this.role = role as Role;
    this.permissions = new Set(ROLE_PERMISSIONS[this.role] || []);
  }

  /**
   * 특정 권한을 가지고 있는지 확인
   */
  hasPermission(permission: Permission): boolean {
    return this.permissions.has(permission);
  }

  /**
   * 여러 권한 중 하나라도 가지고 있는지 확인
   */
  hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some(p => this.hasPermission(p));
  }

  /**
   * 모든 권한을 가지고 있는지 확인
   */
  hasAllPermissions(permissions: Permission[]): boolean {
    return permissions.every(p => this.hasPermission(p));
  }

  /**
   * 리소스에 접근할 수 있는지 확인
   */
  canAccessResource(resource: string): boolean {
    const requiredPermission = RESOURCE_PERMISSIONS[resource as keyof typeof RESOURCE_PERMISSIONS];
    if (!requiredPermission) {
      // 매핑되지 않은 리소스는 기본적으로 접근 허용
      return true;
    }
    return this.hasPermission(requiredPermission);
  }

  /**
   * 역할 계층 확인 (상위 역할인지)
   */
  isHigherOrEqualRole(targetRole: Role): boolean {
    const roleHierarchy = {
      [Role.OWNER]: 4,
      [Role.ADMIN]: 3,
      [Role.MANAGER]: 2,
      [Role.MEMBER]: 1,
    };

    return roleHierarchy[this.role] >= roleHierarchy[targetRole];
  }
}

/**
 * 현재 사용자의 권한 확인
 */
export async function checkPermission(permission: Permission): Promise<boolean> {
  try {
    const context = await getCurrentTenantContext();
    if (!context || !context.role) {
      return false;
    }

    const checker = new PermissionChecker(context.role);
    return checker.hasPermission(permission);
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
}

/**
 * 권한 체크 데코레이터 (서버 액션용)
 */
export function requirePermission(permission: Permission) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const hasPermission = await checkPermission(permission);

      if (!hasPermission) {
        throw new Error(`Permission denied: ${permission} required`);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * 역할 체크 데코레이터
 */
export function requireRole(role: Role) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = await getCurrentTenantContext();

      if (!context || !context.role) {
        throw new Error('Authentication required');
      }

      const checker = new PermissionChecker(context.role);

      if (!checker.isHigherOrEqualRole(role)) {
        throw new Error(`Role ${role} or higher required`);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * 권한 정책 정의
 */
export interface PermissionPolicy {
  resource: string;
  action: string;
  condition?: (context: any) => boolean;
}

/**
 * 동적 권한 정책 평가
 */
export class PolicyEvaluator {
  private policies: PermissionPolicy[] = [];

  addPolicy(policy: PermissionPolicy) {
    this.policies.push(policy);
  }

  async evaluate(
    resource: string,
    action: string,
    context?: any
  ): Promise<boolean> {
    const relevantPolicies = this.policies.filter(
      p => p.resource === resource && p.action === action
    );

    if (relevantPolicies.length === 0) {
      // 정책이 없으면 기본 권한 체크
      return checkPermission(`${resource}:${action}` as Permission);
    }

    // 모든 관련 정책을 평가
    for (const policy of relevantPolicies) {
      if (policy.condition && !policy.condition(context)) {
        return false;
      }
    }

    return true;
  }
}

/**
 * 권한 캐싱을 위한 메모리 캐시
 */
class PermissionCache {
  private cache = new Map<string, { result: boolean; timestamp: number }>();
  private ttl = 60000; // 1분

  get(key: string): boolean | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  set(key: string, result: boolean) {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  clear() {
    this.cache.clear();
  }
}

export const permissionCache = new PermissionCache();

/**
 * 캐시를 활용한 권한 체크
 */
export async function checkPermissionWithCache(
  permission: Permission
): Promise<boolean> {
  const cacheKey = `permission:${permission}`;
  const cached = permissionCache.get(cacheKey);

  if (cached !== null) {
    return cached;
  }

  const result = await checkPermission(permission);
  permissionCache.set(cacheKey, result);

  return result;
}
