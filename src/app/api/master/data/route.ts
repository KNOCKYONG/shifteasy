import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants, users, departments, schedules } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Verify master authentication
function verifyMasterAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('x-master-auth');
  return authHeader === 'authenticated';
}

export async function GET(request: NextRequest) {
  // Verify authentication
  if (!verifyMasterAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const table = searchParams.get('table');
  const tenantId = searchParams.get('tenantId');
  const departmentId = searchParams.get('departmentId');

  try {
    let data;

    switch (table) {
      case 'tenants':
        data = await db.select().from(tenants);
        break;

      case 'users':
        if (departmentId) {
          data = await db.select().from(users).where(eq(users.departmentId, departmentId));
        } else if (tenantId) {
          data = await db.select().from(users).where(eq(users.tenantId, tenantId));
        } else {
          data = await db.select().from(users);
        }
        break;

      case 'departments':
        if (tenantId) {
          data = await db.select().from(departments).where(eq(departments.tenantId, tenantId));
        } else {
          data = await db.select().from(departments);
        }
        break;

      case 'schedules':
        if (departmentId) {
          data = await db
            .select()
            .from(schedules)
            .where(eq(schedules.departmentId, departmentId))
            .limit(1000);
        } else if (tenantId) {
          data = await db
            .select()
            .from(schedules)
            .innerJoin(departments, eq(schedules.departmentId, departments.id))
            .where(eq(departments.tenantId, tenantId))
            .limit(1000);
        } else {
          data = await db.select().from(schedules).limit(1000);
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid table parameter' },
          { status: 400 }
        );
    }

    return NextResponse.json({ data, count: data.length });
  } catch (error) {
    console.error('Master data fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
