import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { createAuditLog } from '@/lib/db-helpers';
import { db } from '@/db';
import { configs } from '@/db/schema/configs';
import { users } from '@/db/schema/tenants';
import { eq, and } from 'drizzle-orm';

// Schema for preference updates
const preferenceUpdateSchema = z.object({
  staffId: z.string(),

  // Work pattern type
  workPatternType: z.enum(['three-shift', 'night-intensive', 'weekday-only']).optional(),

  // Shift preferences
  preferredShiftTypes: z.object({
    D: z.number().min(0).max(10).optional(),
    E: z.number().min(0).max(10).optional(),
    N: z.number().min(0).max(10).optional(),
  }).optional(),

  preferredPatterns: z.array(z.object({
    pattern: z.string(),
    preference: z.number().min(0).max(10),
  })).optional(),

  maxConsecutiveDaysPreferred: z.number().optional(),
  maxConsecutiveNightsPreferred: z.number().optional(),
  preferConsecutiveDaysOff: z.number().optional(),
  avoidBackToBackShifts: z.boolean().optional(),

  // Weekday preferences
  weekdayPreferences: z.object({
    monday: z.number().min(0).max(10),
    tuesday: z.number().min(0).max(10),
    wednesday: z.number().min(0).max(10),
    thursday: z.number().min(0).max(10),
    friday: z.number().min(0).max(10),
    saturday: z.number().min(0).max(10),
    sunday: z.number().min(0).max(10),
  }).optional(),

  offPreference: z.enum(['prefer', 'avoid', 'neutral']).optional(),
  weekendPreference: z.enum(['prefer', 'avoid', 'neutral']).optional(),
  maxWeekendsPerMonth: z.number().optional(),
  preferAlternatingWeekends: z.boolean().optional(),

  holidayPreference: z.enum(['prefer', 'avoid', 'neutral']).optional(),
  preferredDaysOff: z.array(z.number().min(0).max(6)).optional(), // 0=Sunday, 1=Monday, ..., 6=Saturday

  // Team preferences
  preferredColleagues: z.array(z.string()).optional(),
  avoidColleagues: z.array(z.string()).optional(),
  preferredTeamSize: z.enum(['small', 'medium', 'large']).optional(),
  mentorshipPreference: z.enum(['mentor', 'mentee', 'neither']).optional(),

  // Work-life balance
  workLifeBalance: z.object({
    childcare: z.boolean().optional(),
    eldercare: z.boolean().optional(),
    education: z.boolean().optional(),
    secondJob: z.boolean().optional(),
  }).optional(),

  // Commute preferences
  commutePreferences: z.object({
    maxCommuteTime: z.number().optional(),
    preferPublicTransport: z.boolean().optional(),
    parkingRequired: z.boolean().optional(),
  }).optional(),
});

export const preferencesRouter = createTRPCRouter({
  // Get preferences for a staff member
  get: protectedProcedure
    .input(z.object({
      staffId: z.string(),
      departmentId: z.string().optional(), // Optional department filter (not used in tenant_configs)
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const configKey = `preferences_${input.staffId}`;

      const result = await db.select()
        .from(configs)
        .where(and(
          eq(configs.tenantId, tenantId),
          eq(configs.configKey, configKey)
        ))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0].configValue;
    }),

  // Create or update preferences
  upsert: protectedProcedure
    .input(preferenceUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const { staffId, ...preferences } = input;
      const configKey = `preferences_${staffId}`;

      // Check if preferences exist
      const existing = await db.select()
        .from(configs)
        .where(and(
          eq(configs.tenantId, tenantId),
          eq(configs.configKey, configKey)
        ))
        .limit(1);

      const result = await db.insert(configs)
        .values({
          tenantId,
          configKey,
          configValue: preferences,
        })
        .onConflictDoUpdate({
          target: [configs.tenantId, configs.configKey],
          set: {
            configValue: preferences,
            updatedAt: new Date(),
          },
        })
        .returning();

      // Create audit log
      await createAuditLog({
        tenantId,
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: existing.length > 0 ? 'preferences.updated' : 'preferences.created',
        entityType: 'tenant_configs',
        entityId: configKey,
        before: existing[0]?.configValue,
        after: preferences,
      });

      return result[0];
    }),

  // Delete preferences
  delete: protectedProcedure
    .input(z.object({
      staffId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const configKey = `preferences_${input.staffId}`;

      const deleted = await db.delete(configs)
        .where(and(
          eq(configs.tenantId, tenantId),
          eq(configs.configKey, configKey)
        ))
        .returning();

      if (deleted.length > 0) {
        await createAuditLog({
          tenantId,
          actorId: (ctx.user?.id || 'dev-user-id'),
          action: 'preferences.deleted',
          entityType: 'tenant_configs',
          entityId: configKey,
          before: deleted[0].configValue,
        });
      }

      return { success: true };
    }),
});
