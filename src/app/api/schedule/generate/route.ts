import { NextRequest, NextResponse } from 'next/server';
import { Scheduler, type SchedulingRequest, type SchedulingResult } from '@/lib/scheduler/core';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Request validation schema
const GenerateScheduleSchema = z.object({
  departmentId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  employees: z.array(z.any()),
  shifts: z.array(z.any()),
  constraints: z.array(z.any()),
  optimizationGoal: z.enum(['fairness', 'preference', 'coverage', 'cost', 'balanced']),
  pattern: z.any().optional(),
  lockedAssignments: z.array(z.any()).optional(),
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
        { error: '권한이 없습니다. 스케줄 생성은 관리자 또는 매니저만 가능합니다.' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = GenerateScheduleSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: (validationResult.error as any).errors
        },
        { status: 400 }
      );
    }

    const schedulingRequest: SchedulingRequest = {
      ...validationResult.data,
      startDate: new Date(validationResult.data.startDate),
      endDate: new Date(validationResult.data.endDate),
    };

    if (user.role === 'manager' && user.departmentId && user.departmentId !== schedulingRequest.departmentId) {
      return NextResponse.json(
        { error: '다른 부서의 스케줄은 생성할 수 없습니다.' },
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

    // Generate schedule using the scheduler
    const scheduler = new Scheduler();
    const result: SchedulingResult = await scheduler.createSchedule(schedulingRequest);

    // Log the generation for audit trail
    console.log(`[${new Date().toISOString()}] Schedule generated for tenant: ${tenantId}, user: ${user.id}, department: ${schedulingRequest.departmentId}`);

    // Add metadata to the result
    const response = {
      ...result,
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: user.id,
        tenantId,
        departmentId: schedulingRequest.departmentId,
        period: {
          start: schedulingRequest.startDate.toISOString(),
          end: schedulingRequest.endDate.toISOString(),
        },
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Schedule generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
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
