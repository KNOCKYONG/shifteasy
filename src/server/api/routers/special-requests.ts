import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { db } from '@/db';
import { specialRequests } from '@/db/schema/special-requests';
import { users } from '@/db/schema/tenants';
import { eq, and, or, lte, gte } from 'drizzle-orm';

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
        // Date within range
        and(
          gte(specialRequests.date, input.startDate),
          lte(specialRequests.date, input.endDate)
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
        .orderBy(specialRequests.date);

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
        // Date within range
        and(
          gte(specialRequests.date, input.startDate),
          lte(specialRequests.date, input.endDate)
        )
      ];

      // Add department filter if provided
      if (input.departmentId) {
        conditions.push(eq(specialRequests.departmentId, input.departmentId));
      }

      const result = await db.select()
        .from(specialRequests)
        .where(and(...conditions))
        .orderBy(specialRequests.date);

      return result;
    }),

  // Create or update a special request (upsert)
  create: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
      requestType: z.enum(['vacation', 'day_off', 'overtime', 'shift_change', 'shift_request']),
      shiftTypeCode: z.string().optional(), // Config 화면의 customShiftTypes code
      date: z.string(), // YYYY-MM-DD
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

      // Check if a request already exists for the same employee, date, and type
      const existing = await db.select()
        .from(specialRequests)
        .where(and(
          eq(specialRequests.tenantId, tenantId),
          eq(specialRequests.employeeId, input.employeeId),
          eq(specialRequests.date, input.date),
          eq(specialRequests.requestType, input.requestType)
        ))
        .limit(1);

      let result;

      if (existing.length > 0) {
        // Update existing request
        const updated = await db.update(specialRequests)
          .set({
            departmentId: user[0]?.departmentId ?? null,
            shiftTypeCode: input.shiftTypeCode ?? null,
            reason: input.reason ?? null,
            notes: input.notes ?? null,
            status: input.status,
            updatedAt: new Date(),
          })
          .where(eq(specialRequests.id, existing[0].id))
          .returning();

        result = updated[0];
      } else {
        // Insert new request
        const inserted = await db.insert(specialRequests)
          .values({
            tenantId,
            employeeId: input.employeeId,
            departmentId: user[0]?.departmentId ?? null,
            requestType: input.requestType,
            shiftTypeCode: input.shiftTypeCode ?? null,
            date: input.date,
            reason: input.reason ?? null,
            notes: input.notes ?? null,
            status: input.status,
          })
          .returning();

        result = inserted[0];
      }

      return result;
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

  // Delete shift requests by employee and date range
  deleteByEmployeeAndDateRange: protectedProcedure
    .input(z.object({
      employeeId: z.string(),
      requestType: z.enum(['vacation', 'day_off', 'overtime', 'shift_change', 'shift_request']),
      startDate: z.string(), // YYYY-MM-DD
      endDate: z.string(), // YYYY-MM-DD
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      await db.delete(specialRequests)
        .where(and(
          eq(specialRequests.tenantId, tenantId),
          eq(specialRequests.employeeId, input.employeeId),
          eq(specialRequests.requestType, input.requestType),
          gte(specialRequests.date, input.startDate),
          lte(specialRequests.date, input.endDate)
        ));

      return { success: true };
    }),
});
