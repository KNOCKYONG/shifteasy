'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, Shield, CreditCard } from 'lucide-react';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import ContactModal from '@/components/landing/ContactModal';

// Plan definitions
const PLANS = {
  starter: {
    name: 'Starter',
    price: 0,
    billingCycle: 'monthly' as const,
    trial: false,
    trialDays: 0,
    features: [
      '최대 30명까지 멤버 등록',
      'AI 자동 스케줄링',
      '팀 선호, 기피 패턴 적용',
    ] as const,
  },
  professional: {
    name: 'Professional',
    price: 29000,
    billingCycle: 'monthly' as const,
    trial: true,
    trialDays: 90,
    features: [
      '최대 50명까지 직원 계정',
      '강화된 AI 자동 스케줄링',
      '팀 선호, 기피 패턴 적용',
      '직원별 선호, 기피 패턴 적용',
      '직원별 일정별 선호 근무 요청 기능',
      '직원간 일정 변경 요청 기능',
      '일정 변경 알림 기능',
      '스케줄 데이터 분석 지원',
    ] as const,
  },
  enterprise: {
    name: 'Enterprise',
    price: 99000,
    billingCycle: 'monthly' as const,
    trial: false,
    trialDays: 0,
    features: [
      '무제한 사용자',
      '모든 프로페셔널 기능',
      '맞춤형 근무 규칙',
      '전용 계정 관리자',
      'SSO 통합',
      '24/7 전화 지원',
      'SLA 보장',
    ] as const,
  },
} as const;

type PlanKey = keyof typeof PLANS;

