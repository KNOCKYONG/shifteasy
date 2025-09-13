import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { Permission } from '@/lib/auth/rbac';
import { regenerateSecretCode } from '@/lib/auth/secret-code';

// POST /api/admin/tenant/regenerate-code - 시크릿 코드 재생성
export const POST = withAuth(
  async (req: AuthenticatedRequest) => {
    try {
      const tenantId = req.auth.tenantId;

      const result = await regenerateSecretCode(tenantId);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || '시크릿 코드 재생성에 실패했습니다.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        secretCode: result.secretCode,
      });
    } catch (error) {
      console.error('Error regenerating secret code:', error);
      return NextResponse.json(
        { error: '시크릿 코드 재생성 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
  },
  Permission.TENANT_MANAGE
);