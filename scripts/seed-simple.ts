import { config } from 'dotenv';
import { resolve } from 'path';
import postgres from 'postgres';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  ssl: 'require',
  max: 1
});

async function seedData() {
  console.log('🌱 테스트 데이터 생성 시작...');

  try {
    const tenantId = '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

    // 1. 테넌트 생성
    console.log('🏢 테넌트 생성 중...');
    await client`
      INSERT INTO tenants (id, name, slug, secret_code, plan, settings)
      VALUES (
        ${tenantId},
        '서울대병원',
        'seoul-hospital',
        ${'SH2025-' + Math.random().toString(36).substr(2, 9)},
        'pro',
        ${JSON.stringify({
          timezone: 'Asia/Seoul',
          locale: 'ko',
          maxUsers: 100,
          maxDepartments: 10,
          features: ['schedule', 'swap', 'analytics'],
          signupEnabled: true
        })}::jsonb
      )
      ON CONFLICT (id) DO NOTHING;
    `;

    // 2. 부서 생성
    console.log('📁 부서 생성 중...');
    const departments = [
      { name: '내과병동', code: 'INT' },
      { name: '외과병동', code: 'SUR' },
      { name: '응급실', code: 'ER' },
      { name: '중환자실', code: 'ICU' },
    ];

    for (const dept of departments) {
      await client`
        INSERT INTO departments (tenant_id, name, code)
        VALUES (${tenantId}, ${dept.name}, ${dept.code})
        ON CONFLICT DO NOTHING;
      `;
    }

    // 3. 근무 타입 생성
    console.log('🕐 근무 타입 생성 중...');
    const shiftTypes = [
      { code: 'D', name: '주간', startTime: '07:00', endTime: '15:00', duration: 8, color: '#3B82F6' },
      { code: 'E', name: '저녁', startTime: '15:00', endTime: '23:00', duration: 8, color: '#8B5CF6' },
      { code: 'N', name: '야간', startTime: '23:00', endTime: '07:00', duration: 8, color: '#EF4444' },
      { code: 'OFF', name: '휴무', startTime: '00:00', endTime: '00:00', duration: 0, color: '#6B7280' },
    ];

    for (const shift of shiftTypes) {
      await client`
        INSERT INTO shift_types (tenant_id, code, name, start_time, end_time, duration, color)
        VALUES (
          ${tenantId},
          ${shift.code},
          ${shift.name},
          ${shift.startTime},
          ${shift.endTime},
          ${shift.duration},
          ${shift.color}
        )
        ON CONFLICT DO NOTHING;
      `;
    }

    // 4. 부서 ID 가져오기
    const deptResult = await client`
      SELECT id, code FROM departments WHERE tenant_id = ${tenantId}
    `;
    const deptMap = Object.fromEntries(deptResult.map(d => [d.code, d.id]));

    // 5. 사용자 생성
    console.log('👥 팀원 생성 중...');
    const users = [
      { name: '김간호', email: 'kim.nurse@hospital.com', role: 'admin', dept: 'INT', position: '수간호사', empId: 'EMP001' },
      { name: '이간호', email: 'lee.nurse@hospital.com', role: 'manager', dept: 'INT', position: '책임간호사', empId: 'EMP002' },
      { name: '박간호', email: 'park.nurse@hospital.com', role: 'staff', dept: 'INT', position: '일반간호사', empId: 'EMP003' },
      { name: '최간호', email: 'choi.nurse@hospital.com', role: 'staff', dept: 'SUR', position: '일반간호사', empId: 'EMP004' },
      { name: '정간호', email: 'jung.nurse@hospital.com', role: 'staff', dept: 'ER', position: '응급실간호사', empId: 'EMP005' },
      { name: '강간호', email: 'kang.nurse@hospital.com', role: 'staff', dept: 'INT', position: '일반간호사', empId: 'EMP006', status: 'on_leave' },
      { name: '신간호', email: 'shin.nurse@hospital.com', role: 'staff', dept: 'ICU', position: 'ICU간호사', empId: 'EMP007' },
      { name: '윤간호', email: 'yoon.nurse@hospital.com', role: 'staff', dept: 'SUR', position: '수술실간호사', empId: 'EMP008' },
    ];

    for (const user of users) {
      await client`
        INSERT INTO users (
          tenant_id,
          clerk_user_id,
          email,
          name,
          role,
          status,
          department_id,
          position,
          employee_id,
          profile
        )
        VALUES (
          ${tenantId},
          ${'test-' + user.empId.toLowerCase()},
          ${user.email},
          ${user.name},
          ${user.role},
          ${user.status || 'active'},
          ${deptMap[user.dept]},
          ${user.position},
          ${user.empId},
          ${JSON.stringify({
            phone: '010-' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000),
            experienceYears: Math.floor(Math.random() * 10) + 1,
            seniorityLevel: user.role === 'admin' ? 'senior' : user.role === 'manager' ? 'senior' : 'junior',
            skills: ['환자간호', '약물관리']
          })}::jsonb
        )
        ON CONFLICT DO NOTHING;
      `;
    }

    console.log('✅ 테스트 데이터 생성 완료!');
    console.log(`
    생성된 데이터:
    - 테넌트: 서울대병원 (ID: ${tenantId})
    - 부서: ${departments.length}개
    - 근무 타입: ${shiftTypes.length}개
    - 팀원: ${users.length}명

    📌 TRPC Context에서 사용할 테넌트 ID: ${tenantId}
    `);

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    throw error;
  } finally {
    await client.end();
  }
}

seedData()
  .then(() => {
    console.log('🎉 모든 작업 완료!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 오류:', error);
    process.exit(1);
  });