'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import {
  User, Shield, Key, Users, Building2, LogOut,
  RefreshCw, Save, ChevronDown, AlertCircle, Check,
  Edit2, Trash2, UserPlus
} from 'lucide-react';
import { ProfileDropdown } from '@/components/ProfileDropdown';

type UserRole = 'admin' | 'manager' | 'member';

interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string;
  department?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
}

interface TenantInfo {
  id: string;
  name: string;
  secretCode: string;
  userCount: number;
  departmentCount: number;
}

export default function SettingsPage() {
  const { userId } = useAuth();
  const { signOut, user } = useClerk();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'team' | 'tenant'>('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // User data
  const [currentUser, setCurrentUser] = useState<TenantUser | null>(null);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);

  // Form states
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    department: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPasswordFields, setShowPasswordFields] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUserData = async () => {
    if (!userId) return;

    try {
      // Fetch current user info
      const userResponse = await fetch('/api/users/me');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setCurrentUser(userData);
        setProfileData({
          name: userData.name,
          email: userData.email,
          department: userData.department || '',
        });
      }

      // Fetch tenant info (for admin)
      const tenantResponse = await fetch('/api/tenant/info');
      if (tenantResponse.ok) {
        const tenant = await tenantResponse.json();
        setTenantInfo(tenant);
      }

      // Fetch all users (for admin)
      const usersResponse = await fetch('/api/users/list');
      if (usersResponse.ok) {
        const data = await usersResponse.json();
        setTenantUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  };

  const handleProfileUpdate = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: '프로필이 업데이트되었습니다.' });
        fetchUserData();
      } else {
        setMessage({ type: 'error', text: '프로필 업데이트에 실패했습니다.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: '새 비밀번호가 일치하지 않습니다.' });
      return;
    }

    if (passwordData.newPassword.length < 12) {
      setMessage({ type: 'error', text: '비밀번호는 최소 12자 이상이어야 합니다.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: '비밀번호가 변경되었습니다.' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setMessage({ type: 'error', text: '비밀번호 변경에 실패했습니다.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateSecretCode = async () => {
    if (!confirm('정말 시크릿 코드를 재생성하시겠습니까? 기존 코드는 더 이상 사용할 수 없습니다.')) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/tenant/regenerate-secret', {
        method: 'POST',
      });

      if (response.ok) {
        const { secretCode } = await response.json();
        setMessage({ type: 'success', text: `새 시크릿 코드: ${secretCode}` });
        fetchUserData();
      } else {
        setMessage({ type: 'error', text: '시크릿 코드 재생성에 실패했습니다.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: '역할이 변경되었습니다.' });
        fetchUserData();
      } else {
        setMessage({ type: 'error', text: '역할 변경에 실패했습니다.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('정말 이 사용자를 삭제하시겠습니까?')) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage({ type: 'success', text: '사용자가 삭제되었습니다.' });
        fetchUserData();
      } else {
        setMessage({ type: 'error', text: '사용자 삭제에 실패했습니다.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/sign-in');
  };

  const roleLabels: Record<UserRole, string> = {
    admin: '관리자',
    manager: '매니저',
    member: '멤버',
  };

  const roleColors: Record<UserRole, string> = {
    admin: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700',
    member: 'bg-gray-100 text-gray-700',
  };

  const tabConfig = {
    profile: { label: '프로필', icon: User },
    security: { label: '보안', icon: Key },
    team: { label: '팀 관리', icon: Users },
    tenant: { label: '조직 설정', icon: Building2 },
  };

  const getAvailableTabs = () => {
    const baseTabs = ['profile', 'security'];
    if (currentUser?.role === 'admin') {
      return [...baseTabs, 'team', 'tenant'];
    }
    return baseTabs;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <a href="/dashboard" className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                ShiftEasy
              </a>
              <nav className="flex items-center gap-6">
                <a href="/schedule" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                  스케줄
                </a>
                <a href="/team" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                  팀 관리
                </a>
                <a href="/config" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                  설정
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <ProfileDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">계정 설정</h2>
          <p className="text-gray-600 mt-1">프로필과 보안 설정을 관리하세요</p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <Check className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            )}
            <p className={`text-sm ${
              message.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}>
              {message.text}
            </p>
          </div>
        )}

        {/* Dropdown and Content */}
        <div className="max-w-4xl mx-auto">
          {/* Dropdown Menu */}
          <div className="mb-6 relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {(() => {
                const CurrentIcon = tabConfig[activeTab].icon;
                return (
                  <>
                    <CurrentIcon className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">{tabConfig[activeTab].label}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-500 ml-auto transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                  </>
                );
              })()}
            </button>

            {/* Dropdown Options */}
            {showDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <div className="py-1">
                  <button
                    onClick={() => {
                      setActiveTab('profile');
                      setShowDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                      activeTab === 'profile' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    프로필
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('security');
                      setShowDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                      activeTab === 'security' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <Key className="w-4 h-4" />
                    보안
                  </button>
                  {currentUser?.role === 'admin' && (
                    <>
                      <div className="border-t border-gray-100 my-1"></div>
                      <button
                        onClick={() => {
                          setActiveTab('team');
                          setShowDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                          activeTab === 'team' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        팀 관리
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab('tenant');
                          setShowDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                          activeTab === 'tenant' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <Building2 className="w-4 h-4" />
                        조직 설정
                      </button>
                    </>
                  )}
                </div>

                {/* Current Role Badge in Dropdown */}
                <div className="border-t border-gray-100 p-3 bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1.5">현재 역할</p>
                  <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                    roleColors[currentUser?.role || 'member']
                  }`}>
                    <Shield className="w-3.5 h-3.5 mr-1" />
                    {roleLabels[currentUser?.role || 'member']}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div>
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">프로필 정보</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이름
                    </label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이메일
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">이메일은 변경할 수 없습니다</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      부서
                    </label>
                    <input
                      type="text"
                      value={profileData.department}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    />
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={handleProfileUpdate}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      저장
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">보안 설정</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      현재 비밀번호
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswordFields.current ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordFields({ ...showPasswordFields, current: !showPasswordFields.current })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPasswordFields.current ? '숨기기' : '보기'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      새 비밀번호
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswordFields.new ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        placeholder="12자 이상, 대소문자/숫자/특수문자 모두 포함"
                        className="w-full px-3 py-2 text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordFields({ ...showPasswordFields, new: !showPasswordFields.new })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPasswordFields.new ? '숨기기' : '보기'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      새 비밀번호 확인
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswordFields.confirm ? 'text' : 'password'}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordFields({ ...showPasswordFields, confirm: !showPasswordFields.confirm })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPasswordFields.confirm ? '숨기기' : '보기'}
                      </button>
                    </div>
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={handlePasswordChange}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Key className="w-4 h-4" />
                      비밀번호 변경
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Team Management Tab (Admin Only) */}
            {activeTab === 'team' && currentUser?.role === 'admin' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">팀 관리</h3>
                  <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <UserPlus className="w-4 h-4" />
                    사용자 초대
                  </button>
                </div>
                <div className="space-y-4">
                  {tenantUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        <p className="text-xs text-gray-400 mt-1">{user.department}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                          disabled={user.id === currentUser?.id}
                          className="px-3 py-1 text-sm text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                        >
                          <option value="member">멤버</option>
                          <option value="manager">매니저</option>
                          <option value="admin">관리자</option>
                        </select>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={user.id === currentUser?.id}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tenant Settings Tab (Admin Only) */}
            {activeTab === 'tenant' && currentUser?.role === 'admin' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">조직 설정</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      조직명
                    </label>
                    <p className="text-lg font-medium text-gray-900">{tenantInfo?.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      시크릿 코드
                    </label>
                    <div className="flex items-center gap-3">
                      <code className="px-3 py-2 bg-gray-100 text-gray-900 rounded-lg font-mono">
                        {tenantInfo?.secretCode}
                      </code>
                      <button
                        onClick={handleRegenerateSecretCode}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className="w-4 h-4" />
                        재생성
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      새 멤버가 가입할 때 필요한 코드입니다. 재생성하면 기존 코드는 사용할 수 없습니다.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">총 사용자 수</p>
                      <p className="text-2xl font-semibold text-gray-900">{tenantInfo?.userCount || 0}명</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">부서 수</p>
                      <p className="text-2xl font-semibold text-gray-900">{tenantInfo?.departmentCount || 0}개</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}