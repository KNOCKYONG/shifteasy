import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '@/server/trpc';
import { scopedDb, createAuditLog } from '@/lib/db-helpers';
import { swapRequests, assignments, notifications } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';

export const swapRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['pending', 'accepted', 'rejected', 'approved', 'cancelled']).optional(),
      isRequester: z.boolean().optional(),
      isTarget: z.boolean().optional(),
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

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

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const results = await db.query(swapRequests, where);

      return {
        items: results
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(input.offset, input.offset + input.limit),
        total: results.length,
      };
    }),

  create: protectedProcedure
    .input(z.object({
      requesterAssignmentId: z.string(),
      targetUserId: z.string().optional(),
      targetAssignmentId: z.string().optional(),
      reason: z.string(),
      requestMessage: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

      const [swapRequest] = await db.insert(swapRequests, {
        requesterId: (ctx.user?.id || 'dev-user-id'),
        ...input,
        status: 'pending',
      });

      await createAuditLog({
        tenantId: (ctx.tenantId || 'dev-org-id'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'swap.created',
        entityType: 'swapRequest',
        entityId: swapRequest.id,
        after: swapRequest,
      });

      // Create notification for target user
      if (input.targetUserId) {
        await db.insert(notifications, {
          userId: input.targetUserId,
          type: 'swap_requested',
          title: 'New Swap Request',
          message: `${ctx.user!.email} has requested to swap shifts with you`,
          payload: { swapRequestId: swapRequest.id },
        });
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
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

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
        tenantId: (ctx.tenantId || 'dev-org-id'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: input.accept ? 'swap.accepted' : 'swap.rejected',
        entityType: 'swapRequest',
        entityId: input.id,
        before: swapRequest,
        after: updated,
      });

      // Notify requester
      await db.insert(notifications, {
        userId: swapRequest.requesterId,
        type: input.accept ? 'swap_accepted' : 'swap_rejected',
        title: input.accept ? 'Swap Request Accepted' : 'Swap Request Rejected',
        message: `Your swap request has been ${input.accept ? 'accepted' : 'rejected'}`,
        payload: { swapRequestId: input.id },
      });

      return updated;
    }),

  approve: adminProcedure
    .input(z.object({
      id: z.string(),
      approvalNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

      const [swapRequest] = await db.query(swapRequests, eq(swapRequests.id, input.id));

      if (!swapRequest) {
        throw new Error('Swap request not found');
      }

      if (swapRequest.status !== 'accepted') {
        throw new Error('Swap request must be accepted by target user first');
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

      // TODO: Actually swap the assignments

      await createAuditLog({
        tenantId: (ctx.tenantId || 'dev-org-id'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'swap.approved',
        entityType: 'swapRequest',
        entityId: input.id,
        before: swapRequest,
        after: updated,
      });

      // Notify both users
      await db.insert(notifications, [
        {
          userId: swapRequest.requesterId,
          type: 'swap_approved',
          title: 'Swap Request Approved',
          message: 'Your swap request has been approved by management',
          payload: { swapRequestId: input.id },
        },
        {
          userId: swapRequest.targetUserId!,
          type: 'swap_approved',
          title: 'Swap Request Approved',
          message: 'The swap request you accepted has been approved',
          payload: { swapRequestId: input.id },
        },
      ]);

      return updated;
    }),

  reject: adminProcedure
    .input(z.object({
      id: z.string(),
      approvalNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

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
        tenantId: (ctx.tenantId || 'dev-org-id'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'swap.rejected',
        entityType: 'swapRequest',
        entityId: input.id,
        before: swapRequest,
        after: updated,
      });

      return updated;
    }),
});