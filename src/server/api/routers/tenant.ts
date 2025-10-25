import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { users, departments } from '@/db/schema';
import { eq, and, or, like } from 'drizzle-orm';

export const tenantRouter = createTRPCRouter({
  users: createTRPCRouter({
    current: protectedProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user) {
          throw new Error('User not found');
        }
        return ctx.user;
      }),

    list: protectedProcedure
      .input(z.object({
        status: z.enum(['active', 'on_leave']).optional(),
        role: z.enum(['admin', 'manager', 'member']).optional(),
        departmentId: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.tenantId;
        if (!tenantId) {
          throw new Error('Tenant not found');
        }

        const conditions = [
          eq(users.tenantId, tenantId),
        ];

        // Apply department-based filtering
        if (ctx.user?.role === 'manager' && ctx.user?.departmentId) {
          // Managers can only see members in their department
          conditions.push(eq(users.departmentId, ctx.user.departmentId));
        } else if (ctx.user?.role === 'admin') {
          // Admins can see all users in the tenant, optionally filter by department
          if (input?.departmentId) {
            conditions.push(eq(users.departmentId, input.departmentId));
          }
          // No department filter = see all users in tenant
        } else if (input?.departmentId) {
          // For other roles, filter by department if requested
          conditions.push(eq(users.departmentId, input.departmentId));
        }

        // Members can only see themselves (for preferences settings)
        if (ctx.user?.role === 'member') {
          conditions.push(eq(users.id, ctx.user.id));
        }

        if (input?.status) {
          conditions.push(eq(users.status, input.status));
        }

        if (input?.role) {
          conditions.push(eq(users.role, input.role));
        }

        if (input?.search) {
          conditions.push(
            or(
              like(users.name, `%${input.search}%`),
              like(users.email, `%${input.search}%`)
            ) || eq(users.id, 'never')
          );
        }

        const result = await ctx.db
          .select({
            id: users.id,
            tenantId: users.tenantId,
            departmentId: users.departmentId,
            clerkUserId: users.clerkUserId,
            email: users.email,
            name: users.name,
            role: users.role,
            employeeId: users.employeeId,
            position: users.position,
            profile: users.profile,
            status: users.status,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
            deletedAt: users.deletedAt,
            department: {
              id: departments.id,
              name: departments.name,
              code: departments.code,
            },
          })
          .from(users)
          .leftJoin(departments, eq(users.departmentId, departments.id))
          .where(and(...conditions))
          .limit(input?.limit || 50)
          .offset(input?.offset || 0);

        const filteredResult = ctx.user?.role === 'manager'
          ? result.filter(user => {
              if (user.id === ctx.user?.id) {
                return true;
              }
              return user.role === 'member';
            })
          : result;

        return {
          items: filteredResult,
          total: filteredResult.length,
        };
      }),
    
    invite: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string(),
        role: z.enum(['admin', 'manager', 'member']).default('member'),
        departmentId: z.string().optional(),
        employeeId: z.string(),
        position: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role === 'manager') {
          throw new Error('권한이 없습니다. 매니저는 팀원을 직접 추가할 수 없습니다.');
        }
        // Mock implementation
        return { success: true };
      }),

    deactivate: protectedProcedure
      .input(z.object({
        userId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.tenantId;
        if (!tenantId) {
          throw new Error('Tenant not found');
        }

        const target = await ctx.db
          .select()
          .from(users)
          .where(
            and(
              eq(users.id, input.userId),
              eq(users.tenantId, tenantId)
            )
          )
          .limit(1);

        if (!target || target.length === 0) {
          throw new Error('사용자를 찾을 수 없습니다.');
        }

        const targetUser = target[0];

        if (ctx.user?.role === 'manager') {
          if (!ctx.user.departmentId || targetUser.departmentId !== ctx.user.departmentId) {
            throw new Error('권한이 없습니다. 담당 병동 팀원만 관리할 수 있습니다.');
          }
          if (['owner', 'admin', 'manager'].includes(targetUser.role) && targetUser.id !== ctx.user.id) {
            throw new Error('권한이 없습니다. 관리자 계정은 수정할 수 없습니다.');
          }
        }

        const [updated] = await ctx.db
          .update(users)
          .set({
            status: 'inactive',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(users.id, input.userId),
              eq(users.tenantId, tenantId)
            )
          )
          .returning();

        if (!updated) {
          throw new Error('사용자 상태를 업데이트할 수 없습니다.');
        }

        return { success: true, user: updated };
      }),

    updatePosition: protectedProcedure
      .input(z.object({
        userId: z.string(),
        position: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if user has permission (owner, admin, or manager)
        const currentUserRole = ctx.user?.role;
        if (!currentUserRole || !['owner', 'admin', 'manager'].includes(currentUserRole)) {
          throw new Error('권한이 없습니다. 관리자 또는 매니저만 직급을 변경할 수 있습니다.');
        }

        const tenantId = ctx.tenantId;
        if (!tenantId) {
          throw new Error('Tenant not found');
        }

        const existing = await ctx.db
          .select()
          .from(users)
          .where(
            and(
              eq(users.id, input.userId),
              eq(users.tenantId, tenantId)
            )
          )
          .limit(1);

        if (!existing || existing.length === 0) {
          throw new Error('사용자를 찾을 수 없습니다.');
        }

        const targetUser = existing[0];

        if (currentUserRole === 'manager') {
          if (!ctx.user?.departmentId || targetUser.departmentId !== ctx.user.departmentId) {
            throw new Error('권한이 없습니다. 담당 병동 팀원만 관리할 수 있습니다.');
          }
          if (['owner', 'admin', 'manager'].includes(targetUser.role) && targetUser.id !== ctx.user.id) {
            throw new Error('권한이 없습니다. 관리자 계정은 수정할 수 없습니다.');
          }
        }

        // Update user position in database
        const result = await ctx.db
          .update(users)
          .set({
            position: input.position,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(users.id, input.userId),
              eq(users.tenantId, tenantId)
            )
          )
          .returning();

        if (!result || result.length === 0) {
          throw new Error('사용자를 찾을 수 없습니다.');
        }

        return {
          success: true,
          user: result[0]
        };
      }),
  }),
  
  departments: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.tenantId;
        if (!tenantId) {
          throw new Error('Tenant not found');
        }

        const result = await ctx.db
          .select()
          .from(departments)
          .where(eq(departments.tenantId, tenantId))
          .limit(input?.limit || 50)
          .offset(input?.offset || 0);

        // Get total count
        const countResult = await ctx.db
          .select({ count: departments.id })
          .from(departments)
          .where(eq(departments.tenantId, tenantId));

        return {
          items: result,
          total: countResult.length,
        };
      }),
  }),
  
  stats: createTRPCRouter({
    summary: protectedProcedure
      .query(async ({ ctx }) => {
        const tenantId = ctx.tenantId;
        if (!tenantId) {
          throw new Error('Tenant not found');
        }
        // Get all users for the tenant
        const allUsers = await ctx.db
          .select()
          .from(users)
          .where(eq(users.tenantId, tenantId));

        // Count active users
        const activeUsers = allUsers.filter(user => user.status === 'active');

        // Count users on leave
        const onLeaveUsers = allUsers.filter(user => user.status === 'on_leave');

        return {
          users: allUsers.length,
          active: activeUsers.length,
          onLeave: onLeaveUsers.length,
        };
      }),
  }),
});
