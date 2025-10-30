import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: '테넌트 정보가 존재하지 않습니다.' },
        { status: 400 }
      );
    }

    const userRole = user.role;

    // Check user role permissions
    if (!userRole || !['admin', 'manager', 'owner'].includes(userRole)) {
      console.error(`[Confirm] Permission denied for user ${user.id}, role: ${userRole}`);
      return NextResponse.json(
        { error: 'Unauthorized. Only admins or managers can confirm schedules.' },
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

    // Manager can only confirm schedules for their department
    if (userRole === 'manager') {
      if (!user.departmentId) {
        console.error(`[Confirm] Manager ${user.id} has no departmentId`);
        return NextResponse.json(
          { error: '부서 정보가 없습니다. 관리자에게 문의하세요.' },
          { status: 403 }
        );
      }
      if (user.departmentId !== schedule.departmentId) {
        console.error(`[Confirm] Manager ${user.id} department ${user.departmentId} tried to confirm schedule for department ${schedule.departmentId}`);
        return NextResponse.json(
          { error: '담당 부서의 스케줄만 확정할 수 있습니다.' },
          { status: 403 }
        );
      }
    }

    console.log(`[Confirm] User ${user.id} (${userRole}) confirming schedule ${scheduleId} for department ${schedule.departmentId}`);

    // Check if schedule exists and is not already confirmed
    const scheduleKey = `${tenantId}:${scheduleId}`;
    const existingSchedule = confirmedSchedules.get(scheduleKey);
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
      approvedBy: user.id,
      approverNotes,
      validationScore,
      metadata: {
        tenantId,
        confirmedAt: new Date().toISOString(),
        confirmedBy: user.id,
      },
    };

    // Store confirmed schedule (in production, this would be saved to Supabase)
    confirmedSchedules.set(scheduleKey, confirmedSchedule);

    // Send notifications if requested
    if (notifyEmployees) {
      await sendScheduleNotifications(confirmedSchedule, schedule.assignments);
    }

    // Generate confirmation report
    const confirmationReport = generateConfirmationReport(confirmedSchedule, schedule.assignments);

    // Log confirmation
    console.log(`[${new Date().toISOString()}] Schedule confirmed: ${scheduleId}, tenant: ${tenantId}, user: ${user.id}`);

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
        confirmedBy: user.id,
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
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: '테넌트 정보가 존재하지 않습니다.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const scheduleKey = `${tenantId}:${scheduleId}`;
    const schedule = confirmedSchedules.get(scheduleKey);

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    if (user.role === 'member') {
      if (!user.departmentId || schedule.departmentId !== user.departmentId) {
        return NextResponse.json(
          { error: '본인 부서의 스케줄만 조회할 수 있습니다.' },
          { status: 403 }
        );
      }
    } else if (user.role === 'manager' && user.departmentId && schedule.departmentId !== user.departmentId) {
      return NextResponse.json(
        { error: '다른 부서의 스케줄은 조회할 수 없습니다.' },
        { status: 403 }
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
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: '테넌트 정보가 존재하지 않습니다.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');

    // Check authorization
    if (!['admin', 'owner'].includes(user.role)) {
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

    const scheduleKey = `${tenantId}:${scheduleId}`;
    const schedule = confirmedSchedules.get(scheduleKey);

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Update schedule status
    schedule.status = 'draft';
    schedule.revokedAt = new Date().toISOString();
    schedule.revokedBy = user.id;

    confirmedSchedules.set(scheduleKey, schedule);

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
