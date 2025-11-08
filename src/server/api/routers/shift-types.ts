import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { db } from '@/db';
import { configs } from '@/db/schema/configs';
import { eq, and, isNull } from 'drizzle-orm';

// ShiftType interface matching the config structure
interface ShiftType {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  duration?: number;
  color: string;
  breakMinutes?: number;
  sortOrder?: number;
  departmentId?: string | null;
}

export const shiftTypesRouter = createTRPCRouter({
  // Get all shift types for a department
  getByDepartment: protectedProcedure
    .input(z.object({
      departmentId: z.string().optional(), // If not provided, returns global shift types
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Get shift types from tenant_configs
      const configResult = await db.select()
        .from(configs)
        .where(and(
          eq(configs.tenantId, tenantId),
          eq(configs.configKey, 'shift_types')
        ))
        .limit(1);

      if (!configResult[0]) {
        return [];
      }

      const shiftTypes = configResult[0].configValue as ShiftType[];

      // Filter by department if specified
      if (input.departmentId) {
        return shiftTypes.filter(st =>
          !st.departmentId || st.departmentId === input.departmentId
        );
      }

      // Return only global shift types (no departmentId)
      return shiftTypes.filter(st => !st.departmentId);
    }),

  // Get all shift types for tenant
  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Get shift types from tenant_configs
      const configResult = await db.select()
        .from(configs)
        .where(and(
          eq(configs.tenantId, tenantId),
          eq(configs.configKey, 'shift_types')
        ))
        .limit(1);

      if (!configResult[0]) {
        return [];
      }

      return configResult[0].configValue as ShiftType[];
    }),

  // Create or update shift type (upsert based on department_id + code)
  upsert: protectedProcedure
    .input(z.object({
      departmentId: z.string().optional(), // NULL = global shift type
      code: z.string(),
      name: z.string(),
      startTime: z.string(), // HH:mm format
      endTime: z.string(), // HH:mm format
      duration: z.number().optional(), // minutes
      color: z.string(),
      breakMinutes: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Get current shift types
      const configResult = await db.select()
        .from(configs)
        .where(and(
          eq(configs.tenantId, tenantId),
          eq(configs.configKey, 'shift_types')
        ))
        .limit(1);

      let shiftTypes: ShiftType[] = [];

      if (configResult[0]) {
        shiftTypes = configResult[0].configValue as ShiftType[];
      }

      // Find existing shift type with same code and departmentId
      const existingIndex = shiftTypes.findIndex(st =>
        st.code === input.code &&
        ((!st.departmentId && !input.departmentId) || st.departmentId === input.departmentId)
      );

      const newShiftType: ShiftType = {
        id: existingIndex >= 0 ? shiftTypes[existingIndex].id : crypto.randomUUID(),
        code: input.code,
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        duration: input.duration,
        color: input.color,
        breakMinutes: input.breakMinutes ?? 0,
        sortOrder: input.sortOrder ?? (existingIndex >= 0 ? shiftTypes[existingIndex].sortOrder : 0),
        departmentId: input.departmentId ?? null,
      };

      if (existingIndex >= 0) {
        // Update existing
        shiftTypes[existingIndex] = newShiftType;
      } else {
        // Add new
        shiftTypes.push(newShiftType);
      }

      // Save back to tenant_configs
      if (configResult[0]) {
        await db.update(configs)
          .set({
            configValue: shiftTypes,
            updatedAt: new Date(),
          })
          .where(and(
            eq(configs.tenantId, tenantId),
            eq(configs.configKey, 'shift_types')
          ));
      } else {
        await db.insert(configs)
          .values({
            tenantId,
            configKey: 'shift_types',
            configValue: shiftTypes,
          });
      }

      return newShiftType;
    }),

  // Delete shift type
  delete: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Get current shift types
      const configResult = await db.select()
        .from(configs)
        .where(and(
          eq(configs.tenantId, tenantId),
          eq(configs.configKey, 'shift_types')
        ))
        .limit(1);

      if (!configResult[0]) {
        return { success: false };
      }

      let shiftTypes = configResult[0].configValue as ShiftType[];

      // Remove the shift type
      shiftTypes = shiftTypes.filter(st => st.id !== input.id);

      // Save back
      await db.update(configs)
        .set({
          configValue: shiftTypes,
          updatedAt: new Date(),
        })
        .where(and(
          eq(configs.tenantId, tenantId),
          eq(configs.configKey, 'shift_types')
        ));

      return { success: true };
    }),
});
