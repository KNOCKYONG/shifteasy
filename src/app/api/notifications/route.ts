/**
 * Notifications API endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { notificationService } from '@/lib/notifications/notification-service';

const isVerboseLoggingEnabled = process.env.NODE_ENV !== 'production';
const logDebug = (...args: Parameters<typeof console.log>) => {
  if (isVerboseLoggingEnabled) {
    console.log(...args);
  }
};

export const dynamic = 'force-dynamic';

const sendNotificationSchema = z.object({
  type: z.enum([
    'schedule_published',
    'schedule_updated',
    'swap_requested',
    'swap_approved',
    'swap_rejected',
    'emergency_call',
    'shift_reminder',
    'general',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  title: z.string(),
  message: z.string(),
  data: z.any().optional(),
  userId: z.string().optional(),
  topic: z.string().optional(),
  actionUrl: z.string().optional(),
  actions: z.array(z.object({
    id: z.string(),
    label: z.string(),
    url: z.string().optional(),
    action: z.string().optional(),
    style: z.enum(['primary', 'secondary', 'danger']).optional(),
  })).optional(),
});

// GET - Get user notifications inbox
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const tenantId = request.headers.get('x-tenant-id') || 'default-tenant';
  const userId = request.headers.get('x-user-id') || 'anonymous';

  logDebug('[API /notifications] GET - Start', { tenantId, userId });

  try {
    const inbox = await notificationService.getUserInbox(tenantId, userId);

    const duration = Date.now() - startTime;
    logDebug('[API /notifications] GET - Success', {
      duration: `${duration}ms`,
      tenantId,
      userId,
      notificationCount: inbox.notifications.length,
      unreadCount: inbox.unreadCount,
    });

    return NextResponse.json({
      success: true,
      inbox,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[API /notifications] GET - Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${duration}ms`,
      tenantId,
      userId,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get notifications',
      },
      { status: 500 }
    );
  }
}

// POST - Send notification
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const tenantId = request.headers.get('x-tenant-id') || 'default-tenant';

  logDebug('[API /notifications] POST - Start', { tenantId });

  try {
    const body = await request.json();
    logDebug('[API /notifications] POST - Request body', {
      type: body.type,
      priority: body.priority,
      userId: body.userId,
      topic: body.topic,
    });

    const validatedData = sendNotificationSchema.parse(body);

    const result = await (async () => {
      if (validatedData.userId) {
        // Send to specific user
        const { userId, ...notificationData } = validatedData;
        logDebug('[API /notifications] POST - Sending to user', { userId, type: validatedData.type });
        return notificationService.sendToUser(
          tenantId,
          userId,
          notificationData
        );
      }

      if (validatedData.topic) {
        // Send to topic
        logDebug('[API /notifications] POST - Sending to topic', { topic: validatedData.topic, type: validatedData.type });
        return notificationService.sendToTopic(
          tenantId,
          validatedData.topic,
          validatedData
        );
      }

      // Broadcast to all
      logDebug('[API /notifications] POST - Broadcasting', { type: validatedData.type });
      return notificationService.broadcast(tenantId, validatedData);
    })();

    const duration = Date.now() - startTime;
    logDebug('[API /notifications] POST - Success', {
      duration: `${duration}ms`,
      result: result ? 'created' : 'failed',
    });

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
      data: result,
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof z.ZodError) {
      console.error('[API /notifications] POST - Validation error', {
        errors: error.issues,
        duration: `${duration}ms`,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid notification data',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('[API /notifications] POST - Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${duration}ms`,
      tenantId,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send notification',
      },
      { status: 500 }
    );
  }
}

// PATCH - Mark notification as read
export async function PATCH(request: NextRequest) {
  const startTime = Date.now();
  const tenantId = request.headers.get('x-tenant-id') || 'default-tenant';
  const userId = request.headers.get('x-user-id') || 'anonymous';

  logDebug('[API /notifications] PATCH - Start', { tenantId, userId });

  try {
    const body = await request.json();
    const { notificationId } = body;

    if (!notificationId) {
      console.warn('[API /notifications] PATCH - Missing notificationId');
      return NextResponse.json(
        {
          success: false,
          error: 'Notification ID is required',
        },
        { status: 400 }
      );
    }

    logDebug('[API /notifications] PATCH - Marking as read', { notificationId, userId });
    const success = await notificationService.markAsRead(tenantId, userId, notificationId);

    const duration = Date.now() - startTime;

    if (!success) {
      logDebug('[API /notifications] PATCH - Failed to mark as read', {
        duration: `${duration}ms`,
        notificationId,
        userId,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Notification not found or already read',
        },
        { status: 404 }
      );
    }

    logDebug('[API /notifications] PATCH - Success', {
      duration: `${duration}ms`,
      notificationId,
      userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[API /notifications] PATCH - Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${duration}ms`,
      tenantId,
      userId,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to mark notification as read',
      },
      { status: 500 }
    );
  }
}

// DELETE - Clear all notifications
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  const tenantId = request.headers.get('x-tenant-id') || 'default-tenant';
  const userId = request.headers.get('x-user-id') || 'anonymous';

  console.log('[API /notifications] DELETE - Start', { tenantId, userId });

  try {
    const clearedCount = await notificationService.clearUserNotifications(tenantId, userId);

    const duration = Date.now() - startTime;
    console.log('[API /notifications] DELETE - Success', {
      duration: `${duration}ms`,
      tenantId,
      userId,
      clearedCount,
    });

    return NextResponse.json({
      success: true,
      message: 'Notifications cleared successfully',
      clearedCount,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[API /notifications] DELETE - Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${duration}ms`,
      tenantId,
      userId,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear notifications',
      },
      { status: 500 }
    );
  }
}
