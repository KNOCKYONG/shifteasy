import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerQueueService } from './scheduler.service';
import type { SchedulerJob } from './dto/create-schedule-job.dto';

@Injectable()
export class SchedulerWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerWorker.name);
  private interval: NodeJS.Timeout | null = null;
  private isBusy = false;

  constructor(private readonly queue: SchedulerQueueService) {}

  onModuleInit() {
    const intervalMs = Number(process.env.SCHEDULER_WORKER_POLL_INTERVAL ?? 1000);
    this.interval = setInterval(() => this.poll(), intervalMs);
    this.logger.log(`Scheduler worker started (interval ${intervalMs}ms)`);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  private async poll() {
    if (this.isBusy) {
      return;
    }

    const job = await this.queue.popNextQueuedJob();
    if (!job) {
      return;
    }

    this.isBusy = true;
    try {
      await this.queue.markJobProcessing(job);
      await this.processJob(job);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.queue.markJobFailed(job, err);
    } finally {
      this.isBusy = false;
    }
  }

  private async processJob(job: SchedulerJob): Promise<void> {
    const error = new Error('Legacy AI 스케줄 생성 기능이 비활성화되었습니다.');
    await this.queue.markJobFailed(job, error);
  }
}
