import { createTRPCRouter } from './trpc';
import { authRouter } from './routers/auth';
import { tenantRouter } from './routers/tenant';
import { scheduleRouter } from './routers/schedule';
import { staffRouter } from './routers/staff';
import { swapRouter } from './routers/swap';
import { attendanceRouter } from './routers/attendance';
import { notificationRouter } from './routers/notification';
import { preferencesRouter } from './routers/preferences';
import { holidaysRouter } from './routers/holidays';
import { specialRequestsRouter } from './routers/special-requests';
import { configsRouter } from './routers/configs';
import { shiftTypesRouter } from './routers/shift-types';
import { handoffRouter } from './routers/handoff';
import { teamsRouter } from './routers/teams';
import { offBalanceRouter } from './routers/off-balance';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  tenant: tenantRouter,
  schedule: scheduleRouter,
  staff: staffRouter,
  swap: swapRouter,
  attendance: attendanceRouter,
  notification: notificationRouter,
  preferences: preferencesRouter,
  holidays: holidaysRouter,
  specialRequests: specialRequestsRouter,
  configs: configsRouter,
  shiftTypes: shiftTypesRouter,
  handoff: handoffRouter,
  teams: teamsRouter,
  offBalance: offBalanceRouter,
});

export type AppRouter = typeof appRouter;