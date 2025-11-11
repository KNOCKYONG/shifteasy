/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { type Role, hasPermission, type Permission } from './permissions';
import { TRPCError } from '@trpc/server';

/**
 * Get the current authenticated user with organization context
 */
export async function getCurrentUser() {
  const { userId, orgId } = await auth();

  if (!userId) {
    return null;
  }

  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  // Get user from database - first try with orgId if available
  let dbUser;
  if (orgId) {
    [dbUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.clerkUserId, userId),
          eq(users.tenantId, orgId),
          isNull(users.deletedAt)
        )
      );
  } else {
    // If no orgId, try to find user by clerkUserId only
    [dbUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.clerkUserId, userId),
          isNull(users.deletedAt)
        )
      );
  }

  if (!dbUser) {
    return null;
  }

  return {
    ...dbUser,
    clerkUser,
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

  // Build permission strings
  const generalPermission = `${resource}.${action}` as Permission;
  const ownPermission = `${resource}.${action}.own` as Permission;

  // Check permissions
  if (hasPermission(role, generalPermission)) {
    return true;
  }

  if (isOwn && hasPermission(role, ownPermission)) {
    return true;
  }

  return false;
}

/**
 * Sync Clerk user with database
 */
export async function syncClerkUser(clerkUserId: string, orgId: string) {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error('Clerk user not found');
  }

  // Check if user exists in database
  const [existingUser] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.clerkUserId, clerkUserId),
        eq(users.tenantId, orgId)
      )
    );

  if (existingUser) {
    // Update existing user
    await db
      .update(users)
      .set({
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id));

    return existingUser;
  } else {
    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        clerkUserId,
        tenantId: orgId,
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
        role: 'member', // Default role
      })
      .returning();

    return newUser;
  }
}

/**
 * Get organization (tenant) members
 */
export async function getOrganizationMembers(orgId: string) {
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
  // Check if actor has permission to change roles
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

  // Update the user's role
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