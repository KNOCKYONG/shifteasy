import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '../trpc';
import { scopedDb, createAuditLog } from '@/lib/db-helpers';
import { schedules, assignments, users, shiftTypes } from '@/db/schema';
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
      } else if (input.departmentId) {
        conditions.push(eq(schedules.departmentId, input.departmentId));
      }
      if (input.status) {
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
      }

      return schedule;
    }),

  generate: adminProcedure
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

  publish: adminProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      const [schedule] = await db.query(schedules, eq(schedules.id, input.id));

      if (!schedule) {
        throw new Error('Schedule not found');
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

  archive: adminProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

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
