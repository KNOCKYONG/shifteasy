import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { db } from '@/db';
import { holidays } from '@/db/schema/holidays';
import { eq, and, gte, lte, between, or, isNull } from 'drizzle-orm';

export const holidaysRouter = createTRPCRouter({
  // Get all holidays for a specific month or date range
  getByDateRange: protectedProcedure
    .input(z.object({
      startDate: z.string(), // YYYY-MM-DD
      endDate: z.string(), // YYYY-MM-DD
    }))
    .query(async ({ ctx, input }) => {
      const userTenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Get holidays: global (tenant_id IS NULL) OR tenant-specific
      const result = await db.select()
        .from(holidays)
        .where(and(
          between(holidays.date, input.startDate, input.endDate),
          or(
            isNull(holidays.tenantId), // Global holidays
            eq(holidays.tenantId, userTenantId) // Tenant-specific holidays
          )
        ))
        .orderBy(holidays.date);

      return result;
    }),

  // Get all holidays
  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const userTenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Return global holidays + tenant-specific holidays
      const result = await db.select()
        .from(holidays)
        .where(or(
          isNull(holidays.tenantId), // Global holidays
          eq(holidays.tenantId, userTenantId) // Tenant-specific holidays
        ))
        .orderBy(holidays.date);

      return result;
    }),

  // Create a new holiday
  create: protectedProcedure
    .input(z.object({
      date: z.string(), // YYYY-MM-DD
      name: z.string(),
      isRecurring: z.boolean().optional(),
      isGlobal: z.boolean().optional(), // If true, creates global holiday (tenant_id = NULL)
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = input.isGlobal ? null : (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d');

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

      // Delete only if it belongs to the tenant (or is global and user has permission)
      await db.delete(holidays)
        .where(and(
          eq(holidays.id, input.id),
          or(
            eq(holidays.tenantId, tenantId), // Tenant-specific
            isNull(holidays.tenantId) // Global (only admins should be able to delete)
          )
        ));

      return { success: true };
    }),
});
