"use client";
import { useState, useEffect } from "react";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { ko, enUS, ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Users, Settings, Download, Lock, Unlock, Wand2, RefreshCw, X, HelpCircle, ArrowLeftRight, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScheduleBoard } from "@/components/schedule/ScheduleBoard";
import { MonthView } from "@/components/schedule/MonthView";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { type Staff, type WeekSchedule } from "@/lib/types";
import { loadCurrentTeam } from "@/lib/teamStorage";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { StaffBalanceIndicator } from "@/components/schedule/StaffBalanceIndicator";
import { ShiftSwapModal } from "@/components/schedule/ShiftSwapModal";
import { Tooltip } from "@/components/ui/Tooltip";
import { SCHEDULE_CONFIG, PERFORMANCE_THRESHOLDS } from "@/lib/constants";
import { API_ENDPOINTS, REQUEST_HEADERS } from "@/lib/constants";

export default function SchedulePage() {
  const { t, i18n } = useTranslation(['schedule', 'common']);
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [staff, setStaff] = useState<Staff[]>([]);
  const [schedule, setSchedule] = useState<WeekSchedule>({});
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMetrics, setGenerationMetrics] = useState<any>(null);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapModalData, setSwapModalData] = useState<{
    staffId: string;
    date: Date;
    shift?: string;
  } | null>(null);

  const getLocale = () => {
    if (i18n.language === 'en') return enUS;
    if (i18n.language === 'ja') return ja;
    return ko;
  };

  useEffect(() => {
    // Load team data
    const teamData = loadCurrentTeam();
    if (teamData && teamData.staff) {
      setStaff(teamData.staff);

      // Initialize empty schedule for all staff
      const initialSchedule: WeekSchedule = {};
      teamData.staff.forEach(member => {
        initialSchedule[member.id] = {};
      });
      setSchedule(initialSchedule);
    }
  }, []);

  const handlePreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1));
  };

  const handleToday = () => {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  const handleConfirmToggle = () => {
    if (!isConfirmed) {
      // Validate schedule before confirming
      const hasSchedule = Object.values(schedule).some(staffSchedule =>
        Object.keys(staffSchedule).length > 0
      );

      if (!hasSchedule) {
        alert(t('alerts.noSchedule'));
        return;
      }
    }
    setIsConfirmed(!isConfirmed);
  };

  const handleGenerateSchedule = async () => {
    if (staff.length === 0) {
      alert(t('alerts.noTeam'));
      return;
    }

    setIsGenerating(true);
    setGenerationMetrics(null);

    // Get team data
    const teamData = loadCurrentTeam();
    if (!teamData || !teamData.staff || teamData.staff.length === 0) {
      alert(t('alerts.noTeamData'));
      setIsGenerating(false);
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.SCHEDULE_GENERATE, {
        method: "POST",
        headers: REQUEST_HEADERS.CONTENT_TYPE_JSON,
        body: JSON.stringify({
          startDate: currentWeek.toISOString(),
          teamData: teamData,
          config: {
            maxConsecutiveDays: SCHEDULE_CONFIG.MAX_CONSECUTIVE_DAYS,
            minRestHours: SCHEDULE_CONFIG.MIN_REST_HOURS,
            maxWeeklyHours: SCHEDULE_CONFIG.MAX_WEEKLY_HOURS,
            minStaffPerShift: SCHEDULE_CONFIG.MIN_STAFF_PER_SHIFT,
            fairnessWeight: SCHEDULE_CONFIG.FAIRNESS_WEIGHT,
            preferenceWeight: SCHEDULE_CONFIG.PREFERENCE_WEIGHT,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(t('alerts.generationFailed'));
      }

      const result = await response.json();

      setSchedule(result.schedule);
      setGenerationMetrics(result.metrics);

      // 성공 메시지
      if (result.metrics.processingTime < PERFORMANCE_THRESHOLDS.PROCESSING_TIME_GOOD) {
        console.log(`스케줄 생성 완료 (${result.metrics.processingTime}ms)`);
      }

    } catch (error) {
      console.error("Schedule generation error:", error);
      alert(t('alerts.generationError'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = () => {
    // Export schedule as JSON
    const exportData = {
      week: format(currentWeek, "yyyy-MM-dd"),
      staff,
      schedule,
      confirmed: isConfirmed,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schedule-${format(currentWeek, "yyyy-MM-dd")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSwapRequest = async (targetStaffId: string, targetDate: Date, reason?: string) => {
    // TODO: Implement API call for shift swap request
    console.log("Shift swap request:", {
      fromStaff: swapModalData?.staffId,
      toStaff: targetStaffId,
      date: targetDate,
      reason
    });
    setShowSwapModal(false);
    setSwapModalData(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <a href="/dashboard" className="text-xl font-semibold text-gray-900 dark:text-white hover:text-blue-600 transition-colors">
                {t('app.name', { ns: 'common', defaultValue: 'ShiftEasy' })}
              </a>
              <nav className="flex items-center gap-6">
                <a href="/schedule" className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {t('nav.schedule', { ns: 'common', defaultValue: '스케줄' })}
                </a>
                <a href="/team" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                  {t('nav.team', { ns: 'common', defaultValue: '팀 관리' })}
                </a>
                <a href="/config" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                  {t('nav.config', { ns: 'common', defaultValue: '설정' })}
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <NotificationCenter userId="dev-user-id" />
              <ProfileDropdown />

              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateSchedule}
                  disabled={isGenerating}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg ${
                    isGenerating
                      ? "text-gray-400 bg-gray-100 cursor-not-allowed"
                      : "text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100"
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {t('actions.generating')}
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      {t('actions.autoGenerate')}
                    </>
                  )}
                </button>
                <Tooltip
                  content={
                    <div>
                      <p className="font-semibold mb-1">AI 자동 스케줄 생성</p>
                      <p>팀원의 선호도, 경력, 근무 패턴을 분석하여</p>
                      <p>최적의 스케줄을 자동으로 생성합니다.</p>
                    </div>
                  }
                  position="bottom"
                />
              </div>

              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                <Download className="w-4 h-4" />
                {t('actions.export')}
              </button>
              <button
                onClick={handleConfirmToggle}
                className={`inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg ${
                  isConfirmed
                    ? "text-green-700 bg-green-50 border border-green-200 hover:bg-green-100"
                    : "text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100"
                }`}
              >
                {isConfirmed ? (
                  <>
                    <Lock className="w-4 h-4" />
                    {t('actions.confirmed')}
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    {t('actions.confirmSchedule')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Help Tips Section */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                스케줄 관리 도움말
              </h3>
              <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                <li>• <strong>드래그 & 드롭</strong>: 셀을 클릭하고 드래그하여 여러 날짜에 동일한 근무 배정</li>
                <li>• <strong>자동 생성</strong>: AI가 팀 밸런스와 개인 선호도를 고려하여 최적 스케줄 생성</li>
                <li>• <strong>근무 교환</strong>: 직원 간 근무 교환 요청 및 승인 관리</li>
                <li>• <strong>팀 밸런스</strong>: 경력별, 역할별 균형 있는 팀 구성 확인</li>
              </ul>
            </div>
            <button
              onClick={(e) => {
                const target = e.currentTarget.parentElement?.parentElement;
                if (target) {
                  target.style.display = 'none';
                }
              }}
              className="text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Week Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousWeek}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {t('buttons.today', { ns: 'common' })}
              </button>
              <button
                onClick={handleNextWeek}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-medium text-gray-900">
                {format(currentWeek, "yyyy년 M월 d일", { locale: getLocale() })}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                viewMode === "week"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700"
              }`}
            >
              {t('viewMode.week')}
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                viewMode === "month"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700"
              }`}
            >
              {t('viewMode.month')}
            </button>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Schedule Board or Month View - Main Content */}
          <div className="lg:col-span-3">
            {viewMode === "week" ? (
              <ScheduleBoard
                staff={staff}
                schedule={schedule}
                currentWeek={currentWeek}
                onScheduleChange={setSchedule}
                isConfirmed={isConfirmed}
              />
            ) : (
              <MonthView
                staff={staff}
                schedule={schedule}
                currentMonth={currentWeek}
                onMonthChange={setCurrentWeek}
              />
            )}
          </div>

          {/* Side Panel */}
          <div className="lg:col-span-1 space-y-4">
            {/* Team Balance Indicator */}
            <StaffBalanceIndicator
              staff={staff}
              currentShift={viewMode === "week" ? "D" : undefined}
            />

            {/* Quick Actions */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                빠른 작업
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    // Example: Open swap modal for demonstration
                    if (staff.length > 0) {
                      setSwapModalData({
                        staffId: staff[0].id,
                        date: new Date(),
                        shift: "D"
                      });
                      setShowSwapModal(true);
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  근무 교환 요청
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  개인 선호 설정
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  변경 사항 알림
                </button>
              </div>
            </div>

            {/* Help Section */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                도움이 필요하신가요?
              </h3>
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                <a href="#" className="block hover:text-blue-600 dark:hover:text-blue-400">
                  → 스케줄 관리 가이드
                </a>
                <a href="#" className="block hover:text-blue-600 dark:hover:text-blue-400">
                  → 자동 생성 알고리즘 설명
                </a>
                <a href="#" className="block hover:text-blue-600 dark:hover:text-blue-400">
                  → 팀 밸런스 최적화 팁
                </a>
                <a href="#" className="block hover:text-blue-600 dark:hover:text-blue-400">
                  → 자주 묻는 질문
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Generation Metrics */}
        {generationMetrics && (
          <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10 rounded-xl border border-purple-100 dark:border-purple-900/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm dark:shadow-slate-900/50">
                  <Wand2 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{t('generation.success')}</p>
                  <p className="text-xs text-gray-600">
                    {t('generation.processingTime')}: {generationMetrics.processingTime}ms |
                    {t('generation.coverage')}: {Math.round(generationMetrics.coverageRate * 100)}% |
                    {t('generation.fairness')}: {Math.round(generationMetrics.distributionBalance * 100)}%
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGenerationMetrics(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t('stats.totalStaff')}</p>
                <p className="text-2xl font-semibold text-gray-900">{staff.length}</p>
              </div>
              <Users className="w-8 h-8 text-gray-300" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t('stats.dayShift')}</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {Object.values(schedule).reduce((acc, staffSchedule) => {
                    return acc + Object.values(staffSchedule).filter(s => s === "D").length;
                  }, 0)}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <span className="text-sm font-bold text-blue-600">D</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t('stats.nightShift')}</p>
                <p className="text-2xl font-semibold text-indigo-600">
                  {Object.values(schedule).reduce((acc, staffSchedule) => {
                    return acc + Object.values(staffSchedule).filter(s => s === "N").length;
                  }, 0)}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <span className="text-sm font-bold text-indigo-600">N</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t('stats.offDuty')}</p>
                <p className="text-2xl font-semibold text-gray-600">
                  {Object.values(schedule).reduce((acc, staffSchedule) => {
                    return acc + Object.values(staffSchedule).filter(s => s === "O").length;
                  }, 0)}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <span className="text-sm font-bold text-gray-500">O</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Shift Swap Modal */}
      {showSwapModal && swapModalData && (
        <ShiftSwapModal
          isOpen={showSwapModal}
          onClose={() => {
            setShowSwapModal(false);
            setSwapModalData(null);
          }}
          staff={staff}
          currentStaffId={swapModalData.staffId}
          currentDate={swapModalData.date}
          currentShift={swapModalData.shift as any}
          onSwapRequest={handleSwapRequest}
        />
      )}
    </div>
  );
}