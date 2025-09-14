/**
 * Rate Limiting Middleware for Next.js with Upstash support
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from '../rate-limit/rate-limiter';
import { upstashRateLimiter } from '../rate-limit/upstash-rate-limiter';
import { performanceMonitor } from '../performance/performance-monitor';

export async function withRateLimit(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const startTime = Date.now();
  const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
  const tenantId = request.headers.get('x-tenant-id') || 'default';
  const userId = request.headers.get('x-user-id') || ip;
  const endpoint = request.nextUrl.pathname;
  const method = request.method;

  try {
    // Use Upstash if available, fallback to memory-based
    const useUpstash = upstashRateLimiter.isAvailable();

    // DDoS protection
    if (useUpstash) {
      const ddosCheck = await upstashRateLimiter.checkDDoSProtection(ip);
      if (!ddosCheck.allowed) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: 'DDoS protection triggered',
            retryAfter: new Date(ddosCheck.reset),
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': ddosCheck.limit.toString(),
              'X-RateLimit-Remaining': ddosCheck.remaining.toString(),
              'X-RateLimit-Reset': new Date(ddosCheck.reset).toISOString(),
              'Retry-After': Math.ceil((ddosCheck.reset - Date.now()) / 1000).toString(),
            },
          }
        );
      }
    } else {
      const ddosCheck = await rateLimiter.checkDDoSProtection(ip);
      if (!ddosCheck.allowed) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: 'DDoS protection triggered',
            retryAfter: ddosCheck.resetAt,
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': '1000',
              'X-RateLimit-Remaining': ddosCheck.remaining.toString(),
              'X-RateLimit-Reset': ddosCheck.resetAt.toISOString(),
              'Retry-After': Math.ceil((ddosCheck.resetAt.getTime() - Date.now()) / 1000).toString(),
            },
          }
        );
      }
    }

    // API rate limiting
    const identifier = `${tenantId}:${userId}`;
    let apiCheck: any;

    if (useUpstash) {
      const upstashCheck = await upstashRateLimiter.checkApiLimit(identifier);
      apiCheck = {
        allowed: upstashCheck.allowed,
        remaining: upstashCheck.remaining,
        resetAt: new Date(upstashCheck.reset),
        limit: upstashCheck.limit,
      };
    } else {
      apiCheck = await rateLimiter.checkApiLimit(identifier);
      apiCheck.limit = 100;
    }

    if (!apiCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'API rate limit exceeded for your account',
          retryAfter: apiCheck.resetAt,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': apiCheck.limit.toString(),
            'X-RateLimit-Remaining': apiCheck.remaining.toString(),
            'X-RateLimit-Reset': apiCheck.resetAt.toISOString(),
            'Retry-After': Math.ceil((apiCheck.resetAt.getTime() - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Special rate limiting for auth endpoints
    if (endpoint.includes('/auth') || endpoint.includes('/login')) {
      let authCheck: any;

      if (useUpstash) {
        const upstashCheck = await upstashRateLimiter.checkAuthLimit(identifier);
        authCheck = {
          allowed: upstashCheck.allowed,
          remaining: upstashCheck.remaining,
          resetAt: new Date(upstashCheck.reset),
          limit: upstashCheck.limit,
        };
      } else {
        authCheck = await rateLimiter.checkAuthLimit(identifier);
        authCheck.limit = 5;
      }

      if (!authCheck.allowed) {
        return NextResponse.json(
          {
            error: 'Too many authentication attempts',
            message: 'Please wait before trying again',
            retryAfter: authCheck.resetAt,
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': authCheck.limit.toString(),
              'X-RateLimit-Remaining': authCheck.remaining.toString(),
              'X-RateLimit-Reset': authCheck.resetAt.toISOString(),
              'Retry-After': Math.ceil((authCheck.resetAt.getTime() - Date.now()) / 1000).toString(),
            },
          }
        );
      }
    }

    // Special rate limiting for report generation
    if (endpoint.includes('/reports')) {
      let reportCheck: any;

      if (useUpstash) {
        const upstashCheck = await upstashRateLimiter.checkReportLimit(identifier);
        reportCheck = {
          allowed: upstashCheck.allowed,
          remaining: upstashCheck.remaining,
          resetAt: new Date(upstashCheck.reset),
          limit: upstashCheck.limit,
        };
      } else {
        reportCheck = await rateLimiter.checkReportLimit(identifier);
        reportCheck.limit = 10;
      }

      if (!reportCheck.allowed) {
        return NextResponse.json(
          {
            error: 'Report generation limit exceeded',
            message: 'You have exceeded the report generation limit',
            retryAfter: reportCheck.resetAt,
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': reportCheck.limit.toString(),
              'X-RateLimit-Remaining': reportCheck.remaining.toString(),
              'X-RateLimit-Reset': reportCheck.resetAt.toISOString(),
              'Retry-After': Math.ceil((reportCheck.resetAt.getTime() - Date.now()) / 1000).toString(),
            },
          }
        );
      }
    }

    // Check tenant quota for specific resources
    if (endpoint.includes('/api/')) {
      const quotaCheck = await rateLimiter.checkTenantQuota(tenantId, 'requestsPerHour');
      if (!quotaCheck.allowed) {
        return NextResponse.json(
          {
            error: 'Quota exceeded',
            message: 'Your tenant has exceeded the hourly request quota',
            current: quotaCheck.current,
            limit: quotaCheck.limit,
          },
          {
            status: 429,
            headers: {
              'X-Quota-Limit': quotaCheck.limit.toString(),
              'X-Quota-Current': quotaCheck.current.toString(),
            },
          }
        );
      }
    }

    // Execute the handler
    const response = await handler();

    // Record performance metrics
    const duration = Date.now() - startTime;
    performanceMonitor.recordApi(endpoint, method, response.status, duration);

    // Add rate limit headers to response
    const responseWithHeaders = new NextResponse(response.body, response);
    responseWithHeaders.headers.set('X-RateLimit-Limit', apiCheck.limit.toString());
    responseWithHeaders.headers.set('X-RateLimit-Remaining', apiCheck.remaining.toString());
    responseWithHeaders.headers.set('X-RateLimit-Reset', apiCheck.resetAt.toISOString());
    responseWithHeaders.headers.set('X-RateLimit-Provider', useUpstash ? 'upstash' : 'memory');

    return responseWithHeaders;

  } catch (error) {
    // Record error
    const duration = Date.now() - startTime;
    performanceMonitor.recordApi(endpoint, method, 500, duration);

    console.error('Rate limit middleware error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An error occurred while processing your request',
      },
      { status: 500 }
    );
  }
}