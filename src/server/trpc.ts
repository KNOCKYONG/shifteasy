import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { eq, and, isNull } from 'drizzle-orm';
import { users } from '@/db/schema';
import { syncClerkUser } from '@/lib/auth';
import { hasPermission, type Permission } from '@/lib/permissions';
import { rateLimitMiddleware } from '@/lib/rate-limit';
import { auditApiOperation } from '@/lib/audit-log';

export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req } = opts;

  // Get auth from Clerk
  const { userId: clerkUserId, orgId } = await auth();

  let user = null;

  if (clerkUserId && orgId) {
    // Sync Clerk user with database
    try {
      user = await syncClerkUser(clerkUserId, orgId);
    } catch (error) {
      console.error('Failed to sync Clerk user:', error);
    }
  }

  return {
    db,
    user,
    tenantId: orgId,
    clerkUserId,
    req: {
      url: req.url,
      method: req.method,
      headers: req.headers,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
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

// Permission-based middleware
const requirePermission = (permission: Permission) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    if (!hasPermission(ctx.user.role as any, permission)) {
      // Log unauthorized access attempt
      await auditApiOperation(
        ctx,
        'security.unauthorized_access',
        'api_permission',
        undefined,
        {
          metadata: {
            requiredPermission: permission,
            userRole: ctx.user.role,
          },
        }
      );

      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Missing required permission: ${permission}`,
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

// Rate limiting middleware
const withRateLimit = (type: 'api' | 'auth' | 'schedule' | 'swap' | 'report' | 'notification' | 'upload' = 'api') =>
  t.middleware(async ({ ctx, next }) => {
    if (ctx.user && ctx.tenantId) {
      await rateLimitMiddleware(type, ctx);
    }

    return next();
  });

export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = t.procedure.use(hasRole(['admin', 'owner']));
export const ownerProcedure = t.procedure.use(hasRole(['owner']));

// Permission-based procedures
export const createScheduleProcedure = t.procedure
  .use(isAuthed)
  .use(requirePermission('schedule.create'))
  .use(withRateLimit('schedule'));

export const manageStaffProcedure = t.procedure
  .use(isAuthed)
  .use(requirePermission('staff.edit'))
  .use(withRateLimit('api'));

export const approveSwapProcedure = t.procedure
  .use(isAuthed)
  .use(requirePermission('swap.approve'))
  .use(withRateLimit('swap'));