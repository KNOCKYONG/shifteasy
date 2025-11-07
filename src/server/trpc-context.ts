import { type FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function createTRPCContext(opts?: FetchCreateContextFnOptions) {
  // Get Clerk user
  const { userId: clerkUserId, orgId } = await auth();
  const clerkUser = await currentUser();

  console.log('🔍 TRPC Context - Auth Info:', {
    clerkUserId: clerkUserId || 'NO_USER_ID',
    orgId: orgId || 'NO_ORG_ID',
    clerkUserEmail: clerkUser?.primaryEmailAddress?.emailAddress || 'NO_EMAIL',
  });

  // If not authenticated, return basic context
  if (!clerkUserId || !clerkUser) {
    console.log('❌ TRPC Context - Not authenticated');
    return {
      db,
      userId: null,
      tenantId: null,
      user: null,
      headers: opts?.req.headers,
    };
  }

  // Get user from database with role information
  // If orgId exists, prioritize users from that organization
  let dbUser;
  if (orgId) {
    console.log('🔍 TRPC Context - Querying with orgId:', orgId);
    // Query with both clerkUserId AND tenantId for accurate role information
    dbUser = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.clerkUserId, clerkUserId),
          eq(users.tenantId, orgId)
        )
      )
      .limit(1);
  } else {
    console.log('🔍 TRPC Context - Querying without orgId (fallback)');
    // Fallback: query by clerkUserId only
    dbUser = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);
  }

  const user = dbUser[0] || null;

  console.log('🔍 TRPC Context - Database Query Result:', {
    foundUser: !!user,
    userId: user?.id || 'NOT_FOUND',
    userRole: user?.role || 'NO_ROLE',
    userTenantId: user?.tenantId || 'NO_TENANT',
    userName: user?.name || 'NO_NAME',
  });

  // Use organization ID as tenant ID, or use the user's tenant ID from database
  const tenantId = orgId || user?.tenantId || null;

  return {
    db,
    userId: clerkUserId,
    tenantId,
    user,
    headers: opts?.req.headers,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;