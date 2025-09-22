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
        const conditions = [
          eq(users.tenantId, ctx.tenantId),
        ];

        // Apply department-based filtering for managers
        // Managers can only see members in their department
        if (ctx.user?.role === 'manager' && ctx.user?.departmentId) {
          conditions.push(eq(users.departmentId, ctx.user.departmentId));
        } else if (input?.departmentId) {
          // For admins and owners, filter by department if requested
          conditions.push(eq(users.departmentId, input.departmentId));
        }

        // Members shouldn't see the team list at all
        if (ctx.user?.role === 'member') {
          return {
            items: [],
            total: 0,
          };
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
          .select()
          .from(users)
          .where(and(...conditions))
          .limit(input?.limit || 50)
          .offset(input?.offset || 0);

        return {
          items: result,
          total: result.length,
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
        // Mock implementation
        return { success: true };
      }),
    
    deactivate: protectedProcedure
      .input(z.object({
        userId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Mock implementation
        return { success: true };
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
              eq(users.tenantId, ctx.tenantId)
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
        const result = await ctx.db
          .select()
          .from(departments)
          .where(eq(departments.tenantId, ctx.tenantId))
          .limit(input?.limit || 50)
          .offset(input?.offset || 0);

        // Get total count
        const countResult = await ctx.db
          .select({ count: departments.id })
          .from(departments)
          .where(eq(departments.tenantId, ctx.tenantId));

        return {
          items: result,
          total: countResult.length,
        };
      }),
  }),
  
  stats: createTRPCRouter({
    summary: protectedProcedure
      .query(async ({ ctx }) => {
        // Get all users for the tenant
        const allUsers = await ctx.db
          .select()
          .from(users)
          .where(eq(users.tenantId, ctx.tenantId));

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