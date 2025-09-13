/**
 * 테넌트 격리 시스템 테스트
 * 테넌트 간 데이터 누출이 없는지 확인
 */

import { createScopedDb, TenantIsolationError } from '@/lib/db/tenant-isolation';
import { db } from '@/db';
import { users, departments, schedules } from '@/db/schema/tenants';
import { eq } from 'drizzle-orm';

/**
 * 테넌트 격리 통합 테스트
 */
export async function runTenantIsolationTests() {
  const results = {
    passed: [] as string[],
    failed: [] as string[],
  };

  console.log('🔒 테넌트 격리 시스템 테스트 시작...\n');

  // 테스트용 테넌트 ID
  const tenant1Id = 'test-tenant-1';
  const tenant2Id = 'test-tenant-2';

  // 테스트 1: 다른 테넌트의 데이터에 접근 시도
  try {
    console.log('Test 1: 크로스 테넌트 접근 차단 테스트');

    const scopedDb1 = createScopedDb({
      tenantId: tenant1Id,
      userId: 'user-1',
      role: 'member',
    });

    // 테넌트 2의 사용자 ID로 접근 시도
    try {
      await scopedDb1.getUserById('user-from-tenant-2');
      results.failed.push('Test 1: 다른 테넌트 사용자 접근이 차단되지 않음');
    } catch (error) {
      if (error instanceof TenantIsolationError) {
        results.passed.push('Test 1: ✅ 크로스 테넌트 접근 차단 성공');
      } else {
        results.failed.push(`Test 1: 예상치 못한 에러: ${error}`);
      }
    }
  } catch (error) {
    results.failed.push(`Test 1 실패: ${error}`);
  }

  // 테스트 2: 데이터 생성 시 테넌트 ID 자동 추가
  try {
    console.log('Test 2: 테넌트 ID 자동 추가 테스트');

    const scopedDb1 = createScopedDb({
      tenantId: tenant1Id,
      userId: 'user-1',
      role: 'admin',
    });

    // 테스트용 부서 생성 (실제로는 모의 데이터 사용 권장)
    const testDepartment = {
      name: 'Test Department',
      code: 'TEST',
      description: 'Test department for isolation testing',
    };

    // create 메서드는 자동으로 tenantId를 추가해야 함
    const created = await scopedDb1.create(departments, testDepartment);

    if (created.tenantId === tenant1Id) {
      results.passed.push('Test 2: ✅ 테넌트 ID 자동 추가 성공');
    } else {
      results.failed.push('Test 2: 테넌트 ID가 올바르게 추가되지 않음');
    }

    // 정리
    await db.delete(departments).where(eq(departments.id, created.id));
  } catch (error) {
    results.failed.push(`Test 2 실패: ${error}`);
  }

  // 테스트 3: 업데이트 시 테넌트 검증
  try {
    console.log('Test 3: 업데이트 시 테넌트 검증 테스트');

    const scopedDb1 = createScopedDb({
      tenantId: tenant1Id,
      userId: 'user-1',
      role: 'admin',
    });

    const scopedDb2 = createScopedDb({
      tenantId: tenant2Id,
      userId: 'user-2',
      role: 'admin',
    });

    // 테넌트 1에 데이터 생성
    const testData = await scopedDb1.create(departments, {
      name: 'Tenant 1 Department',
      code: 'T1D',
    });

    // 테넌트 2에서 테넌트 1의 데이터 업데이트 시도
    try {
      await scopedDb2.update(departments, testData.id, {
        name: 'Hacked Department',
      });
      results.failed.push('Test 3: 다른 테넌트의 데이터 업데이트가 차단되지 않음');
    } catch (error) {
      if (error instanceof TenantIsolationError) {
        results.passed.push('Test 3: ✅ 크로스 테넌트 업데이트 차단 성공');
      } else {
        results.failed.push(`Test 3: 예상치 못한 에러: ${error}`);
      }
    }

    // 정리
    await db.delete(departments).where(eq(departments.id, testData.id));
  } catch (error) {
    results.failed.push(`Test 3 실패: ${error}`);
  }

  // 테스트 4: 삭제 시 테넌트 검증
  try {
    console.log('Test 4: 삭제 시 테넌트 검증 테스트');

    const scopedDb1 = createScopedDb({
      tenantId: tenant1Id,
      userId: 'user-1',
      role: 'admin',
    });

    const scopedDb2 = createScopedDb({
      tenantId: tenant2Id,
      userId: 'user-2',
      role: 'admin',
    });

    // 테넌트 1에 데이터 생성
    const testData = await scopedDb1.create(departments, {
      name: 'Delete Test Department',
      code: 'DTD',
    });

    // 테넌트 2에서 테넌트 1의 데이터 삭제 시도
    try {
      await scopedDb2.delete(departments, testData.id);
      results.failed.push('Test 4: 다른 테넌트의 데이터 삭제가 차단되지 않음');
    } catch (error) {
      if (error instanceof TenantIsolationError) {
        results.passed.push('Test 4: ✅ 크로스 테넌트 삭제 차단 성공');
      } else {
        results.failed.push(`Test 4: 예상치 못한 에러: ${error}`);
      }
    }

    // 정리
    await scopedDb1.delete(departments, testData.id);
  } catch (error) {
    results.failed.push(`Test 4 실패: ${error}`);
  }

  // 테스트 5: 조회 시 테넌트 필터링
  try {
    console.log('Test 5: 조회 시 테넌트 필터링 테스트');

    const scopedDb1 = createScopedDb({
      tenantId: tenant1Id,
      userId: 'user-1',
      role: 'member',
    });

    // 테넌트 1의 사용자만 조회되어야 함
    const users1 = await scopedDb1.getUsers();

    // 모든 사용자가 테넌트 1에 속하는지 확인
    const allFromTenant1 = users1.every(user => user.tenantId === tenant1Id);

    if (allFromTenant1) {
      results.passed.push('Test 5: ✅ 테넌트 필터링 성공');
    } else {
      results.failed.push('Test 5: 다른 테넌트의 데이터가 조회됨');
    }
  } catch (error) {
    results.failed.push(`Test 5 실패: ${error}`);
  }

  // 결과 출력
  console.log('\n' + '='.repeat(50));
  console.log('📊 테스트 결과\n');

  console.log(`✅ 통과: ${results.passed.length}개`);
  results.passed.forEach(msg => console.log(`  ${msg}`));

  if (results.failed.length > 0) {
    console.log(`\n❌ 실패: ${results.failed.length}개`);
    results.failed.forEach(msg => console.log(`  ${msg}`));
  }

  console.log('\n' + '='.repeat(50));

  return {
    success: results.failed.length === 0,
    passed: results.passed.length,
    failed: results.failed.length,
    details: results,
  };
}

