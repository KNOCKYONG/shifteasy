'use client';

// import { useAuth, useOrganization } from '@clerk/nextjs';
import { Calendar, Users, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import { mockTenant } from '@/lib/auth/mock-auth';

export default function DashboardPage() {
  // const { isLoaded } = useAuth();
  // const { organization } = useOrganization();
  const isLoaded = true; // Mock으로 항상 로드됨
  const organization = { name: mockTenant.name }; // Mock 조직 데이터

  // Clerk 비활성화 상태에서는 로딩 스킵
  /* 원래 코드 (Clerk 재활성화 시 사용)
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">로딩 중...</p>
        </div>
      </div>
    );
  }
  */

  // middleware에서 이미 인증을 체크하므로 userId 체크는 불필요

  const quickStats = [
    {
      title: '이번 주 근무',
      value: '40시간',
      change: '+2.5%',
      icon: Clock,
      color: 'blue',
      href: '/schedule',
    },
    {
      title: '팀원 수',
      value: '24명',
      change: '+1명',
      icon: Users,
      color: 'green',
      href: '/team',
    },
    {
      title: '스왑 요청',
      value: '3건',
      change: '대기중',
      icon: Calendar,
      color: 'yellow',
      href: '/swap',
    },
  ];

  const quickActions = [
    {
      title: '스케줄 보기',
      description: '이번 주 근무 스케줄 확인',
      href: '/schedule',
      icon: Calendar,
    },
    {
      title: '팀 관리',
      description: '팀원 정보 및 역할 관리',
      href: '/team',
      icon: Users,
    },
    {
      title: '설정',
      description: '근무 패턴 및 제약 조건 설정',
      href: '/config',
      icon: Clock,
    },
  ];

  const upcomingShifts = [
    { date: '오늘', shift: '주간 (07:00 - 15:00)', status: 'confirmed' },
    { date: '내일', shift: '저녁 (15:00 - 23:00)', status: 'confirmed' },
    { date: '1/15', shift: '야간 (23:00 - 07:00)', status: 'pending' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                ShiftEasy
              </span>
              <nav className="flex items-center gap-6">
                <a href="/dashboard" className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  대시보드
                </a>
                <a href="/schedule" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  스케줄
                </a>
                <a href="/swap" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  스왑
                </a>
                <a href="/team" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  팀 관리
                </a>
                <a href="/config" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  설정
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">{organization?.name || '서울대학교병원'}</span>
              <ProfileDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            환영합니다, {organization?.name || '서울대학교병원'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            오늘의 근무 현황과 일정을 확인하세요
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {quickStats.map((stat, index) => {
            const Icon = stat.icon;
            const bgColorLight = stat.color === 'blue' ? 'bg-blue-50' : stat.color === 'green' ? 'bg-green-50' : 'bg-yellow-50';
            const bgColorDark = stat.color === 'blue' ? 'dark:bg-blue-950/30' : stat.color === 'green' ? 'dark:bg-green-950/30' : 'dark:bg-yellow-950/30';
            const textColor = stat.color === 'blue' ? 'text-blue-600 dark:text-blue-400' : stat.color === 'green' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400';

            return (
              <Link
                key={index}
                href={stat.href}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 rounded-lg ${bgColorLight} ${bgColorDark}`}>
                    <Icon className={`w-5 h-5 ${textColor}`} />
                  </div>
                  <span className={`text-sm font-medium ${textColor}`}>
                    {stat.change}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{stat.title}</p>
              </Link>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upcoming Shifts */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">다가오는 근무</h3>
              <Link
                href="/schedule"
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
              >
                전체 보기
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="space-y-3">
              {upcomingShifts.map((shift, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{shift.date}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{shift.shift}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      shift.status === 'confirmed'
                        ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                        : 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400'
                    }`}
                  >
                    {shift.status === 'confirmed' ? '확정' : '대기'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">빠른 작업</h3>
            <div className="space-y-3">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={index}
                    href={action.href}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{action.title}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{action.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}