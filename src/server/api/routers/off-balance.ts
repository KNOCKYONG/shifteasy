import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { offBalanceLedger } from '@/db/schema';
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

      const history = await ctx.db
        .select()
        .from(offBalanceLedger)
        .where(
          and(
            eq(offBalanceLedger.nurseId, input.employeeId),
            eq(offBalanceLedger.tenantId, tenantId)
          )
        )
        .orderBy(
          desc(offBalanceLedger.year),
          desc(offBalanceLedger.month),
          desc(offBalanceLedger.createdAt)
        )
        .limit(input.limit);

      const latest = history[0];

      return {
        preferences: latest
          ? {
              accumulatedOffDays: latest.accumulatedOffDays ?? latest.remainingOffDays ?? 0,
              allocatedToAccumulation: latest.allocatedToAccumulation ?? 0,
              allocatedToAllowance: latest.allocatedToAllowance ?? 0,
              allocationStatus: latest.allocationStatus ?? 'pending',
            }
          : {
              accumulatedOffDays: 0,
              allocatedToAccumulation: 0,
              allocatedToAllowance: 0,
              allocationStatus: 'pending',
            },
        history,
      };
    }),

  // Update off-balance allocation
  updateAllocation: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
      allocatedToAccumulation: z.number().min(0),
      allocatedToAllowance: z.number().min(0),
      departmentId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId;
      if (!tenantId) {
        throw new Error('Tenant not found');
      }

      const conditions = [
        eq(offBalanceLedger.nurseId, input.employeeId),
        eq(offBalanceLedger.tenantId, tenantId),
      ];

      if (input.departmentId) {
        conditions.push(eq(offBalanceLedger.departmentId, input.departmentId));
      }

      const [latestLedger] = await ctx.db
        .select()
        .from(offBalanceLedger)
        .where(and(...conditions))
        .orderBy(
          desc(offBalanceLedger.year),
          desc(offBalanceLedger.month),
          desc(offBalanceLedger.createdAt)
        )
        .limit(1);

      if (!latestLedger) {
        throw new Error('잔여 OFF 정보가 없습니다. 스케줄을 확정한 뒤 다시 시도해주세요.');
      }

      const totalAllocation = input.allocatedToAccumulation + input.allocatedToAllowance;
      const available = latestLedger.remainingOffDays || 0;

      if (totalAllocation > available) {
        throw new Error(`배분 가능한 OFF 일수(${available}일)를 초과했습니다.`);
      }

      const [updated] = await ctx.db
        .update(offBalanceLedger)
        .set({
          allocatedToAccumulation: input.allocatedToAccumulation,
          allocatedToAllowance: input.allocatedToAllowance,
          allocationStatus: 'processed',
          allocationUpdatedAt: new Date(),
          allocationUpdatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(offBalanceLedger.id, latestLedger.id))
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

      const [latest] = await ctx.db
        .select()
        .from(offBalanceLedger)
        .where(
          and(
            eq(offBalanceLedger.nurseId, input.employeeId),
            eq(offBalanceLedger.tenantId, tenantId)
          )
        )
        .orderBy(
          desc(offBalanceLedger.year),
          desc(offBalanceLedger.month),
          desc(offBalanceLedger.createdAt)
        )
        .limit(1);

      return {
        accumulatedOffDays: latest?.accumulatedOffDays ?? latest?.remainingOffDays ?? 0,
      };
    }),

  // Get off-balance data for multiple employees (for schedule grid display)
  getBulkCurrentBalance: protectedProcedure
    .input(z.object({
      employeeIds: z.array(z.string()),
      departmentId: z.string().optional(),
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

      const conditions = [
        eq(offBalanceLedger.tenantId, tenantId),
        inArray(offBalanceLedger.nurseId, input.employeeIds),
      ];

      if (input.departmentId) {
        conditions.push(eq(offBalanceLedger.departmentId, input.departmentId));
      }

      const ledgerRows = await ctx.db
        .select()
        .from(offBalanceLedger)
        .where(and(...conditions))
        .orderBy(
          desc(offBalanceLedger.year),
          desc(offBalanceLedger.month),
          desc(offBalanceLedger.createdAt)
        );

      const latestByNurse = new Map<string, typeof ledgerRows[number]>();
      for (const row of ledgerRows) {
        if (!latestByNurse.has(row.nurseId)) {
          latestByNurse.set(row.nurseId, row);
        }
      }

      return Array.from(latestByNurse.values()).map(row => ({
        nurseId: row.nurseId,
        departmentId: row.departmentId,
        accumulatedOffDays: row.accumulatedOffDays ?? row.remainingOffDays ?? 0,
        allocatedToAccumulation: row.allocatedToAccumulation ?? 0,
        allocatedToAllowance: row.allocatedToAllowance ?? 0,
        allocationStatus: row.allocationStatus ?? 'pending',
      }));
    }),
});
