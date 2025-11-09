'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Heart, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ViewTabsProps {
  activeView: 'preferences' | 'today' | 'schedule' | 'calendar';
  canViewStaffPreferences: boolean;
  onViewChange: (view: 'preferences' | 'today' | 'schedule' | 'calendar') => void;
}

export function ViewTabs({ activeView, canViewStaffPreferences, onViewChange }: ViewTabsProps) {
  const { t } = useTranslation('schedule');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [displayedView, setDisplayedView] = React.useState<ViewTabsProps['activeView']>(activeView);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    setDisplayedView(activeView);
  }, [activeView]);

  // Handle tab change with URL update
  const handleViewChange = (view: 'preferences' | 'today' | 'schedule' | 'calendar') => {
    // Optimistically update tab highlight for snappy feedback
    setDisplayedView(view);

    // Update URL parameters to enable navigation
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);

    // Push new URL to enable browser back/forward and navigation
    router.push(`/schedule?${params.toString()}`, { scroll: false });

    // Defer heavy view switching work
    startTransition(() => {
      onViewChange(view);
    });
  };

  return (
    <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
      <nav className="flex flex-wrap gap-2 sm:flex-nowrap sm:gap-4 md:gap-8">
        {canViewStaffPreferences && (
          <button
            onClick={() => handleViewChange('preferences')}
            className={`pb-3 px-1 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
              displayedView === 'preferences'
                ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <Heart className="w-4 h-4" />
            {t('views.preferences')}
          </button>
        )}
        <button
          onClick={() => handleViewChange('today')}
          className={`pb-3 px-1 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
            displayedView === 'today'
              ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
              : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <Clock className="w-4 h-4" />
          {t('views.today')}
        </button>
        <button
          onClick={() => handleViewChange('schedule')}
          className={`pb-3 px-1 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
            displayedView === 'schedule'
              ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
              : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <Calendar className="w-4 h-4" />
          {t('views.schedule')}
        </button>
      </nav>
    </div>
  );
}
