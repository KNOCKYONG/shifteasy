import { db } from '@/db';
import { tenants, users, departments, shiftTypes } from '@/db/schema/tenants';
import { generateUniqueSecretCode } from '@/lib/auth/secret-code';

/**
 * 🚨 중앙 집중식 데이터베이스 초기화 스크립트
 *
 * ⭐ 워크플로우:
 * 1. 새 기능 테스트: src/db/temp-[기능].ts 생성 → 테스트
 * 2. 테스트 완료: 이 파일(initialize.ts)에 통합
 * 3. 임시 파일 삭제: temp-*.ts 파일은 즉시 삭제
 *
 * 📌 규칙:
 * - 모든 초기 데이터는 최종적으로 이 파일에만 존재
 * - 별도 seed 파일 생성 금지
 * - 스키마 변경 시: 이 파일도 함께 업데이트
 *
 * 실행 명령:
 * - npm run db:init   (초기 데이터만)
 * - npm run db:setup  (테이블 + 초기 데이터)
 * - npm run db:reset  (완전 초기화)
 *
 * 현재 포함된 데이터:
 * - 테넌트: 서울대학교병원
 * - 부서: 10개
 * - 근무 유형: D, E, N, O
 * - 사용자: 관리자 1명 + 각 부서별 2명
 *
 * TODO: 새로운 데이터 추가 시 여기에 통합
 */
