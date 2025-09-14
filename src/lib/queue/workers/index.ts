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

  // Email worker
  const emailQueue = QueueFactory.getQueue(QueueName.EMAIL);
  emailQueue.process(5, async (job: Job<EmailJobData>) => {
    return emailProcessor(job);
  });

  // Report worker
  const reportQueue = QueueFactory.getQueue(QueueName.REPORT);
  reportQueue.process(3, async (job: Job<ReportJobData>) => {
    return reportProcessor(job);
  });

  // Schedule worker
  const scheduleQueue = QueueFactory.getQueue(QueueName.SCHEDULE);
  scheduleQueue.process(2, async (job: Job<ScheduleJobData>) => {
    return scheduleProcessor(job);
  });

  // Notification worker
  const notificationQueue = QueueFactory.getQueue(QueueName.NOTIFICATION);
  notificationQueue.process(10, async (job: Job<NotificationJobData>) => {
    return notificationProcessor(job);
  });

  // Analytics worker
  const analyticsQueue = QueueFactory.getQueue(QueueName.ANALYTICS);
  analyticsQueue.process(3, async (job: Job<AnalyticsJobData>) => {
    return analyticsProcessor(job);
  });

  // Backup worker
  const backupQueue = QueueFactory.getQueue(QueueName.BACKUP);
  backupQueue.process(1, async (job: Job<BackupJobData>) => {
    return backupProcessor(job);
  });

  // Import worker
  const importQueue = QueueFactory.getQueue(QueueName.IMPORT);
  importQueue.process(2, async (job: Job<ImportJobData>) => {
    return importProcessor(job);
  });

  // Export worker
  const exportQueue = QueueFactory.getQueue(QueueName.EXPORT);
  exportQueue.process(3, async (job: Job<ExportJobData>) => {
    return exportProcessor(job);
  });

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