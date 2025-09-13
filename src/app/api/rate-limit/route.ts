/**
 * Rate Limit Management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimiter } from '@/lib/rate-limit/rate-limiter';
import { withRateLimit } from '@/lib/middleware/rate-limit-middleware';

const tenantQuotaSchema = z.object({
  tenantId: z.string(),
  tier: z.enum(['free', 'basic', 'premium', 'enterprise']),
});

export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const tenantId = searchParams.get('tenantId');

      if (tenantId) {
        // Get specific tenant quota
        const quotas = rateLimiter.getTenantQuotas();
        const tenantQuota = quotas.find(q => q.tenantId === tenantId);

        if (!tenantQuota) {
          return NextResponse.json(
            {
              success: false,
              error: 'Tenant quota not found',
            },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          quota: tenantQuota,
          timestamp: new Date().toISOString(),
        });
      }

      // Get all rate limit statistics
      const stats = rateLimiter.getUsageStatistics();

      return NextResponse.json({
        success: true,
        statistics: {
          tenantQuotas: rateLimiter.getTenantQuotas(),
          limiters: stats.limitersStatus,
          usage: Object.fromEntries(stats.tenantUsage),
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Rate limit stats error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get rate limit statistics',
        },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const body = await request.json();
      const validatedData = tenantQuotaSchema.parse(body);

      // Set tenant quota
      rateLimiter.setTenantQuota(validatedData.tenantId, validatedData.tier);

      return NextResponse.json({
        success: true,
        message: `Tenant quota updated to ${validatedData.tier} tier`,
        tenantId: validatedData.tenantId,
        tier: validatedData.tier,
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid request data',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      console.error('Rate limit update error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update rate limit',
        },
        { status: 500 }
      );
    }
  });
}

export async function DELETE(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const limiterName = searchParams.get('limiter');
      const key = searchParams.get('key');

      if (!limiterName || !key) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing limiter name or key',
          },
          { status: 400 }
        );
      }

      await rateLimiter.reset(limiterName, key);

      return NextResponse.json({
        success: true,
        message: `Rate limit reset for ${limiterName}:${key}`,
      });

    } catch (error) {
      console.error('Rate limit reset error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to reset rate limit',
        },
        { status: 500 }
      );
    }
  });
}