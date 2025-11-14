import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { cacheManager } from '@/lib/cache/cache-manager';
import type { Context } from './trpc-context';

const t = initTRPC.context<Context>().create({
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

// Redis cache middleware for read-only operations
const withCache = (ttl: number = 300) => // Default 5 minutes
  t.middleware(async ({ ctx, next, path, type, input }) => {
    // Only cache queries, not mutations
    if (type !== 'query') {
      return next();
    }

    try {
      // Try to get from cache
      const cached = await cacheManager.getCachedApiResponse(path, { input, tenantId: ctx.tenantId });
      if (cached) {
        console.log(`[Cache HIT] ${path}`);
        return cached;
      }

      console.log(`[Cache MISS] ${path}`);
      // Execute the procedure
      const result = await next();

      // Cache the result (don't await to not slow down response)
      cacheManager.cacheApiResponse(path, { input, tenantId: ctx.tenantId }, result, ttl).catch(err => {
        console.error('Cache write error:', err);
      });

      return result;
    } catch (error) {
      // If cache fails, continue without it
      console.error('Cache middleware error:', error);
      return next();
    }
  });

export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = t.procedure.use(hasRole(['admin', 'owner']));
export const ownerProcedure = t.procedure.use(hasRole(['owner']));

// Cached procedures with different TTLs
export const cachedProcedure = protectedProcedure.use(withCache(300)); // 5 min
export const longCachedProcedure = protectedProcedure.use(withCache(1800)); // 30 min
