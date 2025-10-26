import React from 'react';
import { Calendar, Heart } from 'lucide-react';

interface ViewTabsProps {
  activeView: 'preferences' | 'schedule';
  canViewStaffPreferences: boolean;
  onViewChange: (view: 'preferences' | 'schedule') => void;
}

export function ViewTabs({ activeView, canViewStaffPreferences, onViewChange }: ViewTabsProps) {
  return (
    <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
      <nav className="flex flex-wrap gap-2 sm:flex-nowrap sm:gap-4 md:gap-8">
        {canViewStaffPreferences && (
          <button
            onClick={() => onViewChange('preferences')}
            className={`pb-3 px-1 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
              activeView === 'preferences'
                ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <Heart className="w-4 h-4" />
            <span className="hidden sm:inline">직원 </span>선호사항
          </button>
        )}
        <button
          onClick={() => onViewChange('schedule')}
          className={`pb-3 px-1 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
            activeView === 'schedule'
              ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
              : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <Calendar className="w-4 h-4" />
          스케줄<span className="hidden sm:inline"> 보기</span>
        </button>
      </nav>
    </div>
  );
}
