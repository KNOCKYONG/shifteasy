'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  MessageSquare,
  Mail,
  User,
  TrendingUp,
  Bookmark,
  Settings,
  Shield
} from 'lucide-react';

export function CommunityNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/community', label: '홈', icon: Home, exact: true },
    { href: '/community/posts/new', label: '글쓰기', icon: MessageSquare },
    { href: '/community/messages', label: '쪽지함', icon: Mail },
    { href: '/community/trending', label: '트렌딩', icon: TrendingUp },
    { href: '/community/bookmarks', label: '저장한 글', icon: Bookmark },
    { href: '/community/profile', label: '내 프로필', icon: User },
  ];

  return (
    <nav className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4 sticky top-6">
      <div className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Community Guidelines */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
        <Link
          href="/community/guidelines"
          className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <Shield className="w-3 h-3" />
          <span>커뮤니티 가이드라인</span>
        </Link>
      </div>
    </nav>
  );
}