/**
 * RBAC 권한 시스템 테스트
 */
export async function runRBACTests() {
  const results = {
    passed: [] as string[],
    failed: [] as string[],
  };

  console.log('🔐 RBAC 권한 시스템 테스트 시작...\n');

  const { PermissionChecker, Permission, Role } = await import('@/lib/auth/rbac');

  // 테스트 1: Owner 권한 테스트
  try {
    console.log('Test 1: Owner 권한 테스트');
    const ownerChecker = new PermissionChecker(Role.OWNER);

    if (ownerChecker.hasPermission(Permission.TENANT_DELETE)) {
      results.passed.push('Test 1: ✅ Owner는 모든 권한 보유');
    } else {
      results.failed.push('Test 1: Owner가 TENANT_DELETE 권한이 없음');
    }
  } catch (error) {
    results.failed.push(`Test 1 실패: ${error}`);
  }

  // 테스트 2: Admin 권한 제한 테스트
  try {
    console.log('Test 2: Admin 권한 제한 테스트');
    const adminChecker = new PermissionChecker(Role.ADMIN);

    const hasUserManage = adminChecker.hasPermission(Permission.USER_CREATE);
    const cannotDeleteTenant = !adminChecker.hasPermission(Permission.TENANT_DELETE);

    if (hasUserManage && cannotDeleteTenant) {
      results.passed.push('Test 2: ✅ Admin 권한 제한 올바름');
    } else {
      results.failed.push('Test 2: Admin 권한이 예상과 다름');
    }
  } catch (error) {
    results.failed.push(`Test 2 실패: ${error}`);
  }

  // 테스트 3: Manager 권한 테스트
  try {
    console.log('Test 3: Manager 권한 테스트');
    const managerChecker = new PermissionChecker(Role.MANAGER);

    const canReadSchedule = managerChecker.hasPermission(Permission.SCHEDULE_READ);
    const cannotDeleteUser = !managerChecker.hasPermission(Permission.USER_DELETE);

    if (canReadSchedule && cannotDeleteUser) {
      results.passed.push('Test 3: ✅ Manager 권한 올바름');
    } else {
      results.failed.push('Test 3: Manager 권한이 예상과 다름');
    }
  } catch (error) {
    results.failed.push(`Test 3 실패: ${error}`);
  }

  // 테스트 4: Member 기본 권한 테스트
  try {
    console.log('Test 4: Member 기본 권한 테스트');
    const memberChecker = new PermissionChecker(Role.MEMBER);

    const canReadSchedule = memberChecker.hasPermission(Permission.SCHEDULE_READ);
    const cannotPublishSchedule = !memberChecker.hasPermission(Permission.SCHEDULE_PUBLISH);
    const canCreateSwap = memberChecker.hasPermission(Permission.SWAP_CREATE);

    if (canReadSchedule && cannotPublishSchedule && canCreateSwap) {
      results.passed.push('Test 4: ✅ Member 권한 올바름');
    } else {
      results.failed.push('Test 4: Member 권한이 예상과 다름');
    }
  } catch (error) {
    results.failed.push(`Test 4 실패: ${error}`);
  }

  // 테스트 5: 역할 계층 테스트
  try {
    console.log('Test 5: 역할 계층 테스트');
    const adminChecker = new PermissionChecker(Role.ADMIN);

    const isHigherThanManager = adminChecker.isHigherOrEqualRole(Role.MANAGER);
    const isNotHigherThanOwner = !adminChecker.isHigherOrEqualRole(Role.OWNER);

    if (isHigherThanManager && isNotHigherThanOwner) {
      results.passed.push('Test 5: ✅ 역할 계층 올바름');
    } else {
      results.failed.push('Test 5: 역할 계층이 예상과 다름');
    }
  } catch (error) {
    results.failed.push(`Test 5 실패: ${error}`);
  }

  // 결과 출력
  console.log('\n' + '='.repeat(50));
  console.log('📊 테스트 결과\n');

  console.log(`✅ 통과: ${results.passed.length}개`);
  results.passed.forEach(msg => console.log(`  ${msg}`));

  if (results.failed.length > 0) {
    console.log(`\n❌ 실패: ${results.failed.length}개`);
    results.failed.forEach(msg => console.log(`  ${msg}`));
  }

  console.log('\n' + '='.repeat(50));

  return {
    success: results.failed.length === 0,
    passed: results.passed.length,
    failed: results.failed.length,
    details: results,
  };
}

