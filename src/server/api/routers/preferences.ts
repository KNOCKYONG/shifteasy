import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { createAuditLog } from '@/lib/db-helpers';
import { db } from '@/db';
import { nursePreferences } from '@/db/schema/nurse-preferences';
import { users } from '@/db/schema/tenants';
import { eq } from 'drizzle-orm';

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
      departmentId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const result = await db.select()
        .from(nursePreferences)
        .where(eq(nursePreferences.nurseId, input.staffId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      // Return nurse_preferences data
      return result[0];
    }),

  // Create or update preferences
  upsert: protectedProcedure
    .input(preferenceUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const { staffId, ...preferences } = input;

      // Get user's department
      const user = await db.select()
        .from(users)
        .where(eq(users.id, staffId))
        .limit(1);

      const departmentId = user.length > 0 ? user[0].departmentId : null;

      // Check if preferences exist
      const existing = await db.select()
        .from(nursePreferences)
        .where(eq(nursePreferences.nurseId, staffId))
        .limit(1);

      const nursePrefsData = {
        tenantId,
        nurseId: staffId,
        departmentId,
        workPatternType: preferences.workPatternType,
        preferredShiftTypes: preferences.preferredShiftTypes ? {
          D: preferences.preferredShiftTypes.D ?? 0,
          E: preferences.preferredShiftTypes.E ?? 0,
          N: preferences.preferredShiftTypes.N ?? 0,
        } : undefined,
        preferredPatterns: preferences.preferredPatterns,
        maxConsecutiveDaysPreferred: preferences.maxConsecutiveDaysPreferred,
        maxConsecutiveNightsPreferred: preferences.maxConsecutiveNightsPreferred,
        preferConsecutiveDaysOff: preferences.preferConsecutiveDaysOff,
        avoidBackToBackShifts: preferences.avoidBackToBackShifts,
        weekdayPreferences: preferences.weekdayPreferences,
        offPreference: preferences.offPreference,
        weekendPreference: preferences.weekendPreference,
        maxWeekendsPerMonth: preferences.maxWeekendsPerMonth,
        preferAlternatingWeekends: preferences.preferAlternatingWeekends,
        holidayPreference: preferences.holidayPreference,
        preferredColleagues: preferences.preferredColleagues,
        avoidColleagues: preferences.avoidColleagues,
        preferredTeamSize: preferences.preferredTeamSize,
        mentorshipPreference: preferences.mentorshipPreference,
        updatedAt: new Date(),
      };

      let result;
      if (existing.length > 0) {
        // Update existing
        result = await db.update(nursePreferences)
          .set(nursePrefsData)
          .where(eq(nursePreferences.nurseId, staffId))
          .returning();
      } else {
        // Insert new
        result = await db.insert(nursePreferences)
          .values(nursePrefsData)
          .returning();
      }

      // Create audit log
      await createAuditLog({
        tenantId,
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: existing.length > 0 ? 'preferences.updated' : 'preferences.created',
        entityType: 'nurse_preferences',
        entityId: staffId,
        before: existing[0] || null,
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

      const deleted = await db.delete(nursePreferences)
        .where(eq(nursePreferences.nurseId, input.staffId))
        .returning();

      if (deleted.length > 0) {
        await createAuditLog({
          tenantId,
          actorId: (ctx.user?.id || 'dev-user-id'),
          action: 'preferences.deleted',
          entityType: 'nurse_preferences',
          entityId: input.staffId,
          before: deleted[0],
        });
      }

      return { success: true };
    }),
});
