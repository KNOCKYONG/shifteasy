'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle } from 'lucide-react';

export default function VerifyEmailPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/sign-in');
    }, 4000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            ShiftEasy
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            이메일 인증 안내
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8">
          <div className="flex flex-col items-center text-center">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-4" />
            <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              이메일을 확인해주세요
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              가입 시 입력한 주소로 인증 메일을 보냈습니다. 메일의 안내에 따라
              인증을 완료한 뒤 다시 로그인해주세요.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              인증 후 자동으로 로그인 페이지로 이동합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
