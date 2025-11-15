import React from 'react';

interface Shift {
  id: string;
  name: string;
  type: string;
  code?: string;
  color: string;
}

interface Assignment {
  shiftId: string;
}

interface ScheduleStatsProps {
  schedule: Assignment[];
  shifts: Shift[];
}

export const ScheduleStats = React.memo(function ScheduleStats({ schedule, shifts }: ScheduleStatsProps) {
  const shiftCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    schedule.forEach((assignment) => {
      counts.set(assignment.shiftId, (counts.get(assignment.shiftId) ?? 0) + 1);
    });
    return counts;
  }, [schedule]);

  if (schedule.length === 0) return null;

  return (
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {shifts.map((shift, index) => {
        const count = shiftCounts.get(shift.id) ?? 0;
        const shiftCode = shift.code || shift.type || shift.id.replace('shift-', '').toUpperCase();
        return (
          <div
            key={`schedule-stats-${shift.id}-${index}`}
            className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold" style={{ color: shift.color }}>
                  {count}
                </p>
              </div>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: shift.color }}
              >
                {shiftCode}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});
