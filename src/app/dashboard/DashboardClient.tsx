"use client";

import { useState, useEffect } from 'react';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { MemberDashboard } from '@/components/dashboard/MemberDashboard';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LottieLoadingOverlay } from '@/components/common/LottieLoadingOverlay';
import { AppSurface } from '@/components/layout/AppSurface';

export default function DashboardClient() {
  const [mounted, setMounted] = useState(false);
  const currentUser = useCurrentUser();

  useEffect(() => {
    setMounted(true);
  }, []);

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

