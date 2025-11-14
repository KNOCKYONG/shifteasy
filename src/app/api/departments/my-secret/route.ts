import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
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

async function isSecretCodeUnique(
  tenantId: string,
  secretCode: string,
  excludeDepartmentId?: string
): Promise<boolean> {
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

async function generateUniqueSecretCode(
  tenantId: string,
  excludeDepartmentId?: string
): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateSecretCode();
    const isUnique = await isSecretCodeUnique(
      tenantId,
      code,
      excludeDepartmentId
    );

    if (isUnique) {
      return code;
    }

    attempts++;
  }

  throw new Error('Failed to generate unique secret code after multiple attempts');
}

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

    if (
      user.role !== 'manager' &&
      user.role !== 'admin' &&
      user.role !== 'owner'
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Manager access required' },
        { status: 403 }
      );
    }

    if (!user.departmentId) {
      return NextResponse.json(
        { error: 'No department assigned' },
        { status: 404 }
      );
    }

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

    if (!deptWithTenant) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    let finalSecretCode = deptWithTenant.secretCode;

    if (!finalSecretCode) {
      try {
        const newSecretCode = await generateUniqueSecretCode(
          deptWithTenant.tenantId,
          deptWithTenant.id
        );

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
        }
      } catch (genError) {
        console.error('Error generating secret code:', genError);
      }
    }

    return NextResponse.json({
      department: {
        id: deptWithTenant.id,
        name: deptWithTenant.name,
        secretCode: finalSecretCode,
      },
    });
  } catch (error) {
    console.error('Error fetching department secret:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
