import { createTRPCRouter } from './trpc';
import { authRouter } from './routers/auth';
import { tenantRouter } from './routers/tenant';
import { scheduleRouter } from './routers/schedule';
import { staffRouter } from './routers/staff';
import { swapRouter } from './routers/swap';
import { assignmentRouter } from './routers/assignment';
import { attendanceRouter } from './routers/attendance';
import { notificationRouter } from './routers/notification';
import { preferencesRouter } from './routers/preferences';
import { holidaysRouter } from './routers/holidays';
import { specialRequestsRouter } from './routers/special-requests';
import { tenantConfigsRouter } from './routers/tenant-configs';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  tenant: tenantRouter,
  schedule: scheduleRouter,
  staff: staffRouter,
  swap: swapRouter,
  assignment: assignmentRouter,
  attendance: attendanceRouter,
  notification: notificationRouter,
  preferences: preferencesRouter,
  holidays: holidaysRouter,
  specialRequests: specialRequestsRouter,
  tenantConfigs: tenantConfigsRouter,
});

export type AppRouter = typeof appRouter;