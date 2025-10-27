import React from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Users } from 'lucide-react';

interface Member {
  id: string;
  name: string;
  position?: string;
}

interface Assignment {
  employeeId: string;
  shiftId: string;
}

interface ScheduleGridViewProps {
  daysInMonth: Date[];
  displayMembers: Member[];
  selectedShiftTypesSize: number;
  scheduleGridTemplate: string;
  holidayDates: Set<string>;
  showCodeFormat?: boolean;
  getScheduleForDay: (date: Date) => Assignment[];
  getShiftColor: (shiftId: string) => string;
  getShiftName: (shiftId: string) => string;
  getShiftCode?: (shiftId: string) => string;
}

export function ScheduleGridView({
  daysInMonth,
  displayMembers,
  selectedShiftTypesSize,
  scheduleGridTemplate,
  holidayDates,
  showCodeFormat = false,
  getScheduleForDay,
  getShiftColor,
  getShiftName,
  getShiftCode,
}: ScheduleGridViewProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
      <div className="min-w-max">
        <div
          className="grid border-b border-gray-200 dark:border-gray-700"
          style={{ gridTemplateColumns: scheduleGridTemplate }}
        >
          <div className="p-2 bg-gray-50 dark:bg-gray-800 font-medium text-xs text-gray-700 dark:text-gray-300 flex items-center">
            직원
          </div>
          {daysInMonth.map((date) => {
            const dayOfWeek = date.getDay();
            const dateStr = format(date, 'yyyy-MM-dd');
            const isHoliday = holidayDates.has(dateStr);
            const isHolidayOrSunday = isHoliday || dayOfWeek === 0;

            return (
              <div
                key={date.toISOString()}
                className={`py-1 px-0.5 bg-gray-50 dark:bg-gray-800 text-center border-l border-gray-200 dark:border-gray-700 ${
                  isHoliday ? 'bg-red-50/30 dark:bg-red-900/10' : ''
                }`}
              >
                <div className={`font-medium text-[10px] ${
                  isHolidayOrSunday
                    ? 'text-red-500 dark:text-red-400'
                    : dayOfWeek === 6
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {format(date, 'EEE', { locale: ko }).slice(0, 1)}
                </div>
                <div className={`text-[9px] ${
                  isHolidayOrSunday
                    ? 'text-red-500 dark:text-red-400'
                    : dayOfWeek === 6
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {format(date, 'd')}
                </div>
              </div>
            );
          })}
        </div>

        <div>
          {displayMembers.map(member => (
            <div
              key={member.id}
              className="grid border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              style={{ gridTemplateColumns: scheduleGridTemplate }}
            >
              <div className="p-2 flex flex-col justify-center border-r border-gray-100 dark:border-gray-800">
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{member.name}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{member.position}</div>
              </div>

              {daysInMonth.map((date) => {
                const dayAssignments = getScheduleForDay(date).filter(a => a.employeeId === member.id);

                return (
                  <div
                    key={`${member.id}-${date.toISOString()}`}
                    className="p-0.5 border-l border-gray-100 dark:border-gray-800 flex items-center justify-center"
                  >
                    {dayAssignments.map((assignment, i) => {
                      const shiftDisplay = showCodeFormat && getShiftCode
                        ? getShiftCode(assignment.shiftId)
                        : getShiftName(assignment.shiftId).charAt(0);

                      return (
                        <div
                          key={i}
                          className="w-full px-0.5 py-1 rounded text-[9px] font-medium text-white text-center"
                          style={{ backgroundColor: getShiftColor(assignment.shiftId) }}
                          title={getShiftName(assignment.shiftId)}
                        >
                          {shiftDisplay}
                        </div>
                      );
                    })}
                    {dayAssignments.length === 0 && (
                      <div className="w-full px-0.5 py-1 text-[9px] text-gray-300 dark:text-gray-600 text-center">
                        -
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {displayMembers.length === 0 && (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {selectedShiftTypesSize > 0
                  ? '선택된 시프트 타입에 해당하는 직원이 없습니다'
                  : '선택된 부서에 활성 직원이 없습니다'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
