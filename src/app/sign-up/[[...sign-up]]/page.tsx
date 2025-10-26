'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSignUp } from '@clerk/nextjs';
import { Mail, Lock, Eye, EyeOff, AlertCircle, User, Key, Building2 } from 'lucide-react';
import Link from 'next/link';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'code' | 'signup'>('code');
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const [showGuestPassword, setShowGuestPassword] = useState(false);

  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();

  // 시크릿 코드 검증
  const handleSecretCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/validate-secret-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretCode }),
      });

      const data = await response.json();

      if (data.valid) {
        setTenantInfo({
          ...data.tenant,
          department: data.department, // 부서 정보 저장
        });
        setStep('signup');
      } else {
        setError('유효하지 않은 시크릿 코드입니다.');
      }
    } catch (err) {
      setError('시크릿 코드 확인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 회원가입
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isLoaded) {
      setLoading(false);
      return;
    }

    try {
      // 먼저 백엔드 API로 회원가입 처리 (데이터베이스 등록)
      const signupResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name,
          secretCode,
          tenantId: tenantInfo?.id,
        }),
      });

      const signupData = await signupResponse.json();

      if (!signupResponse.ok) {
        setError(signupData.error || '회원가입에 실패했습니다.');
        setLoading(false);
        return;
      }

      // 회원가입 성공 후 바로 로그인
      router.push('/sign-in');

    } catch (err: any) {
      console.error('Sign up error:', err);
      setError('회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 게스트 계정 생성
  const handleGuestSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setGuestLoading(true);

    try {
      const response = await fetch('/api/auth/guest-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: guestEmail,
          password: guestPassword,
          name: guestName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '게스트 계정 생성에 실패했습니다.');
        setGuestLoading(false);
        return;
      }

      // 게스트 계정 생성 성공 - 로그인 페이지로 이동
      router.push('/sign-in?message=guest-created');
    } catch (err: any) {
      console.error('Guest signup error:', err);
      setError('게스트 계정 생성 중 오류가 발생했습니다.');
    } finally {
      setGuestLoading(false);
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
          {step === 'code' ? (
            <>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">조직 참여</h2>
              <form onSubmit={handleSecretCodeSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Key className="w-4 h-4 inline mr-1" />
                    시크릿 코드
                  </label>
                  <input
                    type="text"
                    value={secretCode}
                    onChange={(e) => setSecretCode(e.target.value)}
                    placeholder="조직 관리자가 제공한 코드 입력"
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '확인 중...' : '다음'}
                </button>
              </form>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowGuestForm(true)}
                  className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                >
                  게스트로 시작하기
                </button>
                <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
                  시크릿 코드 없이 체험 계정으로 시작할 수 있습니다
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">회원가입</h2>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                  <p>
                    <Building2 className="w-4 h-4 inline mr-1" />
                    {tenantInfo?.name}
                  </p>
                  {tenantInfo?.department && (
                    <p className="pl-5 text-blue-600 dark:text-blue-400">
                      부서: {tenantInfo.department.name}
                    </p>
                  )}
                </div>
              </div>

              <form onSubmit={handleSignUpSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <User className="w-4 h-4 inline mr-1" />
                    이름
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800"
                  />
                </div>

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
                      placeholder="8자 이상, 영문+숫자+특수문자"
                      required
                      minLength={8}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800"
                      autoComplete="new-password"
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    비밀번호는 8자 이상, 영문+숫자+특수문자를 포함해야 합니다
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !isLoaded}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '가입 중...' : '회원가입'}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('code')}
                  className="w-full py-2 px-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
                >
                  ← 시크릿 코드 다시 입력
                </button>
              </form>
            </>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              이미 계정이 있으신가요?{' '}
              <Link
                href="/sign-in"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                로그인
              </Link>
            </p>
          </div>
        </div>

        {step === 'code' && (
          <div className="mt-6 bg-white/50 dark:bg-gray-800/50 backdrop-blur rounded-xl p-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              테스트용 시크릿 코드:
            </p>
            <p className="text-lg font-mono text-blue-600 dark:text-blue-400">
              TEST-2024
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              테스트 조직 (ShiftEasy Test Hospital)
            </p>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-600">
          © 2025 ShiftEasy. All rights reserved.
        </p>
      </div>

      {/* 게스트 계정 생성 모달 */}
      {showGuestForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">게스트 계정 만들기</h2>
              <button
                onClick={() => {
                  setShowGuestForm(false);
                  setError('');
                  setGuestEmail('');
                  setGuestPassword('');
                  setGuestName('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              시크릿 코드 없이 체험 계정을 만들 수 있습니다. 매니저 권한으로 모든 기능을 체험해보세요.
            </p>

            <form onSubmit={handleGuestSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  이름
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="홍길동"
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  이메일
                </label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="guest@example.com"
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
                    type={showGuestPassword ? 'text' : 'password'}
                    value={guestPassword}
                    onChange={(e) => setGuestPassword(e.target.value)}
                    placeholder="8자 이상"
                    required
                    minLength={8}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGuestPassword(!showGuestPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showGuestPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  비밀번호는 8자 이상이어야 합니다
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowGuestForm(false);
                    setError('');
                    setGuestEmail('');
                    setGuestPassword('');
                    setGuestName('');
                  }}
                  className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={guestLoading}
                  className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {guestLoading ? '생성 중...' : '계정 만들기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}