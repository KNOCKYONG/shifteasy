import { type FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { db } from '@/db';
import { users, tenants } from '@/db/schema';
import { ensureNotificationPreferencesColumn } from '@/lib/db/ensureNotificationPreferencesColumn';
import { eq, and, isNull } from 'drizzle-orm';

type DbUser = typeof users.$inferSelect;
type UserWithTenantPlan = DbUser & { tenantPlan?: string | null };

export async function createTRPCContext(opts?: FetchCreateContextFnOptions) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return {
      db,
      userId: null,
      tenantId: null,
      user: null,
      headers: opts?.req.headers,
    };
  }

  await ensureNotificationPreferencesColumn();

  const dbUser = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.authUserId, session.user.id),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  let user: UserWithTenantPlan | null = dbUser[0] || null;
  const tenantId = user?.tenantId || null;

  if (user && tenantId) {
    const [tenant] = await db
      .select({ plan: tenants.plan })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    user = {
      ...user,
      tenantPlan: tenant?.plan ?? null,
    };
  }

  return {
    db,
    userId: session.user.id,
    tenantId,
    user,
    headers: opts?.req.headers,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
