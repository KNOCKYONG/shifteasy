import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Different rate limiters for different operations
export const rateLimiters = {
  // General API requests: 100 requests per minute
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'ratelimit:api',
  }),

  // Auth operations: 10 attempts per 10 minutes
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '10 m'),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),

  // Schedule operations: 30 per hour
  schedule: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 h'),
    analytics: true,
    prefix: 'ratelimit:schedule',
  }),

  // Swap requests: 20 per hour
  swap: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    analytics: true,
    prefix: 'ratelimit:swap',
  }),

  // Report generation: 10 per hour
  report: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    analytics: true,
    prefix: 'ratelimit:report',
  }),

  // Notification sending: 50 per minute
  notification: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, '1 m'),
    analytics: true,
    prefix: 'ratelimit:notification',
  }),

  // File uploads: 20 per hour
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    analytics: true,
    prefix: 'ratelimit:upload',
  }),
};

/**
 * Check rate limit for a specific operation
 */
export async function checkRateLimit(
  type: keyof typeof rateLimiters,
  identifier: string
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const limiter = rateLimiters[type];

  if (!limiter) {
    throw new Error(`Unknown rate limiter type: ${type}`);
  }

  const result = await limiter.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Get rate limit key for user
 */
export function getRateLimitKey(userId: string, tenantId: string, ip?: string): string {
  // Combine user ID, tenant ID, and IP for more granular rate limiting
  const parts = [userId, tenantId];
  if (ip) {
    parts.push(ip);
  }
  return parts.join(':');
}

/**
 * Reset rate limit for a specific identifier
 */
export async function resetRateLimit(
  type: keyof typeof rateLimiters,
  identifier: string
): Promise<void> {
  const prefix = `ratelimit:${type}`;
  const key = `${prefix}:${identifier}`;

  await redis.del(key);
}

/**
 * Get current rate limit status without consuming
 */
export async function getRateLimitStatus(
  type: keyof typeof rateLimiters,
  identifier: string
): Promise<{
  limit: number;
  remaining: number;
  reset: number;
}> {
  const limiter = rateLimiters[type];

  if (!limiter) {
    throw new Error(`Unknown rate limiter type: ${type}`);
  }

  // Get the current window info without consuming a request
  const prefix = `ratelimit:${type}`;
  const key = `${prefix}:${identifier}`;

  const data = await redis.get(key);

  if (!data || typeof data !== 'object') {
    // No previous requests, return full limit
    const config = getRateLimitConfig(type);
    return {
      limit: config.limit,
      remaining: config.limit,
      reset: Date.now() + config.window,
    };
  }

  // Calculate remaining from stored data
  const requests = Array.isArray(data) ? data.length : 0;
  const config = getRateLimitConfig(type);

  return {
    limit: config.limit,
    remaining: Math.max(0, config.limit - requests),
    reset: Date.now() + config.window,
  };
}

/**
 * Get rate limit configuration
 */
function getRateLimitConfig(type: keyof typeof rateLimiters): {
  limit: number;
  window: number;
} {
  const configs = {
    api: { limit: 100, window: 60 * 1000 }, // 1 minute
    auth: { limit: 10, window: 10 * 60 * 1000 }, // 10 minutes
    schedule: { limit: 30, window: 60 * 60 * 1000 }, // 1 hour
    swap: { limit: 20, window: 60 * 60 * 1000 }, // 1 hour
    report: { limit: 10, window: 60 * 60 * 1000 }, // 1 hour
    notification: { limit: 50, window: 60 * 1000 }, // 1 minute
    upload: { limit: 20, window: 60 * 60 * 1000 }, // 1 hour
  };

  return configs[type];
}

/**
 * Middleware helper for tRPC procedures
 */
export async function rateLimitMiddleware(
  type: keyof typeof rateLimiters,
  ctx: { user?: { id: string }; tenantId?: string; req?: { ip?: string } }
) {
  if (!ctx.user?.id || !ctx.tenantId) {
    // Skip rate limiting for unauthenticated requests
    // (they should be blocked by auth middleware anyway)
    return;
  }

  const identifier = getRateLimitKey(
    ctx.user.id,
    ctx.tenantId,
    ctx.req?.ip
  );

  const result = await checkRateLimit(type, identifier);

  if (!result.success) {
    throw new Error(
      `Rate limit exceeded. Try again in ${Math.ceil(
        (result.reset - Date.now()) / 1000
      )} seconds.`
    );
  }

  return result;
}