import React from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';

interface Member {
  id: string;
  name: string;
  position?: string;
}

interface Assignment {
  employeeId: string;
  shiftId: string;
}

interface CurrentUser {
  dbUser?: {
    id: string;
  } | null;
}

interface ScheduleCalendarViewProps {
  currentMonth: Date;
  displayMembers: Member[];
  holidayDates: Set<string>;
  showSameSchedule: boolean;
  currentUser: CurrentUser;
  getScheduleForDay: (date: Date) => Assignment[];
  getShiftColor: (shiftId: string) => string;
  getShiftName: (shiftId: string) => string;
}

export function ScheduleCalendarView({
  currentMonth,
  displayMembers,
  holidayDates,
  showSameSchedule,
  currentUser,
  getScheduleForDay,
  getShiftColor,
  getShiftName,
}: ScheduleCalendarViewProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
      {/* Calendar Header - Days of Week */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
          <div key={i} className="text-center font-medium text-sm text-gray-700 dark:text-gray-300 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((date) => {
          const isCurrentMonth = date >= monthStart && date <= monthEnd;
          const dateStr = format(date, 'yyyy-MM-dd');
          const dayOfWeek = date.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isHoliday = holidayDates.has(dateStr);
          const isHolidayOrSunday = isHoliday || dayOfWeek === 0;

          // Get all assignments for this date
          const dayAssignments = getScheduleForDay(date);

          // Filter by showSameSchedule if enabled
          let filteredAssignments = dayAssignments;
          if (showSameSchedule && currentUser.dbUser?.id) {
            // Get current user's shift for this date
            const myShift = dayAssignments.find(a => a.employeeId === currentUser.dbUser?.id);
            if (myShift && myShift.shiftId !== 'shift-off') {
              // Show only people with the same shift
              filteredAssignments = dayAssignments.filter(a => a.shiftId === myShift.shiftId);
            } else {
              filteredAssignments = [];
            }
          }

          return (
            <div
              key={dateStr}
              className={`min-h-[100px] border rounded-lg p-2 ${
                isCurrentMonth
                  ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800'
              } ${isHoliday && isCurrentMonth ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}
            >
              <div className={`text-sm font-medium mb-1 ${
                !isCurrentMonth
                  ? 'text-gray-400 dark:text-gray-600'
                  : isHolidayOrSunday
                    ? 'text-red-500 dark:text-red-400'
                    : dayOfWeek === 6
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-gray-900 dark:text-gray-100'
              }`}>
                {format(date, 'd')}
              </div>

              <div className="space-y-1">
                {filteredAssignments.map((assignment, i) => {
                  const member = displayMembers.find(m => m.id === assignment.employeeId);
                  if (!member) return null;

                  return (
                    <div
                      key={i}
                      className="text-[10px] px-1 py-0.5 rounded text-white truncate"
                      style={{ backgroundColor: getShiftColor(assignment.shiftId) }}
                      title={`${member.name} - ${getShiftName(assignment.shiftId)}`}
                    >
                      {member.name} {getShiftName(assignment.shiftId)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
