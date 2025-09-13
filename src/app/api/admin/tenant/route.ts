import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { Permission } from '@/lib/auth/rbac';
import { db } from '@/db';
import { tenants, users } from '@/db/schema/tenants';
import { eq, sql } from 'drizzle-orm';

// GET /api/admin/tenant - 테넌트 정보 조회
export const GET = withAuth(
  async (req: AuthenticatedRequest) => {
    try {
      const tenantId = req.auth.tenantId;

      // 테넌트 정보 조회
      const tenantData = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          secretCode: tenants.secretCode,
          plan: tenants.plan,
          settings: tenants.settings,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (tenantData.length === 0) {
        return NextResponse.json(
          { error: '테넌트를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      // 사용자 수 카운트
      const userCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.tenantId, tenantId));

      return NextResponse.json({
        ...tenantData[0],
        signupEnabled: tenantData[0].settings?.signupEnabled !== false,
        userCount: userCount[0].count,
      });
    } catch (error) {
      console.error('Error fetching tenant info:', error);
      return NextResponse.json(
        { error: '테넌트 정보 조회에 실패했습니다.' },
        { status: 500 }
      );
    }
  },
  Permission.TENANT_MANAGE
);