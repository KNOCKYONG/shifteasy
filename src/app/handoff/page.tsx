"use client";

import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  ClipboardList,
  Plus,
  Clock,
  AlertCircle,
  Users,
  ArrowRight,
  Filter,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { api } from "@/lib/trpc/client";
import { CreateHandoffDialog } from "@/components/handoff/CreateHandoffDialog";
import { LottieLoadingOverlay } from "@/components/common/LottieLoadingOverlay";
import { toUTCDateOnly } from "@/lib/utils/date-utils";
import { HandoffTemplatesTab } from "@/components/handoff/HandoffTemplatesTab";
import { getRoleLevel, type Role } from "@/lib/permissions";

const PRIORITY_ICONS = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

const STATUS_LABELS = {
  draft: "작성중",
  submitted: "제출됨",
  in_review: "검토중",
  completed: "완료",
};

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  in_review: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
};

const SHIFT_TYPE_LABELS = {
  D: "주간",
  E: "저녁",
  N: "야간",
};

export default function HandoffPage() {
  const [activeTab, setActiveTab] = useState<"to-give" | "to-receive" | "templates">("to-give");
  const [showNewHandoffDialog, setShowNewHandoffDialog] = useState(false);
  const [selectedDepartment] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch current user for permission check
  const { data: currentUser } = api.auth.me.useQuery();

  // Check if user is manager or above (level >= 2)
  const canAccessTemplates = useMemo(() => {
    if (!currentUser?.role) return false;
    return getRoleLevel(currentUser.role as Role) >= 2; // Manager level or above
  }, [currentUser]);

  // Fetch handoffs I need to give (as handover user)
  const { data: handoffsToGive, isLoading: loadingToGive } = api.handoff.list.useQuery({
    isHandover: true,
    limit: 50,
  });

  // Fetch handoffs I need to receive (as receiver user)
  const { data: handoffsToReceive, isLoading: loadingToReceive } = api.handoff.list.useQuery({
    isReceiver: true,
    limit: 50,
  });

  const statsRange = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    return {
      startDate: toUTCDateOnly(start),
      endDate: toUTCDateOnly(end),
    };
  }, []);

  // Statistics - disabled for now until we have valid department context
  const { data: stats } = api.handoff.stats.useQuery(
    {
      departmentId: selectedDepartment,
      startDate: statsRange.startDate,
      endDate: statsRange.endDate,
    },
    {
      enabled: !!selectedDepartment, // Only fetch when we have a valid department
    }
  );

  const activeHandoffs = activeTab === "to-give" ? handoffsToGive : handoffsToReceive;
  const isLoading = activeTab === "to-give" ? loadingToGive : loadingToReceive;

  // Filter by status
  const filteredHandoffs = activeHandoffs?.filter((handoff) => {
    if (statusFilter === "all") return true;
    return handoff.status === statusFilter;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <ClipboardList className="w-8 h-8" />
              간호 인수인계
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              환자 정보를 빠르고 정확하게 인수인계하세요
            </p>
          </div>
          <button
            onClick={() => setShowNewHandoffDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            새 인수인계 시작
          </button>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">총 인수인계</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalHandoffs}</p>
                </div>
                <ClipboardList className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">평균 소요시간</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.avgDuration}분</p>
                </div>
                <Clock className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">총 환자 수</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalPatients}</p>
                </div>
                <Users className="w-8 h-8 text-purple-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">긴급 환자</p>
                  <p className="text-2xl font-bold text-red-600">{stats.criticalPatients}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("to-give")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "to-give"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                내가 인계할 인수인계
                {handoffsToGive && (
                  <span className="ml-2 bg-blue-100 text-blue-600 py-0.5 px-2 rounded-full text-xs font-medium">
                    {handoffsToGive.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab("to-receive")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "to-receive"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                내가 인수할 인수인계
                {handoffsToReceive && (
                  <span className="ml-2 bg-green-100 text-green-600 py-0.5 px-2 rounded-full text-xs font-medium">
                    {handoffsToReceive.length}
                  </span>
                )}
              </div>
            </button>
            {canAccessTemplates && (
              <button
                onClick={() => setActiveTab("templates")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "templates"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  템플릿 관리
                </div>
              </button>
            )}
          </nav>
        </div>

        {/* Filters - only show for handoff lists, not templates */}
        {activeTab !== "templates" && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">모든 상태</option>
                <option value="draft">작성중</option>
                <option value="submitted">제출됨</option>
                <option value="in_review">검토중</option>
                <option value="completed">완료</option>
              </select>
            </div>
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === "templates" && canAccessTemplates && <HandoffTemplatesTab />}

        {/* Handoff List */}
        {activeTab !== "templates" && <div className="space-y-4">
          {isLoading ? (
            <LottieLoadingOverlay
              message="인수인계 목록을 불러오는 중입니다..."
              fullScreen
            />
          ) : filteredHandoffs && filteredHandoffs.length > 0 ? (
            filteredHandoffs.map((handoff) => {
              const metadata = handoff.metadata as Record<string, unknown> | null;
              const totalPatients = (metadata?.totalPatients as number) || 0;
              const criticalCount = (metadata?.criticalCount as number) || 0;
              const highCount = (metadata?.highCount as number) || 0;

              return (
                <div
                  key={handoff.id}
                  className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    window.location.href = `/handoff/${handoff.id}`;
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            STATUS_COLORS[handoff.status as keyof typeof STATUS_COLORS]
                          }`}
                        >
                          {STATUS_LABELS[handoff.status as keyof typeof STATUS_LABELS]}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {SHIFT_TYPE_LABELS[handoff.shiftType as keyof typeof SHIFT_TYPE_LABELS]} 근무
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {format(new Date(handoff.shiftDate), "yyyy년 M월 d일 (E)", {
                            locale: ko,
                          })}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            총 <span className="font-semibold text-gray-900 dark:text-gray-100">{totalPatients}</span>명
                          </span>
                        </div>
                        {criticalCount > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{PRIORITY_ICONS.critical}</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              긴급 <span className="font-semibold text-red-600">{criticalCount}</span>명
                            </span>
                          </div>
                        )}
                        {highCount > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{PRIORITY_ICONS.high}</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              높음 <span className="font-semibold text-orange-600">{highCount}</span>명
                            </span>
                          </div>
                        )}
                      </div>

                      {handoff.overallNotes && (
                        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {handoff.overallNotes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {handoff.status === "completed" && handoff.duration && (
                        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                          <Clock className="w-4 h-4" />
                          {handoff.duration}분
                        </div>
                      )}
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {statusFilter === "all"
                  ? "아직 인수인계가 없습니다"
                  : `${STATUS_LABELS[statusFilter as keyof typeof STATUS_LABELS]} 상태의 인수인계가 없습니다`}
              </p>
            </div>
          )}
        </div>}
      </div>

      {/* Create Handoff Dialog */}
      <CreateHandoffDialog
        isOpen={showNewHandoffDialog}
        onClose={() => setShowNewHandoffDialog(false)}
      />
    </MainLayout>
  );
}
