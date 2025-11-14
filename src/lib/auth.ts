/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { type Role, hasPermission, type Permission } from './permissions';
import { TRPCError } from '@trpc/server';
import { ensureNotificationPreferencesColumn } from '@/lib/db/ensureNotificationPreferencesColumn';

/**
 * Get the current authenticated user with tenant context
 */
export async function getCurrentUser() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return null;
  }

  await ensureNotificationPreferencesColumn();

  const [dbUser] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.authUserId, session.user.id),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (!dbUser) {
    return null;
  }

  return {
    ...dbUser,
    supabaseUser: session.user,
  };
}

/**
 * Get user's role within the current organization
 */
export async function getUserRole(): Promise<Role | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return user.role as Role;
}

/**
 * Check if the current user has a specific permission
 */
export async function checkPermission(permission: Permission): Promise<boolean> {
  const role = await getUserRole();

  if (!role) {
    return false;
  }

  return hasPermission(role, permission);
}

/**
 * Require a specific permission or throw an error
 */
export async function requirePermission(permission: Permission): Promise<void> {
  const hasAccess = await checkPermission(permission);

  if (!hasAccess) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Missing required permission: ${permission}`,
    });
  }
}

/**
 * Check if the current user can access a specific resource
 */
export async function canAccessResource(
  resource: string,
  action: string,
  resourceOwnerId?: string
): Promise<boolean> {
  const user = await getCurrentUser();

  if (!user) {
    return false;
  }

  const role = user.role as Role;
  const isOwn = resourceOwnerId === user.id;

  const generalPermission = `${resource}.${action}` as Permission;
  const ownPermission = `${resource}.${action}.own` as Permission;

  if (hasPermission(role, generalPermission)) {
    return true;
  }

  if (isOwn && hasPermission(role, ownPermission)) {
    return true;
  }

  return false;
}

/**
 * Get organization (tenant) members
 */
export async function getOrganizationMembers(orgId: string) {
  await ensureNotificationPreferencesColumn();

  return db
    .select()
    .from(users)
    .where(
      and(
        eq(users.tenantId, orgId),
        isNull(users.deletedAt)
      )
    );
}

/**
 * Update user role
 */
export async function updateUserRole(
  userId: string,
  newRole: Role,
  actorId: string,
  tenantId: string
): Promise<void> {
  await ensureNotificationPreferencesColumn();

  const actor = await db
    .select()
    .from(users)
    .where(eq(users.id, actorId))
    .then(results => results[0]);

  if (!actor) {
    throw new Error('Actor not found');
  }

  if (!hasPermission(actor.role as Role, 'user.role.change')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to change user roles',
    });
  }

  await db
    .update(users)
    .set({
      role: newRole,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      )
    );
}

/**
 * Create a permission checker for tRPC procedures
 */
export function requirePermissionForProcedure(permission: Permission) {
  return async ({ ctx }: any) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to perform this action',
      });
    }

    const role = ctx.user.role as Role;

    if (!hasPermission(role, permission)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Missing required permission: ${permission}`,
      });
    }
  };
}

export type TenantContext = {
  tenantId: string;
  userId: string;
  role: Role;
};

export async function getCurrentTenantContext(): Promise<TenantContext | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return {
    tenantId: user.tenantId,
    userId: user.id,
    role: user.role as Role,
  };
}
