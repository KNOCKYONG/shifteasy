/**
 * Bull Queue Configuration
 */

import Queue, { Job, Queue as BullQueue } from 'bull';

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true;
    }
    return false;
  },
};

// Queue configuration defaults
export const queueConfig = {
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500, // Keep last 500 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 2000,
    },
  },
  limiter: {
    max: 100, // Max number of jobs processed
    duration: 60000, // per minute
  },
};

// Queue names
export enum QueueName {
  EMAIL = 'email-queue',
  REPORT = 'report-queue',
  SCHEDULE = 'schedule-queue',
  NOTIFICATION = 'notification-queue',
  ANALYTICS = 'analytics-queue',
  BACKUP = 'backup-queue',
  IMPORT = 'import-queue',
  EXPORT = 'export-queue',
}

// Job priorities
export enum JobPriority {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4,
}

// Queue factory
export class QueueFactory {
  private static queues: Map<string, BullQueue> = new Map();
  private static isRedisAvailable: boolean = false;

  /**
   * Get or create a queue
   */
  static getQueue(name: QueueName): BullQueue {
    if (!this.queues.has(name)) {
      const queue = this.createQueue(name);
      this.queues.set(name, queue);
    }
    return this.queues.get(name)!;
  }

  /**
   * Create a new queue
   */
  private static createQueue(name: string): BullQueue {
    const queue = new Queue(name, {
      redis: redisConfig,
      defaultJobOptions: queueConfig.defaultJobOptions,
    });

    // Queue event handlers
    queue.on('error', (error) => {
      console.error(`Queue ${name} error:`, error);
      this.isRedisAvailable = false;
    });

    queue.on('ready', () => {
      console.log(`Queue ${name} is ready`);
      this.isRedisAvailable = true;
    });

    queue.on('stalled', (job) => {
      console.warn(`Job ${job.id} in queue ${name} has stalled`);
    });

    queue.on('completed', (job) => {
      console.log(`Job ${job.id} in queue ${name} completed`);
    });

    queue.on('failed', (job, err) => {
      console.error(`Job ${job.id} in queue ${name} failed:`, err);
    });

    return queue;
  }

  /**
   * Get all queues
   */
  static getAllQueues(): BullQueue[] {
    // Ensure all queues are created
    Object.values(QueueName).forEach(name => this.getQueue(name));
    return Array.from(this.queues.values());
  }

  /**
   * Close all queues
   */
  static async closeAll(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map(queue =>
      queue.close()
    );
    await Promise.all(closePromises);
    this.queues.clear();
  }

  /**
   * Pause all queues
   */
  static async pauseAll(): Promise<void> {
    const pausePromises = Array.from(this.queues.values()).map(queue =>
      queue.pause()
    );
    await Promise.all(pausePromises);
  }

  /**
   * Resume all queues
   */
  static async resumeAll(): Promise<void> {
    const resumePromises = Array.from(this.queues.values()).map(queue =>
      queue.resume()
    );
    await Promise.all(resumePromises);
  }

  /**
   * Get queue statistics
   */
  static async getStatistics(queueName: QueueName): Promise<any> {
    const queue = this.getQueue(queueName);

    const [
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
    ] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    return {
      name: queueName,
      counts: {
        waiting,
        active,
        completed,
        failed,
        delayed,
      },
      status: {
        paused,
        isRedisAvailable: this.isRedisAvailable,
      },
    };
  }

  /**
   * Check if Redis is available
   */
  static isAvailable(): boolean {
    return this.isRedisAvailable;
  }
}

// Job data types
export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  attachments?: any[];
}

export interface ReportJobData {
  tenantId: string;
  reportType: 'schedule' | 'kpi' | 'employee' | 'analytics';
  format: 'excel' | 'pdf';
  dateRange: {
    start: Date;
    end: Date;
  };
  options?: any;
}

export interface ScheduleJobData {
  tenantId: string;
  action: 'generate' | 'optimize' | 'validate';
  scheduleId?: string;
  month?: number;
  year?: number;
  constraints?: any;
}

export interface NotificationJobData {
  tenantId: string;
  type: 'push' | 'email' | 'sms' | 'in-app';
  recipients: string[];
  title: string;
  message: string;
  data?: any;
}

export interface AnalyticsJobData {
  tenantId: string;
  metric: string;
  aggregation: 'hourly' | 'daily' | 'weekly' | 'monthly';
  dateRange: {
    start: Date;
    end: Date;
  };
}

export interface BackupJobData {
  tenantId: string;
  backupType: 'full' | 'incremental' | 'differential';
  destination: 'local' | 's3' | 'gcs';
  compress?: boolean;
}

export interface ImportJobData {
  tenantId: string;
  fileUrl: string;
  type: 'employees' | 'schedule' | 'shifts';
  format: 'csv' | 'excel' | 'json';
  options?: {
    skipValidation?: boolean;
    overwrite?: boolean;
  };
}

export interface ExportJobData {
  tenantId: string;
  type: 'employees' | 'schedule' | 'shifts' | 'reports';
  format: 'csv' | 'excel' | 'json' | 'pdf';
  filters?: any;
}

// Export job type union
export type JobData =
  | EmailJobData
  | ReportJobData
  | ScheduleJobData
  | NotificationJobData
  | AnalyticsJobData
  | BackupJobData
  | ImportJobData
  | ExportJobData;