import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Department {
  id: string;
  name: string;
}

interface MonthNavigationProps {
  monthStart: Date;
  departmentOptions: Department[];
  selectedDepartment: string;
  displayMembersCount: number;
  filteredMembersCount: number;
  selectedShiftTypesSize: number;
  isMember: boolean;
  onPreviousMonth: () => void;
  onThisMonth: () => void;
  onNextMonth: () => void;
  onDepartmentChange: (departmentId: string) => void;
}

export function MonthNavigation({
  monthStart,
  departmentOptions,
  selectedDepartment,
  displayMembersCount,
  filteredMembersCount,
  selectedShiftTypesSize,
  isMember,
  onPreviousMonth,
  onThisMonth,
  onNextMonth,
  onDepartmentChange,
}: MonthNavigationProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onPreviousMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={onThisMonth}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            이번 달
          </button>
          <button
            onClick={onNextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {format(monthStart, "yyyy년 M월")}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <select
          value={selectedDepartment}
          onChange={(e) => onDepartmentChange(e.target.value)}
          disabled={isMember}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 disabled:dark:bg-gray-800 disabled:dark:text-gray-500"
        >
          {departmentOptions.map(dept => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {displayMembersCount}명 {selectedShiftTypesSize > 0 && `(전체: ${filteredMembersCount}명)`}
        </span>
      </div>
    </div>
  );
}
