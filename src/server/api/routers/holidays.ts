import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { db } from '@/db';
import { holidays } from '@/db/schema/holidays';
import { eq, and, gte, lte, between } from 'drizzle-orm';

export const holidaysRouter = createTRPCRouter({
  // Get all holidays for a specific month or date range
  getByDateRange: protectedProcedure
    .input(z.object({
      startDate: z.string(), // YYYY-MM-DD
      endDate: z.string(), // YYYY-MM-DD
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const result = await db.select()
        .from(holidays)
        .where(and(
          eq(holidays.tenantId, tenantId),
          between(holidays.date, input.startDate, input.endDate)
        ))
        .orderBy(holidays.date);

      return result;
    }),

  // Get all holidays
  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const result = await db.select()
        .from(holidays)
        .where(eq(holidays.tenantId, tenantId))
        .orderBy(holidays.date);

      return result;
    }),

  // Create a new holiday
  create: protectedProcedure
    .input(z.object({
      date: z.string(), // YYYY-MM-DD
      name: z.string(),
      isRecurring: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const result = await db.insert(holidays)
        .values({
          tenantId,
          date: input.date,
          name: input.name,
          isRecurring: input.isRecurring ?? false,
        })
        .returning();

      return result[0];
    }),

  // Delete a holiday
  delete: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      await db.delete(holidays)
        .where(and(
          eq(holidays.id, input.id),
          eq(holidays.tenantId, tenantId)
        ));

      return { success: true };
    }),
});
