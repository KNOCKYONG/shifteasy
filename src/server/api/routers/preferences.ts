import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { createAuditLog } from '@/lib/db-helpers';
import { db } from '@/db';
import { nursePreferences } from '@/db/schema/nurse-preferences';
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
      departmentId: z.string().optional(), // Optional department filter
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const conditions = [
        eq(nursePreferences.tenantId, tenantId),
        eq(nursePreferences.nurseId, input.staffId)
      ];

      // Add department filter if provided
      if (input.departmentId) {
        conditions.push(eq(nursePreferences.departmentId, input.departmentId));
      }

      const preferences = await db.select()
        .from(nursePreferences)
        .where(and(...conditions))
        .limit(1);

      return preferences[0] || null;
    }),

  // Create or update preferences
  upsert: protectedProcedure
    .input(preferenceUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const { staffId, workLifeBalance, commutePreferences, preferredPatterns, ...rest } = input;

      // Get department_id from users table
      const user = await db.select({ departmentId: users.departmentId })
        .from(users)
        .where(and(
          eq(users.id, staffId),
          eq(users.tenantId, tenantId)
        ))
        .limit(1);

      const departmentId = user[0]?.departmentId;

      // Transform preferredPatterns to match DB schema
      const transformedPreferredPatterns = preferredPatterns?.map(p => ({
        pattern: p.pattern,
        preference: p.preference
      }));

      // Transform workLifeBalance to match DB schema
      const hasCareResponsibilities = !!(
        workLifeBalance?.childcare ||
        workLifeBalance?.eldercare ||
        workLifeBalance?.education
      );

      const careResponsibilityDetails = hasCareResponsibilities ? {
        type: (workLifeBalance?.childcare ? 'childcare' :
               workLifeBalance?.eldercare ? 'eldercare' : 'other') as 'childcare' | 'eldercare' | 'other',
        affectedTimes: [],
        flexibilityLevel: 'medium' as 'none' | 'low' | 'medium' | 'high'
      } : null;

      // Transform commutePreferences to match DB schema
      const hasTransportationIssues = !!(
        commutePreferences?.parkingRequired ||
        commutePreferences?.preferPublicTransport
      );

      const transportationNotes = commutePreferences ?
        `Max commute: ${commutePreferences.maxCommuteTime || 60} min. ` +
        `Public transport: ${commutePreferences.preferPublicTransport ? 'Yes' : 'No'}. ` +
        `Parking: ${commutePreferences.parkingRequired ? 'Required' : 'Not required'}.`
        : null;

      // Build DB-compatible data
      const { preferredShiftTypes, ...restData } = rest;
      const normalizedPreferredShiftTypes = preferredShiftTypes
        ? {
            D: preferredShiftTypes.D ?? 0,
            E: preferredShiftTypes.E ?? 0,
            N: preferredShiftTypes.N ?? 0,
          }
        : undefined;

      const dbData = {
        ...restData,
        ...(normalizedPreferredShiftTypes && { preferredShiftTypes: normalizedPreferredShiftTypes }),
        preferredPatterns: transformedPreferredPatterns,
        hasCareResponsibilities,
        ...(careResponsibilityDetails && { careResponsibilityDetails }),
        hasTransportationIssues,
        ...(transportationNotes && { transportationNotes }),
        ...(departmentId && { departmentId }), // Add department_id from users table
      };

      // Check if preferences exist
      const existing = await db.select()
        .from(nursePreferences)
        .where(and(
          eq(nursePreferences.tenantId, tenantId),
          eq(nursePreferences.nurseId, staffId)
        ))
        .limit(1);

      let result;

      if (existing.length > 0) {
        // Update existing preferences
        const updated = await db.update(nursePreferences)
          .set({
            ...dbData,
            updatedAt: new Date(),
          })
          .where(and(
            eq(nursePreferences.tenantId, tenantId),
            eq(nursePreferences.nurseId, staffId)
          ))
          .returning();

        await createAuditLog({
          tenantId,
          actorId: (ctx.user?.id || 'dev-user-id'),
          action: 'preferences.updated',
          entityType: 'nurse_preferences',
          entityId: existing[0].id,
          before: existing[0],
          after: updated[0],
        });

        result = updated[0];
      } else {
        // Create new preferences
        const created = await db.insert(nursePreferences)
          .values({
            tenantId,
            nurseId: staffId,
            ...dbData,
          })
          .returning();

        await createAuditLog({
          tenantId,
          actorId: (ctx.user?.id || 'dev-user-id'),
          action: 'preferences.created',
          entityType: 'nurse_preferences',
          entityId: created[0].id,
          after: created[0],
        });

        result = created[0];
      }

      return result;
    }),

  // Delete preferences
  delete: protectedProcedure
    .input(z.object({
      staffId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const deleted = await db.delete(nursePreferences)
        .where(and(
          eq(nursePreferences.tenantId, tenantId),
          eq(nursePreferences.nurseId, input.staffId)
        ))
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
