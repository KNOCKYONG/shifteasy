import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '../trpc';
import { scopedDb, createAuditLog } from '@/lib/db-helpers';
import { users, departments } from '@/db/schema';
import { eq, and, or, like } from 'drizzle-orm';

export const staffRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      departmentId: z.string().optional(),
      role: z.enum(['owner', 'admin', 'manager', 'member']).optional(),
      status: z.enum(['active', 'inactive', 'on_leave']).optional(),
      search: z.string().optional(),
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      let conditions = [];
      if (input.departmentId) {
        conditions.push(eq(users.departmentId, input.departmentId));
      }
      if (input.role) {
        conditions.push(eq(users.role, input.role));
      }
      if (input.status) {
        conditions.push(eq(users.status, input.status));
      }
      if (input.search) {
        conditions.push(
          or(
            like(users.name, `%${input.search}%`),
            like(users.email, `%${input.search}%`),
            like(users.employeeId, `%${input.search}%`)
          )
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const results = await db.query(users, where);

      return {
        items: results.slice(input.offset, input.offset + input.limit),
        total: results.length,
      };
    }),

  get: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));
      const [user] = await db.query(users, eq(users.id, input.id));

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    }),

  create: adminProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string(),
      role: z.enum(['admin', 'manager', 'member']),
      departmentId: z.string().optional(),
      employeeId: z.string().optional(),
      position: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      // TODO: Integrate with Clerk to create user
      const clerkUserId = `clerk_${Date.now()}`;

      const [user] = await db.insert(users, {
        ...input,
        clerkUserId,
        status: 'active',
      });

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'staff.created',
        entityType: 'user',
        entityId: user.id,
        after: user,
      });

      return user;
    }),

  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      role: z.enum(['admin', 'manager', 'member']).optional(),
      departmentId: z.string().optional(),
      teamId: z.string().nullable().optional(),
      position: z.string().optional(),
      status: z.enum(['active', 'inactive', 'on_leave']).optional(),
      profile: z.object({
        phone: z.string().optional(),
        avatar: z.string().optional(),
        skills: z.array(z.string()).optional(),
        certifications: z.array(z.string()).optional(),
        preferences: z.object({
          preferredShifts: z.array(z.string()).optional(),
          unavailableDates: z.array(z.string()).optional(),
          maxHoursPerWeek: z.number().optional(),
          minHoursPerWeek: z.number().optional(),
        }).optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      const { id, ...updateData } = input;

      const [before] = await db.query(users, eq(users.id, id));

      if (!before) {
        throw new Error('User not found');
      }

      const [after] = await db.update(
        users,
        updateData,
        eq(users.id, id)
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'staff.updated',
        entityType: 'user',
        entityId: id,
        before,
        after,
      });

      return after;
    }),

  deactivate: adminProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      const [updated] = await db.update(
        users,
        { status: 'inactive' },
        eq(users.id, input.id)
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'staff.deactivated',
        entityType: 'user',
        entityId: input.id,
        after: updated,
      });

      return updated;
    }),
});