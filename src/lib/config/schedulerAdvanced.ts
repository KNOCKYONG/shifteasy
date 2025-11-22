export interface ConstraintWeightsConfig {
  staffing: number;
  teamBalance: number;
  careerBalance: number;
  offBalance: number;
  shiftPattern: number;
  dailyBalance: number;
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
  shiftBalanceTolerance: number;
  annealing: CspAnnealingConfig;
}

export type MilpSolverType = 'ortools' | 'cpsat' | 'hybrid';

export interface MilpMultiRunConfig {
  attempts: number;
  weightJitterPct: number;
  seed: number | null;
}

export type DailyStaffTargetMode = 'auto' | 'manual';

export interface DailyStaffingBalanceConfig {
  enabled: boolean;
  targetMode: DailyStaffTargetMode;
  targetValue: number | null;
  tolerance: number;
  weight: number;
  weekendScale: number;
}

export interface SchedulerAdvancedSettings {
  useMilpEngine: boolean;
  solverPreference: MilpSolverType;
  constraintWeights: ConstraintWeightsConfig;
  cspSettings: CspSettingsConfig;
  multiRun: MilpMultiRunConfig;
  patternConstraints: PatternConstraintsConfig;
  dailyStaffingBalance: DailyStaffingBalanceConfig;
}

export interface PatternConstraintsConfig {
  maxConsecutiveDaysThreeShift: number;
}

export const DEFAULT_SCHEDULER_ADVANCED: SchedulerAdvancedSettings = {
  useMilpEngine: false,
  solverPreference: 'ortools',
  constraintWeights: {
    staffing: 1,
    teamBalance: 1,
    careerBalance: 1,
    offBalance: 1,
    shiftPattern: 1,
    dailyBalance: 1,
  },
  cspSettings: {
    maxIterations: 400,
    tabuSize: 32,
    timeLimitMs: 4000,
    maxSameShift: 2,
    offTolerance: 2,
    shiftBalanceTolerance: 4,
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
  patternConstraints: {
    maxConsecutiveDaysThreeShift: 5,
  },
  dailyStaffingBalance: {
    enabled: true,
    targetMode: 'auto',
    targetValue: null,
    tolerance: 2,
    weight: 1,
    weekendScale: 1,
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
      shiftPattern: value?.constraintWeights?.shiftPattern ?? base.constraintWeights.shiftPattern,
      dailyBalance:
        value?.constraintWeights?.dailyBalance ??
        value?.dailyStaffingBalance?.weight ??
        base.constraintWeights.dailyBalance,
    },
    cspSettings: {
      maxIterations: value?.cspSettings?.maxIterations ?? base.cspSettings.maxIterations,
      tabuSize: value?.cspSettings?.tabuSize ?? base.cspSettings.tabuSize,
      timeLimitMs: value?.cspSettings?.timeLimitMs ?? base.cspSettings.timeLimitMs,
      maxSameShift: value?.cspSettings?.maxSameShift ?? base.cspSettings.maxSameShift,
      offTolerance: value?.cspSettings?.offTolerance ?? base.cspSettings.offTolerance,
      shiftBalanceTolerance: value?.cspSettings?.shiftBalanceTolerance ?? base.cspSettings.shiftBalanceTolerance,
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
    patternConstraints: {
      maxConsecutiveDaysThreeShift:
        value?.patternConstraints?.maxConsecutiveDaysThreeShift ??
        base.patternConstraints.maxConsecutiveDaysThreeShift,
    },
    dailyStaffingBalance: {
      enabled: value?.dailyStaffingBalance?.enabled ?? base.dailyStaffingBalance.enabled,
      targetMode: value?.dailyStaffingBalance?.targetMode ?? base.dailyStaffingBalance.targetMode,
      targetValue:
        typeof value?.dailyStaffingBalance?.targetValue === 'number'
          ? value?.dailyStaffingBalance?.targetValue
          : base.dailyStaffingBalance.targetValue,
      tolerance: value?.dailyStaffingBalance?.tolerance ?? base.dailyStaffingBalance.tolerance,
      weight:
        value?.dailyStaffingBalance?.weight ??
        value?.constraintWeights?.dailyBalance ??
        base.dailyStaffingBalance.weight,
      weekendScale: value?.dailyStaffingBalance?.weekendScale ?? base.dailyStaffingBalance.weekendScale,
    },
  };
};
