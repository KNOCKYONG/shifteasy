/**
 * 게스트 → Professional 플랜 마이그레이션 API
 *
 * POST /api/migration/guest-to-professional
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { tenants, departments, users, configs, teams, nursePreferences, holidays } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// Route Segment Config (필수)
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 마이그레이션은 최대 60초
import {
  checkGuestAccount,
  checkMigrationEligibility,
  generateSecretCode,
  MigrationOptions,
  DEFAULT_MIGRATION_OPTIONS,
  MigrationResult,
  MigrationErrorCode,
  MigrationStep,
} from '@/lib/utils/migration';

/**
 * 병원명에서 slug 생성 (고유성 보장)
 */
async function generateUniqueSlug(hospitalName: string): Promise<string> {
  // 기본 slug 생성: 한글 → 영문 변환 및 정규화
  const baseSlug = hospitalName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣-]/g, '')
    .substring(0, 50);

  let slug = baseSlug;
  let counter = 1;

  // 중복 확인 및 고유 slug 생성
  while (true) {
    const existing = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * 마이그레이션 요청 바디
 */
interface MigrationRequest {
  hospitalName: string;
  departmentName: string;
  options?: Partial<MigrationOptions>;
}

/**
 * POST: 게스트 계정에서 Professional 플랜으로 마이그레이션
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: MigrationErrorCode.UNAUTHORIZED,
            message: '인증이 필요합니다.',
          },
        } as MigrationResult,
        { status: 401 }
      );
    }

    // 2. 요청 바디 파싱
    const body: MigrationRequest = await request.json();
    const { hospitalName, departmentName, options } = body;

    if (!hospitalName || !departmentName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: MigrationErrorCode.VALIDATION_ERROR,
            message: '병원명과 부서명은 필수입니다.',
          },
        } as MigrationResult,
        { status: 400 }
      );
    }

    // 3. 게스트 계정 확인
    const guestInfo = await checkGuestAccount(userId);
    if (!guestInfo.isGuest || !guestInfo.canMigrate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: guestInfo.alreadyMigrated
              ? MigrationErrorCode.ALREADY_MIGRATED
              : MigrationErrorCode.NOT_GUEST_ACCOUNT,
            message: guestInfo.alreadyMigrated
              ? '이미 마이그레이션된 계정입니다.'
              : '게스트 계정이 아니거나 마이그레이션할 수 없습니다.',
          },
        } as MigrationResult,
        { status: 400 }
      );
    }

    // 4. 마이그레이션 자격 확인
    const eligibility = await checkMigrationEligibility(userId, guestInfo.tenantId!);
    if (!eligibility.eligible) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: MigrationErrorCode.VALIDATION_ERROR,
            message: eligibility.reason || '마이그레이션 자격이 없습니다.',
          },
        } as MigrationResult,
        { status: 400 }
      );
    }

    // 5. 마이그레이션 옵션 설정
    const migrationOptions: MigrationOptions = {
      ...DEFAULT_MIGRATION_OPTIONS,
      ...options,
    };

    // 6. 마이그레이션 실행
    const result = await performMigration(
      userId,
      guestInfo.tenantId!,
      guestInfo.departmentId!,
      hospitalName,
      departmentName,
      migrationOptions
    );

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error('Migration API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: MigrationErrorCode.MIGRATION_FAILED,
          message: '마이그레이션 중 오류가 발생했습니다.',
          details: error instanceof Error ? error.message : String(error),
        },
      } as MigrationResult,
      { status: 500 }
    );
  }
}

/**
 * 실제 마이그레이션 수행 (트랜잭션)
 */
async function performMigration(
  userId: string,
  oldTenantId: string,
  oldDepartmentId: string,
  hospitalName: string,
  departmentName: string,
  options: MigrationOptions
): Promise<MigrationResult> {
  try {
    return await db.transaction(async (tx) => {
      console.log('[Migration] Starting transaction...');

      // Step 1: 새 Tenant 생성
      const secretCode = generateSecretCode();
      const slug = await generateUniqueSlug(hospitalName);

      console.log(`[Migration] Creating new tenant with slug: ${slug}`);

      const [newTenant] = await tx
        .insert(tenants)
        .values({
          name: hospitalName,
          slug,
          plan: 'professional',
          secretCode,
          settings: {
            timezone: 'Asia/Seoul',
            locale: 'ko',
            maxUsers: 50, // Professional plan limit
            maxDepartments: 10,
            features: ['ai-scheduling', 'preferences', 'analytics'],
            signupEnabled: true,
            isGuestTrial: false,
            migratedFrom: oldTenantId,
            migratedAt: new Date().toISOString(),
          } as any,
        })
        .returning();

      if (!newTenant) {
        throw new Error('Failed to create new tenant');
      }

      console.log(`[Migration] Created tenant: ${newTenant.id}`);

      // Step 2: 새 Department 생성
      const departmentSecretCode = generateSecretCode();

      const [newDepartment] = await tx
        .insert(departments)
        .values({
          tenantId: newTenant.id,
          name: departmentName,
          secretCode: departmentSecretCode,
          settings: {
            minStaff: 1,
            maxStaff: 50,
          },
        })
        .returning();

      if (!newDepartment) {
        throw new Error('Failed to create new department');
      }

      console.log(`[Migration] Created department: ${newDepartment.id}`);

      // Step 3: 사용자 역할 업데이트 (guest → manager)
      await tx
        .update(users)
        .set({
          tenantId: newTenant.id,
          departmentId: newDepartment.id,
          role: 'manager',
        })
        .where(eq(users.authUserId, userId));

      console.log('[Migration] Updated user role');

      // 데이터 복사 카운터
      const migratedCounts = {
        configs: 0,
        teams: 0,
        users: 0,
        preferences: 0,
        holidays: 0,
        schedules: 0,
        specialRequests: 0,
      };

      // Step 4: Configs 복사
      if (options.migrateConfigs) {
        console.log('[Migration] Migrating configs...');
        const oldConfigs = await tx.query.configs.findMany({
          where: eq(configs.tenantId, oldTenantId),
        });

        for (const config of oldConfigs) {
          await tx.insert(configs).values({
            tenantId: newTenant.id,
            departmentId: config.departmentId ? newDepartment.id : null,
            configKey: config.configKey,
            configValue: config.configValue,
          });
          migratedCounts.configs++;
        }

        console.log(`[Migration] Migrated ${migratedCounts.configs} configs`);
      }

      // Step 5: Teams 복사 및 ID 매핑
      const teamIdMap = new Map<string, string>(); // old ID → new ID

      if (options.migrateTeams) {
        console.log('[Migration] Migrating teams...');
        const oldTeams = await tx.query.teams.findMany({
          where: eq(teams.tenantId, oldTenantId),
        });

        for (const team of oldTeams) {
          const [newTeam] = await tx
            .insert(teams)
            .values({
              tenantId: newTenant.id,
              departmentId: newDepartment.id,
              name: team.name,
              description: team.description,
              color: team.color,
            })
            .returning();

          if (newTeam) {
            teamIdMap.set(team.id, newTeam.id);
            migratedCounts.teams++;
          }
        }

        console.log(`[Migration] Migrated ${migratedCounts.teams} teams`);
      }

      // Step 6: Users 복사 (팀원들) - teamId 재매핑
      if (options.migrateUsers) {
        console.log('[Migration] Migrating users...');
        const oldUsers = await tx.query.users.findMany({
          where: and(
            eq(users.tenantId, oldTenantId),
            eq(users.role, 'member')
          ),
        });

        for (const user of oldUsers) {
          const newTeamId = user.teamId && teamIdMap.has(user.teamId)
            ? teamIdMap.get(user.teamId)!
            : null;

          await tx
            .update(users)
            .set({
              tenantId: newTenant.id,
              departmentId: newDepartment.id,
              teamId: newTeamId,
            })
            .where(eq(users.id, user.id));

          migratedCounts.users++;
        }

        console.log(`[Migration] Migrated ${migratedCounts.users} users`);
      }

      // Step 7: Nurse Preferences 복사
      if (options.migratePreferences) {
        console.log('[Migration] Migrating preferences...');
        const oldPreferences = await tx.query.nursePreferences.findMany({
          where: eq(nursePreferences.tenantId, oldTenantId),
        });

        for (const pref of oldPreferences) {
          await tx.insert(nursePreferences).values({
            tenantId: newTenant.id,
            nurseId: pref.nurseId,
            departmentId: newDepartment.id,
            workPatternType: pref.workPatternType,
            preferredPatterns: pref.preferredPatterns,
            avoidPatterns: pref.avoidPatterns,
          });
          migratedCounts.preferences++;
        }

        console.log(`[Migration] Migrated ${migratedCounts.preferences} preferences`);
      }

      // Step 8: Holidays 복사
      if (options.migrateHolidays) {
        console.log('[Migration] Migrating holidays...');
        const oldHolidays = await tx.query.holidays.findMany({
          where: eq(holidays.tenantId, oldTenantId),
        });

        for (const holiday of oldHolidays) {
          await tx.insert(holidays).values({
            tenantId: newTenant.id,
            departmentId: newDepartment.id,
            date: holiday.date,
            name: holiday.name,
            type: holiday.type,
          });
          migratedCounts.holidays++;
        }

        console.log(`[Migration] Migrated ${migratedCounts.holidays} holidays`);
      }

      // Step 9: Schedules 복사 (선택적)
      if (options.migrateSchedules) {
        console.log('[Migration] Migrating schedules...');
        const oldSchedules = await tx.query.schedules.findMany({
          where: eq(schedules.tenantId, oldTenantId),
        });

        for (const schedule of oldSchedules) {
          await tx.insert(schedules).values({
            tenantId: newTenant.id,
            departmentId: newDepartment.id,
            startDate: schedule.startDate,
            endDate: schedule.endDate,
            status: schedule.status,
            version: schedule.version,
            metadata: schedule.metadata,
          });
          migratedCounts.schedules++;
        }

        console.log(`[Migration] Migrated ${migratedCounts.schedules} schedules`);
      }

      console.log('[Migration] Transaction completed successfully');

      return {
        success: true,
        newTenantId: newTenant.id,
        newDepartmentId: newDepartment.id,
        secretCode,
        migratedData: migratedCounts,
      } as MigrationResult;
    });
  } catch (error) {
    console.error('[Migration] Transaction error:', error);
    return {
      success: false,
      error: {
        code: MigrationErrorCode.MIGRATION_FAILED,
        message: '마이그레이션 트랜잭션 실패',
        details: error instanceof Error ? error.message : String(error),
      },
    } as MigrationResult;
  }
}
