import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { scopedDb } from '@/lib/db-helpers';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const getTenantDbAndUserId = (ctx: {
  tenantId: string | null;
  user: { id: string } | null;
}) => {
  if (!ctx.tenantId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Tenant ID is required for onboarding',
    });
  }

  if (!ctx.user?.id) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User context is missing',
    });
  }

  return {
    db: scopedDb(ctx.tenantId),
    userId: ctx.user.id,
  };
};

export const onboardingRouter = createTRPCRouter({
  // 현재 정보상태 조회
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const { db, userId } = getTenantDbAndUserId(ctx);
    const [user] = await db.query(users, eq(users.id, userId));

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return {
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep,
      onboardingStartedAt: user.onboardingStartedAt,
      onboardingCompletedAt: user.onboardingCompletedAt,
      onboardingSkipped: user.onboardingSkipped,
    };
  }),

  // 온보딩 시작
  start: protectedProcedure.mutation(async ({ ctx }) => {
    const { db, userId } = getTenantDbAndUserId(ctx);

    const [updated] = await db.update(
      users,
      {
        onboardingCompleted: 1, // in progress
        onboardingStartedAt: new Date(),
      },
      eq(users.id, userId)
    );

    return { success: true, user: updated };
  }),

  // 단계 완료 업데이트
  updateStep: protectedProcedure
    .input(
      z.object({
        step: z.enum(['welcome', 'profile', 'config', 'team']),
        completed: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, userId } = getTenantDbAndUserId(ctx);

      // 현재 상태 조회
      const [currentUser] = await db.query(users, eq(users.id, userId));

      if (!currentUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const updatedSteps = {
        ...(currentUser.onboardingStep || {
          welcome: false,
          profile: false,
          config: false,
          team: false,
        }),
        [input.step]: input.completed,
      };

      const [updated] = await db.update(
        users,
        {
          onboardingStep: updatedSteps,
        },
        eq(users.id, userId)
      );

      return { success: true, steps: updatedSteps, user: updated };
    }),

  // 온보딩 완료
  complete: protectedProcedure.mutation(async ({ ctx }) => {
    const { db, userId } = getTenantDbAndUserId(ctx);

    const [updated] = await db.update(
      users,
      {
        onboardingCompleted: 2, // completed
        onboardingCompletedAt: new Date(),
      },
      eq(users.id, userId)
    );

    return { success: true, user: updated };
  }),

  // 온보딩 건너뛰기
  skip: protectedProcedure.mutation(async ({ ctx }) => {
    const { db, userId } = getTenantDbAndUserId(ctx);

    const [updated] = await db.update(
      users,
      {
        onboardingCompleted: 2, // completed (skipped)
        onboardingSkipped: 1, // true
        onboardingCompletedAt: new Date(),
      },
      eq(users.id, userId)
    );

    return { success: true, user: updated };
  }),

  // 온보딩 리셋
  reset: protectedProcedure.mutation(async ({ ctx }) => {
    const { db, userId } = getTenantDbAndUserId(ctx);

    const [updated] = await db.update(
      users,
      {
        onboardingCompleted: 0, // not started
        onboardingStep: {
          welcome: false,
          profile: false,
          config: false,
          team: false,
        },
        onboardingStartedAt: null,
        onboardingCompletedAt: null,
        onboardingSkipped: 0, // false
      },
      eq(users.id, userId)
    );

    return { success: true, user: updated };
  }),

  // 프로필 데이터 업데이트
  updateProfile: protectedProcedure
    .input(
      z.object({
        displayName: z.string().min(1, '이름을 입력해주세요'),
        department: z.string().optional().nullable(),
        position: z.string().optional().nullable(),
        phoneNumber: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, userId } = getTenantDbAndUserId(ctx);

      const [updated] = await db.update(
        users,
        {
          displayName: input.displayName,
          department: input.department || null,
          position: input.position || null,
          phoneNumber: input.phoneNumber || null,
        },
        eq(users.id, userId)
      );

      return { success: true, user: updated };
    }),
});
