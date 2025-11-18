import type {
  MilpCspAliasMaps,
  MilpCspCareerGroup,
  MilpCspEmployee,
  MilpCspScheduleInput,
  MilpCspSpecialRequest,
  MilpCspSolverOptions,
} from './types';

const EMPLOYEE_ALIAS_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const TEAM_ALIAS_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface ScheduleLikeEmployee {
  id: string;
  name: string;
  role: string;
  departmentId?: string;
  teamId?: string | null;
  workPatternType?: MilpCspEmployee['workPatternType'];
  preferredShiftTypes?: Record<string, number>;
  maxConsecutiveDaysPreferred?: number;
  maxConsecutiveNightsPreferred?: number;
  guaranteedOffDays?: number;
}

export interface ScheduleLikeInput {
  departmentId: string;
  startDate: Date;
  endDate: Date;
  employees: ScheduleLikeEmployee[];
  shifts: MilpCspScheduleInput['shifts'];
  constraints?: MilpCspScheduleInput['constraints'];
  specialRequests?: MilpCspSpecialRequest[];
  holidays?: MilpCspScheduleInput['holidays'];
  teamPattern?: MilpCspScheduleInput['teamPattern'];
  requiredStaffPerShift?: Record<string, number>;
  nightIntensivePaidLeaveDays?: number;
}

export interface SerializeMilpCspInputOptions {
  previousOffAccruals?: Record<string, number>;
  careerGroups?: MilpCspCareerGroup[];
  yearsOfServiceMap?: Map<string, number>;
  solverOptions?: MilpCspSolverOptions;
}

const buildEmployeeAliasMap = (employees: ScheduleLikeEmployee[]) => {
  const map: Record<string, string> = {};
  employees.forEach((employee, index) => {
    map[employee.id] =
      index < EMPLOYEE_ALIAS_CHARS.length ? EMPLOYEE_ALIAS_CHARS[index] : `e${index}`;
  });
  return map;
};

const buildTeamAliasMap = (employees: ScheduleLikeEmployee[]) => {
  const teamIds = Array.from(
    new Set(
      employees
        .map((emp) => emp.teamId)
        .filter((teamId): teamId is string => Boolean(teamId))
    )
  );
  const map: Record<string, string> = {};
  teamIds.forEach((teamId, index) => {
    map[teamId] = index < TEAM_ALIAS_CHARS.length ? TEAM_ALIAS_CHARS[index] : `T${index}`;
  });
  return map;
};

const findCareerGroupForYears = (
  careerGroups: MilpCspCareerGroup[],
  years?: number
) => {
  if (typeof years !== 'number') {
    return null;
  }

  return (
    careerGroups.find((group) => {
      const min = typeof group.minYears === 'number' ? group.minYears : -Infinity;
      const max =
        typeof group.maxYears === 'number' ? group.maxYears : Number.POSITIVE_INFINITY;
      return years >= min && years <= max;
    }) ?? null
  );
};

export function serializeMilpCspInput(
  source: ScheduleLikeInput,
  options: SerializeMilpCspInputOptions = {}
): MilpCspScheduleInput {
  const {
    previousOffAccruals = {},
    careerGroups = [],
    yearsOfServiceMap = new Map<string, number>(),
    solverOptions,
  } = options;

  const employeeAliasMap = buildEmployeeAliasMap(source.employees);
  const teamAliasMap = buildTeamAliasMap(source.employees);
  const careerGroupAliasMap: Record<string, string> = {};
  careerGroups.forEach((group) => {
    careerGroupAliasMap[group.code] = group.alias;
  });

  const normalizedEmployees: MilpCspEmployee[] = source.employees.map((emp) => {
    const alias = employeeAliasMap[emp.id];
    const teamAlias = emp.teamId ? teamAliasMap[emp.teamId] ?? null : null;
    const yearsOfService = yearsOfServiceMap.get(emp.id);
    const matchedGroup = findCareerGroupForYears(careerGroups, yearsOfService);

    return {
      ...emp,
      alias,
      teamAlias,
      yearsOfService,
      careerGroupAlias: matchedGroup?.alias ?? null,
      careerGroupCode: matchedGroup?.code ?? null,
      careerGroupName: matchedGroup?.name ?? null,
      previousOffCarry: previousOffAccruals[emp.id] ?? 0,
    };
  });

  const aliasMaps: MilpCspAliasMaps = {
    employeeAliasMap,
    teamAliasMap,
    careerGroupAliasMap,
  };

  return {
    departmentId: source.departmentId,
    startDate: source.startDate,
    endDate: source.endDate,
    employees: normalizedEmployees,
    shifts: source.shifts,
    constraints: source.constraints,
    specialRequests: source.specialRequests,
    holidays: source.holidays,
    teamPattern: source.teamPattern,
    requiredStaffPerShift: source.requiredStaffPerShift,
    nightIntensivePaidLeaveDays: source.nightIntensivePaidLeaveDays,
    previousOffAccruals,
    careerGroups,
    aliasMaps,
    options: solverOptions,
  };
}
