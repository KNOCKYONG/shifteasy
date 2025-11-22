'use client';

import { AppSurface } from '@/components/layout/AppSurface';

export default function CommunityComingSoonPage() {
  return (
    <AppSurface>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-xl mx-auto bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            커뮤니티 기능은 준비 중입니다
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            동료 간호사들과 경험을 나누고, 서로 응원과 정보를 주고받을 수 있는
            커뮤니티 공간을 열심히 준비하고 있어요.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            정식 오픈 전까지는 상단 네비게이션의 “커뮤니티” 버튼에서
            서비스 준비중 안내만 표시됩니다.
          </p>
        </div>
      </div>
    </AppSurface>
  );
}

