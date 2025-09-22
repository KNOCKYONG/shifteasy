'use client';

import { useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

interface SignOutButtonProps {
  className?: string;
  showIcon?: boolean;
  showText?: boolean;
}

export function SignOutButton({
  className = '',
  showIcon = true,
  showText = true
}: SignOutButtonProps) {
  const { signOut } = useClerk();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/sign-in');
    } catch (error) {
      console.error('Sign out error:', error);
      // 에러가 발생해도 로그인 페이지로 리다이렉트
      router.push('/sign-in');
    }
  };

  return (
    <button
      onClick={handleSignOut}
      className={`flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors ${className}`}
    >
      {showIcon && <LogOut className="w-4 h-4" />}
      {showText && <span>로그아웃</span>}
    </button>
  );
}