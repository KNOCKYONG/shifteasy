import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { scopedDb } from '@/lib/db-helpers';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const authRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));
    const [user] = await db.query(users, eq(users.id, (ctx.user?.id || 'dev-user-id')));
    return user;
  }),

  switchOrganization: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
    }))
    .mutation(async ({ input }) => {
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
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      const [updated] = await db.update(
        users,
        {
          name: input.name,
          profile: {
            phone: input.phone,
          },
          position: input.position,
        },
        eq(users.id, (ctx.user?.id || 'dev-user-id'))
      );

      return updated;
    }),
});