/**
 * 간호사 3교대 월간 스케줄 생성 엔진
 * 단계별 규칙을 적용하여 안정적인 스케줄을 생성한다.
 */

import { format, parseISO } from 'date-fns';
import { eachDayOfInterval } from 'date-fns/eachDayOfInterval';
import { isWeekend } from 'date-fns/isWeekend';

import type {
  Staff,
  ShiftType,
  Assignment,
  ScheduleGenerationConfig,
  ScheduleRequest,
  PersonalSchedulePattern,
  TeamSchedulePattern,
  StaffSchedulingProfile,
  ScheduleGenerationStepReport,
  ScheduleShiftToken,
} from '../types';
import { ConstraintEngine } from './constraints';

// === 타입 및 상수 정의 ===

type ShiftCounter = Record<ScheduleShiftToken, number>;

type StaffPlan = {
  staff: Staff;
  profile: StaffSchedulingProfile;
  quotas: ShiftCounter;
  assigned: ShiftCounter;
  schedule: Map<string, ScheduleShiftToken>;
  lockedDates: Set<string>;
  appliedReasons: Map<string, string>;
};

type ShiftDefinition = {
  id: string;
  type: ShiftType;
  label: string;
  duration: number;
};

type PatternToken = ScheduleShiftToken;

const DEFAULT_SHIFT_RATIO: Record<'D' | 'E' | 'N', number> = {
  D: 0.35,
  E: 0.32,
  N: 0.33,
};

const MIN_STAFF_PER_SHIFT: Record<'D' | 'E' | 'N', number> = {
  D: 6,
  E: 5,
  N: 4,
};

const REQUEST_PRIORITIES: Record<string, number> = {
  SICK: 0,
  BEREAVEMENT: 0,
  BIRTHDAY_OFF: 1,
  PAID_LEAVE: 1,
  OFF_REQUEST: 2,
  DAY_REQUEST: 3,
  EVENING_REQUEST: 4,
  NIGHT_REQUEST: 5,
  OTHER: 6,
};

const DEFAULT_TEAM_PATTERNS: Array<{ name: string; pattern: string; category: 'base' | 'transition'; weight: number }> = [
  { name: 'base-day', pattern: 'D-D-D-OFF-OFF', category: 'base', weight: 1 },
  { name: 'base-evening', pattern: 'E-E-E-OFF-OFF', category: 'base', weight: 1 },
  { name: 'base-night', pattern: 'N-N-N-OFF-OFF', category: 'base', weight: 1 },
  { name: 'transition-day-evening', pattern: 'D-D-OFF-E-E-OFF', category: 'transition', weight: 0.8 },
  { name: 'transition-evening-night', pattern: 'E-E-OFF-N-N-OFF-OFF', category: 'transition', weight: 0.7 },
];

// === 유틸리티 ===

function normalizeDate(value: string): string {
  return format(parseISO(value), 'yyyy-MM-dd');
}

function createShiftCounter(initial?: Partial<Record<ScheduleShiftToken, number>>): ShiftCounter {
  return {
    D: initial?.D ?? 0,
    E: initial?.E ?? 0,
    N: initial?.N ?? 0,
    O: initial?.O ?? 0,
    A: initial?.A ?? 0,
  };
}

// === 스케줄 생성 결과 타입 ===

export type ScheduleGenerationResult = {
  assignments: Assignment[];
  analysis: {
    score: number;
    hardViolations: number;
    softScore: number;
    generationTime: number;
    iterations: number;
  };
  warnings: string[];
  success: boolean;
  stepReports: ScheduleGenerationStepReport[];
};

// === 메인 스케줄 생성기 ===

export class ScheduleGenerator {
  private readonly config: ScheduleGenerationConfig;
  private readonly constraintEngine: ConstraintEngine;

  constructor(config: ScheduleGenerationConfig) {
    this.config = config;
    this.constraintEngine = new ConstraintEngine(
      config.hardConstraints,
      config.softConstraints,
      config.staff,
      config.shifts.map((shift) => ({ id: shift.id, type: shift.type }))
    );
  }

  async generate(): Promise<ScheduleGenerationResult> {
    const startedAt = Date.now();
    const engine = new MonthlyScheduleEngine(this.config);
    const engineResult = engine.run();

    const analysis = this.constraintEngine.analyzeSchedule(engineResult.assignments);
    const generationTime = Date.now() - startedAt;

    const warnings = [...engineResult.warnings];
    for (const violation of analysis.hardViolations) {
      warnings.push(`하드 제약 위반: ${violation.description}`);
    }

    return {
      assignments: engineResult.assignments,
      analysis: {
        score: analysis.qualityMetrics.overallScore,
        hardViolations: analysis.hardViolations.length,
        softScore: analysis.qualityMetrics.softConstraintScore,
        generationTime,
        iterations: engineResult.iterations,
      },
      warnings,
      success: analysis.hardViolations.length === 0,
      stepReports: engineResult.stepReports,
    };
  }
}

