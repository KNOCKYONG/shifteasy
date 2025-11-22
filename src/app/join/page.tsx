'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinPage() {
  const router = useRouter();

  useEffect(() => {
    // 인증 없이 바로 대시보드로 이동 (개발/테스트 용도)
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">ShiftEasy</h1>
        <p className="text-gray-600">대시보드로 이동 중...</p>
      </div>
    </div>
  );
}
