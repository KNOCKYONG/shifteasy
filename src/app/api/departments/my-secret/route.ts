import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, departments } from '@/db/schema/tenants';
import { and, eq, ne } from 'drizzle-orm';
import { ensureNotificationPreferencesColumn } from '@/lib/db/ensureNotificationPreferencesColumn';

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
 * GET /api/departments/my-secret
 * Manager가 자신의 부서 시크릿 코드 조회 (없으면 자동 생성)
 */
export async function GET() {
  try {
    const { userId } = await auth();
    console.log('GET /api/departments/my-secret - userId:', userId);

    if (!userId) {
      console.error('No userId from auth');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await ensureNotificationPreferencesColumn();

    // Get current user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, userId))
      .limit(1);

    console.log('User found:', user ? { id: user.id, role: user.role, departmentId: user.departmentId, tenantId: user.tenantId } : null);

    if (!user) {
      console.error('User not found in database');
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is manager
    if (user.role !== 'manager' && user.role !== 'admin' && user.role !== 'owner') {
      console.error('User role not authorized:', user.role);
      return NextResponse.json(
        { error: 'Forbidden: Manager access required' },
        { status: 403 }
      );
    }

    // Check if user has a department
    if (!user.departmentId) {
      console.error('User has no department assigned');
      return NextResponse.json(
        { error: 'No department assigned' },
        { status: 404 }
      );
    }

    // Get department with tenant info
    console.log('Fetching department:', user.departmentId);
    const [deptWithTenant] = await db
      .select({
        id: departments.id,
        name: departments.name,
        secretCode: departments.secretCode,
        tenantId: departments.tenantId,
      })
      .from(departments)
      .where(eq(departments.id, user.departmentId))
      .limit(1);

    console.log('Department found:', deptWithTenant ? { id: deptWithTenant.id, name: deptWithTenant.name, hasSecretCode: !!deptWithTenant.secretCode } : null);

    if (!deptWithTenant) {
      console.error('Department not found in database');
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    // If department has no secret code, generate one automatically
    let finalSecretCode = deptWithTenant.secretCode;

    if (!finalSecretCode) {
      console.log(`Department ${deptWithTenant.id} has no secret code. Generating...`);

      try {
        // Generate unique secret code
        console.log('Generating unique secret code for tenantId:', deptWithTenant.tenantId);
        const newSecretCode = await generateUniqueSecretCode(deptWithTenant.tenantId, deptWithTenant.id);
        console.log('Generated new secret code:', newSecretCode);

        // Update department with new secret code
        const [updated] = await db
          .update(departments)
          .set({
            secretCode: newSecretCode,
            updatedAt: new Date(),
          })
          .where(eq(departments.id, deptWithTenant.id))
          .returning({
            secretCode: departments.secretCode,
          });

        if (updated) {
          finalSecretCode = updated.secretCode;
          console.log(`Successfully updated department ${deptWithTenant.id} with secret code: ${finalSecretCode}`);
        }
      } catch (genError) {
        console.error('Error generating secret code:', genError);
        // Continue with null secret code rather than failing
      }
    }

    console.log('Returning department:', { id: deptWithTenant.id, name: deptWithTenant.name, secretCode: finalSecretCode });
    return NextResponse.json({
      department: {
        id: deptWithTenant.id,
        name: deptWithTenant.name,
        secretCode: finalSecretCode,
      }
    });
  } catch (error) {
    console.error('Error fetching department secret:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