// === 월간 스케줄 엔진 ===

class MonthlyScheduleEngine {
  private readonly config: ScheduleGenerationConfig;
  private readonly startDate: string;
  private readonly endDate: string;
  private readonly dates: string[];
  private readonly dateSet: Set<string>;
  private readonly weekendDates: Set<string>;
  private readonly holidaySet: Set<string>;
  private readonly shiftLookup: Map<ScheduleShiftToken | ShiftType, ShiftDefinition>;
  private readonly staffProfiles: Map<string, StaffSchedulingProfile>;
  private readonly requestsByStaff: Map<string, ScheduleRequest[]>;
  private readonly stepReports: ScheduleGenerationStepReport[] = [];
  private readonly warnings: string[] = [];
  private readonly staffPlans: Map<string, StaffPlan> = new Map();

  private iterations = 1;

  constructor(config: ScheduleGenerationConfig) {
    this.config = config;
    this.startDate = config.dateRange.startDate;
    this.endDate = config.dateRange.endDate;

    const dateObjects = eachDayOfInterval({
      start: parseISO(this.startDate),
      end: parseISO(this.endDate),
    });

    this.dates = dateObjects.map((date) => format(date, 'yyyy-MM-dd'));
    this.dateSet = new Set(this.dates);
    this.weekendDates = new Set(
      dateObjects
        .filter((date) => isWeekend(date))
        .map((date) => format(date, 'yyyy-MM-dd'))
    );

    this.holidaySet = new Set((config.holidays ?? []).map(normalizeDate).filter((date) => this.dateSet.has(date)));
    this.shiftLookup = this.buildShiftLookup(config.shifts);
    this.staffProfiles = this.buildProfileMap(config.staffProfiles ?? []);
    this.requestsByStaff = this.indexRequests(config.scheduleRequests ?? []);
  }

  run(): {
    assignments: Assignment[];
    iterations: number;
    warnings: string[];
    stepReports: ScheduleGenerationStepReport[];
  } {
    this.initializePlans();
    this.applyRequests();
    this.applyPersonalPatterns();
    this.fillWithTeamPatterns();
    this.rebalanceWorstPatterns();
    this.applyCoverageValidation();

    const assignments = this.materializeAssignments();

    return {
      assignments,
      iterations: this.iterations,
      warnings: this.warnings,
      stepReports: this.stepReports,
    };
  }

  // === 초기화 단계 (1단계) ===

  private initializePlans(): void {
    const conflicts: string[] = [];
    const unmet: string[] = [];
    let processed = 0;

    for (const staff of this.config.staff) {
      const profile = this.resolveProfile(staff);
      const plan = this.createPlan(staff, profile, conflicts, unmet);
      this.staffPlans.set(staff.id, plan);
      processed++;
    }

    this.stepReports.push({
      step: '1. 근무일 계산 및 쿼터 설정',
      processed,
      conflicts,
      unmet,
    });
  }

  private resolveProfile(staff: Staff): StaffSchedulingProfile {
    const base: StaffSchedulingProfile = {
      staffId: staff.id,
      isNightOnly: false,
      isChargeNurse: staff.role === 'CN',
      isUnitManager: false,
      dayLeader: staff.role === 'CN' || staff.leadership >= 4,
      eveningLeader: staff.leadership >= 4,
      allowWeekendAssignments: true,
      preferredShiftRatio: undefined,
      specialOffDates: [],
      maxMonthlyNights: this.config.hardConstraints.maxMonthlyNights,
      minWeekendAssignments: undefined,
    };

    const override = this.staffProfiles.get(staff.id);
    if (!override) {
      return base;
    }

    return {
      ...base,
      ...override,
      dayLeader: override.dayLeader ?? base.dayLeader,
      eveningLeader: override.eveningLeader ?? base.eveningLeader,
      allowWeekendAssignments:
        typeof override.allowWeekendAssignments === 'boolean'
          ? override.allowWeekendAssignments
          : !override.isUnitManager,
      maxMonthlyNights: override.maxMonthlyNights ?? base.maxMonthlyNights,
      specialOffDates: override.specialOffDates ?? base.specialOffDates,
    };
  }

