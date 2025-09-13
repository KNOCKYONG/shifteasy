import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, tenants, departments } from '@/db/schema/tenants';
import { eq, and, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current user
    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, userId))
      .limit(1);

    if (currentUser.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Only admin can access tenant info
    if (currentUser[0].role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get tenant info
    const tenantInfo = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        secretCode: tenants.secretCode,
      })
      .from(tenants)
      .where(eq(tenants.id, currentUser[0].tenantId))
      .limit(1);

    if (tenantInfo.length === 0) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Get user count
    const userCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.tenantId, currentUser[0].tenantId));

    // Get department count
    const departmentCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(departments)
      .where(eq(departments.tenantId, currentUser[0].tenantId));

    return NextResponse.json({
      ...tenantInfo[0],
      userCount: Number(userCount[0].count),
      departmentCount: Number(departmentCount[0].count),
    });
  } catch (error) {
    console.error('Error fetching tenant info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}