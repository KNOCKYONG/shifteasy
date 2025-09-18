/**
 * Queue Manager - Central job queue management system
 */

import { Job, Queue } from 'bull';
import {
  QueueFactory,
  QueueName,
  JobPriority,
  JobData,
  EmailJobData,
  ReportJobData,
  ScheduleJobData,
  NotificationJobData,
  AnalyticsJobData,
  BackupJobData,
  ImportJobData,
  ExportJobData,
} from './bull-config';

export interface JobOptions {
  priority?: JobPriority;
  delay?: number; // milliseconds
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
  timeout?: number;
}

export interface JobResult {
  jobId: string;
  queueName: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress?: number;
  result?: any;
  error?: string;
}

export class QueueManager {
  private static instance: QueueManager;

  private constructor() {
    this.initializeQueues();
  }

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  /**
   * Initialize all queues
   */
  private initializeQueues(): void {
    // Pre-create all queues
    Object.values(QueueName).forEach(name => {
      QueueFactory.getQueue(name);
    });
  }

  /**
   * Add email job
   */
  async addEmailJob(
    data: EmailJobData,
    options?: JobOptions
  ): Promise<JobResult> {
    return this.addJob(QueueName.EMAIL, data, options);
  }

  /**
   * Add report generation job
   */
  async addReportJob(
    data: ReportJobData,
    options?: JobOptions
  ): Promise<JobResult> {
    return this.addJob(QueueName.REPORT, data, options);
  }

  /**
   * Add schedule processing job
   */
  async addScheduleJob(
    data: ScheduleJobData,
    options?: JobOptions
  ): Promise<JobResult> {
    return this.addJob(QueueName.SCHEDULE, data, options);
  }

  /**
   * Add notification job
   */
  async addNotificationJob(
    data: NotificationJobData,
    options?: JobOptions
  ): Promise<JobResult> {
    return this.addJob(QueueName.NOTIFICATION, data, options);
  }

  /**
   * Add analytics job
   */
  async addAnalyticsJob(
    data: AnalyticsJobData,
    options?: JobOptions
  ): Promise<JobResult> {
    return this.addJob(QueueName.ANALYTICS, data, options);
  }

  /**
   * Add backup job
   */
  async addBackupJob(
    data: BackupJobData,
    options?: JobOptions
  ): Promise<JobResult> {
    return this.addJob(QueueName.BACKUP, data, options);
  }

  /**
   * Add import job
   */
  async addImportJob(
    data: ImportJobData,
    options?: JobOptions
  ): Promise<JobResult> {
    return this.addJob(QueueName.IMPORT, data, options);
  }

  /**
   * Add export job
   */
  async addExportJob(
    data: ExportJobData,
    options?: JobOptions
  ): Promise<JobResult> {
    return this.addJob(QueueName.EXPORT, data, options);
  }

