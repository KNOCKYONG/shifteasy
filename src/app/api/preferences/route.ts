import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { nursePreferences } from '@/db/schema/nurse-preferences';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ensureNotificationPreferencesColumn } from '@/lib/db/ensureNotificationPreferencesColumn';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

// Default tenant ID (나중에 인증 시스템에서 가져와야 함)
const DEFAULT_TENANT_ID = '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

// 선호도 검증 스키마 (간소화된 버전)
const PreferencesSchema = z.object({
  employeeId: z.string(),
  preferences: z.object({
    workPatternType: z.enum(['three-shift', 'night-intensive', 'weekday-only']).optional(),
    preferredPatterns: z.array(z.object({
      pattern: z.string(),
      preference: z.number().min(0).max(10),
    })).optional(),
    avoidPatterns: z.array(z.array(z.string())).optional(),
  }),
});

type SimplifiedPreference = {
  workPatternType: 'three-shift' | 'night-intensive' | 'weekday-only' | null;
  preferredPatterns: Array<{ pattern: string; preference: number }>;
  avoidPatterns: string[][];
};

const isWorkPatternType = (value: unknown): value is SimplifiedPreference['workPatternType'] => {
  return value === 'three-shift' || value === 'night-intensive' || value === 'weekday-only' || value === null;
};

// GET: 직원의 선호도 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const tenantId = DEFAULT_TENANT_ID; // TODO: Get from auth

    if (!employeeId) {
      // 모든 직원의 선호도 반환
      const allNursePrefs = await db.select()
        .from(nursePreferences)
        .where(eq(nursePreferences.tenantId, tenantId));

      const allPreferences: Record<string, SimplifiedPreference> = {};

      allNursePrefs.forEach(pref => {
        // Convert nurse_preferences to simplified format
        allPreferences[pref.nurseId] = {
          workPatternType: isWorkPatternType(pref.workPatternType) ? pref.workPatternType : null,
          preferredPatterns: pref.preferredPatterns || [],
          avoidPatterns: pref.avoidPatterns || [],
        };
      });

      return NextResponse.json({
        success: true,
        data: allPreferences,
        count: Object.keys(allPreferences).length,
      });
    }

    // 특정 직원의 선호도 반환
    const result = await db.select()
      .from(nursePreferences)
      .where(eq(nursePreferences.nurseId, employeeId))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Preferences not found for this employee',
        },
        { status: 404 }
      );
    }

    const pref = result[0];

    // Convert nurse_preferences to simplified format
    const simplifiedPrefs: SimplifiedPreference = {
      workPatternType: isWorkPatternType(pref.workPatternType) ? pref.workPatternType : null,
      preferredPatterns: pref.preferredPatterns || [],
      avoidPatterns: pref.avoidPatterns || [],
    };

    return NextResponse.json({
      success: true,
      data: simplifiedPrefs,
      employeeId,
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch preferences',
      },
      { status: 500 }
    );
  }
}

// POST: 선호도 저장/업데이트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = DEFAULT_TENANT_ID; // TODO: Get from auth

    // 요청 검증
    const validationResult = PreferencesSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid preferences data',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { employeeId, preferences } = validationResult.data;

    // 1. Get user's department_id
    await ensureNotificationPreferencesColumn();

    const user = await db.select()
      .from(users)
      .where(eq(users.id, employeeId))
      .limit(1);

    const departmentId = user.length > 0 ? user[0].departmentId : null;

    if (user.length === 0) {
      console.warn(`User not found for employeeId: ${employeeId}, will save without departmentId`);
    }

    // 2. Sync to nurse_preferences table (used by scheduler)
    const existingNursePrefs = await db.select()
      .from(nursePreferences)
      .where(eq(nursePreferences.nurseId, employeeId))
      .limit(1);

    // Map simplified preferences to nurse_preferences format
    const nursePrefsData = {
      tenantId,
      nurseId: employeeId,
      departmentId,
      workPatternType: preferences.workPatternType || 'three-shift',
      preferredPatterns: preferences.preferredPatterns || [],
      avoidPatterns: preferences.avoidPatterns || [],
      updatedAt: new Date(),
    };

    if (existingNursePrefs.length > 0) {
      // Update existing nurse_preferences
      await db.update(nursePreferences)
        .set(nursePrefsData)
        .where(eq(nursePreferences.nurseId, employeeId));

      console.log(`✅ Updated nurse_preferences for employee: ${employeeId}`);
    } else {
      // Insert new nurse_preferences
      await db.insert(nursePreferences)
        .values(nursePrefsData);

      console.log(`✅ Created nurse_preferences for employee: ${employeeId}`);
    }

    // 스케줄러에 변경 알림 (WebSocket 또는 SSE 사용 가능)
    notifySchedulerUpdate(employeeId);

    // 감사 로그
    console.log(`[${new Date().toISOString()}] Preferences updated for employee: ${employeeId}`);

    return NextResponse.json({
      success: true,
      message: 'Preferences saved successfully',
      employeeId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error saving preferences:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save preferences',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE: 선호도 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    if (!employeeId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Employee ID is required',
        },
        { status: 400 }
      );
    }

    // 삭제 전 존재 여부 확인
    const existing = await db.select()
      .from(nursePreferences)
      .where(eq(nursePreferences.nurseId, employeeId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No preferences found for this employee',
        },
        { status: 404 }
      );
    }

    await db.delete(nursePreferences)
      .where(eq(nursePreferences.nurseId, employeeId));

    return NextResponse.json({
      success: true,
      message: 'Preferences deleted successfully',
      employeeId,
    });
  } catch (error) {
    console.error('Error deleting preferences:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete preferences',
      },
      { status: 500 }
    );
  }
}

// 스케줄러 업데이트 알림 (실제로는 메시지 큐 또는 이벤트 사용)
function notifySchedulerUpdate(employeeId: string) {
  // 예: Redis Pub/Sub, RabbitMQ, 또는 WebSocket
  console.log(`Notifying scheduler about preference update for employee: ${employeeId}`);

  // 실제 구현 예시:
  // await redis.publish('scheduler:preferences:updated', JSON.stringify({ employeeId }));
}

// PATCH: 부분 업데이트 (nurse_preferences 기반)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, updates } = body;

    if (!employeeId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Employee ID is required',
        },
        { status: 400 }
      );
    }

    // 기존 레코드 조회
    const existing = await db.select()
      .from(nursePreferences)
      .where(eq(nursePreferences.nurseId, employeeId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No existing preferences found',
        },
        { status: 404 }
      );
    }

    // 부분 업데이트
    await db.update(nursePreferences)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(nursePreferences.nurseId, employeeId));

    return NextResponse.json({
      success: true,
      message: 'Preferences partially updated',
      employeeId,
      updatedFields: Object.keys(updates),
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update preferences',
      },
      { status: 500 }
    );
  }
}
