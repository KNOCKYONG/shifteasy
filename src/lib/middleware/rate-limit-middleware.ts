/**
 * Rate Limiting Middleware for Next.js
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from '../rate-limit/rate-limiter';
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
    // DDoS protection
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

    // API rate limiting
    const identifier = `${tenantId}:${userId}`;
    const apiCheck = await rateLimiter.checkApiLimit(identifier);

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
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': apiCheck.remaining.toString(),
            'X-RateLimit-Reset': apiCheck.resetAt.toISOString(),
            'Retry-After': Math.ceil((apiCheck.resetAt.getTime() - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Special rate limiting for auth endpoints
    if (endpoint.includes('/auth') || endpoint.includes('/login')) {
      const authCheck = await rateLimiter.checkAuthLimit(identifier);
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
              'X-RateLimit-Limit': '5',
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
      const reportCheck = await rateLimiter.checkReportLimit(identifier);
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
              'X-RateLimit-Limit': '10',
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
    responseWithHeaders.headers.set('X-RateLimit-Limit', '100');
    responseWithHeaders.headers.set('X-RateLimit-Remaining', apiCheck.remaining.toString());
    responseWithHeaders.headers.set('X-RateLimit-Reset', apiCheck.resetAt.toISOString());

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