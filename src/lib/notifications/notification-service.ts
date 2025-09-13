/**
 * Unified Notification Service for real-time events
 */

import { sseManager, notifyScheduleUpdate, notifySwapRequest, notifySwapApproval } from '@/lib/sse/sseManager';
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
  userId?: string;
  tenantId: string;
  topic?: string;
  createdAt: Date;
  readAt?: Date;
  actionUrl?: string;
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
  private inboxes: Map<string, NotificationInbox> = new Map();
  private notificationQueue: Map<string, Notification[]> = new Map();

  private constructor() {}

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
    notification: Omit<Notification, 'id' | 'createdAt' | 'tenantId'>
  ): Promise<void> {
    const fullNotification: Notification = {
      ...notification,
      id: this.generateNotificationId(),
      tenantId,
      userId,
      createdAt: new Date(),
    };

    // Add to inbox
    this.addToInbox(tenantId, userId, fullNotification);

    // Send via SSE
    sseManager.broadcast({
      type: 'notification',
      data: fullNotification,
      userId,
      timestamp: Date.now(),
    }, (clientId) => {
      // Filter by user ID (would need proper client-user mapping)
      return clientId.includes(userId);
    });

    // Queue for push notification
    if (notification.priority === 'high' || notification.priority === 'urgent') {
      await this.sendPushNotification(tenantId, userId, fullNotification);
    }
  }

  /**
   * Send notification to topic subscribers
   */
  async sendToTopic(
    tenantId: string,
    topic: string,
    notification: Omit<Notification, 'id' | 'createdAt' | 'tenantId' | 'topic'>
  ): Promise<void> {
    const fullNotification: Notification = {
      ...notification,
      id: this.generateNotificationId(),
      tenantId,
      topic,
      createdAt: new Date(),
    };

    // Send via SSE to topic subscribers
    sseManager.broadcast({
      type: 'notification',
      data: fullNotification,
      timestamp: Date.now(),
    }, (clientId) => {
      // Filter by topic subscription (would need proper implementation)
      return true;
    });

    // Send push notifications to topic subscribers
    if (notification.priority === 'high' || notification.priority === 'urgent') {
      await this.sendPushToTopic(tenantId, topic, fullNotification);
    }
  }

  /**
   * Broadcast notification to all users in tenant
   */
  async broadcast(
    tenantId: string,
    notification: Omit<Notification, 'id' | 'createdAt' | 'tenantId'>
  ): Promise<void> {
    const fullNotification: Notification = {
      ...notification,
      id: this.generateNotificationId(),
      tenantId,
      createdAt: new Date(),
    };

    // Send via SSE
    sseManager.broadcast({
      type: 'notification',
      data: fullNotification,
      timestamp: Date.now(),
    });

    // For urgent notifications, send push to all
    if (notification.priority === 'urgent') {
      await this.sendPushBroadcast(tenantId, fullNotification);
    }
  }

  /**
   * Schedule published event
   */
  async notifySchedulePublished(
    tenantId: string,
    scheduleId: string,
    period: { start: Date; end: Date },
    affectedUsers: string[]
  ): Promise<void> {
    const notification = {
      type: 'schedule_published' as NotificationType,
      priority: 'high' as NotificationPriority,
      title: 'New Schedule Published',
      message: `Your schedule for ${period.start.toLocaleDateString()} - ${period.end.toLocaleDateString()} is now available`,
      data: { scheduleId, period },
      actionUrl: '/schedule',
    };

    // Notify affected users
    for (const userId of affectedUsers) {
      await this.sendToUser(tenantId, userId, notification);
    }

    // Update via SSE
    notifyScheduleUpdate(scheduleId, { published: true, period });
  }

  /**
   * Swap request event
   */
  async notifySwapRequested(
    tenantId: string,
    swapData: {
      requestId: string;
      requesterId: string;
      targetId: string;
      date: Date;
      shift: string;
      reason?: string;
    }
  ): Promise<void> {
    // Notify target user
    await this.sendToUser(tenantId, swapData.targetId, {
      type: 'swap_requested',
      priority: 'high',
      title: 'Shift Swap Request',
      message: `You have a new shift swap request for ${swapData.date.toLocaleDateString()}`,
      data: swapData,
      actionUrl: `/swaps/${swapData.requestId}`,
      actions: [
        {
          id: 'approve',
          label: 'Approve',
          action: 'approve_swap',
          style: 'primary',
        },
        {
          id: 'reject',
          label: 'Reject',
          action: 'reject_swap',
          style: 'secondary',
        },
      ],
    });

    // Update via SSE
    notifySwapRequest(swapData);
  }

  /**
   * Swap approval event
   */
  async notifySwapApproved(
    tenantId: string,
    swapId: string,
    requesterId: string,
    approverId: string
  ): Promise<void> {
    // Notify requester
    await this.sendToUser(tenantId, requesterId, {
      type: 'swap_approved',
      priority: 'medium',
      title: 'Shift Swap Approved',
      message: 'Your shift swap request has been approved',
      data: { swapId, approverId },
      actionUrl: `/swaps/${swapId}`,
    });

    // Update via SSE
    notifySwapApproval(swapId, approverId);
  }

  /**
   * Emergency call event
   */
  async notifyEmergencyCall(
    tenantId: string,
    wardId: string,
    message: string,
    targetUsers: string[]
  ): Promise<void> {
    const notification = {
      type: 'emergency_call' as NotificationType,
      priority: 'urgent' as NotificationPriority,
      title: '🚨 Emergency Call',
      message,
      data: { wardId },
      actions: [
        {
          id: 'accept',
          label: 'Accept',
          action: 'accept_emergency',
          style: 'danger' as const,
        },
      ],
    };

    // Send to all target users
    for (const userId of targetUsers) {
      await this.sendToUser(tenantId, userId, notification);
    }

    // Also broadcast to ward topic
    await this.sendToTopic(tenantId, `ward:${wardId}:emergency`, notification);
  }

  /**
   * Get user inbox
   */
  getUserInbox(tenantId: string, userId: string): NotificationInbox {
    const key = `${tenantId}:${userId}`;
    let inbox = this.inboxes.get(key);

    if (!inbox) {
      inbox = {
        userId,
        tenantId,
        notifications: [],
        unreadCount: 0,
      };
      this.inboxes.set(key, inbox);
    }

    return inbox;
  }

  /**
   * Mark notification as read
   */
  markAsRead(tenantId: string, userId: string, notificationId: string): void {
    const inbox = this.getUserInbox(tenantId, userId);
    const notification = inbox.notifications.find(n => n.id === notificationId);

    if (notification && !notification.readAt) {
      notification.readAt = new Date();
      inbox.unreadCount = Math.max(0, inbox.unreadCount - 1);

      // Send update via SSE
      sseManager.broadcast({
        type: 'notification',
        data: {
          action: 'mark_read',
          notificationId,
        },
        userId,
        timestamp: Date.now(),
      }, (clientId) => clientId.includes(userId));
    }
  }

  /**
   * Clear user notifications
   */
  clearUserNotifications(tenantId: string, userId: string): void {
    const key = `${tenantId}:${userId}`;
    const inbox = this.inboxes.get(key);

    if (inbox) {
      inbox.notifications = [];
      inbox.unreadCount = 0;
    }
  }

  /**
   * Add notification to inbox
   */
  private addToInbox(tenantId: string, userId: string, notification: Notification): void {
    const inbox = this.getUserInbox(tenantId, userId);

    // Add to beginning of array (newest first)
    inbox.notifications.unshift(notification);
    inbox.unreadCount++;

    // Keep only last 100 notifications
    if (inbox.notifications.length > 100) {
      inbox.notifications = inbox.notifications.slice(0, 100);
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(
    tenantId: string,
    userId: string,
    notification: Notification
  ): Promise<void> {
    const subscriptions = pushSubscriptionManager.getUserSubscriptions(tenantId, userId);

    for (const subscription of subscriptions) {
      // In production, would send actual push notification
      console.log(`Would send push to ${subscription.endpoint}:`, notification);
    }
  }

  /**
   * Send push to topic
   */
  private async sendPushToTopic(
    tenantId: string,
    topic: string,
    notification: Notification
  ): Promise<void> {
    const subscriptions = pushSubscriptionManager.getTopicSubscriptions(tenantId, topic);

    for (const subscription of subscriptions) {
      // In production, would send actual push notification
      console.log(`Would send push to topic ${topic}:`, notification);
    }
  }

  /**
   * Send push broadcast
   */
  private async sendPushBroadcast(
    tenantId: string,
    notification: Notification
  ): Promise<void> {
    const subscriptions = pushSubscriptionManager.getTenantSubscriptions(tenantId);

    for (const subscription of subscriptions) {
      // In production, would send actual push notification
      console.log(`Would broadcast push:`, notification);
    }
  }

  /**
   * Generate notification ID
   */
  private generateNotificationId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const notificationService = NotificationService.getInstance();