async function initializeDatabase() {
  console.log('🚀 데이터베이스 초기화 시작...\n');

  try {
    // 1. 테넌트 생성
    const secretCode = await generateUniqueSecretCode();
    const testTenant = await db
      .insert(tenants)
      .values({
        name: '서울대학교병원',
        slug: 'seoul-hospital',
        secretCode: secretCode,
        plan: 'pro',
        settings: {
          timezone: 'Asia/Seoul',
          locale: 'ko',
          maxUsers: 100,
          maxDepartments: 20,
          features: ['advanced-scheduling', 'swap-requests', 'analytics'],
          signupEnabled: true,
        },
      })
      .returning();

    console.log('✅ 테넌트 생성 완료');
    console.log(`   이름: ${testTenant[0].name}`);
    console.log(`   시크릿 코드: ${testTenant[0].secretCode}`);
    console.log(`   ID: ${testTenant[0].id}\n`);

    // 2. 모든 부서 생성 (add-departments.ts 내용 통합)
    const departmentData = [
      {
        name: '응급실',
        code: 'ER',
        description: '24시간 응급 진료',
        minStaff: 5,
        maxStaff: 15,
        requiredRoles: ['senior', 'junior', 'specialist']
      },
      {
        name: '중환자실',
        code: 'ICU',
        description: '중증 환자 집중 치료',
        minStaff: 4,
        maxStaff: 12,
        requiredRoles: ['senior', 'specialist']
      },
      {
        name: '내과 병동',
        code: 'IM',
        description: '내과 입원 환자 병동',
        minStaff: 3,
        maxStaff: 10,
        requiredRoles: ['senior', 'junior']
      },
      {
        name: '외과 병동',
        code: 'GS',
        description: '외과 입원 환자 병동',
        minStaff: 4,
        maxStaff: 10,
        requiredRoles: ['senior', 'junior']
      },
      {
        name: '소아과 병동',
        code: 'PED',
        description: '소아 환자 전문 병동',
        minStaff: 3,
        maxStaff: 8,
        requiredRoles: ['senior', 'junior', 'pediatric']
      },
      {
        name: '산부인과 병동',
        code: 'OB',
        description: '산부인과 입원 환자 병동',
        minStaff: 3,
        maxStaff: 8,
        requiredRoles: ['senior', 'junior', 'midwife']
      },
      {
        name: '정형외과 병동',
        code: 'OS',
        description: '정형외과 입원 환자 병동',
        minStaff: 3,
        maxStaff: 8,
        requiredRoles: ['senior', 'junior']
      },
      {
        name: '신경과 병동',
        code: 'NR',
        description: '신경과 입원 환자 병동',
        minStaff: 3,
        maxStaff: 8,
        requiredRoles: ['senior', 'junior']
      },
      {
        name: '재활의학과 병동',
        code: 'RM',
        description: '재활 치료 병동',
        minStaff: 2,
        maxStaff: 6,
        requiredRoles: ['senior', 'junior', 'therapist']
      },
      {
        name: '정신건강의학과 병동',
        code: 'PSY',
        description: '정신건강 전문 병동',
        minStaff: 3,
        maxStaff: 8,
        requiredRoles: ['senior', 'junior', 'psychiatric']
      },
    ];

    const departments_data = await db
      .insert(departments)
      .values(
        departmentData.map(dept => ({
          tenantId: testTenant[0].id,
          name: dept.name,
          code: dept.code,
          description: dept.description,
          settings: {
            minStaff: dept.minStaff,
            maxStaff: dept.maxStaff,
            requiredRoles: dept.requiredRoles,
          },
        }))
      )
      .returning();

    console.log(`✅ ${departments_data.length}개 부서 생성 완료`);
    departments_data.forEach(dept => {
      console.log(`   - ${dept.name} (${dept.code})`);
    });
    console.log();

    // 3. 근무 유형 생성
    const shiftTypes_data = await db
      .insert(shiftTypes)
      .values([
        {
          tenantId: testTenant[0].id,
          code: 'D',
          name: '주간',
          startTime: '07:00',
          endTime: '15:00',
          duration: 480,
          color: '#3B82F6',
          breakMinutes: 30,
          sortOrder: 1,
        },
        {
          tenantId: testTenant[0].id,
          code: 'E',
          name: '저녁',
          startTime: '15:00',
          endTime: '23:00',
          duration: 480,
          color: '#F59E0B',
          breakMinutes: 30,
          sortOrder: 2,
        },
        {
          tenantId: testTenant[0].id,
          code: 'N',
          name: '야간',
          startTime: '23:00',
          endTime: '07:00',
          duration: 480,
          color: '#6366F1',
          breakMinutes: 30,
          sortOrder: 3,
        },
        {
          tenantId: testTenant[0].id,
          code: 'O',
          name: '휴무',
          startTime: '00:00',
          endTime: '00:00',
          duration: 0,
          color: '#E5E7EB',
          breakMinutes: 0,
          sortOrder: 4,
        },
      ])
      .returning();

    console.log(`✅ ${shiftTypes_data.length}개 근무 유형 생성 완료`);
    shiftTypes_data.forEach(shift => {
      console.log(`   - ${shift.name} (${shift.code}): ${shift.startTime} ~ ${shift.endTime}`);
    });
    console.log();

    // 4. 관리자 계정 생성
    const adminUser = await db
      .insert(users)
      .values({
        tenantId: testTenant[0].id,
        departmentId: departments_data[0].id, // 응급실 소속
        clerkUserId: `test_admin_${Date.now()}`,
        email: 'admin@seoul-hospital.com',
        name: '시스템 관리자',
        role: 'admin',
        employeeId: 'ADMIN001',
        position: '시스템 관리자',
        profile: {
          phone: '010-1234-5678',
        },
        status: 'active',
      })
      .returning();

    console.log('✅ 관리자 계정 생성 완료');
    console.log(`   이메일: ${adminUser[0].email}`);
    console.log(`   역할: ${adminUser[0].role}\n`);

    // 5. 각 부서별 테스트 사용자 생성 (각 부서마다 2명씩)
    const testUsersData = [];
    let employeeCounter = 1;

    for (const dept of departments_data) {
      // 수간호사 1명
      testUsersData.push({
        tenantId: testTenant[0].id,
        departmentId: dept.id,
        clerkUserId: `test_manager_${dept.code}_${Date.now()}`,
        email: `manager_${dept.code.toLowerCase()}@seoul-hospital.com`,
        name: `${dept.name} 수간호사`,
        role: 'manager',
        employeeId: `N${String(employeeCounter++).padStart(3, '0')}`,
        position: '수간호사',
        profile: {
          phone: `010-2000-${String(employeeCounter).padStart(4, '0')}`,
          skills: ['Management', 'Training', dept.code],
        },
        status: 'active',
      });

      // 일반 간호사 1명
      testUsersData.push({
        tenantId: testTenant[0].id,
        departmentId: dept.id,
        clerkUserId: `test_nurse_${dept.code}_${Date.now()}`,
        email: `nurse_${dept.code.toLowerCase()}@seoul-hospital.com`,
        name: `${dept.name} 간호사`,
        role: 'member',
        employeeId: `N${String(employeeCounter++).padStart(3, '0')}`,
        position: '간호사',
        profile: {
          phone: `010-3000-${String(employeeCounter).padStart(4, '0')}`,
          skills: [dept.code, 'Patient Care'],
        },
        status: 'active',
      });
    }

    const testUsers = await db
      .insert(users)
      .values(testUsersData)
      .returning();

    console.log(`✅ ${testUsers.length}명 테스트 사용자 생성 완료`);
    console.log(`   - 수간호사: ${testUsers.filter(u => u.role === 'manager').length}명`);
    console.log(`   - 일반 간호사: ${testUsers.filter(u => u.role === 'member').length}명\n`);

    // 6. 결과 요약
    console.log('=' . repeat(60));
    console.log('🎉 데이터베이스 초기화 완료!\n');
    console.log('📋 생성된 데이터 요약:');
    console.log(`   테넌트: ${testTenant[0].name}`);
    console.log(`   시크릿 코드: ${testTenant[0].secretCode}`);
    console.log(`   부서: ${departments_data.length}개`);
    console.log(`   근무 유형: ${shiftTypes_data.length}개`);
    console.log(`   사용자: ${testUsers.length + 1}명 (관리자 1명 포함)\n`);

    console.log('📧 주요 테스트 계정:');
    console.log('   관리자: admin@seoul-hospital.com');
    console.log('   응급실 수간호사: manager_er@seoul-hospital.com');
    console.log('   중환자실 수간호사: manager_icu@seoul-hospital.com');
    console.log('   내과 간호사: nurse_im@seoul-hospital.com\n');

    console.log('🔗 접속 정보:');
    console.log('   가입 URL: http://localhost:3000/join');
    console.log(`   시크릿 코드: ${testTenant[0].secretCode}`);
    console.log('   대시보드: http://localhost:3000/dashboard\n');

    console.log('💡 팁: 시크릿 코드를 사용하여 /join 페이지에서 신규 가입 테스트 가능');
    console.log('=' . repeat(60));

    return {
      tenant: testTenant[0],
      departments: departments_data,
      shiftTypes: shiftTypes_data,
      users: [adminUser[0], ...testUsers],
    };
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
    throw error;
  }
}

// 스크립트 실행
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('\n✨ 초기화 프로세스가 성공적으로 완료되었습니다.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 초기화 중 오류 발생:', error);
      process.exit(1);
    });
}

export { initializeDatabase };