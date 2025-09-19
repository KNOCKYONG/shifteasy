import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, tenants } from '@/db/schema/tenants';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Generate a random secret code
function generateSecretCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export async function POST(req: NextRequest) {
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

    // Generate new secret code
    const newSecretCode = generateSecretCode();

    // Update tenant's secret code
    const updatedTenant = await db
      .update(tenants)
      .set({
        secretCode: newSecretCode,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, currentUser[0].tenantId))
      .returning();

    if (updatedTenant.length === 0) {
      return NextResponse.json(
        { error: 'Failed to update secret code' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      secretCode: newSecretCode,
      message: 'Secret code regenerated successfully'
    });
  } catch (error) {
    console.error('Error regenerating secret code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}