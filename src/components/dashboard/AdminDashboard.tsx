'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import {
  Calendar, Clock, Users, ArrowRightLeft, AlertTriangle,
  CheckCircle, Activity, Briefcase, CalendarDays, UserCheck, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LottieLoadingOverlay } from '@/components/common/LottieLoadingOverlay';

export function AdminDashboard() {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const currentMonth = format(today, 'yyyy-MM');

  // Workmates filter state
  const [workmatesPeriod, setWorkmatesPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [workmatesGroupBy, setWorkmatesGroupBy] = useState<'shift' | 'team'>('shift');

  // Get shift types from database
  const { data: configs } = api.configs.getAll.useQuery(undefined, {
    staleTime: 30 * 60 * 1000, // 30 minutes cache (same as server)
    refetchOnWindowFocus: false,
  });

  // Optimized dashboard data query - single request with caching
  const { data: dashboardData, isLoading } = api.schedule.getDashboardData.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  // Get my upcoming shifts (next 7 days)
  const { data: upcomingShifts, isLoading: isLoadingShifts } = api.schedule.getMyUpcomingShifts.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Debug: Check if we're getting data from DB
  useEffect(() => {
    if (upcomingShifts) {
      console.log('📅 Upcoming shifts from DB:', upcomingShifts);
    }
  }, [upcomingShifts]);

  // Get colleagues working with me on same shifts
  const {
    data: workmatesData,
    isLoading: isLoadingWorkmates,
    isFetching: isFetchingWorkmates,
  } = api.schedule.getMyWorkmates.useQuery(
    {
      period: workmatesPeriod,
      groupBy: workmatesGroupBy,
    },
    {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    }
  );

  const [workmatesSnapshot, setWorkmatesSnapshot] = useState<typeof workmatesData>(undefined);

  useEffect(() => {
    if (workmatesData) {
      setWorkmatesSnapshot(workmatesData);
    }
  }, [workmatesData]);

  const resolvedWorkmatesData = workmatesData ?? workmatesSnapshot;

  // Extract stats from optimized response
  const workingToday = dashboardData?.workingToday || 0;
  const pendingRequestsCount = dashboardData?.pendingSwapsCount || 0;
  const approvedTodayCount = dashboardData?.approvedTodayCount || 0;

  // Mock data for pending/approved requests (will be replaced with real data when swap feature is ready)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingRequests: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const isInitialLoading = (!dashboardData && isLoading) ||
    (!upcomingShifts && isLoadingShifts);

  if (isInitialLoading) {
    return (
      <LottieLoadingOverlay
        fullScreen
        message="대시보드 데이터를 불러오는 중입니다..."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-blue-600 text-white rounded-lg p-6 text-center sm:text-left">
        <h1 className="text-2xl font-bold mb-2">
          관리자 대시보드 📊
        </h1>
        <p className="opacity-90">
          {format(today, 'yyyy년 MM월 dd일 (E)', { locale: ko })} - 오늘의 근무 현황을 확인하세요
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                  <div className={`p-3 rounded-lg self-start sm:self-auto ${colorClasses[stat.color]}`}>
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
                  <div
                    key={req.id}
                    className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-sm bg-gray-50 dark:bg-gray-800 p-2 rounded"
                  >
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
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              upcomingShifts.slice(0, 5).map((shift: any, idx: number) => {
                const shiftDate = new Date(shift.date);
                const isTodayShift = isToday(shiftDate);

                return (
                  <div
                    key={idx}
                    className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border ${
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
                        {(() => {
                          // Dynamic shift code mapping from database
                          const shiftTypes = configs?.shift_types || [];
                          const shiftMapping: Record<string, string> = {};

                          // Build mapping from DB shift types
                          shiftTypes.forEach((st: { code?: string; name?: string }) => {
                            const code = st.code?.toLowerCase();
                            if (!code) return; // Skip if code is undefined

                            const displayName = `${st.code} ${st.name}`;

                            // Map various formats
                            shiftMapping[code] = displayName;
                            shiftMapping[`shift-${code}`] = displayName;

                            // Special case for OFF
                            if (code === 'o') {
                              shiftMapping['off'] = displayName;
                              shiftMapping['shift-off'] = displayName;
                            }
                          });

                          const shiftId = shift.shiftId?.toLowerCase() || '';
                          const displayName = shift.shiftName ||
                                            shiftMapping[shiftId] ||
                                            shiftMapping[shiftId.replace('shift-', '')] ||
                                            shift.shiftId ||
                                            '-';

                          return displayName;
                        })()}
                        {shift.startTime && shift.endTime && shift.startTime !== '00:00' && (
                          <span className="ml-1">
                            ({shift.startTime.substring(0, 5)}~{shift.endTime.substring(0, 5)})
                          </span>
                        )}
                      </p>
                    </div>
                    <Link
                      href={`/schedule?date=${format(shiftDate, 'yyyy-MM-dd')}`}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline w-full sm:w-auto"
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

        {/* My Workmates on Same Shifts */}
        <Card className="p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-950 rounded-lg">
                <UserCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  같은 스케줄 동료 보기
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {workmatesPeriod === 'today' ? '오늘' : workmatesPeriod === 'week' ? '이번 주' : '이번 달'} · {workmatesGroupBy === 'shift' ? '같은 시프트 기준' : '같은 팀 기준'}
                </p>
              </div>
            </div>
            {resolvedWorkmatesData && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-600 dark:bg-green-900/40 dark:text-green-200">
                총 {resolvedWorkmatesData.workmates.length}명
              </span>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                기간 선택
              </span>
              <div className="inline-flex rounded-lg bg-gray-50 dark:bg-gray-800 p-1">
                {(['today', 'week', 'month'] as const).map((period) => {
                  const isActive = workmatesPeriod === period;
                  const label = period === 'today' ? '오늘' : period === 'week' ? '이번 주' : '이번 달';
                  return (
                    <button
                      key={period}
                      onClick={() => setWorkmatesPeriod(period)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        isActive
                          ? 'bg-white dark:bg-gray-700 text-green-600 dark:text-green-300 shadow'
                          : 'text-gray-600 dark:text-gray-300 hover:text-green-600'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                보기 방식
              </span>
              <div className="flex gap-2">
                {(['shift', 'team'] as const).map((mode) => {
                  const isActive = workmatesGroupBy === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => setWorkmatesGroupBy(mode)}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        isActive
                          ? 'border-blue-500 text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-700'
                      }`}
                    >
                      <span>{mode === 'shift' ? '같은 시프트' : '같은 팀'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative" aria-busy={isFetchingWorkmates}>
            {isFetchingWorkmates && resolvedWorkmatesData && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80 dark:bg-gray-900/70">
                <Loader2 className="w-5 h-5 text-green-600 dark:text-green-300 animate-spin" />
                <span className="ml-2 text-xs text-gray-600 dark:text-gray-300">동료 정보를 불러오는 중...</span>
              </div>
            )}

            <div className="space-y-2">
              {(!resolvedWorkmatesData && isLoadingWorkmates) ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                    </div>
                  </div>
                ))
              ) : resolvedWorkmatesData && resolvedWorkmatesData.workmates && resolvedWorkmatesData.workmates.length > 0 ? (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                resolvedWorkmatesData.workmates.slice(0, 6).map((workmate: any) => (
                  <div
                    key={workmate.id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3 flex-1 w-full">
                  <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold">
                        {workmate.name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {workmate.name}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {workmate.position || (
                            workmatesGroupBy === 'team'
                              ? '동일 팀 일정'
                              : workmate.role === 'member'
                                ? '일반 직원'
                                : workmate.role === 'manager'
                                  ? '매니저'
                                  : '관리자'
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right w-full sm:w-auto">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                        {workmate.sharedShifts}회
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          {workmatesGroupBy === 'shift' ? '같은 시프트' : '같은 팀'}
                        </span>
                      </span>
                    </div>
                  </div>
                ))
              ) : resolvedWorkmatesData && resolvedWorkmatesData.myShifts && resolvedWorkmatesData.myShifts.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  {workmatesPeriod === 'today' ? '오늘' : workmatesPeriod === 'week' ? '이번 주' : '이번 달'}에 예정된 근무가 없습니다.
                </p>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  아직 {workmatesGroupBy === 'shift' ? '같은 시프트' : '같은 팀'}로 함께 근무할 동료가 없습니다.
                </div>
              )}
            </div>
          </div>

          {resolvedWorkmatesData && resolvedWorkmatesData.workmates && resolvedWorkmatesData.workmates.length > 6 && (
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
