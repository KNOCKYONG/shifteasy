import { performance } from 'node:perf_hooks';
import { eachDayOfInterval, differenceInCalendarDays, format, isWeekend } from 'date-fns';
import type {
  Constraint,
  ConstraintViolation,
  ScheduleAssignment,
  ScheduleScore,
  Shift,
  OffAccrualSummary,
} from '@/lib/types/scheduler';

export type WorkPatternType = 'three-shift' | 'night-intensive' | 'weekday-only';

export interface AiEmployee {
  id: string;
  name: string;
  role: string;
  departmentId?: string;
  teamId?: string | null;
  workPatternType?: WorkPatternType;
  preferredShiftTypes?: Record<string, number>;
  maxConsecutiveDaysPreferred?: number;
  maxConsecutiveNightsPreferred?: number;
  guaranteedOffDays?: number;
}

interface AiSpecialRequest {
  employeeId: string;
  date: string; // yyyy-MM-dd
  requestType: string;
  shiftTypeCode?: string | null;
}

interface TeamPatternConfig {
  pattern: string[];
  avoidPatterns?: string[][];
}

interface Holiday {
  date: string;
  name: string;
}

export interface AiScheduleRequest {
  departmentId: string;
  startDate: Date;
  endDate: Date;
  employees: AiEmployee[];
  shifts: (Shift & { code?: string })[];
  constraints?: Constraint[];
  specialRequests?: AiSpecialRequest[];
  holidays?: Holiday[];
  teamPattern?: TeamPatternConfig | null;
  requiredStaffPerShift?: Record<string, number>;
  nightIntensivePaidLeaveDays?: number;
  previousOffAccruals?: Record<string, number>;
}

export interface AiScheduleGenerationResult {
  assignments: ScheduleAssignment[];
  violations: ConstraintViolation[];
  score: ScheduleScore;
  iterations: number;
  computationTime: number;
  stats: {
    fairnessIndex: number;
    coverageRate: number;
    preferenceScore: number;
  };
  offAccruals: OffAccrualSummary[];
}

export interface AiScheduleValidationRequest extends AiScheduleRequest {
  assignments: ScheduleAssignment[];
}

export interface AiScheduleValidationResult {
  violations: ConstraintViolation[];
  score: ScheduleScore;
  stats: {
    fairnessIndex: number;
    coverageRate: number;
    preferenceScore: number;
  };
  computationTime: number;
}

type LockedAssignmentMap = Map<string, ScheduleAssignment[]>;

interface SchedulerContext {
  dateRange: Date[];
  holidays: Set<string>;
  restDayKeys: Set<string>;
  maxOffDaysPerEmployee: number;
  shiftTemplateMap: Map<string, Shift & { code?: string }>;
  shiftTemplateById: Map<string, Shift & { code?: string }>;
  adminShiftTemplate: (Shift & { code?: string }) | null;
  activeShifts: (Shift & { code?: string })[];
  specialRequestsMap: Map<string, AiSpecialRequest[]>;
  requiredStaffPerShift: Record<string, number>;
  teamPools: Record<string, Set<string>>;
  employeeMap: Map<string, AiEmployee>;
}

interface GenerationPassOptions {
  lockedAssignments?: LockedAssignmentMap;
  randomSeed?: number;
  destroyedDates?: Set<string>;
  repairFocusDates?: Set<string>;
}

interface GenerationPassResult {
  assignments: ScheduleAssignment[];
  employeeStates: Map<string, EmployeeState>;
  filledSlots: number;
  aggregatedPreferenceScore: number;
  violations: ConstraintViolation[];
}

interface EmployeeState {
  totalAssignments: number;
  preferenceScore: number;
  consecutiveDays: number;
  consecutiveNights: number;
  lastAssignedDate: Date | null;
  lastShiftCode: string | null;
  lastWorkShiftCode: string | null;
  shiftCounts: Record<string, number>;
  distinctShifts: Set<string>;
  rotationLock: string | null;
  workPatternType: WorkPatternType;
  offDays: number;
  specialRequestOffDays: number;
  autoOffDays: number;
  maxOffDays: number;
  extraOffDays: number;
  lastShiftRunCount: number;
  nightLeaveRemaining: number;
  bonusOffCarry: number;
  nightRecoveryDaysNeeded: number;
}

const SHIFT_CODE_MAP: Record<string, string> = {
  day: 'D',
  evening: 'E',
  night: 'N',
  off: 'O',
  leave: 'L',
};

const OFF_REQUEST_KEYWORDS = new Set(['off', 'off_day', 'day_off', 'time_off', 'off-request', 'off_request']);

const OFF_SHIFT_ID = 'shift-off';

const DEFAULT_MAX_CONSECUTIVE = {
  'three-shift': 5,
  'night-intensive': 6,
  'weekday-only': 4,
};

const DEFAULT_MAX_CONSECUTIVE_NIGHT = {
  'three-shift': 2,
  'night-intensive': 4,
  'weekday-only': 1,
};

const THREE_SHIFT_ROTATION_LOCK_THRESHOLD = 5;
const NIGHT_INTENSIVE_RECOVERY_MIN_STREAK = 3;
const NIGHT_INTENSIVE_MIN_RECOVERY_DAYS = 2;
const NIGHT_INTENSIVE_MAX_RECOVERY_DAYS = 3;
const NIGHT_BLOCK_MIN_NON_PREF = 2;
const NIGHT_BLOCK_TARGET_MAX_NON_PREF = 3;
const NIGHT_BLOCK_RECOVERY_DAYS = 2;
const NIGHT_BLOCK_MAX_RECOVERY_DAYS = 3;
const CORE_SHIFT_CODES = new Set(['D', 'E', 'N']);
const OFF_OVERRIDE_PENALTY = 60;
const CRITICAL_OVERRIDE_PENALTY = 45;
const TEAM_STACK_BASE_PENALTY = 40;
const TEAM_STACK_DOMINANCE_MULTIPLIER = 50;
const TEAM_STACK_REQUIRED_MULTIPLIER = 35;
const TEAM_UNIQUE_REWARD = 25;
const TEAM_NEED_UNIQUE_PENALTY = 90;
const COVERAGE_SHORTAGE_PENALTY = 600;
const MAX_REPAIR_PASSES = 3;
const OFF_LAG_THRESHOLD = 2;
const SPECIAL_REQUEST_BONUS = 40;
const SPECIAL_REQUEST_OVERRIDE_PENALTY = 120;

function extractShiftCode(shift: Shift & { code?: string }): string {
  if (shift.code) {
    return shift.code.toUpperCase();
  }
  if (shift.id?.startsWith('shift-')) {
    return shift.id.replace('shift-', '').toUpperCase();
  }
  return SHIFT_CODE_MAP[shift.type] ?? shift.id?.toUpperCase() ?? 'D';
}

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function hasShiftPreferences(employee: AiEmployee | undefined): boolean {
  if (!employee?.preferredShiftTypes) {
    return false;
  }
  return Object.keys(employee.preferredShiftTypes).length > 0;
}

function isOffShiftCode(code?: string | null): boolean {
  if (!code) {
    return false;
  }
  const normalized = code.replace(/[^a-z]/gi, '').toUpperCase();
  return normalized === 'O' || normalized === 'OFF';
}

function isCoreShiftCode(code: string): boolean {
  return CORE_SHIFT_CODES.has(code.toUpperCase());
}

function resolveGuaranteedOffDays(employee: AiEmployee | undefined, fallback: number): number {
  if (!employee || typeof employee.guaranteedOffDays !== 'number') {
    return fallback;
  }
  if (!Number.isFinite(employee.guaranteedOffDays)) {
    return fallback;
  }
  return Math.max(fallback, Math.floor(employee.guaranteedOffDays));
}

export async function generateAiSchedule(request: AiScheduleRequest): Promise<AiScheduleGenerationResult> {
  const start = performance.now();
  const context = createSchedulerContext(request);
  logRequiredStaffDebug(context);

  const basePass = await runGenerationPass(request, context, {});
  let bestResult = basePass;
  let bestValidation = await validateSchedule({ ...request, assignments: basePass.assignments });
  let mergedViolations = dedupeViolations([...basePass.violations, ...bestValidation.violations]);

  const seedCandidates = [13, 29, 47];
  for (const seed of seedCandidates) {
    const candidatePass = await runGenerationPass(request, context, { randomSeed: seed });
    const candidateValidation = await validateSchedule({ ...request, assignments: candidatePass.assignments });
    const candidateViolations = dedupeViolations([
      ...candidatePass.violations,
      ...candidateValidation.violations,
    ]);
    if (
      isCandidateBetter(bestValidation, bestResult.violations.length, candidateValidation, candidatePass.violations.length)
    ) {
      bestResult = candidatePass;
      bestValidation = candidateValidation;
      mergedViolations = candidateViolations;
    }
  }

  const lnsIterations = Math.min(5, Math.max(2, Math.floor(context.dateRange.length / 10)));
  for (let iteration = 0; iteration < lnsIterations; iteration += 1) {
    const destroyedDates = chooseLnsWindow(context, bestValidation, iteration);
    if (!destroyedDates || destroyedDates.size === 0) {
      break;
    }
    const lockedAssignments = buildLockedAssignmentMap(bestResult.assignments, destroyedDates);
    const candidatePass = await runGenerationPass(request, context, {
      lockedAssignments,
      destroyedDates,
      randomSeed: iteration + 1,
    });
    const candidateValidation = await validateSchedule({
      ...request,
      assignments: candidatePass.assignments,
    });
    const candidateViolations = dedupeViolations([
      ...candidatePass.violations,
      ...candidateValidation.violations,
    ]);
    if (
      isCandidateBetter(bestValidation, bestResult.violations.length, candidateValidation, candidatePass.violations.length)
    ) {
      bestResult = candidatePass;
      bestValidation = candidateValidation;
      mergedViolations = candidateViolations;
    }
  }

  const repairOutcome = await runRepairIterations(request, context, bestResult, bestValidation, mergedViolations);
  const computationTime = Math.round(performance.now() - start);
  const offAccruals = buildOffAccruals(repairOutcome.result.employeeStates);

  return {
    assignments: repairOutcome.result.assignments,
    violations: repairOutcome.violations,
    score: repairOutcome.validation.score,
    iterations: context.dateRange.length * Math.max(1, context.activeShifts.length),
    computationTime,
    stats: repairOutcome.validation.stats,
    offAccruals,
  };
}

