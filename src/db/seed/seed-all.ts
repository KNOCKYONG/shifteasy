import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';
import { tenants } from '@/db/schema/tenants';
import { hospitals } from '@/db/schema/hospitals';
import { wards } from '@/db/schema/wards';
import { staff, staffRoleEnum } from '@/db/schema/staff';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Use SESSION_URL to avoid IPv6 issues
const connectionString = process.env.SESSION_URL!;
const client = postgres(connectionString, {
  ssl: 'require',
  max: 1
});
const db = drizzle(client, { schema });

// 간호사 명단 (실제 근무표에서 추출)
const nurseData = {
  managers: [
    { name: '박선미', role: 'Unit Manager' }
  ],
  frn_nurses: [
    { name: '이다운', role: 'FRN' },
    { name: '이경은', role: 'FRN' }
  ],
  regular_nurses: [
    // 시니어 간호사 (경력 5년 이상, DL/EL 가능)
    { name: '조훈화', yearsOfService: 6 },
    { name: '권정희', yearsOfService: 7 },
    { name: '박정혜', yearsOfService: 8 },
    { name: '박세영', yearsOfService: 6 },
    { name: '황은정', yearsOfService: 9 },

    // 중간 경력 간호사 (2-5년)
    { name: '이소연', yearsOfService: 3 },
    { name: '김가현', yearsOfService: 4 },
    { name: '용민영', yearsOfService: 3 },
    { name: '김시연', yearsOfService: 4 },
    { name: '박채린', yearsOfService: 3 },
    { name: '백정민', yearsOfService: 5 },
    { name: '양하은', yearsOfService: 4 },
    { name: '김태연', yearsOfService: 3 },
    { name: '김선우', yearsOfService: 4 },
    { name: '주희진', yearsOfService: 3 },

    // 주니어 간호사 (2년 미만)
    { name: '정서하', yearsOfService: 1 },
    { name: '김수진', yearsOfService: 1 },
    { name: '김승희', yearsOfService: 2 },
    { name: '조예서', yearsOfService: 1 },
    { name: '전예지', yearsOfService: 1 },
    { name: '이효진', yearsOfService: 2 },
    { name: '이유민', yearsOfService: 1 },
    { name: '송수민', yearsOfService: 1 },
    { name: '이지원', yearsOfService: 2 },
    { name: '이채연', yearsOfService: 1 },
    { name: '정혜민', yearsOfService: 1 },
    { name: '송선희', yearsOfService: 2 },
    { name: '도은솔', yearsOfService: 1 },
    { name: '나혜지', yearsOfService: 1 },
    { name: '김민지', yearsOfService: 2 },
    { name: '김하진', yearsOfService: 1 },
    { name: '장민서', yearsOfService: 1 }
  ]
};