  private createPlan(
    staff: Staff,
    profile: StaffSchedulingProfile,
    conflicts: string[],
    unmet: string[]
  ): StaffPlan {
    const quotas = createShiftCounter();
    const assigned = createShiftCounter();
    const schedule = new Map<string, ScheduleShiftToken>();
    const lockedDates = new Set<string>();
    const appliedReasons = new Map<string, string>();

    const totalDays = this.dates.length;
    const weekendCount = this.weekendDates.size;
    const holidayCount = this.holidaySet.size;

    const staffRequests = this.requestsByStaff.get(staff.id) ?? [];
    const specialOffDates = new Set<string>();

    for (const entry of profile.specialOffDates ?? []) {
      const normalized = normalizeDate(entry.date);
      if (this.dateSet.has(normalized)) {
        specialOffDates.add(normalized);
      }
    }

    for (const request of staffRequests) {
      if (request.type === 'BIRTHDAY_OFF' || request.type === 'PAID_LEAVE') {
        specialOffDates.add(request.date);
      }
    }

    let baseOff = Math.min(totalDays, weekendCount + holidayCount + specialOffDates.size);
    let workdays = Math.max(0, totalDays - baseOff);

    let baseAllocation = this.allocateWorkdays(workdays, profile);

    if (!profile.isNightOnly) {
      let loop = 0;
      let sleepOff = Math.floor(baseAllocation.N / 7);
      while (loop < 5) {
        const nextOffTotal = Math.min(totalDays, weekendCount + holidayCount + specialOffDates.size + sleepOff);
        const nextWorkdays = Math.max(0, totalDays - nextOffTotal);
        const nextAllocation = this.allocateWorkdays(nextWorkdays, profile);
        const recalculatedSleep = Math.floor(nextAllocation.N / 7);
        baseOff = nextOffTotal;
        baseAllocation = nextAllocation;
        if (recalculatedSleep === sleepOff) {
          break;
        }
        sleepOff = recalculatedSleep;
        loop++;
      }
    }

    quotas.D = baseAllocation.D;
    quotas.E = baseAllocation.E;
    quotas.N = baseAllocation.N;
    quotas.A = baseAllocation.A;
    quotas.O = Math.max(0, Math.min(totalDays, baseOff));

    const quotaTotal = quotas.D + quotas.E + quotas.N + quotas.A + quotas.O;
    if (quotaTotal < totalDays) {
      quotas.D += totalDays - quotaTotal;
    } else if (quotaTotal > totalDays) {
      let excess = quotaTotal - totalDays;
      const reducibleOff = Math.min(excess, quotas.O);
      quotas.O -= reducibleOff;
      excess -= reducibleOff;
      if (excess > 0) {
        const reducibleEvening = Math.min(excess, quotas.E);
        quotas.E -= reducibleEvening;
        excess -= reducibleEvening;
      }
      if (excess > 0) {
        const reducibleDay = Math.min(excess, quotas.D);
        quotas.D -= reducibleDay;
        excess -= reducibleDay;
      }
      if (excess > 0) {
        conflicts.push(`${staff.name}님의 할당 쿼터가 총일을 초과하여 강제 조정했습니다.`);
      }
    }

    workdays = totalDays - quotas.O;
    if (workdays < 0) {
      quotas.O = totalDays;
      quotas.D = 0;
      quotas.E = 0;
      quotas.N = 0;
      quotas.A = 0;
    }

    return {
      staff,
      profile,
      quotas,
      assigned,
      schedule,
      lockedDates,
      appliedReasons,
    };
  }

  private allocateWorkdays(workdays: number, profile: StaffSchedulingProfile): ShiftCounter {
    const allocation = createShiftCounter();
    if (workdays <= 0) {
      return allocation;
    }

    const ratio: Partial<Record<ScheduleShiftToken, number>> = profile.preferredShiftRatio
      ? { ...profile.preferredShiftRatio }
      : profile.isUnitManager
      ? { A: 1 }
      : { ...DEFAULT_SHIFT_RATIO };

    if (!profile.isUnitManager) {
      ratio.D = ratio.D ?? DEFAULT_SHIFT_RATIO.D;
      ratio.E = ratio.E ?? DEFAULT_SHIFT_RATIO.E;
      ratio.N = profile.isChargeNurse ? 0 : ratio.N ?? DEFAULT_SHIFT_RATIO.N;
      ratio.A = ratio.A ?? 0;
    }

    if (profile.isNightOnly) {
      ratio.D = 0;
      ratio.E = 0;
      ratio.A = 0;
      ratio.N = 1;
    }

    if (profile.isChargeNurse) {
      ratio.N = 0;
    }

    const entries = Object.entries(ratio)
      .filter(([token, weight]) => weight && weight > 0 && token !== 'O')
      .map(([token, weight]) => [token as ScheduleShiftToken, weight as number]);

    if (entries.length === 0) {
      allocation.D = workdays;
      return allocation;
    }

    const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
    const remainders: Array<{ token: ScheduleShiftToken; remainder: number }> = [];
    let assigned = 0;

    for (const [token, weight] of entries) {
      const normalizedWeight = weight / totalWeight;
      const raw = workdays * normalizedWeight;
      const base = Math.floor(raw);
      allocation[token] = base;
      assigned += base;
      remainders.push({ token, remainder: raw - base });
    }

    let remaining = workdays - assigned;
    remainders.sort((a, b) => b.remainder - a.remainder);
    let cursor = 0;
    while (remaining > 0 && remainders.length > 0) {
      const target = remainders[cursor % remainders.length];
      allocation[target.token] += 1;
      remaining -= 1;
      cursor += 1;
    }

    const maxNight = profile.maxMonthlyNights ?? this.config.hardConstraints.maxMonthlyNights;
    if (allocation.N > maxNight) {
      const overflow = allocation.N - maxNight;
      allocation.N = maxNight;
      let distribute = overflow;
      const order: ScheduleShiftToken[] = profile.isUnitManager ? ['A', 'D', 'E'] : ['D', 'E', 'A'];
      let idx = 0;
      while (distribute > 0 && order.length > 0) {
        const token = order[idx % order.length];
        allocation[token] += 1;
        distribute -= 1;
        idx += 1;
      }
    }

    return allocation;
  }

