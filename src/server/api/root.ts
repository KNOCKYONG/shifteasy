import { createTRPCRouter } from '@/server/trpc';
import { authRouter } from './routers/auth';
import { scheduleRouter } from './routers/schedule';
import { staffRouter } from './routers/staff';
import { swapRouter } from './routers/swap';
import { assignmentRouter } from './routers/assignment';
import { attendanceRouter } from './routers/attendance';
import { notificationRouter } from './routers/notification';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  schedule: scheduleRouter,
  staff: staffRouter,
  swap: swapRouter,
  assignment: assignmentRouter,
  attendance: attendanceRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;