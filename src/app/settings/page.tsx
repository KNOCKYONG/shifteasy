"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { User, Shield, Bell, Key, Copy } from "lucide-react";
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  {t('profile.title', { ns: 'settings', defaultValue: '프로필 정보' })}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {t('profile.description', { ns: 'settings', defaultValue: '이름, 이메일, 프로필 사진 등을 관리할 수 있습니다.' })}
                </p>

                <div className="space-y-6">
                  {/* Profile Picture */}
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      {user?.imageUrl ? (
                        <img src={user.imageUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="w-10 h-10 text-gray-400 dark:text-gray-600" />
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

                  {/* Email */}
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
                      {t('profile.emailNote', { ns: 'settings', defaultValue: '이메일은 Clerk 계정 설정에서 변경할 수 있습니다.' })}
                    </p>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('profile.name', { ns: 'settings', defaultValue: '이름' })}
                    </label>
                    <input
                      type="text"
                      value={user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : ''}
                      disabled
                      className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('profile.nameNote', { ns: 'settings', defaultValue: '이름은 Clerk 계정 설정에서 변경할 수 있습니다.' })}
                    </p>
                  </div>
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

                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-900 dark:text-blue-300">
                      {t('security.clerkNote', { ns: 'settings', defaultValue: '비밀번호 변경, 2단계 인증 설정 등은 Clerk 계정 관리 페이지에서 가능합니다.' })}
                    </p>
                    <a
                      href={`https://accounts.clerk.com/sign-in`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
                    >
                      {t('security.goToClerk', { ns: 'settings', defaultValue: 'Clerk 계정 관리' })}
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
