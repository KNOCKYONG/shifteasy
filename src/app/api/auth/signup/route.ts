import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema/tenants';
import { eq, and } from 'drizzle-orm';
import { validateSecretCode } from '@/lib/auth/secret-code';
import { createClerkClient } from '@clerk/nextjs/server';
import { ensureNotificationPreferencesColumn } from '@/lib/db/ensureNotificationPreferencesColumn';

const isVerboseLoggingEnabled = process.env.NODE_ENV !== 'production';
const logDebug = (...args: Parameters<typeof console.log>) => {
  if (isVerboseLoggingEnabled) {
    console.log(...args);
  }
};

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const {
      email,
      secretCode,
      tenantId,
      name,
      password,
      departmentId,
      hireDate,
      yearsOfService,
      clerkUserId,
    } = await req.json();

    // 필수 필드 검증
    if (!email || !secretCode || !tenantId || !name) {
      return NextResponse.json(
        { error: '필수 정보를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    const providedClerkUserId =
      typeof clerkUserId === 'string' && clerkUserId.trim().length > 0
        ? clerkUserId.trim()
        : undefined;

    if (!providedClerkUserId && !password) {
      return NextResponse.json(
        { error: '비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 시크릿 코드 재검증
    const validation = await validateSecretCode(secretCode);
    if (!validation.valid || validation.tenant?.id !== tenantId) {
      return NextResponse.json(
        { error: '유효하지 않은 시크릿 코드입니다.' },
        { status: 400 }
      );
    }

    // 부서 시크릿 코드로 가입한 경우 해당 부서로 자동 배정
    const assignedDepartmentId = validation.department?.id || departmentId;
    const normalizedEmail = email.toLowerCase();

    // Clerk 클라이언트 초기화
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

    let externalClerkUser: Awaited<ReturnType<typeof clerk.users.getUser>> | null = null;
    if (providedClerkUserId) {
      try {
        externalClerkUser = await clerk.users.getUser(providedClerkUserId);
      } catch (lookupError) {
        console.error('Clerk user lookup failed:', lookupError);
        return NextResponse.json(
          { error: '이메일 인증 정보를 확인할 수 없습니다. 다시 시도해주세요.' },
          { status: 400 }
        );
      }

      const matchedEmail = externalClerkUser.emailAddresses?.find(
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
    }

    await ensureNotificationPreferencesColumn();

    // 이메일로 기존 사용자 체크 (같은 테넌트 내에서)
    const existingUser = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email),
          eq(users.tenantId, tenantId)
        )
      )
      .limit(1);

    let finalUser;

    if (existingUser.length > 0) {
      // 기존 DB 사용자가 있는 경우 - Clerk 계정만 생성하고 연동
      logDebug('기존 사용자 발견:', existingUser[0].email, '역할:', existingUser[0].role);

      // 이미 Clerk 사용자가 있는지 확인
      let resolvedClerkUserId = providedClerkUserId || existingUser[0].clerkUserId || '';

      // Clerk ID가 없거나 local_ 로 시작하는 경우만 새로 생성
      if (!resolvedClerkUserId || resolvedClerkUserId.startsWith('local_')) {
        try {
          // 비밀번호가 없으면 오류 반환
          if (!password) {
            return NextResponse.json(
              { error: '비밀번호를 입력해주세요.' },
              { status: 400 }
            );
          }

          const clerkUser = await clerk.users.createUser({
            emailAddress: [email],
            password: password,
            firstName: name.split(' ')[0] || name,
            lastName: name.split(' ').slice(1).join(' ') || '',
          });
          resolvedClerkUserId = clerkUser.id;
        } catch (clerkError: unknown) {
          const typedError = clerkError as { errors?: Array<{ code?: string; message?: string }> };
          logDebug('Clerk user creation error:', clerkError);
          logDebug('Clerk error details:', JSON.stringify(typedError?.errors, null, 2));

          // Clerk 사용자가 이미 존재하는 경우
          if (typedError?.errors?.[0]?.code === 'form_identifier_exists') {
            // 기존 사용자 정보로 로그인하도록 안내
            return NextResponse.json({
              success: true,
              user: {
                id: existingUser[0].id,
                email: existingUser[0].email,
                name: existingUser[0].name,
                role: existingUser[0].role,
              },
              message: '이미 가입된 계정입니다. 기존 비밀번호로 로그인해주세요.',
            });
          }

          // 비밀번호가 데이터 유출에서 발견된 경우
          if (typedError?.errors?.[0]?.code === 'form_password_pwned') {
            return NextResponse.json(
              { error: '이 비밀번호는 온라인 데이터 유출에서 발견되었습니다. 보안을 위해 다른 비밀번호를 사용해주세요.' },
              { status: 400 }
            );
          }

          return NextResponse.json(
            { error: typedError?.errors?.[0]?.message || '인증 계정 생성에 실패했습니다. 더 복잡한 비밀번호를 사용해주세요.' },
            { status: 400 }
          );
        }
      }

      // 기존 사용자의 clerkUserId 업데이트
      const updatedUser = await db
        .update(users)
        .set({
          clerkUserId: resolvedClerkUserId,
          name, // 입력받은 이름으로 업데이트
          departmentId: assignedDepartmentId || existingUser[0].departmentId, // 부서 업데이트 (부서 코드 우선)
          hireDate: hireDate ? new Date(hireDate) : existingUser[0].hireDate,
          yearsOfService: yearsOfService !== undefined ? yearsOfService : existingUser[0].yearsOfService,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser[0].id))
        .returning();

      finalUser = updatedUser;
      logDebug('기존 사용자 업데이트 완료, 권한 유지:', existingUser[0].role);

    } else {
      // 새 사용자인 경우 - 기존 로직대로 생성
      let resolvedClerkUserId = providedClerkUserId || '';
      if (!resolvedClerkUserId) {
        try {
          // 비밀번호가 없으면 오류 반환
          if (!password) {
            return NextResponse.json(
              { error: '비밀번호를 입력해주세요.' },
              { status: 400 }
            );
          }

          const clerkUser = await clerk.users.createUser({
            emailAddress: [email],
            password: password,
            firstName: name.split(' ')[0] || name,
            lastName: name.split(' ').slice(1).join(' ') || '',
          });
          resolvedClerkUserId = clerkUser.id;
        } catch (clerkError: unknown) {
          const typedError = clerkError as { errors?: Array<{ code?: string; message?: string }> };
          logDebug('Clerk user creation error:', clerkError);
          logDebug('Clerk error details:', JSON.stringify(typedError?.errors, null, 2));

          // Clerk 사용자가 이미 존재하는 경우
          if (typedError?.errors?.[0]?.code === 'form_identifier_exists') {
            return NextResponse.json(
              { error: '이미 등록된 이메일입니다. 로그인해주세요.' },
              { status: 400 }
            );
          }

          // 비밀번호가 데이터 유출에서 발견된 경우
          if (typedError?.errors?.[0]?.code === 'form_password_pwned') {
            return NextResponse.json(
              { error: '이 비밀번호는 온라인 데이터 유출에서 발견되었습니다. 보안을 위해 다른 비밀번호를 사용해주세요.' },
              { status: 400 }
            );
          }

          // 비밀번호가 너무 짧은 경우
          if (typedError?.errors?.[0]?.code === 'form_password_length_too_short') {
            return NextResponse.json(
              { error: '비밀번호는 최소 8자 이상이어야 합니다.' },
              { status: 400 }
            );
          }

          // 다른 오류의 경우 - 회원가입 실패
          console.error('Clerk 사용자 생성 실패');
          return NextResponse.json(
            { error: typedError?.errors?.[0]?.message || '회원가입에 실패했습니다. 더 복잡한 비밀번호를 사용해주세요.' },
            { status: 400 }
          );
        }
      }

      // 데이터베이스에 새 사용자 생성
      const newUser = await db
        .insert(users)
        .values({
          tenantId,
          clerkUserId: resolvedClerkUserId,
          email,
          name,
          role: 'member', // 새 사용자는 기본 member 역할
          departmentId: assignedDepartmentId, // 부서 설정 (부서 코드 우선)
          status: 'active',
          hireDate: hireDate ? new Date(hireDate) : new Date(),
          yearsOfService: yearsOfService !== undefined ? yearsOfService : 0,
        })
        .returning();

      finalUser = newUser;
      logDebug('새 사용자 생성 완료');
    }

    // 환영 알림 생성 (선택사항)
    try {
      const { notifications } = await import('@/db/schema/tenants');
      await db.insert(notifications).values({
        tenantId,
        userId: finalUser[0].id,
        type: 'general',
        priority: 'medium',
        title: 'ShiftEasy에 오신 것을 환영합니다!',
        message: `${validation.tenant?.name}에 성공적으로 가입되었습니다. 이제 스케줄을 확인하고 관리할 수 있습니다.`,
        actionUrl: '/schedule',
        data: {
          action: 'view_schedule',
          welcomeMessage: true,
        },
      });
    } catch (notifError) {
      logDebug('Welcome notification skipped:', notifError);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: finalUser[0].id,
        email: finalUser[0].email,
        name: finalUser[0].name,
        role: finalUser[0].role, // 역할 정보도 반환
      },
      message: '회원가입이 완료되었습니다. 로그인해주세요.',
    });
  } catch (error: unknown) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
