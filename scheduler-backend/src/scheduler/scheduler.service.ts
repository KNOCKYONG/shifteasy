import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { UpstashService } from '../upstash/upstash.service';
import type {
  ScheduleJobRequestBody,
  SchedulerJob,
  SchedulerJobResult,
} from './dto/create-schedule-job.dto';

const JOB_KEY_PREFIX = 'scheduler:job:';
const JOB_QUEUE_KEY = 'scheduler:job-queue';

@Injectable()
export class SchedulerQueueService {
  private readonly logger = new Logger(SchedulerQueueService.name);

  constructor(private readonly upstash: UpstashService) {}

  async enqueueJob(payload: ScheduleJobRequestBody): Promise<SchedulerJob> {
    const now = new Date().toISOString();
    const job: SchedulerJob = {
      id: randomUUID(),
      status: 'queued',
      payload,
      createdAt: now,
      updatedAt: now,
    };

    await this.upstash.redis.set(this.jobKey(job.id), job);
    await this.upstash.redis.rpush(JOB_QUEUE_KEY, job.id);
    this.logger.log(`Enqueued schedule job ${job.id} (${payload.departmentId})`);
    return job;
  }

  async getJob(jobId: string): Promise<SchedulerJob | null> {
    const job = await this.upstash.redis.get<SchedulerJob>(this.jobKey(jobId));
    return job ?? null;
  }

  async popNextQueuedJob(): Promise<SchedulerJob | null> {
    const jobId = await this.upstash.redis.lpop<string>(JOB_QUEUE_KEY);
    if (!jobId) {
      return null;
    }
    const job = await this.getJob(jobId);
    return job;
  }

  async updateJob(job: SchedulerJob): Promise<void> {
    job.updatedAt = new Date().toISOString();
    await this.upstash.redis.set(this.jobKey(job.id), job);
  }

  async markJobProcessing(job: SchedulerJob): Promise<SchedulerJob> {
    job.status = 'processing';
    await this.updateJob(job);
    return job;
  }

  async markJobCompleted(job: SchedulerJob, result: SchedulerJobResult): Promise<void> {
    job.status = 'completed';
    job.result = result;
    await this.updateJob(job);
    this.logger.log(`Completed job ${job.id}`);
  }

  async markJobFailed(job: SchedulerJob, error: Error): Promise<void> {
    job.status = 'failed';
    job.error = error.message;
    await this.updateJob(job);
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }

  private jobKey(id: string): string {
    return `${JOB_KEY_PREFIX}${id}`;
  }
}
