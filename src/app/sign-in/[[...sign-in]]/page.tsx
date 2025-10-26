'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSignIn, useUser } from '@clerk/nextjs';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useUser();

  // 이미 로그인되어 있으면 대시보드로 리다이렉트
  useEffect(() => {
    if (isSignedIn) {
      router.push('/dashboard');
    }
  }, [isSignedIn, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isLoaded) {
      setLoading(false);
      return;
    }

    // If already signed in, just redirect
    if (isSignedIn) {
      router.push('/dashboard');
      setLoading(false);
      return;
    }

    try {
      // Clerk를 사용하여 로그인
      const result = await signIn.create({
        identifier: email,
        password: password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.push('/dashboard');
      } else {
        // 추가 인증이 필요한 경우 (2FA 등)
        console.log('Additional auth required:', result);
        setError('추가 인증이 필요합니다.');
      }
    } catch (err: any) {
      console.error('Sign in error:', err);

      // Clerk 에러 메시지를 한글로 변환
      if (err.errors?.[0]?.message) {
        const errorMessage = err.errors[0].message;
        if (errorMessage.includes('already signed in')) {
          // 이미 로그인된 경우 대시보드로 리다이렉트
          router.push('/dashboard');
          return;
        } else if (errorMessage.includes('password')) {
          setError('비밀번호가 올바르지 않습니다.');
        } else if (errorMessage.includes('Identifier')) {
          setError('등록되지 않은 이메일입니다.');
        } else {
          setError('로그인에 실패했습니다. 다시 시도해주세요.');
        }
      } else if (err.message && err.message.includes('already signed in')) {
        // 이미 로그인된 경우 대시보드로 리다이렉트
        router.push('/dashboard');
        return;
      } else {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">ShiftEasy</h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">스마트한 근무 스케줄 관리 시스템</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">로그인</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Lock className="w-4 h-4 inline mr-1" />
                비밀번호
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">로그인 상태 유지</span>
              </label>
              <a href="#" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                비밀번호 찾기
              </a>
            </div>

            <button
              type="submit"
              disabled={loading || !isLoaded}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              아직 계정이 없으신가요?
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/sign-up"
                className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors text-center"
              >
                회원가입
              </Link>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                조직 관리자로부터 시크릿 코드를 받으셨나요?
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white/50 dark:bg-gray-800/50 backdrop-blur rounded-xl p-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            테스트 계정:
          </p>
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <p>📧 admin@shifteasy.com (관리자)</p>
            <p>📧 manager@shifteasy.com (8명 매니저)</p>
            <p>📧 manager.a@shifteasy.com (15명 매니저)</p>
            <p>📧 manager.b@shifteasy.com (20명 매니저)</p>
            <p>📧 kim-ha-jin@snuh.org (8명 부서 멤버)</p>
            <p>📧 jo.ara@shifteasy.com (15명 부서 멤버)</p>
            <p>📧 lee.byeol@shifteasy.com (20명 부서 멤버)</p>
            <p className="pt-2 text-gray-500 dark:text-gray-500">비밀번호는 Clerk에서 설정한 비밀번호 사용</p>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-600">
          © 2025 ShiftEasy. All rights reserved.
        </p>
      </div>
    </div>
  );
}