async function seedAll() {
  try {
    console.log('🏥 전체 데이터 시드 시작...');

    // 1. Create test tenant
    console.log('\n📋 테넌트 생성...');
    const testTenantId = '3760b5ec-462f-443c-9a90-4a2b2e295e9d'; // DEV_TENANT_ID from .env

    const existingTenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, testTenantId)
    });

    if (!existingTenant) {
      await db.insert(tenants).values({
        id: testTenantId,
        name: '서울대학교병원',
        slug: 'snuh',
        secretCode: 'SNUH-2025',
        plan: 'enterprise',
        settings: {
          timezone: 'Asia/Seoul',
          locale: 'ko',
          maxUsers: 100,
          maxDepartments: 10,
          features: ['scheduling', 'attendance', 'notifications', 'analytics']
        }
      });
      console.log('✅ 테넌트 생성 완료');
    } else {
      console.log('ℹ️ 테넌트가 이미 존재합니다');
    }

    // 2. Create hospital
    console.log('\n🏥 병원 생성...');
    let hospital = await db.query.hospitals.findFirst({
      where: eq(hospitals.tenantId, testTenantId)
    });

    if (!hospital) {
      const [newHospital] = await db.insert(hospitals).values({
        tenantId: testTenantId,
        name: '서울대학교병원',
        // hospitals.settings type: { workHoursPerDay?, shiftPatterns?, holidaySettings?, overtimeRules? }
        // Keep it minimal and within the allowed shape.
        settings: {
          workHoursPerDay: 12,
          shiftPatterns: { codes: ['D', 'E', 'N', 'DL', 'EL', '11D', 'OFF'] }
        }
      }).returning();

      hospital = newHospital;
      console.log('✅ 병원 생성 완료');
    } else {
      console.log('ℹ️ 병원이 이미 존재합니다');
    }

    // 3. Create ward
    console.log('\n🏥 병동 생성...');
    let ward = await db.query.wards.findFirst({
      where: eq(wards.name, '내과간호2팀')
    });

    if (!ward) {
      const [newWard] = await db.insert(wards).values({
        hospitalId: hospital.id,
        name: '내과간호2팀',
        code: '153',
        hardRules: {
          minStaffPerShift: 5,
          maxConsecutiveShifts: 5,
          minRestBetweenShifts: 8,
          requiredSkillMix: {
            senior: 1,
            regular: 3
          }
        },
        softRules: {
          preferredStaffRatio: 1.5,
          targetFairnessScore: 0.8,
          maxOvertimeHours: 52
        },
        active: true
      }).returning();

      ward = newWard;
      console.log('✅ 병동 생성 완료');
    } else {
      console.log('ℹ️ 병동이 이미 존재합니다');
    }

    // 4. Delete existing staff and add new ones
    console.log('\n🗑️ 기존 직원 데이터 삭제...');
    await db.delete(staff).where(eq(staff.wardId, ward.id));
    console.log('✅ 기존 직원 데이터 삭제 완료');

    // 5. Insert new staff
    console.log('\n👥 새 직원 데이터 추가...');
    const staffData: typeof staff.$inferInsert[] = [];

    // Unit Manager
    nurseData.managers.forEach((manager, index) => {
      staffData.push({
        wardId: ward.id,
        name: manager.name,
        role: 'CN' as const,
        employeeId: `UM-${String(index + 1).padStart(3, '0')}`,
        hireDate: new Date('2015-03-01'),
        maxWeeklyHours: 40,
        skills: ['leadership', 'emergency', 'critical_care', 'team_management'],
        technicalSkill: 5,
        leadership: 5,
        communication: 5,
        adaptability: 5,
        reliability: 5,
        active: true
      });
    });

    // FRN
    nurseData.frn_nurses.forEach((frn, index) => {
      staffData.push({
        wardId: ward.id,
        name: frn.name,
        role: 'SN' as const,
        employeeId: `FRN-${String(index + 1).padStart(3, '0')}`,
        hireDate: new Date(`201${8 - index}-06-01`),
        maxWeeklyHours: 52,
        skills: ['emergency', 'critical_care', 'flexible', 'multi_unit'],
        technicalSkill: 4,
        leadership: 4,
        communication: 4,
        adaptability: 5,
        reliability: 4,
        active: true
      });
    });

    // Regular nurses
    nurseData.regular_nurses.forEach((nurse, index) => {
      const yearsOfService = nurse.yearsOfService || 1;
      const baseDate = new Date();
      const hireDate = new Date(baseDate.getFullYear() - yearsOfService, 0, 1);

      // Years of service에 따른 스킬 배정
      const skills = yearsOfService >= 6
        ? ['emergency', 'critical_care', 'mentoring', 'leadership']
        : yearsOfService >= 3
        ? ['basic_care', 'emergency', 'teamwork']
        : ['basic_care', 'learning'];

      const technicalSkill = yearsOfService >= 6 ? 4 : yearsOfService >= 3 ? 3 : 2;
      const leadership = yearsOfService >= 6 ? 4 : yearsOfService >= 3 ? 3 : 2;
      const communication = yearsOfService >= 6 ? 4 : yearsOfService >= 3 ? 3 : 3;
      const adaptability = yearsOfService >= 6 ? 4 : yearsOfService >= 3 ? 4 : 3;
      const reliability = yearsOfService >= 6 ? 5 : yearsOfService >= 3 ? 4 : 3;

      staffData.push({
        wardId: ward.id,
        name: nurse.name,
        role: 'RN' as const,
        employeeId: `RN-${String(index + 1).padStart(3, '0')}`,
        hireDate,
        maxWeeklyHours: 52,
        skills,
        technicalSkill,
        leadership,
        communication,
        adaptability,
        reliability,
        active: true
      });
    });

    await db.insert(staff).values(staffData);

    // 6. Verify results
    const insertedStaff = await db.query.staff.findMany({
      where: eq(staff.wardId, ward.id)
    });

    console.log('\n📊 시드 완료 요약:');
    console.log(`  - 테넌트: ${existingTenant ? '기존 사용' : '신규 생성'}`);
    console.log(`  - 병원: ${hospital.name}`);
    console.log(`  - 병동: ${ward.name}`);
    console.log(`  - Unit Manager: ${nurseData.managers.length}명`);
    console.log(`  - FRN (Senior Nurse): ${nurseData.frn_nurses.length}명`);
    console.log(`  - RN (Registered Nurse): ${nurseData.regular_nurses.length}명`);
    console.log(`  - 총 인원: ${insertedStaff.length}명`);

    console.log('\n✅ 모든 데이터 시드 완료!');

  } catch (error) {
    console.error('❌ 시드 실패:', error);
    throw error;
  }
}

// Run script
if (require.main === module) {
  seedAll()
    .then(async () => {
      await client.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('스크립트 실패:', error);
      await client.end();
      process.exit(1);
    });
}

export { seedAll };