/**
 * 모든 테스트 실행
 */
export async function runAllTests() {
  console.log('🚀 멀티테넌시 시스템 전체 테스트 시작\n');
  console.log('='.repeat(50) + '\n');

  const tenantResults = await runTenantIsolationTests();
  console.log('\n');
  const rbacResults = await runRBACTests();

  console.log('\n' + '='.repeat(50));
  console.log('📈 전체 테스트 요약\n');
  console.log(`테넌트 격리: ${tenantResults.passed}/${tenantResults.passed + tenantResults.failed} 통과`);
  console.log(`RBAC 권한: ${rbacResults.passed}/${rbacResults.passed + rbacResults.failed} 통과`);

  const totalPassed = tenantResults.passed + rbacResults.passed;
  const totalFailed = tenantResults.failed + rbacResults.failed;

  console.log(`\n전체: ${totalPassed}/${totalPassed + totalFailed} 통과`);

  if (totalFailed === 0) {
    console.log('\n🎉 모든 테스트 통과!');
  } else {
    console.log(`\n⚠️  ${totalFailed}개 테스트 실패`);
  }

  console.log('='.repeat(50));

  return {
    success: totalFailed === 0,
    summary: {
      tenantIsolation: tenantResults,
      rbac: rbacResults,
      total: {
        passed: totalPassed,
        failed: totalFailed,
      },
    },
  };
}