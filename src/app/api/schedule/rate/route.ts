import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { schedules, scheduleRatings } from '@/db/schema';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const RateScheduleSchema = z.object({
  scheduleId: z.string(),
  rating: z.number().int().min(1).max(5),
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

    const body = await request.json();
    const parsed = RateScheduleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const { scheduleId, rating } = parsed.data;

    const [schedule] = await db
      .select()
      .from(schedules)
      .where(and(
        eq(schedules.id, scheduleId),
        eq(schedules.tenantId, tenantId),
      ));

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    if (schedule.status !== 'published') {
      return NextResponse.json(
        { error: '확정된(발행된) 스케줄만 평가할 수 있습니다.' },
        { status: 400 }
      );
    }

    // Department-level access control
    if (user.role === 'member') {
      if (!user.departmentId || schedule.departmentId !== user.departmentId) {
        return NextResponse.json(
          { error: '본인 부서의 확정 스케줄만 평가할 수 있습니다.' },
          { status: 403 }
        );
      }
    } else if (user.role === 'manager' && user.departmentId && schedule.departmentId !== user.departmentId) {
      return NextResponse.json(
        { error: '다른 부서 스케줄은 평가할 수 없습니다.' },
        { status: 403 }
      );
    }

    // Upsert rating per user & schedule
    await db
      .insert(scheduleRatings)
      .values({
        tenantId,
        scheduleId: schedule.id,
        raterUserId: user.id,
        role: user.role,
        rating,
      })
      .onConflictDoUpdate({
        target: [scheduleRatings.tenantId, scheduleRatings.scheduleId, scheduleRatings.raterUserId],
        set: {
          rating,
          role: user.role,
          updatedAt: new Date(),
        },
      });

    // Recalculate aggregate metrics
    const [stats] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        avg: sql<number>`AVG(${scheduleRatings.rating})`,
      })
      .from(scheduleRatings)
      .where(and(
        eq(scheduleRatings.tenantId, tenantId),
        eq(scheduleRatings.scheduleId, schedule.id),
      ));

    const ratingCount = Number(stats?.count ?? 0);
    const averageRating = ratingCount > 0 && stats?.avg != null
      ? Math.round(Number(stats.avg) * 10)
      : null;

    const [updatedSchedule] = await db
      .update(schedules)
      .set({
        averageRating,
        ratingCount,
      })
      .where(and(
        eq(schedules.id, schedule.id),
        eq(schedules.tenantId, tenantId),
      ))
      .returning();

    return NextResponse.json(
      {
        success: true,
        scheduleId: updatedSchedule.id,
        averageRating: updatedSchedule.averageRating,
        ratingCount: updatedSchedule.ratingCount,
        myRating: rating,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Rate schedule error:', error);
    return NextResponse.json(
      {
        error: 'Failed to rate schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

