import { readFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { isWeekend } from 'date-fns';
import { serializeMilpCspInput } from '@/lib/scheduler/milp-csp/serializer';
import type { MilpCspScheduleInput, MilpCspEmployee } from '@/lib/scheduler/milp-csp/types';
import type { ScheduleAssignment } from '@/lib/types/scheduler';

export interface ScenarioValidationRules {
  enforceSpecialRequests?: boolean;
  requiredStaffShifts?: string[];
  teamCoverage?: { shifts: string[]; teams: string[] };
  careerGroupCoverage?: { shifts: string[]; groups: string[]; tolerance?: number };
  nightIntensiveOnlyNO?: boolean;
  weekdayOnlyPattern?: { weekdayShift: string; weekendShift: string };
  maxOffDifference?: { workPatternType: string; tolerance: number };
}

export interface ScenarioFile {
  description: string;
  scheduleInput: any;
  careerGroupsConfig?: any[];
  yearsOfService?: Record<string, number>;
  validationRules?: ScenarioValidationRules;
}

export interface EvaluationResult {
  name: string;
  passed: boolean;
  message?: string;
}

const resolveScenarioPath = (fileName: string) => {
  if (isAbsolute(fileName)) return fileName;
  if (fileName.includes('/') || fileName.includes('\\')) {
    return join(process.cwd(), fileName);
  }
  return join(process.cwd(), 'tests', 'milp-csp', fileName);
};

export async function loadScenario(fileName: string): Promise<ScenarioFile> {
  const content = await readFile(resolveScenarioPath(fileName), 'utf-8');
  return JSON.parse(content) as ScenarioFile;
}

export async function loadAssignments(fileName: string): Promise<ScheduleAssignment[]> {
  const content = await readFile(resolveScenarioPath(fileName), 'utf-8');
  const items = JSON.parse(content) as Array<{
    employeeId: string;
    date: string;
    shiftId?: string;
    shiftType?: string;
    isLocked?: boolean;
  }>;
  return items.map((item) => ({
    employeeId: item.employeeId,
    date: new Date(item.date),
    shiftId: item.shiftId ?? '',
    shiftType: item.shiftType,
    isLocked: item.isLocked ?? false,
  }));
}

export const buildMilpInput = (scenario: ScenarioFile): MilpCspScheduleInput => {
  const startDate = new Date(scenario.scheduleInput.startDate);
  const endDate = new Date(scenario.scheduleInput.endDate);
  return serializeMilpCspInput(
    {
      ...scenario.scheduleInput,
      startDate,
      endDate,
      teamPattern: scenario.scheduleInput.teamPattern ?? null,
    },
    {
      previousOffAccruals: {},
      careerGroups: scenario.careerGroupsConfig?.map((group, index) => ({
        code: group.code ?? `CG${index + 1}`,
        name: group.name ?? `경력 그룹 ${index + 1}`,
        alias: `CG${index + 1}`,
        minYears: group.minYears,
        maxYears: group.maxYears,
        description: group.description,
      })),
      yearsOfServiceMap: new Map(Object.entries(scenario.yearsOfService ?? {})),
    }
  );
};

const buildShiftMap = (input: MilpCspScheduleInput) => {
  const map = new Map<string, string>();
  input.shifts.forEach((shift) => {
    map.set(shift.id, (shift.code ?? shift.name ?? shift.id).toUpperCase());
  });
  return map;
};

const normalizeShift = (assignment: ScheduleAssignment, shiftMap: Map<string, string>) => {
  if (assignment.shiftType) {
    return assignment.shiftType.replace('^', '').toUpperCase();
  }
  return shiftMap.get(assignment.shiftId ?? '') ?? 'O';
};

const ensureUniqueAssignments = (assignments: ScheduleAssignment[]): EvaluationResult => {
  const seen = new Set<string>();
  for (const assignment of assignments) {
    const key = `${assignment.employeeId}-${assignment.date.toISOString().slice(0, 10)}`;
    if (seen.has(key)) {
      return { name: 'uniqueAssignments', passed: false, message: `중복 배정: ${key}` };
    }
    seen.add(key);
  }
  return { name: 'uniqueAssignments', passed: true };
};

const checkSpecialRequests = (
  input: MilpCspScheduleInput,
  assignments: ScheduleAssignment[],
  shiftMap: Map<string, string>
): EvaluationResult => {
  if (!input.specialRequests?.length) return { name: 'specialRequests', passed: true };
  const lookup = new Map<string, string>();
  assignments.forEach((assignment) => {
    lookup.set(
      `${assignment.employeeId}-${assignment.date.toISOString().slice(0, 10)}`,
      normalizeShift(assignment, shiftMap)
    );
  });
  for (const req of input.specialRequests) {
    const key = `${req.employeeId}-${req.date}`;
    const assigned = lookup.get(key);
    if (!assigned) {
      return { name: 'specialRequests', passed: false, message: `${key} 배정 없음` };
    }
    if (req.shiftTypeCode && assigned !== req.shiftTypeCode.toUpperCase()) {
      return {
        name: 'specialRequests',
        passed: false,
        message: `${key} 예상 ${req.shiftTypeCode}, 실제 ${assigned}`,
      };
    }
  }
  return { name: 'specialRequests', passed: true };
};

const checkRequiredStaff = (
  input: MilpCspScheduleInput,
  assignments: ScheduleAssignment[],
  shiftMap: Map<string, string>,
  shifts: string[]
): EvaluationResult => {
  const required = input.requiredStaffPerShift ?? {};
  const grouped = new Map<string, Map<string, number>>();
  for (const assignment of assignments) {
    const code = normalizeShift(assignment, shiftMap);
    if (!shifts.includes(code)) continue;
    const day = assignment.date.toISOString().slice(0, 10);
    const counts = grouped.get(day) ?? new Map<string, number>();
    counts.set(code, (counts.get(code) ?? 0) + 1);
    grouped.set(day, counts);
  }
  for (const [day, counts] of grouped.entries()) {
    for (const code of shifts) {
      const minRequired = required[code] ?? 0;
      const actual = counts.get(code) ?? 0;
      if (actual < minRequired) {
        return {
          name: 'requiredStaff',
          passed: false,
          message: `${day} ${code} 최소 ${minRequired}, 실제 ${actual}`,
        };
      }
    }
  }
  return { name: 'requiredStaff', passed: true };
};

const buildEmployeeMap = (input: MilpCspScheduleInput) => {
  const map = new Map<string, MilpCspEmployee>();
  input.employees.forEach((emp) => map.set(emp.id, emp));
  return map;
};

const checkTeamCoverage = (
  input: MilpCspScheduleInput,
  assignments: ScheduleAssignment[],
  shiftMap: Map<string, string>,
  shifts: string[],
  teams: string[]
): EvaluationResult => {
  const employees = buildEmployeeMap(input);
  const coverage = new Map<string, Set<string>>();
  for (const assignment of assignments) {
    const code = normalizeShift(assignment, shiftMap);
    if (!shifts.includes(code)) continue;
    const emp = employees.get(assignment.employeeId);
    if (!emp) continue;
    const team = emp.teamId ?? 'unassigned';
    const key = `${assignment.date.toISOString().slice(0, 10)}-${code}`;
    const set = coverage.get(key) ?? new Set<string>();
    set.add(team);
    coverage.set(key, set);
  }
  for (const [key, set] of coverage.entries()) {
    for (const team of teams) {
      if (!set.has(team)) {
        return {
          name: 'teamCoverage',
          passed: false,
          message: `${key} 팀 ${team} 배정 없음`,
        };
      }
    }
  }
  return { name: 'teamCoverage', passed: true };
};

const checkCareerGroups = (
  input: MilpCspScheduleInput,
  assignments: ScheduleAssignment[],
  shiftMap: Map<string, string>,
  shifts: string[],
  groups: string[],
  tolerance = 0
): EvaluationResult => {
  const employees = buildEmployeeMap(input);
  const counts: Record<string, number> = {};
  groups.forEach((group) => (counts[group] = 0));
  for (const assignment of assignments) {
    const code = normalizeShift(assignment, shiftMap);
    if (!shifts.includes(code)) continue;
    const emp = employees.get(assignment.employeeId);
    const group = emp?.careerGroupCode;
    if (group && counts[group] !== undefined) {
      counts[group] += 1;
    }
  }
  const values = Object.values(counts);
  if (!values.length) return { name: 'careerGroupCoverage', passed: true };
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max - min > tolerance) {
    return {
      name: 'careerGroupCoverage',
      passed: false,
      message: `경력 그룹 편차 ${max - min} > tolerance ${tolerance}`,
    };
  }
  return { name: 'careerGroupCoverage', passed: true };
};