function BillingPageContent() {
  const { t: tBilling } = useTranslation('billing');
  const { t: tLanding } = useTranslation('landing');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('starter');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [professionalHospitalName, setProfessionalHospitalName] = useState('');
  const [professionalError, setProfessionalError] = useState('');
  const [provisionLoading, setProvisionLoading] = useState(false);
  const selectedPlanConfig = PLANS[selectedPlan];
  const selectedPlanTranslationBase = `pricing.${selectedPlan}`;
  const selectedPlanName = tLanding(`${selectedPlanTranslationBase}.name`, {
    defaultValue: selectedPlanConfig.name,
  });
  const selectedPlanHasTrial = selectedPlanConfig.trial && selectedPlan === 'professional';
  const isStarter = selectedPlan === 'starter';
  const isProfessional = selectedPlan === 'professional';
  const isEnterprise = selectedPlan === 'enterprise';

  // Get plan from URL query param or sessionStorage
  useEffect(() => {
    const planParam = searchParams.get('plan') as PlanKey | null;
    if (planParam && PLANS[planParam]) {
      setSelectedPlan(planParam);
    } else if (typeof window !== 'undefined') {
      // Check if there's a stored plan from pre-login
      const storedPlan = sessionStorage.getItem('billing_plan') as PlanKey | null;
      if (storedPlan && PLANS[storedPlan]) {
        setSelectedPlan(storedPlan);
        // Clear the stored plan
        sessionStorage.removeItem('billing_plan');
        // Update URL to reflect the plan
        router.replace(`/billing?plan=${storedPlan}`);
      }
    }
  }, [searchParams, router]);

  const startProfessionalOnboarding = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('billing_plan', 'professional');
      const params = new URLSearchParams({ plan: 'professional' });
      const storedSecret = sessionStorage.getItem('billing_secret_code');
      if (storedSecret) {
        params.set('secretCode', storedSecret);
        sessionStorage.removeItem('billing_secret_code');
      }
      router.push(`/sign-up?${params.toString()}`);
      return;
    }
    router.push('/sign-up?plan=professional');
  };

  const provisionProfessionalTenant = async () => {
    setProfessionalError('');
    if (!professionalHospitalName.trim()) {
      setProfessionalError('병원명을 입력해주세요.');
      return false;
    }

    setProvisionLoading(true);
    try {
      const response = await fetch('/api/auth/provision-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalName: professionalHospitalName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || '워크스페이스 생성에 실패했습니다.');
      }

      const data = await response.json();

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('billing_secret_code', data.secretCode);
        sessionStorage.setItem('billing_hospital_name', professionalHospitalName.trim());
      }

      return true;
    } catch (error) {
      console.error('Provision tenant error:', error);
      setProfessionalError(
        error instanceof Error ? error.message : '워크스페이스 생성에 실패했습니다.'
      );
      return false;
    } finally {
      setProvisionLoading(false);
    }
  };

  const handleProfessionalStart = async () => {
    const provisioned = await provisionProfessionalTenant();
    if (provisioned) {
      startProfessionalOnboarding();
    }
  };

  const handleProfessionalPayment = async () => {
    const provisioned = await provisionProfessionalTenant();
    if (!provisioned) {
      return;
    }
    await handlePayment();
  };

  const handlePayment = async () => {
    // Redirect to sign-up if not authenticated
    if (!user) {
      // Store the current plan in sessionStorage for post-login redirect
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('billing_plan', selectedPlan);
      }
      router.push('/sign-up');
      return;
    }

    if (selectedPlanConfig.trial && selectedPlan !== 'professional') return;

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
      alert(tBilling('errors.paymentFailed'));
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
            {tBilling('title', '요금제 선택')}
          </h1>
          <p className="text-xl text-gray-600">
            {tBilling('subtitle', '팀에 맞는 완벽한 플랜을 선택하세요')}
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {(Object.keys(PLANS) as PlanKey[]).map((planKey) => {
            const plan = PLANS[planKey];
            const isSelected = selectedPlan === planKey;
            const isFree = plan.price === 0;
            const translationBase = `pricing.${planKey}`;
            const planName = tLanding(`${translationBase}.name`, { defaultValue: plan.name });
            const planDescription = tLanding(`${translationBase}.description`, { defaultValue: '' });
            const priceLabel = tLanding(`${translationBase}.price`, {
              defaultValue: isFree ? '무료' : `₩${plan.price.toLocaleString()}`,
            });
            const priceUnit = tLanding(`${translationBase}.priceUnit`, { defaultValue: '' });
            const translatedFeatures = tLanding(`${translationBase}.features`, {
              returnObjects: true,
              defaultValue: plan.features as unknown as string[],
            });
            const featuresArray = Array.isArray(translatedFeatures) ? translatedFeatures : plan.features;
            const popularFlag = tLanding(`${translationBase}.popular`, { defaultValue: '' });
            const isPopular = String(popularFlag) === 'true';
            const showPrice = planKey !== 'enterprise';

            return (
              <div
                key={planKey}
                onClick={() => setSelectedPlan(planKey)}
                className={`relative bg-white rounded-2xl shadow-lg p-8 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:scale-105 ${
                  isSelected ? 'ring-4 ring-blue-600' : ''
                }`}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                      인기 플랜
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {planName}
                  </h3>
                  {planDescription && (
                    <p className="text-gray-600 mb-4 min-h-[48px]">
                      {planDescription}
                    </p>
                  )}
                  {showPrice && (
                    <div className="flex items-baseline justify-center gap-2 mb-2">
                      <span className="text-5xl font-bold text-gray-900">
                        {priceLabel}
                      </span>
                      {priceUnit && (
                        <span className="text-gray-500">{priceUnit}</span>
                      )}
                    </div>
                  )}
                  {plan.trial && planKey === 'professional' && (
                    <p className="text-blue-600 font-semibold mt-2">
                      {plan.trialDays}일 무료 체험
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-8">
                  {featuresArray.map((feature, index) => (
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
            {selectedPlanHasTrial ? '무료 체험 시작' : '결제 정보'}
          </h2>

          {/* Selected plan summary */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            {isProfessional && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  병원명
                </label>
                <input
                  type="text"
                  value={professionalHospitalName}
                  onChange={(e) => setProfessionalHospitalName(e.target.value)}
                  placeholder="예: 쉬프트이 병원"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {professionalError && (
                  <p className="text-sm text-red-600 mt-2">{professionalError}</p>
                )}
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-700 font-semibold">선택한 플랜:</span>
              <span className="text-xl font-bold text-gray-900">
                {selectedPlanName}
              </span>
            </div>
            {selectedPlan === 'professional' && selectedPlanConfig.price > 0 && (
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-700 font-semibold">결제 금액:</span>
                <span className="text-2xl font-bold text-blue-600">
                  ₩{selectedPlanConfig.price.toLocaleString()}
                </span>
              </div>
            )}
            {selectedPlan === 'professional' && selectedPlanHasTrial && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  ✨ {selectedPlanConfig.trialDays}일 무료 체험 후 자동으로 유료 플랜으로 전환됩니다.
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
            onClick={() => {
              if (isStarter) {
                router.push('/sign-up?guest=true');
              } else if (isEnterprise) {
                setIsContactModalOpen(true);
              } else {
                void handleProfessionalStart();
              }
            }}
            disabled={isProfessional ? provisionLoading : false}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProfessional && provisionLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                워크스페이스 생성 중...
              </>
            ) : isStarter ? '시작하기' : isEnterprise ? '문의하기' : '무료 체험 시작하기'}
          </button>

          {isProfessional && (
            <button
              onClick={() => void handleProfessionalPayment()}
              disabled={isProcessing}
              className="w-full mt-3 border border-blue-600 text-blue-600 py-3 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              바로 결제하기
            </button>
          )}

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

      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
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
