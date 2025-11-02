import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { db } from '@/db';
import { teams } from '@/db/schema/teams';
import { eq, and, isNull, asc } from 'drizzle-orm';

export const teamsRouter = createTRPCRouter({
  // Get all teams for the current tenant/department
  getAll: protectedProcedure
    .input(z.object({
      departmentId: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const conditions = [
        eq(teams.tenantId, tenantId),
        eq(teams.isActive, 'true'),
      ];

      if (input?.departmentId) {
        conditions.push(eq(teams.departmentId, input.departmentId));
      }

      const result = await db.select()
        .from(teams)
        .where(and(...conditions))
        .orderBy(asc(teams.displayOrder), asc(teams.name));

      return result;
    }),

  // Create a new team
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1, '팀 이름을 입력해주세요'),
      code: z.string().min(1, '팀 코드를 입력해주세요'),
      color: z.string().default('#3B82F6'),
      departmentId: z.string().optional(),
      displayOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Check if team code already exists
      const existingTeam = await db.select()
        .from(teams)
        .where(and(
          eq(teams.tenantId, tenantId),
          eq(teams.code, input.code),
          eq(teams.isActive, 'true')
        ))
        .limit(1);

      if (existingTeam.length > 0) {
        throw new Error('이미 존재하는 팀 코드입니다');
      }

      // Get max display order
      const maxOrderResult = await db.select()
        .from(teams)
        .where(eq(teams.tenantId, tenantId))
        .orderBy(asc(teams.displayOrder))
        .limit(1);

      const nextOrder = input.displayOrder ?? (maxOrderResult.length > 0 ? (maxOrderResult[0].displayOrder ?? 0) + 1 : 0);

      const result = await db.insert(teams)
        .values({
          tenantId,
          departmentId: input.departmentId || null,
          name: input.name,
          code: input.code,
          color: input.color,
          displayOrder: nextOrder,
        })
        .returning();

      return result[0];
    }),

  // Update team
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      code: z.string().min(1).optional(),
      color: z.string().optional(),
      displayOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Check if code is being changed and if it already exists
      if (input.code) {
        const existingTeam = await db.select()
          .from(teams)
          .where(and(
            eq(teams.tenantId, tenantId),
            eq(teams.code, input.code),
            eq(teams.isActive, 'true')
          ))
          .limit(1);

        if (existingTeam.length > 0 && existingTeam[0].id !== input.id) {
          throw new Error('이미 존재하는 팀 코드입니다');
        }
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.code !== undefined) updateData.code = input.code;
      if (input.color !== undefined) updateData.color = input.color;
      if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;

      const result = await db.update(teams)
        .set(updateData)
        .where(and(
          eq(teams.id, input.id),
          eq(teams.tenantId, tenantId)
        ))
        .returning();

      if (result.length === 0) {
        throw new Error('팀을 찾을 수 없습니다');
      }

      return result[0];
    }),

  // Delete team (soft delete)
  delete: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const result = await db.update(teams)
        .set({
          isActive: 'false',
          deletedAt: new Date(),
        })
        .where(and(
          eq(teams.id, input.id),
          eq(teams.tenantId, tenantId)
        ))
        .returning();

      if (result.length === 0) {
        throw new Error('팀을 찾을 수 없습니다');
      }

      return result[0];
    }),

  // Update team orders
  updateOrders: protectedProcedure
    .input(z.object({
      orders: z.array(z.object({
        id: z.string(),
        displayOrder: z.number(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Update each team's display order
      const updates = input.orders.map(({ id, displayOrder }) =>
        db.update(teams)
          .set({ displayOrder })
          .where(and(
            eq(teams.id, id),
            eq(teams.tenantId, tenantId)
          ))
      );

      await Promise.all(updates);

      return { success: true };
    }),
});
