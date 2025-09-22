"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { api } from '@/lib/trpc/client';
import { getNavigationForRole, type Role } from '@/lib/permissions';

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
  const { data: currentUser } = api.tenant.users.current.useQuery();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 페이지 변경 시 모바일 메뉴 닫기
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Get role-based navigation items
  const roleNavigation = getNavigationForRole(currentUser?.role as Role);

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

            {/* Right side: Language Switcher, Profile and Mobile Menu Button */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>
              <ProfileDropdown />

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
          {/* Mobile Language Switcher */}
          <div className="pb-4 mb-4 border-b border-gray-200 dark:border-gray-700 sm:hidden">
            <LanguageSwitcher />
          </div>

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