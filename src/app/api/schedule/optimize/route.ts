import { NextRequest, NextResponse } from 'next/server';
import { ScheduleOptimizer } from '@/lib/scheduler/core';
import { FairnessScorer } from '@/lib/scheduler/scoring';
import { z } from 'zod';

// Request validation schema
const OptimizeScheduleSchema = z.object({
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
    })),
  }),
  employees: z.array(z.any()),
  shifts: z.array(z.any()),
  constraints: z.array(z.any()),
  optimizationGoal: z.enum(['fairness', 'preference', 'coverage', 'cost', 'balanced']),
  options: z.object({
    maxIterations: z.number().optional(),
    targetScore: z.number().optional(),
    preserveLockedAssignments: z.boolean().optional(),
    focusAreas: z.array(z.string()).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Get tenant ID from headers
    const tenantId = request.headers.get('x-tenant-id') || 'test-tenant';
    const userId = request.headers.get('x-user-id') || 'test-user';

    // Parse and validate request body
    const body = await request.json();
    const validationResult = OptimizeScheduleSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { schedule, employees, shifts, constraints, optimizationGoal, options } = validationResult.data;

    // Convert data to required formats
    const employeeMap = new Map(employees.map((e: any) => [e.id, e]));
    const shiftMap = new Map(shifts.map((s: any) => [s.id, s]));

    // Convert assignments with date conversion
    const currentAssignments = schedule.assignments.map(assignment => ({
      ...assignment,
      date: new Date(assignment.date),
    }));

    // Filter locked assignments if needed
    const lockedAssignments = options?.preserveLockedAssignments
      ? currentAssignments.filter(a => a.isLocked)
      : [];

    // Create optimization request
    const optimizationRequest = {
      departmentId: schedule.departmentId,
      startDate: new Date(schedule.startDate),
      endDate: new Date(schedule.endDate),
      employees,
      shifts,
      constraints,
      optimizationGoal,
      existingSchedule: {
        ...schedule,
        assignments: currentAssignments,
        status: 'draft' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      lockedAssignments,
    };

    // Create optimizer and run optimization
    const optimizer = new ScheduleOptimizer();
    const startTime = Date.now();

    // Run optimization with custom settings
    const maxIterations = options?.maxIterations || 500;
    const targetScore = options?.targetScore || 85;

    let bestAssignments = currentAssignments;
    let bestScore = 0;
    let iterations = 0;

    // Optimization loop
    for (iterations = 0; iterations < maxIterations; iterations++) {
      const optimizedResult = await optimizer.optimize(optimizationRequest);

      if (optimizedResult.success && optimizedResult.schedule) {
        const currentScore = optimizedResult.score.total;

        if (currentScore > bestScore) {
          bestScore = currentScore;
          bestAssignments = optimizedResult.schedule.assignments;
        }

        // Check if target score is reached
        if (currentScore >= targetScore) {
          break;
        }
      }

      // Add some randomization for next iteration
      optimizationRequest.existingSchedule.assignments = bestAssignments;
    }

    const processingTime = Date.now() - startTime;

    // Calculate final scores
    const scorer = new FairnessScorer();
    const finalScore = scorer.calculateScheduleScore(
      bestAssignments,
      employeeMap,
      shiftMap,
      []
    );

    // Generate improvement metrics
    const improvementMetrics = calculateImprovement(currentAssignments, bestAssignments, employeeMap, shiftMap);

    // Log optimization
    console.log(`[${new Date().toISOString()}] Schedule optimized for tenant: ${tenantId}, user: ${userId}, score: ${bestScore}, iterations: ${iterations}`);

    const response = {
      success: true,
      optimizedSchedule: {
        ...schedule,
        assignments: bestAssignments.map(a => ({
          ...a,
          date: a.date.toISOString(),
        })),
      },
      score: finalScore,
      improvement: improvementMetrics,
      metrics: {
        iterations,
        processingTime,
        targetScore,
        achievedScore: bestScore,
      },
      metadata: {
        optimizedAt: new Date().toISOString(),
        optimizedBy: userId,
        tenantId,
        departmentId: schedule.departmentId,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Schedule optimization error:', error);
    return NextResponse.json(
      {
        error: 'Failed to optimize schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Calculate improvement metrics
function calculateImprovement(
  originalAssignments: any[],
  optimizedAssignments: any[],
  employeeMap: Map<string, any>,
  shiftMap: Map<string, any>
) {
  const scorer = new FairnessScorer();

  // Calculate scores for both schedules
  const originalScore = scorer.calculateScheduleScore(originalAssignments, employeeMap, shiftMap, []);
  const optimizedScore = scorer.calculateScheduleScore(optimizedAssignments, employeeMap, shiftMap, []);

  // Calculate changes
  let changedAssignments = 0;
  for (let i = 0; i < originalAssignments.length; i++) {
    const original = originalAssignments[i];
    const optimized = optimizedAssignments.find(
      a => a.employeeId === original.employeeId &&
          a.date.getTime() === original.date.getTime()
    );

    if (!optimized || original.shiftId !== optimized.shiftId) {
      changedAssignments++;
    }
  }

  return {
    scoreImprovement: {
      total: optimizedScore.total - originalScore.total,
      fairness: optimizedScore.fairness - originalScore.fairness,
      preference: optimizedScore.preference - originalScore.preference,
      coverage: optimizedScore.coverage - originalScore.coverage,
    },
    changedAssignments,
    changePercentage: (changedAssignments / originalAssignments.length) * 100,
  };
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