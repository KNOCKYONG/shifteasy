import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc';
import { db } from '@/db';
import { consultingRequests } from '@/db/schema/consulting-requests';
import { eq, desc } from 'drizzle-orm';

export const consultingRouter = createTRPCRouter({
  // Public endpoint - Submit consulting request from landing page
  submit: publicProcedure
    .input(z.object({
      // Basic Information
      companyName: z.string().min(1),
      contactName: z.string().min(1),
      phone: z.string().min(1),
      email: z.string().email(),
      industry: z.enum(['healthcare', 'manufacturing', 'service', 'retail', 'other']),
      teamSize: z.enum(['1-10', '11-30', '31-50', '51+']),

      // Schedule Information
      currentMethod: z.enum(['excel', 'paper', 'software', 'other']),

      // Files - URLs after client-side upload to Supabase Storage
      files: z.array(z.object({
        name: z.string(),
        size: z.number(),
        type: z.string(),
        url: z.string(),
        uploadedAt: z.string(),
      })).min(3, 'Minimum 3 files required'),

      // Detailed Information
      painPoints: z.string().min(10),
      specialRequirements: z.string().min(10),
      additionalNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const [request] = await db.insert(consultingRequests)
          .values({
            companyName: input.companyName,
            contactName: input.contactName,
            phone: input.phone,
            email: input.email,
            industry: input.industry,
            teamSize: input.teamSize,
            currentMethod: input.currentMethod,
            files: input.files,
            painPoints: input.painPoints,
            specialRequirements: input.specialRequirements,
            additionalNotes: input.additionalNotes,
            status: 'pending',
          })
          .returning();

        return {
          success: true,
          requestId: request?.id,
        };
      } catch (error) {
        console.error('Error submitting consulting request:', error);
        throw new Error('Failed to submit consulting request');
      }
    }),

  // Protected endpoint - Get all consulting requests (for admin)
  getAll: protectedProcedure
    .input(z.object({
      status: z.enum(['pending', 'reviewing', 'contacted', 'completed', 'rejected']).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const conditions = [];

      if (input.status) {
        conditions.push(eq(consultingRequests.status, input.status));
      }

      const requests = await db.select()
        .from(consultingRequests)
        .where(conditions.length > 0 ? conditions[0] : undefined)
        .orderBy(desc(consultingRequests.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const total = await db.select({ count: consultingRequests.id })
        .from(consultingRequests)
        .where(conditions.length > 0 ? conditions[0] : undefined);

      return {
        requests,
        total: total.length,
      };
    }),

  // Protected endpoint - Get single consulting request by ID
  getById: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const [request] = await db.select()
        .from(consultingRequests)
        .where(eq(consultingRequests.id, input.id));

      if (!request) {
        throw new Error('Consulting request not found');
      }

      return request;
    }),

  // Protected endpoint - Update consulting request status
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['pending', 'reviewing', 'contacted', 'completed', 'rejected']),
      assignedTo: z.string().optional(),
      responseNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const updateData: any = {
        status: input.status,
        updatedAt: new Date(),
      };

      if (input.assignedTo !== undefined) {
        updateData.assignedTo = input.assignedTo;
      }

      if (input.responseNotes !== undefined) {
        updateData.responseNotes = input.responseNotes;
      }

      // Set contactedAt when status changes to 'contacted'
      if (input.status === 'contacted') {
        updateData.contactedAt = new Date();
      }

      // Set completedAt when status changes to 'completed'
      if (input.status === 'completed') {
        updateData.completedAt = new Date();
      }

      const [updated] = await db.update(consultingRequests)
        .set(updateData)
        .where(eq(consultingRequests.id, input.id))
        .returning();

      if (!updated) {
        throw new Error('Failed to update consulting request');
      }

      return {
        success: true,
        request: updated,
      };
    }),

  // Protected endpoint - Delete consulting request
  delete: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      await db.delete(consultingRequests)
        .where(eq(consultingRequests.id, input.id));

      return {
        success: true,
      };
    }),

  // Protected endpoint - Get statistics
  getStatistics: protectedProcedure
    .query(async () => {
      const allRequests = await db.select()
        .from(consultingRequests);

      const stats = {
        total: allRequests.length,
        pending: allRequests.filter(r => r.status === 'pending').length,
        reviewing: allRequests.filter(r => r.status === 'reviewing').length,
        contacted: allRequests.filter(r => r.status === 'contacted').length,
        completed: allRequests.filter(r => r.status === 'completed').length,
        rejected: allRequests.filter(r => r.status === 'rejected').length,
      };

      return stats;
    }),
});
