'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSignUp } from '@clerk/nextjs';
import { Mail, Lock, Eye, EyeOff, AlertCircle, User, Key, Building2, Calendar, FileText, Copy } from 'lucide-react';
import Link from 'next/link';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [isSecretCodeLocked, setIsSecretCodeLocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'code' | 'signup' | 'verify' | 'complete'>('code');
  const [planType, setPlanType] = useState<'standard' | 'professional'>('standard');
  const [tenantInfo, setTenantInfo] = useState<{ id?: string; name?: string; department?: { name: string } } | null>(null);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestConfirmPassword, setGuestConfirmPassword] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestHospitalName, setGuestHospitalName] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const [showGuestPassword, setShowGuestPassword] = useState(false);
  const [showGuestConfirmPassword, setShowGuestConfirmPassword] = useState(false);
  const [guestStep, setGuestStep] = useState<'form' | 'verify'>('form');
  const [guestVerificationCode, setGuestVerificationCode] = useState('');
  const [guestVerificationError, setGuestVerificationError] = useState('');
  const [guestVerificationMessage, setGuestVerificationMessage] = useState('');
  const [guestVerificationLoading, setGuestVerificationLoading] = useState(false);
  const [guestVerificationEmail, setGuestVerificationEmail] = useState('');
  const [guestResendLoading, setGuestResendLoading] = useState(false);
  const [hireDate, setHireDate] = useState('');
  const [yearsOfService, setYearsOfService] = useState(0);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalError, setHospitalError] = useState('');
  const [provisionedSecretCode, setProvisionedSecretCode] = useState('');
  const [secretCopyMessage, setSecretCopyMessage] = useState('');
  const [autoSecretAttempted, setAutoSecretAttempted] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, signUp } = useSignUp();
  const isProfessionalPlan = searchParams.get('plan') === 'professional';

  const resetGuestState = () => {
    setError('');
    setGuestEmail('');
    setGuestPassword('');
    setGuestConfirmPassword('');
    setGuestName('');
    setGuestHospitalName('');
    setGuestStep('form');
    setGuestVerificationCode('');
    setGuestVerificationError('');
    setGuestVerificationMessage('');
    setGuestVerificationEmail('');
    setGuestLoading(false);
    setGuestVerificationLoading(false);
    setGuestResendLoading(false);
  };

  const handleGuestVerificationSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGuestVerificationError('');
    setGuestVerificationMessage('');
    setGuestVerificationLoading(true);

    if (!signUp) {
      setGuestVerificationError('인증 세션을 찾을 수 없습니다. 처음부터 다시 진행해주세요.');
      setGuestVerificationLoading(false);
      return;
    }

    if (!guestVerificationCode) {
      setGuestVerificationError('이메일로 전송된 인증 코드를 입력해주세요.');
      setGuestVerificationLoading(false);
      return;
    }

    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: guestVerificationCode });

      if (attempt.status !== 'complete') {
        setGuestVerificationError('인증이 완료되지 않았습니다. 코드를 다시 확인해주세요.');
        setGuestVerificationLoading(false);
        return;
      }

      const createdUserId = signUp.createdUserId;
      if (!createdUserId) {
        setGuestVerificationError('계정 정보를 확인할 수 없습니다. 다시 시도해주세요.');
        setGuestVerificationLoading(false);
        return;
      }

      const response = await fetch('/api/auth/guest-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: guestEmail,
          name: guestName,
          hospitalName: guestHospitalName,
          clerkUserId: createdUserId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setGuestVerificationError(data.error || '게스트 계정 생성에 실패했습니다.');
        setGuestVerificationLoading(false);
        return;
      }

      closeGuestForm();
      router.push('/sign-in?message=guest-created');
    } catch (err) {
      console.error('Guest verification error:', err);
      setGuestVerificationError('게스트 계정 생성 중 오류가 발생했습니다.');
    } finally {
      setGuestVerificationLoading(false);
    }
  };

  const handleGuestResendVerification = async () => {
    if (!signUp) {
      setGuestVerificationError('인증 세션을 찾을 수 없습니다. 처음부터 다시 진행해주세요.');
      return;
    }

    setGuestVerificationError('');
    setGuestResendLoading(true);

    try {
      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });
      setGuestVerificationMessage('인증 코드가 다시 전송되었습니다.');
    } catch (err) {
      console.error('Guest verification resend error:', err);
      setGuestVerificationError('인증 코드 다시 보내기에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setGuestResendLoading(false);
    }
  };

  const closeGuestForm = () => {
    setShowGuestForm(false);
    resetGuestState();
  };

  const handleCompleteContinue = () => {
    router.push('/sign-in?verified=1');
  };

  const handleSecretCodeCopy = async () => {
    const codeToCopy = provisionedSecretCode || secretCode;
    if (!codeToCopy) return;
    try {
      await navigator.clipboard.writeText(codeToCopy);
      setSecretCopyMessage('시크릿 코드를 복사했습니다.');
    } catch (err) {
      console.error('Secret code copy error:', err);
      setSecretCopyMessage('코드 복사에 실패했습니다. 직접 메모해 주세요.');
    }
  };

  useEffect(() => {
    const guestMode = searchParams.get('guest');
    if (guestMode && (guestMode === '1' || guestMode.toLowerCase() === 'true')) {
      resetGuestState();
      setShowGuestForm(true);
    }

    if (isProfessionalPlan) {
      setPlanType('professional');
      setStep('signup');
      setIsSecretCodeLocked(true);
      if (typeof window !== 'undefined') {
        const storedHospital = sessionStorage.getItem('billing_hospital_name');
        if (storedHospital) {
          setHospitalName(storedHospital);
        }
      }
    } else {
      setPlanType('standard');
      setStep('code');
      setIsSecretCodeLocked(false);
    }

    const presetSecret = searchParams.get('secretCode') || searchParams.get('secret');
    if (presetSecret) {
      setSecretCode(presetSecret);
      setProvisionedSecretCode(presetSecret);
      setIsSecretCodeLocked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isProfessionalPlan]);

  useEffect(() => {
    if (isSecretCodeLocked && secretCode && step === 'code' && !autoSecretAttempted) {
      setAutoSecretAttempted(true);
      void verifySecretCode(secretCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSecretCodeLocked, secretCode, step, autoSecretAttempted]);

  const verifySecretCode = async (code: string) => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/validate-secret-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretCode: code }),
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

  // 시크릿 코드 검증
  const handleSecretCodeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!secretCode) {
      setError('시크릿 코드를 입력해주세요.');
      return;
    }
    await verifySecretCode(secretCode);
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

    if (planType === 'professional') {
      if (!hospitalName.trim()) {
        setHospitalError('병원명을 입력해주세요.');
        setLoading(false);
        return;
      }
      setHospitalError('');
    }

    try {
      if (!signUp) {
        setError('인증 서비스를 초기화하는 중입니다. 잠시 후 다시 시도해주세요.');
        setLoading(false);
        return;
      }

      // Clerk 인스턴스에서 name 필드가 비활성화되어 있어서 이메일과 비밀번호만 전송
      await signUp.create({
        emailAddress: email,
        password,
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
    setGuestVerificationError('');
    setGuestVerificationMessage('');
    setGuestLoading(true);

    // 비밀번호 확인 검증
    if (guestPassword !== guestConfirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setGuestLoading(false);
      return;
    }

    if (!isLoaded || !signUp) {
      setError('인증 서비스를 초기화하는 중입니다. 잠시 후 다시 시도해주세요.');
      setGuestLoading(false);
      return;
    }

    try {
      await signUp.create({
        emailAddress: guestEmail,
        password: guestPassword,
      });

      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });

      setGuestVerificationEmail(guestEmail);
      setGuestVerificationCode('');
      setGuestVerificationMessage('입력하신 이메일로 인증 코드가 전송되었습니다.');
      setGuestStep('verify');
    } catch (err: unknown) {
      console.error('Guest signup error:', err);
      const clerkError = err as { errors?: Array<{ code?: string; message?: string }> };
      const firstError = clerkError?.errors?.[0];

      if (firstError?.code === 'form_identifier_exists') {
        setError('이미 등록된 이메일입니다. 로그인해주세요.');
      } else if (firstError?.code === 'form_password_pwned') {
        setError('이 비밀번호는 유출된 기록이 있습니다. 다른 비밀번호를 사용해주세요.');
      } else if (firstError?.code === 'form_password_length_too_short') {
        setError('비밀번호는 최소 8자 이상이어야 합니다.');
      } else {
        setError(firstError?.message || '게스트 계정 생성 중 오류가 발생했습니다.');
      }
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

      let finalSecretCode = secretCode;
      let finalTenantId = tenantInfo?.id;

      if (planType === 'professional') {
        if (!hospitalName.trim()) {
          setVerificationError('병원명을 입력해주세요.');
          setVerificationLoading(false);
          return;
        }

        try {
          const provisionResponse = await fetch('/api/auth/provision-tenant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hospitalName: hospitalName.trim() }),
          });

          const provisionData = await provisionResponse.json();

          if (!provisionResponse.ok) {
            throw new Error(provisionData?.error || '워크스페이스 생성에 실패했습니다.');
          }

          finalSecretCode = provisionData.secretCode;
          finalTenantId = provisionData.tenantId;
          setProvisionedSecretCode(provisionData.secretCode);
          setTenantInfo({
            id: provisionData.tenantId,
            name: hospitalName.trim(),
            department: { name: '기본 부서' },
          });

          if (typeof window !== 'undefined') {
            sessionStorage.setItem('billing_secret_code', provisionData.secretCode);
            sessionStorage.setItem('billing_hospital_name', hospitalName.trim());
          }
        } catch (provisionError) {
          console.error('Tenant provisioning error:', provisionError);
          setVerificationError(
            provisionError instanceof Error ? provisionError.message : '워크스페이스 생성에 실패했습니다.'
          );
          setVerificationLoading(false);
          return;
        }
      }

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          password,
          secretCode: finalSecretCode,
          tenantId: finalTenantId,
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

      if (planType === 'professional') {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('billing_secret_code');
          sessionStorage.removeItem('billing_hospital_name');
        }
        setVerificationMessage('이메일 인증이 완료되었습니다.');
        setStep('complete');
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
                    readOnly={isSecretCodeLocked}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800"
                  />
                  {isSecretCodeLocked && (
                    <p className="text-xs text-blue-600 mt-2">
                      제공된 시크릿 코드가 자동으로 적용되었습니다.
                    </p>
                  )}
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                {!isSecretCodeLocked && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? '확인 중...' : '다음'}
                  </button>
                )}

                {isSecretCodeLocked && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    시크릿 코드를 확인 중입니다...
                  </p>
                )}
              </form>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    resetGuestState();
                    setShowGuestForm(true);
                  }}
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
                {planType === 'professional' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Building2 className="w-4 h-4 inline mr-1" />
                      병원명
                    </label>
                    <input
                      type="text"
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      placeholder="예: 쉬프트이 병원"
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800"
                    />
                    {hospitalError && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-2">{hospitalError}</p>
                    )}
                  </div>
                )}
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
          ) : step === 'verify' ? (
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
                    className="w-full px-4 py-3 border.border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800 text-center text-xl tracking-[0.5em]"
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
          ) : step === 'complete' ? (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">가입 완료</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  아래 시크릿 코드를 복사하여 팀원들에게 공유하면 조직 참여를 안내할 수 있습니다.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="text-3xl font-mono tracking-[0.5em] text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 rounded-xl py-4 px-4">
                  {provisionedSecretCode || secretCode}
                </div>
                <button
                  type="button"
                  onClick={handleSecretCodeCopy}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  시크릿 코드 복사하기
                </button>
                {secretCopyMessage && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{secretCopyMessage}</p>
                )}
                <button
                  type="button"
                  onClick={handleCompleteContinue}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  로그인으로 이동
                </button>
              </div>
            </>
          ) : null}

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
                onClick={closeGuestForm}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              시크릿 코드 없이 체험 계정을 만들 수 있습니다. 매니저 권한으로 모든 기능을 체험해보세요.
              이메일 인증을 완료해야 계정이 활성화됩니다.
            </p>

            {guestStep === 'form' ? (
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
                    <Building2 className="w-4 h-4 inline mr-1" />
                    병원명
                  </label>
                  <input
                    type="text"
                    value={guestHospitalName}
                    onChange={(e) => setGuestHospitalName(e.target.value)}
                    placeholder="쉬프트이 병원"
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
                    onClick={closeGuestForm}
                    className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={guestLoading}
                    className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {guestLoading ? '인증 코드 보내는 중...' : '인증 코드 받기'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-sm text-blue-700 dark:text-blue-200 mb-4">
                  {(guestVerificationEmail || guestEmail || '입력한 이메일')} 주소로 전송된 6자리 인증 코드를 입력해주세요.
                </div>

                <form onSubmit={handleGuestVerificationSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      인증 코드
                    </label>
                    <input
                      type="text"
                      value={guestVerificationCode}
                      onChange={(e) => setGuestVerificationCode(e.target.value)}
                      maxLength={6}
                      placeholder="123456"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800 text-center text-xl tracking-[0.5em]"
                    />
                  </div>

                  {guestVerificationError && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                      <p className="text-sm text-red-600 dark:text-red-400">{guestVerificationError}</p>
                    </div>
                  )}

                  {guestVerificationMessage && !guestVerificationError && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg text-sm text-green-700 dark:text-green-300">
                      {guestVerificationMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={guestVerificationLoading}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {guestVerificationLoading ? '확인 중...' : '인증 완료'}
                  </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400 space-y-3">
                  <p>이메일을 받지 못하셨나요?</p>
                  <button
                    type="button"
                    onClick={handleGuestResendVerification}
                    disabled={guestResendLoading}
                    className="w-full py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {guestResendLoading ? '재전송 중...' : '인증 코드 다시 받기'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGuestStep('form');
                      setGuestVerificationCode('');
                      setGuestVerificationError('');
                      setGuestVerificationMessage('');
                      setGuestVerificationEmail('');
                    }}
                    className="w-full py-2 px-4 text-gray-700 dark:text-gray-300 font-medium hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    정보 수정하기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
