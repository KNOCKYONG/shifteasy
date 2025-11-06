import React from 'react';
import { Users, ListChecks, Calendar } from 'lucide-react';

interface ViewTogglesProps {
  isMember: boolean;
  isManager: boolean;
  showMyScheduleOnly: boolean;
  showSameSchedule: boolean;
  viewMode: 'grid' | 'calendar';
  onToggleMySchedule: (value: boolean) => void;
  onToggleSameSchedule: (value: boolean) => void;
  onToggleViewMode: (mode: 'grid' | 'calendar') => void;
}

export function ViewToggles({
  isMember,
  isManager,
  showMyScheduleOnly,
  showSameSchedule,
  viewMode,
  onToggleMySchedule,
  onToggleSameSchedule,
  onToggleViewMode,
}: ViewTogglesProps) {
  return (
    <div className="mb-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700 flex flex-col md:flex-row">
      {/* 나의 스케줄만 보기 토글 - member/manager만 표시 */}
      {(isMember || isManager) && (
        <div className={`flex-1 p-3 transition-opacity ${showSameSchedule ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className={`w-4 h-4 ${showSameSchedule ? 'text-gray-400 dark:text-gray-600' : 'text-blue-600 dark:text-blue-400'}`} />
              <span className={`text-sm font-medium ${showSameSchedule ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                나의 스케줄만 보기
              </span>
            </div>
            <button
              onClick={() => {
                if (!showSameSchedule) {
                  onToggleMySchedule(!showMyScheduleOnly);
                }
              }}
              disabled={showSameSchedule}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                showSameSchedule
                  ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed'
                  : showMyScheduleOnly
                    ? 'bg-blue-600'
                    : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showMyScheduleOnly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {showSameSchedule
              ? '※ 나와 같은 스케줄 보기가 활성화되어 있습니다.'
              : showMyScheduleOnly
                ? '현재 나의 스케줄만 표시됩니다.'
                : '같은 부서의 모든 스케줄을 표시합니다.'}
          </p>
        </div>
      )}

      {/* 나와 같은 스케줄 보기 토글 - member/manager만 표시 */}
      {(isMember || isManager) && (
        <div className={`flex-1 p-3 transition-opacity ${showMyScheduleOnly ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className={`w-4 h-4 ${showMyScheduleOnly ? 'text-gray-400 dark:text-gray-600' : 'text-green-600 dark:text-green-400'}`} />
              <span className={`text-sm font-medium ${showMyScheduleOnly ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                나와 같은 스케줄 보기
              </span>
            </div>
            <button
              onClick={() => {
                if (!showMyScheduleOnly) {
                  onToggleSameSchedule(!showSameSchedule);
                }
              }}
              disabled={showMyScheduleOnly}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                showMyScheduleOnly
                  ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed'
                  : showSameSchedule
                    ? 'bg-green-600'
                    : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showSameSchedule ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {showMyScheduleOnly
              ? '※ 나의 스케줄만 보기가 활성화되어 있습니다.'
              : showSameSchedule
                ? '나와 같은 날 근무하는 직원만 캘린더로 표시됩니다.'
                : '같은 부서의 모든 스케줄을 표시합니다.'}
          </p>
        </div>
      )}

      {/* 캘린더 형식으로 보기 토글 */}
      <div className={`flex-1 p-3 transition-opacity ${showSameSchedule ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className={`w-4 h-4 ${showSameSchedule ? 'text-gray-400 dark:text-gray-600' : 'text-purple-600 dark:text-purple-400'}`} />
            <span className={`text-sm font-medium ${showSameSchedule ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
              캘린더 형식으로 보기
            </span>
          </div>
          <button
            onClick={() => {
              if (!showSameSchedule) {
                onToggleViewMode(viewMode === 'grid' ? 'calendar' : 'grid');
              }
            }}
            disabled={showSameSchedule}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
              showSameSchedule
                ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed'
                : viewMode === 'calendar'
                  ? 'bg-purple-600'
                  : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                viewMode === 'calendar' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {showSameSchedule
            ? '※ 나와 같은 스케줄 보기가 활성화되어 있습니다.'
            : viewMode === 'calendar'
              ? '캘린더 형식으로 표시됩니다.'
              : '그리드 형식으로 표시됩니다.'}
        </p>
      </div>

    </div>
  );
}
