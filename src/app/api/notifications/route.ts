/**
 * Notifications API endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { notificationService } from '@/lib/notifications/notification-service';

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
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'default-tenant';
    const userId = request.headers.get('x-user-id') || 'anonymous';

    const inbox = notificationService.getUserInbox(tenantId, userId);

    return NextResponse.json({
      success: true,
      inbox,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
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
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'default-tenant';
    const body = await request.json();
    const validatedData = sendNotificationSchema.parse(body);

    if (validatedData.userId) {
      // Send to specific user
      const { userId, ...notificationData } = validatedData;
      await notificationService.sendToUser(
        tenantId,
        userId,
        notificationData
      );
    } else if (validatedData.topic) {
      // Send to topic
      await notificationService.sendToTopic(
        tenantId,
        validatedData.topic,
        validatedData
      );
    } else {
      // Broadcast to all
      await notificationService.broadcast(tenantId, validatedData);
    }

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid notification data',
          details: (error as any).errors,
        },
        { status: 400 }
      );
    }

    console.error('Send notification error:', error);
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
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'default-tenant';
    const userId = request.headers.get('x-user-id') || 'anonymous';

    const body = await request.json();
    const { notificationId } = body;

    if (!notificationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Notification ID is required',
        },
        { status: 400 }
      );
    }

    notificationService.markAsRead(tenantId, userId, notificationId);

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
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
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'default-tenant';
    const userId = request.headers.get('x-user-id') || 'anonymous';

    notificationService.clearUserNotifications(tenantId, userId);

    return NextResponse.json({
      success: true,
      message: 'Notifications cleared successfully',
    });
  } catch (error) {
    console.error('Clear notifications error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear notifications',
      },
      { status: 500 }
    );
  }
}