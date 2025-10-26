'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Settings, LogOut, ChevronDown, Globe, ChevronRight } from 'lucide-react';

const languages = [
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
];

export function ProfileDropdown() {
  const { userId } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showDropdown, setShowDropdown] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const [currentLang, setCurrentLang] = useState('ko');
  const [showLanguageSubmenu, setShowLanguageSubmenu] = useState(false);

  useEffect(() => {
    // Clerk 사용자 데이터 사용
    if (user) {
      setCurrentUser({
        name: user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`.trim()
          : user.primaryEmailAddress?.emailAddress || '사용자',
        email: user.primaryEmailAddress?.emailAddress || '',
      });
    }
  }, [user]);

  useEffect(() => {
    // Get current language from localStorage
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('i18nextLng') || 'ko';
      setCurrentLang(savedLang);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setShowLanguageSubmenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (langCode: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('i18nextLng', langCode);
      setCurrentLang(langCode);
      setShowLanguageSubmenu(false);
      setShowDropdown(false);
      window.location.reload();
    }
  };

  const handleSignOut = async () => {
    try {
      // Sign out and clear all sessions
      await signOut(() => {
        // After signing out, redirect to sign-in page
        router.push('/sign-in');
      });
    } catch (error) {
      console.error('Sign out error:', error);
      // Force redirect even if there's an error
      router.push('/sign-in');
    }
  };

  const currentLanguage = languages.find(lang => lang.code === currentLang) || languages[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <span className="text-sm text-gray-700 dark:text-gray-300">{currentUser?.name || '사용자'}</span>
        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-gray-400 dark:text-gray-600" />
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 z-50">
          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{currentUser?.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{currentUser?.email}</p>
          </div>
          <div className="py-1">
            <Link
              href="/settings"
              onClick={() => setShowDropdown(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <User className="w-4 h-4" />
              프로필 설정
            </Link>
            <div className="relative">
              <button
                onMouseEnter={() => setShowLanguageSubmenu(true)}
                onClick={() => setShowLanguageSubmenu(!showLanguageSubmenu)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4" />
                  언어 설정
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{currentLanguage.flag} {currentLanguage.name}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>

              {showLanguageSubmenu && (
                <div
                  onMouseLeave={() => setShowLanguageSubmenu(false)}
                  className="absolute left-full top-0 ml-1 w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 py-1"
                >
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 ${
                        currentLang === lang.code
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <LogOut className="w-4 h-4" />
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}