'use client';

import { useState, useEffect } from 'react';
import { Calendar, Users, ArrowRightLeft, Settings, Moon, Clock, CheckCircle, FileText } from 'lucide-react';
import Link from 'next/link';
import { MemberDashboard } from '@/components/dashboard/MemberDashboard';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { DashboardSkeleton } from '@/components/ui/Skeleton';

export default function DashboardClient() {
  const [mounted, setMounted] = useState(false);
  const currentUser = useCurrentUser();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Debug logging
  useEffect(() => {
    if (mounted) {
      console.log('🔍 Dashboard Debug:', {
        isLoaded: currentUser.isLoaded,
        role: currentUser.role,
        dbUser: currentUser.dbUser,
        name: currentUser.name,
        error: currentUser.error,
        isLoadingDbUser: currentUser.isLoadingDbUser,
      });
    }
  }, [mounted, currentUser]);

  if (!mounted) {
    // Avoid SSR/CSR mismatch by rendering nothing until mounted
    return null;
  }

  // Show error state if TRPC query failed
  if (currentUser.error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="mb-4 text-red-500 text-4xl">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              데이터를 불러올 수 없습니다
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              사용자 정보를 가져오는 중 오류가 발생했습니다.
            </p>
            <button
              onClick={() => currentUser.refetch()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              다시 시도
            </button>
            <details className="mt-4 text-left max-w-md mx-auto">
              <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400">
                기술 정보 보기
              </summary>
              <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
                {JSON.stringify(currentUser.error, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      </div>
    );
  }

  // Wait for user data to load before deciding which dashboard to show
  if (currentUser.isLoadingDbUser || !currentUser.dbUser) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">데이터를 불러오는 중...</p>
            {currentUser.isLoadingDbUser && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                사용자 정보 조회 중...
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show simplified dashboard for members
  if (currentUser.role === 'member') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="container mx-auto px-4 py-8">
          <MemberDashboard />
        </div>
      </div>
    );
  }

  // Filter dashboard cards based on user role
  const allDashboardCards = [
    {
      title: '스케줄 관리',
      description: '팀원들의 근무 스케줄을 확인하고 관리합니다',
      icon: Calendar,
      href: '/schedule',
      color: 'bg-blue-500',
      roles: ['owner', 'admin', 'manager'],
    },
    {
      title: '팀 관리',
      description: currentUser.role === 'manager'
        ? '우리 팀 정보를 확인합니다'
        : '팀원 정보와 부서를 관리합니다',
      icon: Users,
      href: '/team',
      color: 'bg-green-500',
      roles: ['owner', 'admin', 'manager'],
    },
    {
      title: '근무 교대',
      description: '근무 교대 요청을 확인하고 승인합니다',
      icon: ArrowRightLeft,
      href: '/requests',
      color: 'bg-purple-500',
      roles: ['owner', 'admin', 'manager'],
    },
    {
      title: '설정',
      description: '시스템 설정과 근무 타입을 관리합니다',
      icon: Settings,
      href: '/config',
      color: 'bg-gray-500',
      roles: ['owner', 'admin'],
    },
  ];

  // Filter cards based on user role
  const dashboardCards = allDashboardCards.filter(card =>
    card.roles.includes(currentUser.role)
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            대시보드
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            ShiftEasy 병원 근무 관리 시스템
          </p>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="block group"
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200">
                <div className={`inline-flex p-3 rounded-lg ${card.color} text-white mb-4`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {card.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {card.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

        <div className="mt-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
            오늘의 현황
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link href={`/schedule?date=${new Date().toISOString().split('T')[0]}`} className="block group">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">근무 중인 직원</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">12명</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 group-hover:underline">
                  스케줄 보기 →
                </p>
              </div>
            </Link>
            <Link href="/requests" className="block group">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">대기 중인 교대 요청</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">3건</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 group-hover:underline">
                  요청 확인하기 →
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Frequently Used Filters */}
        <div className="mt-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
            자주 찾는 항목
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Pending Requests */}
            <Link href="/requests?status=pending" className="block group">
              <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-5 hover:border-yellow-400 dark:hover:border-yellow-500 hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    승인 대기 요청
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  처리가 필요한 휴가/교대 요청을 확인하세요
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 group-hover:underline">
                  대기 중인 요청 확인 →
                </p>
              </div>
            </Link>

            {/* Night Shift Today */}
            <Link href={`/schedule?date=${new Date().toISOString().split('T')[0]}&shift=night`} className="block group">
              <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-5 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <Moon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    오늘의 야간 근무
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  오늘 야간 시프트에 배정된 직원을 확인하세요
                </p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 group-hover:underline">
                  야간 근무자 보기 →
                </p>
              </div>
            </Link>

            {/* Swap Requests This Week */}
            <Link href="/requests?type=swap&status=pending" className="block group">
              <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-5 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <ArrowRightLeft className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    교대 요청
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  처리 대기 중인 근무 교대 요청을 확인하세요
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400 group-hover:underline">
                  교대 요청 보기 →
                </p>
              </div>
            </Link>

            {/* Approved Requests */}
            <Link href="/requests?status=approved" className="block group">
              <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-5 hover:border-green-400 dark:hover:border-green-500 hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    승인된 요청
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  최근 승인된 휴가/교대 요청 내역을 확인하세요
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 group-hover:underline">
                  승인 내역 보기 →
                </p>
              </div>
            </Link>

            {/* This Month Schedule */}
            <Link href={`/schedule?month=${new Date().toISOString().slice(0, 7)}`} className="block group">
              <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-5 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    이번 달 전체 스케줄
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  이번 달의 전체 근무 일정을 확인하세요
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 group-hover:underline">
                  월간 스케줄 보기 →
                </p>
              </div>
            </Link>

            {/* Team Members */}
            <Link href="/team" className="block group">
              <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-5 hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                    <Users className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    팀원 관리
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  팀원 정보와 근무 설정을 관리하세요
                </p>
                <p className="text-xs text-teal-600 dark:text-teal-400 group-hover:underline">
                  팀원 보기 →
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

