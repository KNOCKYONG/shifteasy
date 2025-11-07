'use client';

import { useState, useEffect } from 'react';
import { Calendar, Users, ArrowRightLeft, Settings } from 'lucide-react';
import Link from 'next/link';
import { MemberDashboard } from '@/components/dashboard/MemberDashboard';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function DashboardClient() {
  const [mounted, setMounted] = useState(false);
  const currentUser = useCurrentUser();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Avoid SSR/CSR mismatch by rendering nothing until mounted
    return null;
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
            빠른 접근
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href={`/schedule?date=${new Date().toISOString().split('T')[0]}&view=today`}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">오늘 근무자</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      보기 →
                    </p>
                  </div>
                  <Calendar className="w-10 h-10 text-blue-500 opacity-20 group-hover:opacity-40 transition-opacity" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">오늘 스케줄 보기</p>
              </div>
            </Link>

            <Link href="/requests?status=pending">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">대기 중인 요청</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      확인 →
                    </p>
                  </div>
                  <ArrowRightLeft className="w-10 h-10 text-purple-500 opacity-20 group-hover:opacity-40 transition-opacity" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">교대 요청 관리</p>
              </div>
            </Link>

            <Link href={`/schedule?month=${new Date().toISOString().slice(0, 7)}`}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">이번 달 스케줄</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                      보기 →
                    </p>
                  </div>
                  <Calendar className="w-10 h-10 text-green-500 opacity-20 group-hover:opacity-40 transition-opacity" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">월간 스케줄 확인</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
