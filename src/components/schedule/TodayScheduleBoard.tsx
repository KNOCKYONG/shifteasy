"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Clock, Users, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, addDays, subDays, isToday, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { ko as koLocale, enUS as enLocale, ja as jaLocale } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import type { ShiftType } from '@/lib/utils/shift-utils';
import { api } from '@/lib/trpc/client';

interface Employee {
  id: string;
  name: string;
  teamId?: string | null;
}

interface ShiftAssignment {
  employeeId: string;
  shiftId: string;
  date: Date;
  shiftType?: string;
}

interface TodayScheduleBoardProps {
  employees: Employee[];
  assignments: ShiftAssignment[];
  shiftTypes: ShiftType[];
  today?: Date;
  onDateChange?: (date: Date) => void;
}

export function TodayScheduleBoard({
  employees,
  assignments,
  shiftTypes,
  today = new Date(),
  onDateChange,
}: TodayScheduleBoardProps) {
  const { t, i18n } = useTranslation('schedule');
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(today);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Get locale based on current language
  const dateLocale = i18n.language === 'ko' ? koLocale : i18n.language === 'ja' ? jaLocale : enLocale;

  // Fetch teams from database
  const { data: dbTeams = [] } = api.teams.getAll.useQuery(undefined, {
    staleTime: 10 * 60 * 1000, // 10분 동안 fresh 유지
    refetchOnWindowFocus: false, // 탭 전환 시 refetch 비활성화
  });

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCalendar]);

  // Update calendar month when today changes or calendar opens
  useEffect(() => {
    if (showCalendar) {
      setCalendarMonth(today);
    }
  }, [showCalendar, today]);

  // Filter assignments for today
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayAssignments = assignments.filter(
    (a) => format(a.date, 'yyyy-MM-dd') === todayStr
  );

  // Use DB teams or fallback to single team with "-"
  const teams = dbTeams.length > 0
    ? dbTeams.map(team => ({ id: team.id, code: team.code, name: team.name, color: team.color }))
    : [{ id: 'unassigned', code: '-', name: '-', color: '#6B7280' }];

  // Get unique shift types used in today's assignments (excluding 'A' and 'O')
  const usedShiftCodes = new Set(
    todayAssignments
      .map(a => a.shiftId.replace('shift-', '').toUpperCase())
      .filter(code => code !== 'A' && code !== 'O') // Exclude administrative and off shifts
  );

  // Get shift types for today, sorted by start time
  const todayShiftTypes = shiftTypes
    .filter(st => usedShiftCodes.has(st.code.toUpperCase()))
    .sort((a, b) => {
      // Convert time strings to comparable numbers (HH:MM -> HHMM)
      const timeA = parseInt(a.startTime.replace(':', ''));
      const timeB = parseInt(b.startTime.replace(':', ''));
      return timeA - timeB;
    });

  // Create shift groups dynamically from today's shift types
  const shiftGroups = todayShiftTypes.map(shift => ({
    label: `${shift.code}\n${shift.name}`,
    codes: [shift.code, shift.code.toLowerCase()],
    color: 'bg-gray-50',
    shift: shift,
  }));

  // Get employees working in each team/shift combination
  const getEmployeesForTeamAndShift = (teamId: string, shiftCodes: string[]) => {
    return todayAssignments
      .map((assignment) => {
        const employee = employees.find((e) => e.id === assignment.employeeId);
        // Match team: if team is 'unassigned', show employees with no teamId
        const teamMatches = teamId === 'unassigned'
          ? !employee?.teamId
          : employee?.teamId === teamId;
        if (!employee || !teamMatches) return null;

        // Extract shift code from shiftId (format: "shift-d", "shift-e", "shift-n")
        const shiftCode = assignment.shiftId.replace('shift-', '').toUpperCase();

        // Find matching shift type
        const shift = shiftTypes.find((s) => s.code.toUpperCase() === shiftCode);
        if (!shift) return null;

        // Check if shift code matches
        const matchesShift = shiftCodes.some(
          (code) => shift.code.toUpperCase() === code.toUpperCase() ||
                    assignment.shiftType?.toUpperCase() === code.toUpperCase()
        );
        if (!matchesShift) return null;

        return {
          employee,
          shift,
        };
      })
      .filter(Boolean) as Array<{ employee: Employee; shift: ShiftType }>;
  };

  const handlePreviousDay = () => {
    if (onDateChange) {
      onDateChange(subDays(today, 1));
    }
  };

  const handleNextDay = () => {
    if (onDateChange) {
      onDateChange(addDays(today, 1));
    }
  };

  const handleToday = () => {
    if (onDateChange) {
      onDateChange(new Date());
      setShowCalendar(false);
    }
  };

  const handleDateSelect = (date: Date) => {
    if (onDateChange) {
      onDateChange(date);
      setShowCalendar(false);
    }
  };

  // Generate calendar days
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const calendarStart = startOfWeek(monthStart, { locale: dateLocale });
  const calendarEnd = endOfWeek(monthEnd, { locale: dateLocale });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t('today.title')}</h2>
              <p className="text-sm text-blue-100 font-medium">{format(today, 'PPP', { locale: dateLocale })}</p>
            </div>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousDay}
              className="p-2.5 hover:bg-white/20 rounded-lg transition-all hover:scale-105 active:scale-95"
              title={i18n.language === 'ko' ? '이전 날' : i18n.language === 'ja' ? '前の日' : 'Previous day'}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="relative" ref={calendarRef}>
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-2 font-medium hover:scale-105 active:scale-95"
                title={i18n.language === 'ko' ? '날짜 선택' : i18n.language === 'ja' ? '日付選択' : 'Select date'}
              >
                <Calendar className="w-4 h-4" />
                <span className="text-sm">
                  {i18n.language === 'ko'
                    ? format(today, 'M월 d일(E)', { locale: dateLocale })
                    : i18n.language === 'ja'
                    ? format(today, 'M月d日(E)', { locale: dateLocale })
                    : format(today, 'MMM d (E)', { locale: dateLocale })
                  }
                </span>
              </button>

              {/* Calendar Popup */}
              {showCalendar && (
                <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div
                    className="p-4"
                    style={{ width: 'min(360px, calc(100vw - 2rem))' }}
                  >
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => setCalendarMonth(subDays(startOfMonth(calendarMonth), 1))}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                      </button>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {i18n.language === 'ko'
                          ? format(calendarMonth, 'yyyy년 MMMM', { locale: dateLocale })
                          : i18n.language === 'ja'
                          ? format(calendarMonth, 'yyyy年 MMMM', { locale: dateLocale })
                          : format(calendarMonth, 'MMMM yyyy', { locale: dateLocale })
                        }
                      </h3>
                      <button
                        onClick={() => setCalendarMonth(addDays(endOfMonth(calendarMonth), 1))}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="min-w-[320px]">
                        {/* Weekday Headers */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                          {(i18n.language === 'ko'
                            ? ['일', '월', '화', '수', '목', '금', '토']
                            : i18n.language === 'ja'
                            ? ['日', '月', '火', '水', '木', '金', '土']
                            : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
                          ).map((day, i) => (
                            <div key={i} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">
                              {day}
                            </div>
                          ))}
                        </div>

                        {/* Calendar Days */}
                        <div className="grid grid-cols-7 gap-1">
                          {calendarDays.map((day, i) => {
                            const isCurrentMonth = isSameMonth(day, calendarMonth);
                            const isSelected = isSameDay(day, today);
                            const isTodayDate = isToday(day);

                            return (
                              <button
                                key={i}
                                onClick={() => handleDateSelect(day)}
                                disabled={!isCurrentMonth}
                                className={`
                                  p-2 text-sm rounded-lg transition-all relative
                                  ${!isCurrentMonth ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : ''}
                                  ${isSelected ? 'bg-blue-600 text-white font-bold shadow-md scale-105' : ''}
                                  ${!isSelected && isCurrentMonth ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300' : ''}
                                  ${isTodayDate && !isSelected ? 'ring-2 ring-blue-400 dark:ring-blue-500' : ''}
                                `}
                              >
                                {format(day, 'd')}
                                {isTodayDate && !isSelected && (
                                  <span className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                      <button
                        onClick={handleToday}
                        className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        {i18n.language === 'ko' ? '오늘' : i18n.language === 'ja' ? '今日' : 'Today'}
                      </button>
                      <button
                        onClick={() => setShowCalendar(false)}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm font-medium"
                      >
                        {i18n.language === 'ko' ? '닫기' : i18n.language === 'ja' ? '閉じる' : 'Close'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleNextDay}
              className="p-2.5 hover:bg-white/20 rounded-lg transition-all hover:scale-105 active:scale-95"
              title={i18n.language === 'ko' ? '다음 날' : i18n.language === 'ja' ? '次の日' : 'Next day'}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Schedule Board - Team Cards */}
      <div className="p-4">
        {/* Desktop View - Table Layout */}
        <div className="hidden md:block">
          {/* Team Headers Row */}
          <div className="flex gap-3 mb-3 overflow-x-auto">
            {/* Empty space for shift time label */}
            <div className="min-w-[120px] flex-shrink-0">
              <div className="h-[72px] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('today.shiftTime')}</span>
              </div>
            </div>

            {/* Team Headers */}
            {teams.map((team) => {
            const teamEmployees = todayAssignments.filter((a) => {
              const emp = employees.find((e) => e.id === a.employeeId);
              const teamMatches = team.id === 'unassigned'
                ? !emp?.teamId
                : emp?.teamId === team.id;
              return teamMatches;
            });

            return (
              <div
                key={team.id}
                className="flex-1 min-w-[200px]"
              >
                <div
                  className="h-[72px] rounded-lg p-3 text-white text-center font-bold border-2 flex flex-col items-center justify-center"
                  style={{ backgroundColor: team.color, borderColor: team.color }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Users className="w-5 h-5" />
                    <span className="text-lg">{team.code}{t('today.team')}</span>
                  </div>
                  <div className="text-xs mt-1 opacity-90">
                    {teamEmployees.length}명
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Shift Rows */}
        {shiftGroups.length > 0 ? (
          shiftGroups.map((shiftGroup) => {
            return (
              <div key={shiftGroup.shift.code} className="flex gap-3 mb-3 overflow-x-auto items-stretch">
                {/* Shift Time Label */}
                <div className="min-w-[120px] flex-shrink-0">
                  <div
                    className={`h-full ${shiftGroup.color} dark:bg-gray-800 rounded-lg p-3 flex flex-col items-center justify-center border-2 border-gray-200 dark:border-gray-700`}
                    style={{ minHeight: '100px' }}
                  >
                    <div className="font-bold text-lg text-gray-900 dark:text-gray-100 text-center mb-1">
                      {shiftGroup.shift.code}
                    </div>
                    <div className="font-medium text-sm text-gray-800 dark:text-gray-200 text-center mb-1">
                      {shiftGroup.shift.name}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 text-center whitespace-nowrap">
                      {shiftGroup.shift.startTime} - {shiftGroup.shift.endTime}
                    </div>
                  </div>
                </div>

                {/* Team Shift Cells */}
                {teams.map((team) => {
                  const shiftEmployees = getEmployeesForTeamAndShift(team.id, shiftGroup.codes);

                  return (
                    <div
                      key={team.id}
                      className="flex-1 min-w-[200px]"
                    >
                      <div className="h-full bg-white dark:bg-gray-800 rounded-lg p-3 border-2 border-gray-200 dark:border-gray-700" style={{ minHeight: '100px' }}>
                        {/* Employees */}
                        <div className="space-y-1.5">
                          {shiftEmployees.length > 0 ? (
                            shiftEmployees.map(({ employee }) => (
                              <div
                                key={employee.id}
                                className="flex items-center p-2 bg-gray-50 dark:bg-gray-700 rounded shadow-sm"
                              >
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {employee.name}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="h-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500 py-8">
                              -
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">{t('today.noShifts')}</p>
          </div>
        )}
        </div>

        {/* Mobile View - Card Layout */}
        <div className="md:hidden space-y-4">
          {shiftGroups.length > 0 ? (
            shiftGroups.map((shiftGroup) => (
              <div key={shiftGroup.shift.code} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                {/* Shift Header */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {shiftGroup.shift.code}
                      </span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {shiftGroup.shift.name}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {shiftGroup.shift.startTime} - {shiftGroup.shift.endTime}
                    </div>
                  </div>
                </div>

                {/* Teams */}
                <div className="space-y-3">
                  {teams.map((team) => {
                    const shiftEmployees = getEmployeesForTeamAndShift(team.id, shiftGroup.codes);
                    if (shiftEmployees.length === 0) return null;

                    return (
                      <div key={team.id}>
                        {/* Team Header */}
                        <div
                          className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-white font-medium text-sm"
                          style={{ backgroundColor: team.color }}
                        >
                          <Users className="w-4 h-4" />
                          <span>{team.code}{t('today.team')}</span>
                          <span className="ml-auto text-xs opacity-90">
                            {shiftEmployees.length}명
                          </span>
                        </div>

                        {/* Employees */}
                        <div className="space-y-2 pl-2">
                          {shiftEmployees.map(({ employee }) => (
                            <div
                              key={employee.id}
                              className="flex items-center px-3 py-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600"
                            >
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {employee.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{t('today.noShifts')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer - Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-4 flex-wrap">
            {teams.map((team) => {
              const teamEmployees = todayAssignments.filter((a) => {
                const emp = employees.find((e) => e.id === a.employeeId);
                const teamMatches = team.id === 'unassigned'
                  ? !emp?.teamId
                  : emp?.teamId === team.id;
                return teamMatches;
              });

              return (
                <div key={team.id} className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="font-medium">{team.code}{t('today.team')}:</span>
                  <span>{teamEmployees.length}명</span>
                </div>
              );
            })}
          </div>
          <div className="font-medium">
            {t('today.totalWorking')}: {todayAssignments.length}명
          </div>
        </div>
      </div>
    </div>
  );
}
