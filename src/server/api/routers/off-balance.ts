import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { offBalanceLedger, nursePreferences } from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

export const offBalanceRouter = createTRPCRouter({
  // Get off-balance data for a specific employee
  getByEmployee: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
      limit: z.number().min(1).max(100).default(12), // Last 12 months by default
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId;
      if (!tenantId) {
        throw new Error('Tenant not found');
      }

      // Get nurse preferences (guaranteed off days & current balance)
      const [preferences] = await ctx.db
        .select({
          guaranteedOffDaysPerMonth: nursePreferences.guaranteedOffDaysPerMonth,
          offBalancePreference: nursePreferences.offBalancePreference,
          accumulatedOffDays: nursePreferences.accumulatedOffDays,
        })
        .from(nursePreferences)
        .where(
          and(
            eq(nursePreferences.nurseId, input.employeeId),
            eq(nursePreferences.tenantId, tenantId)
          )
        )
        .limit(1);

      // Get off-balance history
      const history = await ctx.db
        .select()
        .from(offBalanceLedger)
        .where(
          and(
            eq(offBalanceLedger.nurseId, input.employeeId),
            eq(offBalanceLedger.tenantId, tenantId)
          )
        )
        .orderBy(desc(offBalanceLedger.year), desc(offBalanceLedger.month))
        .limit(input.limit);

      return {
        preferences: preferences || {
          guaranteedOffDaysPerMonth: 8,
          offBalancePreference: 'accumulate',
          accumulatedOffDays: 0,
        },
        history,
      };
    }),

  // Update off-balance preference
  updatePreference: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
      preference: z.enum(['accumulate', 'allowance']),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId;
      if (!tenantId) {
        throw new Error('Tenant not found');
      }

      // Check if preferences exist
      const [existing] = await ctx.db
        .select()
        .from(nursePreferences)
        .where(
          and(
            eq(nursePreferences.nurseId, input.employeeId),
            eq(nursePreferences.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existing) {
        // Create new preferences record
        const [created] = await ctx.db
          .insert(nursePreferences)
          .values({
            tenantId,
            nurseId: input.employeeId,
            offBalancePreference: input.preference,
            guaranteedOffDaysPerMonth: 8,
            accumulatedOffDays: 0,
          })
          .returning();

        return created;
      }

      // Update existing preferences
      const [updated] = await ctx.db
        .update(nursePreferences)
        .set({
          offBalancePreference: input.preference,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(nursePreferences.nurseId, input.employeeId),
            eq(nursePreferences.tenantId, tenantId)
          )
        )
        .returning();

      return updated;
    }),

  // Get current accumulated balance
  getCurrentBalance: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId;
      if (!tenantId) {
        throw new Error('Tenant not found');
      }

      const [preferences] = await ctx.db
        .select({
          accumulatedOffDays: nursePreferences.accumulatedOffDays,
        })
        .from(nursePreferences)
        .where(
          and(
            eq(nursePreferences.nurseId, input.employeeId),
            eq(nursePreferences.tenantId, tenantId)
          )
        )
        .limit(1);

      return {
        accumulatedOffDays: preferences?.accumulatedOffDays || 0,
      };
    }),

  // Get off-balance data for multiple employees (for schedule grid display)
  getBulkCurrentBalance: protectedProcedure
    .input(z.object({
      employeeIds: z.array(z.string()),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId;
      if (!tenantId) {
        throw new Error('Tenant not found');
      }

      // Return empty array if no employee IDs provided
      if (input.employeeIds.length === 0) {
        return [];
      }

      // Fetch preferences for all employees
      const preferences = await ctx.db
        .select({
          nurseId: nursePreferences.nurseId,
          accumulatedOffDays: nursePreferences.accumulatedOffDays,
          offBalancePreference: nursePreferences.offBalancePreference,
        })
        .from(nursePreferences)
        .where(
          and(
            eq(nursePreferences.tenantId, tenantId),
            inArray(nursePreferences.nurseId, input.employeeIds)
          )
        );

      return preferences;
    }),
});
