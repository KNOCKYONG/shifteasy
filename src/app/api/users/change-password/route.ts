import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema/tenants';
import { eq } from 'drizzle-orm';

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
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    // Validate new password complexity
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{12,}$/;
    if (!passwordRegex.test(newPassword)) {
      return NextResponse.json(
        { error: 'New password does not meet complexity requirements' },
        { status: 400 }
      );
    }

    try {
      // Verify current password by attempting to sign in
      const client = await clerkClient();

      // Get user's email
      const currentUser = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.clerkUserId, userId))
        .limit(1);

      if (currentUser.length === 0) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Update password in Clerk
      await client.users.updateUser(userId, {
        password: newPassword
      });

      return NextResponse.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error: any) {
      console.error('Error updating password:', error);

      // Check if error is due to incorrect current password
      if ((error as any).errors && (error as any).errors[0]?.code === 'form_password_incorrect') {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in password change:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}