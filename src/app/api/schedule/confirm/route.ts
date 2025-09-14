import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Request validation schema
const ConfirmScheduleSchema = z.object({
  scheduleId: z.string(),
  schedule: z.object({
    departmentId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    assignments: z.array(z.object({
      employeeId: z.string(),
      shiftId: z.string(),
      date: z.string(),
      isLocked: z.boolean(),
    })),
    status: z.enum(['draft', 'published', 'archived']).optional(),
  }),
  validationScore: z.number().optional(),
  approverNotes: z.string().optional(),
  notifyEmployees: z.boolean().optional(),
});

// Mock database storage (in production, this would be Supabase)
const confirmedSchedules = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    // Get tenant ID and user info from headers
    const tenantId = request.headers.get('x-tenant-id') || 'test-tenant';
    const userId = request.headers.get('x-user-id') || 'test-user';
    const userRole = request.headers.get('x-user-role') || 'admin';

    // Check authorization
    if (userRole !== 'admin' && userRole !== 'manager') {
      return NextResponse.json(
        { error: 'Unauthorized. Only admins and managers can confirm schedules.' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = ConfirmScheduleSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: (validationResult.error as any).errors
        },
        { status: 400 }
      );
    }

    const { scheduleId, schedule, validationScore, approverNotes, notifyEmployees } = validationResult.data;

    // Check if schedule exists and is not already confirmed
    const existingSchedule = confirmedSchedules.get(scheduleId);
    if (existingSchedule && existingSchedule.status === 'published') {
      return NextResponse.json(
        { error: 'Schedule is already confirmed and published.' },
        { status: 400 }
      );
    }

    // Prepare confirmed schedule data
    const confirmedSchedule = {
      id: scheduleId,
      ...schedule,
      status: 'published',
      publishedAt: new Date().toISOString(),
      approvedBy: userId,
      approverNotes,
      validationScore,
      metadata: {
        tenantId,
        confirmedAt: new Date().toISOString(),
        confirmedBy: userId,
      },
    };

    // Store confirmed schedule (in production, this would be saved to Supabase)
    confirmedSchedules.set(scheduleId, confirmedSchedule);

    // Send notifications if requested
    if (notifyEmployees) {
      await sendScheduleNotifications(confirmedSchedule, schedule.assignments);
    }

    // Generate confirmation report
    const confirmationReport = generateConfirmationReport(confirmedSchedule, schedule.assignments);

    // Log confirmation
    console.log(`[${new Date().toISOString()}] Schedule confirmed: ${scheduleId}, tenant: ${tenantId}, user: ${userId}`);

    const response = {
      success: true,
      confirmedSchedule,
      confirmationReport,
      notifications: {
        sent: notifyEmployees || false,
        employeeCount: new Set(schedule.assignments.map((a: any) => a.employeeId)).size,
      },
      metadata: {
        confirmedAt: new Date().toISOString(),
        confirmedBy: userId,
        tenantId,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Schedule confirmation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to confirm schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Get confirmed schedule
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const schedule = confirmedSchedules.get(scheduleId);

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(schedule, { status: 200 });
  } catch (error) {
    console.error('Get schedule error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Revoke confirmed schedule (set back to draft)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');
    const userRole = request.headers.get('x-user-role') || 'admin';

    // Check authorization
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Only admins can revoke confirmed schedules.' },
        { status: 403 }
      );
    }

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const schedule = confirmedSchedules.get(scheduleId);

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Update schedule status
    schedule.status = 'draft';
    schedule.revokedAt = new Date().toISOString();
    schedule.revokedBy = request.headers.get('x-user-id') || 'test-user';

    confirmedSchedules.set(scheduleId, schedule);

    return NextResponse.json(
      {
        success: true,
        message: 'Schedule confirmation revoked successfully',
        schedule,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Revoke schedule error:', error);
    return NextResponse.json(
      {
        error: 'Failed to revoke schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper function to send notifications
async function sendScheduleNotifications(schedule: any, assignments: any[]) {
  // In production, this would integrate with a notification service
  const uniqueEmployees = new Set(assignments.map(a => a.employeeId));

  console.log(`Sending notifications to ${uniqueEmployees.size} employees for schedule ${schedule.id}`);

  // Simulate notification sending
  const notifications = Array.from(uniqueEmployees).map(employeeId => ({
    employeeId,
    type: 'schedule_published',
    scheduleId: schedule.id,
    period: `${schedule.startDate} - ${schedule.endDate}`,
    sentAt: new Date().toISOString(),
  }));

  return notifications;
}

// Helper function to generate confirmation report
function generateConfirmationReport(schedule: any, assignments: any[]) {
  const employeeStats = new Map<string, number>();
  const shiftStats = new Map<string, number>();

  // Calculate statistics
  assignments.forEach(assignment => {
    // Count assignments per employee
    const currentCount = employeeStats.get(assignment.employeeId) || 0;
    employeeStats.set(assignment.employeeId, currentCount + 1);

    // Count assignments per shift type
    const shiftCount = shiftStats.get(assignment.shiftId) || 0;
    shiftStats.set(assignment.shiftId, shiftCount + 1);
  });

  // Calculate coverage
  const totalDays = 7; // Assuming weekly schedule
  const totalShifts = shiftStats.size;
  const totalAssignments = assignments.length;
  const averageAssignmentsPerEmployee = totalAssignments / employeeStats.size;

  return {
    summary: {
      scheduleId: schedule.id,
      period: `${schedule.startDate} - ${schedule.endDate}`,
      status: schedule.status,
      totalEmployees: employeeStats.size,
      totalAssignments,
      averageAssignmentsPerEmployee: averageAssignmentsPerEmployee.toFixed(1),
    },
    employeeDistribution: Array.from(employeeStats.entries()).map(([employeeId, count]) => ({
      employeeId,
      assignmentCount: count,
    })),
    shiftCoverage: Array.from(shiftStats.entries()).map(([shiftId, count]) => ({
      shiftId,
      totalAssignments: count,
      averagePerDay: (count / totalDays).toFixed(1),
    })),
    validation: {
      score: schedule.validationScore || 'N/A',
      approvedBy: schedule.approvedBy,
      approverNotes: schedule.approverNotes,
    },
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id, x-user-id, x-user-role',
    },
  });
}