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
  const orgId = '3760b5ec-462f-443c-9a90-4a2b2e295e9d'; // DEV_TENANT_ID from .env

  // 개발용 임시 사용자 객체
  const user = {
    id: 'dev-user-id',
    email: 'dev@example.com',
    name: 'Dev User',
    role: 'admin',
    tenantId: '3760b5ec-462f-443c-9a90-4a2b2e295e9d', // DEV_TENANT_ID from .env
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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


export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = t.procedure.use(hasRole(['admin', 'owner']));
export const ownerProcedure = t.procedure.use(hasRole(['owner']));