  // === 요청 적용 (2단계) ===

  private applyRequests(): void {
    const requests: ScheduleRequest[] = [];
    for (const list of this.requestsByStaff.values()) {
      requests.push(...list);
    }

    requests.sort((a, b) => {
      const priorityDiff = (REQUEST_PRIORITIES[a.type] ?? 99) - (REQUEST_PRIORITIES[b.type] ?? 99);
      if (priorityDiff !== 0) return priorityDiff;
      return a.date.localeCompare(b.date);
    });

    let appliedCount = 0;
    const conflicts: string[] = [];
    const unmet: string[] = [];

    for (const request of requests) {
      const plan = this.staffPlans.get(request.staffId);
      if (!plan) {
        conflicts.push(`요청 처리 중 누락된 직원: ${request.staffId}`);
        continue;
      }

      if (!this.dateSet.has(request.date)) {
        conflicts.push(`${plan.staff.name}님의 요청 날짜(${request.date})가 범위를 벗어나 무시되었습니다.`);
        continue;
      }

      const success = this.applySingleRequest(plan, request, conflicts, unmet);
      if (success) {
        appliedCount += 1;
      }
    }

    this.stepReports.push({
      step: '2. 요청 스케줄 반영',
      processed: appliedCount,
      conflicts,
      unmet,
    });
  }

  private applySingleRequest(
    plan: StaffPlan,
    request: ScheduleRequest,
    conflicts: string[],
    unmet: string[]
  ): boolean {
    const date = request.date;
    const label = `request:${request.type}`;

    const ensureQuota = (token: ScheduleShiftToken) => {
      if (this.getRemaining(plan, token) > 0) return;
      const donors: ScheduleShiftToken[] = token === 'D' ? ['E', 'N', 'A'] : token === 'E' ? ['D', 'N', 'A'] : ['D', 'E', 'A'];
      for (const donor of donors) {
        if (donor === token) continue;
        if (plan.quotas[donor] > plan.assigned[donor]) {
          plan.quotas[donor] -= 1;
          plan.quotas[token] += 1;
          return;
        }
      }
      plan.quotas[token] += 1;
      conflicts.push(`${plan.staff.name} ${date} ${token} 쿼터를 요청 충족을 위해 확장했습니다.`);
    };

    switch (request.type) {
      case 'SICK':
      case 'BEREAVEMENT':
      case 'BIRTHDAY_OFF':
      case 'PAID_LEAVE': {
        ensureQuota('O');
        return this.setShift(plan, date, 'O', { locked: true, reason: label });
      }
      case 'OFF_REQUEST': {
        ensureQuota('O');
        if (!this.canAssignShift(plan, date, 'O')) {
          unmet.push(`${plan.staff.name} ${date} OFF 요청을 충족하지 못했습니다.`);
          return false;
        }
        return this.setShift(plan, date, 'O', { locked: true, reason: label });
      }
      case 'DAY_REQUEST': {
        const targetShift: ScheduleShiftToken = plan.profile.isUnitManager ? 'A' : 'D';
        ensureQuota(targetShift);
        if (!this.canAssignShift(plan, date, targetShift)) {
          unmet.push(`${plan.staff.name} ${date} ${targetShift} 요청을 충족하지 못했습니다.`);
          return false;
        }
        return this.setShift(plan, date, targetShift, { locked: true, reason: label });
      }
      case 'EVENING_REQUEST': {
        if (plan.profile.isUnitManager) {
          unmet.push(`${plan.staff.name} ${date} E 요청은 Unit Manager 정책과 충돌합니다.`);
          return false;
        }
        ensureQuota('E');
        if (!this.canAssignShift(plan, date, 'E')) {
          unmet.push(`${plan.staff.name} ${date} E 요청을 충족하지 못했습니다.`);
          return false;
        }
        return this.setShift(plan, date, 'E', { locked: true, reason: label });
      }
      case 'NIGHT_REQUEST': {
        ensureQuota('N');
        if (!this.canAssignShift(plan, date, 'N')) {
          unmet.push(`${plan.staff.name} ${date} N 요청을 충족하지 못했습니다.`);
          return false;
        }
        return this.setShift(plan, date, 'N', { locked: true, reason: label });
      }
      default:
        return false;
    }
  }

  // === 개인 패턴 적용 (3단계) ===

