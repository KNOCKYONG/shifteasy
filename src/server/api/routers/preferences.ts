import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { scopedDb, createAuditLog } from '@/lib/db-helpers';
import { nursePreferences } from '@/db/schema/nurse-preferences';
import { eq, and } from 'drizzle-orm';

// Schema for preference updates
const preferenceUpdateSchema = z.object({
  staffId: z.string(),

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

  weekendPreference: z.enum(['prefer', 'avoid', 'neutral']).optional(),
  maxWeekendsPerMonth: z.number().optional(),
  preferAlternatingWeekends: z.boolean().optional(),

  holidayPreference: z.enum(['prefer', 'avoid', 'neutral']).optional(),

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
    }))
    .query(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      const [preferences] = await db.query(
        nursePreferences,
        and(
          eq(nursePreferences.tenantId, (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d')),
          eq(nursePreferences.nurseId, input.staffId)
        )
      );

      return preferences || null;
    }),

  // Create or update preferences
  upsert: protectedProcedure
    .input(preferenceUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));
      const { staffId, ...preferenceData } = input;

      // Check if preferences exist
      const [existing] = await db.query(
        nursePreferences,
        and(
          eq(nursePreferences.tenantId, (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d')),
          eq(nursePreferences.nurseId, staffId)
        )
      );

      let result;

      if (existing) {
        // Update existing preferences
        const [updated] = await db.update(
          nursePreferences,
          {
            ...preferenceData,
            updatedAt: new Date(),
          },
          and(
            eq(nursePreferences.tenantId, (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d')),
            eq(nursePreferences.nurseId, staffId)
          )
        );

        await createAuditLog({
          tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
          actorId: (ctx.user?.id || 'dev-user-id'),
          action: 'preferences.updated',
          entityType: 'nurse_preferences',
          entityId: existing.id,
          before: existing,
          after: updated,
        });

        result = updated;
      } else {
        // Create new preferences
        const [created] = await db.insert(nursePreferences, {
          tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
          nurseId: staffId,
          ...preferenceData,
        });

        await createAuditLog({
          tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
          actorId: (ctx.user?.id || 'dev-user-id'),
          action: 'preferences.created',
          entityType: 'nurse_preferences',
          entityId: created.id,
          after: created,
        });

        result = created;
      }

      return result;
    }),

  // Delete preferences
  delete: protectedProcedure
    .input(z.object({
      staffId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      const [deleted] = await db.delete(
        nursePreferences,
        and(
          eq(nursePreferences.tenantId, (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d')),
          eq(nursePreferences.nurseId, input.staffId)
        )
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'preferences.deleted',
        entityType: 'nurse_preferences',
        entityId: input.staffId,
        before: deleted,
      });

      return { success: true };
    }),
});
