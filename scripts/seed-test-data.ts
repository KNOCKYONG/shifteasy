import { config } from 'dotenv';
import { resolve } from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, departments, schedules, shiftTypes, tenants } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Use pooled connection (DATABASE_URL works, DIRECT_URL has IPv6 issues)
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, {
  prepare: false,
  ssl: 'require',
  max: 1 // Single connection for seeding
});

const db = drizzle(client, {
  schema: { users, departments, schedules, shiftTypes, tenants }
});

async function seedTestData() {
  console.log('🌱 테스트 데이터 생성 시작...');

  try {
    // 0. 테넌트 생성 - 고정된 UUID 사용
    const tenantId = '3760b5ec-462f-443c-9a90-4a2b2e295e9d'; // .env.local의 DEV_TENANT_ID와 동일
    console.log('🏢 테넌트 생성 중...');

    const tenantData = {
      id: tenantId,
      name: '서울대병원',
      slug: 'seoul-hospital',
      secretCode: 'SH2025-' + Math.random().toString(36).substr(2, 9),
      plan: 'pro',
      settings: {
        timezone: 'Asia/Seoul',
        locale: 'ko',
        maxUsers: 100,
        maxDepartments: 10,
        features: ['schedule', 'swap', 'analytics'],
        signupEnabled: true
      }
    };

    await db.insert(tenants).values(tenantData).onConflictDoNothing();
    console.log('✅ 테넌트 생성 완료:', tenantId);

    // 1. 부서 생성
    console.log('📁 부서 생성 중...');
    const departmentData = [
      { id: randomUUID(), tenantId, name: '내과병동', code: 'INT' },
      { id: randomUUID(), tenantId, name: '외과병동', code: 'SUR' },
      { id: randomUUID(), tenantId, name: '응급실', code: 'ER' },
      { id: randomUUID(), tenantId, name: '중환자실', code: 'ICU' },
    ];

    for (const dept of departmentData) {
      await db.insert(departments).values(dept).onConflictDoNothing();
    }

    // 2. 근무 타입 생성
    console.log('🕐 근무 타입 생성 중...');
    const shiftTypeData = [
      {
        id: randomUUID(),
        tenantId,
        code: 'D',
        name: '주간',
        startTime: '07:00',
        endTime: '15:00',
        duration: 8,
        color: '#3B82F6',
      },
      {
        id: randomUUID(),
        tenantId,
        code: 'E',
        name: '저녁',
        startTime: '15:00',
        endTime: '23:00',
        duration: 8,
        color: '#8B5CF6',
      },
      {
        id: randomUUID(),
        tenantId,
        code: 'N',
        name: '야간',
        startTime: '23:00',
        endTime: '07:00',
        duration: 8,
        color: '#EF4444',
      },
      {
        id: randomUUID(),
        tenantId,
        code: 'OFF',
        name: '휴무',
        startTime: '00:00',
        endTime: '00:00',
        duration: 0,
        color: '#6B7280',
      },
    ];

    for (const shift of shiftTypeData) {
      await db.insert(shiftTypes).values(shift).onConflictDoNothing();
    }

    // 3. 사용자(팀원) 생성
    console.log('👥 팀원 생성 중...');
    const userData = [
      {
        id: randomUUID(),
        tenantId,
        clerkId: 'test-user-1',
        email: 'kim.nurse@hospital.com',
        name: '김간호',
        role: 'admin' as const,
        status: 'active' as const,
        departmentId: departmentData[0].id,
        position: '수간호사',
        employeeId: 'EMP001',
        profile: {
          phone: '010-1234-5678',
          experienceYears: 10,
          seniorityLevel: 'senior',
          skills: ['응급처치', '수술보조', '환자관리'],
        },
      },
      {
        id: randomUUID(),
        tenantId,
        clerkId: 'test-user-2',
        email: 'lee.nurse@hospital.com',
        name: '이간호',
        role: 'manager' as const,
        status: 'active' as const,
        departmentId: departmentData[0].id,
        position: '책임간호사',
        employeeId: 'EMP002',
        profile: {
          phone: '010-2345-6789',
          experienceYears: 7,
          seniorityLevel: 'senior',
          skills: ['환자간호', '약물관리'],
        },
      },
      {
        id: randomUUID(),
        tenantId,
        clerkId: 'test-user-3',
        email: 'park.nurse@hospital.com',
        name: '박간호',
        role: 'staff' as const,
        status: 'active' as const,
        departmentId: departmentData[0].id,
        position: '일반간호사',
        employeeId: 'EMP003',
        profile: {
          phone: '010-3456-7890',
          experienceYears: 3,
          seniorityLevel: 'junior',
          skills: ['기본간호', '환자관리'],
        },
      },
      {
        id: randomUUID(),
        tenantId,
        clerkId: 'test-user-4',
        email: 'choi.nurse@hospital.com',
        name: '최간호',
        role: 'staff' as const,
        status: 'active' as const,
        departmentId: departmentData[1].id,
        position: '일반간호사',
        employeeId: 'EMP004',
        profile: {
          phone: '010-4567-8901',
          experienceYears: 2,
          seniorityLevel: 'junior',
          skills: ['수술간호', '환자관리'],
        },
      },
      {
        id: randomUUID(),
        tenantId,
        clerkId: 'test-user-5',
        email: 'jung.nurse@hospital.com',
        name: '정간호',
        role: 'staff' as const,
        status: 'active' as const,
        departmentId: departmentData[2].id,
        position: '응급실간호사',
        employeeId: 'EMP005',
        profile: {
          phone: '010-5678-9012',
          experienceYears: 5,
          seniorityLevel: 'intermediate',
          skills: ['응급처치', 'CPR', '외상처치'],
        },
      },
      {
        id: randomUUID(),
        tenantId,
        clerkId: 'test-user-6',
        email: 'kang.nurse@hospital.com',
        name: '강간호',
        role: 'staff' as const,
        status: 'on_leave' as const,
        departmentId: departmentData[0].id,
        position: '일반간호사',
        employeeId: 'EMP006',
        profile: {
          phone: '010-6789-0123',
          experienceYears: 4,
          seniorityLevel: 'intermediate',
          skills: ['환자간호', '약물관리'],
        },
      },
      {
        id: randomUUID(),
        tenantId,
        clerkId: 'test-user-7',
        email: 'shin.nurse@hospital.com',
        name: '신간호',
        role: 'staff' as const,
        status: 'active' as const,
        departmentId: departmentData[3].id,
        position: 'ICU간호사',
        employeeId: 'EMP007',
        profile: {
          phone: '010-7890-1234',
          experienceYears: 6,
          seniorityLevel: 'senior',
          skills: ['중환자관리', '인공호흡기', '모니터링'],
        },
      },
      {
        id: randomUUID(),
        tenantId,
        clerkId: 'test-user-8',
        email: 'yoon.nurse@hospital.com',
        name: '윤간호',
        role: 'staff' as const,
        status: 'active' as const,
        departmentId: departmentData[1].id,
        position: '수술실간호사',
        employeeId: 'EMP008',
        profile: {
          phone: '010-8901-2345',
          experienceYears: 8,
          seniorityLevel: 'senior',
          skills: ['수술보조', '무균술', '기구관리'],
        },
      },
    ];

    for (const user of userData) {
      await db.insert(users).values(user).onConflictDoNothing();
    }

    // 4. 스케줄 생성 (이번 달)
    console.log('📅 스케줄 생성 중...');
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // 각 사용자별로 이번 달 스케줄 생성
    const scheduleData = [];
    const shiftPatternIds = shiftTypeData.map(shift => shift.id);

    for (let day = 1; day <= 30; day++) {
      for (let userIndex = 0; userIndex < userData.length; userIndex++) {
        const user = userData[userIndex];
        if (user.status === 'active') {
          const shiftIndex = (day + userIndex) % shiftPatternIds.length;
          const date = new Date(currentYear, currentMonth, day);

          scheduleData.push({
            id: randomUUID(),
            tenantId,
            userId: user.id,
            date: date.toISOString(),
            shiftTypeId: shiftPatternIds[shiftIndex],
            status: 'confirmed' as const,
            departmentId: user.departmentId,
          });
        }
      }
    }

    for (const schedule of scheduleData) {
      await db.insert(schedules).values(schedule).onConflictDoNothing();
    }

    console.log('✅ 테스트 데이터 생성 완료!');
    console.log(`
    생성된 데이터:
    - 테넌트: ${tenantData.name} (ID: ${tenantId})
    - 부서: ${departmentData.length}개
    - 근무 타입: ${shiftTypeData.length}개
    - 팀원: ${userData.length}명
    - 스케줄: ${scheduleData.length}개

    📌 TRPC Context에서 사용할 테넌트 ID: ${tenantId}
    `);

  } catch (error) {
    console.error('❌ 테스트 데이터 생성 실패:', error);
    throw error;
  }
}

// 스크립트 실행
seedTestData()
  .then(async () => {
    console.log('🎉 모든 작업 완료!');
    await client.end(); // Close database connection
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('💥 오류 발생:', error);
    await client.end(); // Close database connection
    process.exit(1);
  });