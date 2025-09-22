import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';
import { users } from '@/db/schema/tenants';
import { departments } from '@/db/schema/tenants';
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
    { name: '박선미', role: 'manager', position: 'Unit Manager' }
  ],
  frn_nurses: [
    { name: '이다운', role: 'member', position: 'FRN' },
    { name: '이경은', role: 'member', position: 'FRN' }
  ],
  regular_nurses: [
    // 시니어 간호사 (경력 5년 이상, DL/EL 가능)
    { name: '조훈화', role: 'member', position: 'Senior RN' },
    { name: '권정희', role: 'member', position: 'Senior RN' },
    { name: '박정혜', role: 'member', position: 'Senior RN' },
    { name: '박세영', role: 'member', position: 'Senior RN' },
    { name: '황은정', role: 'member', position: 'Senior RN' },

    // 중간 경력 간호사 (2-5년)
    { name: '이소연', role: 'member', position: 'RN' },
    { name: '김가현', role: 'member', position: 'RN' },
    { name: '용민영', role: 'member', position: 'RN' },
    { name: '김시연', role: 'member', position: 'RN' },
    { name: '박채린', role: 'member', position: 'RN' },
    { name: '백정민', role: 'member', position: 'RN' },
    { name: '양하은', role: 'member', position: 'RN' },
    { name: '김태연', role: 'member', position: 'RN' },
    { name: '김선우', role: 'member', position: 'RN' },
    { name: '주희진', role: 'member', position: 'RN' },

    // 주니어 간호사 (2년 미만)
    { name: '정서하', role: 'member', position: 'Junior RN' },
    { name: '김수진', role: 'member', position: 'Junior RN' },
    { name: '김승희', role: 'member', position: 'Junior RN' },
    { name: '조예서', role: 'member', position: 'Junior RN' },
    { name: '전예지', role: 'member', position: 'Junior RN' },
    { name: '이효진', role: 'member', position: 'Junior RN' },
    { name: '이유민', role: 'member', position: 'Junior RN' },
    { name: '송수민', role: 'member', position: 'Junior RN' },
    { name: '이지원', role: 'member', position: 'Junior RN' },
    { name: '이채연', role: 'member', position: 'Junior RN' },
    { name: '정혜민', role: 'member', position: 'Junior RN' },
    { name: '송선희', role: 'member', position: 'Junior RN' },
    { name: '도은솔', role: 'member', position: 'Junior RN' },
    { name: '나혜지', role: 'member', position: 'Junior RN' },
    { name: '김민지', role: 'member', position: 'Junior RN' },
    { name: '김하진', role: 'member', position: 'Junior RN' },
    { name: '장민서', role: 'member', position: 'Junior RN' }
  ]
};

// 한글 이름을 영문 ID로 변환하는 함수
function nameToUserId(name: string): string {
  const nameMap: { [key: string]: string } = {
    '박선미': 'park-sun-mi',
    '이다운': 'lee-da-woon',
    '이경은': 'lee-kyung-eun',
    '조훈화': 'cho-hoon-hwa',
    '권정희': 'kwon-jung-hee',
    '박정혜': 'park-jung-hye',
    '박세영': 'park-se-young',
    '황은정': 'hwang-eun-jung',
    '이소연': 'lee-so-yeon',
    '김가현': 'kim-ga-hyun',
    '용민영': 'yong-min-young',
    '김시연': 'kim-si-yeon',
    '박채린': 'park-chae-rin',
    '백정민': 'baek-jung-min',
    '양하은': 'yang-ha-eun',
    '김태연': 'kim-tae-yeon',
    '김선우': 'kim-sun-woo',
    '주희진': 'joo-hee-jin',
    '정서하': 'jung-seo-ha',
    '김수진': 'kim-su-jin',
    '김승희': 'kim-seung-hee',
    '조예서': 'cho-ye-seo',
    '전예지': 'jeon-ye-ji',
    '이효진': 'lee-hyo-jin',
    '이유민': 'lee-yoo-min',
    '송수민': 'song-su-min',
    '이지원': 'lee-ji-won',
    '이채연': 'lee-chae-yeon',
    '정혜민': 'jung-hye-min',
    '송선희': 'song-sun-hee',
    '도은솔': 'do-eun-sol',
    '나혜지': 'na-hye-ji',
    '김민지': 'kim-min-ji',
    '김하진': 'kim-ha-jin',
    '장민서': 'jang-min-seo'
  };
  return nameMap[name] || name.toLowerCase().replace(/\s+/g, '-');
}

