'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSignUp } from '@clerk/nextjs';
import { Mail, Lock, Eye, EyeOff, AlertCircle, User, Key, Building2, Calendar, FileText } from 'lucide-react';
import Link from 'next/link';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'code' | 'signup' | 'verify'>('code');
  const [tenantInfo, setTenantInfo] = useState<{ id?: string; name?: string; department?: { name: string } } | null>(null);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestConfirmPassword, setGuestConfirmPassword] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const [showGuestPassword, setShowGuestPassword] = useState(false);
  const [showGuestConfirmPassword, setShowGuestConfirmPassword] = useState(false);
  const [hireDate, setHireDate] = useState('');
  const [yearsOfService, setYearsOfService] = useState(0);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  const router = useRouter();
  const { isLoaded, signUp } = useSignUp();

  // 시크릿 코드 검증
  const handleSecretCodeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
    } catch {
      setError('시크릿 코드 확인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 회원가입
  const handleSignUpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isLoaded) {
      setLoading(false);
      return;
    }

    // 비밀번호 확인 검증
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    try {
      if (!signUp) {
        setError('인증 서비스를 초기화하는 중입니다. 잠시 후 다시 시도해주세요.');
        setLoading(false);
        return;
      }

      await signUp.create({
        emailAddress: email,
        password,
        firstName: name.split(' ')[0] || name,
        lastName: name.split(' ').slice(1).join(' ') || '',
      });

      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });

      setVerificationEmail(email);
      setVerificationCode('');
      setVerificationError('');
      setVerificationMessage('입력하신 이메일로 인증 코드가 전송되었습니다.');
      setStep('verify');
    } catch (err: unknown) {
      console.error('Sign up error:', err);
      const clerkError = err as { errors?: Array<{ code?: string; message?: string }> };
      const firstError = clerkError?.errors?.[0];

      if (firstError?.code === 'form_identifier_exists') {
        setError('이미 등록된 이메일입니다. 로그인해주세요.');
      } else if (firstError?.code === 'form_password_pwned') {
        setError('이 비밀번호는 유출된 기록이 있습니다. 다른 비밀번호를 사용해주세요.');
      } else if (firstError?.code === 'form_password_length_too_short') {
        setError('비밀번호는 최소 8자 이상이어야 합니다.');
      } else {
        setError(firstError?.message || '회원가입 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 게스트 계정 생성
  const handleGuestSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setGuestLoading(true);

    // 비밀번호 확인 검증
    if (guestPassword !== guestConfirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setGuestLoading(false);
      return;
    }

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
    } catch (err) {
      console.error('Guest signup error:', err);
      setError('게스트 계정 생성 중 오류가 발생했습니다.');
    } finally {
      setGuestLoading(false);
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setVerificationError('');
    setVerificationMessage('');
    setVerificationLoading(true);

    if (!signUp) {
      setVerificationError('인증 세션을 찾을 수 없습니다. 처음부터 다시 진행해주세요.');
      setVerificationLoading(false);
      return;
    }

    if (!verificationCode) {
      setVerificationError('이메일로 전송된 인증 코드를 입력해주세요.');
      setVerificationLoading(false);
      return;
    }

    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: verificationCode });

      if (attempt.status !== 'complete') {
        setVerificationError('인증이 완료되지 않았습니다. 코드를 다시 확인해주세요.');
        setVerificationLoading(false);
        return;
      }

      const createdUserId = signUp.createdUserId;
      if (!createdUserId) {
        setVerificationError('계정 정보를 확인할 수 없습니다. 다시 시도해주세요.');
        setVerificationLoading(false);
        return;
      }

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          password,
          secretCode,
          tenantId: tenantInfo?.id,
          hireDate: hireDate || undefined,
          yearsOfService,
          clerkUserId: createdUserId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setVerificationError(data.error || '회원가입에 실패했습니다.');
        setVerificationLoading(false);
        return;
      }

      setVerificationMessage('이메일 인증이 완료되었습니다. 로그인 페이지로 이동합니다.');
      router.push('/sign-in?verified=1');
    } catch (err: unknown) {
      console.error('Verification error:', err);
      const clerkError = err as { errors?: Array<{ code?: string; message?: string }> };
      const firstError = clerkError?.errors?.[0];

      if (firstError?.code === 'verification_failed') {
        setVerificationError('인증 코드가 올바르지 않습니다.');
      } else if (firstError?.code === 'expired') {
        setVerificationError('인증 코드가 만료되었습니다. 다시 전송해주세요.');
      } else {
        setVerificationError(firstError?.message || '이메일 인증 중 오류가 발생했습니다.');
      }
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!signUp) {
      setVerificationError('인증 세션을 찾을 수 없습니다.');
      return;
    }

    setVerificationError('');
    setVerificationMessage('');
    setResendLoading(true);

    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setVerificationMessage('새로운 인증 코드를 전송했습니다.');
    } catch (err) {
      console.error('Resend verification error:', err);
      setVerificationError('인증 코드를 다시 보내는 중 오류가 발생했습니다.');
    } finally {
      setResendLoading(false);
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
          ) : step === 'signup' ? (
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Lock className="w-4 h-4 inline mr-1" />
                    비밀번호 확인
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="비밀번호를 다시 입력하세요"
                      required
                      minLength={8}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      비밀번호가 일치하지 않습니다
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    입사일 (선택사항)
                  </label>
                  <input
                    type="date"
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    입사일을 입력하면 근속 년수를 자동으로 계산합니다
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <FileText className="w-4 h-4 inline mr-1" />
                    근속 년수 (경력)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={yearsOfService}
                    onChange={(e) => setYearsOfService(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    현재까지의 총 경력 년수 (예: 3년)
                  </p>
                </div>


                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      <p className="font-medium mb-1">📧 이메일 인증이 필요합니다</p>
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        회원가입 버튼을 누르시면 입력하신 이메일로 6자리 인증 코드가 전송됩니다.
                        이메일을 확인하여 인증을 완료해주세요.
                      </p>
                    </div>
                  </div>
                </div>

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
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">이메일 인증</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  {(verificationEmail || email || '입력한 이메일')} 주소로 전송된 6자리 인증 코드를 입력해주세요.
                </p>
              </div>

              <form onSubmit={handleVerificationSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    인증 코드
                  </label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    maxLength={6}
                    placeholder="123456"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800 text-center text-xl tracking-[0.5em]"
                  />
                </div>

                {verificationError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <p className="text-sm text-red-600 dark:text-red-400">{verificationError}</p>
                  </div>
                )}

                {verificationMessage && !verificationError && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg text-sm text-green-700 dark:text-green-300">
                    {verificationMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verificationLoading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verificationLoading ? '확인 중...' : '인증 완료'}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400 space-y-3">
                <p>이메일을 받지 못하셨나요?</p>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="w-full py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendLoading ? '재전송 중...' : '인증 코드 다시 받기'}
                </button>
              </div>
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
                  setGuestConfirmPassword('');
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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Lock className="w-4 h-4 inline mr-1" />
                  비밀번호 확인
                </label>
                <div className="relative">
                  <input
                    type={showGuestConfirmPassword ? 'text' : 'password'}
                    value={guestConfirmPassword}
                    onChange={(e) => setGuestConfirmPassword(e.target.value)}
                    placeholder="비밀번호를 다시 입력하세요"
                    required
                    minLength={8}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGuestConfirmPassword(!showGuestConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showGuestConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {guestConfirmPassword && guestPassword !== guestConfirmPassword && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    비밀번호가 일치하지 않습니다
                  </p>
                )}
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
                    setGuestConfirmPassword('');
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
