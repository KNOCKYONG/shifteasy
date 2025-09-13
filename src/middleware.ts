import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createAuditLog } from '@/lib/audit-log';

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/',
  '/api/public(.*)',
]);

// Admin-only routes
const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
]);

// Create rate limiter instances
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 requests per 10 seconds
  analytics: true,
});

const strictRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 requests per minute for sensitive operations
  analytics: true,
});

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, orgId, sessionClaims } = await auth();

  // Skip auth for public routes
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Require authentication for all other routes
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Organization/Tenant validation
  if (!orgId) {
    // Redirect to organization selection if no org is selected
    const orgSelectionUrl = new URL('/organization-selection', req.url);
    return NextResponse.redirect(orgSelectionUrl);
  }

  // Rate limiting
  const identifier = `${userId}:${req.ip ?? '127.0.0.1'}`;
  const isStrictRoute = req.url.includes('/api/swap') || req.url.includes('/api/schedule/publish');

  const rateLimiter = isStrictRoute ? strictRatelimit : ratelimit;
  const { success, limit, reset, remaining } = await rateLimiter.limit(identifier);

  if (!success) {
    // Log rate limit violation
    await createAuditLog({
      tenantId: orgId,
      actorId: userId,
      action: 'rate_limit_exceeded',
      entityType: 'api_request',
      metadata: {
        url: req.url,
        method: req.method,
        ip: req.ip,
      },
    });

    return NextResponse.json(
      {
        error: 'Too many requests',
        retryAfter: reset,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(reset).toISOString(),
        },
      }
    );
  }

  // Add rate limit headers to response
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', new Date(reset).toISOString());

  // Add tenant ID to headers for downstream use
  response.headers.set('X-Tenant-Id', orgId);
  response.headers.set('X-User-Id', userId);

  // Admin route protection
  if (isAdminRoute(req)) {
    const userRole = sessionClaims?.metadata?.role as string;
    if (!userRole || !['admin', 'owner'].includes(userRole)) {
      // Log unauthorized access attempt
      await createAuditLog({
        tenantId: orgId,
        actorId: userId,
        action: 'unauthorized_access_attempt',
        entityType: 'admin_route',
        metadata: {
          url: req.url,
          method: req.method,
          userRole,
        },
      });

      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }
  }

  // Log successful access for sensitive routes
  if (req.url.includes('/api/') && req.method !== 'GET') {
    await createAuditLog({
      tenantId: orgId,
      actorId: userId,
      action: 'api_access',
      entityType: 'api_request',
      metadata: {
        url: req.url,
        method: req.method,
        ip: req.ip,
      },
    });
  }

  return response;
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};