'use client';

import { Card } from '@/components/ui/card';
import { Calendar, Clock, Bell, CheckCircle, ChevronRight, FileText, AlertCircle, ArrowLeftRight } from 'lucide-react';
import Link from 'next/link';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { DashboardSkeleton } from '@/components/ui/Skeleton';

export function MemberDashboard() {
  const { dbUser, name } = useCurrentUser();

  // Only show skeleton if completely no data
  // Allow partial rendering to improve perceived performance
  if (!dbUser) {
    return null;
  }

  // For member role, show a simplified dashboard
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-2">
          안녕하세요, {name}님! 👋
        </h1>
        <p className="opacity-90">
          오늘도 좋은 하루 되세요. 아래에서 오늘의 일정을 확인하세요.
        </p>
      </div>

      {/* Quick Stats - Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href={`/schedule?view=my-schedule&month=${new Date().toISOString().slice(0, 7)}`}>
          <Card className="p-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">이번 달 근무</p>
                <p className="text-xl font-semibold">18일</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/schedule?view=my-schedule">
          <Card className="p-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">다음 근무</p>
                <p className="text-xl font-semibold">내일 08:00</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/notifications">
          <Card className="p-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Bell className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">새 알림</p>
                <p className="text-xl font-semibold">3개</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/requests?view=my-requests&status=approved">
          <Card className="p-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">승인된 요청</p>
                <p className="text-xl font-semibold">2개</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Today's Schedule */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">오늘의 일정</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div>
                <p className="font-medium">오전 근무</p>
                <p className="text-sm text-gray-500">08:00 - 16:00</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">병동 A</span>
          </div>
        </div>
      </Card>

      {/* This Week Schedule */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">이번 주 일정</h2>
          <Link
            href="/schedule"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            더보기
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center">
          {(() => {
            const today = new Date();
            const currentDay = today.getDay(); // 0 (일요일) ~ 6 (토요일)
            const monday = new Date(today);
            monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));

            const weekDays = ['월', '화', '수', '목', '금', '토', '일'];

            return weekDays.map((day, index) => {
              const date = new Date(monday);
              date.setDate(monday.getDate() + index);
              const month = date.getMonth() + 1;
              const dateNum = date.getDate();

              return (
                <div key={day} className="space-y-2">
                  <p className="text-sm text-gray-500">{`${month}/${dateNum}(${day})`}</p>
                  <div
                    className={`p-2 rounded-lg ${
                      index === 0
                        ? 'bg-blue-100 text-blue-700'
                        : index === 3 || index === 4
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {index === 0
                      ? '오전'
                      : index === 3 || index === 4
                      ? '오후'
                      : '휴무'}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </Card>

      {/* Recent Notifications */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">최근 알림</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <Bell className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">스케줄 변경 알림</p>
              <p className="text-sm text-gray-600">
                다음 주 화요일 근무가 오전에서 오후로 변경되었습니다.
              </p>
              <p className="text-xs text-gray-500 mt-1">2시간 전</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">휴가 승인</p>
              <p className="text-sm text-gray-600">
                요청하신 12월 25일 휴가가 승인되었습니다.
              </p>
              <p className="text-xs text-gray-500 mt-1">어제</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Frequently Used - Member Specific */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">자주 찾는 항목</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* My Requests */}
          <Link href="/requests?view=my-requests">
            <Card className="p-5 hover:shadow-lg transition-shadow duration-200 cursor-pointer border-2 border-transparent hover:border-blue-400">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-semibold">내 요청 현황</h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                제출한 휴가/교대 요청의 처리 상태를 확인하세요
              </p>
              <p className="text-xs text-blue-600 hover:underline">
                요청 현황 보기 →
              </p>
            </Card>
          </Link>

          {/* My Pending Requests */}
          <Link href="/requests?view=my-requests&status=pending">
            <Card className="p-5 hover:shadow-lg transition-shadow duration-200 cursor-pointer border-2 border-transparent hover:border-yellow-400">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <h3 className="font-semibold">승인 대기 중인 요청</h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                승인을 기다리고 있는 나의 요청을 확인하세요
              </p>
              <p className="text-xs text-yellow-600 hover:underline">
                대기 중인 요청 보기 →
              </p>
            </Card>
          </Link>

          {/* New Request */}
          <Link href="/requests?action=new">
            <Card className="p-5 hover:shadow-lg transition-shadow duration-200 cursor-pointer border-2 border-transparent hover:border-green-400">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="font-semibold">새 요청 작성</h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                휴가 또는 근무 교대 요청을 작성하세요
              </p>
              <p className="text-xs text-green-600 hover:underline">
                요청 작성하기 →
              </p>
            </Card>
          </Link>

          {/* Full Schedule */}
          <Link href="/schedule?view=my-schedule">
            <Card className="p-5 hover:shadow-lg transition-shadow duration-200 cursor-pointer border-2 border-transparent hover:border-purple-400">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="font-semibold">전체 근무 일정</h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                나의 전체 근무 일정을 한눈에 확인하세요
              </p>
              <p className="text-xs text-purple-600 hover:underline">
                전체 일정 보기 →
              </p>
            </Card>
          </Link>

          {/* My Handover Requests */}
          <Link href="/requests">
            <Card className="p-5 hover:shadow-lg transition-shadow duration-200 cursor-pointer border-2 border-transparent hover:border-indigo-400">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <ArrowLeftRight className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="font-semibold">내 인수인계 보기</h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                나의 근무 교대 요청과 현황을 한눈에 확인하세요
              </p>
              <p className="text-xs text-indigo-600 hover:underline">
                인수인계 보기 →
              </p>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}