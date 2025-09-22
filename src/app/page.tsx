'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded) {
      if (userId) {
        // 로그인된 사용자는 팀 페이지로
        router.push('/team');
      } else {
        // 로그인되지 않은 사용자는 로그인 페이지로
        router.push('/sign-in');
      }
    }
  }, [isLoaded, userId, router]);

  // 로딩 중 표시
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}