async function migrateStaffToUsers() {
  try {
    console.log('👥 Staff → Users 마이그레이션 시작...');

    const testTenantId = '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

    // 1. Drop staff table first
    console.log('\n🗑️ staff 테이블 삭제 중...');
    try {
      await client`DROP TABLE IF EXISTS staff CASCADE;`;
      console.log('✅ staff 테이블 삭제 완료');
    } catch (error) {
      console.log('⚠️ staff 테이블 삭제 실패 (이미 없을 수 있음):', error);
    }

    // 2. Get or create department
    console.log('\n🏥 부서 확인/생성 중...');
    let department = await db.query.departments.findFirst({
      where: eq(departments.tenantId, testTenantId)
    });

    if (!department) {
      const [newDepartment] = await db.insert(departments).values({
        tenantId: testTenantId,
        name: '내과간호2팀',
        code: '153',
        description: '내과 간호 2팀',
        settings: {
          minStaff: 5,
          maxStaff: 40,
          requiredRoles: ['manager', 'member']
        }
      }).returning();

      department = newDepartment;
      console.log('✅ 부서 생성 완료');
    } else {
      console.log('ℹ️ 부서가 이미 존재합니다');
    }

    // 3. Delete existing users in this tenant
    console.log('\n🗑️ 기존 사용자 삭제 중...');
    await db.delete(users).where(eq(users.tenantId, testTenantId));
    console.log('✅ 기존 사용자 삭제 완료');

    // 4. Create new users
    console.log('\n👥 새 사용자 생성 중...');
    const userData: typeof users.$inferInsert[] = [];

    // Unit Manager
    nurseData.managers.forEach((manager, index) => {
      const userId = nameToUserId(manager.name);
      userData.push({
        tenantId: testTenantId,
        departmentId: department.id,
        email: `${userId}@snuh.org`,
        name: manager.name,
        role: manager.role, // 'manager'
        employeeId: `UM-${String(index + 1).padStart(3, '0')}`,
        position: manager.position,
        profile: {
          phone: `010-0000-${String(1001 + index).padStart(4, '0')}`,
          skills: ['leadership', 'emergency', 'critical_care', 'team_management'],
          preferences: {
            preferredShifts: ['D'],
            maxHoursPerWeek: 40
          }
        },
        status: 'active'
      });
    });

    // FRN nurses
    nurseData.frn_nurses.forEach((frn, index) => {
      const userId = nameToUserId(frn.name);
      userData.push({
        tenantId: testTenantId,
        departmentId: department.id,
        email: `${userId}@snuh.org`,
        name: frn.name,
        role: frn.role, // 'member'
        employeeId: `FRN-${String(index + 1).padStart(3, '0')}`,
        position: frn.position,
        profile: {
          phone: `010-0000-${String(2001 + index).padStart(4, '0')}`,
          skills: ['emergency', 'critical_care', 'flexible', 'multi_unit'],
          preferences: {
            preferredShifts: ['D', 'E', 'N'],
            maxHoursPerWeek: 52
          }
        },
        status: 'active'
      });
    });

    // Regular nurses
    nurseData.regular_nurses.forEach((nurse, index) => {
      const userId = nameToUserId(nurse.name);
      const skills = nurse.position.includes('Senior')
        ? ['emergency', 'critical_care', 'mentoring', 'leadership']
        : nurse.position.includes('Junior')
        ? ['basic_care', 'learning']
        : ['basic_care', 'emergency', 'teamwork'];

      userData.push({
        tenantId: testTenantId,
        departmentId: department.id,
        email: `${userId}@snuh.org`,
        name: nurse.name,
        role: nurse.role, // 'member'
        employeeId: `RN-${String(index + 1).padStart(3, '0')}`,
        position: nurse.position,
        profile: {
          phone: `010-0000-${String(3001 + index).padStart(4, '0')}`,
          skills,
          preferences: {
            preferredShifts: ['D', 'E', 'N'],
            maxHoursPerWeek: 52
          }
        },
        status: 'active'
      });
    });

    await db.insert(users).values(userData);

    // 5. Verify results
    const insertedUsers = await db.query.users.findMany({
      where: eq(users.tenantId, testTenantId)
    });

    console.log('\n📊 마이그레이션 완료 요약:');
    console.log(`  - staff 테이블: 삭제됨`);
    console.log(`  - 부서: ${department.name}`);
    console.log(`  - Unit Manager: ${nurseData.managers.length}명`);
    console.log(`  - FRN: ${nurseData.frn_nurses.length}명`);
    console.log(`  - RN: ${nurseData.regular_nurses.length}명`);
    console.log(`  - 총 사용자: ${insertedUsers.length}명`);

    console.log('\n📧 생성된 계정:');
    insertedUsers.forEach(user => {
      console.log(`  - ${user.name}: ${user.email} (${user.position})`);
    });

    console.log('\n✅ Staff → Users 마이그레이션 완료!');

  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    throw error;
  }
}

// Run script
if (require.main === module) {
  migrateStaffToUsers()
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

export { migrateStaffToUsers };