import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { schedules } from '@/db/schema';

export const dynamic = 'force-dynamic';

// Request validation schema
const SaveDraftSchema = z.object({
  scheduleId: z.string().optional(),
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
  }),
  name: z.string().optional(),
  metadata: z.any().optional(),
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
      console.error(`[SaveDraft] Permission denied for user ${user.id}, role: ${userRole}`);
      return NextResponse.json(
        { error: 'Unauthorized. Only admins or managers can save draft schedules.' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = SaveDraftSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: (validationResult.error as any).errors
        },
        { status: 400 }
      );
    }

    const { scheduleId, schedule, name, metadata } = validationResult.data;

    // Manager department permission check
    const requestDepartmentId = schedule.departmentId;

    console.log(`[SaveDraft] User ${user.id} (${userRole}) attempting to save draft for department ${requestDepartmentId}`);

    if (userRole === 'manager') {
      if (!user.departmentId) {
        console.error(`[SaveDraft] Manager ${user.id} has no departmentId`);
        return NextResponse.json(
          { error: '부서 정보가 없습니다. 관리자에게 문의하세요.' },
          { status: 403 }
        );
      }
      if (user.departmentId !== requestDepartmentId) {
        console.error(`[SaveDraft] Manager ${user.id} department ${user.departmentId} tried to save draft for department ${requestDepartmentId}`);
        return NextResponse.json(
          { error: '담당 부서의 스케줄만 저장할 수 있습니다.' },
          { status: 403 }
        );
      }
    }

    // Create new draft schedule in DB
    const [savedSchedule] = await db
      .insert(schedules)
      .values({
        tenantId,
        departmentId: requestDepartmentId,
        startDate: new Date(schedule.startDate),
        endDate: new Date(schedule.endDate),
        status: 'draft',
        metadata: {
          name: name || `Draft - ${new Date().toLocaleDateString('ko-KR')}`,
          savedAt: new Date().toISOString(),
          savedBy: user.id,
          assignments: schedule.assignments,
          ...metadata,
        },
      })
      .returning();

    if (!savedSchedule) {
      console.error(`[SaveDraft] Failed to create draft schedule`);
      return NextResponse.json(
        { error: '임시 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log(`[SaveDraft] Successfully saved draft schedule ${savedSchedule.id} for department ${requestDepartmentId}`);

    const response = {
      success: true,
      schedule: {
        ...savedSchedule,
        assignments: schedule.assignments,
      },
      metadata: {
        savedAt: new Date().toISOString(),
        savedBy: user.id,
        tenantId,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Save draft schedule error:', error);
    return NextResponse.json(
      {
        error: 'Failed to save draft schedule',
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
      'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id, x-user-id, x-user-role',
    },
  });
}
