import { type FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function createTRPCContext(opts?: FetchCreateContextFnOptions) {
  // Get Clerk user
  const { userId: clerkUserId, orgId } = await auth();
  const clerkUser = await currentUser();

  // If not authenticated, return basic context
  if (!clerkUserId || !clerkUser) {
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
    // Fallback: query by clerkUserId only
    dbUser = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);
  }

  const user = dbUser[0] || null;

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