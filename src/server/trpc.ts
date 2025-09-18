import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
// import { auth, currentUser } from '@clerk/nextjs/server';  // Clerk 인증 임시 비활성화
import { db } from '@/db';
import { eq, and, isNull } from 'drizzle-orm';
import { users } from '@/db/schema';
// import { syncClerkUser } from '@/lib/auth';  // Clerk 인증 임시 비활성화
// import { hasPermission, type Permission } from '@/lib/permissions';
// import { rateLimitMiddleware } from '@/lib/rate-limit';
// import { auditApiOperation } from '@/lib/audit-log';

export const createTRPCContext = async (opts: { req: Request; headers?: Headers }) => {
  const { req } = opts;

  // Clerk 인증 임시 비활성화 - 개발용 기본값 사용
  const clerkUserId = 'dev-user-id';
  const orgId = 'dev-org-id';

  // 개발용 임시 사용자 객체
  const user = {
    id: 'dev-user-id',
    email: 'dev@example.com',
    name: 'Dev User',
    role: 'admin',
    tenantId: 'dev-org-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  /*
  // 원본 인증 코드
  let clerkUserId: string | null = null;
  let orgId: string | null = null;
  let user = null;

  // 개발 모드에서는 기본값 사용
  if (process.env.NODE_ENV === 'development') {
    clerkUserId = 'dev-user-id';
    orgId = 'dev-org-id';
  } else {
    // 프로덕션에서는 Clerk 인증 사용
    const authResult = await auth();
    clerkUserId = authResult.userId;
    orgId = authResult.orgId;
  }

  if (clerkUserId && orgId) {
    // Sync Clerk user with database
    try {
      user = await syncClerkUser(clerkUserId, orgId);
    } catch (error) {
      console.error('Failed to sync Clerk user:', error);
    }
  }
  */

  return {
    db,
    user,
    tenantId: orgId,
    clerkUserId,
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

// Permission-based middleware - 임시 비활성화
/*
const requirePermission = (permission: Permission) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    if (!hasPermission(ctx.user.role as any, permission)) {
      // Log unauthorized access attempt
      await auditApiOperation(
        {
          user: ctx.user || undefined,
          tenantId: ctx.tenantId || undefined,
          req: ctx.req,
        },
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
*/

// Rate limiting middleware - 임시 비활성화
/*
const withRateLimit = (type: 'api' | 'auth' | 'schedule' | 'swap' | 'report' | 'notification' | 'upload' = 'api') =>
  t.middleware(async ({ ctx, next }) => {
    if (ctx.user && ctx.tenantId) {
      await rateLimitMiddleware(type, {
        user: ctx.user || undefined,
        tenantId: ctx.tenantId || undefined,
        req: ctx.req,
      });
    }

    return next();
  });
*/

export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = t.procedure.use(hasRole(['admin', 'owner']));
export const ownerProcedure = t.procedure.use(hasRole(['owner']));

// Permission-based procedures - 임시 비활성화
/*
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
*/