/**
 * Queue Workers - Job processors for all queue types
 */

import { Job, DoneCallback } from 'bull';
import {
  EmailJobData,
  ReportJobData,
  ScheduleJobData,
  NotificationJobData,
  AnalyticsJobData,
  BackupJobData,
  ImportJobData,
  ExportJobData,
  QueueFactory,
  QueueName,
} from '../bull-config';

// Import processors
import { emailProcessor } from './email-processor';
import { reportProcessor } from './report-processor';
import { scheduleProcessor } from './schedule-processor';
import { notificationProcessor } from './notification-processor';
import { analyticsProcessor } from './analytics-processor';
import { backupProcessor } from './backup-processor';
import { importProcessor } from './import-processor';
import { exportProcessor } from './export-processor';

/**
 * Initialize all workers
 */
export function initializeWorkers(): void {
  console.log('Initializing queue workers...');

  // Bull 큐가 비활성화된 경우 (프로덕션 또는 Redis 미설정)
  if (process.env.NODE_ENV === 'production' || !process.env.REDIS_HOST) {
    console.log('Queue workers disabled (no local Redis available)');
    return;
  }

  // Email worker
  const emailQueue = QueueFactory.getQueue(QueueName.EMAIL);
  if (emailQueue) {
    emailQueue.process(5, async (job: Job<EmailJobData>) => {
      return emailProcessor(job);
    });
  }

  // Report worker
  const reportQueue = QueueFactory.getQueue(QueueName.REPORT);
  if (reportQueue) {
    reportQueue.process(3, async (job: Job<ReportJobData>) => {
      return reportProcessor(job);
    });
  }

  // Schedule worker
  const scheduleQueue = QueueFactory.getQueue(QueueName.SCHEDULE);
  if (scheduleQueue) {
    scheduleQueue.process(2, async (job: Job<ScheduleJobData>) => {
      return scheduleProcessor(job);
    });
  }

  // Notification worker
  const notificationQueue = QueueFactory.getQueue(QueueName.NOTIFICATION);
  if (notificationQueue) {
    notificationQueue.process(10, async (job: Job<NotificationJobData>) => {
      return notificationProcessor(job);
    });
  }

  // Analytics worker
  const analyticsQueue = QueueFactory.getQueue(QueueName.ANALYTICS);
  if (analyticsQueue) {
    analyticsQueue.process(3, async (job: Job<AnalyticsJobData>) => {
      return analyticsProcessor(job);
    });
  }

  // Backup worker
  const backupQueue = QueueFactory.getQueue(QueueName.BACKUP);
  if (backupQueue) {
    backupQueue.process(1, async (job: Job<BackupJobData>) => {
      return backupProcessor(job);
    });
  }

  // Import worker
  const importQueue = QueueFactory.getQueue(QueueName.IMPORT);
  if (importQueue) {
    importQueue.process(2, async (job: Job<ImportJobData>) => {
      return importProcessor(job);
    });
  }

  // Export worker
  const exportQueue = QueueFactory.getQueue(QueueName.EXPORT);
  if (exportQueue) {
    exportQueue.process(3, async (job: Job<ExportJobData>) => {
      return exportProcessor(job);
    });
  }

  console.log('Queue workers initialized successfully');
}

/**
 * Shutdown all workers gracefully
 */
export async function shutdownWorkers(): Promise<void> {
  console.log('Shutting down queue workers...');
  await QueueFactory.closeAll();
  console.log('Queue workers shut down successfully');
}