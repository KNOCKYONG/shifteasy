export interface ConstraintWeightsConfig {
  staffing: number;
  teamBalance: number;
  careerBalance: number;
  offBalance: number;
}

export interface CspAnnealingConfig {
  temperature: number;
  coolingRate: number;
}

export interface CspSettingsConfig {
  maxIterations: number;
  tabuSize: number;
  timeLimitMs: number;
  maxSameShift: number;
  offTolerance: number;
  annealing: CspAnnealingConfig;
}

export type MilpSolverType = 'auto' | 'ortools' | 'highs' | 'cpsat';

export interface MilpMultiRunConfig {
  attempts: number;
  weightJitterPct: number;
  seed: number | null;
}

export interface SchedulerAdvancedSettings {
  useMilpEngine: boolean;
  solverPreference: MilpSolverType;
  constraintWeights: ConstraintWeightsConfig;
  cspSettings: CspSettingsConfig;
  multiRun: MilpMultiRunConfig;
}

export const DEFAULT_SCHEDULER_ADVANCED: SchedulerAdvancedSettings = {
  useMilpEngine: false,
  solverPreference: 'auto',
  constraintWeights: {
    staffing: 1,
    teamBalance: 1,
    careerBalance: 1,
    offBalance: 1,
  },
  cspSettings: {
    maxIterations: 400,
    tabuSize: 32,
    timeLimitMs: 4000,
    maxSameShift: 2,
    offTolerance: 2,
    annealing: {
      temperature: 5,
      coolingRate: 0.92,
    },
  },
  multiRun: {
    attempts: 1,
    weightJitterPct: 0,
    seed: null,
  },
};

export const mergeSchedulerAdvancedSettings = (
  value?: Partial<SchedulerAdvancedSettings>
): SchedulerAdvancedSettings => {
  const base = DEFAULT_SCHEDULER_ADVANCED;
  return {
    useMilpEngine: value?.useMilpEngine ?? base.useMilpEngine,
    solverPreference: value?.solverPreference ?? base.solverPreference,
    constraintWeights: {
      staffing: value?.constraintWeights?.staffing ?? base.constraintWeights.staffing,
      teamBalance: value?.constraintWeights?.teamBalance ?? base.constraintWeights.teamBalance,
      careerBalance: value?.constraintWeights?.careerBalance ?? base.constraintWeights.careerBalance,
      offBalance: value?.constraintWeights?.offBalance ?? base.constraintWeights.offBalance,
    },
    cspSettings: {
      maxIterations: value?.cspSettings?.maxIterations ?? base.cspSettings.maxIterations,
      tabuSize: value?.cspSettings?.tabuSize ?? base.cspSettings.tabuSize,
      timeLimitMs: value?.cspSettings?.timeLimitMs ?? base.cspSettings.timeLimitMs,
      maxSameShift: value?.cspSettings?.maxSameShift ?? base.cspSettings.maxSameShift,
      offTolerance: value?.cspSettings?.offTolerance ?? base.cspSettings.offTolerance,
      annealing: {
        temperature: value?.cspSettings?.annealing?.temperature ?? base.cspSettings.annealing.temperature,
        coolingRate: value?.cspSettings?.annealing?.coolingRate ?? base.cspSettings.annealing.coolingRate,
      },
    },
    multiRun: {
      attempts: value?.multiRun?.attempts ?? base.multiRun.attempts,
      weightJitterPct: value?.multiRun?.weightJitterPct ?? base.multiRun.weightJitterPct,
      seed: typeof value?.multiRun?.seed === 'number' || value?.multiRun?.seed === null ? value?.multiRun?.seed : base.multiRun.seed,
    },
  };
};
