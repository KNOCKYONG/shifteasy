import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { users, departments, nursePreferences } from '@/db/schema';
import { eq, and, or, like, sql } from 'drizzle-orm';
import { sse } from '@/lib/sse/broadcaster';

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
        includeDetails: z.boolean().optional(),
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
        } else if (ctx.user?.role === 'member' && ctx.user?.departmentId) {
          // Members can see all users in their department
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

        // Default to false for better performance - most list views don't need detailed info
        const includeDetails = input?.includeDetails ?? false;

        const baseSelection = {
          id: users.id,
          tenantId: users.tenantId,
          departmentId: users.departmentId,
          teamId: users.teamId,
          clerkUserId: users.clerkUserId,
          email: users.email,
          name: users.name,
          role: users.role,
          employeeId: users.employeeId,
          position: users.position,
          status: users.status,
          hireDate: users.hireDate,
          yearsOfService: users.yearsOfService,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          deletedAt: users.deletedAt,
          department: {
            id: departments.id,
            name: departments.name,
            code: departments.code,
          },
          profile: sql`NULL`.as('profile'),
          workPatternType: sql`NULL`.as('workPatternType'),
        };

        const detailedSelection = {
          ...baseSelection,
          profile: users.profile,
          workPatternType: nursePreferences.workPatternType,
        };

        // Optimize query: only join nursePreferences when includeDetails is true
        let query = ctx.db
          .select(includeDetails ? detailedSelection : baseSelection)
          .from(users)
          .leftJoin(departments, eq(users.departmentId, departments.id));

        // Only add nursePreferences join if details are needed
        if (includeDetails) {
          query = query.leftJoin(nursePreferences, eq(users.id, nursePreferences.nurseId)) as typeof query;
        }

        const result = await query
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
        // 매니저 권한 체크
        if (ctx.user?.role === 'manager') {
          // 매니저는 member 역할만 추가 가능
          if (input.role !== 'member') {
            throw new Error('권한이 없습니다. 매니저는 일반 팀원만 추가할 수 있습니다.');
          }
          // 매니저는 자기 부서에만 팀원 추가 가능
          if (!ctx.user.departmentId) {
            throw new Error('부서 정보가 없습니다.');
          }
          if (!input.departmentId || input.departmentId !== ctx.user.departmentId) {
            throw new Error('권한이 없습니다. 담당 부서에만 팀원을 추가할 수 있습니다.');
          }
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

    activate: protectedProcedure
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
            status: 'active',
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

    update: protectedProcedure
      .input(z.object({
        userId: z.string(),
        teamId: z.string().nullable().optional(),
        departmentId: z.string().optional(),
        position: z.string().optional(),
        name: z.string().optional(),
        employeeId: z.string().optional(),
        phone: z.string().optional(),
        status: z.enum(['active', 'inactive', 'on_leave']).optional(),
        hireDate: z.date().optional(),
        yearsOfService: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if user has permission (owner, admin, or manager)
        const currentUserRole = ctx.user?.role;
        if (!currentUserRole || !['owner', 'admin', 'manager'].includes(currentUserRole)) {
          throw new Error('권한이 없습니다. 관리자 또는 매니저만 사용자 정보를 변경할 수 있습니다.');
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

        // Build update object with only provided fields
        const updateData: {
          updatedAt: Date;
          teamId?: string | null;
          departmentId?: string;
          position?: string;
          name?: string;
          employeeId?: string;
          status?: 'active' | 'inactive' | 'on_leave';
          hireDate?: Date;
          yearsOfService?: number;
          profile?: Record<string, unknown>;
        } = {
          updatedAt: new Date()
        };

        if (input.teamId !== undefined) updateData.teamId = input.teamId;
        if (input.departmentId !== undefined) updateData.departmentId = input.departmentId;
        if (input.position !== undefined) updateData.position = input.position;
        if (input.name !== undefined) updateData.name = input.name;
        if (input.employeeId !== undefined) updateData.employeeId = input.employeeId;
        if (input.status !== undefined) updateData.status = input.status;
        if (input.hireDate !== undefined) updateData.hireDate = input.hireDate;
        if (input.yearsOfService !== undefined) updateData.yearsOfService = input.yearsOfService;

        // Handle profile update for phone
        if (input.phone !== undefined) {
          const currentProfile = targetUser.profile || {};
          updateData.profile = {
            ...currentProfile,
            phone: input.phone,
          };
        }

        // Update user in database
        const result = await ctx.db
          .update(users)
          .set(updateData)
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

        const updatedUser = result[0];

        try {
          const changedFields = Object.keys(updateData).filter(field => field !== 'updatedAt');
          if (updateData.profile) {
            changedFields.push('profile');
          }

          sse.staff.updated(input.userId, {
            departmentId: updatedUser.departmentId || undefined,
            fields: changedFields,
            changes: updateData,
            tenantId,
          });

          if (updateData.hireDate !== undefined || updateData.yearsOfService !== undefined) {
            sse.staff.careerUpdated(input.userId, {
              departmentId: updatedUser.departmentId || undefined,
              careerInfo: {
                hireYear: updateData.hireDate ? updateData.hireDate.getFullYear() : undefined,
                yearsOfService: updateData.yearsOfService,
              },
              tenantId,
            });
          }
        } catch (sseError) {
          console.error('[tenant.users.update] Failed to broadcast SSE event', sseError);
        }

        return {
          success: true,
          user: updatedUser
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
