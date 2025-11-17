import type {
  ScheduleAssignment,
  ConstraintViolation,
  ScheduleScore,
  Shift,
} from '@web/lib/types/scheduler';
import type {
  AiScheduleRequest,
  AiScheduleGenerationResult,
} from '@web/lib/scheduler/greedy-scheduler';

export interface ScheduleGenerationPayload extends AiScheduleRequest {
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
  generationResult: Pick<
    AiScheduleGenerationResult,
    'iterations' | 'computationTime' | 'violations' | 'score' | 'offAccruals' | 'stats'
  >;
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
