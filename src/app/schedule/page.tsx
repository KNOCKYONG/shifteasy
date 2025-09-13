"use client";
import { useState, useEffect } from "react";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Users, Settings, Download, Lock, Unlock } from "lucide-react";
import { ScheduleBoard } from "@/components/schedule/ScheduleBoard";
import { MonthView } from "@/components/schedule/MonthView";
import { type Staff, type WeekSchedule } from "@/lib/types";
import { loadCurrentTeam } from "@/lib/teamStorage";

export default function SchedulePage() {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [staff, setStaff] = useState<Staff[]>([]);
  const [schedule, setSchedule] = useState<WeekSchedule>({});
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");

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
        alert("스케줄을 먼저 작성해주세요.");
        return;
      }
    }
    setIsConfirmed(!isConfirmed);
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-semibold text-gray-900">ShiftEasy</h1>
              <nav className="flex items-center gap-6">
                <a href="/schedule" className="text-sm font-medium text-blue-600">
                  스케줄
                </a>
                <a href="/team" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                  팀 관리
                </a>
                <a href="/config" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                  설정
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                내보내기
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
                    확정됨
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    확정하기
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
                오늘
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
                {format(currentWeek, "yyyy년 M월 d일", { locale: ko })} 주
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
              주간
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                viewMode === "month"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              월간
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

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">총 직원</p>
                <p className="text-2xl font-semibold text-gray-900">{staff.length}</p>
              </div>
              <Users className="w-8 h-8 text-gray-300" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">주간 근무</p>
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
                <p className="text-sm text-gray-500">야간 근무</p>
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
                <p className="text-sm text-gray-500">휴무</p>
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