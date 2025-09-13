"use client";
import { useState, useEffect } from "react";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { ko, enUS, ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Users, Settings, Download, Lock, Unlock, Wand2, RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScheduleBoard } from "@/components/schedule/ScheduleBoard";
import { MonthView } from "@/components/schedule/MonthView";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { type Staff, type WeekSchedule } from "@/lib/types";
import { loadCurrentTeam } from "@/lib/teamStorage";
import { ProfileDropdown } from "@/components/ProfileDropdown";

export default function SchedulePage() {
  const { t, i18n } = useTranslation(['schedule', 'common']);
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [staff, setStaff] = useState<Staff[]>([]);
  const [schedule, setSchedule] = useState<WeekSchedule>({});
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMetrics, setGenerationMetrics] = useState<any>(null);

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
      const response = await fetch("/api/schedule/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: currentWeek.toISOString(),
          teamData: teamData,
          config: {
            maxConsecutiveDays: 5,
            minRestHours: 11,
            maxWeeklyHours: 52,
            minStaffPerShift: { D: 3, E: 2, N: 2, O: 0 },
            fairnessWeight: 0.7,
            preferenceWeight: 0.3,
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
      if (result.metrics.processingTime < 5000) {
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <a href="/dashboard" className="text-xl font-semibold text-gray-900 dark:text-white hover:text-blue-600 transition-colors">
                {t('app.name', { ns: 'common' })}
              </a>
              <nav className="flex items-center gap-6">
                <a href="/schedule" className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {t('nav.schedule', { ns: 'common' })}
                </a>
                <a href="/team" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                  {t('nav.team', { ns: 'common' })}
                </a>
                <a href="/config" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                  {t('nav.config', { ns: 'common' })}
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <NotificationCenter userId="dev-user-id" />
              <ProfileDropdown />

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

              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
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
        {/* Week Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousWeek}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('buttons.today', { ns: 'common' })}
              </button>
              <button
                onClick={handleNextWeek}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t('viewMode.week')}
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                viewMode === "month"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t('viewMode.month')}
            </button>
          </div>
        </div>

        {/* Schedule Board or Month View */}
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

        {/* Generation Metrics */}
        {generationMetrics && (
          <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
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
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t('stats.totalStaff')}</p>
                <p className="text-2xl font-semibold text-gray-900">{staff.length}</p>
              </div>
              <Users className="w-8 h-8 text-gray-300" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
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

          <div className="bg-white rounded-xl border border-gray-100 p-4">
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

          <div className="bg-white rounded-xl border border-gray-100 p-4">
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
    </div>
  );
}