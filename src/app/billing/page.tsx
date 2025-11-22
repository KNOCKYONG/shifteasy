'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Check, Shield, CreditCard, Loader2 } from 'lucide-react';
import ContactModal from '@/components/landing/ContactModal';
// Migration feature temporarily disabled (Clerk removed)
// import MigrationProposalModal from '@/components/migration/MigrationProposalModal';
// import MigrationProgressModal from '@/components/migration/MigrationProgressModal';
// import { MigrationOptions, GuestAccountInfo } from '@/lib/utils/migration';

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
  // Migration feature disabled - Clerk removed
  // const { user } = useUser();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('starter');
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  // const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  // const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  // const [migrationId, setMigrationId] = useState<string>('');
  // const [migrationResult, setMigrationResult] = useState<any>(null);
  // const [guestAccountInfo, setGuestAccountInfo] = useState<GuestAccountInfo | null>(null);
  // const [migrationDataStats, setMigrationDataStats] = useState<any>(null);
  const selectedPlanConfig = PLANS[selectedPlan];
  const selectedPlanTranslationBase = `pricing.${selectedPlan}`;
  const selectedPlanName = tLanding(`${selectedPlanTranslationBase}.name`, {
    defaultValue: selectedPlanConfig.name,
  });
  const selectedPlanHasTrial = selectedPlanConfig.trial && selectedPlan === 'professional';
  const isStarter = selectedPlan === 'starter';
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

  // Migration feature disabled - Clerk removed
  // useEffect(() => {
  //   if (user?.id && selectedPlan === 'professional') {
  //     fetch('/api/migration/check-guest', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //     })
  //       .then((res) => res.json())
  //       .then((data) => {
  //         if (data.success && data.guestInfo) {
  //           setGuestAccountInfo(data.guestInfo);
  //           setMigrationDataStats(data.dataStats);
  //           if (data.guestInfo.isGuest && data.guestInfo.canMigrate) {
  //             setIsMigrationModalOpen(true);
  //           }
  //         }
  //       })
  //       .catch((err) => {
  //         console.error('Error checking guest account:', err);
  //       });
  //   }
  // }, [user, selectedPlan]);

  const startProfessionalOnboarding = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('billing_plan', 'professional');
    }
    router.push('/sign-up?plan=professional');
  };

  const handlePrimaryAction = () => {
    if (selectedPlan === 'starter') {
      router.push('/sign-up?guest=true');
      return;
    }
    if (selectedPlan === 'enterprise') {
      setIsContactModalOpen(true);
      return;
    }

    // Migration feature disabled - direct to professional signup
    startProfessionalOnboarding();
  };

  // Migration handlers disabled - Clerk removed
  // const handleMigrationConfirm = async (...) => { ... };
  // const handleProgressModalClose = () => { ... };

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
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-700 font-semibold">선택한 플랜:</span>
              <span className="text-xl font-bold text-gray-900">
                {selectedPlanName}
              </span>
            </div>
            {selectedPlan === 'professional' && selectedPlanHasTrial && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  {`${selectedPlanConfig.trialDays}일 무료 체험 종료 후 자동으로 무료 모드로 전환됩니다. 체험 기간 중 언제든 취소 가능합니다.`}
                </p>
                <p className="hidden">
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
            onClick={handlePrimaryAction}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isStarter ? '시작하기' : isEnterprise ? '문의하기' : '결제 없이 시작하기'}
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

      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />

      {/* Migration modals disabled - Clerk removed */}
      {/* <MigrationProposalModal ... /> */}
      {/* <MigrationProgressModal ... /> */}
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
