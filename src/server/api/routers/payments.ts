import { createTRPCRouter, protectedProcedure } from '../trpc';
import { db } from '@/db';
import { subscriptions } from '@/db/schema/payments';
import { eq, and, inArray } from 'drizzle-orm';

export const paymentsRouter = createTRPCRouter({
  // 현재 사용자의 구독 상태 확인
  getSubscriptionStatus: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

    // 활성 구독 조회
    const activeSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.tenantId, tenantId),
          inArray(subscriptions.status, ['active', 'trialing'])
        )
      )
      .limit(1);

    const hasActiveSubscription = activeSubscriptions.length > 0;
    const subscription = activeSubscriptions[0];

    return {
      hasActiveSubscription,
      subscription: subscription || null,
      features: {
        aiScheduling: hasActiveSubscription, // AI 스케줄링은 유료 구독자만
        maxEmployees: hasActiveSubscription ? 100 : 10,
        advancedReports: hasActiveSubscription,
      },
    };
  }),

  // AI 기능 사용 가능 여부 확인
  canUseAIFeatures: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

    // 활성 구독 확인
    const activeSubscriptions = await db
      .select({
        id: subscriptions.id,
        plan: subscriptions.plan,
        status: subscriptions.status,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.tenantId, tenantId),
          inArray(subscriptions.status, ['active', 'trialing'])
        )
      )
      .limit(1);

    const canUse = activeSubscriptions.length > 0;
    const reason = canUse
      ? null
      : '유료 플랜 구독이 필요합니다. 빌링 페이지에서 플랜을 선택해주세요.';

    return {
      canUse,
      reason,
      subscription: activeSubscriptions[0] || null,
    };
  }),
});
