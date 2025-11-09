import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '../trpc';
import { scopedDb, createAuditLog } from '@/lib/db-helpers';
import { swapRequests, users, schedules } from '@/db/schema';
import { eq, and, or, gte, lte } from 'drizzle-orm';
import { format } from 'date-fns';
import { notificationService } from '@/lib/notifications/notification-service';

export const swapRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['pending', 'accepted', 'rejected', 'approved', 'cancelled']).optional(),
      isRequester: z.boolean().optional(),
      isTarget: z.boolean().optional(),
      departmentId: z.string().optional(),
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      // Get current user to check department permissions
      const [currentUser] = await db.query(users, eq(users.id, (ctx.user?.id || 'dev-user-id')));

      let conditions = [];
      if (input.status) {
        conditions.push(eq(swapRequests.status, input.status));
      }
      if (input.isRequester) {
        conditions.push(eq(swapRequests.requesterId, (ctx.user?.id || 'dev-user-id')));
      }
      if (input.isTarget) {
        conditions.push(eq(swapRequests.targetUserId, (ctx.user?.id || 'dev-user-id')));
      }

      // Department filtering and role-based filtering
      if (input.departmentId) {
        conditions.push(eq(swapRequests.departmentId, input.departmentId));
      } else if (currentUser?.role === 'manager' && currentUser.departmentId) {
        // Managers can only see requests from their department
        conditions.push(eq(swapRequests.departmentId, currentUser.departmentId));
      } else if (currentUser?.role === 'member') {
        // Members can only see their own requests (where they are the requester)
        conditions.push(eq(swapRequests.requesterId, (ctx.user?.id || 'dev-user-id')));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const results = await db.query(swapRequests, where);

      // Get all unique user IDs
      const userIds = new Set<string>();
      results.forEach(req => {
        userIds.add(req.requesterId);
        if (req.targetUserId) userIds.add(req.targetUserId);
      });

      // Fetch all users in one query
      const usersMap = new Map();
      if (userIds.size > 0) {
        const usersData = await db.query(users, eq(users.tenantId, (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d')));
        usersData.forEach(user => {
          usersMap.set(user.id, {
            id: user.id,
            name: user.name,
            email: user.email,
          });
        });
      }

      // Attach user data to swap requests
      const enrichedResults = results.map(req => ({
        ...req,
        requester: usersMap.get(req.requesterId),
        targetUser: req.targetUserId ? usersMap.get(req.targetUserId) : null,
      })) as Array<typeof results[0] & {
        requester: any;
        targetUser: any;
      }>;

      return {
        items: enrichedResults
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(input.offset, input.offset + input.limit),
        total: enrichedResults.length,
      };
    }),

  create: protectedProcedure
    .input(z.object({
      date: z.string(), // Date of the swap
      requesterShiftId: z.string(), // Requester's current shift ID
      targetUserId: z.string(),
      targetShiftId: z.string(), // Target's current shift ID
      reason: z.string(),
      requestMessage: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      // Check if user is a member (only members can create swap requests)
      const [currentUser] = await db.query(users, eq(users.id, (ctx.user?.id || 'dev-user-id')));

      if (!currentUser) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      if (currentUser.role !== 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only members can create swap requests'
        });
      }

      if (!currentUser.departmentId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User must belong to a department to create swap requests'
        });
      }

      const [swapRequest] = await db.insert(swapRequests, {
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        departmentId: currentUser.departmentId,
        requesterId: (ctx.user?.id || 'dev-user-id'),
        targetUserId: input.targetUserId,
        originalShiftId: input.requesterShiftId,
        targetShiftId: input.targetShiftId,
        date: new Date(input.date),
        reason: input.reason,
        status: 'pending',
      });

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'swap.created',
        entityType: 'swapRequest',
        entityId: swapRequest.id,
        after: swapRequest,
      });

      // Create notification for target user
      if (input.targetUserId) {
        await notificationService.sendToUser(
          ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d',
          input.targetUserId,
          {
            type: 'swap_requested',
            priority: 'high',
            title: '새로운 근무 교환 요청',
            message: `${currentUser.name}님이 근무 교환을 요청했습니다`,
            data: { swapRequestId: swapRequest.id },
            actionUrl: '/schedule?view=today',
          }
        );
      }

      // Notify all managers in the same department
      const departmentId = currentUser.departmentId;
      if (departmentId) {
        const managers = await db.query(users, and(
          eq(users.departmentId, departmentId),
          eq(users.role, 'manager')
        ));

        if (managers.length > 0) {
          // Send notification to each manager
          for (const manager of managers) {
            await notificationService.sendToUser(
              ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d',
              manager.id,
              {
                type: 'swap_requested',
                priority: 'high',
                title: '팀원의 근무 교환 요청',
                message: `${currentUser.name}님이 스케줄 교환을 요청했습니다. 승인이 필요합니다`,
                data: { swapRequestId: swapRequest.id },
                actionUrl: '/schedule?view=today',
              }
            );
          }
        }
      }

      return swapRequest;
    }),

  respond: protectedProcedure
    .input(z.object({
      id: z.string(),
      accept: z.boolean(),
      responseMessage: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      const [swapRequest] = await db.query(swapRequests, eq(swapRequests.id, input.id));

      if (!swapRequest) {
        throw new Error('Swap request not found');
      }

      if (swapRequest.targetUserId !== (ctx.user?.id || 'dev-user-id')) {
        throw new Error('You are not the target of this swap request');
      }

      const [updated] = await db.update(
        swapRequests,
        {
          status: input.accept ? 'accepted' : 'rejected',
          responseMessage: input.responseMessage,
          respondedAt: new Date(),
        },
        eq(swapRequests.id, input.id)
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: input.accept ? 'swap.accepted' : 'swap.rejected',
        entityType: 'swapRequest',
        entityId: input.id,
        before: swapRequest,
        after: updated,
      });

      // Notify requester
      await notificationService.sendToUser(
        ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d',
        swapRequest.requesterId,
        {
          type: input.accept ? 'swap_approved' : 'swap_rejected',
          priority: 'high',
          title: input.accept ? '근무 교환 요청 수락됨' : '근무 교환 요청 거절됨',
          message: `근무 교환 요청이 ${input.accept ? '수락' : '거절'}되었습니다`,
          data: { swapRequestId: input.id },
          actionUrl: '/schedule?view=today',
        }
      );

      return updated;
    }),

  approve: adminProcedure
    .input(z.object({
      id: z.string(),
      approvalNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      const [swapRequest] = await db.query(swapRequests, eq(swapRequests.id, input.id));

      if (!swapRequest) {
        throw new Error('Swap request not found');
      }

      if (swapRequest.status !== 'pending') {
        throw new Error('Only pending swap requests can be approved');
      }

      const [updated] = await db.update(
        swapRequests,
        {
          status: 'approved',
          approvedBy: (ctx.user?.id || 'dev-user-id'),
          approvedAt: new Date(),
          approvalNotes: input.approvalNotes,
        },
        eq(swapRequests.id, input.id)
      );

      // Actually swap the assignments in the published schedule
      try {
        // Get the swap date
        const swapDate = new Date(swapRequest.date);
        const monthStart = new Date(swapDate.getFullYear(), swapDate.getMonth(), 1);
        const monthEnd = new Date(swapDate.getFullYear(), swapDate.getMonth() + 1, 0);

        console.log(`[Swap] Processing swap for date: ${format(swapDate, 'yyyy-MM-dd')}`);
        console.log(`[Swap] Month range: ${format(monthStart, 'yyyy-MM-dd')} to ${format(monthEnd, 'yyyy-MM-dd')}`);

        // Get the requester's department to find the correct schedule
        const [requester] = await db.query(users, eq(users.id, swapRequest.requesterId));

        if (!requester || !requester.departmentId) {
          console.error('[Swap] Requester not found or has no department');
          throw new Error('Requester not found or has no department');
        }

        console.log(`[Swap] Requester department: ${requester.departmentId}`);

        // Get all schedules for this department and filter in JavaScript
        const allDeptSchedules = await db.query(
          schedules,
          eq(schedules.departmentId, requester.departmentId)
        );
        console.log(`[Swap] Found ${allDeptSchedules.length} total schedules for this department`);

        // Filter for published/confirmed schedules in the target month
        const publishedSchedules = allDeptSchedules.filter(sched => {
          const isPublishedOrConfirmed = sched.status === 'published' || sched.status === 'confirmed';
          const schedStart = new Date(sched.startDate);
          const schedEnd = new Date(sched.endDate);
          const overlapsMonth = schedStart <= monthEnd && schedEnd >= monthStart;

          console.log(`[Swap] Checking schedule ${sched.id}: status=${sched.status}, isPublishedOrConfirmed=${isPublishedOrConfirmed}, overlapsMonth=${overlapsMonth}`);

          return isPublishedOrConfirmed && overlapsMonth;
        });

        console.log(`[Swap] Found ${publishedSchedules.length} published/confirmed schedules for this month`);

        if (publishedSchedules.length === 0) {
          console.error('[Swap] No published or confirmed schedule found for this month');
          throw new Error('No published or confirmed schedule found for this month');
        }

        // Get the most recent published schedule
        const schedule = publishedSchedules.sort((a, b) =>
          new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
        )[0];

        // Get assignments from metadata
        const metadata = schedule.metadata as any;
        const assignments = metadata?.assignments || [];

        console.log(`[Swap] Found ${assignments.length} total assignments in schedule`);

        if (assignments.length === 0) {
          console.error('[Swap] No assignments found in the schedule');
          throw new Error('No assignments found in the schedule');
        }

        // Find the assignments to swap (matching date and users)
        const swapDateStr = format(swapDate, 'yyyy-MM-dd');
        console.log(`[Swap] Looking for assignments on date: ${swapDateStr}`);
        console.log(`[Swap] Requester ID: ${swapRequest.requesterId}, Target ID: ${swapRequest.targetUserId}`);

        let requesterAssignmentIndex = -1;
        let targetAssignmentIndex = -1;

        for (let i = 0; i < assignments.length; i++) {
          const assignmentDate = format(new Date(assignments[i].date), 'yyyy-MM-dd');

          if (assignmentDate === swapDateStr) {
            console.log(`[Swap] Found assignment on ${swapDateStr}: employeeId=${assignments[i].employeeId}, shiftId=${assignments[i].shiftId}`);

            if (assignments[i].employeeId === swapRequest.requesterId) {
              requesterAssignmentIndex = i;
              console.log(`[Swap] Found requester assignment at index ${i}`);
            }
            if (assignments[i].employeeId === swapRequest.targetUserId) {
              targetAssignmentIndex = i;
              console.log(`[Swap] Found target assignment at index ${i}`);
            }
          }
        }

        if (requesterAssignmentIndex === -1 || targetAssignmentIndex === -1) {
          console.error(`[Swap] Could not find assignments - requesterIndex: ${requesterAssignmentIndex}, targetIndex: ${targetAssignmentIndex}`);
          throw new Error('Could not find assignments to swap');
        }

        // Swap the shiftIds
        const requesterOldShift = assignments[requesterAssignmentIndex].shiftId;
        const targetOldShift = assignments[targetAssignmentIndex].shiftId;

        console.log(`[Swap] BEFORE swap - Requester: ${requesterOldShift}, Target: ${targetOldShift}`);

        const tempShiftId = assignments[requesterAssignmentIndex].shiftId;
        assignments[requesterAssignmentIndex].shiftId = assignments[targetAssignmentIndex].shiftId;
        assignments[targetAssignmentIndex].shiftId = tempShiftId;

        console.log(`[Swap] AFTER swap - Requester: ${assignments[requesterAssignmentIndex].shiftId}, Target: ${assignments[targetAssignmentIndex].shiftId}`);

        // Increment version and add to version history
        const newVersion = (schedule.version || 1) + 1;
        const versionHistory = metadata?.versionHistory || [];
        versionHistory.push({
          version: newVersion,
          updatedAt: new Date().toISOString(),
          updatedBy: ctx.user?.id || 'dev-user-id',
          reason: 'shift_swap_approved',
          changes: {
            swapRequestId: input.id,
            requesterShift: { from: requesterOldShift, to: assignments[requesterAssignmentIndex].shiftId },
            targetShift: { from: targetOldShift, to: assignments[targetAssignmentIndex].shiftId },
            date: swapDateStr,
          },
        });

        // Update the schedule with swapped assignments and new version
        const updateResult = await db.update(
          schedules,
          {
            version: newVersion,
            metadata: {
              ...metadata,
              assignments,
              versionHistory,
              lastSwap: {
                swapRequestId: input.id,
                swappedAt: new Date().toISOString(),
                swappedBy: (ctx.user?.id || 'dev-user-id'),
              },
            },
          },
          eq(schedules.id, schedule.id)
        );

        console.log(`[Swap] Schedule version updated from ${schedule.version || 1} to ${newVersion}`);

        console.log(`[Swap] DB update completed for schedule ${schedule.id}`);
        console.log(`[Swap] Update result:`, updateResult);

        // Verify the update by reading back
        const [updatedSchedule] = await db.query(schedules, eq(schedules.id, schedule.id));
        const updatedMetadata = updatedSchedule.metadata as any;
        const updatedAssignments = updatedMetadata?.assignments || [];

        console.log(`[Swap] Verification - Requester shift in DB: ${updatedAssignments[requesterAssignmentIndex]?.shiftId}`);
        console.log(`[Swap] Verification - Target shift in DB: ${updatedAssignments[targetAssignmentIndex]?.shiftId}`);

        console.log(`[Swap] Successfully swapped assignments for swap request ${input.id}`);
      } catch (swapError) {
        console.error('[Swap] Error swapping assignments:', swapError);
        // Still mark as approved but log the error
        // In production, you might want to revert the approval status
      }

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'swap.approved',
        entityType: 'swapRequest',
        entityId: input.id,
        before: swapRequest,
        after: updated,
      });

      // Notify both users
      await notificationService.sendToUser(
        ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d',
        swapRequest.requesterId,
        {
          type: 'swap_approved',
          priority: 'high',
          title: '근무 교환 승인됨',
          message: '관리자가 근무 교환 요청을 승인했습니다',
          data: { swapRequestId: input.id },
          actionUrl: '/schedule?view=today',
        }
      );

      if (swapRequest.targetUserId) {
        await notificationService.sendToUser(
          ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d',
          swapRequest.targetUserId,
          {
            type: 'swap_approved',
            priority: 'high',
            title: '근무 교환 승인됨',
            message: '수락한 근무 교환 요청이 승인되었습니다',
            data: { swapRequestId: input.id },
            actionUrl: '/schedule?view=today',
          }
        );
      }

      return updated;
    }),

  reject: adminProcedure
    .input(z.object({
      id: z.string(),
      approvalNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      const [swapRequest] = await db.query(swapRequests, eq(swapRequests.id, input.id));

      if (!swapRequest) {
        throw new Error('Swap request not found');
      }

      const [updated] = await db.update(
        swapRequests,
        {
          status: 'rejected',
          approvedBy: (ctx.user?.id || 'dev-user-id'),
          approvedAt: new Date(),
          approvalNotes: input.approvalNotes,
        },
        eq(swapRequests.id, input.id)
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'swap.rejected',
        entityType: 'swapRequest',
        entityId: input.id,
        before: swapRequest,
        after: updated,
      });

      return updated;
    }),

  cancel: adminProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      const [swapRequest] = await db.query(swapRequests, eq(swapRequests.id, input.id));

      if (!swapRequest) {
        throw new Error('Swap request not found');
      }

      if (swapRequest.status !== 'approved') {
        throw new Error('Only approved swap requests can be cancelled');
      }

      // Revert the schedule swap (swap back to original)
      try {
        const swapDate = new Date(swapRequest.date);
        const monthStart = new Date(swapDate.getFullYear(), swapDate.getMonth(), 1);
        const monthEnd = new Date(swapDate.getFullYear(), swapDate.getMonth() + 1, 0);

        console.log(`[Swap Cancel] Reverting swap for date: ${format(swapDate, 'yyyy-MM-dd')}`);

        const [requester] = await db.query(users, eq(users.id, swapRequest.requesterId));

        if (!requester || !requester.departmentId) {
          throw new Error('Requester not found or has no department');
        }

        // Get all schedules for this department and filter in JavaScript
        const allDeptSchedules = await db.query(
          schedules,
          eq(schedules.departmentId, requester.departmentId)
        );

        // Filter for published/confirmed schedules in the target month
        const publishedSchedules = allDeptSchedules.filter(sched => {
          const isPublishedOrConfirmed = sched.status === 'published' || sched.status === 'confirmed';
          const schedStart = new Date(sched.startDate);
          const schedEnd = new Date(sched.endDate);
          const overlapsMonth = schedStart <= monthEnd && schedEnd >= monthStart;
          return isPublishedOrConfirmed && overlapsMonth;
        });

        console.log(`[Swap Cancel] Found ${publishedSchedules.length} published/confirmed schedules`);

        if (publishedSchedules.length > 0) {
          const schedule = publishedSchedules.sort((a, b) =>
            new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
          )[0];

          const metadata = schedule.metadata as any;
          const assignments = metadata?.assignments || [];

          if (assignments.length > 0) {
            const swapDateStr = format(swapDate, 'yyyy-MM-dd');

            let requesterAssignmentIndex = -1;
            let targetAssignmentIndex = -1;

            for (let i = 0; i < assignments.length; i++) {
              const assignmentDate = format(new Date(assignments[i].date), 'yyyy-MM-dd');

              if (assignmentDate === swapDateStr) {
                if (assignments[i].employeeId === swapRequest.requesterId) {
                  requesterAssignmentIndex = i;
                }
                if (assignments[i].employeeId === swapRequest.targetUserId) {
                  targetAssignmentIndex = i;
                }
              }
            }

            if (requesterAssignmentIndex !== -1 && targetAssignmentIndex !== -1) {
              // Swap back to original
              const tempShiftId = assignments[requesterAssignmentIndex].shiftId;
              assignments[requesterAssignmentIndex].shiftId = assignments[targetAssignmentIndex].shiftId;
              assignments[targetAssignmentIndex].shiftId = tempShiftId;

              await db.update(
                schedules,
                {
                  metadata: {
                    ...metadata,
                    assignments,
                    lastCancel: {
                      swapRequestId: input.id,
                      cancelledAt: new Date().toISOString(),
                      cancelledBy: (ctx.user?.id || 'dev-user-id'),
                    },
                  },
                },
                eq(schedules.id, schedule.id)
              );

              console.log(`[Swap Cancel] Successfully reverted swap for request ${input.id}`);
            }
          }
        }
      } catch (cancelError) {
        console.error('[Swap Cancel] Error reverting swap:', cancelError);
        // Continue to update status even if schedule revert fails
      }

      // Update swap request status back to pending
      const [updated] = await db.update(
        swapRequests,
        {
          status: 'pending',
          approvedBy: null,
          approvedAt: null,
          approvalNotes: null,
        },
        eq(swapRequests.id, input.id)
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'swap.cancelled',
        entityType: 'swapRequest',
        entityId: input.id,
        before: swapRequest,
        after: updated,
      });

      return updated;
    }),
});
