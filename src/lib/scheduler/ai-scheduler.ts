import { performance } from 'node:perf_hooks';
import { eachDayOfInterval, differenceInCalendarDays, format, isWeekend } from 'date-fns';
import type {
  Constraint,
  ConstraintViolation,
  ScheduleAssignment,
  ScheduleScore,
  Shift,
} from './types';

export type WorkPatternType = 'three-shift' | 'night-intensive' | 'weekday-only';

interface AiEmployee {
  id: string;
  name: string;
  role: string;
  departmentId?: string;
  workPatternType?: WorkPatternType;
  preferredShiftTypes?: Record<string, number>;
  maxConsecutiveDaysPreferred?: number;
  maxConsecutiveNightsPreferred?: number;
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

interface AiScheduleRequest {
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
}

interface EmployeeState {
  totalAssignments: number;
  preferenceScore: number;
  consecutiveDays: number;
  consecutiveNights: number;
  lastAssignedDate: Date | null;
  lastShiftCode: string | null;
  shiftCounts: Record<string, number>;
  distinctShifts: Set<string>;
  rotationLock: string | null;
  workPatternType: WorkPatternType;
}

const SHIFT_CODE_MAP: Record<string, string> = {
  day: 'D',
  evening: 'E',
  night: 'N',
  off: 'O',
  leave: 'L',
};

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

export async function generateAiSchedule(request: AiScheduleRequest): Promise<AiScheduleGenerationResult> {
  const start = performance.now();
  const dateRange = eachDayOfInterval({ start: request.startDate, end: request.endDate });
  const holidays = new Set((request.holidays ?? []).map((h) => h.date));
  const specialRequestsMap = new Map<string, AiSpecialRequest[]>();

  (request.specialRequests ?? []).forEach((req) => {
    const key = req.date;
    if (!specialRequestsMap.has(key)) {
      specialRequestsMap.set(key, []);
    }
    specialRequestsMap.get(key)!.push(req);
  });

  const employeeStates = new Map<string, EmployeeState>();
  request.employees.forEach((emp) => {
    employeeStates.set(emp.id, {
      totalAssignments: 0,
      preferenceScore: 0,
      consecutiveDays: 0,
      consecutiveNights: 0,
      lastAssignedDate: null,
      lastShiftCode: null,
      shiftCounts: {},
      distinctShifts: new Set(),
      rotationLock: null,
      workPatternType: emp.workPatternType ?? 'three-shift',
    });
  });

  const activeShifts = request.shifts.filter((shift) => shift.type !== 'off' && shift.type !== 'leave');
  const totalRequiredSlots =
    dateRange.length *
    activeShifts.reduce((sum, shift) => {
      const code = extractShiftCode(shift);
      const required = request.requiredStaffPerShift?.[code] ?? shift.requiredStaff ?? 1;
      return sum + required;
    }, 0);

  const assignments: ScheduleAssignment[] = [];
  const violations: ConstraintViolation[] = [];
  let filledSlots = 0;
  let aggregatedPreferenceScore = 0;

  const pattern = request.teamPattern?.pattern ?? null;
  const avoidPatterns = request.teamPattern?.avoidPatterns ?? [];

  dateRange.forEach((date, dayIndex) => {
    const dateKey = toDateKey(date);
    const todaysRequests = specialRequestsMap.get(dateKey) ?? [];
    const assignedToday = new Set<string>();

    // Step 1: Apply special requests first
    todaysRequests.forEach((req) => {
      const state = employeeStates.get(req.employeeId);
      if (!state) {
        return;
      }

      let shiftId = OFF_SHIFT_ID;
      let shiftCode = 'O';
      let countedAsWork = false;

      if (req.requestType === 'shift_request' && req.shiftTypeCode) {
        shiftCode = req.shiftTypeCode.toUpperCase();
        shiftId = `shift-${shiftCode.toLowerCase()}`;
        countedAsWork = shiftCode !== 'O';
      } else if (req.requestType === 'overtime' || req.requestType === 'extra_shift') {
        shiftCode = 'D';
        shiftId = 'shift-d';
        countedAsWork = true;
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
      if (countedAsWork) {
        filledSlots += 1;
      }
    });

    // Step 2: Assign regular shifts
    activeShifts.forEach((shift) => {
      const targetCode = extractShiftCode(shift);
      const required = request.requiredStaffPerShift?.[targetCode] ?? shift.requiredStaff ?? 1;
      let currentAssigned = assignments.filter(
        (assignment) => assignment.date === date && assignment.shiftId === `shift-${targetCode.toLowerCase()}`
      ).length;

      let attempts = 0;
      while (currentAssigned < required && attempts < request.employees.length) {
        attempts += 1;
        const candidate = selectCandidate({
          date,
          shift,
          shiftCode: targetCode,
          employees: request.employees,
          assignedToday,
          employeeStates,
          pattern,
          dayIndex,
          avoidPatterns,
          holidays,
          totalDays: dateRange.length,
        });

        if (!candidate) {
          violations.push({
            constraintId: 'coverage',
            constraintName: '근무 커버리지',
            type: 'hard',
            severity: 'high',
            message: `${dateKey} ${shift.name} 근무를 채우지 못했습니다.`,
            affectedEmployees: [],
            affectedDates: [date],
            cost: 10,
          });
          break;
        }

        assignedToday.add(candidate.employee.id);
        assignments.push({
          employeeId: candidate.employee.id,
          shiftId: `shift-${targetCode.toLowerCase()}`,
          date,
          isLocked: false,
          isSwapRequested: false,
        });

        const state = employeeStates.get(candidate.employee.id)!;
        updateEmployeeState(state, {
          date,
          shiftCode: targetCode,
          countedAsWork: true,
          isNightShift: shift.type === 'night',
        });
        state.preferenceScore += candidate.preferenceScore;
        aggregatedPreferenceScore += Math.max(candidate.preferenceScore, 0);
        currentAssigned += 1;
        filledSlots += 1;
      }
    });

    // Step 3: Assign OFF to remaining employees
    request.employees.forEach((employee) => {
      if (assignedToday.has(employee.id)) {
        return;
      }

      assignments.push({
        employeeId: employee.id,
        shiftId: OFF_SHIFT_ID,
        date,
        isLocked: false,
        isSwapRequested: false,
      });

      const state = employeeStates.get(employee.id)!;
      updateEmployeeState(state, {
        date,
        shiftCode: 'O',
        countedAsWork: false,
      });
    });
  });

  const fairnessIndex = calculateFairnessIndex(
    request.employees.map((emp) => employeeStates.get(emp.id)?.totalAssignments ?? 0)
  );

  const coverageRate = totalRequiredSlots === 0 ? 1 : Math.min(1, filledSlots / totalRequiredSlots);
  const preferenceScore =
    aggregatedPreferenceScore === 0
      ? 0
      : Math.min(100, (aggregatedPreferenceScore / Math.max(1, filledSlots)) * 100);

  const score: ScheduleScore = {
    total: Math.round((fairnessIndex * 50) + (coverageRate * 40) + (preferenceScore * 0.1)),
    fairness: Math.round(fairnessIndex * 100),
    preference: Math.round(preferenceScore),
    coverage: Math.round(coverageRate * 100),
    constraintSatisfaction: Math.max(0, 100 - violations.length * 5),
    breakdown: [
      { category: 'fairness', score: Math.round(fairnessIndex * 100), weight: 0.5, details: 'Jain 공정성 지수' },
      { category: 'coverage', score: Math.round(coverageRate * 100), weight: 0.4, details: '필요 인원 커버리지' },
      { category: 'preference', score: Math.round(preferenceScore), weight: 0.1, details: '선호도 매칭' },
    ],
  };

  return {
    assignments,
    violations,
    score,
    iterations: dateRange.length * Math.max(1, activeShifts.length),
    computationTime: Math.round(performance.now() - start),
    stats: {
      fairnessIndex,
      coverageRate,
      preferenceScore,
    },
  };
}

interface CandidateSelectionParams {
  date: Date;
  shift: Shift & { code?: string };
  shiftCode: string;
  employees: AiEmployee[];
  assignedToday: Set<string>;
  employeeStates: Map<string, EmployeeState>;
  pattern: string[] | null;
  dayIndex: number;
  avoidPatterns: string[][];
  holidays: Set<string>;
  totalDays: number;
}

interface CandidateEvaluation {
  employee: AiEmployee;
  score: number;
  preferenceScore: number;
}

function selectCandidate(params: CandidateSelectionParams) {
  const normalizedShiftCode = params.shiftCode.toUpperCase();

  const candidates = params.employees
    .filter((emp) => !params.assignedToday.has(emp.id))
    .map<CandidateEvaluation | null>((employee) => {
      const state = params.employeeStates.get(employee.id);
      if (!state) {
        return null;
      }

      if (
        state.workPatternType === 'three-shift' &&
        state.rotationLock &&
        state.rotationLock === normalizedShiftCode
      ) {
        return null;
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
      });
      return {
        employee,
        score: baseScore.score,
        preferenceScore: baseScore.preferenceScore,
      };
    })
    .filter((candidate): candidate is CandidateEvaluation => {
      if (!candidate) {
        return false;
      }
      return candidate.score > Number.NEGATIVE_INFINITY;
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0] ?? null;
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
  } = params;

  let score = 100;
  const normalizedShiftCode = shiftCode.toUpperCase();

  const workPattern = employee.workPatternType ?? 'three-shift';
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

  if (state.workPatternType === 'three-shift' && state.distinctShifts.size < 2) {
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

  return { score, preferenceScore: preferenceWeight };
}

function updateEmployeeState(
  state: EmployeeState,
  params: { date: Date; shiftCode: string; countedAsWork: boolean; isNightShift?: boolean }
) {
  const { date, shiftCode, countedAsWork, isNightShift } = params;
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
    state.totalAssignments += 1;

    state.shiftCounts[normalizedShiftCode] = (state.shiftCounts[normalizedShiftCode] ?? 0) + 1;
    state.distinctShifts.add(normalizedShiftCode);

    if (state.workPatternType === 'three-shift') {
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
  }

  state.lastAssignedDate = date;
  state.lastShiftCode = normalizedShiftCode;
}

function calculateFairnessIndex(workloads: number[]): number {
  const total = workloads.reduce((sum, value) => sum + value, 0);
  const squaredSum = workloads.reduce((sum, value) => sum + value * value, 0);
  if (workloads.length === 0 || squaredSum === 0) {
    return 1;
  }
  return (total * total) / (workloads.length * squaredSum);
}
