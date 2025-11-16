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
      year: z.number().optional(), // ✅ 특정 연도
      month: z.number().min(1).max(12).optional(), // ✅ 특정 월 (1-12)
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

      // ✅ 특정 월이 지정된 경우 해당 월의 데이터만 찾기 (없으면 undefined)
      let targetRecord = undefined;
      if (input.year !== undefined && input.month !== undefined) {
        // 선택한 월의 데이터만 찾기 (fallback 없음)
        targetRecord = history.find(
          (record) => record.year === input.year && record.month === input.month
        );
      } else {
        // 월 지정이 없으면 가장 최근 데이터
        targetRecord = history[0];
      }

      return {
        preferences: targetRecord
          ? {
              accumulatedOffDays: targetRecord.accumulatedOffDays ?? targetRecord.remainingOffDays ?? 0,
              allocatedToAccumulation: targetRecord.allocatedToAccumulation ?? 0,
              allocatedToAllowance: targetRecord.allocatedToAllowance ?? 0,
              allocationStatus: targetRecord.allocationStatus ?? 'pending',
            }
          : {
              // ✅ 선택한 월의 데이터가 없으면 모두 0으로 표시
              accumulatedOffDays: 0,
              allocatedToAccumulation: 0,
              allocatedToAllowance: 0,
              allocationStatus: 'pending',
            },
        history,
        selectedRecord: targetRecord, // ✅ 선택된 레코드 반환 (없으면 undefined)
      };
    }),

  // Update off-balance allocation
  updateAllocation: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
      allocatedToAccumulation: z.number().min(0),
      allocatedToAllowance: z.number().min(0),
      departmentId: z.string().optional(),
      year: z.number().optional(), // ✅ 특정 연도
      month: z.number().min(1).max(12).optional(), // ✅ 특정 월 (1-12)
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

      // ✅ 특정 월이 지정된 경우 해당 월 필터 추가
      if (input.year !== undefined) {
        conditions.push(eq(offBalanceLedger.year, input.year));
      }
      if (input.month !== undefined) {
        conditions.push(eq(offBalanceLedger.month, input.month));
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
          allocationUpdatedBy: ctx.user?.id ?? null,
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
