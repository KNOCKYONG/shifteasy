import { NextRequest, NextResponse } from 'next/server';
import { ConstraintValidator } from '@/lib/scheduler/constraints';
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

    // Create validator with constraints
    const validator = new ConstraintValidator(constraints);

    // Convert data to required formats
    const employeeMap = new Map(employees.map((e: any) => [e.id, e]));
    const shiftMap = new Map(shifts.map((s: any) => [s.id, s]));

    // Convert assignments with date conversion
    const convertedAssignments = schedule.assignments.map(assignment => ({
      ...assignment,
      date: new Date(assignment.date),
    }));

    // Validate the schedule
    const violations = validator.validateSchedule(
      convertedAssignments,
      employeeMap,
      shiftMap,
      new Date(schedule.startDate),
      new Date(schedule.endDate)
    );

    // Categorize violations
    const hardViolations = violations.filter(v => v.type === 'hard');
    const softViolations = violations.filter(v => v.type === 'soft');

    // Calculate validation score
    const totalWeight = constraints.reduce((sum, c) => sum + (c.active ? c.weight : 0), 0);
    const violationWeight = violations.reduce((sum, v) => sum + v.cost, 0);
    const validationScore = Math.max(0, 100 - (violationWeight / totalWeight * 100));

    // Generate suggestions for violations
    const suggestions = generateSuggestions(violations, employeeMap, shiftMap);

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

// Generate improvement suggestions based on violations
function generateSuggestions(violations: any[], employeeMap: Map<string, any>, shiftMap: Map<string, any>) {
  const suggestions = [];

  // Group violations by type
  const violationsByType = violations.reduce((acc, v) => {
    if (!acc[v.constraintName]) acc[v.constraintName] = [];
    acc[v.constraintName].push(v);
    return acc;
  }, {} as Record<string, any[]>);

  // Generate suggestions for each violation type
  for (const [constraintName, constraintViolations] of Object.entries(violationsByType)) {
    const violations = constraintViolations as any[];
    if (constraintName.includes('consecutive')) {
      suggestions.push({
        type: 'swap',
        priority: 'high',
        description: `${violations.length} employees exceed consecutive work limit`,
        impact: 'Legal compliance risk',
        affectedEmployees: violations.flatMap((v: any) => v.affectedEmployees),
        proposedChange: 'Add rest days or redistribute shifts',
      });
    } else if (constraintName.includes('hours')) {
      suggestions.push({
        type: 'adjustment',
        priority: 'high',
        description: `${violations.length} employees exceed working hours limit`,
        impact: 'Labor law violation risk',
        affectedEmployees: violations.flatMap((v: any) => v.affectedEmployees),
        proposedChange: 'Adjust hours or add staff',
      });
    } else if (constraintName.includes('preference')) {
      suggestions.push({
        type: 'pattern',
        priority: 'medium',
        description: `${violations.length} preference violations`,
        impact: 'Employee satisfaction impact',
        affectedEmployees: violations.flatMap((v: any) => v.affectedEmployees),
        proposedChange: 'Reassign preferred shifts where possible',
      });
    }
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
