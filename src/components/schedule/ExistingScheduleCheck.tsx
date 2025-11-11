'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/trpc/client';
import { Calendar, AlertCircle, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ExistingScheduleCheckProps {
  departmentId: string;
  startDate: Date;
  endDate: Date;
  onSelectExisting?: (scheduleId: string) => void;
  onCreateNew?: () => void;
}

export default function ExistingScheduleCheck({
  departmentId,
  startDate,
  endDate,
  onSelectExisting,
  onCreateNew,
}: ExistingScheduleCheckProps) {
  const [selectedOption, setSelectedOption] = useState<'existing' | 'new' | null>(null);

  // Check for existing published schedules
  const { data: existingData, isLoading } = api.schedule.checkExisting.useQuery(
    {
      departmentId,
      startDate,
      endDate,
    },
    {
      enabled: !!departmentId && !!startDate && !!endDate,
    }
  );

  const hasExisting = existingData?.hasExisting || false;
  const existingSchedules = existingData?.schedules || [];

  useEffect(() => {
    // Reset selection when dates change
    setSelectedOption(null);
  }, [startDate, endDate, departmentId]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          <span className="text-gray-600 dark:text-gray-400">기존 스케줄 확인 중...</span>
        </div>
      </div>
    );
  }

  if (!hasExisting) {
    return (
      <div className="bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-green-900 dark:text-green-100 mb-1">
              새 스케줄 생성 가능
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300">
              해당 기간에 확정된 스케줄이 없습니다. 새로운 스케줄을 생성할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800 p-6">
      <div className="flex items-start gap-3 mb-4">
        <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
            기존 확정된 스케줄이 있습니다
          </h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            선택한 기간에 이미 {existingSchedules.length}개의 확정된 스케줄이 있습니다.
            기존 스케줄을 사용하거나 새로운 스케줄을 추가로 생성할 수 있습니다.
          </p>
        </div>
      </div>

      {/* Existing Schedules List */}
      <div className="space-y-3 mb-4">
        {existingSchedules.map((schedule) => (
          <div
            key={schedule.id}
            className={`bg-white dark:bg-gray-800 rounded-lg border-2 transition-colors cursor-pointer ${
              selectedOption === 'existing'
                ? 'border-blue-500 dark:border-blue-400'
                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
            onClick={() => {
              setSelectedOption('existing');
              onSelectExisting?.(schedule.id);
            }}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {format(new Date(schedule.startDate), 'yyyy년 M월 d일', { locale: ko })} -
                    {format(new Date(schedule.endDate), 'M월 d일', { locale: ko })}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  버전 {schedule.version}
                </span>
              </div>

              {schedule.publishedAt && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    확정: {format(new Date(schedule.publishedAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                  </span>
                </div>
              )}

              {schedule.metadata && (schedule.metadata as { stats?: { totalShifts?: number; averageHours?: number } }).stats && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div>
                      <span className="font-medium">총 근무:</span>{' '}
                      {(schedule.metadata as { stats?: { totalShifts?: number; averageHours?: number } }).stats?.totalShifts || 0}회
                    </div>
                    <div>
                      <span className="font-medium">평균 시간:</span>{' '}
                      {(schedule.metadata as { stats?: { totalShifts?: number; averageHours?: number } }).stats?.averageHours || 0}h
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create New Option */}
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg border-2 transition-colors cursor-pointer ${
          selectedOption === 'new'
            ? 'border-blue-500 dark:border-blue-400'
            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
        }`}
        onClick={() => {
          setSelectedOption('new');
          onCreateNew?.();
        }}
      >
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                새 스케줄 추가 생성
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                기존 스케줄과 별도로 새로운 스케줄 생성
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedOption && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {selectedOption === 'existing'
              ? '✓ 기존 스케줄을 사용합니다. 해당 스케줄의 데이터를 불러옵니다.'
              : '✓ 새로운 스케줄을 생성합니다. 기존 스케줄과 독립적으로 관리됩니다.'}
          </p>
        </div>
      )}
    </div>
  );
}
