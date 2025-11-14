import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/db';
import { tenants, departments, users } from '@/db/schema/tenants';
import { nursePreferences } from '@/db/schema/nurse-preferences';
import { sql } from 'drizzle-orm';
import { ensureNotificationPreferencesColumn } from '@/lib/db/ensureNotificationPreferencesColumn';

export const dynamic = 'force-dynamic';

const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

/**
 * 게스트 계정 생성 API
 * - manager 권한으로 게스트 계정 생성
 * - tenant_id와 department_id는 guest_ 접두사 + 랜덤 문자열
 * - position은 HN으로 설정
 * - employeeId는 GUEST_0000001 형식으로 자동 생성
 * - 14일 Pro 플랜 무료 체험 제공
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase 관리자 클라이언트를 초기화할 수 없습니다.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { email, name, hospitalName, password } = body;

    if (!email || !name || !hospitalName || !password) {
      return NextResponse.json(
        { error: '이메일, 이름, 병원명, 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase();
    const sanitizedHospitalName = String(hospitalName).trim();
    if (!sanitizedHospitalName) {
      return NextResponse.json(
        { error: '병원명을 입력해주세요.' },
        { status: 400 }
      );
    }
    const prefixedHospitalName = `guest-${sanitizedHospitalName}`;

    await ensureNotificationPreferencesColumn();

    const { data: createdUser, error: adminError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          role: 'manager',
          isGuest: true,
          hospitalName: sanitizedHospitalName,
        },
      });

    if (adminError || !createdUser?.user) {
      const message =
        adminError?.message || '게스트 계정 생성에 실패했습니다.';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const randomString = Math.random().toString(36).substring(2, 10);
    const guestPrefix = `guest_${randomString}`;

    const planExpiresAt = new Date();
    planExpiresAt.setDate(planExpiresAt.getDate() + 14);

    const [tenant] = await db
      .insert(tenants)
      .values({
        name: prefixedHospitalName,
        slug: guestPrefix,
        secretCode: guestPrefix,
        plan: 'guest',
        settings: {
          timezone: 'Asia/Seoul',
          locale: 'ko',
          maxUsers: 50,
          maxDepartments: 10,
          features: ['ai-scheduling', 'analytics', 'priority-support'],
          signupEnabled: false,
          planExpiresAt: planExpiresAt.toISOString(),
          isGuestTrial: true,
          originalHospitalName: sanitizedHospitalName,
        },
      })
      .returning();

    const [department] = await db
      .insert(departments)
      .values({
        tenantId: tenant.id,
        name: 'Guest Department',
        code: guestPrefix,
        secretCode: guestPrefix,
        settings: {
          minStaff: 1,
          maxStaff: 50,
        },
      })
      .returning();

    const maxEmployeeIdResult = await db
      .select({ employeeId: users.employeeId })
      .from(users)
      .where(sql`${users.employeeId} LIKE 'GUEST_%'`)
      .orderBy(sql`${users.employeeId} DESC`)
      .limit(1);

    let nextNumber = 1;
    if (maxEmployeeIdResult.length > 0 && maxEmployeeIdResult[0].employeeId) {
      const currentNumber = parseInt(
        maxEmployeeIdResult[0].employeeId.replace('GUEST_', ''),
        10
      );
      nextNumber = currentNumber + 1;
    }

    const employeeId = `GUEST_${String(nextNumber).padStart(7, '0')}`;

    const [user] = await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        departmentId: department.id,
        authUserId: createdUser.user.id,
        email: normalizedEmail,
        name,
        employeeId,
        role: 'manager',
        position: 'HN',
        status: 'active',
        profile: {
          phone: '',
          avatar: '',
        },
      })
      .returning();

    await db.insert(nursePreferences).values({
      tenantId: tenant.id,
      nurseId: user.id,
      departmentId: department.id,
      workPatternType: 'weekday-only',
    });

    return NextResponse.json(
      {
        success: true,
        message: '게스트 계정이 생성되었습니다. 14일간 Pro 플랜을 무료로 사용할 수 있습니다.',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          employeeId: user.employeeId,
          role: user.role,
          position: user.position,
          tenantId: user.tenantId,
          departmentId: user.departmentId,
        },
        trial: {
          plan: 'professional',
          expiresAt: planExpiresAt.toISOString(),
          daysRemaining: 14,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Guest signup error:', error);
    return NextResponse.json(
      {
        error: '게스트 계정 생성에 실패했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
