import { TRPCError, initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { type Context } from '../trpc-context';
import { cacheManager } from '@/lib/cache/cache-manager';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;

// Performance measurement middleware
const performanceMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();

  try {
    const result = await next();
    const duration = Date.now() - start;

    // Log slow queries (>200ms)
    if (duration > 200) {
      console.warn(`🐌 SLOW ${type}: ${path} took ${duration}ms`);
    } else if (duration > 100) {
      console.log(`⚠️  ${type}: ${path} took ${duration}ms`);
    } else {
      console.log(`✅ ${type}: ${path} took ${duration}ms`);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`❌ ERROR ${type}: ${path} took ${duration}ms before failing`);
    throw error;
  }
});

export const publicProcedure = t.procedure.use(performanceMiddleware);

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

export const protectedProcedure = t.procedure
  .use(performanceMiddleware)
  .use(enforceUserIsAuthed);

const enforceUserIsAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  // TODO: Add actual admin check
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

export const adminProcedure = t.procedure
  .use(performanceMiddleware)
  .use(enforceUserIsAdmin);

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

// Cached procedures with different TTLs
export const cachedProcedure = protectedProcedure.use(withCache(300)); // 5 min
export const longCachedProcedure = protectedProcedure.use(withCache(1800)); // 30 min

// Note: cachedProcedure and longCachedProcedure already include performanceMiddleware
// because they extend protectedProcedure