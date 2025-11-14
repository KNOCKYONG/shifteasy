import { eachDayOfInterval, endOfMonth, format, startOfMonth } from 'date-fns';

export type SimpleWorkPattern = 'three-shift' | 'night-intensive' | 'weekday-only' | undefined;

export interface Employee {
  id: string;
  name: string;
  role: 'RN' | 'CN' | 'SN' | 'NA' | string;
  workPatternType?: SimpleWorkPattern;
  preferredShiftTypes?: Record<string, number>;
  maxConsecutiveDaysPreferred?: number;
  maxConsecutiveNightsPreferred?: number;
}

export interface Holiday {
  date: string;
  name: string;
}

export interface SpecialRequest {
  employeeId: string;
  requestType: string;
  date: string;
  shiftTypeCode?: string | null;
}

export interface ScheduleAssignment {
  employeeId: string;
  date: string;
  shift: string;
}

interface TeamPatternConfig {
  pattern?: string[];
}

export interface SimpleSchedulerConfig {
  year: number;
  month: number; // 1-12
  employees: Employee[];
  holidays?: Holiday[];
  specialRequests?: SpecialRequest[];
  teamPattern?: TeamPatternConfig;
  requiredStaffPerShift?: Record<string, number>;
  avoidPatterns?: string[][];
}

/**
 * Placeholder scheduler that produces extremely simple cyclic schedules.
 * This replaces the legacy SimpleScheduler implementation so that the
 * schedule page can remain functional until the new AI scheduler is wired up.
 */
export class SimpleScheduler {
  private readonly config: SimpleSchedulerConfig;

  constructor(config: SimpleSchedulerConfig) {
    this.config = config;
  }

  async generate(): Promise<ScheduleAssignment[]> {
    const { year, month, employees } = this.config;
    if (!employees || employees.length === 0) {
      return [];
    }

    const monthStart = startOfMonth(new Date(year, month - 1, 1));
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const baseShifts = ['D', 'E', 'N', 'OFF'];
    const assignments: ScheduleAssignment[] = [];

    days.forEach((date, dayIndex) => {
      const dateStr = format(date, 'yyyy-MM-dd');

      employees.forEach((employee, employeeIndex) => {
        const shiftIndex = (dayIndex + employeeIndex) % baseShifts.length;
        const shift = baseShifts[shiftIndex];
        assignments.push({
          employeeId: employee.id,
          date: dateStr,
          shift,
        });
      });
    });

    return assignments;
  }
}
