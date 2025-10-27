"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import { SettingsMenu } from '@/components/SettingsMenu';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Menu, X, Bell } from 'lucide-react';
import { getNavigationForRole, type Role } from '@/lib/permissions';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface NavItem {
  href: string;
  label: string;
  i18nKey?: string;
}

export function NavigationHeader() {
  const pathname = usePathname();
  const { t, ready } = useTranslation('common');
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const currentUser = useCurrentUser();

  // 읽지 않은 알림 개수 조회 (임시 mock 데이터)
  const mockNotifications = [
    { id: '1', message: '새로운 근무 스케줄이 배정되었습니다.', time: '5분 전', isRead: false },
    { id: '2', message: '김철수님의 휴가 신청이 승인되었습니다.', time: '1시간 전', isRead: false },
    { id: '3', message: '이번 주 근무 일정이 변경되었습니다.', time: '3시간 전', isRead: false },
  ];
  const unreadCount = mockNotifications.filter(n => !n.isRead).length;

  useEffect(() => {
    setMounted(true);
  }, []);

  // 페이지 변경 시 모바일 메뉴 닫기
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.notification-dropdown')) {
        setShowNotificationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get role-based navigation items
  const roleNavigation = getNavigationForRole(currentUser.role as Role);

  // Filter out dashboard from navigation (it's in the logo link)
  const navItems: NavItem[] = roleNavigation
    .filter(item => item.href !== '/dashboard')
    .map(item => ({
      href: item.href,
      label: item.label,
      i18nKey: `nav.${item.href.substring(1)}` // Convert /schedule to nav.schedule
    }));

  // 인증이 필요없는 페이지들
  const publicPages = ['/sign-in', '/sign-up', '/join'];
  const isPublicPage = publicPages.some(page => pathname?.startsWith(page));

  // i18n이 준비되지 않았거나 마운트되지 않았으면 로딩 상태 표시
  if (!mounted || !ready) {
    return (
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16" />
        </div>
      </header>
    );
  }

  if (isPublicPage) {
    return null; // 인증 페이지에서는 네비게이션 헤더를 표시하지 않음
  }

  return (
    <>
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 relative z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Left side: Logo and Desktop Navigation */}
            <div className="flex items-center gap-8">
              <Link
                href="/dashboard"
                className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                ShiftEasy
              </Link>

              {/* Desktop Navigation Items */}
              <nav className="hidden md:flex items-center gap-6">
                {navItems.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/' && pathname?.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`text-sm font-medium transition-colors ${
                        isActive
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      {item.i18nKey && ready ? t(item.i18nKey, { defaultValue: item.label }) : item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right side: Profile, Notification Bell, and Mobile Menu Button */}
            <div className="flex items-center gap-2 sm:gap-4">
              <ProfileDropdown />

              {/* Notification Dropdown */}
              <div className="relative notification-dropdown">
                <button
                  onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                  className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-yellow-500' : 'text-gray-600 dark:text-gray-400'}`} />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-5 h-5 bg-yellow-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Menu */}
                {showNotificationDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 z-50">
                    <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">알림</h3>
                    </div>

                    {/* Notification List */}
                    <div className="max-h-96 overflow-y-auto">
                      {mockNotifications.length > 0 ? (
                        mockNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className="p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                          >
                            <p className="text-sm text-gray-900 dark:text-gray-100">{notification.message}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{notification.time}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                          새로운 알림이 없습니다.
                        </div>
                      )}
                    </div>

                    {/* View All Button */}
                    <div className="p-2 border-t border-gray-100 dark:border-gray-700">
                      <Link
                        href="/notifications"
                        onClick={() => setShowNotificationDropdown(false)}
                        className="block w-full text-center px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors"
                      >
                        자세히 보기
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Settings Menu */}
              <SettingsMenu />

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={`fixed top-16 right-0 h-[calc(100vh-4rem)] w-64 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out z-40 md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <nav className="flex flex-col p-4 space-y-2">
          {/* Mobile Notification Link */}
          <Link
            href="/notifications"
            onClick={() => setMobileMenuOpen(false)}
            className={`px-4 py-3 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${
              pathname === '/notifications'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-yellow-500' : ''}`} />
            <span>알림</span>
            {unreadCount > 0 && (
              <span className="ml-auto w-6 h-6 bg-yellow-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          {/* Mobile Navigation Items */}
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                {item.i18nKey && ready ? t(item.i18nKey, { defaultValue: item.label }) : item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}