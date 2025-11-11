/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Notification Manager
 * 실시간 알림 및 이메일 알림을 관리하는 시스템
 */

export type NotificationType =
  | 'schedule_published'
  | 'schedule_updated'
  | 'swap_request'
  | 'swap_approved'
  | 'swap_rejected'
  | 'shift_reminder'
  | 'constraint_violation'
  | 'system_alert';

export interface Notification {
  id: string;
  type: NotificationType;
  recipientId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  createdAt: Date;
  readAt?: Date;
}

export interface NotificationPreferences {
  userId: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
  types: {
    [key in NotificationType]?: {
      enabled: boolean;
      email?: boolean;
      push?: boolean;
    };
  };
  quietHours?: {
    enabled: boolean;
    start: string; // HH:mm
    end: string;   // HH:mm
  };
}

class NotificationManager {
  private notifications: Map<string, Notification[]> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();
  private listeners: Map<string, ((notification: Notification) => void)[]> = new Map();

  /**
   * Send a notification to a user
   */
  async sendNotification(
    recipientId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
  ): Promise<Notification> {
    const notification: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      recipientId,
      title,
      message,
      data,
      priority,
      read: false,
      createdAt: new Date(),
    };

    // Store notification
    const userNotifications = this.notifications.get(recipientId) || [];
    userNotifications.unshift(notification);
    this.notifications.set(recipientId, userNotifications);

    // Check user preferences
    const prefs = this.preferences.get(recipientId);

    if (this.shouldSendNotification(prefs, type)) {
      // Check quiet hours
      if (!this.isInQuietHours(prefs)) {
        // Send based on preferences
        if (prefs?.email || prefs?.types[type]?.email) {
          await this.sendEmailNotification(recipientId, notification);
        }

        if (prefs?.push || prefs?.types[type]?.push) {
          await this.sendPushNotification(recipientId, notification);
        }
      }
    }

    // Trigger listeners
    const userListeners = this.listeners.get(recipientId) || [];
    userListeners.forEach(listener => listener(notification));

    console.log(`[Notification] Sent to ${recipientId}: ${type} - ${title}`);

    return notification;
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(
    recipientIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<Notification[]> {
    const notifications = await Promise.all(
      recipientIds.map(id => this.sendNotification(id, type, title, message, data))
    );
    return notifications;
  }

  /**
   * Get notifications for a user
   */
  getNotifications(userId: string, unreadOnly = false): Notification[] {
    const notifications = this.notifications.get(userId) || [];
    return unreadOnly ? notifications.filter(n => !n.read) : notifications;
  }

  /**
   * Mark notification as read
   */
  markAsRead(userId: string, notificationId: string): boolean {
    const notifications = this.notifications.get(userId) || [];
    const notification = notifications.find(n => n.id === notificationId);

    if (notification && !notification.read) {
      notification.read = true;
      notification.readAt = new Date();
      return true;
    }

    return false;
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(userId: string): number {
    const notifications = this.notifications.get(userId) || [];
    let count = 0;

    notifications.forEach(notification => {
      if (!notification.read) {
        notification.read = true;
        notification.readAt = new Date();
        count++;
      }
    });

    return count;
  }

  /**
   * Set user notification preferences
   */
  setPreferences(userId: string, preferences: NotificationPreferences): void {
    this.preferences.set(userId, preferences);
  }

  /**
   * Subscribe to notifications
   */
  subscribe(userId: string, callback: (notification: Notification) => void): () => void {
    const userListeners = this.listeners.get(userId) || [];
    userListeners.push(callback);
    this.listeners.set(userId, userListeners);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(userId) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Clear old notifications
   */
  clearOldNotifications(userId: string, daysToKeep = 30): number {
    const notifications = this.notifications.get(userId) || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const filtered = notifications.filter(n => n.createdAt > cutoffDate);
    const removed = notifications.length - filtered.length;

    this.notifications.set(userId, filtered);
    return removed;
  }

  /**
   * Check if notification should be sent
   */
  private shouldSendNotification(
    prefs: NotificationPreferences | undefined,
    type: NotificationType
  ): boolean {
    if (!prefs) return true; // Default to sending if no preferences

    // Check if type is enabled
    const typePrefs = prefs.types[type];
    if (typePrefs && typePrefs.enabled === false) {
      return false;
    }

    return prefs.inApp !== false;
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(prefs: NotificationPreferences | undefined): boolean {
    if (!prefs?.quietHours?.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = prefs.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = prefs.quietHours.end.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Send email notification (mock)
   */
  private async sendEmailNotification(recipientId: string, notification: Notification): Promise<void> {
    // In production, this would integrate with an email service
    console.log(`[Email] To: ${recipientId}, Subject: ${notification.title}`);
  }

  /**
   * Send push notification (mock)
   */
  private async sendPushNotification(recipientId: string, notification: Notification): Promise<void> {
    // In production, this would integrate with a push notification service
    console.log(`[Push] To: ${recipientId}, Title: ${notification.title}`);
  }
}

// Create singleton instance
export const notificationManager = new NotificationManager();

// Helper functions for specific notification types
export const notificationHelpers = {
  /**
   * Notify about schedule publication
   */
  schedulePublished: (
    employeeIds: string[],
    scheduleId: string,
    period: { start: Date; end: Date }
  ) => {
    return notificationManager.sendBulkNotifications(
      employeeIds,
      'schedule_published',
      '새 스케줄이 발표되었습니다',
      `${period.start.toLocaleDateString()} - ${period.end.toLocaleDateString()} 주간 스케줄이 확정되었습니다.`,
      { scheduleId, period }
    );
  },

  /**
   * Notify about swap request
   */
  swapRequest: (
    targetEmployeeId: string,
    requesterId: string,
    requesterName: string,
    shiftDate: Date,
    shiftTime: string
  ) => {
    return notificationManager.sendNotification(
      targetEmployeeId,
      'swap_request',
      '시프트 교환 요청',
      `${requesterName}님이 ${shiftDate.toLocaleDateString()} ${shiftTime} 시프트 교환을 요청했습니다.`,
      { requesterId, shiftDate, shiftTime },
      'high'
    );
  },

  /**
   * Notify about swap approval
   */
  swapApproved: (
    requesterId: string,
    swapId: string,
    approverName: string
  ) => {
    return notificationManager.sendNotification(
      requesterId,
      'swap_approved',
      '시프트 교환 승인',
      `${approverName}님이 시프트 교환 요청을 승인했습니다.`,
      { swapId, approverName },
      'high'
    );
  },

  /**
   * Notify about constraint violation
   */
  constraintViolation: (
    managerId: string,
    violationType: string,
    affectedEmployees: string[],
    severity: 'low' | 'medium' | 'high'
  ) => {
    return notificationManager.sendNotification(
      managerId,
      'constraint_violation',
      '제약조건 위반 경고',
      `${violationType} 제약조건이 위반되었습니다. ${affectedEmployees.length}명의 직원이 영향을 받습니다.`,
      { violationType, affectedEmployees },
      severity === 'high' ? 'urgent' : 'high'
    );
  },

  /**
   * Send shift reminder
   */
  shiftReminder: (
    employeeId: string,
    shiftTime: string,
    shiftLocation: string
  ) => {
    return notificationManager.sendNotification(
      employeeId,
      'shift_reminder',
      '근무 알림',
      `내일 ${shiftTime}에 ${shiftLocation}에서 근무가 예정되어 있습니다.`,
      { shiftTime, shiftLocation },
      'medium'
    );
  },
};