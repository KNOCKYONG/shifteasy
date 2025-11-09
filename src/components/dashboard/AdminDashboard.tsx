'use client';

import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import {
  Calendar, Clock, Users, ArrowRightLeft, AlertTriangle,
  CheckCircle, Activity, Briefcase, CalendarDays, UserCheck
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';

export function AdminDashboard() {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const currentMonth = format(today, 'yyyy-MM');

  // Optimized dashboard data query - single request with caching
  const { data: dashboardData, isLoading } = api.schedule.getDashboardData.useQuery(undefined, {
    staleTime: 2 * 60 * 1000, // 2 minutes cache
    refetchOnWindowFocus: false,
  });

  // Get my upcoming shifts (next 7 days)
  const { data: upcomingShifts, isLoading: isLoadingShifts } = api.schedule.getMyUpcomingShifts.useQuery(undefined, {
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Debug: Check if we're getting data from DB
  useEffect(() => {
    if (upcomingShifts) {
      console.log('📅 Upcoming shifts from DB:', upcomingShifts);
    }
  }, [upcomingShifts]);

  // Get colleagues working with me this week
  const { data: workmatesData, isLoading: isLoadingWorkmates } = api.schedule.getMyWorkmates.useQuery(undefined, {
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Extract stats from optimized response
  const workingToday = dashboardData?.workingToday || 0;
  const pendingRequestsCount = dashboardData?.pendingSwapsCount || 0;
  const approvedTodayCount = dashboardData?.approvedTodayCount || 0;

  // Mock data for pending/approved requests (will be replaced with real data when swap feature is ready)
  const pendingRequests: any[] = [];
  const approvedToday: any[] = [];

  // Stats widgets
  const statsCards = [
    {
      title: '오늘 근무자',
      value: isLoading ? '...' : workingToday,
      subtitle: '명 근무 중',
      icon: Users,
      color: 'blue' as const,
      href: `/schedule?date=${todayStr}&view=today`,
    },
    {
      title: '대기 중인 요청',
      value: isLoading ? '...' : pendingRequestsCount,
      subtitle: '건 승인 필요',
      icon: Clock,
      color: 'yellow' as const,
      href: '/requests?status=pending',
      urgent: pendingRequestsCount > 5,
    },
    {
      title: '오늘 승인',
      value: isLoading ? '...' : approvedTodayCount,
      subtitle: '건 처리 완료',
      icon: CheckCircle,
      color: 'green' as const,
      href: '/requests?status=approved',
    },
    {
      title: '이번 주',
      value: '진행중',
      subtitle: '주간 현황',
      icon: Calendar,
      color: 'purple' as const,
      href: `/schedule?month=${currentMonth}`,
    },
  ];

  // Quick action cards
  const quickActions = [
    {
      title: '스케줄 생성',
      description: 'AI로 자동 스케줄 생성',
      icon: Activity,
      color: 'bg-blue-500',
      href: '/schedule',
    },
    {
      title: '부서원 관리',
      description: '부서원 정보 및 선호도 관리',
      icon: Users,
      color: 'bg-green-500',
      href: '/department',
    },
    {
      title: '요청 처리',
      description: '교대 요청 승인/거부',
      icon: ArrowRightLeft,
      color: 'bg-purple-500',
      href: '/requests',
    },
    {
      title: '근무 타입 설정',
      description: '근무 시간 및 타입 관리',
      icon: Briefcase,
      color: 'bg-orange-500',
      href: '/config',
    },
  ];

  // Pending requests preview
  const recentPendingRequests = pendingRequests.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-2">
          관리자 대시보드 📊
        </h1>
        <p className="opacity-90">
          {format(today, 'yyyy년 MM월 dd일 (E)', { locale: ko })} - 오늘의 근무 현황을 확인하세요
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          const colorClasses = {
            blue: 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400',
            yellow: 'bg-yellow-100 dark:bg-yellow-950 text-yellow-600 dark:text-yellow-400',
            green: 'bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400',
            purple: 'bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400',
          };

          return (
            <Link
              key={index}
              href={stat.href}
              className="block"
            >
              <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all cursor-pointer ${stat.urgent ? 'ring-2 ring-red-500' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {stat.title}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {stat.value}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {stat.subtitle}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${colorClasses[stat.color]}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pending Requests Alert */}
      {pendingRequests.length > 0 && (
        <Card className="p-6 border-l-4 border-yellow-500 dark:border-yellow-400">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-950 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                승인 대기 중인 교대 요청 ({pendingRequests.length}건)
              </h3>
              <div className="space-y-2 mb-4">
                {recentPendingRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    <span className="text-gray-700 dark:text-gray-300">
                      {req.requester?.name} - {format(new Date(req.date), 'MM/dd (E)', { locale: ko })}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      {req.reason?.substring(0, 20)}...
                    </span>
                  </div>
                ))}
              </div>
              <Link href="/requests?status=pending">
                <button className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium transition-colors">
                  모두 보기 →
                </button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          빠른 작업
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={index}
                href={action.href}
                className="block"
              >
                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all cursor-pointer group">
                  <div className={`${action.color} text-white p-3 rounded-lg inline-flex mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {action.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {action.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          최근 활동
        </h2>
        <div className="space-y-3">
          {approvedToday.slice(0, 5).map((req) => (
            <div key={req.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <div className="p-2 bg-green-100 dark:bg-green-950 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  <span className="font-medium">{req.requester?.name}</span>님의 교대 요청이 승인되었습니다
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {req.approvedAt && format(new Date(req.approvedAt), 'HH:mm')} - {format(new Date(req.date), 'MM/dd (E)', { locale: ko })}
                </p>
              </div>
            </div>
          ))}
          {approvedToday.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              오늘 처리된 활동이 없습니다
            </p>
          )}
        </div>
      </Card>

      {/* Personalized Quick Views - Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Upcoming Shifts */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-950 rounded-lg">
              <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              나의 다가오는 근무
            </h2>
          </div>

          <div className="space-y-2">
            {isLoadingShifts ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                로딩 중...
              </div>
            ) : upcomingShifts && upcomingShifts.length > 0 ? (
              upcomingShifts.slice(0, 5).map((shift: any, idx: number) => {
                const shiftDate = new Date(shift.date);
                const isTodayShift = isToday(shiftDate);

                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isTodayShift
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {format(shiftDate, 'MM/dd (E)', { locale: ko })}
                        {isTodayShift && (
                          <span className="ml-2 text-xs px-2 py-0.5 bg-blue-600 text-white rounded-full">
                            오늘
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {shift.shiftName || shift.shiftId || '-'}
                        {shift.startTime && shift.endTime && (
                          <span className="ml-1">
                            {shift.startTime.substring(0, 5)}~{shift.endTime.substring(0, 5)}
                          </span>
                        )}
                      </p>
                    </div>
                    <Link
                      href={`/schedule?date=${format(shiftDate, 'yyyy-MM-dd')}`}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      상세보기
                    </Link>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                다가오는 근무가 없습니다
              </p>
            )}
          </div>

          {upcomingShifts && upcomingShifts.length > 5 && (
            <Link href="/schedule" className="block mt-4">
              <button className="w-full px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors">
                전체 일정 보기 ({upcomingShifts.length}개)
              </button>
            </Link>
          )}
        </Card>

        {/* My Workmates This Week */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-950 rounded-lg">
              <UserCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              이번 주 같이 근무하는 동료
            </h2>
          </div>

          <div className="space-y-2">
            {isLoadingWorkmates ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                로딩 중...
              </div>
            ) : workmatesData && workmatesData.workmates && workmatesData.workmates.length > 0 ? (
              workmatesData.workmates.slice(0, 6).map((workmate: any) => (
                <div
                  key={workmate.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold">
                      {workmate.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {workmate.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {workmate.role === 'member' ? '일반' : workmate.role === 'manager' ? '매니저' : '관리자'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-green-600 dark:text-green-400">
                      {workmate.sharedDays}일
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      함께 근무
                    </p>
                  </div>
                </div>
              ))
            ) : workmatesData && workmatesData.myShifts && workmatesData.myShifts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                이번 주 근무 일정이 없습니다
              </p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                같이 근무하는 동료가 없습니다
              </p>
            )}
          </div>

          {workmatesData && workmatesData.workmates && workmatesData.workmates.length > 6 && (
            <Link href="/department" className="block mt-4">
              <button className="w-full px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 transition-colors">
                전체 부서원 보기
              </button>
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
}