  private applyPersonalPatterns(): void {
    const patterns = (this.config.personalPatterns ?? []).slice();
    patterns.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    let applied = 0;
    const conflicts: string[] = [];
    const unmet: string[] = [];

    for (const pattern of patterns) {
      const plan = this.staffPlans.get(pattern.staffId);
      if (!plan) {
        conflicts.push(`패턴 적용 대상 직원 없음: ${pattern.staffId}`);
        continue;
      }

      const tokens = this.parsePattern(pattern.pattern);
      if (tokens.length === 0) {
        conflicts.push(`${plan.staff.name} 패턴(${pattern.pattern})이 비어 있어 무시되었습니다.`);
        continue;
      }

      const maxUses = pattern.maxUses ?? 1;
      let uses = 0;
      while (uses < maxUses) {
        const placement = this.findPatternPlacement(plan, tokens);
        if (placement == null) {
          if (uses === 0) {
            unmet.push(`${plan.staff.name} 패턴(${pattern.pattern})을 적용할 수 있는 연속 구간이 없습니다.`);
          }
          break;
        }
        this.placePattern(plan, tokens, placement, `pattern:${pattern.pattern}`);
        applied += 1;
        uses += 1;
      }
    }

    this.stepReports.push({
      step: '3. 개인 패턴 적용',
      processed: applied,
      conflicts,
      unmet,
    });
  }

  private findPatternPlacement(plan: StaffPlan, tokens: PatternToken[]): number | null {
    for (let i = 0; i <= this.dates.length - tokens.length; i++) {
      let valid = true;
      for (let offset = 0; offset < tokens.length; offset++) {
        const date = this.dates[i + offset];
        if (!this.canAssignShift(plan, date, tokens[offset])) {
          valid = false;
          break;
        }
        if (plan.schedule.has(date) || plan.lockedDates.has(date)) {
          valid = false;
          break;
        }
      }
      if (valid) {
        return i;
      }
    }
    return null;
  }

  private placePattern(plan: StaffPlan, tokens: PatternToken[], startIndex: number, reason: string): void {
    for (let offset = 0; offset < tokens.length; offset++) {
      const date = this.dates[startIndex + offset];
      this.setShift(plan, date, tokens[offset], { locked: false, reason });
    }
  }

  private parsePattern(pattern: string): PatternToken[] {
    return pattern
      .split('-')
      .map((token) => token.trim().toUpperCase())
      .map((token): PatternToken | null => {
        switch (token) {
          case 'D':
          case 'DAY':
          case 'DL':
            return 'D';
          case 'E':
          case 'EVENING':
          case 'EL':
            return 'E';
          case 'N':
          case 'NIGHT':
            return 'N';
          case 'OFF':
          case 'O':
            return 'O';
          case 'A':
          case 'ADMIN':
            return 'A';
          default:
            return null;
        }
      })
      .filter((token): token is PatternToken => token !== null);
  }

  // === 팀 패턴으로 빈 곳 채우기 (4단계) ===

  private fillWithTeamPatterns(): void {
    const patterns = this.prepareTeamPatterns();
    let filledSegments = 0;
    const conflicts: string[] = [];

    for (const plan of this.staffPlans.values()) {
      for (let i = 0; i < this.dates.length; i++) {
        const date = this.dates[i];
        if (plan.schedule.has(date)) continue;

        let applied = false;
        for (const pattern of patterns) {
          if (pattern.tokens.length === 0) continue;
          if (i + pattern.tokens.length > this.dates.length) continue;
          if (!this.canPlacePattern(plan, pattern.tokens, i)) continue;
          this.placePattern(plan, pattern.tokens, i, `team:${pattern.name}`);
          filledSegments += 1;
          applied = true;
          break;
        }

        if (!applied) {
          const fallback = this.pickFallbackShift(plan, date);
          if (fallback) {
            const success = this.setShift(plan, date, fallback, { reason: 'team:fallback' });
            if (success) {
              filledSegments += 1;
            }
          } else {
            conflicts.push(`${plan.staff.name} ${date}에 배치할 적절한 근무가 없어 비워두었습니다.`);
          }
        }
      }
    }

    this.stepReports.push({
      step: '4. 팀 패턴 채우기',
      processed: filledSegments,
      conflicts,
      unmet: [],
    });
  }

  private prepareTeamPatterns(): Array<{ name: string; tokens: PatternToken[]; weight: number }> {
    const customs = (this.config.teamPatterns ?? []).map((pattern) => ({
      name: pattern.name,
      tokens: this.parsePattern(pattern.pattern),
      weight: pattern.weight ?? (pattern.category === 'transition' ? 0.8 : 1),
    }));

    const defaults = DEFAULT_TEAM_PATTERNS.map((pattern) => ({
      name: pattern.name,
      tokens: this.parsePattern(pattern.pattern),
      weight: pattern.weight,
    }));

    return [...customs, ...defaults].filter((pattern) => pattern.tokens.length > 0);
  }

  private canPlacePattern(plan: StaffPlan, tokens: PatternToken[], startIndex: number): boolean {
    for (let offset = 0; offset < tokens.length; offset++) {
      const date = this.dates[startIndex + offset];
      if (!this.canAssignShift(plan, date, tokens[offset])) return false;
      if (plan.schedule.has(date) || plan.lockedDates.has(date)) return false;
    }
    return true;
  }

