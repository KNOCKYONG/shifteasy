import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { createAuditLog } from '@/lib/db-helpers';
import { db } from '@/db';
import { nursePreferences } from '@/db/schema/nurse-preferences';
import { users } from '@/db/schema/tenants';
import { eq } from 'drizzle-orm';
import { sse } from '@/lib/sse/broadcaster';

// Schema for preference updates
const preferenceUpdateSchema = z.object({
  staffId: z.string(),

  // Work pattern type
  workPatternType: z.enum(['three-shift', 'night-intensive', 'weekday-only']).optional(),

  // Shift pattern preferences
  preferredPatterns: z.array(z.object({
    pattern: z.string(),
    preference: z.number().min(0).max(10),
  })).optional(),

  // Avoid patterns (기피 근무 패턴 - 개인)
  avoidPatterns: z.array(z.array(z.string())).optional(),
});

export const preferencesRouter = createTRPCRouter({
  // Get all preferences for multiple staff members (prefetching)
  listAll: protectedProcedure
    .input(z.object({
      departmentId: z.string().optional(),
      tenantId: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const tenantId = input?.tenantId || ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const result = await db.select()
        .from(nursePreferences)
        .where(eq(nursePreferences.tenantId, tenantId));

      // Return as a map: staffId -> preferences
      const preferencesMap: Record<string, typeof result[0]> = {};
      result.forEach(pref => {
        preferencesMap[pref.nurseId] = pref;
      });

      return preferencesMap;
    }),

  // Get preferences for a staff member
  get: protectedProcedure
    .input(z.object({
      staffId: z.string(),
      departmentId: z.string().optional(),
    }))
    .query(async ({ input }) => {
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
        preferredPatterns: preferences.preferredPatterns,
        avoidPatterns: preferences.avoidPatterns,
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

      // ✅ SSE: Broadcast preference update event
      sse.staff.preferencesUpdated(staffId, {
        departmentId: departmentId || undefined,
        workPatternType: preferences.workPatternType,
        hasPreferredPatterns: (preferences.preferredPatterns?.length ?? 0) > 0,
        hasAvoidPatterns: (preferences.avoidPatterns?.length ?? 0) > 0,
        tenantId,
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
