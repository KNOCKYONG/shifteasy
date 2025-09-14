/**
 * Web Push Subscribe API endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pushSubscriptionManager } from '@/lib/push/subscription-manager';

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
  topics: z.array(z.string()).default([]),
});

export async function POST(request: NextRequest) {
  try {
    // Extract headers
    const tenantId = request.headers.get('x-tenant-id') || 'default-tenant';
    const userId = request.headers.get('x-user-id') || 'anonymous';

    // Parse and validate request body
    const body = await request.json();
    const validatedData = subscribeSchema.parse(body);

    // Add subscription
    const subscriptionId = pushSubscriptionManager.addSubscription({
      endpoint: validatedData.subscription.endpoint,
      keys: validatedData.subscription.keys,
      userId,
      tenantId,
      topics: validatedData.topics,
      createdAt: new Date(),
      expirationTime: validatedData.subscription.expirationTime,
    });

    return NextResponse.json({
      success: true,
      subscriptionId,
      message: 'Push subscription created successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid subscription data',
          details: (error as any).errors,
        },
        { status: 400 }
      );
    }

    console.error('Push subscription error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create push subscription',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Extract subscription endpoint from query or body
    const url = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json(
        {
          success: false,
          error: 'Subscription endpoint is required',
        },
        { status: 400 }
      );
    }

    // Generate subscription ID from endpoint
    const parts = endpoint.split('/');
    const subscriptionId = parts[parts.length - 1];

    // Remove subscription
    pushSubscriptionManager.removeSubscription(subscriptionId);

    return NextResponse.json({
      success: true,
      message: 'Push subscription removed successfully',
    });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove push subscription',
      },
      { status: 500 }
    );
  }
}