const checkNightIntensive = (
  input: MilpCspScheduleInput,
  assignments: ScheduleAssignment[],
  shiftMap: Map<string, string>
): EvaluationResult => {
  const nightIds = new Set(
    input.employees.filter((emp) => emp.workPatternType === 'night-intensive').map((emp) => emp.id)
  );
  for (const assignment of assignments) {
    if (!nightIds.has(assignment.employeeId)) continue;
    const code = normalizeShift(assignment, shiftMap);
    if (!['N', 'O'].includes(code)) {
      return {
        name: 'nightIntensiveOnlyNO',
        passed: false,
        message: `${assignment.employeeId} ${assignment.date.toISOString().slice(0, 10)} ${code}`,
      };
    }
  }
  return { name: 'nightIntensiveOnlyNO', passed: true };
};

const checkWeekdayOnly = (
  input: MilpCspScheduleInput,
  assignments: ScheduleAssignment[],
  shiftMap: Map<string, string>,
  weekdayShift: string,
  weekendShift: string
): EvaluationResult => {
  const ids = new Set(
    input.employees.filter((emp) => emp.workPatternType === 'weekday-only').map((emp) => emp.id)
  );
  for (const assignment of assignments) {
    if (!ids.has(assignment.employeeId)) continue;
    const code = normalizeShift(assignment, shiftMap);
    if (isWeekend(assignment.date) && code !== weekendShift) {
      return {
        name: 'weekdayOnlyPattern',
        passed: false,
        message: `${assignment.employeeId} 주말 ${code}`,
      };
    }
    if (!isWeekend(assignment.date) && code !== weekdayShift) {
      return {
        name: 'weekdayOnlyPattern',
        passed: false,
        message: `${assignment.employeeId} 평일 ${code}`,
      };
    }
  }
  return { name: 'weekdayOnlyPattern', passed: true };
};

