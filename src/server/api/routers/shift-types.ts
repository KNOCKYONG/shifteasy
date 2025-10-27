import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { db } from '@/db';
import { shiftTypes } from '@/db/schema/tenants';
import { eq, and, or, isNull } from 'drizzle-orm';

export const shiftTypesRouter = createTRPCRouter({
  // Get all shift types for a department
  getByDepartment: protectedProcedure
    .input(z.object({
      departmentId: z.string().optional(), // If not provided, returns global shift types
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Get global shift types (department_id = NULL) + department-specific shift types
      const result = await db.select()
        .from(shiftTypes)
        .where(and(
          eq(shiftTypes.tenantId, tenantId),
          input.departmentId
            ? or(
                isNull(shiftTypes.departmentId), // Global
                eq(shiftTypes.departmentId, input.departmentId) // Department-specific
              )
            : isNull(shiftTypes.departmentId) // Only global if no department specified
        ))
        .orderBy(shiftTypes.sortOrder);

      return result;
    }),

  // Get all shift types for tenant
  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const result = await db.select()
        .from(shiftTypes)
        .where(eq(shiftTypes.tenantId, tenantId))
        .orderBy(shiftTypes.sortOrder);

      return result;
    }),

  // Create or update shift type (upsert based on department_id + code)
  upsert: protectedProcedure
    .input(z.object({
      departmentId: z.string().optional(), // NULL = global shift type
      code: z.string(),
      name: z.string(),
      startTime: z.string(), // HH:mm format
      endTime: z.string(), // HH:mm format
      duration: z.number(), // minutes
      color: z.string(),
      breakMinutes: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Check if shift type already exists for this tenant + department + code
      const conditions = [
        eq(shiftTypes.tenantId, tenantId),
        eq(shiftTypes.code, input.code),
      ];

      // Handle department_id (NULL or UUID)
      if (input.departmentId) {
        conditions.push(eq(shiftTypes.departmentId, input.departmentId));
      } else {
        conditions.push(isNull(shiftTypes.departmentId));
      }

      const existing = await db.select()
        .from(shiftTypes)
        .where(and(...conditions))
        .limit(1);

      let result;

      if (existing.length > 0) {
        // Update existing shift type
        const updated = await db.update(shiftTypes)
          .set({
            name: input.name,
            startTime: input.startTime,
            endTime: input.endTime,
            duration: input.duration,
            color: input.color,
            breakMinutes: input.breakMinutes ?? 0,
            sortOrder: input.sortOrder ?? existing[0].sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(shiftTypes.id, existing[0].id))
          .returning();

        result = updated[0];
      } else {
        // Insert new shift type
        const inserted = await db.insert(shiftTypes)
          .values({
            tenantId,
            departmentId: input.departmentId ?? null,
            code: input.code,
            name: input.name,
            startTime: input.startTime,
            endTime: input.endTime,
            duration: input.duration,
            color: input.color,
            breakMinutes: input.breakMinutes ?? 0,
            sortOrder: input.sortOrder ?? 0,
          })
          .returning();

        result = inserted[0];
      }

      return result;
    }),

  // Delete shift type
  delete: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      await db.delete(shiftTypes)
        .where(and(
          eq(shiftTypes.id, input.id),
          eq(shiftTypes.tenantId, tenantId)
        ));

      return { success: true };
    }),
});
