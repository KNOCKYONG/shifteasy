'use client';

import { useState, useEffect } from 'react';
import { Key, RefreshCw, Copy, Users, Settings, Shield, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';

export default function TenantManagementPage() {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tenantData, setTenantData] = useState<{
    id: string;
    name: string;
    secretCode: string;
    signupEnabled: boolean;
    userCount: number;
    plan: string;
  } | null>(null);

  // 테넌트 정보 로드
  useEffect(() => {
    fetchTenantInfo();
  }, []);

  const fetchTenantInfo = async () => {
    try {
      const response = await fetch('/api/admin/tenant');
      if (response.ok) {
        const data = await response.json();
        setTenantData(data);
      }
    } catch (error) {
      console.error('Failed to fetch tenant info:', error);
    }
  };

  // 시크릿 코드 재생성
  const handleRegenerateCode = async () => {
    if (!confirm('시크릿 코드를 재생성하시겠습니까? 기존 코드는 더 이상 사용할 수 없습니다.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/tenant/regenerate-code', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setTenantData(prev => prev ? { ...prev, secretCode: data.secretCode } : null);
        alert('시크릿 코드가 재생성되었습니다.');
      }
    } catch (error) {
      alert('시크릿 코드 재생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 시크릿 코드 복사
  const handleCopyCode = () => {
    if (tenantData?.secretCode) {
      navigator.clipboard.writeText(tenantData.secretCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 가입 활성화/비활성화 토글
  const handleToggleSignup = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tenant/toggle-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: !tenantData?.signupEnabled,
        }),
      });

      if (response.ok) {
        setTenantData(prev => prev ? {
          ...prev,
          signupEnabled: !prev.signupEnabled
        } : null);
      }
    } catch (error) {
      alert('설정 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!tenantData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-semibold text-gray-900">ShiftEasy Admin</h1>
              <nav className="flex items-center gap-6">
                <a href="/admin/tenant" className="text-sm font-medium text-blue-600">
                  테넌트 관리
                </a>
                <a href="/admin/users" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                  사용자 관리
                </a>
                <a href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                  대시보드로 돌아가기
                </a>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">테넌트 관리</h2>
          <p className="text-gray-600 mt-1">조직의 시크릿 코드와 가입 설정을 관리합니다</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Secret Code Management */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">시크릿 코드</h3>
              </div>
              <button
                onClick={handleRegenerateCode}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                재생성
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">현재 시크릿 코드</p>
                <div className="flex items-center justify-between">
                  <code className="text-2xl font-mono font-bold text-gray-900">
                    {tenantData.secretCode}
                  </code>
                  <button
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 bg-gray-100 rounded-lg transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        복사됨
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        복사
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-800 font-medium">주의사항</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      시크릿 코드를 재생성하면 기존 코드로는 더 이상 가입할 수 없습니다.
                      새로운 멤버에게는 반드시 새 코드를 전달해주세요.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <p>이 코드를 새로운 팀원에게 전달하여 가입할 수 있도록 하세요.</p>
                <p className="mt-1">가입 URL: <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {typeof window !== 'undefined' ? `${window.location.origin}/join` : '/join'}
                </code></p>
              </div>
            </div>
          </div>

          {/* Signup Settings */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">가입 설정</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">신규 가입 허용</p>
                  <p className="text-sm text-gray-500 mt-1">
                    시크릿 코드를 통한 신규 가입을 허용합니다
                  </p>
                </div>
                <button
                  onClick={handleToggleSignup}
                  disabled={loading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    tenantData.signupEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  } disabled:opacity-50`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      tenantData.signupEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Users className="w-4 h-4" />
                    <p className="text-sm">총 사용자</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {tenantData.userCount || 0}명
                  </p>
                </div>

                <div className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Shield className="w-4 h-4" />
                    <p className="text-sm">플랜</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 capitalize">
                    {tenantData.plan}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Organization Info */}
        <div className="mt-6 bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">조직 정보</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">조직명</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{tenantData.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">조직 ID</dt>
              <dd className="mt-1 text-sm font-mono text-gray-900">{tenantData.id}</dd>
            </div>
          </dl>
        </div>
      </main>
    </div>
  );
}