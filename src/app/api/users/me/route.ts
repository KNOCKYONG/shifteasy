import { NextRequest, NextResponse } from 'next/server';
// import { auth } from '@clerk/nextjs/server';
import { mockUser } from '@/lib/auth/mock-auth';
import { db } from '@/db';
import { users, departments } from '@/db/schema/tenants';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Clerk 대신 mock 사용자 반환
    const userId = mockUser.clerkUserId;

    // Mock 데이터 직접 반환
    return NextResponse.json({
      id: mockUser.id,
      name: mockUser.name,
      email: mockUser.email,
      role: mockUser.role,
      departmentId: mockUser.departmentId,
      department: 'Emergency Department',
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    /* 원래 코드 (Clerk 재활성화 시 사용)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        departmentId: users.departmentId,
        department: departments.name,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(users.clerkUserId, userId))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user[0]);
    */
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // const { userId } = await auth();
    const userId = mockUser.clerkUserId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Update user in database
    const updatedUser = await db
      .update(users)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkUserId, userId))
      .returning();

    if (updatedUser.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedUser[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}