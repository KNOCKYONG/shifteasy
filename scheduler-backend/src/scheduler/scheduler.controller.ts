import { Body, Controller, Get, NotFoundException, Param, Post, BadRequestException } from '@nestjs/common';
import { SchedulerQueueService } from './scheduler.service';
import type { ScheduleJobRequestBody, SchedulerJob } from './dto/create-schedule-job.dto';

@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly queue: SchedulerQueueService) {}

  @Post('jobs')
  async createJob(@Body() body: ScheduleJobRequestBody) {
    this.validatePayload(body);
    const job = await this.queue.enqueueJob(body);
    return { jobId: job.id, status: job.status };
  }

  @Get('jobs/:id')
  async getJob(@Param('id') id: string) {
    const job = await this.queue.getJob(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return this.serializeJob(job);
  }

  private validatePayload(body: ScheduleJobRequestBody) {
    if (!body.departmentId) {
      throw new BadRequestException('departmentId is required');
    }
    if (!body.startDate || !body.endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    if (!Array.isArray(body.employees) || body.employees.length === 0) {
      throw new BadRequestException('At least one employee is required');
    }
    if (!Array.isArray(body.shifts) || body.shifts.length === 0) {
      throw new BadRequestException('At least one shift is required');
    }
  }

  private serializeJob(job: SchedulerJob) {
    return {
      id: job.id,
      status: job.status,
      result: job.result ?? null,
      error: job.error ?? null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}
