import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerQueueService } from './scheduler.service';
import { generateAiSchedule } from '@web/lib/scheduler/greedy-scheduler';
import { autoPolishWithAI } from '@web/lib/scheduler/ai-polish';
import type { AiScheduleRequest } from '@web/lib/scheduler/greedy-scheduler';
import type { SchedulerJob, SchedulerJobResult } from './dto/create-schedule-job.dto';

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
    const { payload } = job;

    const request: AiScheduleRequest = {
      departmentId: payload.departmentId,
      startDate: new Date(payload.startDate),
      endDate: new Date(payload.endDate),
      employees: payload.employees,
      shifts: payload.shifts,
      constraints: payload.constraints,
      specialRequests: payload.specialRequests,
      holidays: payload.holidays,
      teamPattern: payload.teamPattern,
      requiredStaffPerShift: payload.requiredStaffPerShift,
      nightIntensivePaidLeaveDays: payload.nightIntensivePaidLeaveDays,
      previousOffAccruals: payload.previousOffAccruals,
    };

    const aiResult = await generateAiSchedule(request);

    let finalAssignments = aiResult.assignments;
    let finalScore = aiResult.score;
    let aiPolishResult: SchedulerJobResult['aiPolishResult'] = null;

    if (payload.enableAI) {
      try {
        const polishResult = await autoPolishWithAI(aiResult, request);
        if (polishResult.improved) {
          finalAssignments = polishResult.assignments;
          finalScore = polishResult.score;
          aiPolishResult = {
            improved: true,
            beforeScore: aiResult.score.total,
            afterScore: polishResult.score.total,
            improvements: polishResult.improvements,
            polishTime: polishResult.polishTime,
          };
        }
      } catch (error) {
        this.logger.warn(`AI polish failed for job ${job.id}: ${error instanceof Error ? error.message : error}`);
      }
    }

    const serializedAssignments = finalAssignments.map((assignment) => ({
      ...assignment,
      date: assignment.date instanceof Date ? assignment.date.toISOString() : assignment.date,
    }));

    const jobResult: SchedulerJobResult = {
      assignments: serializedAssignments,
      generationResult: {
        iterations: aiResult.iterations,
        computationTime: aiResult.computationTime,
        violations: aiResult.violations,
        score: finalScore,
        offAccruals: aiResult.offAccruals,
        stats: aiResult.stats,
      },
      aiPolishResult,
    };

    await this.queue.markJobCompleted(job, jobResult);
  }
}
