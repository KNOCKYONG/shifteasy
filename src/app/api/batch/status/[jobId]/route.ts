/**
 * Batch Job Status API
 */

import { NextRequest, NextResponse } from 'next/server';
import { batchProcessor } from '@/lib/batch/batch-processor';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const job = batchProcessor.getJob(jobId);

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          error: 'Job not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Job status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get job status',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const cancelled = batchProcessor.cancelJob(jobId);

    if (!cancelled) {
      return NextResponse.json(
        {
          success: false,
          error: 'Job could not be cancelled or not found',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
      jobId,
    });

  } catch (error) {
    console.error('Job cancellation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cancel job',
      },
      { status: 500 }
    );
  }
}