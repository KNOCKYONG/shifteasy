import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { db } from '@/db';
import { specialRequests } from '@/db/schema/special-requests';
import { users } from '@/db/schema/tenants';
import { eq, and, between, or, lte, gte } from 'drizzle-orm';

export const specialRequestsRouter = createTRPCRouter({
  // Get special requests for a specific date range
  getByDateRange: protectedProcedure
    .input(z.object({
      startDate: z.string(), // YYYY-MM-DD
      endDate: z.string(), // YYYY-MM-DD
      employeeId: z.string().optional(), // Filter by specific employee
      departmentId: z.string().optional(), // Filter by department
      status: z.enum(['pending', 'approved', 'rejected']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const conditions = [
        eq(specialRequests.tenantId, tenantId),
        or(
          // Request starts within range
          and(
            gte(specialRequests.startDate, input.startDate),
            lte(specialRequests.startDate, input.endDate)
          ),
          // Request ends within range
          and(
            gte(specialRequests.endDate, input.startDate),
            lte(specialRequests.endDate, input.endDate)
          ),
          // Request spans the entire range
          and(
            lte(specialRequests.startDate, input.startDate),
            gte(specialRequests.endDate, input.endDate)
          )
        )
      ];

      if (input.employeeId) {
        conditions.push(eq(specialRequests.employeeId, input.employeeId));
      }

      // Add department filter if provided
      if (input.departmentId) {
        conditions.push(eq(specialRequests.departmentId, input.departmentId));
      }

      if (input.status) {
        conditions.push(eq(specialRequests.status, input.status));
      }

      const result = await db.select()
        .from(specialRequests)
        .where(and(...conditions))
        .orderBy(specialRequests.startDate);

      return result;
    }),

  // Get approved requests for scheduling (shift_request는 pending도 포함)
  getApprovedForScheduling: protectedProcedure
    .input(z.object({
      startDate: z.string(), // YYYY-MM-DD
      endDate: z.string(), // YYYY-MM-DD
      departmentId: z.string().optional(), // Filter by department
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const conditions = [
        eq(specialRequests.tenantId, tenantId),
        // shift_request는 pending도 포함 (직원 선호사항이므로 자동 승인)
        or(
          eq(specialRequests.status, 'approved'),
          and(
            eq(specialRequests.requestType, 'shift_request'),
            eq(specialRequests.status, 'pending')
          )
        ),
        or(
          and(
            gte(specialRequests.startDate, input.startDate),
            lte(specialRequests.startDate, input.endDate)
          ),
          and(
            gte(specialRequests.endDate, input.startDate),
            lte(specialRequests.endDate, input.endDate)
          ),
          and(
            lte(specialRequests.startDate, input.startDate),
            gte(specialRequests.endDate, input.endDate)
          )
        )
      ];

      // Add department filter if provided
      if (input.departmentId) {
        conditions.push(eq(specialRequests.departmentId, input.departmentId));
      }

      const result = await db.select()
        .from(specialRequests)
        .where(and(...conditions))
        .orderBy(specialRequests.startDate);

      return result;
    }),

  // Create a new special request
  create: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
      requestType: z.enum(['vacation', 'day_off', 'overtime', 'shift_change', 'shift_request']),
      shiftTypeCode: z.string().optional(), // Config 화면의 customShiftTypes code
      startDate: z.string(), // YYYY-MM-DD
      endDate: z.string().optional(), // YYYY-MM-DD
      reason: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(['pending', 'approved', 'rejected']).default('approved'),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Get department_id from users table
      const user = await db.select({ departmentId: users.departmentId })
        .from(users)
        .where(and(
          eq(users.id, input.employeeId),
          eq(users.tenantId, tenantId)
        ))
        .limit(1);

      const result = await db.insert(specialRequests)
        .values({
          tenantId,
          employeeId: input.employeeId,
          departmentId: user[0]?.departmentId ?? null, // Add department_id from users table
          requestType: input.requestType,
          shiftTypeCode: input.shiftTypeCode ?? null,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          reason: input.reason ?? null,
          notes: input.notes ?? null,
          status: input.status,
        })
        .returning();

      return result[0];
    }),

  // Update request status
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(['pending', 'approved', 'rejected']),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const result = await db.update(specialRequests)
        .set({
          status: input.status,
          notes: input.notes ?? null,
          updatedAt: new Date(),
        })
        .where(and(
          eq(specialRequests.id, input.id),
          eq(specialRequests.tenantId, tenantId)
        ))
        .returning();

      return result[0];
    }),

  // Delete a special request
  delete: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      await db.delete(specialRequests)
        .where(and(
          eq(specialRequests.id, input.id),
          eq(specialRequests.tenantId, tenantId)
        ));

      return { success: true };
    }),
});
