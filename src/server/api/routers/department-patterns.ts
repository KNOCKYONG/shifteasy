/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { db } from '@/db';
import { departmentPatterns } from '@/db/schema/department-patterns';
import { eq, and } from 'drizzle-orm';

// Input schema for creating/updating patterns
const DepartmentPatternSchema = z.object({
  departmentId: z.string().uuid(),
  requiredStaffDay: z.number().int().min(0).default(5),
  requiredStaffEvening: z.number().int().min(0).default(4),
  requiredStaffNight: z.number().int().min(0).default(3),
  requiredStaffByShift: z.record(z.number()).default({ D: 5, E: 4, N: 3 }),
  defaultPatterns: z.array(z.array(z.string())).default([['D', 'D', 'D', 'OFF', 'OFF']]),
  avoidPatterns: z.array(z.array(z.string())).default([]),
  totalMembers: z.number().int().min(1).default(15),
  isActive: z.string().default('true'),
});

export const departmentPatternsRouter = createTRPCRouter({
  // Get pattern by department ID
  getByDepartment: protectedProcedure
    .input(z.object({
      departmentId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const result = await db.select()
        .from(departmentPatterns)
        .where(and(
          eq(departmentPatterns.tenantId, tenantId),
          eq(departmentPatterns.departmentId, input.departmentId)
        ))
        .limit(1);

      return result[0] || null;
    }),

  // Get all patterns for tenant
  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const result = await db.select()
        .from(departmentPatterns)
        .where(eq(departmentPatterns.tenantId, tenantId));

      return result;
    }),

  // Create or update pattern
  upsert: protectedProcedure
    .input(DepartmentPatternSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Check if pattern exists
      const existing = await db.select()
        .from(departmentPatterns)
        .where(and(
          eq(departmentPatterns.tenantId, tenantId),
          eq(departmentPatterns.departmentId, input.departmentId)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Update
        const result = await db.update(departmentPatterns)
          .set({
            requiredStaffDay: input.requiredStaffDay,
            requiredStaffEvening: input.requiredStaffEvening,
            requiredStaffNight: input.requiredStaffNight,
            requiredStaffByShift: input.requiredStaffByShift,
            defaultPatterns: input.defaultPatterns,
            avoidPatterns: input.avoidPatterns,
            totalMembers: input.totalMembers,
            isActive: input.isActive,
            updatedAt: new Date(),
          })
          .where(and(
            eq(departmentPatterns.tenantId, tenantId),
            eq(departmentPatterns.departmentId, input.departmentId)
          ))
          .returning();

        return result[0];
      } else {
        // Create
        const result = await db.insert(departmentPatterns)
          .values({
            tenantId,
            departmentId: input.departmentId,
            requiredStaffDay: input.requiredStaffDay,
            requiredStaffEvening: input.requiredStaffEvening,
            requiredStaffNight: input.requiredStaffNight,
            requiredStaffByShift: input.requiredStaffByShift,
            defaultPatterns: input.defaultPatterns,
            avoidPatterns: input.avoidPatterns,
            totalMembers: input.totalMembers,
            isActive: input.isActive,
          })
          .returning();

        return result[0];
      }
    }),

  // Delete pattern
  delete: protectedProcedure
    .input(z.object({
      departmentId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      await db.delete(departmentPatterns)
        .where(and(
          eq(departmentPatterns.tenantId, tenantId),
          eq(departmentPatterns.departmentId, input.departmentId)
        ));

      return { success: true };
    }),
});
