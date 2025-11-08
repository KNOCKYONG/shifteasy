import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { db } from '@/db';
import { configs } from '@/db/schema/configs';
import { eq, and, isNull } from 'drizzle-orm';

export const configsRouter = createTRPCRouter({
  // Get config by key (supports department-level override)
  getByKey: protectedProcedure
    .input(z.object({
      configKey: z.string(),
      departmentId: z.string().optional(), // Optional department filter
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // If departmentId provided, try to get department-specific config first
      if (input.departmentId) {
        const deptResult = await db.select()
          .from(configs)
          .where(and(
            eq(configs.tenantId, tenantId),
            eq(configs.departmentId, input.departmentId),
            eq(configs.configKey, input.configKey)
          ))
          .limit(1);

        // Return department config if exists
        if (deptResult.length > 0) {
          return deptResult[0];
        }
      }

      // Fallback to tenant-level config (department_id = NULL)
      const result = await db.select()
        .from(configs)
        .where(and(
          eq(configs.tenantId, tenantId),
          isNull(configs.departmentId),
          eq(configs.configKey, input.configKey)
        ))
        .limit(1);

      return result[0] || null;
    }),

  // Get all configs for tenant (optionally filtered by department)
  getAll: protectedProcedure
    .input(z.object({
      departmentId: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      let conditions = [eq(configs.tenantId, tenantId)];

      if (input?.departmentId) {
        // Get both tenant-level and department-specific configs
        const tenantConfigs = await db.select()
          .from(configs)
          .where(and(
            eq(configs.tenantId, tenantId),
            isNull(configs.departmentId)
          ));

        const deptConfigs = await db.select()
          .from(configs)
          .where(and(
            eq(configs.tenantId, tenantId),
            eq(configs.departmentId, input.departmentId)
          ));

        // Merge configs: department configs override tenant configs
        const configMap: Record<string, any> = {};

        // Add tenant configs first
        tenantConfigs.forEach(config => {
          configMap[config.configKey] = config.configValue;
        });

        // Override with department configs
        deptConfigs.forEach(config => {
          configMap[config.configKey] = config.configValue;
        });

        return configMap;
      } else {
        // Get only tenant-level configs (department_id = NULL)
        const result = await db.select()
          .from(configs)
          .where(and(
            eq(configs.tenantId, tenantId),
            isNull(configs.departmentId)
          ));

        // Convert to key-value map
        const configMap: Record<string, any> = {};
        result.forEach(config => {
          configMap[config.configKey] = config.configValue;
        });

        return configMap;
      }
    }),

  // Set config (create or update)
  set: protectedProcedure
    .input(z.object({
      configKey: z.string(),
      configValue: z.any(), // JSON value
      departmentId: z.string().optional(), // Optional department ID
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Build where conditions
      const whereConditions = [
        eq(configs.tenantId, tenantId),
        eq(configs.configKey, input.configKey),
      ];

      if (input.departmentId) {
        whereConditions.push(eq(configs.departmentId, input.departmentId));
      } else {
        whereConditions.push(isNull(configs.departmentId));
      }

      // Check if config exists
      const existing = await db.select()
        .from(configs)
        .where(and(...whereConditions))
        .limit(1);

      if (existing.length > 0) {
        // Update
        const result = await db.update(configs)
          .set({
            configValue: input.configValue,
            updatedAt: new Date(),
          })
          .where(and(...whereConditions))
          .returning();

        return result[0];
      } else {
        // Create
        const result = await db.insert(configs)
          .values({
            tenantId,
            departmentId: input.departmentId || null,
            configKey: input.configKey,
            configValue: input.configValue,
          })
          .returning();

        return result[0];
      }
    }),

  // Delete config
  delete: protectedProcedure
    .input(z.object({
      configKey: z.string(),
      departmentId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const whereConditions = [
        eq(configs.tenantId, tenantId),
        eq(configs.configKey, input.configKey),
      ];

      if (input.departmentId) {
        whereConditions.push(eq(configs.departmentId, input.departmentId));
      } else {
        whereConditions.push(isNull(configs.departmentId));
      }

      await db.delete(configs)
        .where(and(...whereConditions));

      return { success: true };
    }),
});
