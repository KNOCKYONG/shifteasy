import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Request validation schema
const ValidateScheduleSchema = z.object({
  schedule: z.object({
    id: z.string().optional(),
    departmentId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    assignments: z.array(z.object({
      employeeId: z.string(),
      shiftId: z.string(),
      date: z.string(),
      isLocked: z.boolean(),
      isSwapRequested: z.boolean().optional(),
      swapRequestId: z.string().optional(),
    })),
    status: z.enum(['draft', 'published', 'archived']).optional(),
  }),
  employees: z.array(z.any()),
  shifts: z.array(z.any()),
  constraints: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['hard', 'soft']),
    category: z.enum(['legal', 'contractual', 'operational', 'preference', 'fairness']),
    weight: z.number(),
    active: z.boolean(),
    config: z.record(z.string(), z.any()).optional(),
  })),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (user.role === 'member') {
      return NextResponse.json(
        { error: '권한이 없습니다. 스케줄 검증은 관리자 또는 매니저만 가능합니다.' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = ValidateScheduleSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: (validationResult.error as any).errors
        },
        { status: 400 }
      );
    }

    const { schedule, employees, shifts, constraints } = validationResult.data;

    if (user.role === 'manager' && user.departmentId && user.departmentId !== schedule.departmentId) {
      return NextResponse.json(
        { error: '다른 부서의 스케줄은 검증할 수 없습니다.' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: '테넌트 정보가 존재하지 않습니다.' },
        { status: 400 }
      );
    }

    // Convert data to maps for easy lookup
    const employeeMap = new Map(employees.map((e: any) => [e.id, e]));
    const shiftMap = new Map(shifts.map((s: any) => [s.id, s]));

    // Convert assignments with date conversion
    const convertedAssignments = schedule.assignments.map(assignment => ({
      ...assignment,
      date: new Date(assignment.date),
    }));

    // Basic validation checks
    const violations: any[] = [];

    // Check 1: All employees exist
    for (const assignment of convertedAssignments) {
      if (!employeeMap.has(assignment.employeeId)) {
        violations.push({
          constraintId: 'employee-exists',
          constraintName: 'Employee Exists',
          type: 'hard',
          severity: 'critical',
          message: `직원 ${assignment.employeeId}를 찾을 수 없습니다`,
          affectedEmployees: [assignment.employeeId],
          affectedDates: [assignment.date],
          cost: 100,
        });
      }
    }

    // Check 2: All shifts exist
    for (const assignment of convertedAssignments) {
      if (!shiftMap.has(assignment.shiftId)) {
        violations.push({
          constraintId: 'shift-exists',
          constraintName: 'Shift Exists',
          type: 'hard',
          severity: 'critical',
          message: `시프트 ${assignment.shiftId}를 찾을 수 없습니다`,
          affectedEmployees: [assignment.employeeId],
          affectedDates: [assignment.date],
          cost: 100,
        });
      }
    }

    // Check 3: No duplicate assignments (same employee, same date)
    const assignmentKeys = new Map<string, any>();
    for (const assignment of convertedAssignments) {
      const key = `${assignment.employeeId}-${assignment.date.toDateString()}`;
      if (assignmentKeys.has(key)) {
        const existing = assignmentKeys.get(key);
        violations.push({
          constraintId: 'no-duplicates',
          constraintName: 'No Duplicate Assignments',
          type: 'hard',
          severity: 'high',
          message: `직원 ${assignment.employeeId}가 ${assignment.date.toLocaleDateString()}에 중복 배정되었습니다`,
          affectedEmployees: [assignment.employeeId],
          affectedDates: [assignment.date],
          cost: 50,
        });
      }
      assignmentKeys.set(key, assignment);
    }

    // Check 4: Weekly rest days (basic check - at least 1 day off per week)
    const employeeWeeklyAssignments = new Map<string, Map<string, number>>();
    for (const assignment of convertedAssignments) {
      const weekKey = getWeekKey(assignment.date);
      if (!employeeWeeklyAssignments.has(assignment.employeeId)) {
        employeeWeeklyAssignments.set(assignment.employeeId, new Map());
      }
      const weekMap = employeeWeeklyAssignments.get(assignment.employeeId)!;
      weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1);
    }

    for (const [employeeId, weekMap] of employeeWeeklyAssignments.entries()) {
      for (const [weekKey, days] of weekMap.entries()) {
        if (days >= 7) {
          violations.push({
            constraintId: 'weekly-rest',
            constraintName: 'Weekly Rest Day',
            type: 'soft',
            severity: 'medium',
            message: `직원 ${employeeMap.get(employeeId)?.name || employeeId}가 ${weekKey} 주간에 휴무일이 없습니다`,
            affectedEmployees: [employeeId],
            affectedDates: [],
            cost: 30,
          });
        }
      }
    }

    // Categorize violations
    const hardViolations = violations.filter(v => v.type === 'hard');
    const softViolations = violations.filter(v => v.type === 'soft');

    // Calculate validation score
    const totalWeight = constraints.filter(c => c.active).reduce((sum, c) => sum + c.weight, 0) || 100;
    const violationWeight = violations.reduce((sum, v) => sum + v.cost, 0);
    const validationScore = Math.max(0, 100 - (violationWeight / totalWeight * 100));

    // Generate simple suggestions
    const suggestions = generateSimpleSuggestions(violations, employeeMap);

    // Log validation
    console.log(`[${new Date().toISOString()}] Schedule validated for tenant: ${tenantId}, user: ${user.id}, violations: ${violations.length}`);

    const response = {
      isValid: hardViolations.length === 0,
      score: Math.round(validationScore),
      violations: {
        hard: hardViolations,
        soft: softViolations,
        total: violations.length,
      },
      suggestions,
      metadata: {
        validatedAt: new Date().toISOString(),
        validatedBy: user.id,
        tenantId,
        departmentId: schedule.departmentId,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Schedule validation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to validate schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper function to get week key (ISO week)
function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

// Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Generate simple improvement suggestions
function generateSimpleSuggestions(violations: any[], employeeMap: Map<string, any>) {
  const suggestions = [];

  if (violations.some(v => v.constraintId === 'employee-exists' || v.constraintId === 'shift-exists')) {
    suggestions.push({
      type: 'adjustment',
      priority: 'high',
      description: '존재하지 않는 직원 또는 시프트가 배정되었습니다',
      impact: '스케줄을 사용할 수 없습니다',
      proposedChange: '유효한 직원과 시프트만 배정하세요',
    });
  }

  if (violations.some(v => v.constraintId === 'no-duplicates')) {
    suggestions.push({
      type: 'adjustment',
      priority: 'high',
      description: '중복 배정이 발견되었습니다',
      impact: '동일한 직원이 같은 날 여러 시프트에 배정되었습니다',
      proposedChange: '중복 배정을 제거하세요',
    });
  }

  if (violations.some(v => v.constraintId === 'weekly-rest')) {
    const affectedEmployees = violations
      .filter(v => v.constraintId === 'weekly-rest')
      .flatMap(v => v.affectedEmployees)
      .map(id => employeeMap.get(id)?.name || id);

    suggestions.push({
      type: 'pattern',
      priority: 'medium',
      description: `${affectedEmployees.length}명의 직원에게 주간 휴무일이 없습니다`,
      impact: '직원 피로도 증가 및 근로기준법 위반 가능성',
      affectedEmployees: [...new Set(affectedEmployees)],
      proposedChange: '주당 최소 1일의 휴무를 배정하세요',
    });
  }

  return suggestions;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id, x-user-id',
    },
  });
}
