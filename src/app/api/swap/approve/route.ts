import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ConstraintValidator } from '@/lib/scheduler/constraints';
import { swapStorage } from '@/lib/swap/storage';

// Request validation schema
const ApproveSwapSchema = z.object({
  swapRequestId: z.string(),
  action: z.enum(['approve', 'reject']),
  comments: z.string().optional(),
  validateConstraints: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Get tenant ID and user info from headers
    const tenantId = request.headers.get('x-tenant-id') || 'test-tenant';
    const userId = request.headers.get('x-user-id') || 'test-user';
    const userRole = request.headers.get('x-user-role') || 'admin';

    // Parse and validate request body
    const body = await request.json();
    const validationResult = ApproveSwapSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: (validationResult.error as any).errors
        },
        { status: 400 }
      );
    }

    const { swapRequestId, action, comments, validateConstraints } = validationResult.data;

    // Get swap request
    const swapRequest = swapStorage.getSwapRequest(swapRequestId);

    if (!swapRequest) {
      return NextResponse.json(
        { error: 'Swap request not found' },
        { status: 404 }
      );
    }

    // Check if request is still pending
    if (swapRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Swap request has already been processed' },
        { status: 400 }
      );
    }

    // Determine who can approve
    const canApprove = checkApprovalAuthority(swapRequest, userId, userRole);

    if (!canApprove) {
      return NextResponse.json(
        { error: 'You do not have permission to approve this swap request' },
        { status: 403 }
      );
    }

    let validationPassed = true;
    let validationResults = null;

    // If approving, validate constraints if requested
    if (action === 'approve' && validateConstraints) {
      validationResults = await validateSwap(swapRequest);
      validationPassed = validationResults.isValid;

      // If validation fails, automatically reject
      if (!validationPassed && !validationResults.canOverride) {
        return NextResponse.json(
          {
            error: 'Swap validation failed',
            validationResults,
            message: 'Swap would violate critical constraints and cannot be approved',
          },
          { status: 400 }
        );
      }
    }

    // Update swap request status
    const updates = {
      status: (action === 'approve' ? 'approved' : 'rejected') as 'approved' | 'rejected',
      decidedAt: new Date(),
      decidedBy: userId,
      comments: comments,
      validationResults: validationResults,
    };

    const updateSuccess = swapStorage.updateSwapRequest(swapRequestId, updates);

    if (!updateSuccess) {
      return NextResponse.json(
        { error: 'Failed to update swap request' },
        { status: 500 }
      );
    }

    // Get updated swap request
    const updatedSwapRequest = swapStorage.getSwapRequest(swapRequestId);

    // If approved, update the schedule assignments
    if (action === 'approve' && updatedSwapRequest) {
      await executeSwap(updatedSwapRequest);
    }

    // Send notifications
    if (updatedSwapRequest) {
      await sendApprovalNotifications(updatedSwapRequest, action);
    }

    // Log approval/rejection
    console.log(`[${new Date().toISOString()}] Swap request ${action}: ${swapRequestId}, tenant: ${tenantId}, by: ${userId}`);

    if (!updatedSwapRequest) {
      return NextResponse.json(
        { error: 'Failed to retrieve updated swap request' },
        { status: 500 }
      );
    }

    const response = {
      success: true,
      action,
      swapRequest: {
        ...updatedSwapRequest,
        originalAssignment: {
          ...updatedSwapRequest.originalAssignment,
          date: updatedSwapRequest.originalAssignment.date.toISOString(),
        },
        targetAssignment: updatedSwapRequest.targetAssignment ? {
          ...updatedSwapRequest.targetAssignment,
          date: updatedSwapRequest.targetAssignment.date.toISOString(),
        } : undefined,
        createdAt: updatedSwapRequest.createdAt.toISOString(),
        decidedAt: updatedSwapRequest.decidedAt?.toISOString(),
      },
      validationResults,
      metadata: {
        processedAt: new Date().toISOString(),
        processedBy: userId,
        tenantId,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Swap approval error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process swap approval',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Check who has authority to approve the swap
function checkApprovalAuthority(swapRequest: any, userId: string, userRole: string): boolean {
  // Admins can approve all swaps
  if (userRole === 'admin' || userRole === 'manager') {
    return true;
  }

  // If target employee is specified, they can approve their own swap
  if (swapRequest.targetEmployeeId === userId) {
    return true;
  }

  // If it's an open swap request (no target specified), any eligible employee can accept
  if (!swapRequest.targetEmployeeId && userRole === 'employee') {
    // Check if the employee is eligible for the shift
    // In production, this would check skills, department, etc.
    return true;
  }

  return false;
}

// Validate the swap against constraints
async function validateSwap(swapRequest: any) {
  // Create a mock constraint validator
  const constraints = [
    {
      id: 'max-hours',
      name: 'Maximum weekly hours',
      type: 'hard' as const,
      category: 'legal' as const,
      weight: 1.0,
      active: true,
    },
    {
      id: 'min-rest',
      name: 'Minimum rest between shifts',
      type: 'hard' as const,
      category: 'legal' as const,
      weight: 1.0,
      active: true,
    },
  ];

  const validator = new ConstraintValidator(constraints);

  // In production, this would fetch actual schedule data
  const mockEmployeeMap = new Map([
    [swapRequest.requesterId, {
      id: swapRequest.requesterId,
      name: 'Requester',
      departmentId: 'dept-1',
      role: 'staff' as const,
      contractType: 'full-time' as const,
      skills: [],
      maxHoursPerWeek: 40,
      minHoursPerWeek: 36,
      preferences: {
        maxConsecutiveDays: 5,
        minRestHours: 11,
        preferredShifts: ['day' as const],
        avoidShifts: ['night' as const],
        preferredDaysOff: [0, 6],
        preferNightShift: false
      },
      availability: {
        timeOffRequests: [],
        unavailableDates: [],
        availableDays: [true, true, true, true, true, true, false] // Mon-Sat available, Sun off
      }
    }],
    [swapRequest.targetEmployeeId, {
      id: swapRequest.targetEmployeeId,
      name: 'Target',
      departmentId: 'dept-1',
      role: 'staff' as const,
      contractType: 'full-time' as const,
      skills: [],
      maxHoursPerWeek: 40,
      minHoursPerWeek: 36,
      preferences: {
        maxConsecutiveDays: 5,
        minRestHours: 11,
        preferredShifts: ['evening' as const],
        avoidShifts: [],
        preferredDaysOff: [0, 6],
        preferNightShift: false
      },
      availability: {
        timeOffRequests: [],
        unavailableDates: [],
        availableDays: [true, true, true, true, true, true, false] // Mon-Sat available, Sun off
      }
    }],
  ]);

  const mockShiftMap = new Map([
    [swapRequest.originalAssignment.shiftId, {
      id: swapRequest.originalAssignment.shiftId,
      type: 'day' as const,
      name: 'Day Shift',
      color: '#FFC107',
      requiredStaff: 5,
      time: { hours: 8, start: '07:00', end: '15:00' }
    }],
    [swapRequest.targetAssignment?.shiftId || 'default', {
      id: swapRequest.targetAssignment?.shiftId || 'default',
      type: 'evening' as const,
      name: 'Evening Shift',
      color: '#9C27B0',
      requiredStaff: 5,
      time: { hours: 8, start: '15:00', end: '23:00' }
    }],
  ]);

  // Create temporary assignments with the swap applied
  const tempAssignments = [
    {
      ...swapRequest.originalAssignment,
      employeeId: swapRequest.targetEmployeeId || 'unassigned',
    },
  ];

  if (swapRequest.targetAssignment) {
    tempAssignments.push({
      ...swapRequest.targetAssignment,
      employeeId: swapRequest.requesterId,
    });
  }

  // Validate
  const violations = validator.validateSchedule(
    tempAssignments,
    mockEmployeeMap,
    mockShiftMap,
    new Date(swapRequest.originalAssignment.date),
    new Date(swapRequest.originalAssignment.date)
  );

  const hardViolations = violations.filter(v => v.type === 'hard');
  const softViolations = violations.filter(v => v.type === 'soft');

  return {
    isValid: hardViolations.length === 0,
    canOverride: hardViolations.length === 0 || hardViolations.every(v => v.severity !== 'critical'),
    violations: {
      hard: hardViolations,
      soft: softViolations,
      total: violations.length,
    },
  };
}

// Execute the approved swap
async function executeSwap(swapRequest: any) {
  // In production, this would update the actual schedule in the database
  const scheduleId = `schedule-${swapRequest.originalAssignment.date}`;
  let assignments = swapStorage.getScheduleAssignments(scheduleId);

  // Remove original assignment
  assignments = assignments.filter(
    a => !(a.employeeId === swapRequest.requesterId &&
          a.date === swapRequest.originalAssignment.date &&
          a.shiftId === swapRequest.originalAssignment.shiftId)
  );

  // Add new assignment for target employee
  if (swapRequest.targetEmployeeId) {
    assignments.push({
      ...swapRequest.originalAssignment,
      employeeId: swapRequest.targetEmployeeId,
      isSwapRequested: false,
      swapRequestId: undefined,
    });
  }

  // If there's a target assignment being swapped back
  if (swapRequest.targetAssignment) {
    // Remove target's original assignment
    assignments = assignments.filter(
      a => !(a.employeeId === swapRequest.targetEmployeeId &&
            a.date === swapRequest.targetAssignment.date &&
            a.shiftId === swapRequest.targetAssignment.shiftId)
    );

    // Add requester's new assignment
    assignments.push({
      ...swapRequest.targetAssignment,
      employeeId: swapRequest.requesterId,
    });
  }

  swapStorage.setScheduleAssignments(scheduleId, assignments);

  console.log(`Swap executed: ${swapRequest.id}`);
}

// Send notifications about the approval/rejection
async function sendApprovalNotifications(swapRequest: any, action: string) {
  const notifications = [];

  // Notify requester
  notifications.push({
    type: 'swap_decision',
    recipientId: swapRequest.requesterId,
    swapRequestId: swapRequest.id,
    decision: action,
    message: `Your swap request has been ${action}`,
    createdAt: new Date().toISOString(),
  });

  // Notify target employee if exists
  if (swapRequest.targetEmployeeId) {
    notifications.push({
      type: 'swap_decision',
      recipientId: swapRequest.targetEmployeeId,
      swapRequestId: swapRequest.id,
      decision: action,
      message: `Swap request involving you has been ${action}`,
      createdAt: new Date().toISOString(),
    });
  }

  // In production, this would send actual notifications
  console.log(`Sending ${notifications.length} notifications for swap ${swapRequest.id}`);

  return notifications;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id, x-user-id, x-user-role',
    },
  });
}