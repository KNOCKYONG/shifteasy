import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema/tenants';
import { eq, and } from 'drizzle-orm';
import { validateSecretCode } from '@/lib/auth/secret-code';
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
      departmentId,
      hireDate,
      yearsOfService,
      authUserId,
      roleOverride,
    } = await req.json();

    if (!email || !secretCode || !tenantId || !name || !authUserId) {
      return NextResponse.json(
        { error: '필수 정보를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    const validation = await validateSecretCode(secretCode);
    if (!validation.valid || validation.tenant?.id !== tenantId) {
      return NextResponse.json(
        { error: '유효하지 않은 시크릿 코드입니다.' },
        { status: 400 }
      );
    }

    const assignedDepartmentId = validation.department?.id || departmentId;
    const normalizedEmail = email.toLowerCase();

    await ensureNotificationPreferencesColumn();

    const requestedRole = roleOverride === 'manager' ? 'manager' : undefined;

    const existingUser = await db
      .select()
      .from(users)
      .where(
        and(eq(users.email, normalizedEmail), eq(users.tenantId, tenantId))
      )
      .limit(1);

    let finalUser;

    if (existingUser.length > 0) {
      logDebug(
        '기존 사용자 발견:',
        existingUser[0].email,
        '역할:',
        existingUser[0].role
      );

      const updatedUser = await db
        .update(users)
        .set({
          authUserId,
          name,
          departmentId: assignedDepartmentId || existingUser[0].departmentId,
          hireDate: hireDate ? new Date(hireDate) : existingUser[0].hireDate,
          yearsOfService:
            yearsOfService !== undefined
              ? yearsOfService
              : existingUser[0].yearsOfService,
          updatedAt: new Date(),
          role: requestedRole || existingUser[0].role,
        })
        .where(eq(users.id, existingUser[0].id))
        .returning();

      finalUser = updatedUser;
      logDebug('기존 사용자 업데이트 완료, 권한 유지:', existingUser[0].role);
    } else {
      const newUser = await db
        .insert(users)
        .values({
          tenantId,
          authUserId,
          email: normalizedEmail,
          name,
          role: requestedRole ?? 'member',
          departmentId: assignedDepartmentId,
          status: 'active',
          hireDate: hireDate ? new Date(hireDate) : new Date(),
          yearsOfService: yearsOfService ?? 0,
        })
        .returning();

      finalUser = newUser;
      logDebug('새 사용자 생성 완료');
    }

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
        role: finalUser[0].role,
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
