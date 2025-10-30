import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '../trpc';
import { scopedDb, createAuditLog } from '@/lib/db-helpers';
import { schedules, users, shiftTypes } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export const scheduleRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      departmentId: z.string().optional(),
      status: z.enum(['draft', 'published', 'archived']).optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      limit: z.number().default(10),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const db = scopedDb(tenantId);

      const conditions = [];
      if (ctx.user?.role === 'member') {
        if (!ctx.user.departmentId) {
          return [];
        }
        conditions.push(eq(schedules.departmentId, ctx.user.departmentId));
        // Members can only see published schedules (not draft or archived)
        conditions.push(eq(schedules.status, 'published'));
      } else if (input.departmentId) {
        conditions.push(eq(schedules.departmentId, input.departmentId));
      }

      // Only apply status filter for non-members (admin/manager can filter by any status)
      if (input.status && ctx.user?.role !== 'member') {
        conditions.push(eq(schedules.status, input.status));
      }
      if (input.startDate) {
        conditions.push(gte(schedules.startDate, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(schedules.endDate, input.endDate));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await db.query(schedules, where);

      return results
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(input.offset, input.offset + input.limit);
    }),

  get: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const db = scopedDb(tenantId);
      const [schedule] = await db.query(schedules, eq(schedules.id, input.id));

      if (!schedule) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found' });
      }

      if (ctx.user?.role === 'member') {
        if (!ctx.user.departmentId || schedule.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '본인 부서의 스케줄만 조회할 수 있습니다.',
          });
        }
        // Members can only see published schedules
        if (schedule.status !== 'published') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '확정된 스케줄만 조회할 수 있습니다.',
          });
        }
      }

      return schedule;
    }),

  generate: protectedProcedure
    .input(z.object({
      name: z.string(),
      departmentId: z.string().optional(),
      patternId: z.string().optional(),
      startDate: z.date(),
      endDate: z.date(),
      constraints: z.object({
        minStaffPerShift: z.number().optional(),
        maxConsecutiveDays: z.number().optional(),
        minRestBetweenShifts: z.number().optional(),
        fairnessWeight: z.number().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      // Check permissions: manager can only generate schedules for their department
      if (ctx.user?.role === 'manager') {
        if (!ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '부서 정보가 없습니다.',
          });
        }
        if (input.departmentId && input.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '담당 부서의 스케줄만 생성할 수 있습니다.',
          });
        }
        // Force departmentId to be the manager's department
        input.departmentId = ctx.user.departmentId;
      } else if (ctx.user?.role === 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '스케줄을 생성할 권한이 없습니다. 관리자 또는 매니저에게 문의하세요.',
        });
      }

      // TODO: Implement scheduling algorithm
      // For now, create a draft schedule
      const [schedule] = await db.insert(schedules, {
        name: input.name,
        departmentId: input.departmentId,
        patternId: input.patternId,
        startDate: input.startDate,
        endDate: input.endDate,
        status: 'draft',
        metadata: {
          generatedBy: (ctx.user?.id || 'dev-user-id'),
          generationMethod: 'manual',
          constraints: input.constraints,
        },
      });

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'schedule.generated',
        entityType: 'schedule',
        entityId: schedule.id,
        after: schedule,
      });

      return schedule;
    }),

  publish: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      const [schedule] = await db.query(schedules, eq(schedules.id, input.id));

      if (!schedule) {
        throw new Error('Schedule not found');
      }

      // Check permissions: manager can only publish schedules for their department
      if (ctx.user?.role === 'manager') {
        if (!ctx.user.departmentId || schedule.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '담당 부서의 스케줄만 확정할 수 있습니다.',
          });
        }
      } else if (ctx.user?.role === 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '스케줄을 확정할 권한이 없습니다. 관리자 또는 매니저에게 문의하세요.',
        });
      }

      const [updated] = await db.update(
        schedules,
        {
          status: 'published',
          publishedAt: new Date(),
          publishedBy: (ctx.user?.id || 'dev-user-id'),
        },
        eq(schedules.id, input.id)
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'schedule.published',
        entityType: 'schedule',
        entityId: schedule.id,
        before: schedule,
        after: updated,
      });

      // TODO: Send notifications to affected users

      return updated;
    }),

  archive: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      // Get schedule to check permissions
      const [schedule] = await db.query(schedules, eq(schedules.id, input.id));

      if (!schedule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        });
      }

      // Check permissions: manager can only archive schedules for their department
      if (ctx.user?.role === 'manager') {
        if (!ctx.user.departmentId || schedule.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '담당 부서의 스케줄만 관리할 수 있습니다.',
          });
        }
      } else if (ctx.user?.role === 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '스케줄을 아카이브할 권한이 없습니다. 관리자 또는 매니저에게 문의하세요.',
        });
      }

      const [updated] = await db.update(
        schedules,
        {
          status: 'archived',
        },
        eq(schedules.id, input.id)
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'schedule.archived',
        entityType: 'schedule',
        entityId: input.id,
        after: updated,
      });

      return updated;
    }),
});
