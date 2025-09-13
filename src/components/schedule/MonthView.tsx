"use client";
import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isSameMonth, startOfWeek, endOfWeek } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type Staff, type ShiftType, type WeekSchedule } from "@/lib/types";

const SHIFT_BADGES = {
  D: { bg: "bg-blue-100", text: "text-blue-700" },
  E: { bg: "bg-amber-100", text: "text-amber-700" },
  N: { bg: "bg-indigo-100", text: "text-indigo-700" },
  O: { bg: "bg-gray-100", text: "text-gray-600" },
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePreviousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900">
              {format(currentMonth, "yyyy년 M월", { locale: ko })}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Staff Filter */}
          <select
            value={selectedStaff || ""}
            onChange={(e) => setSelectedStaff(e.target.value || null)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-600"
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
            const shiftCounts = getStaffCountByShift(date);

            return (
              <div
                key={date.toISOString()}
                className={`
                  min-h-[100px] p-2 rounded-lg border transition-all
                  ${isCurrentMonth ? "bg-white" : "bg-gray-50"}
                  ${isToday(date) ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200"}
                  ${isWeekend && isCurrentMonth ? "bg-blue-50/30" : ""}
                  hover:shadow-md cursor-pointer
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${
                    !isCurrentMonth ? "text-gray-400" :
                    isWeekend ? (dayOfWeek === 0 ? "text-red-500" : "text-blue-500") :
                    "text-gray-900"
                  }`}>
                    {format(date, "d")}
                  </span>
                  {isToday(date) && (
                    <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">
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
      <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-100 rounded" />
              <span className="text-gray-600">주간</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-amber-100 rounded" />
              <span className="text-gray-600">저녁</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-indigo-100 rounded" />
              <span className="text-gray-600">야간</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-100 rounded" />
              <span className="text-gray-600">휴무</span>
            </div>
          </div>

          {!selectedStaff && (
            <div className="text-xs text-gray-500">
              총 {staff.length}명 근무 중
            </div>
          )}
        </div>
      </div>
    </div>
  );
}