/**
 * 데이터베이스 유틸리티 함수들
 * 데이터 확인, 디버깅, 검증 등의 도구 모음
 */

import { db } from './index';
import { users, tenants, departments } from './schema/tenants';
import { like, eq, sql } from 'drizzle-orm';
import { ensureNotificationPreferencesColumn } from '@/lib/db/ensureNotificationPreferencesColumn';

/**
 * 데이터베이스의 모든 사용자 확인
 */
export async function checkDatabaseUsers() {
  try {
    await ensureNotificationPreferencesColumn();

    const testUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        authUserId: users.authUserId,
        role: users.role,
        tenantId: users.tenantId,
        departmentId: users.departmentId,
      })
      .from(users)
      .where(like(users.email, '%@%'));

    console.log('\n📊 Database Users:');
    console.table(testUsers);

    return testUsers;
  } catch (error) {
    console.error('❌ Error checking database users:', error);
    throw error;
  }
}

/**
 * 모든 테넌트 정보 확인
 */
export async function checkTenants() {
  try {
    const allTenants = await db.select().from(tenants);

    console.log('\n🏢 Tenants:');
    console.table(allTenants.map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      secretCode: t.secretCode,
      plan: t.plan,
      createdAt: t.createdAt,
    })));

    return allTenants;
  } catch (error) {
    console.error('❌ Error checking tenants:', error);
    throw error;
  }
}

/**
 * 특정 테넌트의 부서 확인
 */
export async function checkDepartments(tenantId?: string) {
  try {
    const allDepartments = await db
      .select()
      .from(departments)
      .where(tenantId ? eq(departments.tenantId, tenantId) : undefined);

    console.log('\n🏥 Departments:');
    console.table(allDepartments.map(d => ({
      id: d.id,
      tenantId: d.tenantId,
      name: d.name,
      code: d.code,
      description: d.description,
    })));

    return allDepartments;
  } catch (error) {
    console.error('❌ Error checking departments:', error);
    throw error;
  }
}

/**
 * 데이터베이스 상태 요약
 */
export async function getDatabaseSummary() {
  try {
    await ensureNotificationPreferencesColumn();

    const [tenantCount] = await db
      .select({ count: sql`count(*)` })
      .from(tenants);

    const [userCount] = await db
      .select({ count: sql`count(*)` })
      .from(users);

    const [departmentCount] = await db
      .select({ count: sql`count(*)` })
      .from(departments);

    console.log('\n📈 Database Summary:');
    console.log('=' . repeat(40));
    console.log(`Tenants: ${tenantCount.count}`);
    console.log(`Users: ${userCount.count}`);
    console.log(`Departments: ${departmentCount.count}`);
    console.log('=' . repeat(40));

    return {
      tenants: tenantCount.count,
      users: userCount.count,
      departments: departmentCount.count,
    };
  } catch (error) {
    console.error('❌ Error getting database summary:', error);
    throw error;
  }
}

/**
 * 모든 데이터 확인 (종합)
 */
export async function checkAll() {
  console.log('\n🔍 Checking all database data...\n');

  await getDatabaseSummary();
  await checkTenants();
  await checkDepartments();
  await checkDatabaseUsers();

  console.log('\n🔐 Supabase Auth is the source of truth for user credentials.');
}

// 직접 실행 시
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'users':
      checkDatabaseUsers().then(() => process.exit(0));
      break;
    case 'tenants':
      checkTenants().then(() => process.exit(0));
      break;
    case 'departments':
      checkDepartments().then(() => process.exit(0));
      break;
    case 'summary':
      getDatabaseSummary().then(() => process.exit(0));
      break;
    case 'all':
    default:
      checkAll().then(() => process.exit(0));
      break;
  }
}
