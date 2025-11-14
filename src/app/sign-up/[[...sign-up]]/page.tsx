'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  User,
  Users,
  Key,
  Building2,
  Calendar,
  FileText,
  Copy,
  CheckCircle2,
  X,
} from 'lucide-react';

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
  const [step, setStep] = useState<'code' | 'signup' | 'verify'>('code');
  const [planType, setPlanType] = useState<'standard' | 'professional'>('standard');
  const [tenantInfo, setTenantInfo] = useState<{ id?: string; name?: string; department?: { id?: string; name: string } } | null>(null);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestConfirmPassword, setGuestConfirmPassword] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestHospitalName, setGuestHospitalName] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const [showGuestPassword, setShowGuestPassword] = useState(false);
  const [showGuestConfirmPassword, setShowGuestConfirmPassword] = useState(false);
  const [guestError, setGuestError] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [yearsOfService, setYearsOfService] = useState(0);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalError, setHospitalError] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [departmentError, setDepartmentError] = useState('');
  const [provisionedSecretCode, setProvisionedSecretCode] = useState('');
  const [secretCopyMessage, setSecretCopyMessage] = useState('');
  const [autoSecretAttempted, setAutoSecretAttempted] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabaseClient();
  const isLoaded = !!supabase;
  const isProfessionalPlan = searchParams.get('plan') === 'professional';

  const resetGuestState = () => {
    setGuestEmail('');
    setGuestPassword('');
    setGuestConfirmPassword('');
    setGuestName('');
    setGuestHospitalName('');
    setGuestLoading(false);
    setGuestError('');
  };

  const closeGuestForm = () => {
    setShowGuestForm(false);
    resetGuestState();
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
        const storedDepartment = sessionStorage.getItem('billing_department_name');
        if (storedDepartment) {
          setDepartmentName(storedDepartment);
        }
      }
    } else {
      setPlanType('standard');
      setStep('code');
      setIsSecretCodeLocked(false);
      setDepartmentName('');
      setDepartmentError('');
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

      if (!departmentName.trim()) {
        setDepartmentError('부서명을 입력해주세요.');
        setLoading(false);
        return;
      }
      setDepartmentError('');
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            typeof window !== 'undefined'
              ? `${window.location.origin}/verify-email`
              : undefined,
          data: {
            name,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already registered')) {
          setError('이미 등록된 이메일입니다. 로그인해주세요.');
        } else if (
          signUpError.message.toLowerCase().includes('password should be at least')
        ) {
          setError('비밀번호는 최소 8자 이상이어야 합니다.');
        } else {
          setError(signUpError.message || '회원가입 중 오류가 발생했습니다.');
        }
        setLoading(false);
        return;
      }

      const createdUserId = data.user?.id;
      if (!createdUserId) {
        setError('사용자 정보를 생성할 수 없습니다. 다시 시도해주세요.');
        setLoading(false);
        return;
      }

      await finalizeAccountCreation(createdUserId);

      setVerificationEmail(email);
      setVerificationMessage(
        '입력하신 이메일로 인증 링크를 전송했습니다. 받은 메일에서 인증을 완료해주세요.'
      );
      setStep('verify');
    } catch (err: unknown) {
      console.error('Sign up error:', err);
      setError('회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 게스트 계정 생성
  const handleGuestSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGuestLoading(true);
    setGuestError('');

    const trimmedGuestEmail = guestEmail.trim();
    const trimmedGuestName = guestName.trim();
    const trimmedHospitalName = guestHospitalName.trim();

    if (!trimmedGuestEmail || !trimmedGuestName || !trimmedHospitalName) {
      setGuestError('병원명, 이름, 이메일을 모두 입력해주세요.');
      setGuestLoading(false);
      return;
    }

    // 비밀번호 확인 검증
    if (guestPassword !== guestConfirmPassword) {
      setGuestError('비밀번호가 일치하지 않습니다.');
      setGuestLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/guest-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedGuestEmail,
          password: guestPassword,
          name: trimmedGuestName,
          hospitalName: trimmedHospitalName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setGuestError(data.error || '게스트 계정 생성에 실패했습니다.');
        setGuestLoading(false);
        return;
      }

      closeGuestForm();
      router.push('/sign-in?message=guest-created');
    } catch (err: unknown) {
      console.error('Guest signup error:', err);
      setGuestError('게스트 계정을 생성하는 중 문제가 발생했습니다.');
    } finally {
      setGuestLoading(false);
    }
  };

  const finalizeAccountCreation = async (authUserId: string) => {
    let finalSecretCode = secretCode;
    let finalTenantId = tenantInfo?.id;
    let finalDepartmentId = tenantInfo?.department?.id;

    if (planType === 'professional') {
      const trimmedHospitalName = hospitalName.trim();
      const trimmedDepartmentName = departmentName.trim();
      if (!trimmedHospitalName) {
        throw new Error('병원명을 입력해주세요.');
      }
      if (!trimmedDepartmentName) {
        throw new Error('부서명을 입력해주세요.');
      }

      const provisionResponse = await fetch('/api/auth/provision-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalName: trimmedHospitalName,
          departmentName: trimmedDepartmentName,
        }),
      });

      const provisionData = await provisionResponse.json();

      if (!provisionResponse.ok) {
        throw new Error(provisionData?.error || '워크스페이스 생성에 실패했습니다.');
      }

      finalSecretCode = provisionData.secretCode;
      finalTenantId = provisionData.tenantId;
      if (!provisionData.departmentId) {
        throw new Error('부서를 생성할 수 없습니다.');
      }
      finalDepartmentId = provisionData.departmentId;
      setProvisionedSecretCode(provisionData.secretCode);
      setTenantInfo({
        id: provisionData.tenantId,
        name: trimmedHospitalName,
        department: { id: provisionData.departmentId, name: trimmedDepartmentName },
      });

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('billing_secret_code', provisionData.secretCode);
        sessionStorage.setItem('billing_hospital_name', trimmedHospitalName);
        sessionStorage.setItem('billing_department_name', trimmedDepartmentName);
      }
    }

    const signupPayload: Record<string, unknown> = {
      email,
      name,
      secretCode: finalSecretCode,
      tenantId: finalTenantId,
      hireDate: hireDate || undefined,
      yearsOfService,
      authUserId,
    };

    if (finalDepartmentId) {
      signupPayload.departmentId = finalDepartmentId;
    }

    if (planType === 'professional') {
      signupPayload.roleOverride = 'manager';
    }

    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signupPayload),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '회원가입에 실패했습니다.');
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
                  {planType !== 'professional' && tenantInfo?.name && (
                    <p>
                      <Building2 className="w-4 h-4 inline mr-1" />
                      {tenantInfo.name}
                    </p>
                  )}
                  {tenantInfo?.department && (
                    <p className="pl-5 text-blue-600 dark:text-blue-400">
                      부서: {tenantInfo.department.name}
                    </p>
                  )}
                </div>
              </div>

              <form onSubmit={handleSignUpSubmit} className="space-y-4">
                {planType === 'professional' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Building2 className="w-4 h-4 inline mr-1" />
                        병원명
                      </label>
                      <input
                        type="text"
                        value={hospitalName}
                        onChange={(e) => setHospitalName(e.target.value)}
                        placeholder="예: 서울아산병원"
                        required
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800"
                      />
                      {hospitalError && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-2">{hospitalError}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Users className="w-4 h-4 inline mr-1" />
                        부서명
                      </label>
                      <input
                        type="text"
                        value={departmentName}
                        onChange={(e) => setDepartmentName(e.target.value)}
                        placeholder="예: 중환자실"
                        required
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800"
                      />
                      {departmentError && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-2">{departmentError}</p>
                      )}
                    </div>
                  </>
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
                    value={yearsOfService === 0 ? '' : yearsOfService}
                    onChange={(e) => setYearsOfService(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800"
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
                        회원가입 버튼을 누르면 입력하신 이메일로 인증 링크가 전송됩니다.
                        링크를 눌러 인증을 완료한 뒤 다시 로그인해주세요.
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

                {!isProfessionalPlan && (
                  <button
                    type="button"
                    onClick={() => setStep('code')}
                    className="w-full py-2 px-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
                  >
                    ← 시크릿 코드 다시 입력
                  </button>
                )}
              </form>
            </>
          ) : step === 'verify' ? (
            <>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">이메일 인증 안내</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                입력하신 이메일({verificationEmail || email})로 인증 링크를 전송했습니다.
                메일을 확인하고 인증을 완료하신 뒤 로그인해 주세요.
              </p>
              <div className="space-y-4">
                {verificationMessage && (
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                    <p className="text-sm text-green-600 dark:text-green-400">{verificationMessage}</p>
                  </div>
                )}
                {provisionedSecretCode && (
                  <div className="space-y-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/70 p-4 dark:border-blue-700 dark:bg-blue-900/20">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                      새 워크스페이스 시크릿 코드
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-lg bg-white px-3 py-2 text-center text-lg font-semibold tracking-widest text-blue-700 dark:bg-gray-950 dark:text-blue-300">
                        {provisionedSecretCode}
                      </code>
                      <button
                        type="button"
                        onClick={handleSecretCodeCopy}
                        className="rounded-lg border border-blue-200 bg-white/80 p-2 text-blue-600 transition hover:bg-blue-600 hover:text-white dark:border-blue-700 dark:bg-gray-950"
                      >
                        <Copy className="h-4 w-4" />
                        <span className="sr-only">시크릿 코드 복사</span>
                      </button>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      이 코드를 팀과 공유하면 새 워크스페이스에 동료를 초대할 수 있습니다.
                    </p>
                    {secretCopyMessage && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">{secretCopyMessage}</p>
                    )}
                  </div>
                )}
                <button
                  onClick={() => router.push('/sign-in')}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  로그인 페이지로 이동
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {showGuestForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">게스트 체험 계정 만들기</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  시크릿 코드 없이도 임시 워크스페이스를 생성해 제품을 체험할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={closeGuestForm}
                className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800"
                aria-label="체험 계정 닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGuestSignup} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  병원명
                </label>
                <input
                  type="text"
                  value={guestHospitalName}
                  onChange={(e) => setGuestHospitalName(e.target.value)}
                  placeholder="예: 서울아산병원"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 shadow-sm focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

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
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 shadow-sm focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
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
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 shadow-sm focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
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
                    placeholder="8자 이상, 영문+숫자+특수문자"
                    required
                    minLength={8}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 text-gray-900 shadow-sm focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGuestPassword(!showGuestPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showGuestPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
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
                    placeholder="비밀번호 다시 입력"
                    required
                    minLength={8}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 text-gray-900 shadow-sm focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGuestConfirmPassword(!showGuestConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showGuestConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {guestConfirmPassword && guestPassword !== guestConfirmPassword && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">비밀번호가 일치하지 않습니다</p>
                )}
              </div>

              {guestError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <p className="text-sm text-red-600 dark:text-red-400">{guestError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeGuestForm}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={guestLoading}
                  className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {guestLoading ? '계정 생성 중...' : '게스트 계정 만들기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
