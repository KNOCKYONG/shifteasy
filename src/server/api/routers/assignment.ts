import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '@/server/trpc';
import { createAuditLog } from '@/lib/db-helpers';
import { db } from '@/db';
import { assignments } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export const assignmentRouter = createTRPCRouter({
  listByUser: protectedProcedure
    .input(z.object({
      staffId: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      scheduleId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {

      let conditions = [];

      if (input.staffId) {
        conditions.push(eq(assignments.staffId, input.staffId));
      }
      if (input.scheduleId) {
        conditions.push(eq(assignments.scheduleId, input.scheduleId));
      }
      if (input.startDate) {
        conditions.push(gte(assignments.date, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(assignments.date, input.endDate));
      }

      const results = conditions.length > 0
        ? await db.select().from(assignments).where(and(...conditions))
        : await db.select().from(assignments);

      return results.sort((a, b) => a.date.getTime() - b.date.getTime());
    }),

  update: adminProcedure
    .input(z.object({
      id: z.string(),
      staffId: z.string().optional(),
      shiftId: z.string().optional(),
      date: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [before] = await db.select().from(assignments).where(eq(assignments.id, id));

      const [after] = await db
        .update(assignments)
        .set(updates)
        .where(eq(assignments.id, id))
        .returning();

      await createAuditLog({
        tenantId: ctx.tenantId || 'dev-org-id',
        actorId: ctx.user?.id,
        action: 'assignment.updated',
        entityType: 'assignment',
        entityId: id,
        before,
        after,
      });

      return after;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {

      const [deleted] = await db
        .delete(assignments)
        .where(eq(assignments.id, input.id))
        .returning();

      await createAuditLog({
        tenantId: ctx.tenantId || 'dev-org-id',
        actorId: ctx.user?.id,
        action: 'assignment.deleted',
        entityType: 'assignment',
        entityId: input.id,
        before: deleted,
      });

      return { success: true };
    }),

  approve: adminProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(['approved', 'rejected']),
    }))
    .mutation(async ({ ctx, input }) => {

      const [after] = await db
        .update(assignments)
        .set({ isOvertime: input.status === 'approved' })
        .where(eq(assignments.id, input.id))
        .returning();

      await createAuditLog({
        tenantId: ctx.tenantId || 'dev-org-id',
        actorId: ctx.user?.id,
        action: `assignment.${input.status}`,
        entityType: 'assignment',
        entityId: input.id,
        after,
      });

      return after;
    }),

  bulkCreate: adminProcedure
    .input(z.object({
      scheduleId: z.string(),
      assignments: z.array(z.object({
        staffId: z.string(),
        shiftId: z.string(),
        date: z.date(),
        isOvertime: z.boolean().optional(),
        isReplacement: z.boolean().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {

      const results = await db
        .insert(assignments)
        .values(input.assignments.map(a => ({
            ...a,
            scheduleId: input.scheduleId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })))
        .returning();

      await createAuditLog({
        tenantId: ctx.tenantId || 'dev-org-id',
        actorId: ctx.user?.id,
        action: 'assignments.bulk_created',
        entityType: 'schedule',
        entityId: input.scheduleId,
        after: { count: results.length },
      });

      return results;
    }),
});