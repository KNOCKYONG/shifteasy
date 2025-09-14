/**
 * Batch Jobs API
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { batchProcessor } from '@/lib/batch/batch-processor';

const createJobSchema = z.object({
  type: z.enum(['generate_report', 'calculate_analytics', 'export_data', 'bulk_update', 'optimize_schedule']),
  data: z.any(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
  maxRetries: z.number().min(0).max(10).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createJobSchema.parse(body);

    const jobId = await batchProcessor.addJob(
      validatedData.type,
      validatedData.data,
      {
        priority: validatedData.priority,
        maxRetries: validatedData.maxRetries,
        metadata: {
          userId: request.headers.get('x-user-id'),
          tenantId: request.headers.get('x-tenant-id'),
          createdAt: new Date().toISOString(),
        },
      }
    );

    const job = batchProcessor.getJob(jobId);

    return NextResponse.json({
      success: true,
      jobId,
      job,
      message: 'Job created successfully',
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

    console.error('Batch job creation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create batch job',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let jobs;
    if (status) {
      jobs = batchProcessor.getJobsByStatus(status as any);
    } else {
      jobs = batchProcessor.getAllJobs();
    }

    const statistics = batchProcessor.getStatistics();

    return NextResponse.json({
      success: true,
      jobs,
      statistics,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Batch jobs fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch batch jobs',
      },
      { status: 500 }
    );
  }
}