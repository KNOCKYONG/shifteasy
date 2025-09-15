"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

interface NavItem {
  href: string;
  label: string;
  i18nKey?: string;
}

export function NavigationHeader() {
  const pathname = usePathname();
  const { t } = useTranslation('common');

  // 네비게이션 항목 정의 - 대시보드 탭 제외
  const navItems: NavItem[] = [
    { href: '/schedule', label: '스케줄', i18nKey: 'nav.schedule' },
    { href: '/team', label: '팀 관리', i18nKey: 'nav.team' },
    { href: '/swap', label: '스왑', i18nKey: 'nav.swap' },
    { href: '/config', label: '설정', i18nKey: 'nav.config' },
  ];

  // 인증이 필요없는 페이지들
  const publicPages = ['/sign-in', '/sign-up', '/join'];
  const isPublicPage = publicPages.some(page => pathname?.startsWith(page));

  if (isPublicPage) {
    return null; // 인증 페이지에서는 네비게이션 헤더를 표시하지 않음
  }

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo - 대시보드로 이동 */}
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-xl font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              ShiftEasy
            </Link>

            {/* Navigation Items */}
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
                    {item.i18nKey ? t(item.i18nKey, item.label) : item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right side: Language Switcher and Profile */}
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <ProfileDropdown />
          </div>
        </div>
      </div>
    </header>
  );
}