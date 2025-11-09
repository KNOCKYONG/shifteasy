import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ComprehensivePreferences } from '@/components/department/MyPreferencesPanel';
import { db } from '@/db';
import { configs } from '@/db/schema/configs';
import { nursePreferences } from '@/db/schema/nurse-preferences';
import { users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Default tenant ID (나중에 인증 시스템에서 가져와야 함)
const DEFAULT_TENANT_ID = '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

// 선호도 검증 스키마 (실제 사용 필드만)
const PreferencesSchema = z.object({
  employeeId: z.string(),
  preferences: z.object({
    workPreferences: z.object({
      workPatternType: z.enum(['three-shift', 'night-intensive', 'weekday-only']),
      preferredShifts: z.array(z.enum(['day', 'evening', 'night'])),
      avoidShifts: z.array(z.enum(['day', 'evening', 'night'])).optional(),
      preferredPatterns: z.array(z.string()).optional(), // 선호 근무 패턴 배열
      avoidPatterns: z.array(z.array(z.string())).optional(), // 기피 근무 패턴 배열 (각 패턴은 string 배열)
      maxConsecutiveDays: z.number().min(1).max(7),
      minRestDays: z.number().min(1).max(4),
      preferredWorkload: z.enum(['light', 'moderate', 'heavy', 'flexible']),
      weekendPreference: z.enum(['prefer', 'avoid', 'neutral']),
      holidayPreference: z.enum(['prefer', 'avoid', 'neutral']),
      overtimeWillingness: z.enum(['never', 'emergency', 'sometimes', 'always']),
      offDayPattern: z.enum(['short', 'long', 'flexible']),
    }),
    personalCircumstances: z.object({
      hasYoungChildren: z.boolean(),
      isSingleParent: z.boolean(),
      hasCaregivingResponsibilities: z.boolean(),
      isStudying: z.boolean(),
    }),
    healthConsiderations: z.object({
      hasChronicCondition: z.boolean(),
      needsFrequentBreaks: z.boolean(),
      mobilityRestrictions: z.boolean(),
      visualImpairment: z.boolean(),
      hearingImpairment: z.boolean(),
      mentalHealthSupport: z.boolean(),
    }),
    commutePreferences: z.object({
      commuteTime: z.number(),
      transportMode: z.enum(['car', 'public', 'walk', 'bike', 'mixed']),
      parkingRequired: z.boolean(),
      nightTransportDifficulty: z.boolean(),
      weatherSensitive: z.boolean(),
      needsTransportAssistance: z.boolean(),
      carpoolInterested: z.boolean(),
    }),
    teamPreferences: z.object({
      preferredPartners: z.array(z.string()),
      avoidPartners: z.array(z.string()),
      mentorshipRole: z.enum(['mentor', 'mentee', 'both', 'none']),
      languagePreferences: z.array(z.string()),
      communicationStyle: z.enum(['direct', 'gentle', 'detailed', 'brief']),
      conflictResolution: z.enum(['immediate', 'planned', 'mediator', 'avoid']),
    }),
    professionalDevelopment: z.object({
      specializations: z.array(z.string()),
      certifications: z.array(z.string()),
      trainingInterests: z.array(z.string()),
      careerGoals: z.string(),
      preferredDepartments: z.array(z.string()),
      avoidDepartments: z.array(z.string()),
      teachingInterest: z.boolean(),
      researchInterest: z.boolean(),
      administrativeInterest: z.boolean(),
    }),
    specialRequests: z.object({
      religiousObservances: z.object({
        needed: z.boolean(),
      }),
      culturalConsiderations: z.string(),
      emergencyContact: z.object({
        name: z.string(),
        relationship: z.string(),
        phone: z.string(),
      }),
      temporaryRequests: z.array(z.any()),
    }),
    priorities: z.object({
      workLifeBalance: z.number().min(1).max(10),
      careerGrowth: z.number().min(1).max(10),
      teamHarmony: z.number().min(1).max(10),
      incomeMaximization: z.number().min(1).max(10),
      healthWellbeing: z.number().min(1).max(10),
      familyTime: z.number().min(1).max(10),
    }),
  }),
});

// GET: 직원의 선호도 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const tenantId = DEFAULT_TENANT_ID; // TODO: Get from auth

    if (!employeeId) {
      // 모든 직원의 선호도 반환
      const allConfigs = await db.select()
        .from(configs)
        .where(eq(configs.tenantId, tenantId));

      const allPreferences: Record<string, ComprehensivePreferences> = {};

      // 'preferences_' prefix로 시작하는 config만 필터링
      allConfigs.forEach(config => {
        if (config.configKey.startsWith('preferences_')) {
          const empId = config.configKey.replace('preferences_', '');
          allPreferences[empId] = config.configValue as ComprehensivePreferences;
        }
      });

      return NextResponse.json({
        success: true,
        data: allPreferences,
        count: Object.keys(allPreferences).length,
      });
    }

    // 특정 직원의 선호도 반환
    const configKey = `preferences_${employeeId}`;
    const result = await db.select()
      .from(configs)
      .where(and(
        eq(configs.tenantId, tenantId),
        eq(configs.configKey, configKey)
      ))
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

    return NextResponse.json({
      success: true,
      data: result[0].configValue,
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
    const configKey = `preferences_${employeeId}`;

    // 1. Update configs (primary storage)
    const existing = await db.select()
      .from(configs)
      .where(and(
        eq(configs.tenantId, tenantId),
        eq(configs.configKey, configKey)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update
      await db.update(configs)
        .set({
          configValue: preferences,
          updatedAt: new Date(),
        })
        .where(and(
          eq(configs.tenantId, tenantId),
          eq(configs.configKey, configKey)
        ));
    } else {
      // Insert
      await db.insert(configs)
        .values({
          tenantId,
          configKey,
          configValue: preferences,
        });
    }

    // 2. Get user's department_id
    const user = await db.select()
      .from(users)
      .where(eq(users.id, employeeId))
      .limit(1);

    if (user.length === 0) {
      console.warn(`User not found for employeeId: ${employeeId}`);
    } else {
      const departmentId = user[0].departmentId;

      // 3. Sync to nurse_preferences table (used by scheduler)
      const existingNursePrefs = await db.select()
        .from(nursePreferences)
        .where(eq(nursePreferences.nurseId, employeeId))
        .limit(1);

      // Map ComprehensivePreferences to nurse_preferences format
      const prefs = preferences.workPreferences.preferredShifts || [];
      const preferredPatterns = preferences.workPreferences.preferredPatterns || [];
      const avoidPatterns = preferences.workPreferences.avoidPatterns || [];

      const nursePrefsData = {
        tenantId,
        nurseId: employeeId,
        departmentId,
        workPatternType: preferences.workPreferences.workPatternType,
        preferredShiftTypes: {
          D: prefs.includes('day') ? 10 : 0,
          E: prefs.includes('evening') ? 10 : 0,
          N: prefs.includes('night') ? 10 : 0,
        },
        preferredPatterns: preferredPatterns.map(pattern => ({
          pattern,
          preference: 10, // Default high preference
        })),
        maxConsecutiveDaysPreferred: preferences.workPreferences.maxConsecutiveDays,
        maxConsecutiveNightsPreferred: null, // Optional field
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
    const tenantId = DEFAULT_TENANT_ID; // TODO: Get from auth

    if (!employeeId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Employee ID is required',
        },
        { status: 400 }
      );
    }

    const configKey = `preferences_${employeeId}`;

    // 삭제 전 존재 여부 확인
    const existing = await db.select()
      .from(configs)
      .where(and(
        eq(configs.tenantId, tenantId),
        eq(configs.configKey, configKey)
      ))
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

    await db.delete(configs)
      .where(and(
        eq(configs.tenantId, tenantId),
        eq(configs.configKey, configKey)
      ));

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

// PATCH: 부분 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, updates } = body;
    const tenantId = DEFAULT_TENANT_ID; // TODO: Get from auth

    if (!employeeId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Employee ID is required',
        },
        { status: 400 }
      );
    }

    const configKey = `preferences_${employeeId}`;

    // 기존 레코드 조회
    const existing = await db.select()
      .from(configs)
      .where(and(
        eq(configs.tenantId, tenantId),
        eq(configs.configKey, configKey)
      ))
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

    // 깊은 병합
    const merged = deepMerge(existing[0].configValue, updates);

    await db.update(configs)
      .set({
        configValue: merged,
        updatedAt: new Date(),
      })
      .where(and(
        eq(configs.tenantId, tenantId),
        eq(configs.configKey, configKey)
      ));

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

// 깊은 병합 유틸리티
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}