  /**
   * Generic job addition
   */
  private async addJob(
    queueName: QueueName,
    data: JobData,
    options?: JobOptions
  ): Promise<JobResult> {
    try {
      const queue = QueueFactory.getQueue(queueName);

      // Bull 큐가 비활성화된 경우 임시 응답 반환
      if (!queue) {
        return {
          jobId: `mock-${Date.now()}`,
          queueName,
          status: 'completed',
        };
      }

      const jobOptions: any = {
        priority: options?.priority || JobPriority.NORMAL,
        delay: options?.delay,
        attempts: options?.attempts || 3,
        backoff: options?.backoff || {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: options?.removeOnComplete ?? true,
        removeOnFail: options?.removeOnFail ?? false,
        timeout: options?.timeout,
      };

      const job = await queue.add(data, jobOptions);

      return {
        jobId: job.id.toString(),
        queueName,
        status: await this.getJobStatus(job),
      };
    } catch (error) {
      console.error(`Failed to add job to ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(
    queueName: QueueName,
    jobId: string
  ): Promise<JobResult | null> {
    try {
      const queue = QueueFactory.getQueue(queueName);

      // Bull 큐가 비활성화된 경우
      if (!queue) {
        return null;
      }

      const job = await queue.getJob(jobId);

      if (!job) {
        return null;
      }

      return {
        jobId: job.id.toString(),
        queueName,
        status: await this.getJobStatus(job),
        progress: job.progress(),
        result: job.returnvalue,
        error: job.failedReason,
      };
    } catch (error) {
      console.error(`Failed to get job ${jobId} from ${queueName}:`, error);
      return null;
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(
    queueName: QueueName,
    jobId: string
  ): Promise<boolean> {
    try {
      const queue = QueueFactory.getQueue(queueName);

      // Bull 큐가 비활성화된 경우
      if (!queue) {
        return false;
      }

      const job = await queue.getJob(jobId);

      if (!job) {
        return false;
      }

      await job.remove();
      return true;
    } catch (error) {
      console.error(`Failed to cancel job ${jobId} from ${queueName}:`, error);
      return false;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(
    queueName: QueueName,
    jobId: string
  ): Promise<boolean> {
    try {
      const queue = QueueFactory.getQueue(queueName);

      // Bull 큐가 비활성화된 경우
      if (!queue) {
        return false;
      }

      const job = await queue.getJob(jobId);

      if (!job) {
        return false;
      }

      await job.retry();
      return true;
    } catch (error) {
      console.error(`Failed to retry job ${jobId} from ${queueName}:`, error);
      return false;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStatistics(queueName: QueueName): Promise<any> {
    return QueueFactory.getStatistics(queueName);
  }

  /**
   * Get all queues statistics
   */
  async getAllQueueStatistics(): Promise<any[]> {
    const stats = await Promise.all(
      Object.values(QueueName).map(name =>
        this.getQueueStatistics(name)
      )
    );
    return stats;
  }

  /**
   * Clear completed jobs
   */
  async clearCompleted(queueName: QueueName): Promise<void> {
    const queue = QueueFactory.getQueue(queueName);
    if (!queue) return;
    await queue.clean(0, 'completed');
  }

  /**
   * Clear failed jobs
   */
  async clearFailed(queueName: QueueName): Promise<void> {
    const queue = QueueFactory.getQueue(queueName);
    if (!queue) return;
    await queue.clean(0, 'failed');
  }

  /**
   * Clear all jobs
   */
  async clearAll(queueName: QueueName): Promise<void> {
    const queue = QueueFactory.getQueue(queueName);
    if (!queue) return;
    await queue.empty();
  }

  /**
   * Pause queue
   */
  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = QueueFactory.getQueue(queueName);
    if (!queue) return;
    await queue.pause();
  }

  /**
   * Resume queue
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = QueueFactory.getQueue(queueName);
    if (!queue) return;
    await queue.resume();
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(
    queueName: QueueName,
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    limit: number = 100
  ): Promise<JobResult[]> {
    const queue = QueueFactory.getQueue(queueName);
    if (!queue) return [];

    let jobs: Job[] = [];

    switch (status) {
      case 'waiting':
        jobs = await queue.getWaiting(0, limit);
        break;
      case 'active':
        jobs = await queue.getActive(0, limit);
        break;
      case 'completed':
        jobs = await queue.getCompleted(0, limit);
        break;
      case 'failed':
        jobs = await queue.getFailed(0, limit);
        break;
      case 'delayed':
        jobs = await queue.getDelayed(0, limit);
        break;
    }

    return Promise.all(
      jobs.map(async (job) => ({
        jobId: job.id.toString(),
        queueName,
        status: await this.getJobStatus(job),
        progress: job.progress(),
        result: job.returnvalue,
        error: job.failedReason,
      }))
    );
  }

  /**
   * Get job status
   */
  private async getJobStatus(
    job: Job
  ): Promise<'waiting' | 'active' | 'completed' | 'failed' | 'delayed'> {
    const [
      isCompleted,
      isFailed,
      isDelayed,
      isActive,
      isWaiting,
    ] = await Promise.all([
      job.isCompleted(),
      job.isFailed(),
      job.isDelayed(),
      job.isActive(),
      job.isWaiting(),
    ]);

    if (isCompleted) return 'completed';
    if (isFailed) return 'failed';
    if (isDelayed) return 'delayed';
    if (isActive) return 'active';
    if (isWaiting) return 'waiting';

    return 'waiting'; // Default
  }

  /**
   * Schedule recurring job
   */
  async scheduleRecurringJob(
    queueName: QueueName,
    data: JobData,
    cron: string,
    options?: JobOptions
  ): Promise<void> {
    const queue = QueueFactory.getQueue(queueName);
    if (!queue) return;

    await queue.add(data, {
      repeat: { cron },
      ...options,
    });
  }

  /**
   * Remove recurring job
   */
  async removeRecurringJob(
    queueName: QueueName,
    repeatJobKey: string
  ): Promise<void> {
    const queue = QueueFactory.getQueue(queueName);
    if (!queue) return;
    await queue.removeRepeatable({ cron: repeatJobKey });
  }

  /**
   * Get recurring jobs
   */
  async getRecurringJobs(queueName: QueueName): Promise<any[]> {
    const queue = QueueFactory.getQueue(queueName);
    if (!queue) return [];
    return queue.getRepeatableJobs();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    isHealthy: boolean;
    redisConnected: boolean;
    queues: any[];
  }> {
    const queuesStats = await this.getAllQueueStatistics();
    const redisConnected = QueueFactory.isAvailable();

    return {
      isHealthy: redisConnected,
      redisConnected,
      queues: queuesStats,
    };
  }
}

export const queueManager = QueueManager.getInstance();