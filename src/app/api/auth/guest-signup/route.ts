import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants, departments, users } from '@/db/schema/tenants';
import { nursePreferences } from '@/db/schema/nurse-preferences';
import { clerkClient } from '@clerk/nextjs/server';
import { sql } from 'drizzle-orm';
import { ensureNotificationPreferencesColumn } from '@/lib/db/ensureNotificationPreferencesColumn';

export const dynamic = 'force-dynamic';

/**
 * 게스트 계정 생성 API
 * - manager 권한으로 게스트 계정 생성
 * - tenant_id와 department_id는 guest_ 접두사 + 랜덤 문자열
 * - position은 HN으로 설정
 * - employeeId는 GUEST_0000001 형식으로 자동 생성
 * - 14일 Pro 플랜 무료 체험 제공
 * - 이메일 인증을 완료한 Clerk 사용자 ID가 반드시 필요
 */
export async function POST(request: NextRequest) {
  try {
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

    const clerk = await clerkClient();
    let clerkUser;
    try {
      clerkUser = await clerk.users.createUser({
        emailAddress: [normalizedEmail],
        password,
        firstName: name,
        publicMetadata: {
          role: 'manager',
          isGuest: true,
        },
      });
    } catch (clerkError) {
      console.error('Clerk user creation error (guest):', clerkError);
      const typedError = clerkError as { errors?: Array<{ code?: string; message?: string }> };
      const firstError = typedError?.errors?.[0];

      if (firstError?.code === 'form_identifier_exists') {
        return NextResponse.json(
          { error: '이미 사용 중인 이메일입니다.' },
          { status: 400 }
        );
      }

      if (firstError?.code === 'form_password_pwned') {
        return NextResponse.json(
          { error: '너무 흔한 비밀번호입니다. 다른 비밀번호를 사용해주세요.' },
          { status: 400 }
        );
      }

      if (firstError?.code === 'form_password_length_too_short') {
        return NextResponse.json(
          { error: '비밀번호는 8자 이상이어야 합니다.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: firstError?.message || '게스트 계정 생성에 실패했습니다.' },
        { status: 400 }
      );
    }

    // 랜덤 문자열 생성 (8자리)
    const randomString = Math.random().toString(36).substring(2, 10);
    const guestPrefix = `guest_${randomString}`;

    // 14일 후 날짜 계산
    const planExpiresAt = new Date();
    planExpiresAt.setDate(planExpiresAt.getDate() + 14);

    // 1. Tenant 생성 (14일 Pro 플랜)
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

    // 2. Department 생성
    const [department] = await db
      .insert(departments)
      .values({
        tenantId: tenant.id,
        name: 'Guest Department',
        code: guestPrefix,
        secretCode: guestPrefix,
        settings: {
          minStaff: 1,
          maxStaff: 50, // Pro 플랜 제한
        },
      })
      .returning();

    // 3. employeeId 생성 (GUEST_0000001 형식)
    // 현재 최대 GUEST_ employeeId 조회
    const maxEmployeeIdResult = await db
      .select({ employeeId: users.employeeId })
      .from(users)
      .where(sql`${users.employeeId} LIKE 'GUEST_%'`)
      .orderBy(sql`${users.employeeId} DESC`)
      .limit(1);

    let nextNumber = 1;
    if (maxEmployeeIdResult.length > 0 && maxEmployeeIdResult[0].employeeId) {
      // GUEST_0000001 형식에서 숫자 부분 추출
      const currentNumber = parseInt(maxEmployeeIdResult[0].employeeId.replace('GUEST_', ''), 10);
      nextNumber = currentNumber + 1;
    }

    const employeeId = `GUEST_${String(nextNumber).padStart(7, '0')}`;

    // 4. User 생성 (데이터베이스에)
    const [user] = await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        departmentId: department.id,
        clerkUserId: clerkUser.id,
        email: normalizedEmail,
        name: name,
        employeeId: employeeId,
        role: 'manager',
        position: 'HN',
        status: 'active',
        profile: {
          phone: '',
          avatar: '',
        },
      })
      .returning();

    // 5. 기본 근무 선호도 생성 (게스트는 weekday-only 강제)
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
    const clerkError = error as { errors?: Array<{ code?: string }>; message?: string };

    return NextResponse.json(
      {
        error: '게스트 계정 생성에 실패했습니다.',
        details: clerkError?.message ?? 'Unknown error',
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
