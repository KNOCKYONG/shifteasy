import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { eq, and, isNull } from 'drizzle-orm';
import { users } from '@/db/schema';
import { syncClerkUser } from '@/lib/auth';
// import { hasPermission, type Permission } from '@/lib/permissions';
// import { rateLimitMiddleware } from '@/lib/rate-limit';
// import { auditApiOperation } from '@/lib/audit-log';

export const createTRPCContext = async (opts: { req: Request; headers?: Headers }) => {
  const { req } = opts;

  // Get Clerk authentication info
  const { userId: clerkUserId, orgId } = await auth();

  let user = null;

  if (clerkUserId && orgId) {
    // Sync and get user from database
    try {
      user = await syncClerkUser(clerkUserId, orgId);
    } catch (error) {
      console.error('Error syncing Clerk user:', error);
    }

    // If user doesn't exist in database yet, get from database
    if (!user) {
      const [dbUser] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.clerkUserId, clerkUserId),
            eq(users.tenantId, orgId),
            isNull(users.deletedAt)
          )
        );
      user = dbUser;
    }
  }

  return {
    db,
    user,
    tenantId: orgId || null,
    clerkUserId: clerkUserId || null,
    req: {
      url: req.url,
      method: req.method,
      headers: req.headers,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
    },
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof Error ? error.cause.message : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;

export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure;

const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      tenantId: ctx.user.tenantId,
    },
  });
});

const hasRole = (allowedRoles: string[]) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions'
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        tenantId: ctx.user.tenantId,
      },
    });
  });


export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = t.procedure.use(hasRole(['admin', 'owner']));
export const ownerProcedure = t.procedure.use(hasRole(['owner']));