/**
 * Cache Management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { optimizedCacheManager } from '@/lib/cache/optimized-cache-manager';
import { withRateLimit } from '@/lib/middleware/rate-limit-middleware';

const cacheInvalidateSchema = z.object({
  pattern: z.string().optional(),
  type: z.enum(['schedule', 'session', 'computation', 'api', 'all']).optional(),
  key: z.string().optional(),
});

export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const stats = optimizedCacheManager.getStatistics();

      return NextResponse.json({
        success: true,
        statistics: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Cache stats error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get cache statistics',
        },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');

      if (action === 'warmup') {
        // Warm up cache with common data
        const warmupData = [
          { key: 'common:config', value: { loaded: true }, ttl: 7200 },
          { key: 'common:metadata', value: { version: '1.0.0' }, ttl: 3600 },
        ];

        await optimizedCacheManager.warmUpCache(warmupData);

        return NextResponse.json({
          success: true,
          message: 'Cache warmed up successfully',
          items: warmupData.length,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action',
        },
        { status: 400 }
      );
    } catch (error) {
      console.error('Cache operation error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Cache operation failed',
        },
        { status: 500 }
      );
    }
  });
}

export async function DELETE(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const body = await request.json();
      const validatedData = cacheInvalidateSchema.parse(body);

      let invalidated = 0;

      if (validatedData.type === 'all') {
        optimizedCacheManager.clearLocalCache();
        return NextResponse.json({
          success: true,
          message: 'All cache cleared',
        });
      }

      if (validatedData.pattern) {
        // Pattern-based invalidation is expensive in Upstash
        // Clear local cache instead
        optimizedCacheManager.clearLocalCache();
        invalidated = 0;
        console.warn('Pattern invalidation avoided to save Upstash commands');
      } else if (validatedData.type === 'schedule' && validatedData.key) {
        const [tenantId, scheduleId] = validatedData.key.split(':');
        invalidated = await optimizedCacheManager.invalidateSchedule(tenantId, scheduleId);
      } else if (validatedData.type === 'session' && validatedData.key) {
        invalidated = await optimizedCacheManager.invalidateSession(validatedData.key);
      }

      return NextResponse.json({
        success: true,
        invalidated,
        message: `Invalidated ${invalidated} cache entries`,
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid request data',
            details: (error as any).errors,
          },
          { status: 400 }
        );
      }

      console.error('Cache invalidation error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to invalidate cache',
        },
        { status: 500 }
      );
    }
  });
}