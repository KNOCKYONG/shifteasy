'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Mail, Key, User, Lock, Eye, EyeOff, ChevronRight, Check, AlertCircle, ChevronDown, Search } from 'lucide-react';

export default function JoinPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Email & Secret Code
  const [email, setEmail] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [tenantInfo, setTenantInfo] = useState<{
    id: string;
    name: string;
    slug: string;
  } | null>(null);

  // Step 2: User Information
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Array<{
    id: string;
    name: string;
    code?: string;
    description?: string;
  }>>([]);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [departmentSearch, setDepartmentSearch] = useState('');

  // 부서 목록 가져오기
  const fetchDepartments = async (tenantId: string) => {
    try {
      const response = await fetch(`/api/auth/departments?tenantId=${tenantId}`);
      const data = await response.json();
      if (data.departments) {
        setDepartments(data.departments);
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  };

  // 필터링된 부서 목록
  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(departmentSearch.toLowerCase()) ||
    (dept.code && dept.code.toLowerCase().includes(departmentSearch.toLowerCase()))
  );

  // Step 1: 시크릿 코드 검증
  const handleVerifyCode = async () => {
    if (!email || !secretCode) {
      setError('이메일과 시크릿 코드를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-secret-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, secretCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '시크릿 코드 검증에 실패했습니다.');
        return;
      }

      if (data.valid && data.tenant) {
        setTenantInfo(data.tenant);
        // 부서 목록 가져오기
        await fetchDepartments(data.tenant.id);
        setStep(2);
      } else {
        setError(data.error || '유효하지 않은 시크릿 코드입니다.');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: 사용자 정보 입력
  const handleSubmitUserInfo = async () => {
    if (!name) {
      setError('이름을 입력해주세요.');
      return;
    }

    // Clerk 기본 비밀번호 정책: 최소 8자, 문자와 숫자 포함
    if (!password || password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    // Clerk 기본 비밀번호 복잡도 검증: 문자와 숫자만 필수
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasLetter || !hasNumber) {
      setError('비밀번호는 영문자와 숫자를 포함해야 합니다.');
      return;
    }

    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (!departmentId) {
      setError('부서를 선택해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          secretCode,
          tenantId: tenantInfo?.id,
          name,
          password,
          departmentId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '가입에 실패했습니다.');
        return;
      }

      setStep(3);

      // 3초 후 로그인 페이지로 이동
      setTimeout(() => {
        router.push('/sign-in');
      }, 3000);
    } catch (err) {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
              step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > 1 ? <Check className="w-5 h-5" /> : '1'}
            </div>
            <div className={`w-16 h-1 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
              step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > 2 ? <Check className="w-5 h-5" /> : '2'}
            </div>
            <div className={`w-16 h-1 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
              step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > 3 ? <Check className="w-5 h-5" /> : '3'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">ShiftEasy 가입하기</h1>
            {step === 1 && <p className="text-gray-600 mt-2">조직 시크릿 코드를 입력하세요</p>}
            {step === 2 && <p className="text-gray-600 mt-2">사용자 정보를 입력하세요</p>}
            {step === 3 && <p className="text-gray-600 mt-2">가입이 완료되었습니다!</p>}
          </div>

          {/* Step 1: Email & Secret Code */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  이메일
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400 bg-white"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Key className="w-4 h-4 inline mr-1" />
                  시크릿 코드
                </label>
                <input
                  type="text"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX"
                  maxLength={9}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase text-gray-900 placeholder-gray-400 bg-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  관리자로부터 받은 8자리 코드를 입력하세요
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleVerifyCode}
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? '확인 중...' : '다음'}
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="text-center">
                <a href="/sign-in" className="text-sm text-blue-600 hover:text-blue-700">
                  이미 계정이 있으신가요? 로그인
                </a>
              </div>
            </div>
          )}

          {/* Step 2: User Information */}
          {step === 2 && tenantInfo && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <p className="font-medium text-blue-900">{tenantInfo.name}</p>
                </div>
                <p className="text-sm text-blue-700 mt-1">이 조직에 가입합니다</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  이름 *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400 bg-white"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Lock className="w-4 h-4 inline mr-1" />
                  비밀번호 *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8자 이상, 영문자와 숫자 포함"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400 bg-white pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">비밀번호 요구사항:</p>
                  <ul className="text-xs text-gray-500 ml-4 space-y-0.5">
                    <li className={password.length >= 8 ? 'text-green-600' : ''}>
                      • 최소 8자 이상
                    </li>
                    <li className={/[a-zA-Z]/.test(password) ? 'text-green-600' : ''}>
                      • 영문자 포함 (a-z, A-Z)
                    </li>
                    <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>
                      • 숫자 포함 (0-9)
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Lock className="w-4 h-4 inline mr-1" />
                  비밀번호 확인 *
                </label>
                <div className="relative">
                  <input
                    type={showPasswordConfirm ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="비밀번호 재입력"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400 bg-white pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPasswordConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  부서 선택 *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left flex items-center justify-between bg-white"
                  >
                    <span className={departmentId ? 'text-gray-900' : 'text-gray-400'}>
                      {departmentId
                        ? departments.find(d => d.id === departmentId)?.name || '부서 선택'
                        : '부서를 선택하세요'}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showDepartmentDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showDepartmentDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                      <div className="p-2 border-b border-gray-200">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={departmentSearch}
                            onChange={(e) => setDepartmentSearch(e.target.value)}
                            placeholder="부서 검색..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredDepartments.length > 0 ? (
                          filteredDepartments.map((dept) => (
                            <button
                              key={dept.id}
                              type="button"
                              onClick={() => {
                                setDepartmentId(dept.id);
                                setShowDepartmentDropdown(false);
                                setDepartmentSearch('');
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex flex-col"
                            >
                              <span className="text-gray-900">{dept.name}</span>
                              {dept.description && (
                                <span className="text-xs text-gray-500">{dept.description}</span>
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-sm text-gray-500">
                            검색 결과가 없습니다
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
                >
                  이전
                </button>
                <button
                  onClick={handleSubmitUserInfo}
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '가입 중...' : '가입하기'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">가입 완료!</h2>
              <p className="text-gray-600 mb-6">
                ShiftEasy에 성공적으로 가입되었습니다.<br />
                잠시 후 로그인 페이지로 이동합니다.
              </p>
              <button
                onClick={() => router.push('/sign-in')}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                로그인하러 가기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}