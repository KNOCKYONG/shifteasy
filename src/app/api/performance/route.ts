/**
 * Performance Monitoring API
 */

import { NextRequest, NextResponse } from 'next/server';
import { performanceMonitor } from '@/lib/performance/performance-monitor';
import { withRateLimit } from '@/lib/middleware/rate-limit-middleware';

export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const type = searchParams.get('type');

      if (type === 'health') {
        const health = performanceMonitor.getHealthStatus();
        return NextResponse.json({
          success: true,
          health,
          timestamp: new Date().toISOString(),
        });
      }

      if (type === 'slow-queries') {
        const limit = parseInt(searchParams.get('limit') || '10');
        const slowQueries = performanceMonitor.getSlowQueries(limit);
        return NextResponse.json({
          success: true,
          slowQueries,
          count: slowQueries.length,
          timestamp: new Date().toISOString(),
        });
      }

      if (type === 'slow-apis') {
        const limit = parseInt(searchParams.get('limit') || '10');
        const slowApis = performanceMonitor.getSlowApis(limit);
        return NextResponse.json({
          success: true,
          slowApis,
          count: slowApis.length,
          timestamp: new Date().toISOString(),
        });
      }

      // Default: return overall statistics
      const stats = performanceMonitor.getStatistics();

      return NextResponse.json({
        success: true,
        statistics: stats,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Performance stats error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get performance statistics',
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

      if (action === 'clear') {
        performanceMonitor.clearMetrics();
        return NextResponse.json({
          success: true,
          message: 'Performance metrics cleared',
        });
      }

      if (action === 'export') {
        const exported = performanceMonitor.exportMetrics();
        return NextResponse.json({
          success: true,
          data: exported,
          message: 'Performance metrics exported',
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
      console.error('Performance operation error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Performance operation failed',
        },
        { status: 500 }
      );
    }
  });
}