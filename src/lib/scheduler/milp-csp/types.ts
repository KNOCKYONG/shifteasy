import type {
  Constraint,
  ConstraintViolation,
  OffAccrualSummary,
  ScheduleAssignment,
  ScheduleScore,
  Shift,
  GenerationDiagnostics,
} from '@/lib/types/scheduler';

export type MilpCspWorkPatternType = 'three-shift' | 'night-intensive' | 'weekday-only';

export interface MilpCspCareerGroup {
  code: string;
  name: string;
  alias: string;
  minYears?: number;
  maxYears?: number;
  description?: string;
}

export interface MilpCspEmployee {
  id: string;
  name: string;
  role: string;
  departmentId?: string;
  teamId?: string | null;
  alias: string;
  teamAlias?: string | null;
  workPatternType?: MilpCspWorkPatternType;
  preferredShiftTypes?: Record<string, number>;
  maxConsecutiveDaysPreferred?: number;
  maxConsecutiveNightsPreferred?: number;
  guaranteedOffDays?: number;
  yearsOfService?: number;
  careerGroupAlias?: string | null;
  careerGroupCode?: string | null;
  careerGroupName?: string | null;
  previousOffCarry?: number;
}

export interface MilpCspSpecialRequest {
  employeeId: string;
  date: string; // yyyy-MM-dd
  requestType: string;
  shiftTypeCode?: string | null;
}

export interface MilpCspHoliday {
  date: string; // yyyy-MM-dd
  name: string;
}

export interface MilpCspTeamPattern {
  pattern: string[];
  avoidPatterns?: string[][];
  requiredStaffByShift?: Record<string, number>;
}

export interface MilpCspAliasMaps {
  employeeAliasMap: Record<string, string>;
  teamAliasMap: Record<string, string>;
  careerGroupAliasMap: Record<string, string>;
}

export interface MilpConstraintWeights {
  staffing?: number;
  teamBalance?: number;
  careerBalance?: number;
  offBalance?: number;
}

export interface MilpCspSettingsOptions {
  maxIterations?: number;
  tabuSize?: number;
  timeLimitMs?: number;
  maxSameShift?: number;
  offTolerance?: number;
  annealing?: {
    temperature?: number;
    coolingRate?: number;
  };
}

export interface MilpCspSolverOptions {
  maxSolveTimeMs?: number;
  maxIterations?: number;
  enableSlackVariables?: boolean;
  cspMaxIterations?: number;
  cspTimeLimitMs?: number;
  logLevel?: 'silent' | 'info' | 'debug';
  constraintWeights?: MilpConstraintWeights;
  cspSettings?: MilpCspSettingsOptions;
}

export interface MilpCspScheduleInput {
  departmentId: string;
  startDate: Date;
  endDate: Date;
  employees: MilpCspEmployee[];
  shifts: (Shift & { code?: string })[];
  constraints?: Constraint[];
  specialRequests?: MilpCspSpecialRequest[];
  holidays?: MilpCspHoliday[];
  teamPattern?: MilpCspTeamPattern | null;
  requiredStaffPerShift?: Record<string, number>;
  nightIntensivePaidLeaveDays?: number;
  previousOffAccruals?: Record<string, number>;
  careerGroups?: MilpCspCareerGroup[];
  aliasMaps?: MilpCspAliasMaps;
  options?: MilpCspSolverOptions;
}

export interface MilpCspSolverStats {
  fairnessIndex: number;
  coverageRate: number;
  preferenceScore: number;
  iterationCount: number;
  milpSolveTime: number;
  cspSolveTime: number;
  totalSolveTime: number;
}

export interface MilpCspSolverResult {
  assignments: ScheduleAssignment[];
  violations: ConstraintViolation[];
  score: ScheduleScore;
  stats: MilpCspSolverStats;
  offAccruals: OffAccrualSummary[];
  aliasMaps?: MilpCspAliasMaps;
  debugLogs?: string[];
  diagnostics?: GenerationDiagnostics;
}

export interface MilpCspBackendJobPayload {
  id: string;
  input: MilpCspScheduleInput;
  enqueuedAt: string;
}
