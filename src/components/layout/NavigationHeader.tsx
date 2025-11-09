"use client";

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import { SettingsMenu } from '@/components/SettingsMenu';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Menu, X, Bell, ChevronDown } from 'lucide-react';
import { getNavigationForRole, type Role } from '@/lib/permissions';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUser } from '@clerk/nextjs';

interface NavItem {
  href: string;
  label: string;
  i18nKey?: string;
}

interface SubMenuItem {
  label: string;
  value?: string;
  href?: string;
}

interface Notification {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  createdAt: Date;
  readAt?: Date | null;
  actionUrl?: string | null;
}

export function NavigationHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, ready } = useTranslation('common');
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);
  const currentUser = useCurrentUser();
  const { user: clerkUser } = useUser();
  const [userInfo, setUserInfo] = useState<{ id: string; tenantId: string } | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const teamSubMenuItems: SubMenuItem[] = [
    { label: '부서 패턴', value: 'pattern' },
    { label: '부서원 관리', value: 'management' },
    { label: '팀 배정', value: 'assignment' },
  ];

  const scheduleSubMenuItems = [
    { label: '스케줄 관리', href: '/schedule' },
    { label: '설정', href: '/config' },
  ];

  const isManagerOrAdmin = currentUser.role === 'manager' || currentUser.role === 'admin';

  // Fetch user info
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!clerkUser) return;

      try {
        const response = await fetch('/api/users/me');
        if (response.ok) {
          const data = await response.json();
          setUserInfo({ id: data.id, tenantId: data.tenantId });
        }
      } catch (err) {
        console.error('Failed to fetch user info:', err);
      }
    };

    fetchUserInfo();
  }, [clerkUser]);

  // Function to mark notification as read
  const markNotificationAsRead = async (notificationId: string) => {
    if (!userInfo) return;

    try {
      console.log('[NavigationHeader] Marking notification as read:', notificationId);

      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': userInfo.tenantId,
          'x-user-id': userInfo.id,
        },
        body: JSON.stringify({ notificationId }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      const data = await response.json();
      console.log('[NavigationHeader] Notification marked as read:', data);
    } catch (err) {
      console.error('[NavigationHeader] Failed to mark notification as read:', err);
    }
  };

  // Fetch notifications from API
  useEffect(() => {
    if (!userInfo) return;

    const loadNotifications = async () => {
      try {
        const response = await fetch('/api/notifications', {
          headers: {
            'x-tenant-id': userInfo.tenantId,
            'x-user-id': userInfo.id,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const recentNotifications = data.inbox?.notifications.slice(0, 5) || [];
          setNotifications(recentNotifications);
          setUnreadCount(data.inbox?.unreadCount || 0);
        }
      } catch (err) {
        console.error('[NavigationHeader] Failed to load notifications:', err);
      }
    };

    // Initial load
    loadNotifications();

    // Setup SSE for real-time notifications
    console.log('[NavigationHeader] Setting up SSE connection for userId:', userInfo.id);
    const eventSource = new EventSource(`/api/sse?userId=${userInfo.id}`);

    eventSource.addEventListener('connected', (event) => {
      console.log('[NavigationHeader] SSE connected:', event.data);
    });

    eventSource.addEventListener('notification', (event) => {
      console.log('[NavigationHeader] Received notification via SSE:', event.data);
      // Reload notifications when new notification arrives
      loadNotifications();
    });

    eventSource.addEventListener('notification_read', (event) => {
      console.log('[NavigationHeader] Notification marked as read via SSE:', event.data);
      // Reload notifications when notification is read
      loadNotifications();
    });

    eventSource.onerror = (error) => {
      console.error('[NavigationHeader] SSE connection error:', error);
    };

    return () => {
      console.log('[NavigationHeader] Closing SSE connection');
      eventSource.close();
    };
  }, [userInfo]);

  // Format time ago helper
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

    if (diffInSeconds < 60) return '방금 전';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}일 전`;
    return new Date(date).toLocaleDateString('ko-KR');
  };

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
      if (!target.closest('.team-dropdown')) {
        setShowTeamDropdown(false);
      }
      if (!target.closest('.schedule-dropdown')) {
        setShowScheduleDropdown(false);
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

  // 인증이 필요없는 페이지들 (네비게이션 헤더를 숨김)
  const publicPages = ['/sign-in', '/sign-up', '/join', '/'];
  const isPublicPage = publicPages.some(page => pathname === page || (page !== '/' && pathname?.startsWith(page)));

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

                  // '스케줄' 항목 - manager/admin은 드롭다운, member는 일반 링크
                  if (item.href === '/schedule') {
                    if (isManagerOrAdmin) {
                      const isScheduleOrConfigActive = pathname === '/schedule' || pathname === '/config' ||
                        pathname?.startsWith('/schedule') || pathname?.startsWith('/config');

                      return (
                        <div key={item.href} className="relative schedule-dropdown">
                          <button
                            onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
                            className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                              isScheduleOrConfigActive
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                            }`}
                          >
                            {item.i18nKey && ready ? t(item.i18nKey, { defaultValue: item.label }) : item.label}
                            <ChevronDown className={`w-4 h-4 transition-transform ${showScheduleDropdown ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Schedule Dropdown Menu */}
                          {showScheduleDropdown && (
                            <div className="absolute left-0 top-full mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 overflow-hidden">
                              {scheduleSubMenuItems.map((subItem) => (
                                <Link
                                  key={subItem.href}
                                  href={subItem.href}
                                  onClick={() => setShowScheduleDropdown(false)}
                                  className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                  {subItem.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      // member는 일반 링크
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
                    }
                  }

                  // '설정' 항목 - manager/admin은 숨김 (드롭다운에 포함), member는 표시
                  if (item.href === '/config' && isManagerOrAdmin) {
                    return null;
                  }

                  // '팀 관리' 항목에 드롭다운 추가
                  if (item.href === '/team') {
                    return (
                      <div key={item.href} className="relative team-dropdown">
                        <button
                          onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                          className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                            isActive
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                          }`}
                        >
                          {item.i18nKey && ready ? t(item.i18nKey, { defaultValue: item.label }) : item.label}
                          <ChevronDown className={`w-4 h-4 transition-transform ${showTeamDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Team Dropdown Menu */}
                        {showTeamDropdown && (
                          <div className="absolute left-0 top-full mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 overflow-hidden">
                            {teamSubMenuItems.map((subItem) => (
                              <button
                                key={subItem.value || subItem.href}
                                onClick={() => {
                                  if (subItem.href) {
                                    router.push(subItem.href);
                                  } else {
                                    router.push(`/team?tab=${subItem.value}`);
                                  }
                                  setShowTeamDropdown(false);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              >
                                {subItem.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

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
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            onClick={async () => {
                              // Mark as read if unread
                              if (!notification.readAt) {
                                await markNotificationAsRead(notification.id);
                              }

                              // Navigate to action URL
                              if (notification.actionUrl) {
                                router.push(notification.actionUrl);
                                setShowNotificationDropdown(false);
                              }
                            }}
                            className={`p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${
                              !notification.readAt ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                            }`}
                          >
                            <p className={`text-sm text-gray-900 dark:text-gray-100 ${
                              !notification.readAt ? 'font-semibold' : ''
                            }`}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              {formatTimeAgo(notification.createdAt)}
                            </p>
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

            // '스케줄' 항목 - manager/admin은 드롭다운, member는 일반 링크
            if (item.href === '/schedule') {
              if (isManagerOrAdmin) {
                const isScheduleOrConfigActive = pathname === '/schedule' || pathname === '/config' ||
                  pathname?.startsWith('/schedule') || pathname?.startsWith('/config');

                return (
                  <div key={item.href}>
                    <button
                      onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                        isScheduleOrConfigActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      {item.i18nKey && ready ? t(item.i18nKey, { defaultValue: item.label }) : item.label}
                      <ChevronDown className={`w-4 h-4 transition-transform ${showScheduleDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Mobile Schedule Submenu */}
                    {showScheduleDropdown && (
                      <div className="ml-4 mt-1 space-y-1">
                        {scheduleSubMenuItems.map((subItem) => (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            onClick={() => {
                              setMobileMenuOpen(false);
                              setShowScheduleDropdown(false);
                            }}
                            className="block w-full text-left px-4 py-2 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                          >
                            {subItem.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              } else {
                // member는 일반 링크
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
              }
            }

            // '설정' 항목 - manager/admin은 숨김 (드롭다운에 포함), member는 표시
            if (item.href === '/config' && isManagerOrAdmin) {
              return null;
            }

            // '팀 관리' 항목에 서브메뉴 추가
            if (item.href === '/team') {
              return (
                <div key={item.href}>
                  <button
                    onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    {item.i18nKey && ready ? t(item.i18nKey, { defaultValue: item.label }) : item.label}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showTeamDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Mobile Team Submenu */}
                  {showTeamDropdown && (
                    <div className="ml-4 mt-1 space-y-1">
                      {teamSubMenuItems.map((subItem) => (
                        <button
                          key={subItem.value || subItem.href}
                          onClick={() => {
                            if (subItem.href) {
                              router.push(subItem.href);
                            } else {
                              router.push(`/team?tab=${subItem.value}`);
                            }
                            setMobileMenuOpen(false);
                            setShowTeamDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                        >
                          {subItem.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

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