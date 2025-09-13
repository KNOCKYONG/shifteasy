import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { departments, tenants } from '@/db/schema/tenants';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: '테넌트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 테넌트의 부서 목록 조회
    const departmentList = await db
      .select({
        id: departments.id,
        name: departments.name,
        code: departments.code,
        description: departments.description,
      })
      .from(departments)
      .where(eq(departments.tenantId, tenantId));

    return NextResponse.json({
      departments: departmentList,
    });
  } catch (error) {
    console.error('Departments fetch error:', error);
    return NextResponse.json(
      { error: '부서 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}