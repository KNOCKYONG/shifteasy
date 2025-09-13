import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { Permission } from '@/lib/auth/rbac';

/**
 * GET /api/users
 * 테넌트의 사용자 목록 조회 (테넌트 격리 적용)
 */
export const GET = withAuth(
  async (req: AuthenticatedRequest) => {
    try {
      // scopedDb를 사용하면 자동으로 현재 테넌트의 데이터만 조회됨
      const users = await req.scopedDb.getUsers();

      return NextResponse.json({
        success: true,
        users,
        tenant: req.auth.tenantId,
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }
  },
  Permission.USER_READ // USER_READ 권한이 필요함
);

/**
 * POST /api/users
 * 새 사용자 생성 (관리자 이상만 가능)
 */
export const POST = withAuth(
  async (req: AuthenticatedRequest) => {
    try {
      const data = await req.json();

      // 테넌트 ID가 자동으로 추가됨
      const newUser = await req.scopedDb.create('users', {
        email: data.email,
        name: data.name,
        role: data.role || 'member',
        departmentId: data.departmentId,
        clerkUserId: data.clerkUserId,
        status: 'active',
      });

      return NextResponse.json({
        success: true,
        user: newUser,
      });
    } catch (error) {
      console.error('Error creating user:', error);
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }
  },
  Permission.USER_CREATE // USER_CREATE 권한이 필요함
);