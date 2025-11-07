'use client';

import { Card } from '@/components/ui/card';
import {
  Calendar, Clock, Users, ArrowRightLeft, AlertTriangle,
  CheckCircle, Activity, Briefcase
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';

export function AdminDashboard() {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const currentMonth = format(today, 'yyyy-MM');

  // Fetch swap requests
  const { data: swapRequests } = api.swap.list.useQuery({
    limit: 100,
    offset: 0,
  });

  // Fetch today's schedules
  const { data: schedules } = api.schedule.list.useQuery({
    startDate: today,
    endDate: today,
    status: 'published',
  });

  // Calculate stats
  const pendingRequests = swapRequests?.items?.filter(r => r.status === 'pending') || [];
  const approvedToday = swapRequests?.items?.filter(r =>
    r.status === 'approved' && r.approvedAt && isToday(new Date(r.approvedAt))
  ) || [];

  const todaySchedule = schedules?.[0];
  const todayAssignments = (todaySchedule?.metadata as any)?.assignments || [];
  const workingToday = todayAssignments.length;

  // Stats widgets
  const statsCards = [
    {
      title: '오늘 근무자',
      value: workingToday || '...',
      subtitle: '명 근무 중',
      icon: Users,
      color: 'blue' as const,
      href: `/schedule?date=${todayStr}&view=today`,
    },
    {
      title: '대기 중인 요청',
      value: pendingRequests.length || '0',
      subtitle: '건 승인 필요',
      icon: Clock,
      color: 'yellow' as const,
      href: '/requests?status=pending',
      urgent: pendingRequests.length > 5,
    },
    {
      title: '오늘 승인',
      value: approvedToday.length || '0',
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
      title: '팀원 관리',
      description: '팀원 정보 및 선호도 관리',
      icon: Users,
      color: 'bg-green-500',
      href: '/team',
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
            <Link key={index} href={stat.href}>
              <Card className={`p-4 hover:shadow-lg transition-all cursor-pointer ${stat.urgent ? 'ring-2 ring-red-500' : ''}`}>
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
              </Card>
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
              <Link key={index} href={action.href}>
                <Card className="p-6 hover:shadow-lg transition-all cursor-pointer group">
                  <div className={`${action.color} text-white p-3 rounded-lg inline-flex mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {action.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {action.description}
                  </p>
                </Card>
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
    </div>
  );
}
