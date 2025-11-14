import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants, departments, users } from '@/db/schema/tenants';
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
    const { email, name, hospitalName, clerkUserId } = body;

    if (!email || !name || !hospitalName || !clerkUserId) {
      return NextResponse.json(
        { error: '이메일, 이름, 병원명과 인증 정보를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase();

    await ensureNotificationPreferencesColumn();

    const clerk = await clerkClient();
    let verifiedClerkUser;

    try {
      verifiedClerkUser = await clerk.users.getUser(clerkUserId);
    } catch (lookupError) {
      console.error('Clerk user lookup failed:', lookupError);
      return NextResponse.json(
        { error: '이메일 인증 정보를 확인할 수 없습니다. 다시 시도해주세요.' },
        { status: 400 }
      );
    }

    const matchedEmail = verifiedClerkUser.emailAddresses?.find(
      (addr) => addr.emailAddress?.toLowerCase() === normalizedEmail
    );

    if (!matchedEmail) {
      return NextResponse.json(
        { error: '인증된 이메일 정보와 요청 정보가 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    if (matchedEmail.verification?.status !== 'verified') {
      return NextResponse.json(
        { error: '이메일 인증을 완료한 후 다시 시도해주세요.' },
        { status: 400 }
      );
    }

    await clerk.users.updateUser(clerkUserId, {
      firstName: verifiedClerkUser.firstName || name,
      publicMetadata: {
        ...(verifiedClerkUser.publicMetadata || {}),
        role: 'manager',
        isGuest: true,
      },
    });

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
        name: `${guestPrefix} ${hospitalName}`,
        slug: guestPrefix,
        secretCode: guestPrefix,
        plan: 'guest',
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
        clerkUserId,
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
