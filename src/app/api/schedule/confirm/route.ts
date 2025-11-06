import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { schedules } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { notificationService } from '@/lib/notifications/notification-service';

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

    // ✅ Manager department permission check using request body departmentId
    const requestDepartmentId = schedule.departmentId;

    console.log(`[Confirm] User ${user.id} (${userRole}) attempting to confirm schedule for department ${requestDepartmentId}`);

    if (userRole === 'manager') {
      if (!user.departmentId) {
        console.error(`[Confirm] Manager ${user.id} has no departmentId`);
        return NextResponse.json(
          { error: '부서 정보가 없습니다. 관리자에게 문의하세요.' },
          { status: 403 }
        );
      }
      if (user.departmentId !== requestDepartmentId) {
        console.error(`[Confirm] Manager ${user.id} department ${user.departmentId} tried to confirm schedule for department ${requestDepartmentId}`);
        return NextResponse.json(
          { error: '담당 부서의 스케줄만 확정할 수 있습니다.' },
          { status: 403 }
        );
      }
    }

    // ✅ Create new schedule in DB with auto-generated UUID
    const [createdSchedule] = await db
      .insert(schedules)
      .values({
        tenantId,
        departmentId: requestDepartmentId,
        startDate: new Date(schedule.startDate),
        endDate: new Date(schedule.endDate),
        status: 'published',
        publishedAt: new Date(),
        publishedBy: user.id,
        metadata: {
          confirmedAt: new Date().toISOString(),
          confirmedBy: user.id,
          approverNotes,
          validationScore,
          assignments: schedule.assignments, // Store assignments in metadata
        },
      })
      .returning();

    if (!createdSchedule) {
      console.error(`[Confirm] Failed to create schedule`);
      return NextResponse.json(
        { error: '스케줄 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log(`[Confirm] Successfully created and published schedule ${createdSchedule.id} for department ${requestDepartmentId}`);

    // Prepare response data
    const confirmedSchedule = {
      ...createdSchedule,
      assignments: schedule.assignments,  // Include assignments from request
    };

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
  const uniqueEmployees = new Set(assignments.map(a => a.employeeId));

  console.log(`Sending notifications to ${uniqueEmployees.size} employees for schedule ${schedule.id}`);

  // Format dates for Korean users
  const startDate = new Date(schedule.startDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const endDate = new Date(schedule.endDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Send notification to each employee using notificationService directly
  const notificationPromises = Array.from(uniqueEmployees).map(async (employeeId) => {
    const notifStartTime = Date.now();
    console.log(`[Schedule Confirm] Sending notification to employee ${employeeId}`, {
      scheduleId: schedule.id,
      type: 'schedule_published',
    });

    try {
      const result = await notificationService.sendToUser(
        schedule.tenantId,
        employeeId,
        {
          type: 'schedule_published',
          priority: 'high',
          title: '새로운 스케줄이 확정되었습니다',
          message: `${startDate} ~ ${endDate} 스케줄이 확정되어 공개되었습니다. 확인해주세요.`,
          actionUrl: '/schedule',
          data: {
            scheduleId: schedule.id,
            departmentId: schedule.departmentId,
            startDate: schedule.startDate,
            endDate: schedule.endDate,
            publishedBy: schedule.publishedBy,
          },
        }
      );

      const duration = Date.now() - notifStartTime;

      if (!result) {
        console.error(`[Schedule Confirm] Failed to send notification`, {
          employeeId,
          scheduleId: schedule.id,
          duration: `${duration}ms`,
        });
        return { employeeId, success: false };
      }

      console.log(`[Schedule Confirm] Notification sent successfully`, {
        employeeId,
        scheduleId: schedule.id,
        notificationId: result.id,
        duration: `${duration}ms`,
      });

      return { employeeId, success: true };
    } catch (error) {
      const duration = Date.now() - notifStartTime;
      console.error(`[Schedule Confirm] Error sending notification`, {
        employeeId,
        scheduleId: schedule.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
      });
      return { employeeId, success: false };
    }
  });

  const results = await Promise.all(notificationPromises);
  const successCount = results.filter(r => r.success).length;

  console.log(`Successfully sent ${successCount}/${uniqueEmployees.size} notifications for schedule ${schedule.id}`);

  return results;
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
