import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';

interface MonthNavigationProps {
  monthStart: Date;
  displayMembersCount: number;
  filteredMembersCount: number;
  selectedShiftTypesSize: number;
  isMember: boolean;
  swapMode?: boolean;
  hasSchedule?: boolean;
  onPreviousMonth: () => void;
  onThisMonth: () => void;
  onNextMonth: () => void;
  onToggleSwapMode?: () => void;
}

export const MonthNavigation = React.memo(function MonthNavigation({
  monthStart,
  displayMembersCount,
  filteredMembersCount,
  selectedShiftTypesSize,
  isMember,
  swapMode,
  hasSchedule,
  onPreviousMonth,
  onThisMonth,
  onNextMonth,
  onToggleSwapMode,
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
        {isMember && hasSchedule && (
          <button
            onClick={onToggleSwapMode}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              swapMode
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title="스케줄 교환 모드"
          >
            <ArrowLeftRight className="w-4 h-4" />
            {swapMode ? '교환 모드 종료' : '스케줄 교환'}
          </button>
        )}
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {displayMembersCount}명 {selectedShiftTypesSize > 0 && `(전체: ${filteredMembersCount}명)`}
        </span>
      </div>
    </div>
  );
});
