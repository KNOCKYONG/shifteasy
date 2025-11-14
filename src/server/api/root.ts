import { createTRPCRouter } from './trpc';
import { authRouter } from './routers/auth';
import { tenantRouter } from './routers/tenant';
import { scheduleRouter } from './routers/schedule';
import { staffRouter } from './routers/staff';
import { swapRouter } from './routers/swap';
import { preferencesRouter } from './routers/preferences';
import { holidaysRouter } from './routers/holidays';
import { specialRequestsRouter } from './routers/special-requests';
import { configsRouter } from './routers/configs';
import { shiftTypesRouter } from './routers/shift-types';
import { handoffRouter } from './routers/handoff';
import { teamsRouter } from './routers/teams';
import { offBalanceRouter } from './routers/off-balance';
import { paymentsRouter } from './routers/payments';
import { consultingRouter } from './routers/consulting';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  tenant: tenantRouter,
  schedule: scheduleRouter,
  staff: staffRouter,
  swap: swapRouter,
  preferences: preferencesRouter,
  holidays: holidaysRouter,
  specialRequests: specialRequestsRouter,
  configs: configsRouter,
  shiftTypes: shiftTypesRouter,
  handoff: handoffRouter,
  teams: teamsRouter,
  offBalance: offBalanceRouter,
  payments: paymentsRouter,
  consulting: consultingRouter,
});

export type AppRouter = typeof appRouter;