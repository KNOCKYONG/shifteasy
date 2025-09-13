import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '@/server/trpc';
import { scopedDb, createAuditLog } from '@/lib/db-helpers';
import { assignments, schedules, shiftTypes } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export const assignmentRouter = createTRPCRouter({
  listByUser: protectedProcedure
    .input(z.object({
      userId: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      scheduleId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = scopedDb(ctx.tenantId || 'dev-org-id');
      const userId = input.userId || ctx.user?.id || 'dev-user-id';

      let conditions = [eq(assignments.userId, userId)];

      if (input.scheduleId) {
        conditions.push(eq(assignments.scheduleId, input.scheduleId));
      }
      if (input.startDate) {
        conditions.push(gte(assignments.date, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(assignments.date, input.endDate));
      }

      const results = await db.query(assignments, and(...conditions));

      return results.sort((a, b) => a.date.getTime() - b.date.getTime());
    }),

  update: adminProcedure
    .input(z.object({
      id: z.string(),
      userId: z.string().optional(),
      shiftTypeId: z.string().optional(),
      date: z.date().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

      const { id, ...updateData } = input;

      const [before] = await db.query(assignments, eq(assignments.id, id));

      if (!before) {
        throw new Error('Assignment not found');
      }

      const [after] = await db.update(
        assignments,
        updateData,
        eq(assignments.id, id)
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || 'dev-org-id'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'assignment.updated',
        entityType: 'assignment',
        entityId: id,
        before,
        after,
      });

      return after;
    }),

  lock: adminProcedure
    .input(z.object({
      id: z.string(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

      const [updated] = await db.update(
        assignments,
        {
          isLocked: true,
          lockedBy: (ctx.user?.id || 'dev-user-id'),
          lockedAt: new Date(),
          lockedReason: input.reason,
        },
        eq(assignments.id, input.id)
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || 'dev-org-id'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'assignment.locked',
        entityType: 'assignment',
        entityId: input.id,
        after: updated,
        metadata: { reason: input.reason },
      });

      return updated;
    }),

  unlock: adminProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

      const [updated] = await db.update(
        assignments,
        {
          isLocked: false,
          lockedBy: null,
          lockedAt: null,
          lockedReason: null,
        },
        eq(assignments.id, input.id)
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || 'dev-org-id'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'assignment.unlocked',
        entityType: 'assignment',
        entityId: input.id,
        after: updated,
      });

      return updated;
    }),

  bulkCreate: adminProcedure
    .input(z.object({
      scheduleId: z.string(),
      assignments: z.array(z.object({
        userId: z.string(),
        shiftTypeId: z.string(),
        date: z.date(),
        notes: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

      const created = await db.insert(
        assignments,
        input.assignments.map(a => ({
          ...a,
          scheduleId: input.scheduleId,
        }))
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || 'dev-org-id'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'assignments.bulk_created',
        entityType: 'schedule',
        entityId: input.scheduleId,
        after: { count: created.length },
      });

      return created;
    }),
});