import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '@/server/trpc';
import { scopedDb } from '@/lib/db-helpers';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const authRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const db = scopedDb((ctx.tenantId || 'dev-org-id'));
    const [user] = await db.query(users, eq(users.id, (ctx.user?.id || 'dev-user-id')));
    return user;
  }),

  switchOrganization: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Validate user has access to organization
      // TODO: Update session with new organization
      return {
        success: true,
        organizationId: input.organizationId,
      };
    }),

  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      position: z.string().optional(),
      preferences: z.object({
        preferredShifts: z.array(z.string()).optional(),
        unavailableDates: z.array(z.string()).optional(),
        maxHoursPerWeek: z.number().optional(),
        minHoursPerWeek: z.number().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

      const [updated] = await db.update(
        users,
        {
          name: input.name,
          profile: {
            phone: input.phone,
            preferences: input.preferences,
          },
          position: input.position,
        },
        eq(users.id, (ctx.user?.id || 'dev-user-id'))
      );

      return updated;
    }),
});