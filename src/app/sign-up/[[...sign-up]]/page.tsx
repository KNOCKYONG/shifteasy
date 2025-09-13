'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
  const router = useRouter();

  useEffect(() => {
    // 회원가입은 /join 페이지로 리다이렉트
    router.replace('/join');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-gray-600">회원가입 페이지로 이동 중...</p>
      </div>
    </div>
  );
}