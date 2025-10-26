import React from 'react';
import { Calendar } from 'lucide-react';

interface Shift {
  id: string;
  name: string;
  type: string;
  color: string;
}

interface Assignment {
  shiftId: string;
}

interface ScheduleStatsProps {
  schedule: Assignment[];
  shifts: Shift[];
}

export function ScheduleStats({ schedule, shifts }: ScheduleStatsProps) {
  if (schedule.length === 0) return null;

  return (
    <div className="mt-6 grid grid-cols-4 gap-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">총 배정</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{schedule.length}</p>
          </div>
          <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600" />
        </div>
      </div>

      {shifts.map(shift => {
        const count = schedule.filter(a => a.shiftId === shift.id).length;
        return (
          <div key={shift.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{shift.name}</p>
                <p className="text-2xl font-semibold" style={{ color: shift.color }}>
                  {count}
                </p>
              </div>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: shift.color }}
              >
                {shift.type[0].toUpperCase()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
