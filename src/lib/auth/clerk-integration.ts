import { currentUser, auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, tenants } from '@/db/schema/tenants';
import { eq, and } from 'drizzle-orm';
import { createScopedDb, type TenantContext } from '@/lib/db/tenant-isolation';

/**
 * Clerk 사용자와 데이터베이스 사용자 동기화
 */
export async function syncClerkUser() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error('No authenticated user');
  }

  // Organization (테넌트) 정보 가져오기
  const { orgId, orgSlug, orgRole } = await auth();

  if (!orgId) {
    throw new Error('No organization selected');
  }

  // 테넌트 찾기 또는 생성
  let tenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, orgSlug || orgId))
    .limit(1);

  if (tenant.length === 0) {
    // 새 테넌트 생성
    const orgDetails = await clerkClient().organizations.getOrganization({
      organizationId: orgId,
    });

    tenant = await db
      .insert(tenants)
      .values({
        name: orgDetails.name,
        slug: orgSlug || orgId,
        plan: 'free',
        settings: {
          timezone: 'Asia/Seoul',
          locale: 'ko',
          maxUsers: 10,
          maxDepartments: 3,
          features: [],
        },
      })
      .returning();
  }

  const tenantId = tenant[0].id;

  // 사용자 찾기 또는 생성
  let user = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.clerkUserId, clerkUser.id),
        eq(users.tenantId, tenantId)
      )
    )
    .limit(1);

  if (user.length === 0) {
    // 새 사용자 생성
    user = await db
      .insert(users)
      .values({
        clerkUserId: clerkUser.id,
        tenantId,
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
              clerkUser.username ||
              'Unknown User',
        role: mapClerkRoleToAppRole(orgRole),
        profile: {
          avatar: clerkUser.imageUrl,
        },
        status: 'active',
      })
      .returning();
  } else {
    // 기존 사용자 정보 업데이트
    user = await db
      .update(users)
      .set({
        email: clerkUser.emailAddresses[0]?.emailAddress || user[0].email,
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
              user[0].name,
        role: mapClerkRoleToAppRole(orgRole),
        profile: {
          ...user[0].profile,
          avatar: clerkUser.imageUrl,
        },
        updatedAt: new Date(),
      })
      .where(eq(users.id, user[0].id))
      .returning();
  }

  return {
    user: user[0],
    tenant: tenant[0],
    context: {
      tenantId,
      userId: user[0].id,
      role: user[0].role,
    } as TenantContext,
  };
}

/**
 * Clerk Organization 역할을 애플리케이션 역할로 매핑
 */
function mapClerkRoleToAppRole(clerkRole?: string | null): string {
  switch (clerkRole) {
    case 'org:admin':
      return 'admin';
    case 'org:owner':
      return 'owner';
    case 'org:manager':
      return 'manager';
    default:
      return 'member';
  }
}

/**
 * 현재 사용자의 테넌트 컨텍스트 가져오기
 */
export async function getCurrentTenantContext(): Promise<TenantContext | null> {
  try {
    const result = await syncClerkUser();
    return result.context;
  } catch (error) {
    console.error('Failed to get tenant context:', error);
    return null;
  }
}

/**
 * 현재 사용자의 scopedDb 인스턴스 생성
 */
export async function getCurrentScopedDb() {
  const context = await getCurrentTenantContext();

  if (!context) {
    throw new Error('No tenant context available');
  }

  return createScopedDb(context);
}

/**
 * 사용자가 특정 리소스에 접근할 수 있는지 확인
 */
export async function canAccessResource(
  resourceType: string,
  resourceId: string
): Promise<boolean> {
  try {
    const scopedDb = await getCurrentScopedDb();

    // 리소스 타입에 따라 다른 테이블 검증
    switch (resourceType) {
      case 'user':
        return await scopedDb.validateAccess(users, resourceId);
      case 'department':
        const { departments } = await import('@/db/schema/tenants');
        return await scopedDb.validateAccess(departments, resourceId);
      case 'schedule':
        const { schedules } = await import('@/db/schema/tenants');
        return await scopedDb.validateAccess(schedules, resourceId);
      default:
        return false;
    }
  } catch (error) {
    console.error('Access validation error:', error);
    return false;
  }
}

/**
 * Clerk Webhook을 통한 사용자 이벤트 처리
 */
export async function handleClerkWebhook(event: any) {
  switch (event.type) {
    case 'user.created':
      // 사용자 생성 시 처리
      break;

    case 'user.updated':
      // 사용자 정보 업데이트
      await updateUserFromClerk(event.data);
      break;

    case 'user.deleted':
      // 사용자 삭제 처리 (soft delete)
      await softDeleteUser(event.data.id);
      break;

    case 'organizationMembership.created':
      // 조직에 새 멤버 추가
      await addOrganizationMember(event.data);
      break;

    case 'organizationMembership.updated':
      // 멤버 역할 변경
      await updateMemberRole(event.data);
      break;

    case 'organizationMembership.deleted':
      // 조직에서 멤버 제거
      await removeOrganizationMember(event.data);
      break;
  }
}

/**
 * Clerk 사용자 정보로 DB 업데이트
 */
async function updateUserFromClerk(clerkUserData: any) {
  await db
    .update(users)
    .set({
      email: clerkUserData.email_addresses[0]?.email_address,
      name: `${clerkUserData.first_name || ''} ${clerkUserData.last_name || ''}`.trim(),
      updatedAt: new Date(),
    })
    .where(eq(users.clerkUserId, clerkUserData.id));
}

/**
 * 사용자 Soft Delete
 */
async function softDeleteUser(clerkUserId: string) {
  await db
    .update(users)
    .set({
      deletedAt: new Date(),
      status: 'inactive',
    })
    .where(eq(users.clerkUserId, clerkUserId));
}

/**
 * 조직에 멤버 추가
 */
async function addOrganizationMember(membershipData: any) {
  const tenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, membershipData.organization.slug))
    .limit(1);

  if (tenant.length === 0) return;

  // 사용자 생성 또는 업데이트
  await db
    .insert(users)
    .values({
      clerkUserId: membershipData.public_user_data.user_id,
      tenantId: tenant[0].id,
      email: membershipData.public_user_data.email_addresses[0]?.email_address || '',
      name: `${membershipData.public_user_data.first_name || ''} ${membershipData.public_user_data.last_name || ''}`.trim(),
      role: mapClerkRoleToAppRole(membershipData.role),
      status: 'active',
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        tenantId: tenant[0].id,
        role: mapClerkRoleToAppRole(membershipData.role),
        status: 'active',
        updatedAt: new Date(),
      },
    });
}

/**
 * 멤버 역할 업데이트
 */
async function updateMemberRole(membershipData: any) {
  const tenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, membershipData.organization.slug))
    .limit(1);

  if (tenant.length === 0) return;

  await db
    .update(users)
    .set({
      role: mapClerkRoleToAppRole(membershipData.role),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(users.clerkUserId, membershipData.public_user_data.user_id),
        eq(users.tenantId, tenant[0].id)
      )
    );
}

/**
 * 조직에서 멤버 제거
 */
async function removeOrganizationMember(membershipData: any) {
  const tenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, membershipData.organization.slug))
    .limit(1);

  if (tenant.length === 0) return;

  // Soft delete
  await db
    .update(users)
    .set({
      deletedAt: new Date(),
      status: 'inactive',
    })
    .where(
      and(
        eq(users.clerkUserId, membershipData.public_user_data.user_id),
        eq(users.tenantId, tenant[0].id)
      )
    );
}