const checkMaxOffDifference = (
  input: MilpCspScheduleInput,
  assignments: ScheduleAssignment[],
  shiftMap: Map<string, string>,
  workPatternType: string,
  tolerance: number
): EvaluationResult => {
  const ids = input.employees.filter((emp) => emp.workPatternType === workPatternType).map((emp) => emp.id);
  if (!ids.length) return { name: 'maxOffDifference', passed: true };
  const counts = new Map<string, number>();
  ids.forEach((id) => counts.set(id, 0));
  for (const assignment of assignments) {
    if (!counts.has(assignment.employeeId)) continue;
    const code = normalizeShift(assignment, shiftMap);
    if (code === 'O') {
      counts.set(assignment.employeeId, (counts.get(assignment.employeeId) ?? 0) + 1);
    }
  }
  const values = Array.from(counts.values());
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max - min > tolerance) {
    return {
      name: 'maxOffDifference',
      passed: false,
      message: `${workPatternType} 휴무 편차 ${max - min} > tolerance ${tolerance}`,
    };
  }
  return { name: 'maxOffDifference', passed: true };
};

export const evaluateScenario = (
  scenario: ScenarioFile,
  milpInput: MilpCspScheduleInput,
  assignments: ScheduleAssignment[]
): EvaluationResult[] => {
  const rules = scenario.validationRules ?? {};
  const shiftMap = buildShiftMap(milpInput);
  const results: EvaluationResult[] = [ensureUniqueAssignments(assignments)];

  if (rules.enforceSpecialRequests) {
    results.push(checkSpecialRequests(milpInput, assignments, shiftMap));
  }
  if (rules.requiredStaffShifts?.length) {
    results.push(checkRequiredStaff(milpInput, assignments, shiftMap, rules.requiredStaffShifts));
  }
  if (rules.teamCoverage) {
    results.push(
      checkTeamCoverage(
        milpInput,
        assignments,
        shiftMap,
        rules.teamCoverage.shifts,
        rules.teamCoverage.teams
      )
    );
  }
  if (rules.careerGroupCoverage) {
    results.push(
      checkCareerGroups(
        milpInput,
        assignments,
        shiftMap,
        rules.careerGroupCoverage.shifts,
        rules.careerGroupCoverage.groups,
        rules.careerGroupCoverage.tolerance ?? 0
      )
    );
  }
  if (rules.nightIntensiveOnlyNO) {
    results.push(checkNightIntensive(milpInput, assignments, shiftMap));
  }
  if (rules.weekdayOnlyPattern) {
    results.push(
      checkWeekdayOnly(
        milpInput,
        assignments,
        shiftMap,
        rules.weekdayOnlyPattern.weekdayShift,
        rules.weekdayOnlyPattern.weekendShift
      )
    );
  }
  if (rules.maxOffDifference) {
    results.push(
      checkMaxOffDifference(
        milpInput,
        assignments,
        shiftMap,
        rules.maxOffDifference.workPatternType,
        rules.maxOffDifference.tolerance
      )
    );
  }
  return results;
};
