"use client";

import React from 'react';
import { Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ko as koLocale, enUS as enLocale, ja as jaLocale } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import type { ShiftType } from '@/lib/utils/shift-utils';
import { api } from '@/lib/trpc/client';

interface Employee {
  id: string;
  name: string;
  profile?: {
    team?: string;
  };
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
}

export function TodayScheduleBoard({
  employees,
  assignments,
  shiftTypes,
  today = new Date(),
}: TodayScheduleBoardProps) {
  const { t, i18n } = useTranslation('schedule');

  // Get locale based on current language
  const dateLocale = i18n.language === 'ko' ? koLocale : i18n.language === 'ja' ? jaLocale : enLocale;

  // Fetch teams from database
  const { data: dbTeams = [] } = api.teams.getAll.useQuery();

  // Filter assignments for today
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayAssignments = assignments.filter(
    (a) => format(a.date, 'yyyy-MM-dd') === todayStr
  );

  // Use DB teams or fallback to single team with "-"
  const teams = dbTeams.length > 0
    ? dbTeams.map(team => ({ code: team.code, name: team.name, color: team.color }))
    : [{ code: '-', name: '-', color: '#6B7280' }];

  // Group shift types by time of day (오전/D, 오후/E, 야간/N)
  const shiftGroups = [
    { label: t('today.morning'), codes: ['D', 'day'], color: 'bg-yellow-50' },
    { label: t('today.afternoon'), codes: ['E', 'evening'], color: 'bg-orange-50' },
    { label: t('today.night'), codes: ['N', 'night'], color: 'bg-indigo-50' },
  ];

  // Get employees working in each team/shift combination
  const getEmployeesForTeamAndShift = (team: string, shiftCodes: string[]) => {
    return todayAssignments
      .map((assignment) => {
        const employee = employees.find((e) => e.id === assignment.employeeId);
        if (!employee || employee.profile?.team !== team) return null;

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

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6" />
          <div>
            <h2 className="text-xl font-bold">{t('today.title')}</h2>
            <p className="text-sm text-blue-100">{format(today, 'PPP', { locale: dateLocale })}</p>
          </div>
        </div>
      </div>

      {/* Schedule Board - Team Cards */}
      <div className="p-4">
        <div className="flex gap-3 overflow-x-auto">
          {/* Shift Time Labels Column */}
          <div className="flex flex-col gap-0 min-w-[120px] flex-shrink-0">
            {/* Empty Header Space */}
            <div className="h-[72px] bg-gray-100 dark:bg-gray-800 rounded-lg mb-3 flex items-center justify-center">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('today.shiftTime')}</span>
            </div>

            {/* Shift Time Labels */}
            {shiftGroups.map((shiftGroup) => {
              const shiftTime = shiftTypes.find((s) => shiftGroup.codes.includes(s.code));
              return (
                <div
                  key={shiftGroup.label}
                  className={`flex-1 ${shiftGroup.color} dark:bg-gray-800 rounded-lg p-3 flex flex-col items-center justify-center mb-3 last:mb-0 border-2 border-gray-200 dark:border-gray-700`}
                  style={{ minHeight: '120px' }}
                >
                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-center">
                    {shiftGroup.label}
                  </div>
                  {shiftTime && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 text-center">
                      {shiftTime.startTime}-{shiftTime.endTime}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Team Columns */}
          {teams.map((team) => {
            const teamEmployees = todayAssignments.filter((a) => {
              const emp = employees.find((e) => e.id === a.employeeId);
              return emp?.profile?.team === team.code;
            });

            return (
              <div
                key={team.code}
                className="flex flex-col gap-0 flex-1 min-w-[200px]"
              >
                {/* Team Header */}
                <div
                  className="h-[72px] rounded-lg mb-3 p-3 text-white text-center font-bold border-2 flex flex-col items-center justify-center"
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

                {/* Shift Sections */}
                {shiftGroups.map((shiftGroup) => {
                  const shiftEmployees = getEmployeesForTeamAndShift(team.code, shiftGroup.codes);

                  return (
                    <div
                      key={shiftGroup.label}
                      className="flex-1 bg-white dark:bg-gray-800 rounded-lg p-3 mb-3 last:mb-0 border-2 border-gray-200 dark:border-gray-700"
                      style={{ minHeight: '120px' }}
                    >
                      {/* Employees */}
                      <div className="space-y-1">
                        {shiftEmployees.length > 0 ? (
                          shiftEmployees.map(({ employee, shift }) => (
                            <div
                              key={employee.id}
                              className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded shadow-sm"
                            >
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: shift.color }}
                              />
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {employee.name}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                            -
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer - Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-4 flex-wrap">
            {teams.map((team) => {
              const teamEmployees = todayAssignments.filter((a) => {
                const emp = employees.find((e) => e.id === a.employeeId);
                return emp?.profile?.team === team.code;
              });

              return (
                <div key={team.code} className="flex items-center gap-1">
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
