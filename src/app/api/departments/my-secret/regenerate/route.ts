import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, departments } from '@/db/schema/tenants';
import { eq, ne, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Generate a random secret code
function generateSecretCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Check if secret code already exists in any department
async function isSecretCodeUnique(tenantId: string, secretCode: string, excludeDepartmentId?: string): Promise<boolean> {
  let existingDepartments;

  if (excludeDepartmentId) {
    existingDepartments = await db
      .select()
      .from(departments)
      .where(
        and(
          eq(departments.tenantId, tenantId),
          eq(departments.secretCode, secretCode),
          ne(departments.id, excludeDepartmentId)
        )
      )
      .limit(1);
  } else {
    existingDepartments = await db
      .select()
      .from(departments)
      .where(
        and(
          eq(departments.tenantId, tenantId),
          eq(departments.secretCode, secretCode)
        )
      )
      .limit(1);
  }

  return existingDepartments.length === 0;
}

// Generate unique secret code
async function generateUniqueSecretCode(tenantId: string, excludeDepartmentId?: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateSecretCode();
    const isUnique = await isSecretCodeUnique(tenantId, code, excludeDepartmentId);

    if (isUnique) {
      return code;
    }

    attempts++;
  }

  throw new Error('Failed to generate unique secret code after multiple attempts');
}

/**
 * POST /api/departments/my-secret/regenerate
 * Manager가 자신의 부서 시크릿 코드 재생성
 */
export async function POST() {
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

    // Check if user is manager
    if (user.role !== 'manager' && user.role !== 'admin' && user.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden: Manager access required' },
        { status: 403 }
      );
    }

    // Check if user has a department
    if (!user.departmentId) {
      return NextResponse.json(
        { error: 'No department assigned' },
        { status: 404 }
      );
    }

    // Generate new unique secret code using user's tenantId
    const newSecretCode = await generateUniqueSecretCode(user.tenantId, user.departmentId);

    // Update department's secret code
    const updatedDepartment = await db
      .update(departments)
      .set({
        secretCode: newSecretCode,
        updatedAt: new Date(),
      })
      .where(eq(departments.id, user.departmentId))
      .returning({
        id: departments.id,
        name: departments.name,
        secretCode: departments.secretCode,
      });

    if (updatedDepartment.length === 0) {
      return NextResponse.json(
        { error: 'Failed to update secret code' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      department: updatedDepartment[0],
      message: 'Secret code regenerated successfully'
    });
  } catch (error) {
    console.error('Error regenerating secret code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
