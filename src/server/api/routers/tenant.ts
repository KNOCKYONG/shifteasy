import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { users, departments } from '@/db/schema';
import { eq, and, or, like } from 'drizzle-orm';

export const tenantRouter = createTRPCRouter({
  users: createTRPCRouter({
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

        if (input?.status) {
          conditions.push(eq(users.status, input.status));
        }

        if (input?.departmentId) {
          conditions.push(eq(users.departmentId, input.departmentId));
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