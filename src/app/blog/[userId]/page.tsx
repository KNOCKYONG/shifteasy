"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { Calendar, MessageCircle, Send, Loader2 } from "lucide-react";
import { AppSurface } from "@/components/layout/AppSurface";
import { LottieLoadingOverlay } from "@/components/common/LottieLoadingOverlay";
import { api } from "@/lib/trpc/client";

type UpcomingShift = {
  date: string | Date;
  shiftId?: string;
  shiftType?: string;
  shiftName?: string;
  shiftCode?: string;
};

export default function StaffBlogPage() {
  const params = useParams();
  const targetUserId = params?.userId as string | undefined;

  const [newPost, setNewPost] = useState("");
  const [scheduleView, setScheduleView] = useState<"week" | "month">("week");

  const referenceDate = useMemo(() => new Date(), []);
  const monthStart = useMemo(
    () => startOfMonth(referenceDate),
    [referenceDate]
  );
  const monthEnd = useMemo(
    () => endOfMonth(referenceDate),
    [referenceDate]
  );
  const monthDays = useMemo(
    () =>
      eachDayOfInterval({
        start: monthStart,
        end: monthEnd,
      }),
    [monthStart, monthEnd]
  );

  const {
    data: profile,
    isLoading: isLoadingProfile,
  } = api.blog.profile.useQuery(
    { userId: targetUserId ?? "" },
    { enabled: !!targetUserId }
  );

  const {
    data: shifts,
    isLoading: isLoadingShifts,
  } = api.schedule.getMyUpcomingShifts.useQuery(
    { userId: targetUserId ?? "" },
    { enabled: !!targetUserId && scheduleView === "week" }
  );

  const {
    data: monthShifts,
    isLoading: isLoadingMonthShifts,
  } = api.schedule.getMyUpcomingShifts.useQuery(
    {
      userId: targetUserId ?? "",
      startDate: monthStart.toISOString(),
      endDate: monthEnd.toISOString(),
    },
    { enabled: !!targetUserId && scheduleView === "month" }
  );

  const {
    data: posts,
    isLoading: isLoadingPosts,
    refetch: refetchPosts,
  } = api.blog.listPosts.useQuery(
    { userId: targetUserId ?? "" },
    { enabled: !!targetUserId }
  );

  const addPostMutation = api.blog.addPost.useMutation({
    onSuccess: () => {
      setNewPost("");
      refetchPosts();
    },
  }) as any;

  if (!targetUserId) {
    return null;
  }

  if (isLoadingProfile) {
    return (
      <AppSurface>
        <div className="container mx-auto px-4 py-8">
          <LottieLoadingOverlay
            fullScreen={false}
            message="직원 블로그를 불러오는 중입니다..."
          />
        </div>
      </AppSurface>
    );
  }

  if (!profile) {
    return (
      <AppSurface>
        <div className="container mx-auto px-4 py-12">
          <p className="text-center text-gray-500">
            해당 직원을 찾을 수 없습니다.
          </p>
        </div>
      </AppSurface>
    );
  }

  const handleSubmit = () => {
    const content = newPost.trim();
    if (!content) return;

    addPostMutation.mutate({
      userId: targetUserId,
      content,
    });
  };

  const upcomingShifts = (shifts || []) as UpcomingShift[];
  const upcomingMonthShifts = (monthShifts || []) as UpcomingShift[];

  return (
    <AppSurface>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
              STAFF BLOG
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {profile.name}님의 블로그
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              근무 일정과 동료들의 메시지를 한 곳에서 볼 수 있는 공간입니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
              {profile.tenantName && (
                <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1">
                  {profile.tenantName}
                </span>
              )}
              {profile.departmentName && (
                <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1">
                  {profile.departmentName}
                </span>
              )}
              {profile.position && (
                <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1">
                  {profile.position}
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1">
                {profile.role === "manager" || profile.role === "admin"
                  ? "관리자"
                  : "구성원"}
              </span>
            </div>
          </div>

          {/* Upcoming shifts summary */}
          <div className="w-full md:w-80 bg-gray-50 dark:bg-gray-800/60 rounded-lg p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  근무 일정
                </p>
              </div>
              <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setScheduleView("week")}
                  className={`px-2 py-0.5 rounded-full ${
                    scheduleView === "week"
                      ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 shadow-sm"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  1주일
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleView("month")}
                  className={`px-2 py-0.5 rounded-full ${
                    scheduleView === "month"
                      ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 shadow-sm"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  1개월
                </button>
              </div>
            </div>

            {scheduleView === "week" ? (
              <>
                {isLoadingShifts ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                ) : upcomingShifts.length > 0 ? (
                  <ul className="space-y-1.5 max-h-44 overflow-y-auto text-xs">
                    {upcomingShifts.map((shift) => {
                      const date = new Date(shift.date);
                      return (
                        <li
                          key={`${shift.date}-${shift.shiftId || shift.shiftType}`}
                          className="flex items-center justify-between rounded-md px-2 py-1 bg-white/70 dark:bg-gray-900/60"
                        >
                          <span className="text-gray-700 dark:text-gray-200">
                            {format(date, "M월 d일 (EEE)", { locale: ko })}
                          </span>
                          <span className="text-gray-600 dark:text-gray-300">
                            {shift.shiftName || shift.shiftCode || "근무"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="py-4 text-xs text-gray-500 dark:text-gray-400">
                    예정된 근무가 없습니다.
                  </p>
                )}
              </>
            ) : (
              <>
                {isLoadingMonthShifts ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                ) : upcomingMonthShifts.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      이번 달 근무 일정
                    </p>
                    <div className="grid grid-cols-7 gap-1 text-[10px]">
                      {monthDays.map((day) => {
                        const dayShifts = upcomingMonthShifts.filter((shift) => {
                          const date = new Date(shift.date);
                          return (
                            date.getFullYear() === day.getFullYear() &&
                            date.getMonth() === day.getMonth() &&
                            date.getDate() === day.getDate()
                          );
                        });

                        return (
                          <div
                            key={day.toISOString()}
                            className="flex flex-col items-center justify-center rounded-md px-1 py-1 bg-white/70 dark:bg-gray-900/60"
                          >
                            <span className="text-gray-700 dark:text-gray-100">
                              {format(day, "d")}
                            </span>
                            {dayShifts.length > 0 && (
                              <span className="mt-0.5 inline-flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-[9px] text-blue-700 dark:text-blue-300 px-1.5 py-0.5">
                                {dayShifts
                                  .map((s) => s.shiftCode || s.shiftType || "")
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="py-4 text-xs text-gray-500 dark:text-gray-400">
                    이번 달에는 등록된 근무가 없습니다.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Wall posts */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  담벼락
                </h2>
              </div>
              <div className="space-y-3">
                <textarea
                  rows={3}
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  aria-label="담벼락 글쓰기"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!newPost.trim() || addPostMutation.isLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {addPostMutation.isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>등록 중...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>남기기</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                담벼락 기록
              </h2>
              {isLoadingPosts ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : posts && posts.length > 0 ? (
                <ul className="space-y-3 max-h-[480px] overflow-y-auto">
                  {posts.map((post) => (
                    <li
                      key={post.id}
                      className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 p-3"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                            {post.authorName ?? "동료"}
                            {post.authorPosition
                              ? ` · ${post.authorPosition}`
                              : ""}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400">
                          {post.createdAt
                            ? format(
                                new Date(post.createdAt),
                                "M월 d일 HH:mm",
                                { locale: ko }
                              )
                            : ""}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-line">
                        {post.content}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-xs text-gray-500 dark:text-gray-400">
                  아직 남겨진 메시지가 없습니다.
                </p>
              )}
            </div>
          </div>

          {/* Right column placeholder for future widgets */}
          <div className="space-y-4">
            {/* 유지보수 용: 추후 필요한 요약 카드 등을 배치 */}
          </div>
        </div>
      </div>
    </AppSurface>
  );
}

