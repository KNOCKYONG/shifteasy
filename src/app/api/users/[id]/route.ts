import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema/tenants';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current user and check if admin
    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, userId))
      .limit(1);

    if (currentUser.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (currentUser[0].role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { id: targetUserId } = await params;

    // Cannot delete own account
    if (currentUser[0].id === targetUserId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Get the user to be deleted (to get their Clerk ID)
    const userToDelete = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, targetUserId),
          eq(users.tenantId, currentUser[0].tenantId)
        )
      )
      .limit(1);

    if (userToDelete.length === 0) {
      return NextResponse.json(
        { error: 'User not found or not in your tenant' },
        { status: 404 }
      );
    }

    // Delete from Clerk first
    if (userToDelete[0].clerkUserId) {
      try {
        const client = await clerkClient();
        await client.users.deleteUser(userToDelete[0].clerkUserId);
      } catch (clerkError) {
        console.error('Error deleting user from Clerk:', clerkError);
        // Continue with database deletion even if Clerk deletion fails
      }
    }

    // Delete user from database
    const deletedUser = await db
      .delete(users)
      .where(
        and(
          eq(users.id, targetUserId),
          eq(users.tenantId, currentUser[0].tenantId)
        )
      )
      .returning();

    if (deletedUser.length === 0) {
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}