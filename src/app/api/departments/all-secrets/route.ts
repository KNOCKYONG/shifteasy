import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, departments } from '@/db/schema/tenants';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/departments/all-secrets
 * Admin이 같은 tenant의 모든 부서 시크릿 코드 조회
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is admin or owner
    if (user.role !== 'admin' && user.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Get all departments with their secret codes in the same tenant
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
      departments: allDepartments
    });
  } catch (error) {
    console.error('Error fetching all department secrets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