  private pickFallbackShift(plan: StaffPlan, date: string): ScheduleShiftToken | null {
    const candidates: ScheduleShiftToken[] = plan.profile.isUnitManager ? ['A', 'O'] : ['D', 'E', 'N', 'O'];
    let best: { token: ScheduleShiftToken; remaining: number } | null = null;

    for (const token of candidates) {
      if (!this.canAssignShift(plan, date, token)) continue;
      const remaining = this.getRemaining(plan, token);
      if (remaining <= 0) continue;
      if (!best || remaining > best.remaining) {
        best = { token, remaining };
      }
    }

    return best?.token ?? null;
  }

  // === 4.5단계: 최악 패턴 재조정 ===

  private rebalanceWorstPatterns(): void {
    const conflicts: string[] = [];
    let adjustments = 0;
    const maxStreak = this.config.hardConstraints.maxConsecutiveNights;

    for (const plan of this.staffPlans.values()) {
      let streak = 0;
      for (let i = 0; i < this.dates.length; i++) {
        const date = this.dates[i];
        const shift = plan.schedule.get(date);
        if (shift === 'N') {
          streak += 1;
          if (streak > maxStreak) {
            const replacement = this.findNightReplacement(plan, i);
            if (replacement) {
              const success = this.setShift(plan, date, replacement, {
                reason: 'rebalance:night-streak',
              });
              if (success) {
                adjustments += 1;
                streak = replacement === 'N' ? streak : 0;
              }
            } else {
              conflicts.push(`${plan.staff.name} ${date} 연속 야간 해소 실패`);
            }
          }
        } else {
          streak = 0;
        }
      }

      for (let i = 0; i < this.dates.length; i++) {
        const shift = plan.schedule.get(this.dates[i]);
        if (shift === 'N') {
          const adjusted = this.ensureRestAfterNight(plan, i);
          if (adjusted) {
            adjustments += 1;
          } else {
            conflicts.push(`${plan.staff.name} ${this.dates[i]} 야간 후 휴식 확보 실패`);
          }
        }
      }
    }

    this.stepReports.push({
      step: '4.5 최악 패턴 재조정',
      processed: adjustments,
      conflicts,
      unmet: [],
    });
  }

  private findNightReplacement(plan: StaffPlan, nightIndex: number): ScheduleShiftToken | null {
    const date = this.dates[nightIndex];
    const candidates: ScheduleShiftToken[] = ['E', 'D', 'O'];
    for (const candidate of candidates) {
      if (!this.canAssignShift(plan, date, candidate)) continue;
      return candidate;
    }
    return null;
  }

  private ensureRestAfterNight(plan: StaffPlan, nightIndex: number): boolean {
    let adjusted = false;
    for (const offset of [1, 2]) {
      const date = this.dates[nightIndex + offset];
      if (!date) continue;
      if (plan.lockedDates.has(date)) return false;
      if (plan.schedule.get(date) === 'O') continue;
      if (!this.canAssignShift(plan, date, 'O')) return false;
      this.setShift(plan, date, 'O', { reason: 'rebalance:post-night' });
      adjusted = true;
    }
    return adjusted;
  }

  // === 5단계: 일별 인원 검증 ===

  private applyCoverageValidation(): void {
    const conflicts: string[] = [];
    const warnings: string[] = [];
    let adjustments = 0;

    const shifts: ShiftType[] = ['D', 'E', 'N'];

    for (const date of this.dates) {
      for (const shift of shifts) {
        const assigned = this.getAssignedStaff(date, shift);
        const minRequired = MIN_STAFF_PER_SHIFT[shift];
        if (assigned.length < minRequired) {
          const filled = this.backfillCoverage(date, shift, minRequired - assigned.length, conflicts);
          adjustments += filled;
          const updated = this.getAssignedStaff(date, shift);
          if (updated.length < minRequired) {
            conflicts.push(`${date} ${shift} 근무 최소 인원 (${minRequired}) 미충족`);
          }
        }

        const updatedAssigned = this.getAssignedStaff(date, shift);
        if (updatedAssigned.length === 0) continue;

        const juniorCount = updatedAssigned.filter((id) => this.staffPlans.get(id)?.staff.experienceLevel === 'JUNIOR').length;
        if (juniorCount / updatedAssigned.length > 0.3) {
          const rebalanced = this.rebalanceExperience(date, shift, updatedAssigned, conflicts);
          if (rebalanced === null) {
            warnings.push(`${date} ${shift} 신입 비율 ${(juniorCount / updatedAssigned.length * 100).toFixed(0)}%`);
          } else {
            adjustments += rebalanced;
          }
        }

        if (shift === 'D' && !updatedAssigned.some((id) => this.isDayLeader(id))) {
          if (this.promoteLeader(date, shift, 'day', conflicts)) {
            adjustments += 1;
          } else {
            warnings.push(`${date} D 근무 Day Leader 미배치`);
          }
        }

        if (shift === 'E' && !updatedAssigned.some((id) => this.isEveningLeader(id))) {
          if (this.promoteLeader(date, shift, 'evening', conflicts)) {
            adjustments += 1;
          } else {
            warnings.push(`${date} E 근무 Evening Leader 미배치`);
          }
        }
      }
    }

    this.warnings.push(...warnings);
    this.stepReports.push({
      step: '5. 인원 매칭 및 검증',
      processed: adjustments,
      conflicts,
      unmet: [],
    });
  }

