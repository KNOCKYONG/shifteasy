import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema/tenants';
import { eq } from 'drizzle-orm';
import { ensureNotificationPreferencesColumn } from '@/lib/db/ensureNotificationPreferencesColumn';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // Validate new password length (minimum 8 characters)
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: '새 비밀번호는 최소 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    try {
      // Verify current password by attempting to sign in
      const client = await clerkClient();

      // Get user's email
      await ensureNotificationPreferencesColumn();

      const currentUser = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.clerkUserId, userId))
        .limit(1);

      if (currentUser.length === 0) {
        return NextResponse.json(
          { error: '사용자를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      // Update password in Clerk
      await client.users.updateUser(userId, {
        password: newPassword
      });

      return NextResponse.json({
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다.'
      });
    } catch (error: unknown) {
      console.error('Error updating password:', error);
      const clerkError = error as { errors?: Array<{ code?: string }> };
      const errorCode = clerkError.errors?.[0]?.code;

      // Check if error is due to incorrect current password
      if (errorCode === 'form_password_incorrect') {
        return NextResponse.json(
          { error: '현재 비밀번호가 올바르지 않습니다.' },
          { status: 400 }
        );
      }

      // Check if error is due to common password
      if (errorCode === 'form_password_pwned') {
        return NextResponse.json(
          { error: '너무 흔한 비밀번호입니다. 다른 비밀번호를 사용해주세요.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: '비밀번호 변경에 실패했습니다.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in password change:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
