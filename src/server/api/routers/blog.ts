import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { departments, staffWallPosts, tenants, users } from '@/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';

export const blogRouter = createTRPCRouter({
  // 기본 프로필 정보 (블로그 상단 카드용)
  profile: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId;
      if (!tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant not found' });
      }

      const [user] = await ctx.db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, input.userId),
            eq(users.tenantId, tenantId),
            isNull(users.deletedAt)
          )
        )
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const [tenant] = await ctx.db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      let departmentName: string | null = null;
      if (user.departmentId) {
        const [department] = await ctx.db
          .select({ name: departments.name })
          .from(departments)
          .where(
            and(
              eq(departments.id, user.departmentId),
              eq(departments.tenantId, tenantId)
            )
          )
          .limit(1);

        departmentName = department?.name ?? null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        position: user.position,
        departmentId: user.departmentId,
        departmentName,
        tenantName: tenant?.name ?? null,
        role: user.role,
        profile: user.profile,
      };
    }),

  // 담벼락 글 목록
  listPosts: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId;
      if (!tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant not found' });
      }

      const posts = await ctx.db
        .select({
          id: staffWallPosts.id,
          content: staffWallPosts.content,
          createdAt: staffWallPosts.createdAt,
          authorId: staffWallPosts.authorUserId,
          authorName: users.name,
          authorPosition: users.position,
        })
        .from(staffWallPosts)
        .leftJoin(users, eq(users.id, staffWallPosts.authorUserId))
        .where(
          and(
            eq(staffWallPosts.tenantId, tenantId),
            eq(staffWallPosts.targetUserId, input.userId),
            isNull(staffWallPosts.deletedAt)
          )
        )
        .orderBy(desc(staffWallPosts.createdAt))
        .limit(50);

      return posts;
    }),

  // 담벼락에 글 남기기
  addPost: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        content: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId;
      const authorId = ctx.user?.id;

      if (!tenantId || !authorId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      // 대상 사용자 존재 여부 확인 (같은 tenant 내)
      const [targetUser] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.id, input.userId),
            eq(users.tenantId, tenantId),
            isNull(users.deletedAt)
          )
        )
        .limit(1);

      if (!targetUser) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Target user not found' });
      }

      const [created] = await ctx.db
        .insert(staffWallPosts)
        .values({
          tenantId,
          targetUserId: input.userId,
          authorUserId: authorId,
          content: input.content,
        })
        .returning();

      return created;
    }),
});

