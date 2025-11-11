import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  validateSchedule,
  type AiEmployee,
  type AiScheduleValidationRequest,
  type WorkPatternType,
} from '@/lib/scheduler/ai-scheduler';
import type { Shift } from '@/lib/types/scheduler';

export const dynamic = 'force-dynamic';

const ACCESS_CONTROL_HEADERS =
  'Content-Type, x-tenant-id, x-user-id, x-user-role, x-department-id';

function createCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': ACCESS_CONTROL_HEADERS,
    ...(origin ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
    Vary: 'Origin',
  };
}

function normalizeHeaders(input?: HeadersInit): Record<string, string> {
  if (!input) {
    return {};
  }
  if (input instanceof Headers) {
    return Object.fromEntries(input.entries());
  }
  if (Array.isArray(input)) {
    return Object.fromEntries(input);
  }
  return input;
}

function jsonWithCors(request: NextRequest, body: unknown, init?: ResponseInit): NextResponse {
  const headers = {
    ...createCorsHeaders(request),
    ...normalizeHeaders(init?.headers),
  };
  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

const EmployeeSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  role: z.string().optional(),
  departmentId: z.string().optional(),
  teamId: z.string().optional().nullable(),
  workPatternType: z.enum(['three-shift', 'night-intensive', 'weekday-only']).optional(),
  preferredShiftTypes: z.record(z.string(), z.number()).optional(),
  maxConsecutiveDaysPreferred: z.number().optional(),
  maxConsecutiveNightsPreferred: z.number().optional(),
  preferences: z
    .object({
      workPatternType: z.string().optional(),
      preferredShifts: z.array(z.string()).optional(),
    })
    .optional(),
}).passthrough();

const ShiftSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  code: z.string().optional(),
  type: z.enum(['day', 'evening', 'night', 'off', 'leave', 'custom']).optional(),
  requiredStaff: z.number().optional(),
  color: z.string().optional(),
  time: z
    .object({
      start: z.string().default('00:00'),
      end: z.string().default('00:00'),
      hours: z.number().default(8),
      breakMinutes: z.number().optional(),
    })
    .optional(),
  minStaff: z.number().optional(),
  maxStaff: z.number().optional(),
}).passthrough();

const HolidaySchema = z.object({
  date: z.string(),
  name: z.string().optional(),
});

const ValidateScheduleSchema = z.object({
  schedule: z.object({
    id: z.string().optional(),
    departmentId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    assignments: z.array(
      z.object({
        employeeId: z.string(),
        shiftId: z.string(),
        date: z.string(),
        isLocked: z.boolean(),
        isSwapRequested: z.boolean().optional(),
        shiftType: z.string().optional(),
        swapRequestId: z.string().optional(),
      })
    ),
    status: z.enum(['draft', 'published', 'archived']).optional(),
  }),
  employees: z.array(EmployeeSchema),
  shifts: z.array(ShiftSchema),
  constraints: z.array(z.any()).optional(),
  requiredStaffPerShift: z.record(z.string(), z.number()).optional(),
  holidays: z.array(HolidaySchema).optional(),
  nightIntensivePaidLeaveDays: z.number().optional(),
});

type ValidateScheduleInput = z.infer<typeof ValidateScheduleSchema>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ValidateScheduleSchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithCors(
        request,
        { success: false, error: 'Invalid request data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data: ValidateScheduleInput = parsed.data;

    const validationRequest: AiScheduleValidationRequest = {
      departmentId: data.schedule.departmentId,
      startDate: new Date(data.schedule.startDate),
      endDate: new Date(data.schedule.endDate),
      employees: data.employees.map((employee) => normalizeEmployee(employee, data.schedule.departmentId)),
      shifts: data.shifts.map(normalizeShift),
      assignments: data.schedule.assignments.map((assignment) => ({
        ...assignment,
        date: new Date(assignment.date),
      })),
      specialRequests: [],
      holidays: (data.holidays ?? []).map((holiday) => ({
        date: holiday.date,
        name: holiday.name ?? '',
      })),
      teamPattern: null,
      requiredStaffPerShift: data.requiredStaffPerShift,
      nightIntensivePaidLeaveDays: data.nightIntensivePaidLeaveDays,
    };

    const result = await validateSchedule(validationRequest);

    return jsonWithCors(
      request,
      {
        success: true,
        data: {
          score: result.score.total,
          breakdown: result.score,
          stats: result.stats,
          violations: result.violations,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Schedule validation error:', error);
    return jsonWithCors(
      request,
      {
        success: false,
        error: 'Failed to validate schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: createCorsHeaders(request),
  });
}

function normalizeEmployee(raw: z.infer<typeof EmployeeSchema>, fallbackDepartmentId: string): AiEmployee {
  let preferredShiftTypes: Record<string, number> | undefined;
  if (raw.preferredShiftTypes && Object.keys(raw.preferredShiftTypes).length > 0) {
    preferredShiftTypes = raw.preferredShiftTypes;
  } else if (raw.preferences?.preferredShifts && raw.preferences.preferredShifts.length > 0) {
    const derived = raw.preferences.preferredShifts.reduce<Record<string, number>>((acc, code) => {
      const normalized = code.trim().toUpperCase();
      if (normalized) {
        acc[normalized] = 1;
      }
      return acc;
    }, {});
    preferredShiftTypes = Object.keys(derived).length > 0 ? derived : undefined;
  }

  return {
    id: raw.id,
    name: raw.name ?? raw.id,
    role: raw.role ?? 'RN',
    departmentId: raw.departmentId ?? fallbackDepartmentId,
    teamId: raw.teamId ?? null,
    workPatternType: resolveWorkPatternType(raw.workPatternType ?? raw.preferences?.workPatternType),
    preferredShiftTypes,
    maxConsecutiveDaysPreferred: raw.maxConsecutiveDaysPreferred,
    maxConsecutiveNightsPreferred: raw.maxConsecutiveNightsPreferred,
  };
}

function normalizeShift(raw: z.infer<typeof ShiftSchema>): Shift {
  const time = raw.time ?? { start: '00:00', end: '00:00', hours: 8 };
  return {
    id: raw.id,
    code: raw.code,
    type: raw.type ?? 'custom',
    name: raw.name ?? raw.id,
    time,
    color: raw.color ?? '#94a3b8',
    requiredStaff: raw.requiredStaff ?? 1,
    minStaff: raw.minStaff,
    maxStaff: raw.maxStaff,
  };
}

const WORK_PATTERN_TYPES: WorkPatternType[] = ['three-shift', 'night-intensive', 'weekday-only'];

function resolveWorkPatternType(value?: string | null): WorkPatternType {
  if (value && WORK_PATTERN_TYPES.includes(value as WorkPatternType)) {
    return value as WorkPatternType;
  }
  return 'three-shift';
}
