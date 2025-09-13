import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { users } from '@/db/schema';

export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req } = opts;

  const sessionToken = req.headers.authorization?.replace('Bearer ', '');
  const tenantId = req.headers['x-tenant-id'] as string | undefined;

  let user = null;

  if (sessionToken) {
    // TODO: Integrate with Clerk auth
    // For now, mock user
    user = {
      id: 'mock-user-id',
      tenantId: tenantId || 'mock-tenant-id',
      role: 'admin',
      email: 'admin@example.com',
    };
  }

  return {
    db,
    user,
    tenantId: user?.tenantId,
    req,
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