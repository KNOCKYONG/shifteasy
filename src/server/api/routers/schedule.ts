import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { scopedDb, createAuditLog } from '@/lib/db-helpers';
import { schedules, users, departments, offBalanceLedger, holidays, specialRequests, teams, swapRequests } from '@/db/schema';
import { eq, and, gte, lte, desc, inArray, isNull, ne, or } from 'drizzle-orm';
import { db } from '@/db';
import { ScheduleImprover } from '@/lib/scheduler/schedule-improver';
import type { Assignment, Employee as ImprovementEmployee, ScheduleConstraints } from '@/lib/scheduler/types';
import type {
  ScheduleAssignment,
  ConstraintViolation,
  ScheduleScore,
  OffAccrualSummary,
  PostprocessStats,
  GenerationDiagnostics,
} from '@/lib/types/scheduler';
import { sse } from '@/lib/sse/broadcaster';
import { notificationService } from '@/lib/notifications/notification-service';
import { format, subMonths } from 'date-fns';
import { getShiftTypes } from '@/lib/config/shiftTypes';
import { loadCareerGroups, loadYearsOfServiceMap } from '../utils/milp-data-loader';
import { serializeMilpCspInput } from '@/lib/scheduler/milp-csp/serializer';
import type { MilpCspScheduleInput, MilpCspSolverOptions } from '@/lib/scheduler/milp-csp/types';
import { DEFAULT_SCHEDULER_ADVANCED } from '@/lib/config/schedulerAdvanced';

const constraintWeightsSchema = z.object({
  staffing: z.number().min(0).max(10).default(1),
  teamBalance: z.number().min(0).max(10).default(1),
  careerBalance: z.number().min(0).max(10).default(1),
  offBalance: z.number().min(0).max(10).default(1),
  shiftPattern: z.number().min(0).max(10).default(1),
  dailyBalance: z.number().min(0).max(10).default(1),
});

const cspSettingsSchema = z.object({
  maxIterations: z.number().int().min(50).max(2000).default(400),
  tabuSize: z.number().int().min(0).max(256).default(32),
  timeLimitMs: z.number().int().min(500).max(20000).default(4000),
  maxSameShift: z.number().int().min(1).max(5).default(2),
  offTolerance: z.number().int().min(0).max(5).default(2),
  shiftBalanceTolerance: z.number().int().min(1).max(10).default(4),
  annealing: z.object({
    temperature: z.number().min(0).max(20).default(5),
    coolingRate: z.number().min(0.5).max(0.99).default(0.92),
  }).optional(),
});

const multiRunSchema = z.object({
  attempts: z.number().int().min(1).max(10).default(1),
  weightJitterPct: z.number().min(0).max(30).default(0),
  seed: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
});

const patternConstraintsSchema = z.object({
  maxConsecutiveDaysThreeShift: z
    .number()
    .int()
    .min(3)
    .max(7)
    .default(DEFAULT_SCHEDULER_ADVANCED.patternConstraints.maxConsecutiveDaysThreeShift),
});

const dailyStaffingBalanceSchema = z.object({
  enabled: z.boolean().optional(),
  targetMode: z.enum(['auto', 'manual']).optional(),
  targetValue: z.number().min(0).max(500).nullable().optional(),
  tolerance: z.number().min(0).max(20).default(DEFAULT_SCHEDULER_ADVANCED.dailyStaffingBalance.tolerance),
  weight: z.number().min(0).max(10).default(DEFAULT_SCHEDULER_ADVANCED.dailyStaffingBalance.weight),
  weekendScale: z.number().min(0.1).max(3).default(DEFAULT_SCHEDULER_ADVANCED.dailyStaffingBalance.weekendScale),
});

const schedulerAdvancedSchema = z.object({
  useMilpEngine: z.boolean().optional(),
  solverPreference: z.enum(['ortools', 'cpsat', 'hybrid']).optional(),
  constraintWeights: constraintWeightsSchema.partial().optional(),
  cspSettings: cspSettingsSchema.partial().optional(),
  multiRun: multiRunSchema.partial().optional(),
  patternConstraints: patternConstraintsSchema.partial().optional(),
  dailyStaffingBalance: dailyStaffingBalanceSchema.partial().optional(),
});

const mapAdvancedSettingsToSolverOptions = (
  advanced?: z.infer<typeof schedulerAdvancedSchema>
): MilpCspSolverOptions | undefined => {
  if (!advanced) {
    return undefined;
  }
  const options: MilpCspSolverOptions = {};
  if (advanced.constraintWeights) {
    options.constraintWeights = {
      staffing: advanced.constraintWeights.staffing,
      teamBalance: advanced.constraintWeights.teamBalance,
      careerBalance: advanced.constraintWeights.careerBalance,
      offBalance: advanced.constraintWeights.offBalance,
      shiftPattern: advanced.constraintWeights.shiftPattern,
      dailyBalance: advanced.constraintWeights.dailyBalance,
    };
  }
  if (advanced.cspSettings) {
    options.cspSettings = {
      ...advanced.cspSettings,
      annealing: advanced.cspSettings.annealing,
    };
  }
  if (advanced.patternConstraints) {
    options.patternConstraints = {
      maxConsecutiveDaysThreeShift: advanced.patternConstraints.maxConsecutiveDaysThreeShift,
    };
  }
  if (advanced.dailyStaffingBalance) {
    options.dailyStaffingBalance = {
      enabled: advanced.dailyStaffingBalance.enabled,
      targetMode: advanced.dailyStaffingBalance.targetMode,
      targetValue: advanced.dailyStaffingBalance.targetValue,
      tolerance: advanced.dailyStaffingBalance.tolerance,
      weight: advanced.dailyStaffingBalance.weight,
      weekendScale: advanced.dailyStaffingBalance.weekendScale,
    };
  }
  if (advanced.multiRun) {
    options.multiRun = {
      attempts: advanced.multiRun.attempts,
      weightJitterPct: advanced.multiRun.weightJitterPct,
      seed: advanced.multiRun.seed,
    };
  }
  return options;
};

type SchedulerJobError = Error & {
  diagnostics?: GenerationDiagnostics | Record<string, unknown>;
  partialResult?: SchedulerBackendResult;
};

export const scheduleGenerationInputSchema = z.object({
  name: z.string().default('AI Generated Schedule'),
  departmentId: z.string().min(1),
  startDate: z.date(),
  endDate: z.date(),
  employees: z.array(z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    departmentId: z.string().optional(),
    teamId: z.string().nullable().optional(),
    workPatternType: z.enum(['three-shift', 'night-intensive', 'weekday-only']).optional(),
    preferredShiftTypes: z.record(z.string(), z.number()).optional(),
    maxConsecutiveDaysPreferred: z.number().optional(),
    maxConsecutiveNightsPreferred: z.number().optional(),
    guaranteedOffDays: z.number().optional(),
  })),
  shifts: z.array(z.object({
    id: z.string(),
    code: z.string().optional(),
    type: z.enum(['day', 'evening', 'night', 'off', 'leave', 'custom']),
    name: z.string(),
    time: z.object({
      start: z.string(),
      end: z.string(),
      hours: z.number(),
      breakMinutes: z.number().optional(),
    }),
    color: z.string(),
    requiredStaff: z.number().min(0).default(1),
    minStaff: z.number().optional(),
    maxStaff: z.number().optional(),
  })),
  constraints: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['hard', 'soft']),
    category: z.enum(['legal', 'contractual', 'operational', 'preference', 'fairness']),
    weight: z.number(),
    active: z.boolean(),
    config: z.record(z.string(), z.any()).optional(),
  })).default([]),
  specialRequests: z.array(z.object({
    employeeId: z.string(),
    date: z.string(),
    requestType: z.string(),
    shiftTypeCode: z.string().optional(),
  })).default([]),
  holidays: z.array(z.object({
    date: z.string(),
    name: z.string(),
  })).default([]),
  teamPattern: z.object({
    pattern: z.array(z.string()),
    avoidPatterns: z.array(z.array(z.string())).optional(),
  }).nullable().optional(),
  requiredStaffPerShift: z.record(z.string(), z.number()).optional(),
  optimizationGoal: z.enum(['fairness', 'preference', 'coverage', 'cost', 'balanced']).default('balanced'),
  nightIntensivePaidLeaveDays: z.number().optional(),
  enableAI: z.boolean().default(false),
  useMilpEngine: z.boolean().default(false),
  schedulerAdvanced: schedulerAdvancedSchema.optional(),
});

type ScheduleGenerationInput = z.infer<typeof scheduleGenerationInputSchema>;

type BackendScheduleAssignment = Omit<ScheduleAssignment, 'date'> & { date: string };

interface SchedulerBackendResult {
  assignments: BackendScheduleAssignment[];
  generationResult: {
    iterations: number;
    computationTime: number;
    solveStatus?: string | null;
    solverTimedOut?: boolean;
    violations: ConstraintViolation[];
    score: ScheduleScore;
    offAccruals: OffAccrualSummary[];
    stats: {
      fairnessIndex: number;
      coverageRate: number;
      preferenceScore: number;
    };
    postprocess?: PostprocessStats;
    diagnostics?: {
      staffingShortages?: Array<{
        date: string;
        shiftType: string;
        required: number;
        covered: number;
        shortage: number;
      }>;
      teamCoverageGaps?: Array<{
        date: string;
        shiftType: string;
        teamId: string;
        shortage: number;
      }>;
      careerGroupCoverageGaps?: Array<{
        date: string;
        shiftType: string;
        careerGroupAlias: string;
        shortage: number;
      }>;
      teamWorkloadGaps?: Array<{
        teamA: string;
        teamB: string;
        difference: number;
        tolerance: number;
      }>;
      offBalanceGaps?: Array<{
        teamId: string;
        employeeA: string;
        employeeB: string;
        difference: number;
        tolerance: number;
      }>;
      shiftPatternBreaks?: Array<{
        employeeId: string;
        shiftType: string;
        startDate: string;
        window: number;
        excess: number;
      }>;
      specialRequestMisses?: Array<{
        employeeId: string;
        date: string;
        shiftType: string;
      }>;
      dailyHeadcountGaps?: Array<{
        date: string;
        target: number;
        tolerance: number;
        actual: number;
        over?: number;
        under?: number;
      }>;
      avoidPatternViolations?: Array<{
        employeeId: string;
        startDate: string;
        pattern: string[];
      }>;
      preflightIssues?: Array<Record<string, unknown>>;
      postprocess?: PostprocessStats;
    };
  };
  aiPolishResult: {
    improved: boolean;
    beforeScore: number;
    afterScore: number;
    improvements: {
      type: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
      confidence: number;
    }[];
    polishTime: number;
  } | null;
}

interface SchedulerBackendJobStatusResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'timedout' | 'cancelled';
  result?: SchedulerBackendResult | null;
  bestResult?: SchedulerBackendResult | null;
  error?: string | null;
  errorDiagnostics?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

type SchedulerBackendPayload = Omit<ScheduleGenerationInput, 'startDate' | 'endDate'> & {
  startDate: string;
  endDate: string;
  previousOffAccruals: Record<string, number>;
  milpInput?: MilpCspScheduleInput;
  schedulerAdvanced?: z.infer<typeof schedulerAdvancedSchema>;
  solver?: 'ortools' | 'cpsat' | 'hybrid';
};

const DEFAULT_JOB_TIMEOUT_MS = Number(process.env.SCHEDULER_JOB_TIMEOUT_MS ?? 600000);
const DEFAULT_JOB_POLL_INTERVAL_MS = Number(process.env.SCHEDULER_JOB_POLL_INTERVAL_MS ?? 2000);
const DEFAULT_MAX_CONSECUTIVE_DAYS_THREE_SHIFT =
  DEFAULT_SCHEDULER_ADVANCED.patternConstraints.maxConsecutiveDaysThreeShift;
const DEFAULT_REMOTE_MILP_BACKEND_URL =
  process.env.MILP_SCHEDULER_DEFAULT_URL ??
  (process.env.NODE_ENV === 'production' ? 'https://shifteasy-milp-worker.fly.dev' : undefined);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSchedulerBackendCandidates(useMilpBackend?: boolean): string[] {
  const candidates: string[] = [];
  const localUrl =
    process.env.MILP_SCHEDULER_LOCAL_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:4000' : undefined);
  const milpBackendUrl =
    process.env.MILP_SCHEDULER_BACKEND_URL ?? process.env.NEXT_PUBLIC_MILP_SCHEDULER_BACKEND_URL;
  if (useMilpBackend) {
    if (localUrl) {
      candidates.push(localUrl);
    }
    if (milpBackendUrl) {
      candidates.push(milpBackendUrl);
    }
    if (process.env.SCHEDULER_BACKEND_URL) {
      candidates.push(process.env.SCHEDULER_BACKEND_URL);
    }
    if (DEFAULT_REMOTE_MILP_BACKEND_URL) {
      candidates.push(DEFAULT_REMOTE_MILP_BACKEND_URL);
    }
  } else if (process.env.SCHEDULER_BACKEND_URL) {
    candidates.push(process.env.SCHEDULER_BACKEND_URL);
  }
  return [...new Set(candidates.filter(Boolean))];
}

async function runSchedulerJob(baseUrl: string, payload: SchedulerBackendPayload): Promise<SchedulerBackendResult> {
  const enqueueResponse = await fetch(`${baseUrl}/scheduler/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!enqueueResponse.ok) {
    const message = await enqueueResponse.text();
    throw new Error(`Failed to enqueue schedule job: ${enqueueResponse.status} ${message}`);
  }

  const enqueueBody = await parseJsonSafe(enqueueResponse);
  const jobId = enqueueBody?.jobId;
  if (!jobId || typeof jobId !== 'string') {
    throw new Error(`Failed to enqueue schedule job: invalid response body (${JSON.stringify(enqueueBody)})`);
  }
  const timeoutAt = Date.now() + DEFAULT_JOB_TIMEOUT_MS;

  while (Date.now() < timeoutAt) {
    const statusResponse = await fetch(`${baseUrl}/scheduler/jobs/${jobId}`);
    if (!statusResponse.ok) {
      throw new Error(`Failed to fetch job status (${statusResponse.status})`);
    }

    const jobStatus = (await parseJsonSafe(statusResponse)) as SchedulerBackendJobStatusResponse;
    if (jobStatus.status === 'completed' && jobStatus.result) {
      return jobStatus.result;
    }
    if (['failed', 'timedout', 'cancelled'].includes(jobStatus.status)) {
      const err: SchedulerJobError = new Error(
        jobStatus.error ?? `Scheduler job ${jobStatus.status}`
      );
      if (jobStatus.errorDiagnostics) {
        err.diagnostics = jobStatus.errorDiagnostics as GenerationDiagnostics;
      }
      const partialResult = jobStatus.result ?? jobStatus.bestResult;
      if (partialResult) {
        (err as SchedulerJobError & { partialResult?: SchedulerBackendResult }).partialResult = partialResult;
      }
      throw err;
    }

    await sleep(DEFAULT_JOB_POLL_INTERVAL_MS);
  }

  throw new Error('Scheduler backend timeout');
}

async function enqueueSchedulerJob(baseUrl: string, payload: SchedulerBackendPayload): Promise<{ jobId: string }> {
  const enqueueResponse = await fetch(`${baseUrl}/scheduler/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!enqueueResponse.ok) {
    const message = await enqueueResponse.text();
    throw new Error(`Failed to enqueue schedule job: ${enqueueResponse.status} ${message}`);
  }

  const enqueueBody = await parseJsonSafe(enqueueResponse);
  const jobId = enqueueBody?.jobId;
  if (!jobId || typeof jobId !== 'string') {
    throw new Error(`Failed to enqueue schedule job: invalid response body (${JSON.stringify(enqueueBody)})`);
  }
  return { jobId };
}

async function fetchSchedulerJobStatus(baseUrl: string, jobId: string): Promise<SchedulerBackendJobStatusResponse> {
  const statusResponse = await fetch(`${baseUrl}/scheduler/jobs/${jobId}`);
  if (!statusResponse.ok) {
    const message = await statusResponse.text();
    throw new Error(`Failed to fetch job status (${statusResponse.status} ${message})`);
  }
  const jobStatus = (await parseJsonSafe(statusResponse)) as SchedulerBackendJobStatusResponse;
  return jobStatus;
}

async function cancelSchedulerJob(baseUrl: string, jobId: string): Promise<SchedulerBackendJobStatusResponse> {
  const cancelResponse = await fetch(`${baseUrl}/scheduler/jobs/${jobId}/cancel`, {
    method: 'POST',
  });
  if (!cancelResponse.ok) {
    const message = await cancelResponse.text();
    throw new Error(`Failed to cancel job (${cancelResponse.status} ${message})`);
  }
  const jobStatus = (await parseJsonSafe(cancelResponse)) as SchedulerBackendJobStatusResponse;
  return jobStatus;
}

async function parseJsonSafe(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Failed to parse JSON response: ${response.status} ${text}`);
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Unexpected response (${response.status}): ${text?.slice(0, 500) || '[empty]'}`);
  }
}

async function requestScheduleGenerationFromBackend(
  payload: SchedulerBackendPayload,
  options?: { useMilpBackend?: boolean }
): Promise<SchedulerBackendResult> {
  const candidates = buildSchedulerBackendCandidates(options?.useMilpBackend);
  if (candidates.length === 0) {
    throw new Error(
      options?.useMilpBackend
        ? 'No MILP scheduler backend URL configured'
        : 'SCHEDULER_BACKEND_URL is not configured'
    );
  }

  const errors: { url: string; message: string }[] = [];
  for (const url of candidates) {
    try {
      return await runSchedulerJob(url, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ url, message });
      console.warn(`[Scheduler] Backend ${url} failed, trying next candidate`, { message });
    }
  }

  const aggregated = errors.map(({ url, message }) => `${url}: ${message}`).join(' | ');
  throw new Error(`All scheduler backends failed. Details: ${aggregated}`);
}