function createSchedulerContext(request: AiScheduleRequest): SchedulerContext {
  const dateRange = eachDayOfInterval({ start: request.startDate, end: request.endDate });
  const holidays = new Set((request.holidays ?? []).map((h) => h.date));
  const restDayKeys = new Set<string>();
  dateRange.forEach((date) => {
    const key = toDateKey(date);
    if (isWeekend(date) || holidays.has(key)) {
      restDayKeys.add(key);
    }
  });

  const specialRequestsMap = new Map<string, AiSpecialRequest[]>();
  (request.specialRequests ?? []).forEach((req) => {
    if (!specialRequestsMap.has(req.date)) {
      specialRequestsMap.set(req.date, []);
    }
    specialRequestsMap.get(req.date)!.push(req);
  });

  const shiftTemplateMap = new Map<string, Shift & { code?: string }>();
  const shiftTemplateById = new Map<string, Shift & { code?: string }>();
  request.shifts.forEach((shift) => {
    const code = extractShiftCode(shift);
    shiftTemplateMap.set(code, shift);
    if (shift.id) {
      shiftTemplateById.set(shift.id.toLowerCase(), shift);
    }
  });

  const activeShifts = request.shifts.filter((shift) => {
    const code = extractShiftCode(shift);
    if (code === 'A') {
      return false;
    }
    return shift.type !== 'off' && shift.type !== 'leave';
  });

  const requiredStaffPerShift: Record<string, number> = {};
  activeShifts.forEach((shift) => {
    const code = extractShiftCode(shift);
    requiredStaffPerShift[code] = request.requiredStaffPerShift?.[code] ?? shift.requiredStaff ?? 1;
  });
  ['D', 'E', 'N'].forEach((coreCode) => {
    if (requiredStaffPerShift[coreCode] === undefined) {
      const templateFallback = shiftTemplateMap.get(coreCode)?.requiredStaff;
      requiredStaffPerShift[coreCode] = Math.max(1, templateFallback ?? 1);
    }
  });

  const teamPools: Record<string, Set<string>> = {};
  activeShifts.forEach((shift) => {
    const code = extractShiftCode(shift).toUpperCase();
    if (!teamPools[code]) {
      teamPools[code] = new Set();
    }
  });
  const employeeMap = new Map<string, AiEmployee>();
  request.employees.forEach((employee) => {
    employeeMap.set(employee.id, employee);
    if (!employee.teamId) {
      return;
    }
    Object.keys(teamPools).forEach((code) => {
      teamPools[code]!.add(employee.teamId!);
    });
  });

  return {
    dateRange,
    holidays,
    restDayKeys,
    maxOffDaysPerEmployee: Math.max(restDayKeys.size, Math.max(4, Math.floor(dateRange.length / 7))),
    shiftTemplateMap,
    shiftTemplateById,
    adminShiftTemplate: shiftTemplateMap.get('A') ?? null,
    activeShifts,
    specialRequestsMap,
    requiredStaffPerShift,
    teamPools,
    employeeMap,
  };
}

function logRequiredStaffDebug(context: SchedulerContext) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  const mapped = Object.entries(context.requiredStaffPerShift)
    .map(([code, count]) => `${code}:${count}`)
    .join(', ');
  console.info(`[ai-scheduler] required staff per shift → ${mapped}`);
}

function initializeEmployeeStates(
  request: AiScheduleRequest,
  context: SchedulerContext,
  previousOffAccruals: Record<string, number>
): Map<string, EmployeeState> {
  const states = new Map<string, EmployeeState>();
  request.employees.forEach((emp) => {
    const nightLeaveDays =
      emp.workPatternType === 'night-intensive'
        ? Math.max(0, request.nightIntensivePaidLeaveDays ?? 0)
        : 0;
    const carryOverOffDays = Math.max(0, previousOffAccruals[emp.id] ?? 0);
    const baseGuaranteedOffDays = resolveGuaranteedOffDays(emp, context.maxOffDaysPerEmployee);
    const maxOffTarget = baseGuaranteedOffDays + nightLeaveDays + carryOverOffDays;
    states.set(emp.id, {
      totalAssignments: 0,
      preferenceScore: 0,
      consecutiveDays: 0,
      consecutiveNights: 0,
      lastAssignedDate: null,
      lastShiftCode: null,
      lastWorkShiftCode: null,
      shiftCounts: {},
      distinctShifts: new Set(),
      rotationLock: null,
      workPatternType: emp.workPatternType ?? 'three-shift',
      offDays: 0,
      specialRequestOffDays: 0,
      autoOffDays: 0,
      maxOffDays: maxOffTarget,
      extraOffDays: 0,
      lastShiftRunCount: 0,
      nightLeaveRemaining: nightLeaveDays,
      bonusOffCarry: carryOverOffDays,
      nightRecoveryDaysNeeded: 0,
    });
  });
  return states;
}