  private getAssignedStaff(date: string, shift: ShiftType): string[] {
    const result: string[] = [];
    for (const [staffId, plan] of this.staffPlans.entries()) {
      const assignedShift = plan.schedule.get(date);
      if (assignedShift === shift) {
        result.push(staffId);
      }
    }
    return result;
  }

  private backfillCoverage(
    date: string,
    shift: ShiftType,
    needed: number,
    conflicts: string[]
  ): number {
    let filled = 0;
    for (const plan of this.staffPlans.values()) {
      if (filled >= needed) break;
      const current = plan.schedule.get(date);
      if (current === shift || plan.lockedDates.has(date)) continue;
      if (current === 'A' && shift !== 'D') continue;
      if (!this.canAssignShift(plan, date, shift)) continue;
      if (current && !this.canAssignShift(plan, date, 'O')) continue;

      if (current && current !== 'O') {
        this.setShift(plan, date, 'O', { reason: 'coverage:reassign' });
      }

      const success = this.setShift(plan, date, shift, { reason: 'coverage:fill' });
      if (success) {
        filled += 1;
      }
    }

    if (filled < needed) {
      conflicts.push(`${date} ${shift} 근무에 ${needed - filled}명 부족`);
    }

    return filled;
  }

  private rebalanceExperience(
    date: string,
    shift: ShiftType,
    staffIds: string[],
    conflicts: string[]
  ): number | null {
    let adjustments = 0;
    const limit = Math.floor(staffIds.length * 0.3);
    let juniorIds = staffIds.filter((id) => this.staffPlans.get(id)?.staff.experienceLevel === 'JUNIOR');

    if (juniorIds.length <= limit) return 0;

    for (const juniorId of juniorIds) {
      const juniorPlan = this.staffPlans.get(juniorId)!;
      if (juniorPlan.lockedDates.has(date)) continue;
      const seniorPlan = this.findSeniorCandidate(date, shift, staffIds);
      if (!seniorPlan) break;

      const juniorShiftBackup = juniorPlan.schedule.get(date);
      if (!this.canAssignShift(juniorPlan, date, 'O')) continue;
      this.setShift(juniorPlan, date, 'O', { reason: 'coverage:experience' });

      const seniorSuccess = this.setShift(seniorPlan, date, shift, { reason: 'coverage:experience' });
      if (!seniorSuccess) {
        if (juniorShiftBackup) {
          this.setShift(juniorPlan, date, juniorShiftBackup, { reason: 'coverage:experience:rollback' });
        }
        continue;
      }

      adjustments += 1;
      staffIds.splice(staffIds.indexOf(juniorId), 1, seniorPlan.staff.id);
      juniorIds = staffIds.filter((id) => this.staffPlans.get(id)?.staff.experienceLevel === 'JUNIOR');
      if (juniorIds.length <= limit) return adjustments;
    }

    if (juniorIds.length > limit) {
      conflicts.push(`${date} ${shift} 신입 비율을 규정 이하로 낮추지 못했습니다.`);
      return null;
    }

    return adjustments;
  }

  private findSeniorCandidate(date: string, shift: ShiftType, assignedIds: string[]): StaffPlan | null {
    for (const [staffId, plan] of this.staffPlans.entries()) {
      if (assignedIds.includes(staffId)) continue;
      if (plan.lockedDates.has(date)) continue;
      if (plan.staff.experienceLevel === 'JUNIOR') continue;
      const current = plan.schedule.get(date);
      if (current && current !== 'O') continue;
      if (!this.canAssignShift(plan, date, shift)) continue;
      return plan;
    }
    return null;
  }

  private promoteLeader(
    date: string,
    shift: ShiftType,
    type: 'day' | 'evening',
    conflicts: string[]
  ): boolean {
    const leaderCheck = type === 'day' ? (plan: StaffPlan) => this.isDayLeader(plan.staff.id) : (plan: StaffPlan) => this.isEveningLeader(plan.staff.id);

    for (const plan of this.staffPlans.values()) {
      if (!leaderCheck(plan)) continue;
      if (plan.lockedDates.has(date)) continue;
      const current = plan.schedule.get(date);
      if (current && current !== 'O' && current !== 'A') continue;
      if (!this.canAssignShift(plan, date, shift)) continue;
      this.setShift(plan, date, shift, { reason: `coverage:${type}-leader` });
      return true;
    }

    conflicts.push(`${date} ${shift} 리더십 인력 확보 실패`);
    return false;
  }