export const scheduleRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      departmentId: z.string().optional(),
      status: z.enum(['draft', 'published', 'archived']).optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      limit: z.number().default(10),
      offset: z.number().default(0),
      includeMetadata: z.boolean().default(false), // Default false for performance
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const conditions = [
        eq(schedules.tenantId, tenantId),
        // Filter out soft-deleted schedules (deletedFlag != 'X' or null)
        or(
          isNull(schedules.deletedFlag),
          ne(schedules.deletedFlag, 'X')
        ),
      ];

      if (ctx.user?.role === 'member') {
        if (!ctx.user.departmentId) {
          return [];
        }
        conditions.push(eq(schedules.departmentId, ctx.user.departmentId));
        // Members can only see published schedules (not draft or archived)
        conditions.push(eq(schedules.status, 'published'));
      } else if (input.departmentId) {
        conditions.push(eq(schedules.departmentId, input.departmentId));
      }

      // Only apply status filter for non-members (admin/manager can filter by any status)
      if (input.status && ctx.user?.role !== 'member') {
        conditions.push(eq(schedules.status, input.status));
      }
      if (input.startDate) {
        conditions.push(gte(schedules.startDate, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(schedules.endDate, input.endDate));
      }

      // Conditional metadata inclusion based on includeMetadata flag
      const scheduleResults = input.includeMetadata
        ? await db
            .select()
            .from(schedules)
            .where(and(...conditions))
            .orderBy(desc(schedules.createdAt))
            .limit(input.limit)
            .offset(input.offset)
        : await db
            .select({
              id: schedules.id,
              tenantId: schedules.tenantId,
              departmentId: schedules.departmentId,
              startDate: schedules.startDate,
              endDate: schedules.endDate,
              status: schedules.status,
              version: schedules.version,
              publishedAt: schedules.publishedAt,
              publishedBy: schedules.publishedBy,
              deletedFlag: schedules.deletedFlag,
              createdAt: schedules.createdAt,
              updatedAt: schedules.updatedAt,
              metadata: schedules.metadata, // Include metadata but it will be null for list queries
            })
            .from(schedules)
            .where(and(...conditions))
            .orderBy(desc(schedules.createdAt))
            .limit(input.limit)
            .offset(input.offset);

      // Get unique department IDs
      const deptIds = [...new Set(scheduleResults.map(s => s.departmentId).filter(Boolean))] as string[];

      // Fetch department information separately
      const depts = deptIds.length > 0
        ? await db
            .select()
            .from(departments)
            .where(and(
              eq(departments.tenantId, tenantId),
              inArray(departments.id, deptIds)
            ))
        : [];

      // Create department map
      const deptMap = new Map(depts.map(d => [d.id, d]));

      // Combine results
      return scheduleResults.map(schedule => ({
        ...schedule,
        department: schedule.departmentId && deptMap.has(schedule.departmentId)
          ? {
              id: deptMap.get(schedule.departmentId)!.id,
              name: deptMap.get(schedule.departmentId)!.name,
              code: deptMap.get(schedule.departmentId)!.code,
            }
          : null,
      }));
    }),

  get: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const [schedule] = await db
        .select()
        .from(schedules)
        .where(and(
          eq(schedules.id, input.id),
          eq(schedules.tenantId, tenantId),
          // Filter out soft-deleted schedules (deletedFlag != 'X' or null)
          or(
            isNull(schedules.deletedFlag),
            ne(schedules.deletedFlag, 'X')
          )
        ));

      if (!schedule) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found' });
      }

      if (ctx.user?.role === 'member') {
        if (!ctx.user.departmentId || schedule.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '본인 부서의 스케줄만 조회할 수 있습니다.',
          });
        }
        // Members can only see published schedules
        if (schedule.status !== 'published') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '확정된 스케줄만 조회할 수 있습니다.',
          });
        }
      }

      return schedule;
    }),

  generateAsync: protectedProcedure
    .input(scheduleGenerationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      if (!input.employees.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '스케줄을 생성할 직원이 없습니다.',
        });
      }

      if (ctx.user?.role === 'manager') {
        if (!ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '부서 정보가 없습니다.',
          });
        }
        if (input.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '담당 부서의 스케줄만 생성할 수 있습니다.',
          });
        }
      } else if (ctx.user?.role === 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '스케줄을 생성할 권한이 없습니다. 관리자 또는 매니저에게 문의하세요.',
        });
      }

      const previousMonthDate = subMonths(input.startDate, 1);
      const previousYear = previousMonthDate.getFullYear();
      const previousMonth = previousMonthDate.getMonth() + 1;

      const previousLedgerRows = await db
        .select({
          nurseId: offBalanceLedger.nurseId,
          accumulatedOffDays: offBalanceLedger.accumulatedOffDays,
          guaranteedOffDays: offBalanceLedger.guaranteedOffDays,
        })
        .from(offBalanceLedger)
        .where(and(
          eq(offBalanceLedger.tenantId, tenantId),
          eq(offBalanceLedger.departmentId, input.departmentId),
          eq(offBalanceLedger.year, previousYear),
          eq(offBalanceLedger.month, previousMonth),
        ));

      const previousOffAccruals: Record<string, number> = {};
      const previousGuaranteedOffDays: Record<string, number> = {};
      previousLedgerRows.forEach((row) => {
        if (row.nurseId) {
          previousOffAccruals[row.nurseId] = Math.max(0, row.accumulatedOffDays || 0);
          if (typeof row.guaranteedOffDays === 'number') {
            previousGuaranteedOffDays[row.nurseId] = row.guaranteedOffDays;
          }
        }
      });

      const employeesWithGuarantees = input.employees.map((emp) => ({
        ...emp,
        guaranteedOffDays: emp.guaranteedOffDays ?? previousGuaranteedOffDays[emp.id],
      }));

      const schedulerAdvanced = input.schedulerAdvanced;
      const patternConstraints = schedulerAdvanced?.patternConstraints;
      const maxConsecutiveThreeShift =
        patternConstraints?.maxConsecutiveDaysThreeShift ?? DEFAULT_MAX_CONSECUTIVE_DAYS_THREE_SHIFT;

      const schedulerEmployees = employeesWithGuarantees.map((emp) => {
        const workPattern = emp.workPatternType ?? 'three-shift';
        if (workPattern === 'three-shift') {
          return {
            ...emp,
            maxConsecutiveDaysPreferred: maxConsecutiveThreeShift,
          };
        }
        return emp;
      });

      const employeeIds = schedulerEmployees.map((emp) => emp.id);
      const [careerGroups, yearsOfServiceMap] = await Promise.all([
        loadCareerGroups(tenantId, input.departmentId),
        loadYearsOfServiceMap(tenantId, employeeIds),
      ]);
      const solverOptions = mapAdvancedSettingsToSolverOptions(schedulerAdvanced);

      const milpInput: MilpCspScheduleInput | undefined = serializeMilpCspInput(
        {
          departmentId: input.departmentId,
          startDate: input.startDate,
          endDate: input.endDate,
          employees: schedulerEmployees,
          shifts: input.shifts,
          constraints: input.constraints,
          specialRequests: input.specialRequests,
          holidays: input.holidays,
          teamPattern: input.teamPattern ?? null,
          requiredStaffPerShift: input.requiredStaffPerShift,
          nightIntensivePaidLeaveDays: input.nightIntensivePaidLeaveDays,
        },
        {
          previousOffAccruals,
          careerGroups,
          yearsOfServiceMap,
          solverOptions,
        }
      );

      const basePayload = {
        name: input.name,
        departmentId: input.departmentId,
        startDate: input.startDate.toISOString(),
        endDate: input.endDate.toISOString(),
        employees: schedulerEmployees,
        shifts: input.shifts,
        constraints: input.constraints,
        specialRequests: input.specialRequests,
        holidays: input.holidays,
        teamPattern: input.teamPattern ?? null,
        requiredStaffPerShift: input.requiredStaffPerShift,
        optimizationGoal: input.optimizationGoal,
        nightIntensivePaidLeaveDays: input.nightIntensivePaidLeaveDays,
        previousOffAccruals,
        milpInput,
      };

      const defaultSchedulerPayload: SchedulerBackendPayload = {
        ...basePayload,
        enableAI: input.enableAI,
        useMilpEngine: false,
      };

      let milpSchedulerPayload: SchedulerBackendPayload | undefined;
      if (input.useMilpEngine) {
        milpSchedulerPayload = {
          ...basePayload,
          enableAI: false,
          useMilpEngine: true,
          milpInput,
          schedulerAdvanced,
          solver: schedulerAdvanced?.solverPreference ?? 'ortools',
        };
      }

      const errors: { url: string; message: string }[] = [];
      if (milpSchedulerPayload) {
        const candidates = buildSchedulerBackendCandidates(true);
        for (const url of candidates) {
          try {
            const { jobId } = await enqueueSchedulerJob(url, milpSchedulerPayload);
            return { jobId, backendUrl: url, useMilpEngine: true };
          } catch (error) {
            errors.push({ url, message: error instanceof Error ? error.message : String(error) });
          }
        }
      }

      const defaultCandidates = buildSchedulerBackendCandidates(false);
      for (const url of defaultCandidates) {
        try {
          const { jobId } = await enqueueSchedulerJob(url, defaultSchedulerPayload);
          return { jobId, backendUrl: url, useMilpEngine: false };
        } catch (error) {
          errors.push({ url, message: error instanceof Error ? error.message : String(error) });
        }
      }

      const aggregated = errors.map(({ url, message }) => `${url}: ${message}`).join(' | ');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `스케줄 작업 등록에 실패했습니다. ${aggregated}`,
      });
    }),


  generate: protectedProcedure
    .input(scheduleGenerationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const tenantDb = scopedDb(tenantId);
      const prepareContext = async () => {
        const previousMonthDate = subMonths(input.startDate, 1);
        const previousYear = previousMonthDate.getFullYear();
        const previousMonth = previousMonthDate.getMonth() + 1;

        const previousLedgerRows = await db
          .select({
            nurseId: offBalanceLedger.nurseId,
            accumulatedOffDays: offBalanceLedger.accumulatedOffDays,
            guaranteedOffDays: offBalanceLedger.guaranteedOffDays,
          })
          .from(offBalanceLedger)
          .where(and(
            eq(offBalanceLedger.tenantId, tenantId),
            eq(offBalanceLedger.departmentId, input.departmentId),
            eq(offBalanceLedger.year, previousYear),
            eq(offBalanceLedger.month, previousMonth),
          ));

        const previousOffAccruals: Record<string, number> = {};
        const previousGuaranteedOffDays: Record<string, number> = {};
        previousLedgerRows.forEach((row) => {
          if (row.nurseId) {
            previousOffAccruals[row.nurseId] = Math.max(0, row.accumulatedOffDays || 0);
            if (typeof row.guaranteedOffDays === 'number') {
              previousGuaranteedOffDays[row.nurseId] = row.guaranteedOffDays;
            }
          }
        });

        const employeesWithGuarantees = input.employees.map((emp) => ({
          ...emp,
          guaranteedOffDays: emp.guaranteedOffDays ?? previousGuaranteedOffDays[emp.id],
        }));

        const schedulerAdvanced = input.schedulerAdvanced;
        const patternConstraints = schedulerAdvanced?.patternConstraints;
        const maxConsecutiveThreeShift =
          patternConstraints?.maxConsecutiveDaysThreeShift ?? DEFAULT_MAX_CONSECUTIVE_DAYS_THREE_SHIFT;

        const schedulerEmployees = employeesWithGuarantees.map((emp) => {
          const workPattern = emp.workPatternType ?? 'three-shift';
          if (workPattern === 'three-shift') {
            return {
              ...emp,
              maxConsecutiveDaysPreferred: maxConsecutiveThreeShift,
            };
          }
          return emp;
        });

        const employeeIds = schedulerEmployees.map((emp) => emp.id);
        const [careerGroups, yearsOfServiceMap] = await Promise.all([
          loadCareerGroups(tenantId, input.departmentId),
          loadYearsOfServiceMap(tenantId, employeeIds),
        ]);
        const solverOptions = mapAdvancedSettingsToSolverOptions(schedulerAdvanced);

        const milpInput: MilpCspScheduleInput | undefined = serializeMilpCspInput(
          {
            departmentId: input.departmentId,
            startDate: input.startDate,
            endDate: input.endDate,
            employees: schedulerEmployees,
            shifts: input.shifts,
            constraints: input.constraints,
            specialRequests: input.specialRequests,
            holidays: input.holidays,
            teamPattern: input.teamPattern ?? null,
            requiredStaffPerShift: input.requiredStaffPerShift,
            nightIntensivePaidLeaveDays: input.nightIntensivePaidLeaveDays,
          },
          {
            previousOffAccruals,
            careerGroups,
            yearsOfServiceMap,
            solverOptions,
          }
        );

        const basePayload = {
          name: input.name,
          departmentId: input.departmentId,
          startDate: input.startDate.toISOString(),
          endDate: input.endDate.toISOString(),
          employees: schedulerEmployees,
          shifts: input.shifts,
          constraints: input.constraints,
          specialRequests: input.specialRequests,
          holidays: input.holidays,
          teamPattern: input.teamPattern ?? null,
          requiredStaffPerShift: input.requiredStaffPerShift,
          optimizationGoal: input.optimizationGoal,
          nightIntensivePaidLeaveDays: input.nightIntensivePaidLeaveDays,
          previousOffAccruals,
          milpInput,
        };

        return {
          previousOffAccruals,
          schedulerAdvanced,
          schedulerEmployees,
          tenantDb,
          solverOptions,
          basePayload,
          milpInput,
        };
      };

      const persistSchedule = async ({
        assignments,
        generationResult,
        aiPolishResult,
        generationDiagnostics,
        generationPostprocess,
        generationMethod,
        aiEnabled,
        schedulerAdvanced,
        schedulerEmployees,
      }: {
        assignments: SchedulerBackendResult['assignments'];
        generationResult: SchedulerBackendResult['generationResult'];
        aiPolishResult: SchedulerBackendResult['aiPolishResult'];
        generationDiagnostics: GenerationDiagnostics;
        generationPostprocess: PostprocessStats | undefined;
        generationMethod: 'milp-engine' | 'ai-engine';
        aiEnabled: boolean;
        schedulerAdvanced?: z.infer<typeof schedulerAdvancedSchema>;
        schedulerEmployees: typeof input.employees;
      }) => {
        const finalAssignments = (assignments ?? []).map((assignment) => ({
          ...assignment,
          date: new Date(assignment.date),
        })) ?? [];
        const finalScore = generationResult.score;
        const serializedAssignments = finalAssignments.map((assignment) => ({
          ...assignment,
          date: assignment.date instanceof Date ? assignment.date.toISOString() : assignment.date,
        }));
        const workPatternMap = new Map<string, string>();
        schedulerEmployees.forEach((emp) => {
          if (emp.id) {
            workPatternMap.set(emp.id, emp.workPatternType ?? 'three-shift');
          }
        });
        const normalizedOffAccruals = (generationResult.offAccruals ?? []).map((entry) => {
          const pattern = workPatternMap.get(entry.employeeId);
          if (pattern === 'weekday-only') {
            return {
              ...entry,
              actualOffDays: 0,
              extraOffDays: 0,
            };
          }
          return entry;
        });

        const [schedule] = await tenantDb.insert(schedules, {
          name: input.name,
          departmentId: input.departmentId,
          startDate: input.startDate,
          endDate: input.endDate,
          status: 'draft',
          metadata: {
            generatedBy: ctx.user?.id || 'system',
            generationMethod,
            constraints: input.constraints,
            assignments: serializedAssignments,
            stats: generationResult.stats,
            score: finalScore,
            violations: generationResult.violations,
            offAccruals: normalizedOffAccruals,
            diagnostics: generationDiagnostics,
            schedulerAdvanced,
            aiEnabled,
            aiPolishResult,
          },
        });

        await createAuditLog({
          tenantId,
          actorId: ctx.user?.id || 'system',
          action: 'schedule.generated',
          entityType: 'schedule',
          entityId: schedule.id,
          after: schedule,
          metadata: {
            computationTime: generationResult.computationTime,
            iterations: generationResult.iterations,
          },
        });

        sse.schedule.generated(schedule.id, {
          departmentId: input.departmentId,
          generatedBy: ctx.user?.id || 'system',
          tenantId,
        });

        return {
          scheduleId: schedule.id,
          assignments: serializedAssignments,
          generationResult: {
            iterations: generationResult.iterations,
            computationTime: generationResult.computationTime,
            score: finalScore,
            violations: generationResult.violations,
            offAccruals: normalizedOffAccruals,
            stats: generationResult.stats,
            diagnostics: generationDiagnostics,
            postprocess: generationPostprocess,
          },
          aiPolishResult,
        };
      };

      if (!input.employees.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '스케줄을 생성할 직원이 없습니다.',
        });
      }

      // Permission checks
      if (ctx.user?.role === 'manager') {
        if (!ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '부서 정보가 없습니다.',
          });
        }
        if (input.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '담당 부서의 스케줄만 생성할 수 있습니다.',
          });
        }
      } else if (ctx.user?.role === 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '스케줄을 생성할 권한이 없습니다. 관리자 또는 매니저에게 문의하세요.',
        });
      }

      const { schedulerAdvanced, schedulerEmployees, basePayload } = await prepareContext();

      const defaultSchedulerPayload: SchedulerBackendPayload = {
        ...basePayload,
        enableAI: input.enableAI,
        useMilpEngine: false,
      };

      let milpSchedulerPayload: SchedulerBackendPayload | undefined;
      if (input.useMilpEngine) {
        milpSchedulerPayload = {
          ...basePayload,
          enableAI: false,
          useMilpEngine: true,
          schedulerAdvanced,
          solver: schedulerAdvanced?.solverPreference ?? 'ortools',
        };
      }

      const schedulerErrors: SchedulerJobError[] = [];
      const trySchedulerRequest = async (
        payload: SchedulerBackendPayload,
        options?: { useMilpBackend?: boolean }
      ): Promise<SchedulerBackendResult | undefined> => {
        try {
          return await requestScheduleGenerationFromBackend(payload, options);
        } catch (error) {
          schedulerErrors.push(error as SchedulerJobError);
          return undefined;
        }
      };

      let backendResult: SchedulerBackendResult | undefined;
      let resolvedGenerationMethod: 'milp-engine' | 'ai-engine' =
        defaultSchedulerPayload.useMilpEngine ? 'milp-engine' : 'ai-engine';
      let resolvedAiFlag = defaultSchedulerPayload.enableAI;
      if (milpSchedulerPayload) {
        backendResult = await trySchedulerRequest(milpSchedulerPayload, { useMilpBackend: true });
        if (backendResult) {
          resolvedGenerationMethod = 'milp-engine';
          resolvedAiFlag = milpSchedulerPayload.enableAI;
        } else {
          console.warn('[Scheduler] MILP backend failed, falling back to default scheduler', {
            departmentId: input.departmentId,
            errors: schedulerErrors.map((err) => err.message),
          });
          backendResult = await trySchedulerRequest(defaultSchedulerPayload);
          if (backendResult) {
            resolvedGenerationMethod = defaultSchedulerPayload.useMilpEngine ? 'milp-engine' : 'ai-engine';
            resolvedAiFlag = defaultSchedulerPayload.enableAI;
          }
        }
      } else {
        backendResult = await trySchedulerRequest(defaultSchedulerPayload);
        if (backendResult) {
          resolvedGenerationMethod = defaultSchedulerPayload.useMilpEngine ? 'milp-engine' : 'ai-engine';
          resolvedAiFlag = defaultSchedulerPayload.enableAI;
        }
      }

      if (!backendResult) {
        const lastError = schedulerErrors[schedulerErrors.length - 1];
        const aggregated = schedulerErrors.map((err) => err.message).join(' | ');
        const diagnostics =
          [...schedulerErrors].reverse().map((err) => err.diagnostics).find(Boolean) ?? lastError?.diagnostics;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: input.useMilpEngine
            ? `MILP scheduler and fallback both failed. Details: ${aggregated}`
            : (lastError?.message ?? 'Scheduler backend failed'),
          cause: diagnostics || lastError || aggregated,
        });
      }

      const generationDiagnostics = backendResult.generationResult.diagnostics ?? {};
      const generationPostprocess = backendResult.generationResult.postprocess ?? generationDiagnostics.postprocess;
      return await persistSchedule({
        assignments: backendResult.assignments,
        generationResult: backendResult.generationResult,
        aiPolishResult: backendResult.aiPolishResult,
        generationDiagnostics,
        generationPostprocess,
        generationMethod: resolvedGenerationMethod,
        aiEnabled: resolvedAiFlag,
        schedulerAdvanced,
        schedulerEmployees,
      });
    }),

  publish: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantDb = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      const [schedule] = await tenantDb.query(schedules, eq(schedules.id, input.id));

      if (!schedule) {
        throw new Error('Schedule not found');
      }

      // Check permissions: manager can only publish schedules for their department
      if (ctx.user?.role === 'manager') {
        if (!ctx.user.departmentId || schedule.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '담당 부서의 스케줄만 확정할 수 있습니다.',
          });
        }
      } else if (ctx.user?.role === 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '스케줄을 확정할 권한이 없습니다. 관리자 또는 매니저에게 문의하세요.',
        });
      }

      const [updated] = await tenantDb.update(
        schedules,
        {
          status: 'published',
          publishedAt: new Date(),
          publishedBy: (ctx.user?.id || 'dev-user-id'),
        },
        eq(schedules.id, input.id)
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'schedule.published',
        entityType: 'schedule',
        entityId: schedule.id,
        before: schedule,
        after: updated,
      });

      // Calculate off-balance for all employees
      try {
        const tenantId = (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d');

          type ScheduleMetadata = {
            assignments?: Array<{
              employeeId: string;
              shiftType?: string;
              date: string | Date;
              [key: string]: unknown;
            }>;
            offAccruals?: Array<{
              employeeId: string;
              extraOffDays: number;
              guaranteedOffDays: number;
              actualOffDays: number;
            }>;
            [key: string]: unknown;
          };

          // Get schedule assignments and OFF accrual info from metadata
          const metadata = schedule.metadata as ScheduleMetadata;
          const assignments = metadata?.assignments || [];
          const offAccruals = metadata?.offAccruals || [];

          if (assignments.length === 0) {
            console.log('[OffBalance] (TRPC) Skipping ledger update - no assignments in metadata', {
              tenantId,
              scheduleId: schedule.id,
            });
          } else {
            const employeeIds = [...new Set(assignments.map((a) => a.employeeId))] as string[];

          const periodStart = schedule.startDate;
          const periodEnd = schedule.endDate;
          const year = periodStart.getFullYear();
          const month = periodStart.getMonth() + 1;

            const deleteFilters = [
              eq(offBalanceLedger.year, year),
              eq(offBalanceLedger.month, month),
            ];
          if (schedule.departmentId) {
            deleteFilters.push(eq(offBalanceLedger.departmentId, schedule.departmentId));
          }

            const deletedRows = await tenantDb.hardDelete(offBalanceLedger, and(...deleteFilters));

          console.log('[OffBalance] (TRPC) Cleared previous ledger rows', {
            tenantId,
            departmentId: schedule.departmentId,
            year,
            month,
            deletedCount: deletedRows.length,
            scheduleId: schedule.id,
          });

            const offBalanceRecords = [];

            if (offAccruals.length > 0) {
              // Prefer using AI off-accrual summaries when available
              const accrualByEmployee = new Map<string, {
                extraOffDays: number;
                guaranteedOffDays: number;
                actualOffDays: number;
              }>();
              offAccruals.forEach((entry) => {
                accrualByEmployee.set(entry.employeeId, {
                  extraOffDays: entry.extraOffDays,
                  guaranteedOffDays: entry.guaranteedOffDays,
                  actualOffDays: entry.actualOffDays,
                });
              });

              employeeIds.forEach((employeeId) => {
                const accrual = accrualByEmployee.get(employeeId);
                if (!accrual) {
                  return;
                }

                const remainingOffDays = accrual.extraOffDays;
                if (remainingOffDays <= 0) {
                  return;
                }

                offBalanceRecords.push({
                  tenantId,
                  nurseId: employeeId,
                  departmentId: schedule.departmentId,
                  year,
                  month,
                  periodStart,
                  periodEnd,
                  guaranteedOffDays: accrual.guaranteedOffDays,
                  actualOffDays: accrual.actualOffDays,
                  remainingOffDays,
                  accumulatedOffDays: remainingOffDays,
                  allocatedToAccumulation: 0,
                  allocatedToAllowance: 0,
                  compensationType: null,
                  status: 'pending',
                  allocationStatus: 'pending',
                  scheduleId: schedule.id,
                });
              });
            } else {
              // Fallback: derive OFF ledger only from assignments with a simple rule
              for (const employeeId of employeeIds) {
                const employeeAssignments = assignments.filter((a) => a.employeeId === employeeId);
                const actualOffDays = employeeAssignments.filter((a) => {
                  if (!a.shiftType) {
                    return false;
                  }
                  const normalized = a.shiftType.replace('^', '').toUpperCase();
                  return normalized === 'O' || normalized === 'OFF';
                }).length;

                const guaranteedOffDays = 8;
                const remainingOffDays = guaranteedOffDays - actualOffDays;

                if (remainingOffDays > 0) {
                  offBalanceRecords.push({
                    tenantId,
                    nurseId: employeeId,
                    departmentId: schedule.departmentId,
                    year,
                    month,
                    periodStart,
                    periodEnd,
                    guaranteedOffDays,
                    actualOffDays,
                    remainingOffDays,
                    accumulatedOffDays: remainingOffDays,
                    allocatedToAccumulation: 0,
                    allocatedToAllowance: 0,
                    compensationType: null,
                    status: 'pending',
                    allocationStatus: 'pending',
                    scheduleId: schedule.id,
                  });
                }
              }
            }

            if (!offBalanceRecords.length) {
              console.log('[OffBalance] (TRPC) No remaining OFF days to record', {
                tenantId,
                departmentId: schedule.departmentId,
                year,
                month,
                scheduleId: schedule.id,
                employeeCount: employeeIds.length,
              });
            } else {
              await tenantDb.insert(offBalanceLedger, offBalanceRecords);

              console.log('[OffBalance] (TRPC) Inserted ledger rows', {
                tenantId,
                departmentId: schedule.departmentId,
                year,
                month,
                scheduleId: schedule.id,
                employeeCount: employeeIds.length,
                insertedCount: offBalanceRecords.length,
              });
            }
          }
        } catch (error) {
        console.error('Error calculating off-balance:', error);
        // Don't fail the publish if off-balance calculation fails
      }

      // ✅ SSE: 스케줄 확정 이벤트 브로드캐스트
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      sse.schedule.published(schedule.id, {
        departmentId: schedule.departmentId || undefined,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        publishedBy: ctx.user?.id || 'dev-user-id',
        tenantId,
      });

      // ✅ 알림: 해당 부서의 모든 사용자에게 알림 전송
      if (schedule.departmentId) {
        await notificationService.sendToTopic(
          tenantId,
          `department:${schedule.departmentId}`,
          {
            type: 'schedule_published',
            priority: 'high',
            title: '새로운 스케줄이 확정되었습니다',
            message: `${format(schedule.startDate, 'yyyy년 M월')} 스케줄이 확정되었습니다.`,
            actionUrl: '/schedule',
            departmentId: schedule.departmentId,
            data: { scheduleId: schedule.id },
          }
        );
      }

      return updated;
    }),

  archive: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantDb = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      // Get schedule to check permissions
      const [schedule] = await tenantDb.query(schedules, eq(schedules.id, input.id));

      if (!schedule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        });
      }

      // Check permissions: manager can only archive schedules for their department
      if (ctx.user?.role === 'manager') {
        if (!ctx.user.departmentId || schedule.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '담당 부서의 스케줄만 관리할 수 있습니다.',
          });
        }
      } else if (ctx.user?.role === 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '스케줄을 아카이브할 권한이 없습니다. 관리자 또는 매니저에게 문의하세요.',
        });
      }

      const [updated] = await tenantDb.update(
        schedules,
        {
          status: 'archived',
        },
        eq(schedules.id, input.id)
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'schedule.archived',
        entityType: 'schedule',
        entityId: input.id,
        after: updated,
      });

      // ✅ SSE: 스케줄 아카이브 이벤트 브로드캐스트
      sse.schedule.archived(input.id, {
        departmentId: schedule.departmentId || undefined,
        tenantId: ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d',
      });

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Get schedule to check permissions
      const [schedule] = await db
        .select()
        .from(schedules)
        .where(and(
          eq(schedules.id, input.id),
          eq(schedules.tenantId, tenantId)
        ));

      if (!schedule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        });
      }

      // Check permissions: manager can only delete schedules for their department
      if (ctx.user?.role === 'manager') {
        if (!ctx.user.departmentId || schedule.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '담당 부서의 스케줄만 삭제할 수 있습니다.',
          });
        }
      } else if (ctx.user?.role === 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '스케줄을 삭제할 권한이 없습니다. 관리자 또는 매니저에게 문의하세요.',
        });
      }

      if (schedule.status === 'published') {
        const scheduleStart = new Date(schedule.startDate);
        const year = scheduleStart.getFullYear();
        const month = scheduleStart.getMonth() + 1;
        const monthStart = new Date(scheduleStart.getFullYear(), scheduleStart.getMonth(), 1);
        const monthEnd = new Date(scheduleStart.getFullYear(), scheduleStart.getMonth() + 1, 0, 23, 59, 59, 999);

        const swapCleanupConditions = [
          eq(swapRequests.tenantId, tenantId),
          gte(swapRequests.date, monthStart),
          lte(swapRequests.date, monthEnd),
        ];
        if (schedule.departmentId) {
          swapCleanupConditions.push(eq(swapRequests.departmentId, schedule.departmentId));
        }

        const offLedgerCleanupConditions = [
          eq(offBalanceLedger.tenantId, tenantId),
          eq(offBalanceLedger.year, year),
          eq(offBalanceLedger.month, month),
        ];
        if (schedule.departmentId) {
          offLedgerCleanupConditions.push(eq(offBalanceLedger.departmentId, schedule.departmentId));
        }

        const deletedSwapRequests = await db
          .delete(swapRequests)
          .where(and(...swapCleanupConditions))
          .returning({ id: swapRequests.id });

        const deletedOffLedger = await db
          .delete(offBalanceLedger)
          .where(and(...offLedgerCleanupConditions))
          .returning({ id: offBalanceLedger.id });

        console.log('[ScheduleDelete] Cleared related monthly data', {
          scheduleId: schedule.id,
          departmentId: schedule.departmentId,
          year,
          month,
          swapRequestsDeleted: deletedSwapRequests.length,
          offLedgerDeleted: deletedOffLedger.length,
        });
      }

      // Soft delete: set deletedFlag to 'X'
      await db
        .update(schedules)
        .set({
          deletedFlag: 'X',
          updatedAt: new Date()
        })
        .where(and(
          eq(schedules.id, input.id),
          eq(schedules.tenantId, tenantId)
        ));

      await createAuditLog({
        tenantId: tenantId,
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'schedule.deleted',
        entityType: 'schedule',
        entityId: input.id,
        before: schedule,
      });

      // ✅ SSE: 스케줄 삭제 이벤트 브로드캐스트
      sse.schedule.deleted(input.id, {
        departmentId: schedule.departmentId || undefined,
        tenantId,
      });

      return { success: true };
    }),

  // Check for existing published schedules in a date range
  checkExisting: protectedProcedure
    .input(z.object({
      departmentId: z.string(),
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Check for published schedules that overlap with the requested date range
      const existingSchedules = await db
        .select({
          id: schedules.id,
          startDate: schedules.startDate,
          endDate: schedules.endDate,
          version: schedules.version,
          publishedAt: schedules.publishedAt,
          publishedBy: schedules.publishedBy,
          metadata: schedules.metadata,
        })
        .from(schedules)
        .where(and(
          eq(schedules.tenantId, tenantId),
          eq(schedules.departmentId, input.departmentId),
          eq(schedules.status, 'published'),
          or(
            isNull(schedules.deletedFlag),
            ne(schedules.deletedFlag, 'X')
          ),
          // Check for overlap: schedule.startDate <= input.endDate AND schedule.endDate >= input.startDate
          lte(schedules.startDate, input.endDate),
          gte(schedules.endDate, input.startDate)
        ))
        .orderBy(desc(schedules.publishedAt));

      return {
        hasExisting: existingSchedules.length > 0,
        schedules: existingSchedules,
      };
    }),

  // Increment schedule version (used for swaps and updates)
  incrementVersion: protectedProcedure
    .input(z.object({
      scheduleId: z.string(),
      reason: z.string(),
      changes: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Get current schedule
      const [currentSchedule] = await db
        .select()
        .from(schedules)
        .where(and(
          eq(schedules.id, input.scheduleId),
          eq(schedules.tenantId, tenantId),
          or(
            isNull(schedules.deletedFlag),
            ne(schedules.deletedFlag, 'X')
          )
        ));

      if (!currentSchedule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        });
      }

      type VersionMetadata = {
        versionHistory?: Array<{
          version: number;
          updatedAt: string;
          updatedBy: string;
          reason: string;
          changes?: unknown;
        }>;
        [key: string]: unknown;
      };

      const newVersion = currentSchedule.version + 1;
      const metadata = currentSchedule.metadata as VersionMetadata;
      const versionHistory = metadata?.versionHistory || [];

      // Add to version history
      versionHistory.push({
        version: newVersion,
        updatedAt: new Date().toISOString(),
        updatedBy: ctx.user?.id || 'dev-user-id',
        reason: input.reason,
        changes: input.changes,
      });

      // Update schedule with new version
      const [updated] = await db
        .update(schedules)
        .set({
          version: newVersion,
          metadata: {
            ...metadata,
            versionHistory,
          },
          updatedAt: new Date(),
        })
        .where(and(
          eq(schedules.id, input.scheduleId),
          eq(schedules.tenantId, tenantId)
        ))
        .returning();

      await createAuditLog({
        tenantId: tenantId,
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'schedule.version_updated',
        entityType: 'schedule',
        entityId: input.scheduleId,
        before: currentSchedule,
        after: updated,
      });

      // ✅ SSE: 스케줄 버전 업데이트 이벤트 브로드캐스트
      sse.schedule.versionUpdated(input.scheduleId, {
        version: newVersion,
        reason: input.reason,
        changes: input.changes,
        tenantId,
      });

      return updated;
    }),

  // Composite query to fetch all schedule page data in one request
  getPageData: protectedProcedure
    .input(z.object({
      departmentId: z.string().optional(),
      startDate: z.string(), // yyyy-MM-dd format
      endDate: z.string(),   // yyyy-MM-dd format
      includeDraft: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const userRole = ctx.user?.role;
      const userDepartmentId = ctx.user?.departmentId;

      // Parse dates (keep as strings for database queries)
      const startDate = input.startDate;
      const endDate = input.endDate;

      // Determine department filter
      let departmentFilter = input.departmentId;
      if (userRole === 'member' || userRole === 'manager') {
        if (!userDepartmentId) {
          return {
            schedules: [],
            holidays: [],
            teams: [],
            users: [],
            specialRequests: [],
            configs: {},
          };
        }
        departmentFilter = userDepartmentId;
      }

      // Execute all queries in parallel
      const [schedulesData, holidaysData, teamsData, usersData, specialRequestsData] = await Promise.all([
        // Schedules
        (async () => {
          const conditions = [
            eq(schedules.tenantId, tenantId),
            or(
              isNull(schedules.deletedFlag),
              ne(schedules.deletedFlag, 'X')
            ),
          ];

          if (departmentFilter) {
            conditions.push(eq(schedules.departmentId, departmentFilter));
          }

          if (userRole === 'member') {
            conditions.push(eq(schedules.status, 'published'));
          } else if (!input.includeDraft) {
            conditions.push(eq(schedules.status, 'published'));
          }

          return await db
            .select({
              id: schedules.id,
              departmentId: schedules.departmentId,
              startDate: schedules.startDate,
              endDate: schedules.endDate,
              status: schedules.status,
              publishedAt: schedules.publishedAt,
              metadata: schedules.metadata,
              createdAt: schedules.createdAt,
            })
            .from(schedules)
            .where(and(...conditions))
            .orderBy(desc(schedules.createdAt))
            .limit(10);
        })(),

        // Holidays
        db
          .select()
          .from(holidays)
          .where(and(
            eq(holidays.tenantId, tenantId),
            gte(holidays.date, startDate),
            lte(holidays.date, endDate)
          )),

        // Teams
        departmentFilter
          ? db
              .select()
              .from(teams)
              .where(and(
                eq(teams.tenantId, tenantId),
                eq(teams.departmentId, departmentFilter),
                isNull(teams.deletedAt)
              ))
          : [],

        // Users (only active users from the relevant department)
        (async () => {
          const conditions = [
            eq(users.tenantId, tenantId),
            eq(users.status, 'active'),
            isNull(users.deletedAt),
          ];

          if (departmentFilter) {
            conditions.push(eq(users.departmentId, departmentFilter));
          }

          return await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              employeeId: users.employeeId,
              position: users.position,
              role: users.role,
              departmentId: users.departmentId,
              teamId: users.teamId,
              status: users.status,
            })
            .from(users)
            .where(and(...conditions))
            .limit(100);
        })(),

        // Special Requests
        departmentFilter
          ? db
              .select()
              .from(specialRequests)
              .where(and(
                eq(specialRequests.tenantId, tenantId),
                gte(specialRequests.date, startDate),
                lte(specialRequests.date, endDate)
              ))
          : [],
      ]);

      return {
        schedules: schedulesData,
        holidays: holidaysData,
        teams: teamsData,
        users: usersData,
        specialRequests: specialRequestsData,
      };
    }),

  // Dashboard data - optimized composite query
  getDashboardData: protectedProcedure
    .query(async ({ ctx }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Execute queries in parallel
      const [todaySchedule] = await Promise.all([
        // Find schedule that includes today (published only, limit 1)
        db
          .select({
            id: schedules.id,
            startDate: schedules.startDate,
            endDate: schedules.endDate,
            metadata: schedules.metadata,
          })
          .from(schedules)
          .where(and(
            eq(schedules.tenantId, tenantId),
            eq(schedules.status, 'published'),
            or(
              isNull(schedules.deletedFlag),
              ne(schedules.deletedFlag, 'X')
            ),
            lte(schedules.startDate, today),
            gte(schedules.endDate, today)
          ))
          .orderBy(desc(schedules.publishedAt))
          .limit(1)
          .then(rows => rows[0] || null),
      ]);

      type AssignmentRecord = {
        employeeId: string;
        date: string | Date;
        shiftId?: string | null;
        shiftType?: string;
        [key: string]: unknown;
      };

      type DashboardMetadata = {
        assignments?: AssignmentRecord[];
        [key: string]: unknown;
      };

      // Extract today's working count from schedule metadata
      let workingToday = 0;
      if (todaySchedule && todaySchedule.metadata) {
        const metadata = todaySchedule.metadata as DashboardMetadata;
        const assignments = metadata?.assignments || [];
        const todayStr = today.toISOString().split('T')[0];

        // Helper function to identify non-working shifts
        const isNonWorkingShift = (assignment: AssignmentRecord): boolean => {
          if (!assignment.shiftId && !assignment.shiftType) return true; // 빈 배정

          const nonWorkingCodes = [
            'off', 'OFF', 'O',           // 휴무
            'LEAVE', 'VAC', '연차',      // 연차/휴가
            'SICK', '병가',              // 병가
            'HD', '반차',                // 반차
            '휴직', '결근',              // 휴직/결근
            'X',                         // 빈 슬롯
          ];

          const shiftIdUpper = assignment.shiftId?.toUpperCase();
          const shiftTypeUpper = assignment.shiftType?.toUpperCase();

          return (
            (assignment.shiftId != null && nonWorkingCodes.includes(assignment.shiftId)) ||
            (assignment.shiftType != null && nonWorkingCodes.includes(assignment.shiftType)) ||
            (shiftIdUpper != null && nonWorkingCodes.some(code => code.toUpperCase() === shiftIdUpper)) ||
            (shiftTypeUpper != null && nonWorkingCodes.some(code => code.toUpperCase() === shiftTypeUpper))
          );
        };

        // Debug: Log all today's assignments
        const todayAssignments = assignments.filter((a) => {
          const assignmentDate = new Date(a.date).toISOString().split('T')[0];
          return assignmentDate === todayStr;
        });

        console.log('📊 오늘 전체 배정:', todayAssignments.map((a) => ({
          employeeId: a.employeeId,
          shiftId: a.shiftId,
          shiftType: a.shiftType,
        })));

        const workingAssignments = todayAssignments.filter((assignment) => {
          const isWorking = !isNonWorkingShift(assignment);
          if (!isWorking) {
            console.log('🚫 비근무 제외:', {
              employeeId: assignment.employeeId,
              shiftId: assignment.shiftId,
              shiftType: assignment.shiftType,
            });
          }
          return isWorking;
        });

        console.log('✅ 오늘 근무자 수:', workingAssignments.length);
        workingToday = workingAssignments.length;
      }

      return {
        workingToday,
        pendingSwapsCount: 0, // Will be implemented with swap feature
        approvedTodayCount: 0, // Will be implemented with swap feature
      };
    }),

  // Get today's assignments only - optimized for quick loading
  getTodayAssignments: protectedProcedure
    .input(z.object({
      date: z.date().optional(), // Default to today if not provided
      departmentId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const targetDate = input.date || new Date();
      targetDate.setHours(0, 0, 0, 0);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      // Find schedule that includes the target date
      const conditions = [
        eq(schedules.tenantId, tenantId),
        eq(schedules.status, 'published'),
        or(
          isNull(schedules.deletedFlag),
          ne(schedules.deletedFlag, 'X')
        ),
        lte(schedules.startDate, targetDate),
        gte(schedules.endDate, targetDate),
      ];

      // Apply department filter if provided or if member/manager
      if (ctx.user?.role === 'member' && ctx.user.departmentId) {
        conditions.push(eq(schedules.departmentId, ctx.user.departmentId));
      } else if (input.departmentId) {
        conditions.push(eq(schedules.departmentId, input.departmentId));
      }

      const schedule = await db
        .select({
          id: schedules.id,
          metadata: schedules.metadata,
          startDate: schedules.startDate,
          endDate: schedules.endDate,
        })
        .from(schedules)
        .where(and(...conditions))
        .orderBy(desc(schedules.publishedAt))
        .limit(1)
        .then(rows => rows[0] || null);

      if (!schedule || !schedule.metadata) {
        return [];
      }

      type TodayAssignmentRecord = {
        date: string | Date;
        [key: string]: unknown;
      };

      type TodayMetadata = {
        assignments?: TodayAssignmentRecord[];
        [key: string]: unknown;
      };

      // Extract only today's assignments from metadata
      const metadata = schedule.metadata as TodayMetadata;
      const allAssignments = metadata?.assignments || [];

      const todayAssignments = allAssignments.filter((a) => {
        const assignmentDate = new Date(a.date).toISOString().split('T')[0];
        return assignmentDate === targetDateStr;
      });

      return todayAssignments;
    }),

  // Get my upcoming shifts (next 7 days)
  getMyUpcomingShifts: protectedProcedure
    .query(async ({ ctx }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sevenDaysLater = new Date(today);
      sevenDaysLater.setDate(today.getDate() + 7);

      // Get current user's database ID
      const currentUserId = ctx.user?.id;
      if (!currentUserId) return [];

      // Get from schedule table for all users (including administrative staff)
      const scheduleList = await db
        .select({
          id: schedules.id,
          startDate: schedules.startDate,
          endDate: schedules.endDate,
          metadata: schedules.metadata,
        })
        .from(schedules)
        .where(and(
          eq(schedules.tenantId, tenantId),
          eq(schedules.status, 'published'),
          or(
            isNull(schedules.deletedFlag),
            ne(schedules.deletedFlag, 'X')
          ),
          lte(schedules.startDate, sevenDaysLater),
          gte(schedules.endDate, today)
        ))
        .orderBy(desc(schedules.publishedAt));

      type ShiftAssignment = {
        employeeId: string;
        date: string | Date;
        shiftId?: string;
        shiftType?: string;
        startTime?: string;
        endTime?: string;
        [key: string]: unknown;
      };

      type ShiftType = {
        code?: string;
        id?: string;
        name?: string;
        startTime?: string;
        endTime?: string;
        color?: string;
        [key: string]: unknown;
      };

      type UpcomingShiftsMetadata = {
        assignments?: ShiftAssignment[];
        shiftTypes?: ShiftType[];
        [key: string]: unknown;
      };

      type EnrichedAssignment = ShiftAssignment & {
        shiftName?: string;
        startTime?: string;
        endTime?: string;
        color?: string;
        shiftCode?: string;
      };

      const rawFallbackShiftTypes = await getShiftTypes(
        tenantId,
        ctx.user?.departmentId ?? undefined
      );

      const fallbackShiftTypes: ShiftType[] = rawFallbackShiftTypes.map((shift) => {
        const shiftId = 'id' in shift && typeof (shift as { id?: unknown }).id === 'string'
          ? (shift as { id?: string }).id
          : undefined;

        const normalized: ShiftType = {
          ...shift,
          id: shiftId ?? (shift.code ? `shift-${shift.code.toLowerCase()}` : undefined),
        };
        return normalized;
      });

      // Extract my assignments from all schedules
      const myShifts: EnrichedAssignment[] = [];
      for (const schedule of scheduleList) {
        if (!schedule.metadata) continue;

        const metadata = schedule.metadata as UpcomingShiftsMetadata;
        const assignments = metadata?.assignments || [];
        const metadataShiftTypes = (metadata?.shiftTypes || []) as ShiftType[];
        const shiftTypes =
          metadataShiftTypes.length > 0
            ? metadataShiftTypes
            : (fallbackShiftTypes as ShiftType[]);

        // Filter assignments for current user within the date range
        const userAssignments = assignments.filter((a) => {
          if (a.employeeId !== currentUserId) return false;

          const assignmentDate = new Date(a.date);
          return assignmentDate >= today && assignmentDate <= sevenDaysLater;
        });

        const enrichedAssignments = userAssignments.map((assignment) => {
          const normalizedShiftId = assignment.shiftId?.toLowerCase();
          const extractedCode = normalizedShiftId?.replace('shift-', '');
          const providedCode = assignment.shiftType?.toLowerCase();

          // Try multiple matching strategies to find the shift type
          const shiftType = shiftTypes.find((st) => {
            const candidateId = typeof st.id === 'string' ? st.id.toLowerCase() : undefined;
            const candidateCode = typeof st.code === 'string' ? st.code.toLowerCase() : undefined;

            if (candidateId && normalizedShiftId && candidateId === normalizedShiftId) return true;
            if (candidateCode && normalizedShiftId && normalizedShiftId === `shift-${candidateCode}`) return true;
            if (candidateCode && extractedCode && candidateCode === extractedCode) return true;
            if (candidateCode && providedCode && candidateCode === providedCode) return true;
            if (candidateCode && normalizedShiftId && candidateCode === normalizedShiftId) return true;

            return false;
          });

          const codeForDisplay = shiftType?.code?.toUpperCase() ?? assignment.shiftType ?? extractedCode?.toUpperCase();
          const displayName = shiftType
            ? [shiftType.code?.toUpperCase(), shiftType.name].filter(Boolean).join(' ').trim()
            : assignment.shiftType || assignment.shiftId || '-';

          const enriched = {
            ...assignment,
            shiftCode: codeForDisplay,
            shiftName: displayName,
            startTime: assignment.startTime || shiftType?.startTime,
            endTime: assignment.endTime || shiftType?.endTime,
            color: shiftType?.color,
          };

          console.log('📅 나의 다가오는 근무 enriched:', {
            date: assignment.date,
            shiftId: assignment.shiftId,
            shiftCode: assignment.shiftId?.replace("shift-", ""),
            foundShiftType: shiftType,
            shiftName: enriched.shiftName,
            startTime: enriched.startTime,
            endTime: enriched.endTime,
          });
          return enriched;
        });

        myShifts.push(...enrichedAssignments);
      }

      // Sort by date
      myShifts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return myShifts;
    }),

  // Get colleagues working with me on same shifts
  getMyWorkmates: protectedProcedure
    .input(z.object({
      period: z.enum(['today', 'week', 'month']).default('week'),
      groupBy: z.enum(['shift', 'department', 'team']).default('shift'),
    }).optional())
    .query(async ({ ctx, input }) => {
      const period = input?.period || 'week';
      const groupBy = input?.groupBy || 'shift';
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let startDate: Date;
      let endDate: Date;

      if (period === 'today') {
        // Today only
        startDate = new Date(today);
        endDate = new Date(today);
      } else if (period === 'week') {
        // This week (Monday to Sunday)
        startDate = new Date(today);
        const dayOfWeek = startDate.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startDate.setDate(startDate.getDate() + diff);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
      } else {
        // This month
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      }

      // Find schedules that overlap with the selected period
      const scheduleList = await db
        .select({
          id: schedules.id,
          startDate: schedules.startDate,
          endDate: schedules.endDate,
          metadata: schedules.metadata,
        })
        .from(schedules)
        .where(and(
          eq(schedules.tenantId, tenantId),
          eq(schedules.status, 'published'),
          or(
            isNull(schedules.deletedFlag),
            ne(schedules.deletedFlag, 'X')
          ),
          lte(schedules.startDate, endDate),
          gte(schedules.endDate, startDate)
        ))
        .orderBy(desc(schedules.publishedAt));

      // Get current user's database ID and info
      const currentUserId = ctx.user?.id;
      if (!currentUserId) return { workmates: [], myShifts: [] };

      // Get current user's department and team info
      const [currentUser] = await db
        .select({
          id: users.id,
          departmentId: users.departmentId,
          teamId: users.teamId,
        })
        .from(users)
        .where(eq(users.id, currentUserId))
        .limit(1);

      if (!currentUser) return { workmates: [], myShifts: [] };

      type WorkmateAssignment = {
        employeeId: string;
        date: string | Date;
        shiftId?: string | null;
        shiftType?: string;
        [key: string]: unknown;
      };

      type WorkmateMetadata = {
        assignments?: WorkmateAssignment[];
        [key: string]: unknown;
      };

      // Extract assignments from all schedules
      const myShifts: WorkmateAssignment[] = [];
      const allAssignments: WorkmateAssignment[] = [];

      for (const schedule of scheduleList) {
        if (!schedule.metadata) continue;

        const metadata = schedule.metadata as WorkmateMetadata;
        const assignments = metadata?.assignments || [];

        // Filter assignments within the selected period
        const periodAssignments = assignments.filter((a) => {
          const assignmentDate = new Date(a.date);
          return assignmentDate >= startDate && assignmentDate <= endDate;
        });

        // Separate my shifts
        const userAssignments = periodAssignments.filter((a) => a.employeeId === currentUserId);
        myShifts.push(...userAssignments);

        allAssignments.push(...periodAssignments);
      }

      // Helper to check if non-working shift
      const isNonWorkingShift = (assignment: WorkmateAssignment): boolean => {
        if (!assignment.shiftId && !assignment.shiftType) return true;
        const nonWorkingCodes = ['off', 'OFF', 'O', 'LEAVE', 'VAC', '연차'];
        const shiftIdUpper = assignment.shiftId?.toUpperCase();
        const shiftTypeUpper = assignment.shiftType?.toUpperCase();
        return (
          (assignment.shiftId != null && nonWorkingCodes.includes(assignment.shiftId)) ||
          (assignment.shiftType != null && nonWorkingCodes.includes(assignment.shiftType)) ||
          (shiftIdUpper != null && nonWorkingCodes.includes(shiftIdUpper)) ||
          (shiftTypeUpper != null && nonWorkingCodes.includes(shiftTypeUpper))
        );
      };

      // Find colleagues based on groupBy criteria
      const workmateMap = new Map<string, { employeeId: string; sharedShifts: number }>();

      // Get all employees with their department/team info for filtering
      const allEmployees = await db
        .select({
          id: users.id,
          departmentId: users.departmentId,
          teamId: users.teamId,
        })
        .from(users)
        .where(eq(users.tenantId, tenantId));

      const employeeInfoMap = new Map(
        allEmployees.map(emp => [emp.id, { departmentId: emp.departmentId, teamId: emp.teamId }])
      );

      for (const myShift of myShifts) {
        if (isNonWorkingShift(myShift)) continue;

        const myDate = new Date(myShift.date).toISOString().split('T')[0];
        const myShiftId = myShift.shiftId || myShift.shiftType || '';

        // Find colleagues based on groupBy criteria
        const matchingWorkers = allAssignments.filter((a) => {
          if (a.employeeId === currentUserId) return false;
          if (isNonWorkingShift(a)) return false;

          const aDate = new Date(a.date).toISOString().split('T')[0];
          if (aDate !== myDate) return false; // Must be same date

          const employeeInfo = employeeInfoMap.get(a.employeeId);
          if (!employeeInfo) return false;

          // Apply groupBy filter
          if (groupBy === 'shift') {
            // Same shift
            const aShiftId = a.shiftId || a.shiftType || '';
            return aShiftId === myShiftId && myShiftId !== '';
          } else if (groupBy === 'department') {
            // Same department
            return employeeInfo.departmentId === currentUser.departmentId && currentUser.departmentId != null;
          } else if (groupBy === 'team') {
            // Same team
            return employeeInfo.teamId === currentUser.teamId && currentUser.teamId != null;
          }

          return false;
        });

        for (const worker of matchingWorkers) {
          const existing = workmateMap.get(worker.employeeId);
          if (existing) {
            existing.sharedShifts++;
          } else {
            workmateMap.set(worker.employeeId, {
              employeeId: worker.employeeId,
              sharedShifts: 1,
            });
          }
        }
      }

      // Get employee details
      const workmateIds = Array.from(workmateMap.keys());
      const employees = workmateIds.length > 0
        ? await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              role: users.role,
            })
            .from(users)
            .where(and(
              eq(users.tenantId, tenantId),
              inArray(users.id, workmateIds)
            ))
        : [];

      // Combine with shared shifts count
      const workmates = employees.map(emp => ({
        ...emp,
        sharedShifts: workmateMap.get(emp.id)?.sharedShifts || 0,
      })).sort((a, b) => b.sharedShifts - a.sharedShifts);

      return {
        workmates,
        myShifts: myShifts.filter(s => !isNonWorkingShift(s)),
      };
    }),

  /**
   * 🆕 스케줄 개선 엔드포인트
   * 기존 생성 로직(generate)과 완전히 분리된 최적화 전용 엔드포인트
   */
  pollJob: protectedProcedure
    .input(z.object({
      jobId: z.string().min(1),
      backendUrl: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const status = await fetchSchedulerJobStatus(input.backendUrl, input.jobId);
      return {
        jobId: input.jobId,
        backendUrl: input.backendUrl,
        status: status.status,
        result: status.result ?? null,
        bestResult: status.bestResult ?? null,
        error: status.error ?? null,
        errorDiagnostics: status.errorDiagnostics ?? null,
      };
    }),

  cancelJob: protectedProcedure
    .input(z.object({
      jobId: z.string().min(1),
      backendUrl: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const status = await cancelSchedulerJob(input.backendUrl, input.jobId);
      return {
        jobId: input.jobId,
        backendUrl: input.backendUrl,
        status: status.status,
        result: status.result ?? null,
        bestResult: status.bestResult ?? null,
        error: status.error ?? null,
        errorDiagnostics: status.errorDiagnostics ?? null,
      };
    }),

  finalizeJob: protectedProcedure
    .input(z.object({
      jobId: z.string().min(1),
      backendUrl: z.string().url(),
      payload: scheduleGenerationInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const tenantDb = scopedDb(tenantId);
      const payload = input.payload;

      if (!payload.employees.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '스케줄을 생성할 직원이 없습니다.',
        });
      }

      if (ctx.user?.role === 'manager') {
        if (!ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '부서 정보가 없습니다.',
          });
        }
        if (payload.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '담당 부서의 스케줄만 생성할 수 있습니다.',
          });
        }
      } else if (ctx.user?.role === 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '스케줄을 생성할 권한이 없습니다. 관리자 또는 매니저에게 문의하세요.',
        });
      }

      const prepareContext = async () => {
        const previousMonthDate = subMonths(payload.startDate, 1);
        const previousYear = previousMonthDate.getFullYear();
        const previousMonth = previousMonthDate.getMonth() + 1;

        const previousLedgerRows = await db
          .select({
            nurseId: offBalanceLedger.nurseId,
            accumulatedOffDays: offBalanceLedger.accumulatedOffDays,
            guaranteedOffDays: offBalanceLedger.guaranteedOffDays,
          })
          .from(offBalanceLedger)
          .where(and(
            eq(offBalanceLedger.tenantId, tenantId),
            eq(offBalanceLedger.departmentId, payload.departmentId),
            eq(offBalanceLedger.year, previousYear),
            eq(offBalanceLedger.month, previousMonth),
          ));

        const previousOffAccruals: Record<string, number> = {};
        const previousGuaranteedOffDays: Record<string, number> = {};
        previousLedgerRows.forEach((row) => {
          if (row.nurseId) {
            previousOffAccruals[row.nurseId] = Math.max(0, row.accumulatedOffDays || 0);
            if (typeof row.guaranteedOffDays === 'number') {
              previousGuaranteedOffDays[row.nurseId] = row.guaranteedOffDays;
            }
          }
        });

        const employeesWithGuarantees = payload.employees.map((emp) => ({
          ...emp,
          guaranteedOffDays: emp.guaranteedOffDays ?? previousGuaranteedOffDays[emp.id],
        }));

        const schedulerAdvanced = payload.schedulerAdvanced;
        const patternConstraints = schedulerAdvanced?.patternConstraints;
        const maxConsecutiveThreeShift =
          patternConstraints?.maxConsecutiveDaysThreeShift ?? DEFAULT_MAX_CONSECUTIVE_DAYS_THREE_SHIFT;

        const schedulerEmployees = employeesWithGuarantees.map((emp) => {
          const workPattern = emp.workPatternType ?? 'three-shift';
          if (workPattern === 'three-shift') {
            return {
              ...emp,
              maxConsecutiveDaysPreferred: maxConsecutiveThreeShift,
            };
          }
          return emp;
        });

        return {
          schedulerEmployees,
          schedulerAdvanced,
        };
      };

      const { schedulerEmployees, schedulerAdvanced } = await prepareContext();

      const status = await fetchSchedulerJobStatus(input.backendUrl, input.jobId);
      if (status.status !== 'completed' || !status.result) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Job is not completed yet.',
        });
      }

      const resultPayload = status.result;
      const generationDiagnostics = resultPayload.generationResult.diagnostics ?? {};
      const generationPostprocess = resultPayload.generationResult.postprocess ?? generationDiagnostics.postprocess;

      const result = await (async () => {
        const finalAssignments = resultPayload.assignments.map((assignment) => ({
          ...assignment,
          date: new Date(assignment.date),
        }));
        const finalScore = resultPayload.generationResult.score;
        const serializedAssignments = finalAssignments.map((assignment) => ({
          ...assignment,
          date: assignment.date instanceof Date ? assignment.date.toISOString() : assignment.date,
        }));
        const workPatternMap = new Map<string, string>();
        schedulerEmployees.forEach((emp) => {
          if (emp.id) {
            workPatternMap.set(emp.id, emp.workPatternType ?? 'three-shift');
          }
        });
        const normalizedOffAccruals = (resultPayload.generationResult.offAccruals ?? []).map((entry) => {
          const pattern = workPatternMap.get(entry.employeeId);
          if (pattern === 'weekday-only') {
            return {
              ...entry,
              actualOffDays: 0,
              extraOffDays: 0,
            };
          }
          return entry;
        });

        const [schedule] = await tenantDb.insert(schedules, {
          name: payload.name,
          departmentId: payload.departmentId,
          startDate: payload.startDate,
          endDate: payload.endDate,
          status: 'draft',
          metadata: {
            generatedBy: ctx.user?.id || 'system',
            generationMethod: payload.useMilpEngine ? 'milp-engine' : 'ai-engine',
            constraints: payload.constraints,
            assignments: serializedAssignments,
            stats: resultPayload.generationResult.stats,
            score: finalScore,
            violations: resultPayload.generationResult.violations,
            offAccruals: normalizedOffAccruals,
            diagnostics: generationDiagnostics,
            schedulerAdvanced,
            aiEnabled: payload.enableAI,
            aiPolishResult: resultPayload.aiPolishResult,
          },
        });

        await createAuditLog({
          tenantId,
          actorId: ctx.user?.id || 'system',
          action: 'schedule.generated',
          entityType: 'schedule',
          entityId: schedule.id,
          after: schedule,
          metadata: {
            computationTime: resultPayload.generationResult.computationTime,
            iterations: resultPayload.generationResult.iterations,
          },
        });

        sse.schedule.generated(schedule.id, {
          departmentId: payload.departmentId,
          generatedBy: ctx.user?.id || 'system',
          tenantId,
        });

        return {
          scheduleId: schedule.id,
          assignments: serializedAssignments,
          generationResult: {
            iterations: resultPayload.generationResult.iterations,
            computationTime: resultPayload.generationResult.computationTime,
            score: finalScore,
            violations: resultPayload.generationResult.violations,
            offAccruals: normalizedOffAccruals,
            stats: resultPayload.generationResult.stats,
            diagnostics: generationDiagnostics,
            postprocess: generationPostprocess,
          },
          aiPolishResult: resultPayload.aiPolishResult,
        };
      })();

      return result;
    }),

  improveSchedule: protectedProcedure
    .input(z.object({
      // 현재 스케줄
      assignments: z.array(z.object({
        date: z.string(),
        employeeId: z.string(),
        shiftId: z.string().optional(),
        shiftType: z.string().optional(),
      })),
      // 직원 정보
      employees: z.array(z.object({
        id: z.string(),
        name: z.string(),
        role: z.string().optional(),
        workPatternType: z.string().optional(),
        preferences: z.object({
          workPatternType: z.string().optional(),
          avoidPatterns: z.array(z.array(z.string())).optional(),
        }).optional(),
      })),
      // 제약 조건
      constraints: z.object({
        minStaff: z.number(),
        maxConsecutiveDays: z.number(),
        minRestDays: z.number(),
      }),
      // 기간
      period: z.object({
        startDate: z.string(),
        endDate: z.string(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Permission check
      if (ctx.user?.role === 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '스케줄 개선 권한이 없습니다. 관리자 또는 매니저에게 문의하세요.',
        });
      }

      try {
        // 타입 변환
        const assignments: Assignment[] = input.assignments.map((a) => ({
          date: a.date,
          employeeId: a.employeeId,
          shiftId: a.shiftId,
          shiftType: a.shiftType,
        }));

        const employees: ImprovementEmployee[] = input.employees.map((e) => {
          // workPatternType 안전하게 변환
          let workPatternType: 'three-shift' | 'night-intensive' | 'weekday-only' | undefined;
          if (e.workPatternType === 'three-shift' || e.workPatternType === 'night-intensive' || e.workPatternType === 'weekday-only') {
            workPatternType = e.workPatternType;
          }

          return {
            id: e.id,
            name: e.name,
            role: e.role,
            workPatternType,
            preferences: e.preferences,
          };
        });

        const constraints: ScheduleConstraints = {
          minStaff: input.constraints.minStaff,
          maxConsecutiveDays: input.constraints.maxConsecutiveDays,
          minRestDays: input.constraints.minRestDays,
        };

        // 개선 실행
        const improver = new ScheduleImprover(assignments, employees, constraints);
        const result = await improver.improve();

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || '스케줄 개선 중 오류가 발생했습니다.',
          });
        }

        // Audit log
        await createAuditLog({
          tenantId,
          actorId: ctx.user?.id || 'system',
          action: 'schedule.improved',
          entityType: 'schedule',
          entityId: 'improvement-session',
          metadata: {
            totalImprovement: result.report.summary.totalImprovement,
            gradeChange: result.report.summary.gradeChange,
            iterations: result.report.summary.iterations,
            processingTime: result.report.summary.processingTime,
          },
        });

        // 리포트 반환
        return {
          improved: result.improved,
          report: result.report,
        };
      } catch (error) {
        console.error('Schedule improvement error:', error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : '스케줄 개선 실패',
        });
      }
    }),
});
