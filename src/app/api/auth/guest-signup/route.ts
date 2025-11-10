import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants, departments, users } from '@/db/schema/tenants';
import { clerkClient } from '@clerk/nextjs/server';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

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
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: '이메일, 비밀번호, 이름을 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // 랜덤 문자열 생성 (8자리)
    const randomString = Math.random().toString(36).substring(2, 10);
    const guestPrefix = `guest_${randomString}`;

    // 14일 후 날짜 계산
    const planExpiresAt = new Date();
    planExpiresAt.setDate(planExpiresAt.getDate() + 14);

    // 1. Clerk에 사용자 생성
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.createUser({
      emailAddress: [email],
      password: password,
      firstName: name,
      publicMetadata: {
        role: 'manager',
        isGuest: true,
      },
    });

    // 2. Tenant 생성 (14일 Pro 플랜)
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: `Guest Workspace - ${name}`,
        slug: guestPrefix,
        secretCode: guestPrefix,
        plan: 'pro',
        settings: {
          timezone: 'Asia/Seoul',
          locale: 'ko',
          maxUsers: 50, // Pro 플랜 제한
          maxDepartments: 10, // Pro 플랜 제한
          features: ['ai-scheduling', 'analytics', 'priority-support'], // Pro 플랜 기능
          signupEnabled: false, // 게스트 계정은 추가 회원가입 불가
          planExpiresAt: planExpiresAt.toISOString(), // 14일 후 만료
          isGuestTrial: true, // 게스트 체험판 표시
        },
      })
      .returning();

    // 3. Department 생성
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

    // 4. employeeId 생성 (GUEST_0000001 형식)
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

    // 5. User 생성 (데이터베이스에)
    const [user] = await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        departmentId: department.id,
        clerkUserId: clerkUser.id,
        email: email,
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
          plan: 'pro',
          expiresAt: planExpiresAt.toISOString(),
          daysRemaining: 14,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Guest signup error:', error);

    // Clerk 에러 처리
    if (error.errors?.[0]?.code === 'form_identifier_exists') {
      return NextResponse.json(
        { error: '이미 사용 중인 이메일입니다.' },
        { status: 400 }
      );
    }

    if (error.errors?.[0]?.code === 'form_password_pwned') {
      return NextResponse.json(
        { error: '너무 흔한 비밀번호입니다. 다른 비밀번호를 사용해주세요.' },
        { status: 400 }
      );
    }

    if (error.errors?.[0]?.code === 'form_param_format_invalid') {
      return NextResponse.json(
        { error: '비밀번호는 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: '게스트 계정 생성에 실패했습니다.',
        details: error.message,
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
