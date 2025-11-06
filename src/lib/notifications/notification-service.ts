/**
 * Unified Notification Service with Supabase persistence
 * All operations are logged for debugging and monitoring
 */

import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { sseManager } from '@/lib/sse/sseManager';
import { pushSubscriptionManager } from '@/lib/push/subscription-manager';

export type NotificationType =
  | 'schedule_published'
  | 'schedule_updated'
  | 'swap_requested'
  | 'swap_approved'
  | 'swap_rejected'
  | 'emergency_call'
  | 'shift_reminder'
  | 'general';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: any;
  userId?: string | null;
  tenantId: string;
  departmentId?: string | null;
  topic?: string | null;
  createdAt: Date;
  readAt?: Date | null;
  deliveredAt?: Date | null;
  actionUrl?: string | null;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  label: string;
  url?: string;
  action?: string;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface NotificationInbox {
  userId: string;
  tenantId: string;
  notifications: Notification[];
  unreadCount: number;
}

class NotificationService {
  private static instance: NotificationService;

  private constructor() {
    console.log('[NotificationService] Initialized with Supabase backend');
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Send notification to user
   */
  async sendToUser(
    tenantId: string,
    userId: string,
    notification: Omit<Notification, 'id' | 'createdAt' | 'tenantId' | 'userId'>
  ): Promise<Notification | null> {
    const startTime = Date.now();
    console.log(`[NotificationService] sendToUser - Start`, {
      tenantId,
      userId,
      type: notification.type,
      priority: notification.priority,
      title: notification.title,
    });

    try {
      // Insert notification into database
      const [created] = await db.insert(notifications).values({
        tenantId,
        userId,
        type: notification.type,
        priority: notification.priority,
        title: notification.title,
        message: notification.message,
        actionUrl: notification.actionUrl,
        topic: notification.topic,
        departmentId: notification.departmentId,
        data: notification.data,
        actions: notification.actions,
        deliveredAt: new Date(),
      }).returning();

      if (!created) {
        console.error('[NotificationService] sendToUser - Failed to create notification in database');
        return null;
      }

      const fullNotification: Notification = {
        ...created,
        type: created.type as NotificationType,
        priority: created.priority as NotificationPriority,
        data: created.data,
        actions: created.actions as NotificationAction[] | undefined,
      };

      const duration = Date.now() - startTime;
      console.log(`[NotificationService] sendToUser - Success`, {
        notificationId: created.id,
        duration: `${duration}ms`,
        tenantId,
        userId,
      });

      // Send via SSE for real-time delivery
      try {
        sseManager.broadcast({
          type: 'notification',
          data: fullNotification,
          userId,
          timestamp: Date.now(),
        }, (clientId) => {
          return clientId.includes(userId);
        });
        console.log(`[NotificationService] sendToUser - SSE broadcast sent`, { userId, notificationId: created.id });
      } catch (sseError) {
        console.error('[NotificationService] sendToUser - SSE broadcast failed', { error: sseError, userId });
      }

      // Queue for push notification if high priority
      if (notification.priority === 'high' || notification.priority === 'urgent') {
        await this.sendPushNotification(tenantId, userId, fullNotification);
      }

      return fullNotification;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[NotificationService] sendToUser - Error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${duration}ms`,
        tenantId,
        userId,
        notificationType: notification.type,
      });
      return null;
    }
  }

  /**
   * Send notification to topic subscribers
   */
  async sendToTopic(
    tenantId: string,
    topic: string,
    notification: Omit<Notification, 'id' | 'createdAt' | 'tenantId' | 'topic'>
  ): Promise<boolean> {
    const startTime = Date.now();
    console.log(`[NotificationService] sendToTopic - Start`, {
      tenantId,
      topic,
      type: notification.type,
      priority: notification.priority,
    });

    try {
      // Insert notification without specific userId (topic-based)
      const [created] = await db.insert(notifications).values({
        tenantId,
        userId: null,
        topic,
        type: notification.type,
        priority: notification.priority,
        title: notification.title,
        message: notification.message,
        actionUrl: notification.actionUrl,
        departmentId: notification.departmentId,
        data: notification.data,
        actions: notification.actions,
        deliveredAt: new Date(),
      }).returning();

      if (!created) {
        console.error('[NotificationService] sendToTopic - Failed to create notification');
        return false;
      }

      const fullNotification: Notification = {
        ...created,
        type: created.type as NotificationType,
        priority: created.priority as NotificationPriority,
        data: created.data,
        actions: created.actions as NotificationAction[] | undefined,
      };

      // Broadcast via SSE to all subscribers of this topic
      try {
        sseManager.broadcast({
          type: 'notification',
          data: fullNotification,
          timestamp: Date.now(),
        });
        console.log(`[NotificationService] sendToTopic - SSE broadcast sent`, { topic, notificationId: created.id });
      } catch (sseError) {
        console.error('[NotificationService] sendToTopic - SSE broadcast failed', { error: sseError, topic });
      }

      const duration = Date.now() - startTime;
      console.log(`[NotificationService] sendToTopic - Success`, {
        notificationId: created.id,
        duration: `${duration}ms`,
        topic,
      });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[NotificationService] sendToTopic - Error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${duration}ms`,
        tenantId,
        topic,
      });
      return false;
    }
  }

  /**
   * Broadcast notification to all users in tenant
   */
  async broadcast(
    tenantId: string,
    notification: Omit<Notification, 'id' | 'createdAt' | 'tenantId'>
  ): Promise<boolean> {
    const startTime = Date.now();
    console.log(`[NotificationService] broadcast - Start`, {
      tenantId,
      type: notification.type,
      priority: notification.priority,
    });

    try {
      // Insert broadcast notification
      const [created] = await db.insert(notifications).values({
        tenantId,
        userId: null,
        type: notification.type,
        priority: notification.priority,
        title: notification.title,
        message: notification.message,
        actionUrl: notification.actionUrl,
        departmentId: notification.departmentId,
        data: notification.data,
        actions: notification.actions,
        deliveredAt: new Date(),
      }).returning();

      if (!created) {
        console.error('[NotificationService] broadcast - Failed to create notification');
        return false;
      }

      const fullNotification: Notification = {
        ...created,
        type: created.type as NotificationType,
        priority: created.priority as NotificationPriority,
        data: created.data,
        actions: created.actions as NotificationAction[] | undefined,
      };

      // Broadcast via SSE
      try {
        sseManager.broadcast({
          type: 'notification',
          data: fullNotification,
          timestamp: Date.now(),
        });
        console.log(`[NotificationService] broadcast - SSE broadcast sent`, { notificationId: created.id });
      } catch (sseError) {
        console.error('[NotificationService] broadcast - SSE broadcast failed', { error: sseError });
      }

      const duration = Date.now() - startTime;
      console.log(`[NotificationService] broadcast - Success`, {
        notificationId: created.id,
        duration: `${duration}ms`,
        tenantId,
      });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[NotificationService] broadcast - Error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${duration}ms`,
        tenantId,
      });
      return false;
    }
  }

  /**
   * Get user inbox from database
   */
  async getUserInbox(tenantId: string, userId: string): Promise<NotificationInbox> {
    const startTime = Date.now();
    console.log(`[NotificationService] getUserInbox - Start`, { tenantId, userId });

    try {
      // Query notifications for this user
      const userNotifications = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.tenantId, tenantId),
            eq(notifications.userId, userId)
          )
        )
        .orderBy(desc(notifications.createdAt))
        .limit(100);

      // Count unread notifications
      const unreadCount = userNotifications.filter(n => !n.readAt).length;

      const inbox: NotificationInbox = {
        userId,
        tenantId,
        notifications: userNotifications.map(n => ({
          ...n,
          type: n.type as NotificationType,
          priority: n.priority as NotificationPriority,
          data: n.data,
          actions: n.actions as NotificationAction[] | undefined,
        })),
        unreadCount,
      };

      const duration = Date.now() - startTime;
      console.log(`[NotificationService] getUserInbox - Success`, {
        duration: `${duration}ms`,
        tenantId,
        userId,
        totalNotifications: userNotifications.length,
        unreadCount,
      });

      return inbox;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[NotificationService] getUserInbox - Error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${duration}ms`,
        tenantId,
        userId,
      });

      // Return empty inbox on error
      return {
        userId,
        tenantId,
        notifications: [],
        unreadCount: 0,
      };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(tenantId: string, userId: string, notificationId: string): Promise<boolean> {
    const startTime = Date.now();
    console.log(`[NotificationService] markAsRead - Start`, {
      tenantId,
      userId,
      notificationId,
    });

    try {
      // Verify notification belongs to user
      const [notification] = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.tenantId, tenantId),
            eq(notifications.userId, userId)
          )
        )
        .limit(1);

      if (!notification) {
        console.warn('[NotificationService] markAsRead - Notification not found or access denied', {
          notificationId,
          userId,
          tenantId,
        });
        return false;
      }

      if (notification.readAt) {
        console.log('[NotificationService] markAsRead - Already read', {
          notificationId,
          readAt: notification.readAt,
        });
        return true;
      }

      // Update readAt timestamp
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(eq(notifications.id, notificationId));

      const duration = Date.now() - startTime;
      console.log(`[NotificationService] markAsRead - Success`, {
        duration: `${duration}ms`,
        notificationId,
        userId,
      });

      // Send SSE update
      try {
        sseManager.broadcast({
          type: 'notification',
          data: {
            action: 'mark_read',
            notificationId,
          },
          userId,
          timestamp: Date.now(),
        }, (clientId) => clientId.includes(userId));
      } catch (sseError) {
        console.error('[NotificationService] markAsRead - SSE update failed', { error: sseError });
      }

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[NotificationService] markAsRead - Error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${duration}ms`,
        notificationId,
        userId,
      });
      return false;
    }
  }

  /**
   * Clear user notifications (soft delete by marking as read)
   */
  async clearUserNotifications(tenantId: string, userId: string): Promise<number> {
    const startTime = Date.now();
    console.log(`[NotificationService] clearUserNotifications - Start`, {
      tenantId,
      userId,
    });

    try {
      // First, get count of unread notifications
      const unreadNotifs = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.tenantId, tenantId),
            eq(notifications.userId, userId),
            isNull(notifications.readAt)
          )
        );

      const clearedCount = unreadNotifs.length;

      if (clearedCount > 0) {
        // Mark all unread notifications as read
        await db
          .update(notifications)
          .set({ readAt: new Date() })
          .where(
            and(
              eq(notifications.tenantId, tenantId),
              eq(notifications.userId, userId),
              isNull(notifications.readAt)
            )
          );
      }

      const duration = Date.now() - startTime;
      console.log(`[NotificationService] clearUserNotifications - Success`, {
        duration: `${duration}ms`,
        tenantId,
        userId,
        clearedCount,
      });

      return clearedCount;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[NotificationService] clearUserNotifications - Error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${duration}ms`,
        tenantId,
        userId,
      });
      return 0;
    }
  }

  /**
   * Send push notification (placeholder for future implementation)
   */
  private async sendPushNotification(
    tenantId: string,
    userId: string,
    notification: Notification
  ): Promise<void> {
    console.log(`[NotificationService] sendPushNotification - Start`, {
      tenantId,
      userId,
      notificationId: notification.id,
      priority: notification.priority,
    });

    try {
      const subscriptions = pushSubscriptionManager.getUserSubscriptions(tenantId, userId);

      if (subscriptions.length === 0) {
        console.log(`[NotificationService] sendPushNotification - No push subscriptions found`, { userId });
        return;
      }

      // In production, would send actual push notification
      console.log(`[NotificationService] sendPushNotification - Would send to ${subscriptions.length} subscriptions`, {
        userId,
        notificationId: notification.id,
        subscriptionCount: subscriptions.length,
      });
    } catch (error) {
      console.error('[NotificationService] sendPushNotification - Error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        notificationId: notification.id,
      });
    }
  }
}

export const notificationService = NotificationService.getInstance();
