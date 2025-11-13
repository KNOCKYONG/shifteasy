'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSignUp } from '@clerk/nextjs';
import { Mail, Loader2, CheckCircle, XCircle } from 'lucide-react';

function VerifyEmailContent() {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('이메일 인증을 진행하고 있습니다...');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp, isLoaded } = useSignUp();

  useEffect(() => {
    const verifyEmail = async () => {
      const code = searchParams.get('code');
      const email = searchParams.get('email');

      if (!code) {
        setStatus('error');
        setMessage('인증 코드가 없습니다. 회원가입 페이지에서 다시 시도해주세요.');
        return;
      }

      if (!isLoaded || !signUp) {
        return;
      }

      try {
        // 인증 코드로 이메일 검증 시도
        const result = await signUp.attemptEmailAddressVerification({ code });

        if (result.status === 'complete') {
          setStatus('success');
          setMessage('이메일 인증이 완료되었습니다. 잠시 후 로그인 페이지로 이동합니다.');

          // 3초 후 로그인 페이지로 이동
          setTimeout(() => {
            router.push('/sign-in?verified=1');
          }, 3000);
        } else {
          setStatus('error');
          setMessage('이메일 인증에 실패했습니다. 다시 시도해주세요.');
        }
      } catch (err) {
        console.error('Email verification error:', err);
        setStatus('error');
        setMessage('인증 코드가 올바르지 않거나 만료되었습니다. 회원가입 페이지에서 새 코드를 받아주세요.');
      }
    };

    if (isLoaded) {
      verifyEmail();
    }
  }, [isLoaded, signUp, searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">ShiftEasy</h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">이메일 인증</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8">
          <div className="flex flex-col items-center text-center">
            {status === 'verifying' && (
              <>
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  인증 중...
                </h2>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  인증 완료!
                </h2>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="w-16 h-16 text-red-600 mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  인증 실패
                </h2>
              </>
            )}

            <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>

            {status === 'error' && (
              <button
                onClick={() => router.push('/sign-up')}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                회원가입 페이지로 돌아가기
              </button>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-600">
          © 2025 ShiftEasy. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
