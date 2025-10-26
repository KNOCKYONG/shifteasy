import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { db } from '@/db';
import { tenantConfigs } from '@/db/schema/tenant-configs';
import { eq, and } from 'drizzle-orm';

export const tenantConfigsRouter = createTRPCRouter({
  // Get config by key
  getByKey: protectedProcedure
    .input(z.object({
      configKey: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const result = await db.select()
        .from(tenantConfigs)
        .where(and(
          eq(tenantConfigs.tenantId, tenantId),
          eq(tenantConfigs.configKey, input.configKey)
        ))
        .limit(1);

      return result[0] || null;
    }),

  // Get all configs for tenant
  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const result = await db.select()
        .from(tenantConfigs)
        .where(eq(tenantConfigs.tenantId, tenantId));

      // Convert to key-value map
      const configs: Record<string, any> = {};
      result.forEach(config => {
        configs[config.configKey] = config.configValue;
      });

      return configs;
    }),

  // Set config (create or update)
  set: protectedProcedure
    .input(z.object({
      configKey: z.string(),
      configValue: z.any(), // JSON value
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Check if config exists
      const existing = await db.select()
        .from(tenantConfigs)
        .where(and(
          eq(tenantConfigs.tenantId, tenantId),
          eq(tenantConfigs.configKey, input.configKey)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Update
        const result = await db.update(tenantConfigs)
          .set({
            configValue: input.configValue,
            updatedAt: new Date(),
          })
          .where(and(
            eq(tenantConfigs.tenantId, tenantId),
            eq(tenantConfigs.configKey, input.configKey)
          ))
          .returning();

        return result[0];
      } else {
        // Create
        const result = await db.insert(tenantConfigs)
          .values({
            tenantId,
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
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      await db.delete(tenantConfigs)
        .where(and(
          eq(tenantConfigs.tenantId, tenantId),
          eq(tenantConfigs.configKey, input.configKey)
        ));

      return { success: true };
    }),
});
