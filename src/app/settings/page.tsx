"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { UserProfile } from "@clerk/nextjs";
import { User, Shield, Bell, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";

export default function SettingsPage() {
  const { t } = useTranslation(['settings', 'common']);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "notifications">("profile");

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'security') {
      setActiveTab('security');
    } else if (tab === 'notifications') {
      setActiveTab('notifications');
    } else {
      setActiveTab('profile');
    }
  }, [searchParams]);

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

                {/* Clerk UserProfile Component */}
                <div className="clerk-profile-container">
                  <UserProfile
                    appearance={{
                      elements: {
                        rootBox: "w-full",
                        card: "shadow-none border-0",
                      },
                    }}
                  />
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

                {/* Clerk UserProfile with Security Page */}
                <div className="clerk-profile-container">
                  <UserProfile
                    appearance={{
                      elements: {
                        rootBox: "w-full",
                        card: "shadow-none border-0",
                      },
                    }}
                  >
                    <UserProfile.Page label="security" />
                  </UserProfile>
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
                      <input type="checkbox" defaultChecked className="sr-only peer" />
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
                      <input type="checkbox" defaultChecked className="sr-only peer" />
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
                      <input type="checkbox" defaultChecked className="sr-only peer" />
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
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </MainLayout>
    </RoleGuard>
  );
}
