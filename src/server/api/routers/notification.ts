import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { scopedDb } from '@/lib/db-helpers';
import { notifications, pushSubscriptions } from '@/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

export const notificationRouter = createTRPCRouter({
  feed: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),
      offset: z.number().default(0),
      unreadOnly: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

      let conditions = [eq(notifications.userId, (ctx.user?.id || 'dev-user-id'))];

      if (input.unreadOnly) {
        conditions.push(eq(notifications.read, 'false'));
      }

      const results = await db.query(notifications, and(...conditions));

      return {
        items: results
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(input.offset, input.offset + input.limit),
        total: results.length,
        unreadCount: results.filter(n => n.read === 'false').length,
      };
    }),

  read: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

      const [notification] = await db.query(notifications, eq(notifications.id, input.id));

      if (!notification) {
        throw new Error('Notification not found');
      }

      if (notification.userId !== (ctx.user?.id || 'dev-user-id')) {
        throw new Error('This notification does not belong to you');
      }

      const [updated] = await db.update(
        notifications,
        { read: 'true', updatedAt: new Date() },
        eq(notifications.id, input.id)
      );

      return updated;
    }),

  markAllRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

      const unreadNotifications = await db.query(
        notifications,
        and(
          eq(notifications.userId, (ctx.user?.id || 'dev-user-id')),
          eq(notifications.read, 'false')
        )
      );

      if (unreadNotifications.length === 0) {
        return { count: 0 };
      }

      await Promise.all(
        unreadNotifications.map(n =>
          db.update(
            notifications,
            { read: 'true', updatedAt: new Date() },
            eq(notifications.id, n.id)
          )
        )
      );

      return { count: unreadNotifications.length };
    }),

  subscribePush: protectedProcedure
    .input(z.object({
      endpoint: z.string(),
      keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
      }),
      device: z.object({
        browser: z.string().optional(),
        os: z.string().optional(),
        userAgent: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

      // Check if subscription already exists
      const [existing] = await db.query(
        pushSubscriptions,
        eq(pushSubscriptions.endpoint, input.endpoint)
      );

      if (existing) {
        // Update existing subscription
        const [updated] = await db.update(
          pushSubscriptions,
          {
            keys: input.keys,
            device: input.device,
            updatedAt: new Date(),
          },
          eq(pushSubscriptions.id, existing.id)
        );
        return updated;
      }

      // Create new subscription
      const [created] = await db.insert(pushSubscriptions, {
        userId: (ctx.user?.id || 'dev-user-id'),
        ...input,
      });

      return created;
    }),

  unsubscribePush: protectedProcedure
    .input(z.object({
      endpoint: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

      const [subscription] = await db.query(
        pushSubscriptions,
        and(
          eq(pushSubscriptions.endpoint, input.endpoint),
          eq(pushSubscriptions.userId, (ctx.user?.id || 'dev-user-id'))
        )
      );

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      await db.hardDelete(
        pushSubscriptions,
        eq(pushSubscriptions.id, subscription.id)
      );

      return { success: true };
    }),
});