function buildEmployeeOrder(employees: AiEmployee[], seed?: number): AiEmployee[] {
  if (!seed) {
    return [...employees];
  }
  const rng = mulberry32(seed);
  const copy = [...employees];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function mulberry32(a: number) {
  let t = a;
  return function () {
    t += 0x6d2b79f5;
    let m = Math.imul(t ^ (t >>> 15), 1 | t);
    m ^= m + Math.imul(m ^ (m >>> 7), 61 | m);
    return ((m ^ (m >>> 14)) >>> 0) / 4294967296;
  };
}

interface CoverageCandidateOption {
  shiftCode: string;
  shiftId: string;
  score: number;
  preferenceScore: number;
  isNightShift: boolean;
  teamId?: string | null;
}

interface CoverageCandidateEntry {
  employee: AiEmployee;
  options: CoverageCandidateOption[];
}

interface CoverageCandidateParams {
  employees: AiEmployee[];
  assignedToday: Set<string>;
  employeeStates: Map<string, EmployeeState>;
  coverageNeeds: Record<string, number>;
  pattern: string[] | null;
  dayIndex: number;
  avoidPatterns: string[][];
  holidays: Set<string>;
  totalDays: number;
  shifts: (Shift & { code?: string })[];
  date: Date;
  shiftTeams: Record<string, Record<string, number>>;
  allowOffOverride?: boolean;
  specialShiftDemands: Map<string, { code: string; request: AiSpecialRequest }>;
}

function buildCoverageCandidates(params: CoverageCandidateParams): CoverageCandidateEntry[] {
  const requiredTotal = Object.values(params.coverageNeeds).reduce((sum, value) => sum + Math.max(0, value), 0);
  if (requiredTotal === 0) {
    return [];
  }
  const candidates: CoverageCandidateEntry[] = [];
  params.employees.forEach((employee) => {
    if (params.assignedToday.has(employee.id)) {
      return;
    }
    const state = params.employeeStates.get(employee.id);
    if (!state) {
      return;
    }
    const options: CoverageCandidateOption[] = [];
    params.shifts.forEach((shift) => {
      const code = extractShiftCode(shift);
      if ((params.coverageNeeds[code] ?? 0) <= 0) {
        return;
      }
      const existingTeams = params.shiftTeams[code] ?? {};
      const teamCoverage = new Set(Object.keys(existingTeams));
      const demand = params.specialShiftDemands.get(employee.id);
      const evaluation = evaluateCandidateOption({
        employee,
        state,
        shift,
        shiftCode: code,
        date: params.date,
        pattern: params.pattern,
        dayIndex: params.dayIndex,
        avoidPatterns: params.avoidPatterns,
        holidays: params.holidays,
        totalDays: params.totalDays,
        shiftTeams: teamCoverage,
        allowOffOverride: params.allowOffOverride ?? false,
        specialShiftDemandCode: demand?.code ?? null,
      });
      if (!evaluation) {
        return;
      }
      options.push({
        shiftCode: code,
        shiftId: shift.id ?? `shift-${code.toLowerCase()}`,
        score: evaluation.score,
        preferenceScore: evaluation.preferenceScore,
        isNightShift: shift.type === 'night',
        teamId: employee.teamId ?? null,
      });
    });
    if (options.length > 0) {
      options.sort((a, b) => b.score - a.score);
      candidates.push({ employee, options });
    }
  });

  if (candidates.length <= requiredTotal * 2) {
    return candidates;
  }
  return candidates
    .sort((a, b) => a.options.length - b.options.length)
    .slice(0, Math.max(requiredTotal * 2, requiredTotal + 2));
}

interface CoverageSolverParams {
  coverageNeeds: Record<string, number>;
  candidates: CoverageCandidateEntry[];
  initialTeamUsage?: Record<string, Record<string, number>>;
  teamTargets?: Record<string, number>;
}

interface CoverageSolverResult {
  assignments: Map<string, CoverageCandidateOption>;
  shortages: Record<string, number>;
}

function deriveTeamTargets(
  candidates: CoverageCandidateEntry[],
  requiredStaff: Record<string, number>,
  existingTeams: Record<string, Record<string, number>>
): Record<string, number> {
  const pools: Record<string, Set<string>> = {};
  candidates.forEach((candidate) => {
    candidate.options.forEach((option) => {
      if (!option.teamId) {
        return;
      }
      if (!pools[option.shiftCode]) {
        pools[option.shiftCode] = new Set();
      }
      pools[option.shiftCode]!.add(option.teamId);
    });
  });
  const targets: Record<string, number> = {};
  const shiftCodes = new Set([
    ...Object.keys(requiredStaff),
    ...Object.keys(existingTeams),
    ...Object.keys(pools),
  ]);
  shiftCodes.forEach((code) => {
    const required = Math.max(1, Math.floor(requiredStaff[code] ?? 1));
    const pool = pools[code];
    const existing = existingTeams[code] ?? {};
    const existingUnique = Object.keys(existing).length;
    const candidateUnique = pool ? pool.size : 0;
    const totalUnique = candidateUnique + existingUnique;
    if (totalUnique <= 0) {
      return;
    }
    targets[code] = Math.min(required, totalUnique);
  });
  return targets;
}

function solveCoverageWithPrioritySearch(params: CoverageSolverParams): CoverageSolverResult {
  const coverageKeys = Object.keys(params.coverageNeeds);
  const baseNeeds = coverageKeys.reduce<Record<string, number>>((acc, key) => {
    acc[key] = params.coverageNeeds[key];
    return acc;
  }, {});

  const candidateOrder = [...params.candidates].sort((a, b) => a.options.length - b.options.length);
  const bestAssignments = new Map<string, CoverageCandidateOption>();
  const currentAssignments = new Map<string, CoverageCandidateOption>();
  const minOptionCost = candidateOrder.map((candidate) => {
    return Math.min(...candidate.options.map((opt) => Math.max(0, 120 - opt.score)));
  });
  const suffixMinCost: number[] = [];
  for (let i = candidateOrder.length - 1; i >= 0; i -= 1) {
    const existing = suffixMinCost[0] ?? 0;
    suffixMinCost.unshift((minOptionCost[i] ?? 0) + existing);
  }

  let bestCost = Number.POSITIVE_INFINITY;
  const initialTeamUsage = cloneTeamUsageMap(params.initialTeamUsage ?? {});
  const teamTargets = params.teamTargets ?? {};

  const search = (
    index: number,
    cost: number,
    remaining: Record<string, number>,
    teamUsage: Record<string, Record<string, number>>
  ) => {
    if (index < suffixMinCost.length && cost + suffixMinCost[index] >= bestCost) {
      return;
    }
    if (index >= candidateOrder.length) {
      const shortagePenalty = computeCoverageShortagePenalty(remaining);
      const totalCost = cost + shortagePenalty;
      if (totalCost < bestCost) {
        bestCost = totalCost;
        bestAssignments.clear();
        currentAssignments.forEach((value, key) => {
          bestAssignments.set(key, value);
        });
      }
      return;
    }
    const candidate = candidateOrder[index];
    let usedOption = false;
    candidate.options.forEach((option) => {
      if ((remaining[option.shiftCode] ?? 0) <= 0) {
        return;
      }
      usedOption = true;
      remaining[option.shiftCode] -= 1;
      currentAssignments.set(candidate.employee.id, option);
      const teamPenalty = computeTeamStackPenalty(option, teamUsage, baseNeeds, teamTargets);
      applyTeamUsage(teamUsage, option.shiftCode, option.teamId ?? null, 1);
      search(
        index + 1,
        cost + Math.max(0, 120 - option.score) + teamPenalty,
        remaining,
        teamUsage
      );
      applyTeamUsage(teamUsage, option.shiftCode, option.teamId ?? null, -1);
      currentAssignments.delete(candidate.employee.id);
      remaining[option.shiftCode] += 1;
    });

    if (!usedOption) {
      search(index + 1, cost + 5, remaining, teamUsage);
    }
  };

  search(0, 0, { ...baseNeeds }, cloneTeamUsageMap(initialTeamUsage));

  const shortages = coverageKeys.reduce<Record<string, number>>((acc, key) => {
    const remaining = baseNeeds[key] - countAssignmentsForShift(bestAssignments, key);
    acc[key] = Math.max(0, remaining);
    return acc;
  }, {});

  return {
    assignments: bestAssignments,
    shortages,
  };
}

function cloneTeamUsageMap(source: Record<string, Record<string, number>>): Record<string, Record<string, number>> {
  const clone: Record<string, Record<string, number>> = {};
  Object.entries(source).forEach(([shiftCode, teams]) => {
    clone[shiftCode] = { ...teams };
  });
  return clone;
}

function applyTeamUsage(
  usage: Record<string, Record<string, number>>,
  shiftCode: string,
  teamId: string | null,
  delta: number
) {
  if (!teamId) {
    return;
  }
  if (!usage[shiftCode]) {
    usage[shiftCode] = {};
  }
  const next = (usage[shiftCode][teamId] ?? 0) + delta;
  if (next <= 0) {
    delete usage[shiftCode][teamId];
  } else {
    usage[shiftCode][teamId] = next;
  }
}

function computeTeamStackPenalty(
  option: CoverageCandidateOption,
  usage: Record<string, Record<string, number>>,
  baseNeeds: Record<string, number>,
  teamTargets: Record<string, number>
): number {
  if (!option.teamId) {
    return 0;
  }
  const required = baseNeeds[option.shiftCode] ?? 0;
  if (required <= 1) {
    return 0;
  }
  const teamUsage = usage[option.shiftCode] ?? {};
  const existingCount = teamUsage[option.teamId] ?? 0;
  const totalAssigned = Object.values(teamUsage).reduce((sum, value) => sum + value, 0);
  const currentUnique = Object.keys(teamUsage).length;
  const targetUnique = Math.max(1, teamTargets[option.shiftCode] ?? 1);
  const introducingNewTeam = !(option.teamId in teamUsage);

  let penalty = 0;
  if (currentUnique < targetUnique) {
    if (introducingNewTeam) {
      penalty -= TEAM_UNIQUE_REWARD * Math.max(1, targetUnique - currentUnique);
    } else {
      penalty += TEAM_NEED_UNIQUE_PENALTY * Math.max(1, targetUnique - currentUnique);
    }
  }

  if (existingCount === 0 && totalAssigned === 0) {
    return penalty;
  }
  if (existingCount === 0) {
    return penalty + Math.max(0, 10 - currentUnique * 3);
  }
  const dominanceRatio = (existingCount + 1) / Math.max(1, totalAssigned + 1);
  const requiredRatio = (existingCount + 1) / Math.max(1, required);
  penalty +=
    TEAM_STACK_BASE_PENALTY +
    dominanceRatio * TEAM_STACK_DOMINANCE_MULTIPLIER +
    requiredRatio * TEAM_STACK_REQUIRED_MULTIPLIER;
  return penalty;
}

function computeCoverageShortagePenalty(remaining: Record<string, number>): number {
  return Object.values(remaining).reduce((sum, deficit) => {
    if (deficit <= 0) {
      return sum;
    }
    return sum + deficit * COVERAGE_SHORTAGE_PENALTY;
  }, 0);
}

function countAssignmentsForShift(assignments: Map<string, CoverageCandidateOption>, shiftCode: string): number {
  let count = 0;
  assignments.forEach((option) => {
    if (option.shiftCode === shiftCode) {
      count += 1;
    }
  });
  return count;
}

function dedupeViolations(violations: ConstraintViolation[]): ConstraintViolation[] {
  const unique = new Map<string, ConstraintViolation>();
  violations.forEach((violation) => {
    const keyParts = [
      violation.constraintId ?? violation.constraintName ?? 'unknown',
      violation.message,
      (violation.affectedEmployees ?? []).join(','),
      (violation.affectedDates ?? []).map((date) => toDateKey(date instanceof Date ? date : new Date(date))).join(','),
    ];
    const key = keyParts.join('|');
    if (!unique.has(key)) {
      unique.set(key, violation);
    }
  });
  return Array.from(unique.values());
}

function chooseLnsWindow(
  context: SchedulerContext,
  validation: AiScheduleValidationResult,
  iteration: number
): Set<string> | null {
  const violationWithDates = validation.violations.find(
    (violation) => violation.affectedDates && violation.affectedDates.length > 0
  );
  if (violationWithDates) {
    const window = new Set<string>();
    violationWithDates.affectedDates?.forEach((date) => {
      const resolved = date instanceof Date ? date : new Date(date);
      window.add(toDateKey(resolved));
    });
    return window;
  }
  if (context.dateRange.length < 4) {
    return null;
  }
  const windowSize = Math.min(3, Math.floor(context.dateRange.length / 2));
  const maxStart = context.dateRange.length - windowSize;
  const startIndex = Math.max(0, Math.min(maxStart, iteration % Math.max(1, maxStart + 1)));
  const window = new Set<string>();
  for (let i = startIndex; i < startIndex + windowSize; i += 1) {
    window.add(toDateKey(context.dateRange[i]));
  }
  return window;
}

function buildLockedAssignmentMap(
  assignments: ScheduleAssignment[],
  destroyedDates: Set<string>
): LockedAssignmentMap {
  const lockMap: LockedAssignmentMap = new Map();
  assignments.forEach((assignment) => {
    const dateValue = assignment.date instanceof Date ? assignment.date : new Date(assignment.date);
    const dateKey = toDateKey(dateValue);
    if (destroyedDates.has(dateKey)) {
      return;
    }
    if (!lockMap.has(dateKey)) {
      lockMap.set(dateKey, []);
    }
    lockMap.get(dateKey)!.push({
      ...assignment,
      date: dateValue,
      isLocked: true,
    });
  });
  return lockMap;
}

interface RepairAnalysisResult {
  repairDates: Set<string>;
}

function analyzeScheduleForRepairs(assignments: ScheduleAssignment[], context: SchedulerContext): RepairAnalysisResult {
  const perDateShiftCounts: Record<string, Record<string, number>> = {};
  const perDateShiftTeams: Record<string, Record<string, Set<string>>> = {};

  assignments.forEach((assignment) => {
    const resolved = resolveAssignmentShift(assignment, context.shiftTemplateMap, context.shiftTemplateById);
    if (!resolved) {
      return;
    }
    const shiftCode = resolved.shiftCode.toUpperCase();
    if (shiftCode === 'O' || shiftCode === 'L') {
      return;
    }
    const dateValue = assignment.date instanceof Date ? assignment.date : new Date(assignment.date);
    const dateKey = toDateKey(dateValue);
    if (!perDateShiftCounts[dateKey]) {
      perDateShiftCounts[dateKey] = {};
    }
    perDateShiftCounts[dateKey][shiftCode] = (perDateShiftCounts[dateKey][shiftCode] ?? 0) + 1;

    const employee = context.employeeMap.get(assignment.employeeId);
    if (employee?.teamId) {
      if (!perDateShiftTeams[dateKey]) {
        perDateShiftTeams[dateKey] = {};
      }
      if (!perDateShiftTeams[dateKey]![shiftCode]) {
        perDateShiftTeams[dateKey]![shiftCode] = new Set<string>();
      }
      perDateShiftTeams[dateKey]![shiftCode]!.add(employee.teamId);
    }
  });

  const repairDates = new Set<string>();
  context.dateRange.forEach((date) => {
    const dateKey = toDateKey(date);
    if (repairDates.has(dateKey)) {
      return;
    }
    const counts = perDateShiftCounts[dateKey] ?? {};
    for (const shift of context.activeShifts) {
      const code = extractShiftCode(shift).toUpperCase();
      const required = context.requiredStaffPerShift[code] ?? shift.requiredStaff ?? 1;
      if (required <= 0) {
        continue;
      }
      const actual = counts[code] ?? 0;
      if (actual < required) {
        repairDates.add(dateKey);
        break;
      }
      const targetTeams = getTeamTargetForShift(context, code);
      if (targetTeams > 1) {
        const actualTeams = perDateShiftTeams[dateKey]?.[code]?.size ?? 0;
        if (actualTeams < targetTeams) {
          repairDates.add(dateKey);
          break;
        }
      }
    }
  });
  return { repairDates };
}

function getTeamTargetForShift(context: SchedulerContext, shiftCode: string): number {
  const required = context.requiredStaffPerShift[shiftCode] ?? 0;
  const availableTeams = context.teamPools[shiftCode]?.size ?? 0;
  if (required <= 1 || availableTeams <= 1) {
    return Math.min(required, availableTeams);
  }
  return Math.min(required, availableTeams);
}

function extractViolationDates(violations: ConstraintViolation[], constraintId: string): Set<string> {
  const dates = new Set<string>();
  violations.forEach((violation) => {
    if (violation.constraintId !== constraintId) {
      return;
    }
    (violation.affectedDates ?? []).forEach((date) => {
      const resolved = date instanceof Date ? date : new Date(date);
      dates.add(toDateKey(resolved));
    });
  });
  return dates;
}

interface RepairIterationOutcome {
  result: GenerationPassResult;
  validation: AiScheduleValidationResult;
  violations: ConstraintViolation[];
}

async function runRepairIterations(
  request: AiScheduleRequest,
  context: SchedulerContext,
  baseResult: GenerationPassResult,
  baseValidation: AiScheduleValidationResult,
  baseViolations: ConstraintViolation[]
): Promise<RepairIterationOutcome> {
  let currentResult = baseResult;
  let currentValidation = baseValidation;
  let mergedViolations = baseViolations;

  for (let iteration = 0; iteration < MAX_REPAIR_PASSES; iteration += 1) {
    const scheduleAnalysis = analyzeScheduleForRepairs(currentResult.assignments, context);
    const coverageViolationDates = extractViolationDates(currentValidation.violations, 'coverage');
    coverageViolationDates.forEach((dateKey) => scheduleAnalysis.repairDates.add(dateKey));
    if (scheduleAnalysis.repairDates.size === 0) {
      break;
    }
    const lockedAssignments = buildLockedAssignmentMap(currentResult.assignments, scheduleAnalysis.repairDates);
    const candidatePass = await runGenerationPass(request, context, {
      lockedAssignments,
      destroyedDates: scheduleAnalysis.repairDates,
      randomSeed: iteration + 101,
      repairFocusDates: scheduleAnalysis.repairDates,
    });
    const candidateValidation = await validateSchedule({
      ...request,
      assignments: candidatePass.assignments,
    });
    const candidateViolations = dedupeViolations([
      ...candidatePass.violations,
      ...candidateValidation.violations,
    ]);
    if (
      isCandidateBetter(
        currentValidation,
        currentResult.violations.length,
        candidateValidation,
        candidatePass.violations.length
      )
    ) {
      currentResult = candidatePass;
      currentValidation = candidateValidation;
      mergedViolations = candidateViolations;
    }
  }

  return {
    result: currentResult,
    validation: currentValidation,
    violations: mergedViolations,
  };
}

function isCandidateBetter(
  currentValidation: AiScheduleValidationResult,
  currentGenerationViolations: number,
  candidateValidation: AiScheduleValidationResult,
  candidateGenerationViolations: number
): boolean {
  const currentHardViolations = currentValidation.violations.filter((violation) => violation.type === 'hard').length;
  const candidateHardViolations = candidateValidation.violations.filter((violation) => violation.type === 'hard').length;
  if (candidateHardViolations !== currentHardViolations) {
    return candidateHardViolations < currentHardViolations;
  }
  const currentTotal = currentValidation.violations.length + currentGenerationViolations;
  const candidateTotal = candidateValidation.violations.length + candidateGenerationViolations;
  if (candidateTotal !== currentTotal) {
    return candidateTotal < currentTotal;
  }
  return candidateValidation.score.total >= currentValidation.score.total;
}

function buildOffAccruals(employeeStates: Map<string, EmployeeState>): OffAccrualSummary[] {
  const accruals: OffAccrualSummary[] = [];
  employeeStates.forEach((state, employeeId) => {
    const guaranteedOffDays = state.maxOffDays;
    const actualOffDays = state.offDays;
    const extraOffDays = Math.max(0, guaranteedOffDays - actualOffDays);
    accruals.push({
      employeeId,
      extraOffDays,
      guaranteedOffDays,
      actualOffDays,
    });
  });
  return accruals;
}

async function runGenerationPass(
  request: AiScheduleRequest,
  context: SchedulerContext,
  options: GenerationPassOptions
): Promise<GenerationPassResult> {
  const previousOffAccruals = request.previousOffAccruals ?? {};
  const employeeStates = initializeEmployeeStates(request, context, previousOffAccruals);
  const employeeMap = new Map<string, AiEmployee>();
  request.employees.forEach((emp) => employeeMap.set(emp.id, emp));

  const assignments: ScheduleAssignment[] = [];
  const violations: ConstraintViolation[] = [];
  let filledSlots = 0;
  let aggregatedPreferenceScore = 0;
  const pattern = request.teamPattern?.pattern ?? null;
  const avoidPatterns = request.teamPattern?.avoidPatterns ?? [];
  const employeesOrder = buildEmployeeOrder(request.employees, options.randomSeed);

  context.dateRange.forEach((date, dayIndex) => {
    const dateKey = toDateKey(date);
    const assignedToday = new Set<string>();
    const dailyShiftCounts: Record<string, number> = {};
    const dailyShiftTeams: Record<string, Record<string, number>> = {};
    const specialShiftDemands = new Map<string, { code: string; request: AiSpecialRequest }>();
    const finalShiftToday = new Map<string, string>();
    let currentTeamTargets: Record<string, number> = {};
    const todaysLocks = options.lockedAssignments?.get(dateKey) ?? [];
    const todaysRequests = context.specialRequestsMap.get(dateKey) ?? [];
    const isRepairFocusDay = options.repairFocusDates?.has(dateKey) ?? false;

    const getRequiredForShift = (code: string): number => {
      return context.requiredStaffPerShift[code] ?? context.shiftTemplateMap.get(code)?.requiredStaff ?? 1;
    };

    const recordShiftAssignment = (employee: AiEmployee | undefined, shiftCode: string) => {
      const normalized = shiftCode.toUpperCase();
      dailyShiftCounts[normalized] = (dailyShiftCounts[normalized] ?? 0) + 1;
      if (!employee?.teamId) {
        return;
      }
      if (!dailyShiftTeams[normalized]) {
        dailyShiftTeams[normalized] = {};
      }
      const teamCounts = dailyShiftTeams[normalized]!;
      teamCounts[employee.teamId] = (teamCounts[employee.teamId] ?? 0) + 1;
    };

    const assignSupportShift = (
      employee: AiEmployee,
      options?: {
        mode?: 'admin' | 'clinical';
        countTowardsRotation?: boolean;
        allowedCodes?: string[];
        allowOverAllocation?: boolean;
      }
    ): boolean => {
      const mode = options?.mode ?? 'clinical';
      if (mode === 'admin') {
        if (!context.adminShiftTemplate) {
          return false;
        }
        const shiftCode = extractShiftCode(context.adminShiftTemplate);
        const shiftId = context.adminShiftTemplate.id ?? `shift-${shiftCode?.toLowerCase() ?? 'a'}`;
        assignments.push({
          employeeId: employee.id,
          shiftId,
          date,
          isLocked: false,
          isSwapRequested: false,
        });
        assignedToday.add(employee.id);
        const state = employeeStates.get(employee.id)!;
        updateEmployeeState(state, {
          date,
          shiftCode,
          countedAsWork: true,
          countTowardsRotation: false,
        });
        recordShiftAssignment(employee, shiftCode);
        finalShiftToday.set(employee.id, shiftCode);
        filledSlots += 1;
        return true;
      }

      const allowedCodes = options?.allowedCodes;
      const candidateCodes = (allowedCodes && allowedCodes.length ? allowedCodes : ['D', 'E', 'N']).filter((code) =>
        context.shiftTemplateMap.has(code)
      );
      if (candidateCodes.length === 0) {
        return false;
      }
      const enforceNeed = !(options?.allowOverAllocation ?? false);
      const needyCodes = candidateCodes.filter((code) => {
        const required = Math.max(1, getRequiredForShift(code));
        const assigned = dailyShiftCounts[code] ?? 0;
        return assigned < required;
      });
      const usableCodes = enforceNeed && needyCodes.length > 0 ? needyCodes : candidateCodes;
      if (enforceNeed && usableCodes.length === 0) {
        return false;
      }
      let bestCode = usableCodes[0];
      let bestShortage = -1;
      let bestTeamGain = -1;
      let bestTeamGap = -1;
      let bestLoad = Number.POSITIVE_INFINITY;
      usableCodes.forEach((code) => {
        const required = Math.max(1, getRequiredForShift(code));
        const assigned = dailyShiftCounts[code] ?? 0;
        const shortage = Math.max(0, required - assigned);
        const load = assigned / required;
      const teamSet = dailyShiftTeams[code] ?? {};
      const teamTarget = currentTeamTargets[code] ?? getTeamTargetForShift(context, code);
        const teamCount = Object.keys(teamSet).length;
        const teamGap = Math.max(0, teamTarget - teamCount);
        const contributesTeam = teamGap > 0 && employee.teamId && !(teamSet[employee.teamId] >= 1) ? 1 : 0;
        const isBetter =
          shortage > bestShortage ||
          (shortage === bestShortage &&
            (contributesTeam > bestTeamGain ||
              (contributesTeam === bestTeamGain &&
                (teamGap > bestTeamGap || (teamGap === bestTeamGap && load < bestLoad)))));
        if (isBetter) {
          bestCode = code;
          bestShortage = shortage;
          bestTeamGain = contributesTeam;
          bestTeamGap = teamGap;
          bestLoad = load;
        }
      });
      const shiftTemplate = context.shiftTemplateMap.get(bestCode);
      const shiftId = shiftTemplate?.id ?? `shift-${bestCode.toLowerCase()}`;
      assignments.push({
        employeeId: employee.id,
        shiftId,
        date,
        isLocked: false,
        isSwapRequested: false,
      });
      assignedToday.add(employee.id);
      const state = employeeStates.get(employee.id)!;
      updateEmployeeState(state, {
        date,
        shiftCode: bestCode,
        countedAsWork: true,
        isNightShift: bestCode === 'N',
        countTowardsRotation: options?.countTowardsRotation ?? true,
      });
      recordShiftAssignment(employee, bestCode);
      finalShiftToday.set(employee.id, bestCode);
      filledSlots += 1;
      return true;
    };

    const assignOffShift = (
      employee: AiEmployee,
      opts?: { force?: boolean; dayIndex: number; mustPreserveOffQuota?: boolean }
    ) => {
      const state = employeeStates.get(employee.id);
      if (!state) {
        return;
      }
      const force = opts?.force ?? false;
      const mustPreserveOffQuota = opts?.mustPreserveOffQuota ?? false;
      const needsRecovery = state.nightRecoveryDaysNeeded > 0;
      const enforceOff = mustPreserveOffQuota || needsRecovery;
      const daysElapsed = opts?.dayIndex ?? 0;
      const expectedOffByToday = Math.ceil(((daysElapsed + 1) / context.dateRange.length) * state.maxOffDays);
      const offQuotaReached = state.offDays >= state.maxOffDays;
      if (!force && !enforceOff && (state.offDays >= expectedOffByToday || offQuotaReached)) {
        const supportMode: 'admin' | 'clinical' =
          employee.workPatternType === 'weekday-only' ? 'admin' : 'clinical';
        const preferredCodes = employee.workPatternType === 'night-intensive' ? ['N'] : undefined;
        if (
          assignSupportShift(employee, {
            mode: supportMode,
            countTowardsRotation: employee.workPatternType !== 'weekday-only',
            allowedCodes: preferredCodes,
          })
        ) {
          return;
        }
        state.extraOffDays += 1;
      }
      incrementOffCounter(state, 'system');

      assignments.push({
        employeeId: employee.id,
        shiftId: OFF_SHIFT_ID,
        date,
        isLocked: false,
        isSwapRequested: false,
      });
      assignedToday.add(employee.id);
      updateEmployeeState(state, {
        date,
        shiftCode: 'O',
        countedAsWork: false,
      });
      finalShiftToday.set(employee.id, 'O');
      if (state.nightRecoveryDaysNeeded > 0) {
        state.nightRecoveryDaysNeeded = Math.max(0, state.nightRecoveryDaysNeeded - 1);
      }
    };

    // Apply locked assignments (LNS preserved slots)
    todaysLocks.forEach((locked) => {
      if (assignedToday.has(locked.employeeId)) {
        return;
      }
      const employee = employeeMap.get(locked.employeeId);
      const state = employeeStates.get(locked.employeeId);
      if (!employee || !state) {
        return;
      }
      const resolved = resolveAssignmentShift(locked, context.shiftTemplateMap, context.shiftTemplateById);
      if (!resolved) {
        return;
      }
      const shiftCode = resolved.shiftCode;
      const shiftTemplate = resolved.shiftTemplate;
      const countedAsWork = !isOffShiftCode(shiftCode);
      assignments.push({
        employeeId: locked.employeeId,
        shiftId: locked.shiftId ?? (shiftCode === 'O' ? OFF_SHIFT_ID : `shift-${shiftCode.toLowerCase()}`),
        date,
        isLocked: true,
        isSwapRequested: locked.isSwapRequested ?? false,
      });
      assignedToday.add(locked.employeeId);
      updateEmployeeState(state, {
        date,
        shiftCode,
        countedAsWork,
        isNightShift: shiftTemplate?.type === 'night' || shiftCode === 'N',
      });
      if (countedAsWork) {
        recordShiftAssignment(employee, shiftCode);
        finalShiftToday.set(locked.employeeId, shiftCode);
        filledSlots += 1;
      } else if (shiftCode === 'O') {
        incrementOffCounter(state, 'system');
        finalShiftToday.set(locked.employeeId, 'O');
      }
    });

    // Step 1: Apply special requests
    todaysRequests.forEach((req) => {
      if (assignedToday.has(req.employeeId)) {
        return;
      }
      const state = employeeStates.get(req.employeeId);
      const employee = employeeMap.get(req.employeeId);
      if (!state || !employee) {
        return;
      }
      const normalizedRequestType = req.requestType?.toLowerCase() ?? '';
      const normalizedShiftTypeCode = req.shiftTypeCode?.toUpperCase() ?? null;

      let shiftId = OFF_SHIFT_ID;
      let shiftCode = 'O';
      let countedAsWork = false;

      if (req.requestType === 'shift_request' && normalizedShiftTypeCode) {
        if (isOffShiftCode(normalizedShiftTypeCode)) {
          shiftCode = 'O';
          shiftId = OFF_SHIFT_ID;
          countedAsWork = false;
        } else {
          shiftCode = normalizedShiftTypeCode;
          shiftId = `shift-${shiftCode.toLowerCase()}`;
          countedAsWork = true;
        }
      } else if (normalizedRequestType === 'overtime' || normalizedRequestType === 'extra_shift') {
        shiftCode = 'D';
        shiftId = 'shift-d';
        countedAsWork = true;
      } else if (OFF_REQUEST_KEYWORDS.has(normalizedRequestType)) {
        shiftCode = 'O';
        shiftId = OFF_SHIFT_ID;
        countedAsWork = false;
      }

      const isOffRequest = !countedAsWork && isOffShiftCode(shiftCode);
      if (isOffRequest && state.offDays >= state.maxOffDays) {
        violations.push({
          constraintId: 'special_request_off_quota',
          constraintName: '특별 요청 휴무 한도',
          type: 'soft',
          severity: 'medium',
          message: `${employee?.name ?? req.employeeId}님은 월 최대 휴무(${state.maxOffDays}일)를 이미 채워 ${dateKey} OFF 요청을 수용할 수 없습니다.`,
          affectedEmployees: [req.employeeId],
          affectedDates: [date],
          cost: 3,
        });
        return;
      }

      if (countedAsWork) {
        specialShiftDemands.set(req.employeeId, { code: shiftCode, request: req });
        return;
      }

      assignments.push({
        employeeId: req.employeeId,
        shiftId,
        date,
        isLocked: true,
        isSwapRequested: false,
      });

      assignedToday.add(req.employeeId);
      updateEmployeeState(state, {
        date,
        shiftCode,
        countedAsWork,
      });
      if (isOffRequest) {
        incrementOffCounter(state, 'special-request');
        finalShiftToday.set(req.employeeId, 'O');
      }
      // countedAsWork already handled via coverage stage
    });

    // Step 1.1 Night recovery enforcement
    employeesOrder.forEach((employee) => {
      if (assignedToday.has(employee.id)) {
        return;
      }
      const state = employeeStates.get(employee.id);
      if (!state) {
        return;
      }
      const hasPreferences = hasShiftPreferences(employee);
      const isNightIntensive = employee.workPatternType === 'night-intensive';
      const participatesInNightBlock =
        isNightIntensive || (!hasPreferences && employee.workPatternType !== 'weekday-only');
      if (!participatesInNightBlock) {
        return;
      }
      const lastShiftWasNight = state.lastShiftCode === 'N';
      if (state.nightRecoveryDaysNeeded <= 0 && lastShiftWasNight) {
        if (isNightIntensive) {
          const configuredMaxNights =
            employee.maxConsecutiveNightsPreferred ?? DEFAULT_MAX_CONSECUTIVE_NIGHT['night-intensive'];
          const recoveryTrigger = Math.min(configuredMaxNights, NIGHT_INTENSIVE_RECOVERY_MIN_STREAK);
          if (state.consecutiveNights >= recoveryTrigger) {
            const extraNights = state.consecutiveNights - recoveryTrigger;
            const targetRecoveryDays = Math.min(
              NIGHT_INTENSIVE_MAX_RECOVERY_DAYS,
              NIGHT_INTENSIVE_MIN_RECOVERY_DAYS + (extraNights > 0 ? 1 : 0)
            );
            state.nightRecoveryDaysNeeded = Math.max(state.nightRecoveryDaysNeeded, targetRecoveryDays);
          }
        } else if (state.consecutiveNights >= NIGHT_BLOCK_MIN_NON_PREF) {
          const extraNights = Math.max(0, state.consecutiveNights - NIGHT_BLOCK_MIN_NON_PREF);
          const targetRecoveryDays = Math.min(
            NIGHT_BLOCK_MAX_RECOVERY_DAYS,
            NIGHT_BLOCK_RECOVERY_DAYS + (extraNights > 0 ? 1 : 0)
          );
          state.nightRecoveryDaysNeeded = Math.max(state.nightRecoveryDaysNeeded, targetRecoveryDays);
        }
      }
      if (state.nightRecoveryDaysNeeded > 0) {
        assignOffShift(employee, { force: true, dayIndex, mustPreserveOffQuota: true });
      }
    });

    const isWeekendDay = isWeekend(date);
    const isHoliday = context.holidays.has(dateKey);
    const isSpecialDay = isWeekendDay || isHoliday;

    // Step 1.5 weekday-only handling
    employeesOrder.forEach((employee) => {
      if (employee.workPatternType !== 'weekday-only' || assignedToday.has(employee.id)) {
        return;
      }
      if (!isSpecialDay) {
        if (!assignSupportShift(employee, { mode: 'admin', countTowardsRotation: false })) {
          assignOffShift(employee, { dayIndex });
        }
      } else {
        assignOffShift(employee, { force: true, dayIndex });
      }
    });

    // Step 2: CP-SAT inspired coverage solver
    const coverageNeeds: Record<string, number> = {};
    context.activeShifts.forEach((shift) => {
      const code = extractShiftCode(shift);
      const required = context.requiredStaffPerShift[code] ?? shift.requiredStaff ?? 1;
      const already = dailyShiftCounts[code] ?? 0;
      coverageNeeds[code] = Math.max(0, required - already);
    });

    const coverageCandidates = buildCoverageCandidates({
      employees: employeesOrder,
      assignedToday,
      employeeStates,
      coverageNeeds,
      pattern,
      dayIndex,
      avoidPatterns,
      holidays: context.holidays,
      totalDays: context.dateRange.length,
      shifts: context.activeShifts,
      date,
      shiftTeams: dailyShiftTeams,
      allowOffOverride: isRepairFocusDay,
      specialShiftDemands,
    });
    const teamTargets = deriveTeamTargets(coverageCandidates, context.requiredStaffPerShift, dailyShiftTeams);
    currentTeamTargets = { ...teamTargets };

    const coverageSolution = solveCoverageWithPrioritySearch({
      coverageNeeds,
      candidates: coverageCandidates,
      initialTeamUsage: dailyShiftTeams,
      teamTargets,
    });
    let remainingShortages = coverageSolution.shortages;

    coverageSolution.assignments.forEach((option, employeeId) => {
      const employee = employeeMap.get(employeeId);
      const state = employeeStates.get(employeeId);
      if (!employee || !state) {
        return;
      }
      assignments.push({
        employeeId,
        shiftId: option.shiftId,
        date,
        isLocked: false,
        isSwapRequested: false,
      });
      assignedToday.add(employeeId);
      updateEmployeeState(state, {
        date,
        shiftCode: option.shiftCode,
        countedAsWork: true,
        isNightShift: option.isNightShift,
      });
      state.preferenceScore += option.preferenceScore;
      aggregatedPreferenceScore += Math.max(option.preferenceScore, 0);
      recordShiftAssignment(employee, option.shiftCode);
      finalShiftToday.set(employeeId, option.shiftCode);
      filledSlots += 1;
    });

    if (Object.values(remainingShortages).some((value) => value > 0)) {
      const overrideCandidates = buildCoverageCandidates({
        employees: employeesOrder,
        assignedToday,
        employeeStates,
        coverageNeeds: remainingShortages,
        pattern,
        dayIndex,
        avoidPatterns,
        holidays: context.holidays,
        totalDays: context.dateRange.length,
        shifts: context.activeShifts,
        date,
        shiftTeams: dailyShiftTeams,
        allowOffOverride: true,
        specialShiftDemands,
      });
      if (overrideCandidates.length > 0) {
        const overrideTargets = deriveTeamTargets(overrideCandidates, context.requiredStaffPerShift, dailyShiftTeams);
        const overrideSolution = solveCoverageWithPrioritySearch({
          coverageNeeds: remainingShortages,
          candidates: overrideCandidates,
          initialTeamUsage: dailyShiftTeams,
          teamTargets: overrideTargets,
        });
        currentTeamTargets = { ...currentTeamTargets, ...overrideTargets };
        remainingShortages = overrideSolution.shortages;
        overrideSolution.assignments.forEach((option, employeeId) => {
          const employee = employeeMap.get(employeeId);
          const state = employeeStates.get(employeeId);
          if (!employee || !state) {
            return;
          }
          assignments.push({
            employeeId,
            shiftId: option.shiftId,
            date,
            isLocked: false,
            isSwapRequested: false,
          });
          assignedToday.add(employeeId);
          updateEmployeeState(state, {
            date,
            shiftCode: option.shiftCode,
            countedAsWork: true,
            isNightShift: option.isNightShift,
          });
          state.preferenceScore += option.preferenceScore;
          aggregatedPreferenceScore += Math.max(option.preferenceScore, 0);
          recordShiftAssignment(employee, option.shiftCode);
          finalShiftToday.set(employeeId, option.shiftCode);
          filledSlots += 1;
        });
      }
    }

    Object.entries(remainingShortages).forEach(([shiftCode, shortage]) => {
      if (shortage <= 0) {
        return;
      }
      violations.push({
        constraintId: 'coverage',
        constraintName: '근무 커버리지',
        type: 'hard',
        severity: 'high',
        message: `${dateKey} ${shiftCode} 근무를 ${shortage}명 채우지 못했습니다.`,
        affectedEmployees: [],
        affectedDates: [date],
        cost: 10,
      });
    });

    // Step 3: assign off/support to remaining
    employeesOrder.forEach((employee) => {
      if (assignedToday.has(employee.id)) {
        return;
      }
      const state = employeeStates.get(employee.id);
      if (!state) {
        return;
      }
      const remainingOffNeeded = Math.max(0, state.maxOffDays - state.offDays);
      const daysRemainingIncludingToday = context.dateRange.length - dayIndex;
      const isNightIntensive = state.workPatternType === 'night-intensive';
      const shortageWithoutToday = remainingOffNeeded > daysRemainingIncludingToday - 1;
      const noSlackForNight =
        isNightIntensive && remainingOffNeeded >= daysRemainingIncludingToday && remainingOffNeeded > 0;
      const mustPreserveOffQuota = shortageWithoutToday || noSlackForNight;
      assignOffShift(employee, {
        dayIndex,
        force: noSlackForNight,
        mustPreserveOffQuota,
      });
    });

    specialShiftDemands.forEach(({ code, request }, employeeId) => {
      const actual = finalShiftToday.get(employeeId);
      if (actual === code) {
        return;
      }
      const actualLabel = actual ? (actual === 'O' ? 'OFF' : actual) : '미배정';
      violations.push({
        constraintId: 'special_request_override',
        constraintName: '특별 요청 미반영',
        type: 'soft',
        severity: 'medium',
        message: `${request.employeeId}님의 ${dateKey} ${code} 요청이 팀 커버리지 때문에 ${actualLabel}로 대체되었습니다.`,
        affectedEmployees: [employeeId],
        affectedDates: [date],
        cost: 4,
      });
    });
    specialShiftDemands.clear();
  });

  return {
    assignments,
    employeeStates,
    filledSlots,
    aggregatedPreferenceScore,
    violations,
  };
}

export async function validateSchedule(
  request: AiScheduleValidationRequest
): Promise<AiScheduleValidationResult> {
  const start = performance.now();
  const dateRange = eachDayOfInterval({ start: request.startDate, end: request.endDate });
  const holidays = new Set((request.holidays ?? []).map((h) => h.date));
  const restDayKeys = new Set<string>();
  dateRange.forEach((date) => {
    const key = toDateKey(date);
    if (isWeekend(date) || holidays.has(key)) {
      restDayKeys.add(key);
    }
  });
  const maxOffDaysPerEmployee = Math.max(restDayKeys.size, Math.max(4, Math.floor(dateRange.length / 7)));

  const shiftTemplateMap = new Map<string, Shift & { code?: string }>();
  const shiftTemplateById = new Map<string, Shift & { code?: string }>();
  request.shifts.forEach((shift) => {
    const code = extractShiftCode(shift);
    shiftTemplateMap.set(code, shift);
    if (shift.id) {
      shiftTemplateById.set(shift.id.toLowerCase(), shift);
    }
  });

  const activeShifts = request.shifts.filter((shift) => {
    const code = extractShiftCode(shift);
    if (code === 'A') {
      return false;
    }
    return shift.type !== 'off' && shift.type !== 'leave';
  });

  const totalRequiredSlots =
    dateRange.length *
    activeShifts.reduce((sum, shift) => {
      const code = extractShiftCode(shift);
      const required = request.requiredStaffPerShift?.[code] ?? shift.requiredStaff ?? 1;
      return sum + required;
    }, 0);

  const employeeStates = new Map<string, EmployeeState>();
  const employeeMap = new Map<string, AiEmployee>();
  const previousOffAccruals = request.previousOffAccruals ?? {};
  request.employees.forEach((emp) => {
    const nightLeaveDays =
      emp.workPatternType === 'night-intensive'
        ? Math.max(0, request.nightIntensivePaidLeaveDays ?? 0)
        : 0;
    const carryOverOffDays = Math.max(0, previousOffAccruals[emp.id] ?? 0);
    const baseGuaranteedOffDays = resolveGuaranteedOffDays(emp, maxOffDaysPerEmployee);
    const maxOffTarget = baseGuaranteedOffDays + nightLeaveDays + carryOverOffDays;
    employeeStates.set(emp.id, {
      totalAssignments: 0,
      preferenceScore: 0,
      consecutiveDays: 0,
      consecutiveNights: 0,
      lastAssignedDate: null,
      lastShiftCode: null,
      lastWorkShiftCode: null,
      shiftCounts: {},
      distinctShifts: new Set(),
      rotationLock: null,
      workPatternType: emp.workPatternType ?? 'three-shift',
      offDays: 0,
      specialRequestOffDays: 0,
      autoOffDays: 0,
      maxOffDays: maxOffTarget,
      extraOffDays: 0,
      lastShiftRunCount: 0,
      nightLeaveRemaining: nightLeaveDays,
      bonusOffCarry: carryOverOffDays,
      nightRecoveryDaysNeeded: 0,
    });
    employeeMap.set(emp.id, emp);
  });

  const assignmentMap = new Map<string, ScheduleAssignment[]>();
  const rangeStart = request.startDate.getTime();
  const rangeEnd = request.endDate.getTime();
  const violations: ConstraintViolation[] = [];

  request.assignments.forEach((assignment) => {
    const dateValue = assignment.date instanceof Date ? assignment.date : new Date(assignment.date);
    if (Number.isNaN(dateValue.getTime())) {
      violations.push(
        createViolation({
          id: 'invalid_assignment_date',
          name: '유효하지 않은 날짜',
          message: `배정 ${assignment.employeeId} 의 날짜 형식이 올바르지 않습니다.`,
          type: 'hard',
          severity: 'high',
          employees: [assignment.employeeId],
          dates: [],
          cost: 20,
        })
      );
      return;
    }

    if (dateValue.getTime() < rangeStart || dateValue.getTime() > rangeEnd) {
      violations.push(
        createViolation({
          id: 'assignment_out_of_range',
          name: '범위를 벗어난 배정',
          message: `${assignment.employeeId} 배정이 기간 밖(${format(dateValue, 'yyyy-MM-dd')})에 존재합니다.`,
          type: 'soft',
          severity: 'medium',
          employees: [assignment.employeeId],
          dates: [dateValue],
          cost: 5,
        })
      );
    }

    const key = toDateKey(dateValue);
    if (!assignmentMap.has(key)) {
      assignmentMap.set(key, []);
    }
    assignmentMap.get(key)!.push({
      ...assignment,
      date: dateValue,
    });
  });

  let filledSlots = 0;
  let preferencePenalty = 0;

  dateRange.forEach((date, dayIndex) => {
    const dateKey = toDateKey(date);
    const todaysAssignments = assignmentMap.get(dateKey) ?? [];
    const assignedToday = new Set<string>();
    const dailyShiftCounts: Record<string, number> = {};

    todaysAssignments.forEach((assignment) => {
      const employee = employeeMap.get(assignment.employeeId);
      if (!employee) {
        violations.push(
          createViolation({
            id: 'employee_missing',
            name: '존재하지 않는 직원',
            message: `배정된 직원 ${assignment.employeeId} 를 찾을 수 없습니다.`,
            type: 'hard',
            severity: 'critical',
            employees: [assignment.employeeId],
            dates: [assignment.date],
            cost: 25,
          })
        );
        return;
      }
      const state = employeeStates.get(employee.id);
      if (!state) {
        return;
      }

      const resolvedShift = resolveAssignmentShift(assignment, shiftTemplateMap, shiftTemplateById);
      if (!resolvedShift) {
        violations.push(
          createViolation({
            id: 'shift_missing',
            name: '존재하지 않는 시프트',
            message: `배정된 시프트 ${assignment.shiftId} 를 찾을 수 없습니다.`,
            type: 'hard',
            severity: 'high',
            employees: [employee.id],
            dates: [assignment.date],
            cost: 20,
          })
        );
        preferencePenalty += 10;
        return;
      }

      const { shiftCode, shiftTemplate } = resolvedShift;
      const normalizedShiftCode = shiftCode.toUpperCase();
      const countedAsWork = normalizedShiftCode !== 'O' && normalizedShiftCode !== 'L';
      const isNightShift = normalizedShiftCode === 'N' || shiftTemplate?.type === 'night';

      if (assignedToday.has(employee.id)) {
        violations.push(
          createViolation({
            id: 'duplicate_assignment',
            name: '중복 배정',
            message: `${employee.name ?? employee.id}님이 ${dateKey}에 중복 배정되었습니다.`,
            type: 'hard',
            severity: 'high',
            employees: [employee.id],
            dates: [assignment.date],
            cost: 30,
          })
        );
        preferencePenalty += 10;
        return;
      }
      assignedToday.add(employee.id);

      const ruleResult = evaluateAssignmentRules({
        employee,
        state,
        shiftCode: normalizedShiftCode,
        date,
        dayIndex,
        countedAsWork,
        isNightShift,
        hasPreferences: hasShiftPreferences(employee),
      });
      preferencePenalty += ruleResult.penalty;
      violations.push(...ruleResult.violations);

      updateEmployeeState(state, {
        date,
        shiftCode: normalizedShiftCode,
        countedAsWork,
        isNightShift,
      });

      if (!countedAsWork && normalizedShiftCode === 'O') {
        incrementOffCounter(state, 'system');
        state.nightRecoveryDaysNeeded = Math.max(0, state.nightRecoveryDaysNeeded - 1);
      } else if (countedAsWork) {
        filledSlots += 1;
        dailyShiftCounts[normalizedShiftCode] = (dailyShiftCounts[normalizedShiftCode] ?? 0) + 1;
      }
    });

    activeShifts.forEach((shift) => {
      const targetCode = extractShiftCode(shift);
      const required = request.requiredStaffPerShift?.[targetCode] ?? shift.requiredStaff ?? 1;
      if (required <= 0) {
        return;
      }
      const actual = dailyShiftCounts[targetCode] ?? 0;
      if (actual < required) {
        violations.push(
          createViolation({
            id: 'coverage',
            name: '근무 커버리지',
            message: `${dateKey} ${shift.name} 근무가 ${required - actual}명 부족합니다.`,
            type: 'hard',
            severity: 'high',
            dates: [date],
            cost: 15,
          })
        );
      }
    });
  });

  employeeStates.forEach((state, employeeId) => {
    if (state.offDays < state.maxOffDays) {
      violations.push(
        createViolation({
          id: 'off_quota_short',
          name: '휴무 보장 미달',
          message: `${employeeId}님이 보장 휴무 ${state.maxOffDays}일 대비 ${state.offDays}일만 배정되었습니다.`,
          type: 'soft',
          severity: 'medium',
          employees: [employeeId],
          cost: 5,
        })
      );
      preferencePenalty += 5;
    }
    if (state.nightRecoveryDaysNeeded > 0) {
      violations.push(
        createViolation({
          id: 'night_recovery_missing',
          name: '야간 회복 휴무 부족',
          message: `${employeeId}님에게 필요한 회복 휴무 ${state.nightRecoveryDaysNeeded}일이 남아 있습니다.`,
          type: 'soft',
          severity: 'medium',
          employees: [employeeId],
          cost: 5,
        })
      );
      preferencePenalty += 5;
    }
  });

  const fairnessIndex = calculateFairnessIndex(
    request.employees.map((emp) => employeeStates.get(emp.id)?.totalAssignments ?? 0)
  );
  const coverageRate = totalRequiredSlots === 0 ? 1 : Math.min(1, filledSlots / totalRequiredSlots);
  const preferenceScore = Math.max(0, 100 - preferencePenalty);

  const score: ScheduleScore = {
    total: Math.round(fairnessIndex * 50 + coverageRate * 40 + preferenceScore * 0.1),
    fairness: Math.round(fairnessIndex * 100),
    preference: Math.round(preferenceScore),
    coverage: Math.round(coverageRate * 100),
    constraintSatisfaction: Math.max(0, 100 - violations.length * 5),
    breakdown: [
      { category: 'fairness', score: Math.round(fairnessIndex * 100), weight: 0.5, details: 'Jain 공정성 지수' },
      { category: 'coverage', score: Math.round(coverageRate * 100), weight: 0.4, details: '필요 인원 커버리지' },
      { category: 'preference', score: Math.round(preferenceScore), weight: 0.1, details: '패턴 선호도 준수' },
    ],
  };

  return {
    violations,
    score,
    stats: {
      fairnessIndex,
      coverageRate,
      preferenceScore,
    },
    computationTime: Math.round(performance.now() - start),
  };
}

interface CandidateEvaluation {
  employee: AiEmployee;
  score: number;
  preferenceScore: number;
}

interface CandidateEvaluationParams {
  employee: AiEmployee;
  state: EmployeeState;
  shift: Shift & { code?: string };
  shiftCode: string;
  date: Date;
  pattern: string[] | null;
  dayIndex: number;
  avoidPatterns: string[][];
  holidays: Set<string>;
  totalDays: number;
  shiftTeams: Set<string>;
  allowOffOverride?: boolean;
  specialShiftDemandCode: string | null;
}

function evaluateCandidateOption(params: CandidateEvaluationParams): CandidateEvaluation | null {
  const normalizedShiftCode = params.shiftCode.toUpperCase();
  const isCoreShift = isCoreShiftCode(normalizedShiftCode);
  const { employee, state } = params;
  const allowOverride = params.allowOffOverride ?? false;
  let criticalOverrideCount = 0;
  let specialRequestPenalty = 0;

  if (employee.workPatternType === 'weekday-only') {
    return null;
  }
  if (employee.workPatternType === 'night-intensive' && normalizedShiftCode !== 'N') {
    if (!allowOverride) {
      return null;
    }
    criticalOverrideCount += 2;
  }

  const daysElapsed = params.dayIndex + 1;
  const expectedOffByToday = Math.ceil((daysElapsed / params.totalDays) * state.maxOffDays);
  const offLag = expectedOffByToday - state.offDays;
  const remainingOffNeeded = Math.max(0, state.maxOffDays - state.offDays);
  const daysLeftAfterToday = params.totalDays - params.dayIndex - 1;
  const isNightIntensive = employee.workPatternType === 'night-intensive';
  const zeroSlack = isNightIntensive && remainingOffNeeded === daysLeftAfterToday && remainingOffNeeded > 0;
  let usedOffOverride = false;
  if (remainingOffNeeded > daysLeftAfterToday || zeroSlack) {
    if (!allowOverride) {
      return null;
    }
    usedOffOverride = true;
    criticalOverrideCount += 1;
  }

  if (offLag >= OFF_LAG_THRESHOLD) {
    if (!allowOverride) {
      return null;
    }
    criticalOverrideCount += 1;
  }

  if (
    employee.workPatternType === 'night-intensive' &&
    !hasShiftPreferences(employee) &&
    state.nightRecoveryDaysNeeded > 0
  ) {
    if (!allowOverride) {
      return null;
    }
    criticalOverrideCount += 2;
  }

  if (
    isCoreShift &&
    state.workPatternType === 'three-shift' &&
    state.rotationLock &&
    state.rotationLock === normalizedShiftCode
  ) {
    if (!allowOverride) {
      return null;
    }
    criticalOverrideCount += 1;
  }

  if (state.lastShiftCode === 'N' && normalizedShiftCode === 'D') {
    if (!allowOverride) {
      return null;
    }
    criticalOverrideCount += 1;
  }

  const requestedShift = params.specialShiftDemandCode;
  if (requestedShift) {
    if (requestedShift === normalizedShiftCode) {
      specialRequestPenalty -= SPECIAL_REQUEST_BONUS;
    } else {
      specialRequestPenalty += SPECIAL_REQUEST_OVERRIDE_PENALTY;
    }
  }

  const baseScore = calculateCandidateScore({
    employee,
    state,
    date: params.date,
    shift: params.shift,
    shiftCode: params.shiftCode,
    pattern: params.pattern,
    dayIndex: params.dayIndex,
    avoidPatterns: params.avoidPatterns,
    holidays: params.holidays,
    totalDays: params.totalDays,
    teamCoverage: params.shiftTeams,
  });
  let adjustedScore = baseScore.score - specialRequestPenalty;
  if (usedOffOverride) {
    adjustedScore -= OFF_OVERRIDE_PENALTY;
  }
  if (criticalOverrideCount > 0) {
    adjustedScore -= criticalOverrideCount * CRITICAL_OVERRIDE_PENALTY;
  }
  return {
    employee,
    score: adjustedScore,
    preferenceScore: baseScore.preferenceScore,
  };
}

interface CandidateScoreParams {
  employee: AiEmployee;
  state: EmployeeState;
  date: Date;
  shift: Shift & { code?: string };
  shiftCode: string;
  pattern: string[] | null;
  dayIndex: number;
  avoidPatterns: string[][];
  holidays: Set<string>;
  totalDays: number;
  teamCoverage: Set<string>;
}

function calculateCandidateScore(params: CandidateScoreParams) {
  const {
    employee,
    state,
    date,
    shift,
    shiftCode,
    pattern,
    dayIndex,
    avoidPatterns,
    holidays,
    totalDays,
    teamCoverage,
  } = params;

  let score = 100;
  const normalizedShiftCode = shiftCode.toUpperCase();
  const isCoreShift = isCoreShiftCode(normalizedShiftCode);
  const hasPreferenceWeights = !!employee.preferredShiftTypes && Object.keys(employee.preferredShiftTypes).length > 0;

  const workPattern = employee.workPatternType ?? 'three-shift';
  const lastWorkShift = state.lastWorkShiftCode;
  if (!hasPreferenceWeights && lastWorkShift) {
    if (lastWorkShift === 'D') {
      if (normalizedShiftCode === 'E') {
        score += 20;
      }
      if (normalizedShiftCode === 'N') {
        score -= 15;
      }
    } else if (lastWorkShift === 'E') {
      if (normalizedShiftCode === 'N') {
        score += 20;
      }
      if (normalizedShiftCode === 'D') {
        score -= 25;
      }
      if (normalizedShiftCode === 'E') {
        score -= 35;
      }
    } else if (lastWorkShift === 'N') {
      if (normalizedShiftCode === 'E') {
        score += 15;
      }
      if (normalizedShiftCode === 'D') {
        score -= 50;
      }
    }
  }

  const workedShifts = Object.values(state.shiftCounts).reduce((sum, value) => sum + value, 0);
  if (!hasPreferenceWeights && workedShifts > 0) {
    const dRatio = (state.shiftCounts['D'] ?? 0) / workedShifts;
    if (normalizedShiftCode === 'D') {
      score -= 15 + dRatio * 40;
    }
    const eRatio = (state.shiftCounts['E'] ?? 0) / workedShifts;
    const nRatio = (state.shiftCounts['N'] ?? 0) / workedShifts;
    if (normalizedShiftCode === 'E' && eRatio > nRatio + 0.2) {
      score -= 10;
    }
    if (normalizedShiftCode === 'N' && nRatio < 0.2) {
      score += 5;
    }
  }
  if (!hasPreferenceWeights) {
    const consecutiveNights = state.consecutiveNights;
    if (consecutiveNights > 0 && consecutiveNights < NIGHT_BLOCK_MIN_NON_PREF && normalizedShiftCode !== 'N') {
      score -= 30;
    }
    if (normalizedShiftCode === 'N') {
      if (consecutiveNights > 0 && consecutiveNights < NIGHT_BLOCK_TARGET_MAX_NON_PREF) {
        score += 15;
      }
      if (consecutiveNights >= NIGHT_BLOCK_TARGET_MAX_NON_PREF) {
        score -= 35;
      }
    }
  }

  const maxConsecutive =
    employee.maxConsecutiveDaysPreferred ?? DEFAULT_MAX_CONSECUTIVE[workPattern as WorkPatternType];
  const maxConsecutiveNight =
    employee.maxConsecutiveNightsPreferred ?? DEFAULT_MAX_CONSECUTIVE_NIGHT[workPattern as WorkPatternType];

  // Consecutive work constraint
  if (state.lastAssignedDate) {
    const diff = differenceInCalendarDays(date, state.lastAssignedDate);
    if (diff === 1 && state.consecutiveDays >= maxConsecutive) {
      return { score: Number.NEGATIVE_INFINITY, preferenceScore: -50 };
    }
    if (shift.type === 'night' && diff === 1 && state.consecutiveNights >= maxConsecutiveNight) {
      return { score: Number.NEGATIVE_INFINITY, preferenceScore: -50 };
    }
  }

  // Weekend handling for weekday-only employees
  if (workPattern === 'weekday-only') {
    if (shift.type === 'night') {
      score -= 60;
    }
    if (isWeekend(date) || holidays.has(format(date, 'yyyy-MM-dd'))) {
      score -= 30;
    }
  }

  if (workPattern === 'night-intensive' && shift.type === 'night') {
    score += 25;
  }

  // Pattern alignment bonus
  if (pattern && pattern.length > 0) {
    const expectedShift = pattern[dayIndex % pattern.length];
    if (expectedShift.toUpperCase() === normalizedShiftCode) {
      score += 10;
    }
  }

  // Avoid pattern penalty
  avoidPatterns.forEach((avoidPattern) => {
    if (!state.lastShiftCode) return;
    const recentHistory = [state.lastShiftCode, normalizedShiftCode];
    if (avoidPattern.join('-') === recentHistory.join('-')) {
      score -= 40;
    }
  });

  // Fairness: fewer assignments preferred
  score -= state.totalAssignments * 2;

  // Preference weights
  const preferenceWeight = employee.preferredShiftTypes?.[shiftCode] ?? 0;
  score += preferenceWeight * 5;

  if (isCoreShift && state.workPatternType === 'three-shift' && state.distinctShifts.size < 2) {
    const isNewShift = !state.distinctShifts.has(normalizedShiftCode);
    if (isNewShift) {
      score += 20;
    } else {
      score -= 40;
      const daysRemaining = totalDays - dayIndex - 1;
      if (daysRemaining <= 3) {
        score -= 40;
      }
    }
  }

  if (!hasPreferenceWeights) {
    if (!isCoreShift) {
      if (state.lastShiftCode === normalizedShiftCode) {
        score -= Math.min(40, state.lastShiftRunCount * 15);
      }
      const ownedCount = state.shiftCounts[normalizedShiftCode] ?? 0;
      if (ownedCount > 0) {
        score -= ownedCount * 12;
      }
    }

    const totalAssignments = state.totalAssignments;
    if (totalAssignments > 0) {
      const counts = Object.values(state.shiftCounts);
      if (counts.length > 0) {
        const maxCount = Math.max(...counts);
        const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
        if (maxCount > avg + 4) {
          score -= 10;
        }
      }
    }
  }

  if (employee.teamId) {
    if (!teamCoverage.has(employee.teamId)) {
      score += 15;
    } else {
      score -= 5;
    }
  }

  return { score, preferenceScore: preferenceWeight };
}

function updateEmployeeState(
  state: EmployeeState,
  params: {
    date: Date;
    shiftCode: string;
    countedAsWork: boolean;
    isNightShift?: boolean;
    countTowardsRotation?: boolean;
  }
) {
  const { date, shiftCode, countedAsWork, isNightShift, countTowardsRotation = true } = params;
  const normalizedShiftCode = shiftCode.toUpperCase();

  if (countedAsWork) {
    if (state.lastAssignedDate) {
      const diff = differenceInCalendarDays(date, state.lastAssignedDate);
      state.consecutiveDays = diff === 1 ? state.consecutiveDays + 1 : 1;
      state.consecutiveNights = isNightShift ? (diff === 1 ? state.consecutiveNights + 1 : 1) : 0;
    } else {
      state.consecutiveDays = 1;
      state.consecutiveNights = isNightShift ? 1 : 0;
    }
    if (state.lastShiftCode === normalizedShiftCode) {
      state.lastShiftRunCount = state.lastShiftRunCount + 1;
    } else {
      state.lastShiftRunCount = 1;
    }
    state.totalAssignments += 1;

    if (countTowardsRotation) {
      state.shiftCounts[normalizedShiftCode] = (state.shiftCounts[normalizedShiftCode] ?? 0) + 1;
      state.distinctShifts.add(normalizedShiftCode);
    }
    state.lastWorkShiftCode = normalizedShiftCode;

    if (countTowardsRotation && state.workPatternType === 'three-shift') {
      if (state.distinctShifts.size >= 2) {
        state.rotationLock = null;
      } else {
        const currentCount = state.shiftCounts[normalizedShiftCode] ?? 0;
        if (currentCount >= THREE_SHIFT_ROTATION_LOCK_THRESHOLD) {
          state.rotationLock = normalizedShiftCode;
        }
      }
    }
  } else {
    state.consecutiveDays = 0;
    state.consecutiveNights = 0;
    state.lastShiftRunCount = 0;
  }

  state.lastAssignedDate = date;
  state.lastShiftCode = normalizedShiftCode;
}

function incrementOffCounter(state: EmployeeState, source: 'special-request' | 'system') {
  state.offDays += 1;
  if (source === 'special-request') {
    state.specialRequestOffDays += 1;
  } else {
    state.autoOffDays += 1;
  }
}

function resolveAssignmentShift(
  assignment: ScheduleAssignment,
  shiftTemplateMap: Map<string, Shift & { code?: string }>,
  shiftTemplateById: Map<string, Shift & { code?: string }>
) {
  const normalizedId = assignment.shiftId?.toLowerCase();
  if (normalizedId && shiftTemplateById.has(normalizedId)) {
    const template = shiftTemplateById.get(normalizedId)!;
    return { shiftCode: extractShiftCode(template), shiftTemplate: template };
  }

  const derived = deriveShiftCodeFromIdentifier(assignment.shiftType ?? assignment.shiftId);
  if (!derived) {
    return null;
  }
  const template = shiftTemplateMap.get(derived) ?? null;
  return { shiftCode: derived, shiftTemplate: template ?? undefined };
}

function deriveShiftCodeFromIdentifier(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const upper = trimmed.toUpperCase();
  if (upper === 'OFF') {
    return 'O';
  }
  if (upper.startsWith('SHIFT-')) {
    return upper.slice(6);
  }
  if (upper.length === 1) {
    return upper;
  }
  return upper;
}

interface AssignmentRuleContext {
  employee: AiEmployee;
  state: EmployeeState;
  shiftCode: string;
  date: Date;
  dayIndex: number;
  countedAsWork: boolean;
  isNightShift: boolean;
  hasPreferences: boolean;
}

function evaluateAssignmentRules(context: AssignmentRuleContext) {
  const { employee, state, shiftCode, date, countedAsWork, isNightShift, hasPreferences } = context;
  const violations: ConstraintViolation[] = [];
  let penalty = 0;
  const prevConsecutiveNights = state.consecutiveNights;
  const workPattern = employee.workPatternType ?? 'three-shift';
  const isNightIntensive = workPattern === 'night-intensive';

  if (isNightIntensive && countedAsWork && shiftCode !== 'N') {
    const violation = createViolation({
      id: 'night_intensive_only_night',
      name: '야간 집중 근무 규칙',
      message: `${employee.name ?? employee.id}님은 야간 집중 근무자로, ${format(date, 'yyyy-MM-dd')}에 ${shiftCode} 배정을 받을 수 없습니다.`,
      type: 'hard',
      severity: 'high',
      employees: [employee.id],
      dates: [date],
      cost: 15,
    });
    violations.push(violation);
    penalty += violation.cost;
  }

  if (isNightIntensive && prevConsecutiveNights >= NIGHT_INTENSIVE_RECOVERY_MIN_STREAK && !isNightShift) {
    const extraNights = Math.max(0, prevConsecutiveNights - NIGHT_INTENSIVE_RECOVERY_MIN_STREAK);
    state.nightRecoveryDaysNeeded = Math.max(
      state.nightRecoveryDaysNeeded,
      Math.min(NIGHT_INTENSIVE_MAX_RECOVERY_DAYS, NIGHT_INTENSIVE_MIN_RECOVERY_DAYS + (extraNights > 0 ? 1 : 0))
    );
    if (shiftCode !== 'O') {
      const violation = createViolation({
        id: 'night_intensive_recovery',
        name: '야간 회복 휴무',
        message: `${employee.name ?? employee.id}님은 연속 야간 근무 후 회복 휴무가 필요합니다.`,
        type: 'soft',
        severity: 'medium',
        employees: [employee.id],
        dates: [date],
        cost: 6,
      });
      violations.push(violation);
      penalty += violation.cost;
    }
  }

  if (!isNightIntensive && !hasPreferences) {
    if (!isNightShift && prevConsecutiveNights > 0) {
      if (prevConsecutiveNights < NIGHT_BLOCK_MIN_NON_PREF) {
        const violation = createViolation({
          id: 'night_block_too_short',
          name: '야간 블록 길이',
          message: `${employee.name ?? employee.id}님의 야간 근무가 ${prevConsecutiveNights}일로 너무 짧습니다.`,
          type: 'soft',
          severity: 'medium',
          employees: [employee.id],
          dates: [date],
          cost: 6,
        });
        violations.push(violation);
        penalty += violation.cost;
      }
      if (shiftCode !== 'O') {
        const violation = createViolation({
          id: 'night_block_requires_off',
          name: '야간 회복 휴무',
          message: `${employee.name ?? employee.id}님의 야간 근무 이후에는 OFF가 필요합니다.`,
          type: 'soft',
          severity: 'medium',
          employees: [employee.id],
          dates: [date],
          cost: 6,
        });
        violations.push(violation);
        penalty += violation.cost;
      }
      const extraNights = Math.max(0, prevConsecutiveNights - NIGHT_BLOCK_MIN_NON_PREF);
      state.nightRecoveryDaysNeeded = Math.max(
        state.nightRecoveryDaysNeeded,
        Math.min(NIGHT_BLOCK_MAX_RECOVERY_DAYS, NIGHT_BLOCK_RECOVERY_DAYS + (extraNights > 0 ? 1 : 0))
      );
    }

    if (isNightShift && prevConsecutiveNights >= NIGHT_BLOCK_TARGET_MAX_NON_PREF) {
      const violation = createViolation({
        id: 'night_block_too_long',
        name: '야간 블록 길이',
        message: `${employee.name ?? employee.id}님의 야간 근무가 너무 길어지고 있습니다.`,
        type: 'soft',
        severity: 'medium',
        employees: [employee.id],
        dates: [date],
        cost: 5,
      });
      violations.push(violation);
      penalty += violation.cost;
    }
  }

  if (state.nightRecoveryDaysNeeded > 0 && shiftCode !== 'O') {
    const violation = createViolation({
      id: 'night_recovery_required',
      name: '회복 휴무 필요',
      message: `${employee.name ?? employee.id}님에게 필요한 회복 휴무가 충분히 배정되지 않았습니다.`,
      type: 'soft',
      severity: 'medium',
      employees: [employee.id],
      dates: [date],
      cost: 5,
    });
    violations.push(violation);
    penalty += violation.cost;
  }

  if (!hasPreferences && countedAsWork && state.lastWorkShiftCode && state.lastWorkShiftCode === shiftCode && shiftCode !== 'N') {
    const violation = createViolation({
      id: 'rotation_bias',
      name: '시프트 순환 불균형',
      message: `${employee.name ?? employee.id}님에게 동일 시프트가 반복 배정되었습니다.`,
      type: 'soft',
      severity: 'low',
      employees: [employee.id],
      dates: [date],
      cost: 3,
    });
    violations.push(violation);
    penalty += violation.cost;
  }

  return { violations, penalty };
}

function createViolation(options: {
  id: string;
  name: string;
  message: string;
  type?: 'hard' | 'soft';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  employees?: string[];
  dates?: Date[];
  cost?: number;
}): ConstraintViolation {
  return {
    constraintId: options.id,
    constraintName: options.name,
    type: options.type ?? 'soft',
    severity: options.severity ?? 'medium',
    message: options.message,
    affectedEmployees: options.employees ?? [],
    affectedDates: options.dates ?? [],
    cost: options.cost ?? (options.type === 'hard' ? 15 : 5),
  };
}

function calculateFairnessIndex(workloads: number[]): number {
  const total = workloads.reduce((sum, value) => sum + value, 0);
  const squaredSum = workloads.reduce((sum, value) => sum + value * value, 0);
  if (workloads.length === 0 || squaredSum === 0) {
    return 1;
  }
  return (total * total) / (workloads.length * squaredSum);
}
