import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { db } from '@/db';
import { users, departments } from '@/db/schema/tenants';
import { eq } from 'drizzle-orm';
import { ensureNotificationPreferencesColumn } from '@/lib/db/ensureNotificationPreferencesColumn';

export const dynamic = 'force-dynamic';

/**
 * GET /api/departments/all-secrets
 * Admin이 같은 tenant의 모든 부서 시크릿 코드 조회
 */
export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureNotificationPreferencesColumn();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role !== 'admin' && user.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const allDepartments = await db
      .select({
        id: departments.id,
        name: departments.name,
        code: departments.code,
        secretCode: departments.secretCode,
      })
      .from(departments)
      .where(eq(departments.tenantId, user.tenantId))
      .orderBy(departments.name);

    return NextResponse.json({
      departments: allDepartments,
    });
  } catch (error) {
    console.error('Error fetching all department secrets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
