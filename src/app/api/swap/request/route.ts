import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { type SwapRequest } from '@/lib/scheduler/types';
import { swapStorage } from '@/lib/swap/storage';

// Request validation schema
const CreateSwapRequestSchema = z.object({
  requesterId: z.string(),
  targetEmployeeId: z.string().optional(),
  originalAssignment: z.object({
    employeeId: z.string(),
    shiftId: z.string(),
    date: z.string(),
    isLocked: z.boolean(),
  }),
  targetAssignment: z.object({
    employeeId: z.string(),
    shiftId: z.string(),
    date: z.string(),
    isLocked: z.boolean(),
  }).optional(),
  reason: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    // Get tenant ID and user info from headers
    const tenantId = request.headers.get('x-tenant-id') || 'test-tenant';
    const userId = request.headers.get('x-user-id') || 'test-user';

    // Parse and validate request body
    const body = await request.json();
    const validationResult = CreateSwapRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Validate that requester is swapping their own shift
    if (data.originalAssignment.employeeId !== data.requesterId) {
      return NextResponse.json(
        { error: 'You can only request swaps for your own shifts' },
        { status: 403 }
      );
    }

    // Check if shift is locked
    if (data.originalAssignment.isLocked) {
      return NextResponse.json(
        { error: 'Cannot swap locked shifts' },
        { status: 400 }
      );
    }

    // Create swap request
    const swapRequest: SwapRequest = {
      id: `swap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      requesterId: data.requesterId,
      targetEmployeeId: data.targetEmployeeId,
      originalAssignment: {
        ...data.originalAssignment,
        date: new Date(data.originalAssignment.date),
        isSwapRequested: true,
        swapRequestId: '',
      },
      targetAssignment: data.targetAssignment ? {
        ...data.targetAssignment,
        date: new Date(data.targetAssignment.date),
      } : undefined,
      reason: data.reason,
      status: 'pending',
      createdAt: new Date(),
    };

    // Set swap request ID
    swapRequest.originalAssignment.swapRequestId = swapRequest.id;

    // Store swap request
    swapStorage.addSwapRequest(swapRequest);

    // Send notification to target employee if specified
    if (data.targetEmployeeId) {
      await sendSwapNotification(swapRequest);
    }

    // Log swap request
    console.log(`[${new Date().toISOString()}] Swap request created: ${swapRequest.id}, tenant: ${tenantId}, requester: ${data.requesterId}`);

    const response = {
      success: true,
      swapRequest: {
        ...swapRequest,
        originalAssignment: {
          ...swapRequest.originalAssignment,
          date: swapRequest.originalAssignment.date.toISOString(),
        },
        targetAssignment: swapRequest.targetAssignment ? {
          ...swapRequest.targetAssignment,
          date: swapRequest.targetAssignment.date.toISOString(),
        } : undefined,
        createdAt: swapRequest.createdAt.toISOString(),
      },
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: userId,
        tenantId,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Swap request creation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create swap request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Get swap requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');

    let filteredRequests = swapStorage.getAllSwapRequests();

    // Filter by employee ID (as requester or target)
    if (employeeId) {
      filteredRequests = filteredRequests.filter(
        req => req.requesterId === employeeId || req.targetEmployeeId === employeeId
      );
    }

    // Filter by status
    if (status) {
      filteredRequests = filteredRequests.filter(req => req.status === status);
    }

    // Sort by creation date (newest first)
    filteredRequests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Format dates for response
    const formattedRequests = filteredRequests.map(req => ({
      ...req,
      originalAssignment: {
        ...req.originalAssignment,
        date: req.originalAssignment.date.toISOString(),
      },
      targetAssignment: req.targetAssignment ? {
        ...req.targetAssignment,
        date: req.targetAssignment.date.toISOString(),
      } : undefined,
      createdAt: req.createdAt.toISOString(),
      decidedAt: req.decidedAt?.toISOString(),
    }));

    return NextResponse.json(
      {
        swapRequests: formattedRequests,
        total: formattedRequests.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get swap requests error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve swap requests',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Cancel swap request
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const swapRequestId = searchParams.get('id');
    const userId = request.headers.get('x-user-id') || 'test-user';

    if (!swapRequestId) {
      return NextResponse.json(
        { error: 'Swap request ID is required' },
        { status: 400 }
      );
    }

    const swapRequest = swapStorage.getSwapRequest(swapRequestId);

    if (!swapRequest) {
      return NextResponse.json(
        { error: 'Swap request not found' },
        { status: 404 }
      );
    }

    // Check if user is the requester
    if (swapRequest.requesterId !== userId) {
      return NextResponse.json(
        { error: 'You can only cancel your own swap requests' },
        { status: 403 }
      );
    }

    // Check if request is still pending
    if (swapRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only cancel pending swap requests' },
        { status: 400 }
      );
    }

    // Update status to cancelled
    swapRequest.status = 'cancelled';
    swapRequest.decidedAt = new Date();
    swapRequest.decidedBy = userId;

    swapStorage.updateSwapRequest(swapRequestId, swapRequest);

    return NextResponse.json(
      {
        success: true,
        message: 'Swap request cancelled successfully',
        swapRequest: {
          ...swapRequest,
          originalAssignment: {
            ...swapRequest.originalAssignment,
            date: swapRequest.originalAssignment.date.toISOString(),
          },
          targetAssignment: swapRequest.targetAssignment ? {
            ...swapRequest.targetAssignment,
            date: swapRequest.targetAssignment.date.toISOString(),
          } : undefined,
          createdAt: swapRequest.createdAt.toISOString(),
          decidedAt: swapRequest.decidedAt?.toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Cancel swap request error:', error);
    return NextResponse.json(
      {
        error: 'Failed to cancel swap request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper function to send swap notification
async function sendSwapNotification(swapRequest: SwapRequest) {
  // In production, this would integrate with a notification service
  console.log(`Sending swap notification to employee ${swapRequest.targetEmployeeId} for request ${swapRequest.id}`);

  const notification = {
    type: 'swap_request',
    recipientId: swapRequest.targetEmployeeId,
    swapRequestId: swapRequest.id,
    message: `You have a new swap request from ${swapRequest.requesterId}`,
    createdAt: new Date().toISOString(),
  };

  return notification;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id, x-user-id',
    },
  });
}