  private isDayLeader(staffId: string): boolean {
    const plan = this.staffPlans.get(staffId);
    return !!plan?.profile.dayLeader;
  }

  private isEveningLeader(staffId: string): boolean {
    const plan = this.staffPlans.get(staffId);
    return !!plan?.profile.eveningLeader;
  }

  // === 스케줄 → Assignments 변환 ===

  private materializeAssignments(): Assignment[] {
    const assignments: Assignment[] = [];
    for (const plan of this.staffPlans.values()) {
      for (const [date, token] of plan.schedule.entries()) {
        if (token === 'O') continue;
        const shiftId = this.resolveShiftId(token);
        assignments.push({
          id: `${date}-${plan.staff.id}-${shiftId}`,
          scheduleId: 'temp',
          staffId: plan.staff.id,
          shiftId,
          date,
          isOvertime: false,
          isReplacement: false,
        });
      }
    }
    return assignments;
  }

  private resolveShiftId(token: ScheduleShiftToken): string {
    const definition = this.shiftLookup.get(token);
    if (definition) {
      return definition.id;
    }

    if (token === 'A') {
      if (!this.warnings.includes('A 근무가 정의되지 않아 가상 ID를 사용합니다.')) {
        this.warnings.push('A 근무가 정의되지 않아 가상 ID를 사용합니다.');
      }
      return 'A';
    }

    return token;
  }

  // === 내부 상태 도우미 ===

  private canAssignShift(plan: StaffPlan, date: string, token: ScheduleShiftToken): boolean {
    if (!this.dateSet.has(date)) return false;
    if (plan.lockedDates.has(date) && plan.schedule.get(date) !== token) return false;

    if (token !== 'O' && this.weekendDates.has(date) && plan.profile.allowWeekendAssignments === false) {
      return false;
    }

    if (token === 'N') {
      const previousStreak = this.countConsecutive(plan, date, 'N', -1);
      if (previousStreak >= this.config.hardConstraints.maxConsecutiveNights) {
        return false;
      }
    }

    const remaining = this.getRemaining(plan, token);
    if (remaining <= 0) {
      if (token === 'O') {
        return false;
      }
    }

    return true;
  }

  private countConsecutive(plan: StaffPlan, date: string, token: ScheduleShiftToken, direction: -1 | 1): number {
    let count = 0;
    let index = this.dates.indexOf(date) + direction;
    while (index >= 0 && index < this.dates.length) {
      if (plan.schedule.get(this.dates[index]) !== token) break;
      count += 1;
      index += direction;
    }
    return count;
  }

  private getRemaining(plan: StaffPlan, token: ScheduleShiftToken): number {
    return plan.quotas[token] - plan.assigned[token];
  }

  private setShift(
    plan: StaffPlan,
    date: string,
    token: ScheduleShiftToken,
    options?: { locked?: boolean; reason?: string }
  ): boolean {
    if (!this.dateSet.has(date)) return false;
    if (!this.canAssignShift(plan, date, token)) return false;

    const current = plan.schedule.get(date);
    if (current === token) {
      if (options?.locked) plan.lockedDates.add(date);
      if (options?.reason) plan.appliedReasons.set(date, options.reason);
      return true;
    }

    if (current) {
      plan.assigned[current] = Math.max(0, plan.assigned[current] - 1);
    }

    plan.schedule.set(date, token);
    plan.assigned[token] = (plan.assigned[token] ?? 0) + 1;

    if (options?.locked) {
      plan.lockedDates.add(date);
    } else {
      plan.lockedDates.delete(date);
    }

    if (options?.reason) {
      plan.appliedReasons.set(date, options.reason);
    }

    return true;
  }

  private buildShiftLookup(shifts: ShiftDefinition[]): Map<ScheduleShiftToken | ShiftType, ShiftDefinition> {
    const map = new Map<ScheduleShiftToken | ShiftType, ShiftDefinition>();
    for (const shift of shifts) {
      map.set(shift.type as ShiftType, shift);
    }
    return map;
  }

  private buildProfileMap(profiles: StaffSchedulingProfile[]): Map<string, StaffSchedulingProfile> {
    const map = new Map<string, StaffSchedulingProfile>();
    for (const profile of profiles) {
      map.set(profile.staffId, profile);
    }
    return map;
  }

  private indexRequests(requests: ScheduleRequest[]): Map<string, ScheduleRequest[]> {
    const map = new Map<string, ScheduleRequest[]>();
    for (const request of requests) {
      const date = normalizeDate(request.date);
      if (!this.dateSet.has(date)) continue;
      const entry: ScheduleRequest = { ...request, date };
      const list = map.get(entry.staffId) ?? [];
      list.push(entry);
      map.set(entry.staffId, list);
    }
    return map;
  }
}

/**
 * 편의 함수: 스케줄 생성
 */
export async function generateSchedule(config: ScheduleGenerationConfig): Promise<ScheduleGenerationResult> {
  const generator = new ScheduleGenerator(config);
  return generator.generate();
}
