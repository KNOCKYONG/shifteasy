"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { User, Shield, Bell, Key, Copy, Save, Loader2, AlertCircle, CheckCircle2, Camera } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic';

interface Department {
  id: string;
  name: string;
  code?: string;
  secretCode?: string;
}

interface CurrentUser {
  role: string;
  departmentId?: string;
  department?: string;
}

function SettingsContent() {
  const { t } = useTranslation(['settings', 'common']);
  const searchParams = useSearchParams();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "notifications" | "department">("profile");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Department secret code state (admin/owner only)
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    scheduleChanges: true,
    swapRequests: true,
    announcements: true,
    emailDigest: false,
  });

  // Profile edit states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Profile image upload
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'security') {
      setActiveTab('security');
    } else if (tab === 'notifications') {
      setActiveTab('notifications');
    } else if (tab === 'department') {
      setActiveTab('department');
    } else {
      setActiveTab('profile');
    }
  }, [searchParams]);

  // Initialize profile fields when user data loads
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.primaryEmailAddress?.emailAddress || '');
    }
  }, [user]);

  useEffect(() => {
    // Fetch current user data
    fetch('/api/users/me')
      .then(res => res.json())
      .then(data => {
        setCurrentUser(data);
      })
      .catch(err => console.error('Error fetching user:', err));
  }, []);

  useEffect(() => {
    if (activeTab === 'department' && currentUser && (currentUser.role === 'admin' || currentUser.role === 'owner')) {
      // Admin/Owner: fetch all department secrets
      fetch('/api/departments/all-secrets')
        .then(res => res.json())
        .then(data => {
          if (data.departments) {
            setAllDepartments(data.departments);
          }
        })
        .catch(err => console.error('Error fetching all department secrets:', err));
    }
  }, [activeTab, currentUser]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleNotificationChange = (key: keyof typeof notificationSettings) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Profile update handler
  const handleProfileUpdate = async () => {
    if (!user) return;

    setProfileLoading(true);
    setProfileMessage(null);

    try {
      // Update name
      await user.update({
        firstName,
        lastName,
      });

      setProfileMessage({ type: 'success', text: '프로필이 성공적으로 업데이트되었습니다.' });
      setIsEditingProfile(false);

      // Reload user data
      await user.reload();
    } catch (error: any) {
      console.error('Profile update error:', error);
      setProfileMessage({
        type: 'error',
        text: error.errors?.[0]?.message || '프로필 업데이트에 실패했습니다.'
      });
    } finally {
      setProfileLoading(false);
    }
  };

  // Profile image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setUploadingImage(true);
    setProfileMessage(null);

    try {
      await user.setProfileImage({ file });
      setProfileMessage({ type: 'success', text: '프로필 이미지가 업데이트되었습니다.' });
      await user.reload();
    } catch (error: any) {
      console.error('Image upload error:', error);
      setProfileMessage({
        type: 'error',
        text: error.errors?.[0]?.message || '이미지 업로드에 실패했습니다.'
      });
    } finally {
      setUploadingImage(false);
    }
  };

  // Password change handler
  const handlePasswordChange = async () => {
    setPasswordLoading(true);
    setPasswordMessage(null);

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: 'error', text: '모든 필드를 입력해주세요.' });
      setPasswordLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: '새 비밀번호가 일치하지 않습니다.' });
      setPasswordLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: '비밀번호는 최소 8자 이상이어야 합니다.' });
      setPasswordLoading(false);
      return;
    }

    try {
      // Use API endpoint to change password
      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '비밀번호 변경에 실패했습니다.');
      }

      setPasswordMessage({ type: 'success', text: '비밀번호가 성공적으로 변경되었습니다.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Password change error:', error);
      setPasswordMessage({
        type: 'error',
        text: error.message || '비밀번호 변경에 실패했습니다.'
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Show department tab only for admins and owners (managers use /config page)
  const showDepartmentTab = currentUser && (currentUser.role === 'admin' || currentUser.role === 'owner');

  return (
    <RoleGuard>
      <MainLayout>
        <div className="max-w-6xl mx-auto">
          {/* Page Title */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <User className="w-7 h-7 text-gray-400 dark:text-gray-500" />
              {t('title', { ns: 'settings', defaultValue: '개인 설정' })}
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {t('subtitle', { ns: 'settings', defaultValue: '프로필과 계정 정보를 관리하세요' })}
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex gap-8">
              <button
                onClick={() => setActiveTab("profile")}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === "profile"
                    ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                    : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <User className="w-4 h-4" />
                {t('tabs.profile', { ns: 'settings', defaultValue: '프로필' })}
              </button>
              <button
                onClick={() => setActiveTab("security")}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === "security"
                    ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                    : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <Shield className="w-4 h-4" />
                {t('tabs.security', { ns: 'settings', defaultValue: '보안' })}
              </button>
              <button
                onClick={() => setActiveTab("notifications")}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === "notifications"
                    ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                    : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <Bell className="w-4 h-4" />
                {t('tabs.notifications', { ns: 'settings', defaultValue: '알림' })}
              </button>
              {showDepartmentTab && (
                <button
                  onClick={() => setActiveTab("department")}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === "department"
                      ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                      : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  <Key className="w-4 h-4" />
                  {t('tabs.department', { ns: 'settings', defaultValue: '부서 코드' })}
                </button>
              )}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            {activeTab === "profile" && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {t('profile.title', { ns: 'settings', defaultValue: '프로필 정보' })}
                  </h3>
                  {!isEditingProfile && (
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="px-4 py-2 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                    >
                      편집
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {t('profile.description', { ns: 'settings', defaultValue: '이름, 프로필 사진 등을 관리할 수 있습니다.' })}
                </p>

                {/* Message */}
                {profileMessage && (
                  <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                    profileMessage.type === 'success'
                      ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                      : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                  }`}>
                    {profileMessage.type === 'success' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                    <span className="text-sm">{profileMessage.text}</span>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Profile Picture */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        {user?.imageUrl ? (
                          <img src={user.imageUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User className="w-10 h-10 text-gray-400 dark:text-gray-600" />
                        )}
                        {uploadingImage && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                          </div>
                        )}
                      </div>
                      {isEditingProfile && (
                        <label className="absolute bottom-0 right-0 p-1.5 bg-blue-600 dark:bg-blue-500 text-white rounded-full cursor-pointer hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors">
                          <Camera className="w-4 h-4" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={uploadingImage}
                          />
                        </label>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.primaryEmailAddress?.emailAddress}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{currentUser?.department || 'No Department'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Role: {currentUser?.role || 'member'}</p>
                    </div>
                  </div>

                  {/* Email (Read-only) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('profile.email', { ns: 'settings', defaultValue: '이메일' })}
                    </label>
                    <input
                      type="email"
                      value={user?.primaryEmailAddress?.emailAddress || ''}
                      disabled
                      className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      이메일은 변경할 수 없습니다.
                    </p>
                  </div>

                  {/* First Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('profile.firstName', { ns: 'settings', defaultValue: '이름 (First Name)' })}
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={!isEditingProfile}
                      className={`w-full px-4 py-2 border rounded-lg transition-colors ${
                        isEditingProfile
                          ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('profile.lastName', { ns: 'settings', defaultValue: '성 (Last Name)' })}
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={!isEditingProfile}
                      className={`w-full px-4 py-2 border rounded-lg transition-colors ${
                        isEditingProfile
                          ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}
                    />
                  </div>

                  {/* Action Buttons */}
                  {isEditingProfile && (
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleProfileUpdate}
                        disabled={profileLoading}
                        className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {profileLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            저장 중...
                          </>
                        ) : (
                          <>
                            <Save className="w-5 h-5" />
                            저장
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingProfile(false);
                          setFirstName(user?.firstName || '');
                          setLastName(user?.lastName || '');
                          setProfileMessage(null);
                        }}
                        disabled={profileLoading}
                        className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  {t('security.title', { ns: 'settings', defaultValue: '보안 설정' })}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {t('security.description', { ns: 'settings', defaultValue: '비밀번호와 보안 옵션을 관리하세요.' })}
                </p>

                {/* Message */}
                {passwordMessage && (
                  <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                    passwordMessage.type === 'success'
                      ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                      : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                  }`}>
                    {passwordMessage.type === 'success' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                    <span className="text-sm">{passwordMessage.text}</span>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Password Change Form */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">비밀번호 변경</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          현재 비밀번호
                        </label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="현재 비밀번호를 입력하세요"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          새 비밀번호
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="새 비밀번호 (최소 8자)"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          새 비밀번호 확인
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="새 비밀번호를 다시 입력하세요"
                        />
                      </div>
                      <button
                        onClick={handlePasswordChange}
                        disabled={passwordLoading}
                        className="w-full px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {passwordLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            변경 중...
                          </>
                        ) : (
                          <>
                            <Shield className="w-5 h-5" />
                            비밀번호 변경
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Additional Security Info */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-900 dark:text-blue-300">
                      💡 2단계 인증 등 추가 보안 기능은 Clerk 계정 관리 페이지에서 설정할 수 있습니다.
                    </p>
                    <a
                      href={`https://accounts.clerk.com/sign-in`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
                    >
                      Clerk 계정 관리
                    </a>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  {t('notifications.title', { ns: 'settings', defaultValue: '알림 설정' })}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {t('notifications.description', { ns: 'settings', defaultValue: '받고 싶은 알림을 선택하세요.' })}
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {t('notifications.scheduleChanges', { ns: 'settings', defaultValue: '스케줄 변경 알림' })}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t('notifications.scheduleChangesDesc', { ns: 'settings', defaultValue: '근무 스케줄이 변경될 때 알림을 받습니다' })}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.scheduleChanges}
                        onChange={() => handleNotificationChange('scheduleChanges')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {t('notifications.swapRequests', { ns: 'settings', defaultValue: '근무 교환 요청' })}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t('notifications.swapRequestsDesc', { ns: 'settings', defaultValue: '근무 교환 요청이 있을 때 알림을 받습니다' })}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.swapRequests}
                        onChange={() => handleNotificationChange('swapRequests')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {t('notifications.announcements', { ns: 'settings', defaultValue: '공지사항' })}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t('notifications.announcementsDesc', { ns: 'settings', defaultValue: '중요한 공지사항을 받습니다' })}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.announcements}
                        onChange={() => handleNotificationChange('announcements')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {t('notifications.emailDigest', { ns: 'settings', defaultValue: '이메일 요약' })}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t('notifications.emailDigestDesc', { ns: 'settings', defaultValue: '주간 활동 요약을 이메일로 받습니다' })}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.emailDigest}
                        onChange={() => handleNotificationChange('emailDigest')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "department" && showDepartmentTab && (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  {t('department.title', { ns: 'settings', defaultValue: '부서 시크릿 코드' })}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {t('department.adminDescription', { ns: 'settings', defaultValue: '모든 부서의 시크릿 코드를 확인할 수 있습니다.' })}
                </p>

                {/* Admin/Owner View: All Departments */}
                <div className="space-y-4">
                  {allDepartments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      {t('department.noDepartments', { ns: 'settings', defaultValue: '등록된 부서가 없습니다.' })}
                    </div>
                  ) : (
                    allDepartments.map((dept) => (
                      <div key={dept.id} className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">{dept.name}</h4>
                            {dept.code && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">코드: {dept.code}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="px-3 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded font-mono text-sm text-gray-900 dark:text-gray-100">
                              {dept.secretCode || 'No code'}
                            </div>
                            {dept.secretCode && (
                              <button
                                onClick={() => handleCopyCode(dept.secretCode!)}
                                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                title="Copy code"
                              >
                                <Copy className={`w-4 h-4 ${copiedCode === dept.secretCode ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </MainLayout>
    </RoleGuard>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
