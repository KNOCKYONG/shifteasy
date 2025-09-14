import { NextRequest, NextResponse } from 'next/server';
import { Scheduler, type SchedulingRequest, type SchedulingResult } from '@/lib/scheduler/core';
import { z } from 'zod';

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
    // Get tenant ID from headers (mock for now)
    const tenantId = request.headers.get('x-tenant-id') || 'test-tenant';
    const userId = request.headers.get('x-user-id') || 'test-user';

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

    // Generate schedule using the scheduler
    const scheduler = new Scheduler();
    const result: SchedulingResult = await scheduler.createSchedule(schedulingRequest);

    // Log the generation for audit trail
    console.log(`[${new Date().toISOString()}] Schedule generated for tenant: ${tenantId}, user: ${userId}, department: ${schedulingRequest.departmentId}`);

    // Add metadata to the result
    const response = {
      ...result,
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: userId,
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