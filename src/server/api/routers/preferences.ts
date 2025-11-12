import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { createAuditLog } from '@/lib/db-helpers';
import { db } from '@/db';
import { nursePreferences } from '@/db/schema/nurse-preferences';
import { users } from '@/db/schema/tenants';
import { eq } from 'drizzle-orm';
import { sse } from '@/lib/sse/broadcaster';
import { ensureNotificationPreferencesColumn } from '@/lib/db/ensureNotificationPreferencesColumn';

type NotificationPreferences = {
  enabled?: boolean;
  channels?: {
    sse?: boolean;
    push?: boolean;
    email?: boolean;
  };
  types?: {
    handoff_submitted?: boolean;
    handoff_completed?: boolean;
    handoff_critical_patient?: boolean;
    handoff_reminder?: boolean;
    schedule_published?: boolean;
    schedule_updated?: boolean;
    swap_requested?: boolean;
    swap_approved?: boolean;
    swap_rejected?: boolean;
  };
  quietHours?: {
    enabled?: boolean;
    start?: string;
    end?: string;
  };
};

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
      await ensureNotificationPreferencesColumn();

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

  // Get notification preferences for current user
  getNotificationPreferences: protectedProcedure
    .query(async ({ ctx }) => {
      await ensureNotificationPreferencesColumn();

      const userId = ctx.user?.id || 'dev-user-id';

      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new Error('User not found');
      }

      // Return notification preferences with defaults if not set
      return user.notificationPreferences || {
        enabled: true,
        channels: { sse: true, push: false, email: false },
        types: {
          handoff_submitted: true,
          handoff_completed: true,
          handoff_critical_patient: true,
          handoff_reminder: true,
          schedule_published: true,
          schedule_updated: true,
          swap_requested: true,
          swap_approved: true,
          swap_rejected: true,
        },
        quietHours: { enabled: false, start: '22:00', end: '08:00' },
      };
    }),

  // Update notification preferences for current user
  updateNotificationPreferences: protectedProcedure
    .input(z.object({
      enabled: z.boolean().optional(),
      channels: z.object({
        sse: z.boolean().optional(),
        push: z.boolean().optional(),
        email: z.boolean().optional(),
      }).optional(),
      types: z.object({
        handoff_submitted: z.boolean().optional(),
        handoff_completed: z.boolean().optional(),
        handoff_critical_patient: z.boolean().optional(),
        handoff_reminder: z.boolean().optional(),
        schedule_published: z.boolean().optional(),
        schedule_updated: z.boolean().optional(),
        swap_requested: z.boolean().optional(),
        swap_approved: z.boolean().optional(),
        swap_rejected: z.boolean().optional(),
      }).optional(),
      quietHours: z.object({
        enabled: z.boolean().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureNotificationPreferencesColumn();

      const userId = ctx.user?.id || 'dev-user-id';
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Get current preferences
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new Error('User not found');
      }

      const currentPrefs = (user.notificationPreferences as NotificationPreferences | null) || {};

      // Merge with new preferences
      const updatedPrefs = {
        enabled: input.enabled !== undefined ? input.enabled : currentPrefs.enabled ?? true,
        channels: {
          ...(currentPrefs.channels || {}),
          ...(input.channels || {}),
        },
        types: {
          ...(currentPrefs.types || {}),
          ...(input.types || {}),
        },
        quietHours: {
          ...(currentPrefs.quietHours || {}),
          ...(input.quietHours || {}),
        },
      };

      // Update user preferences
      const [updated] = await db.update(users)
        .set({
          notificationPreferences: updatedPrefs,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      // Create audit log
      await createAuditLog({
        tenantId,
        actorId: userId,
        action: 'notification_preferences.updated',
        entityType: 'user',
        entityId: userId,
        before: { notificationPreferences: currentPrefs },
        after: { notificationPreferences: updatedPrefs },
      });

      return updated.notificationPreferences;
    }),
});
