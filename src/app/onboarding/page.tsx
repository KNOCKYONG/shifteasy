'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingProvider, useOnboarding } from '@/components/onboarding/OnboardingProvider';
import { WelcomeStep } from '@/components/onboarding/steps/WelcomeStep';
import { ProfileStep } from '@/components/onboarding/steps/ProfileStep';
import { ConfigStep } from '@/components/onboarding/steps/ConfigStep';
import { TeamStep } from '@/components/onboarding/steps/TeamStep';
import { useCurrentUser } from '@/hooks/useCurrentUser';

type StepId = 'welcome' | 'profile' | 'config' | 'team';
type OnboardingMode = 'manager' | 'member';

type StepMeta = {
  id: StepId;
  title: string;
  description: string;
};

const MANAGER_STEPS: StepMeta[] = [
  {
    id: 'welcome',
    title: 'ShiftEasy 시작을 위한 3분 셋업',
    description: '첫 근무표를 만들기 전에 필요한 기본 설정들을 차근차근 안내해 드려요.',
  },
  {
    id: 'profile',
    title: '담당자 프로필 설정',
    description: '팀원들이 알아볼 수 있도록 이름·부서·직급을 정리해 주세요.',
  },
  {
    id: 'config',
    title: '기본 규칙과 근무유형 점검',
    description: '스케줄 생성에 쓰이는 규칙과 근무유형을 어디서 다루는지 알려 드립니다.',
  },
  {
    id: 'team',
    title: '팀 구성과 첫 스케줄 구상',
    description: '어떤 팀에 어떤 인원으로 스케줄을 짤지 미리 생각해 봅니다.',
  },
];

const MEMBER_STEPS: StepMeta[] = [
  {
    id: 'welcome',
    title: 'ShiftEasy에 오신 것을 환영합니다',
    description: '내 근무표를 쉽게 확인하고, 희망 근무와 교환을 편하게 관리할 수 있어요.',
  },
  {
    id: 'profile',
    title: '내 프로필 설정',
    description: '내 이름·부서·직급을 입력하면 근무표에 내 정보가 정확하게 표시됩니다.',
  },
  {
    id: 'config',
    title: '근무 규칙 안내',
    description: '관리자가 설정한 규칙에 따라 공정하게 근무표가 만들어집니다.',
  },
  {
    id: 'team',
    title: '팀 스케줄 함께 쓰기',
    description: '내가 속한 팀의 스케줄을 어떻게 보고 사용하는지 정리해 드려요.',
  },
];

