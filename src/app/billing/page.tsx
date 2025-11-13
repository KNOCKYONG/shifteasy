'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, Shield, CreditCard } from 'lucide-react';
import { loadTossPayments } from '@tosspayments/payment-sdk';

// Plan definitions
const PLANS = {
  starter: {
    name: 'Starter',
    price: 0,
    billingCycle: 'monthly' as const,
    trial: true,
    trialDays: 90,
    features: [
      'Up to 10 staff members',
      'Basic schedule management',
      'Mobile app access',
      'Email support',
    ] as const,
  },
  professional: {
    name: 'Professional',
    price: 29000,
    billingCycle: 'monthly' as const,
    trial: false,
    trialDays: 0,
    features: [
      'Up to 50 staff members',
      'Advanced schedule optimization',
      'Auto-scheduling with AI',
      'Team analytics & reports',
      'Priority support',
      'Custom notifications',
    ] as const,
  },
  enterprise: {
    name: 'Enterprise',
    price: 99000,
    billingCycle: 'monthly' as const,
    trial: false,
    trialDays: 0,
    features: [
      'Unlimited staff members',
      'Multi-location support',
      'Advanced AI optimization',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
      'On-premise deployment option',
    ] as const,
  },
} as const;

type PlanKey = keyof typeof PLANS;

function BillingPageContent() {
  const { t } = useTranslation('billing');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('starter');
  const [isProcessing, setIsProcessing] = useState(false);

  // Get plan from URL query param
  useEffect(() => {
    const planParam = searchParams.get('plan') as PlanKey | null;
    if (planParam && PLANS[planParam]) {
      setSelectedPlan(planParam);
    }
  }, [searchParams]);

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-up?redirect=/billing');
    }
  }, [isLoaded, user, router]);

  const handleStartTrial = async () => {
    if (!user) return;

    setIsProcessing(true);
    try {
      // For free trial, just redirect to dashboard
      router.push('/dashboard?trial=started');
    } catch (error) {
      console.error('Error starting trial:', error);
      alert(t('errors.trialStart'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async () => {
    if (!user || selectedPlan === 'starter') return;

    setIsProcessing(true);
    try {
      const plan = PLANS[selectedPlan];

      // Step 1: Create order
      const orderResponse = await fetch('/api/payments/toss/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: plan.price,
          currency: 'KRW',
          plan: selectedPlan,
          orderName: `ShiftEasy ${plan.name} Plan`,
        }),
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to create order');
      }

      const orderData = await orderResponse.json();

      // Step 2: Load Toss Payments widget
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        throw new Error('Toss client key not configured');
      }

      const tossPayments = await loadTossPayments(clientKey);

      // Step 3: Request payment
      await tossPayments.requestPayment('카드', {
        amount: orderData.amount,
        orderId: orderData.orderId,
        orderName: orderData.orderName,
        customerName: user.fullName || user.primaryEmailAddress?.emailAddress,
        customerEmail: user.primaryEmailAddress?.emailAddress,
        successUrl: `${window.location.origin}/billing/success`,
        failUrl: `${window.location.origin}/billing/fail`,
      });
    } catch (error) {
      console.error('Payment error:', error);
      alert(t('errors.paymentFailed'));
      setIsProcessing(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {t('title', '요금제 선택')}
          </h1>
          <p className="text-xl text-gray-600">
            {t('subtitle', '팀에 맞는 완벽한 플랜을 선택하세요')}
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {(Object.keys(PLANS) as PlanKey[]).map((planKey) => {
            const plan = PLANS[planKey];
            const isSelected = selectedPlan === planKey;
            const isFree = plan.price === 0;

            return (
              <div
                key={planKey}
                onClick={() => setSelectedPlan(planKey)}
                className={`relative bg-white rounded-2xl shadow-lg p-8 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:scale-105 ${
                  isSelected ? 'ring-4 ring-blue-600' : ''
                }`}
              >
                {/* Popular badge */}
                {planKey === 'professional' && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                      인기 플랜
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold text-gray-900">
                      {isFree ? '무료' : `₩${plan.price.toLocaleString()}`}
                    </span>
                    {!isFree && (
                      <span className="text-gray-500">/월</span>
                    )}
                  </div>
                  {plan.trial && (
                    <p className="text-blue-600 font-semibold mt-2">
                      {plan.trialDays}일 무료 체험
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-4 right-4">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Payment section */}
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-blue-600" />
            {selectedPlan === 'starter' ? '무료 체험 시작' : '결제 정보'}
          </h2>

          {/* Selected plan summary */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-700 font-semibold">선택한 플랜:</span>
              <span className="text-xl font-bold text-gray-900">
                {PLANS[selectedPlan].name}
              </span>
            </div>
            {PLANS[selectedPlan].price > 0 && (
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-700 font-semibold">결제 금액:</span>
                <span className="text-2xl font-bold text-blue-600">
                  ₩{PLANS[selectedPlan].price.toLocaleString()}
                </span>
              </div>
            )}
            {PLANS[selectedPlan].trial && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  ✨ {PLANS[selectedPlan].trialDays}일 무료 체험 후 자동으로 유료 플랜으로 전환됩니다.
                  체험 기간 중 언제든 취소 가능합니다.
                </p>
              </div>
            )}
          </div>

          {/* Security badge */}
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
            <Shield className="w-5 h-5 text-green-500" />
            <span>토스페이먼츠 안전 결제 (SSL 암호화)</span>
          </div>

          {/* Action button */}
          <button
            onClick={selectedPlan === 'starter' ? handleStartTrial : handlePayment}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                처리 중...
              </>
            ) : selectedPlan === 'starter' ? (
              '무료 체험 시작하기'
            ) : (
              '결제하기'
            )}
          </button>

          {/* Terms */}
          <p className="text-xs text-gray-500 text-center mt-4">
            결제를 진행하면{' '}
            <a href="/terms" className="text-blue-600 hover:underline">
              이용약관
            </a>{' '}
            및{' '}
            <a href="/privacy" className="text-blue-600 hover:underline">
              개인정보처리방침
            </a>
            에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <BillingPageContent />
    </Suspense>
  );
}
