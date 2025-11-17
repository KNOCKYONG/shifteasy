import { Module } from '@nestjs/common';
import { SchedulerQueueService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { SchedulerWorker } from './scheduler.worker';

@Module({
  controllers: [SchedulerController],
  providers: [SchedulerQueueService, SchedulerWorker],
  exports: [SchedulerQueueService],
})
export class SchedulerModule {}