function OnboardingContent() {
  const router = useRouter();
  const { role } = useCurrentUser();
  const {
    onboardingStatus,
    isLoading,
    startOnboarding,
    updateStep,
    completeOnboarding,
    skipOnboarding,
  } = useOnboarding();

  const mode: OnboardingMode =
    role === 'owner' || role === 'admin' || role === 'manager' ? 'manager' : 'member';

  const steps = mode === 'manager' ? MANAGER_STEPS : MEMBER_STEPS;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // 서버에 온보딩 시작 상태 기록
  useEffect(() => {
    if (onboardingStatus && onboardingStatus.onboardingCompleted === 0) {
      void startOnboarding();
    }

    if (onboardingStatus && onboardingStatus.onboardingCompleted === 2) {
      router.push('/dashboard');
    }
  }, [onboardingStatus, startOnboarding, router]);

  // 이미 완료한 단계가 있다면, 첫 미완료 단계부터 시작
  useEffect(() => {
    if (!onboardingStatus?.onboardingStep) return;

    const state = onboardingStatus.onboardingStep as Partial<Record<StepId, boolean>>;
    const firstIncompleteIndex = steps.findIndex(step => !state[step.id]);

    if (firstIncompleteIndex >= 0) {
      setCurrentStepIndex(firstIncompleteIndex);
    } else {
      setCurrentStepIndex(0);
    }
  }, [onboardingStatus, steps]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  const currentStep = steps[currentStepIndex] ?? steps[0];

  const completedStepsCount = onboardingStatus?.onboardingStep
    ? Object.values(onboardingStatus.onboardingStep).filter(Boolean).length
    : 0;

  const progress = (completedStepsCount / steps.length) * 100;

  const handleNext = async () => {
    await updateStep(currentStep.id, true);

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleComplete = async () => {
    await updateStep(currentStep.id, true);
    await completeOnboarding();
    router.push('/dashboard');
  };

  const handleSkipAll = async () => {
    await skipOnboarding();
    router.push('/dashboard');
  };

  const handleSkipStep = async () => {
    await updateStep(currentStep.id, true);

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      await completeOnboarding();
      router.push('/dashboard');
    }
  };

  // 키보드 네비게이션: ← / → / Enter
  useEffect(() => {
    const handler = async (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (currentStepIndex < steps.length - 1) {
          await updateStep(currentStep.id, true);
          setCurrentStepIndex(currentStepIndex + 1);
        }
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (currentStepIndex > 0) {
          setCurrentStepIndex(currentStepIndex - 1);
        }
        return;
      }

      if (event.key === 'Enter') {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        const tagName = target.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
          return;
        }

        event.preventDefault();
        if (currentStepIndex < steps.length - 1) {
          await updateStep(currentStep.id, true);
          setCurrentStepIndex(currentStepIndex + 1);
        } else {
          await updateStep(currentStep.id, true);
          await completeOnboarding();
          router.push('/dashboard');
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [currentStepIndex, steps, currentStep.id, updateStep, completeOnboarding, router]);

  const renderStep = () => {
    switch (currentStep.id) {
      case 'welcome':
        return <WelcomeStep onNext={handleNext} mode={mode} />;
      case 'profile':
        return <ProfileStep onNext={handleNext} onBack={handleBack} />;
      case 'config':
        return <ConfigStep onNext={handleNext} onBack={handleBack} mode={mode} />;
      case 'team':
        return <TeamStep onComplete={handleComplete} onBack={handleBack} mode={mode} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ShiftEasy 시작하기</h1>
          <p className="text-gray-600">
            {mode === 'manager'
              ? '첫 스케줄 생성을 위한 기본 정보를 3분 안에 함께 정리해 볼게요.'
              : '내 근무표를 더 편하게 보고 관리할 수 있도록 간단한 설정만 진행하면 됩니다.'}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            키보드 단축키: <span className="font-medium">←</span> 이전 단계,{' '}
            <span className="font-medium">→</span> 다음 단계,{' '}
            <span className="font-medium">Enter</span> 완료
          </p>
        </div>

        {/* 프로그레스 바 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">진행 상황</span>
            <span className="text-sm font-medium text-gray-700">
              {completedStepsCount}/{steps.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 단계 인디케이터 + 도움말 */}
        <div className="bg-white rounded-lg shadow px-6 py-6 mb-8 flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-4">
            {steps.map((step, index) => {
              const isCompleted = Boolean(onboardingStatus?.onboardingStep?.[step.id]);
              const isCurrent = index === currentStepIndex;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setCurrentStepIndex(index)}
                  className="flex items-center w-full text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-lg px-1 py-1"
                >
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded-full mr-4 flex items-center justify-center ${
                      isCompleted
                        ? 'bg-green-500 border-2 border-green-500'
                        : isCurrent
                        ? 'bg-blue-500 border-2 border-blue-500'
                        : 'bg-white border-2 border-gray-300'
                    }`}
                  >
                    {isCompleted && (
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    {isCurrent && !isCompleted && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                  <div>
                    <h3
                      className={`text-lg font-medium ${
                        isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {step.title}
                    </h3>
                    <p
                      className={`text-sm ${
                        isCompleted || isCurrent ? 'text-gray-600' : 'text-gray-400'
                      }`}
                    >
                      {step.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-gray-100 pt-4 lg:pt-0 lg:pl-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">현재 단계 도움말</h3>
              <button
                type="button"
                onClick={() => setIsHelpOpen(prev => !prev)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {isHelpOpen ? '접기' : '자세히'}
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-2">{currentStep.description}</p>
            {isHelpOpen && (
              <ul className="mt-2 space-y-1 text-xs text-gray-500 list-disc list-inside">
                <li>필요 없다면 이 단계는 건너뛰어도 됩니다.</li>
                <li>언제든지 나중에 설정/팀 관리 메뉴에서 다시 수정할 수 있습니다.</li>
                <li>← → 키로 단계 이동, Enter 키로 다음 단계로 이동할 수 있습니다.</li>
              </ul>
            )}
          </div>
        </div>

        {/* 현재 단계 콘텐츠 + 단계별 건너뛰기 */}
        <div className="bg-white rounded-lg shadow px-6 py-8 mb-8">
          {renderStep()}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSkipStep}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              이 단계 건너뛰기
            </button>
          </div>
        </div>

        {/* 전체 온보딩 건너뛰기 */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleSkipAll}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            온보딩 과정을 건너뛰고 바로 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <OnboardingProvider>
      <OnboardingContent />
    </OnboardingProvider>
  );
}

