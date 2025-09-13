import { NextRequest, NextResponse } from 'next/server';
import { createScopedDb, type TenantContext } from '@/lib/db/tenant-isolation';
import { PermissionChecker, Permission, checkPermission } from '@/lib/auth/rbac';
import { syncClerkUser } from '@/lib/auth/clerk-integration';

/**
 * API 핸들러를 위한 인증 및 권한 래퍼
 */
export interface AuthenticatedRequest extends NextRequest {
  auth: TenantContext;
  scopedDb: ReturnType<typeof createScopedDb>;
  permissions: PermissionChecker;
}

/**
 * API 라우트 핸들러를 인증과 테넌트 격리로 감싸는 HOF
 */
export function withAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  requiredPermission?: Permission
) {
  return async (req: NextRequest) => {
    try {
      // 헤더에서 테넌트 정보 가져오기 (미들웨어에서 설정)
      const tenantId = req.headers.get('x-tenant-id');
      const userId = req.headers.get('x-user-id');
      const userRole = req.headers.get('x-user-role') || 'member';

      if (!tenantId || !userId) {
        // Clerk에서 직접 동기화 시도
        const syncResult = await syncClerkUser();

        if (!syncResult) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          );
        }

        // 동기화된 정보 사용
        const context = syncResult.context;
        const scopedDb = createScopedDb(context);
        const permissions = new PermissionChecker(context.role || 'member');

        // 권한 체크
        if (requiredPermission) {
          if (!permissions.hasPermission(requiredPermission)) {
            return NextResponse.json(
              { error: `Permission denied: ${requiredPermission} required` },
              { status: 403 }
            );
          }
        }

        // 확장된 request 객체 생성
        const authenticatedReq = Object.assign(req, {
          auth: context,
          scopedDb,
          permissions,
        }) as AuthenticatedRequest;

        return await handler(authenticatedReq);
      }

      // 테넌트 컨텍스트 생성
      const context: TenantContext = {
        tenantId,
        userId,
        role: userRole,
      };

      // ScopedDb 인스턴스 생성
      const scopedDb = createScopedDb(context);

      // 권한 체커 생성
      const permissions = new PermissionChecker(userRole);

      // 권한 체크
      if (requiredPermission) {
        if (!permissions.hasPermission(requiredPermission)) {
          return NextResponse.json(
            { error: `Permission denied: ${requiredPermission} required` },
            { status: 403 }
          );
        }
      }

      // 확장된 request 객체 생성
      const authenticatedReq = Object.assign(req, {
        auth: context,
        scopedDb,
        permissions,
      }) as AuthenticatedRequest;

      return await handler(authenticatedReq);
    } catch (error) {
      console.error('Auth wrapper error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * 여러 권한 중 하나만 있어도 되는 경우
 */
export function withAnyPermission(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  permissions: Permission[]
) {
  return async (req: NextRequest) => {
    try {
      const tenantId = req.headers.get('x-tenant-id');
      const userId = req.headers.get('x-user-id');
      const userRole = req.headers.get('x-user-role') || 'member';

      if (!tenantId || !userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      const context: TenantContext = {
        tenantId,
        userId,
        role: userRole,
      };

      const scopedDb = createScopedDb(context);
      const permissionChecker = new PermissionChecker(userRole);

      // 권한 체크 - 하나라도 있으면 OK
      if (!permissionChecker.hasAnyPermission(permissions)) {
        return NextResponse.json(
          { error: `One of these permissions required: ${permissions.join(', ')}` },
          { status: 403 }
        );
      }

      const authenticatedReq = Object.assign(req, {
        auth: context,
        scopedDb,
        permissions: permissionChecker,
      }) as AuthenticatedRequest;

      return await handler(authenticatedReq);
    } catch (error) {
      console.error('Auth wrapper error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * 모든 권한이 필요한 경우
 */
export function withAllPermissions(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  permissions: Permission[]
) {
  return async (req: NextRequest) => {
    try {
      const tenantId = req.headers.get('x-tenant-id');
      const userId = req.headers.get('x-user-id');
      const userRole = req.headers.get('x-user-role') || 'member';

      if (!tenantId || !userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      const context: TenantContext = {
        tenantId,
        userId,
        role: userRole,
      };

      const scopedDb = createScopedDb(context);
      const permissionChecker = new PermissionChecker(userRole);

      // 권한 체크 - 모두 있어야 OK
      if (!permissionChecker.hasAllPermissions(permissions)) {
        return NextResponse.json(
          { error: `All permissions required: ${permissions.join(', ')}` },
          { status: 403 }
        );
      }

      const authenticatedReq = Object.assign(req, {
        auth: context,
        scopedDb,
        permissions: permissionChecker,
      }) as AuthenticatedRequest;

      return await handler(authenticatedReq);
    } catch (error) {
      console.error('Auth wrapper error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * 자신의 리소스에만 접근 가능한 경우
 */
export function withSelfOnly(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      const tenantId = req.headers.get('x-tenant-id');
      const userId = req.headers.get('x-user-id');
      const userRole = req.headers.get('x-user-role') || 'member';

      if (!tenantId || !userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // URL에서 대상 user ID 추출
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const targetUserId = pathParts[pathParts.indexOf('users') + 1];

      // 자신의 리소스가 아니면 권한 체크
      if (targetUserId && targetUserId !== userId) {
        const permissionChecker = new PermissionChecker(userRole);

        // 관리자는 다른 사용자 접근 가능
        if (!permissionChecker.hasPermission(Permission.USER_UPDATE)) {
          return NextResponse.json(
            { error: 'Can only access your own resources' },
            { status: 403 }
          );
        }
      }

      const context: TenantContext = {
        tenantId,
        userId,
        role: userRole,
      };

      const scopedDb = createScopedDb(context);
      const permissions = new PermissionChecker(userRole);

      const authenticatedReq = Object.assign(req, {
        auth: context,
        scopedDb,
        permissions,
      }) as AuthenticatedRequest;

      return await handler(authenticatedReq);
    } catch (error) {
      console.error('Auth wrapper error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}