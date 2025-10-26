"use client";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, getDay, isToday, isSameMonth, startOfWeek, endOfWeek } from "date-fns";
import { eachDayOfInterval } from "date-fns/eachDayOfInterval";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type Staff, type ShiftType, type WeekSchedule } from "@/lib/types";
import { api } from "@/lib/trpc/client";

const SHIFT_BADGES = {
  D: { bg: "bg-blue-100 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-300" },
  E: { bg: "bg-amber-100 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-300" },
  N: { bg: "bg-indigo-100 dark:bg-indigo-900/20", text: "text-indigo-700 dark:text-indigo-300" },
  O: { bg: "bg-gray-100 dark:bg-gray-900/20", text: "text-gray-600 dark:text-gray-400" },
};

interface MonthViewProps {
  staff: Staff[];
  schedule: WeekSchedule;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}

export function MonthView({ staff, schedule, currentMonth, onMonthChange }: MonthViewProps) {
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Fetch holidays for the visible date range
  const { data: holidays } = api.holidays.getByDateRange.useQuery({
    startDate: format(calendarStart, 'yyyy-MM-dd'),
    endDate: format(calendarEnd, 'yyyy-MM-dd'),
  });

  // Create a Set of holiday dates for quick lookup
  const holidayDates = useMemo(() => {
    if (!holidays) return new Set<string>();
    return new Set(holidays.map(h => h.date));
  }, [holidays]);

  // Check if a date is a holiday
  const isHoliday = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidayDates.has(dateStr);
  };

  const handlePreviousMonth = () => {
    onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const getShiftForDay = (staffId: string, date: Date): ShiftType | null => {
    const dayOfWeek = getDay(date);
    return schedule[staffId]?.[dayOfWeek] || null;
  };

  const getStaffCountByShift = (date: Date): Record<ShiftType, number> => {
    const counts: Record<ShiftType, number> = { D: 0, E: 0, N: 0, O: 0 };
    staff.forEach(member => {
      const shift = getShiftForDay(member.id, date);
      if (shift) counts[shift]++;
    });
    return counts;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 border border-gray-100 dark:border-slate-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePreviousMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {format(currentMonth, "yyyy'년' M'월'")}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Staff Filter */}
          <select
            value={selectedStaff || ""}
            onChange={(e) => setSelectedStaff(e.target.value || null)}
            className="px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
          >
            <option value="">전체 보기</option>
            {staff.map(member => (
              <option key={member.id} value={member.id}>
                {member.name} ({member.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
            <div
              key={day}
              className={`text-center text-xs font-medium py-2 ${
                i === 0 ? "text-red-500 dark:text-red-400" : i === 6 ? "text-blue-500 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((date) => {
            const dayOfWeek = getDay(date);
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isHolidayDate = isHoliday(date);
            const shiftCounts = getStaffCountByShift(date);

            return (
              <div
                key={date.toISOString()}
                className={`
                  min-h-[100px] p-2 rounded-lg border transition-all
                  ${isCurrentMonth ? "bg-white dark:bg-slate-800" : "bg-gray-50 dark:bg-slate-900/50"}
                  ${isToday(date) ? "border-blue-400 dark:border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/30" : "border-gray-200 dark:border-slate-700"}
                  ${isWeekend && isCurrentMonth ? "bg-blue-50/30 dark:bg-blue-900/10" : ""}
                  ${isHolidayDate && isCurrentMonth ? "bg-red-50/30 dark:bg-red-900/10" : ""}
                  hover:shadow-md dark:hover:shadow-slate-900/50 cursor-pointer
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${
                    !isCurrentMonth ? "text-gray-400 dark:text-gray-600" :
                    isHolidayDate || dayOfWeek === 0 ? "text-red-500 dark:text-red-400" :
                    dayOfWeek === 6 ? "text-blue-500 dark:text-blue-400" :
                    "text-gray-900 dark:text-white"
                  }`}>
                    {format(date, "d")}
                  </span>
                  {isToday(date) && (
                    <span className="text-xs bg-blue-500 dark:bg-blue-600 text-white px-1.5 py-0.5 rounded">
                      오늘
                    </span>
                  )}
                </div>

                {/* Shift Summary or Individual Staff */}
                {selectedStaff ? (
                  // Show selected staff's shift
                  <div className="mt-2">
                    {(() => {
                      const shift = getShiftForDay(selectedStaff, date);
                      const member = staff.find(s => s.id === selectedStaff);
                      if (!shift || !member) return null;

                      return (
                        <div className={`text-xs px-2 py-1 rounded ${SHIFT_BADGES[shift].bg} ${SHIFT_BADGES[shift].text}`}>
                          {shift === "D" ? "주간" : shift === "E" ? "저녁" : shift === "N" ? "야간" : "휴무"}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  // Show shift counts
                  <div className="space-y-1">
                    {(["D", "E", "N"] as ShiftType[]).map(shift => {
                      const count = shiftCounts[shift];
                      if (count === 0) return null;

                      return (
                        <div
                          key={shift}
                          className={`flex items-center justify-between text-xs px-2 py-0.5 rounded ${
                            SHIFT_BADGES[shift].bg
                          }`}
                        >
                          <span className={SHIFT_BADGES[shift].text}>
                            {shift === "D" ? "주" : shift === "E" ? "저" : "야"}
                          </span>
                          <span className={`font-medium ${SHIFT_BADGES[shift].text}`}>
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 bg-gray-50/50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-100 dark:bg-blue-900/30 rounded" />
              <span className="text-gray-600 dark:text-gray-400">주간</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-amber-100 dark:bg-amber-900/30 rounded" />
              <span className="text-gray-600 dark:text-gray-400">저녁</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-indigo-100 dark:bg-indigo-900/30 rounded" />
              <span className="text-gray-600 dark:text-gray-400">야간</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-100 dark:bg-gray-800 rounded" />
              <span className="text-gray-600 dark:text-gray-400">휴무</span>
            </div>
          </div>

          {!selectedStaff && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              총 {staff.length}명 근무 중
            </div>
          )}
        </div>
      </div>
    </div>
  );
}