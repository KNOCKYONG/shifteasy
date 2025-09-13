import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { Permission } from '@/lib/auth/rbac';
import { toggleSignupEnabled } from '@/lib/auth/secret-code';

// POST /api/admin/tenant/toggle-signup - 가입 활성화/비활성화
export const POST = withAuth(
  async (req: AuthenticatedRequest) => {
    try {
      const tenantId = req.auth.tenantId;
      const { enabled } = await req.json();

      const result = await toggleSignupEnabled(tenantId, enabled);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || '설정 변경에 실패했습니다.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        signupEnabled: enabled,
      });
    } catch (error) {
      console.error('Error toggling signup:', error);
      return NextResponse.json(
        { error: '설정 변경 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
  },
  Permission.TENANT_MANAGE
);