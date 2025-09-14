/**
 * Analytics Metrics API
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyticsEngine } from '@/lib/analytics/analytics-engine';

const metricsRequestSchema = z.object({
  metrics: z.array(z.enum(['attendance', 'overtime', 'coverage', 'swaps', 'department'])),
  timeRange: z.object({
    start: z.string(),
    end: z.string(),
    period: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  }),
  departmentId: z.string().optional(),
  groupBy: z.array(z.string()).optional(),
  format: z.enum(['json', 'csv', 'excel']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'default-tenant';
    const body = await request.json();
    const validatedData = metricsRequestSchema.parse(body);

    const timeRange = {
      start: new Date(validatedData.timeRange.start),
      end: new Date(validatedData.timeRange.end),
      period: validatedData.timeRange.period,
    };

    // Process each metric type
    const results = await analyticsEngine.aggregateMetrics(
      validatedData.metrics,
      tenantId,
      timeRange,
      {
        groupBy: validatedData.groupBy,
        includeMetadata: true,
      }
    );

    // Handle department-specific metrics
    if (validatedData.departmentId && validatedData.metrics.includes('department')) {
      const deptMetrics = await analyticsEngine.calculateDepartmentMetrics(
        tenantId,
        validatedData.departmentId,
        timeRange
      );
      results.set('department', deptMetrics);
    }

    // Convert Map to object for JSON response
    const metricsData: any = {};
    for (const [key, value] of results.entries()) {
      metricsData[key] = value;
    }

    // Export in requested format
    if (validatedData.format && validatedData.format !== 'json') {
      const allMetrics = Object.values(metricsData).flat() as any[];
      const exported = await analyticsEngine.exportMetrics(
        allMetrics,
        validatedData.format
      );

      return NextResponse.json({
        success: true,
        format: validatedData.format,
        data: exported,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      metrics: metricsData,
      period: `${timeRange.start.toLocaleDateString()} - ${timeRange.end.toLocaleDateString()}`,
      timestamp: new Date().toISOString(),
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

    console.error('Analytics metrics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate metrics',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = request.headers.get('x-tenant-id') || 'default-tenant';

    const metric = searchParams.get('metric');
    const periods = parseInt(searchParams.get('periods') || '6');

    if (!metric) {
      return NextResponse.json(
        {
          success: false,
          error: 'Metric parameter is required',
        },
        { status: 400 }
      );
    }

    // Get trending data
    const trends = await analyticsEngine.calculateTrends(
      metric,
      tenantId,
      periods
    );

    return NextResponse.json({
      success: true,
      metric,
      trends,
      periods,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Analytics trends error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get trends',
      },
      { status: 500 }
    );
  }
}