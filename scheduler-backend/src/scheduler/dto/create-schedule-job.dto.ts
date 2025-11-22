import type {
  ScheduleAssignment,
  ConstraintViolation,
  ScheduleScore,
  Shift,
} from '@web/lib/types/scheduler';
export interface ScheduleGenerationPayload {
  departmentId: string;
  startDate: Date;
  endDate: Date;
  employees: unknown[];
  shifts: unknown[];
  constraints: unknown[];
  specialRequests: unknown[];
  holidays: unknown[];
  teamPattern?: unknown;
  requiredStaffPerShift?: Record<string, number>;
  nightIntensivePaidLeaveDays?: number;
  previousOffAccruals?: Record<string, number>;
  name: string;
  enableAI?: boolean;
  optimizationGoal?: 'fairness' | 'preference' | 'coverage' | 'cost' | 'balanced';
}

export interface ScheduleJobRequestBody extends Omit<ScheduleGenerationPayload, 'startDate' | 'endDate'> {
  startDate: string;
  endDate: string;
}

export interface SerializedScheduleAssignment extends Omit<ScheduleAssignment, 'date'> {
  date: string;
}

export interface SchedulerJobResult {
  assignments: SerializedScheduleAssignment[];
  generationResult: {
    iterations: number;
    computationTime: number;
    violations: ConstraintViolation[];
    score: ScheduleScore;
    offAccruals: unknown[];
    stats: {
      fairnessIndex: number;
      coverageRate: number;
      preferenceScore: number;
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

export interface SchedulerJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  payload: ScheduleJobRequestBody;
  result?: SchedulerJobResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
