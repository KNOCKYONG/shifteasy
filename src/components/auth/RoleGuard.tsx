'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { canAccessPage, type Role } from '@/lib/permissions';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface RoleGuardProps {
  children: React.ReactNode;
  fallbackUrl?: string;
}

export function RoleGuard({ children, fallbackUrl = '/dashboard' }: RoleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { dbUser, role, isLoaded } = useCurrentUser();

  useEffect(() => {
    if (isLoaded && dbUser) {
      // Check if user can access current page
      if (!canAccessPage(role as Role, pathname)) {
        // Redirect to fallback URL or dashboard
        router.push(fallbackUrl);
      }
    }
  }, [dbUser, isLoaded, role, pathname, router, fallbackUrl]);

  // Show loading state while checking permissions
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render content if user doesn't have access
  if (dbUser && !canAccessPage(role as Role, pathname)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">접근 권한이 없습니다</h2>
          <p className="text-gray-600 mb-6">이 페이지에 접근할 권한이 없습니다.</p>
          <button
            onClick={() => router.push(fallbackUrl)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}