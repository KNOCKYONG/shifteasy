'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { api } from '@/lib/trpc/client';

interface OnboardingContextType {
  onboardingStatus: {
    onboardingCompleted: number | null;
    onboardingStep: {
      welcome?: boolean;
      profile?: boolean;
      config?: boolean;
      team?: boolean;
    } | null;
    onboardingStartedAt: Date | null;
    onboardingCompletedAt: Date | null;
    onboardingSkipped: number | null;
  } | null;
  isLoading: boolean;
  startOnboarding: () => Promise<void>;
  updateStep: (step: 'welcome' | 'profile' | 'config' | 'team', completed: boolean) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const utils = api.useUtils();

  // 온보딩 상태 조회
  const { data: onboardingStatus, isLoading } = api.onboarding.getStatus.useQuery(undefined, {
    staleTime: 30000, // 30초 캐시
  });

  // 온보딩 시작
  const startMutation = api.onboarding.start.useMutation({
    onSuccess: () => {
      utils.onboarding.getStatus.invalidate();
    },
  });

  // 단계 업데이트
  const updateStepMutation = api.onboarding.updateStep.useMutation({
    onSuccess: () => {
      utils.onboarding.getStatus.invalidate();
    },
  });

  // 온보딩 완료
  const completeMutation = api.onboarding.complete.useMutation({
    onSuccess: () => {
      utils.onboarding.getStatus.invalidate();
    },
  });

  // 온보딩 건너뛰기
  const skipMutation = api.onboarding.skip.useMutation({
    onSuccess: () => {
      utils.onboarding.getStatus.invalidate();
    },
  });

  // 온보딩 재시작
  const resetMutation = api.onboarding.reset.useMutation({
    onSuccess: () => {
      utils.onboarding.getStatus.invalidate();
    },
  });

  const startOnboarding = async () => {
    await startMutation.mutateAsync();
  };

  const updateStep = async (step: 'welcome' | 'profile' | 'config' | 'team', completed: boolean) => {
    await updateStepMutation.mutateAsync({ step, completed });
  };

  const completeOnboarding = async () => {
    await completeMutation.mutateAsync();
  };

  const skipOnboarding = async () => {
    await skipMutation.mutateAsync();
  };

  const resetOnboarding = async () => {
    await resetMutation.mutateAsync();
  };

  return (
    <OnboardingContext.Provider
      value={{
        onboardingStatus: onboardingStatus || null,
        isLoading,
        startOnboarding,
        updateStep,
        completeOnboarding,
        skipOnboarding,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
