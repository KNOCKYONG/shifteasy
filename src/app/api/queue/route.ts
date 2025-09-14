/**
 * Queue Management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { queueManager } from '@/lib/queue/queue-manager';
import { QueueName, JobPriority } from '@/lib/queue/bull-config';
import { withRateLimit } from '@/lib/middleware/rate-limit-middleware';

// Request schemas
const addJobSchema = z.object({
  queue: z.nativeEnum(QueueName),
  data: z.any(),
  options: z.object({
    priority: z.nativeEnum(JobPriority).optional(),
    delay: z.number().optional(),
    attempts: z.number().optional(),
  }).optional(),
});

const jobActionSchema = z.object({
  queue: z.nativeEnum(QueueName),
  jobId: z.string(),
  action: z.enum(['cancel', 'retry']),
});

export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const queue = searchParams.get('queue') as QueueName | null;
      const jobId = searchParams.get('jobId');
      const status = searchParams.get('status') as any;

      // Get specific job
      if (queue && jobId) {
        const job = await queueManager.getJob(queue, jobId);
        if (!job) {
          return NextResponse.json(
            { success: false, error: 'Job not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, job });
      }

      // Get jobs by status
      if (queue && status) {
        const jobs = await queueManager.getJobsByStatus(queue, status);
        return NextResponse.json({ success: true, jobs });
      }

      // Get queue statistics
      if (queue) {
        const stats = await queueManager.getQueueStatistics(queue);
        return NextResponse.json({ success: true, statistics: stats });
      }

      // Get all queues statistics
      const allStats = await queueManager.getAllQueueStatistics();
      return NextResponse.json({
        success: true,
        queues: allStats,
        health: await queueManager.healthCheck(),
      });

    } catch (error) {
      console.error('Queue API error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to get queue information' },
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

      if (action === 'pause') {
        const queue = searchParams.get('queue') as QueueName;
        if (!queue) {
          return NextResponse.json(
            { success: false, error: 'Queue name required' },
            { status: 400 }
          );
        }
        await queueManager.pauseQueue(queue);
        return NextResponse.json({
          success: true,
          message: `Queue ${queue} paused`,
        });
      }

      if (action === 'resume') {
        const queue = searchParams.get('queue') as QueueName;
        if (!queue) {
          return NextResponse.json(
            { success: false, error: 'Queue name required' },
            { status: 400 }
          );
        }
        await queueManager.resumeQueue(queue);
        return NextResponse.json({
          success: true,
          message: `Queue ${queue} resumed`,
        });
      }

      // Add new job
      const body = await request.json();
      const validatedData = addJobSchema.parse(body);

      let result;
      switch (validatedData.queue) {
        case QueueName.EMAIL:
          result = await queueManager.addEmailJob(
            validatedData.data,
            validatedData.options
          );
          break;
        case QueueName.REPORT:
          result = await queueManager.addReportJob(
            validatedData.data,
            validatedData.options
          );
          break;
        case QueueName.SCHEDULE:
          result = await queueManager.addScheduleJob(
            validatedData.data,
            validatedData.options
          );
          break;
        case QueueName.NOTIFICATION:
          result = await queueManager.addNotificationJob(
            validatedData.data,
            validatedData.options
          );
          break;
        case QueueName.ANALYTICS:
          result = await queueManager.addAnalyticsJob(
            validatedData.data,
            validatedData.options
          );
          break;
        case QueueName.BACKUP:
          result = await queueManager.addBackupJob(
            validatedData.data,
            validatedData.options
          );
          break;
        case QueueName.IMPORT:
          result = await queueManager.addImportJob(
            validatedData.data,
            validatedData.options
          );
          break;
        case QueueName.EXPORT:
          result = await queueManager.addExportJob(
            validatedData.data,
            validatedData.options
          );
          break;
        default:
          return NextResponse.json(
            { success: false, error: 'Invalid queue name' },
            { status: 400 }
          );
      }

      return NextResponse.json({
        success: true,
        job: result,
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { success: false, error: 'Invalid request data', details: error.errors },
          { status: 400 }
        );
      }

      console.error('Queue API error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to process queue operation' },
        { status: 500 }
      );
    }
  });
}

export async function PUT(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const body = await request.json();
      const validatedData = jobActionSchema.parse(body);

      let result;
      if (validatedData.action === 'cancel') {
        result = await queueManager.cancelJob(
          validatedData.queue,
          validatedData.jobId
        );
      } else if (validatedData.action === 'retry') {
        result = await queueManager.retryJob(
          validatedData.queue,
          validatedData.jobId
        );
      }

      if (!result) {
        return NextResponse.json(
          { success: false, error: 'Job not found or action failed' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Job ${validatedData.jobId} ${validatedData.action} successful`,
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { success: false, error: 'Invalid request data', details: error.errors },
          { status: 400 }
        );
      }

      console.error('Queue API error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to process job action' },
        { status: 500 }
      );
    }
  });
}

export async function DELETE(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const queue = searchParams.get('queue') as QueueName;
      const type = searchParams.get('type');

      if (!queue) {
        return NextResponse.json(
          { success: false, error: 'Queue name required' },
          { status: 400 }
        );
      }

      switch (type) {
        case 'completed':
          await queueManager.clearCompleted(queue);
          break;
        case 'failed':
          await queueManager.clearFailed(queue);
          break;
        case 'all':
          await queueManager.clearAll(queue);
          break;
        default:
          return NextResponse.json(
            { success: false, error: 'Invalid clear type' },
            { status: 400 }
          );
      }

      return NextResponse.json({
        success: true,
        message: `Queue ${queue} cleared (${type})`,
      });

    } catch (error) {
      console.error('Queue API error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to clear queue' },
        { status: 500 }
      );
    }
  });
}