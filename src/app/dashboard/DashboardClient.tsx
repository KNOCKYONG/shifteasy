"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { MemberDashboard } from '@/components/dashboard/MemberDashboard';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LottieLoadingOverlay } from '@/components/common/LottieLoadingOverlay';
import { AppSurface } from '@/components/layout/AppSurface';
import { api } from '@/lib/trpc/client';

export default function DashboardClient() {
  const [mounted, setMounted] = useState(false);
  const currentUser = useCurrentUser();
  const router = useRouter();

  // 온보딩 상태 확인
  const { data: onboardingStatus, isLoading: isLoadingOnboarding } = api.onboarding.getStatus.useQuery(undefined, {
    enabled: currentUser.isLoaded && mounted,
    staleTime: 60000, // 1분 캐시
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // 온보딩 미완료 시 리다이렉션
  useEffect(() => {
    if (mounted && currentUser.isLoaded && onboardingStatus) {
      // 온보딩 미완료 시 (0 = not started or 1 = in progress)
      if (onboardingStatus.onboardingCompleted !== 2) {
        router.push('/onboarding');
      }
    }
  }, [mounted, currentUser.isLoaded, onboardingStatus, router]);

  if (!mounted || !currentUser.isLoaded) {
    return (
      <AppSurface>
        <div className="container mx-auto px-4 py-8">
          <LottieLoadingOverlay fullScreen message="대시보드를 불러오는 중입니다..." />
        </div>
      </AppSurface>
    );
  }

  if (currentUser.role === 'member') {
    return (
      <AppSurface>
        <div className="container mx-auto px-4 py-8">
          <MemberDashboard />
        </div>
      </AppSurface>
    );
  }

  return (
    <AppSurface>
      <div className="container mx-auto px-4 py-8">
        <AdminDashboard />
      </div>
    </AppSurface>
  );
}

