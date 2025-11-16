"use client";
import React, { useState, useMemo } from 'react';
import { X, Trash2, Calendar, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { format, getYear, getMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { api } from '@/lib/trpc/client';

interface ManageSchedulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduleDeleted?: () => void;
  onScheduleLoad?: (scheduleId: string) => void;
}

export function ManageSchedulesModal({ isOpen, onClose, onScheduleDeleted, onScheduleLoad }: ManageSchedulesModalProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const utils = api.useUtils();

  // Filter states - defaults to current year/month and all status
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const [filterYear, setFilterYear] = useState<number>(currentYear);
  const [filterMonth, setFilterMonth] = useState<number>(currentMonth);
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published'>('all');

  // Fetch schedules from database
  const { data: schedules = [], isLoading } = api.schedule.list.useQuery(
    { limit: 100, offset: 0 },
    { enabled: isOpen }
  );

  // Delete mutation
  const deleteMutation = api.schedule.delete.useMutation({
    onSuccess: async () => {
      // Invalidate all schedule-related queries to refresh UI everywhere
      await utils.schedule.invalidate();

      setDeleteConfirmId(null);
      if (onScheduleDeleted) {
        onScheduleDeleted();
      }
    },
    onError: (error) => {
      alert(`삭제 실패: ${error.message}`);
    },
  });

  const handleDelete = (schedule: (typeof schedules)[number]) => {
    if (schedule.status === 'published') {
      const warningMessage = [
        '확정된 스케줄을 삭제하면 다음 작업이 함께 진행됩니다.',
        '',
        '• 해당 월의 근무 교환 요청 초기화',
        '• 해당 월의 휴무/Off 잔여치 삭제',
        '',
        '계속 진행하시겠습니까?',
      ].join('\n');

      const confirmed = window.confirm(warningMessage);
      if (!confirmed) {
        return;
      }
    }

    deleteMutation.mutate({ id: schedule.id });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return { text: '임시저장', className: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' };
      case 'published':
        return { text: '확정', className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' };
      case 'archived':
        return { text: '보관됨', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' };
      default:
        return { text: status, className: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' };
    }
  };

  // Filter schedules based on year, month, and status
  const filteredSchedules = useMemo(() => {
    return schedules.filter((schedule) => {
      const scheduleDate = new Date(schedule.startDate);
      const scheduleYear = getYear(scheduleDate);
      const scheduleMonth = getMonth(scheduleDate) + 1; // 0-11 to 1-12

      // Filter by year
      if (scheduleYear !== filterYear) return false;

      // Filter by month
      if (scheduleMonth !== filterMonth) return false;

      // Filter by status
      if (filterStatus !== 'all' && schedule.status !== filterStatus) return false;

      return true;
    });
  }, [schedules, filterYear, filterMonth, filterStatus]);

  // Generate year options (current year ± 2 years)
  const yearOptions = useMemo(() => {
    const years = [];
    for (let i = currentYear - 2; i <= currentYear + 2; i++) {
      years.push(i);
    }
    return years;
  }, [currentYear]);

  // Month options (1-12)
  const monthOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              저장된 스케줄 관리
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              데이터베이스에 저장된 스케줄을 조회하고 삭제할 수 있습니다
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Filter Controls */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex flex-wrap items-center gap-4">
            {/* Year Filter */}
            <div className="flex items-center gap-2">
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}년
                  </option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <div className="flex items-center gap-2">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              >
                {monthOptions.map((month) => (
                  <option key={month} value={month}>
                    {month}월
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'draft' | 'published')}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                <option value="draft">임시저장</option>
                <option value="published">확정</option>
              </select>
            </div>

            {/* Result Count */}
            <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {filteredSchedules.length}개 / 전체 {schedules.length}개
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                스케줄 로딩 중...
              </p>
            </div>
          ) : schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                저장된 스케줄이 없습니다
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                스케줄을 생성하고 저장하면 여기에 표시됩니다
              </p>
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                필터 조건에 맞는 스케줄이 없습니다
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                다른 년도, 월 또는 상태를 선택해보세요
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSchedules.map((schedule) => {
                const statusBadge = getStatusBadge(schedule.status);
                const dateRange = `${format(new Date(schedule.startDate), 'yyyy년 MM월 dd일', { locale: ko })} ~ ${format(new Date(schedule.endDate), 'MM월 dd일', { locale: ko })}`;

                return (
                  <div
                    key={schedule.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-all relative"
                  >
                    {/* Loading overlay when deleting this schedule */}
                    {deleteMutation.isPending && deleteConfirmId === schedule.id && (
                      <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">삭제 중...</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start justify-between">
                      <div
                        className="flex-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg p-2 -m-2 transition-colors"
                        onClick={() => {
                          if (onScheduleLoad) {
                            onScheduleLoad(schedule.id);
                          }
                        }}
                        title="클릭하여 이 스케줄을 불러오기"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <Calendar className="w-5 h-5 text-blue-500" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {(schedule.metadata as any)?.name || dateRange}
                          </h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusBadge.className}`}>
                            {statusBadge.text}
                          </span>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(schedule.metadata as any)?.aiGenerated && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                              <Sparkles className="w-3 h-3" />
                              AI 생성
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-4">
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                              {schedule.department?.name || '부서 미지정'}
                            </span>
                            <span>{dateRange}</span>
                          </div>
                          <div className="text-gray-400 dark:text-gray-500">
                            생성: {format(new Date(schedule.createdAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {deleteConfirmId === schedule.id ? (
                          <div className="flex flex-col items-end gap-2 text-right">
                            {schedule.status === 'published' && (
                              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 w-full max-w-xs">
                                <p className="font-semibold mb-1">확정된 스케줄 삭제 시 함께 진행됩니다:</p>
                                <p>• 해당 월의 근무 교환 요청 초기화</p>
                                <p>• 해당 월의 휴무/Off 잔여치 삭제</p>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDelete(schedule)}
                                disabled={deleteMutation.isPending}
                                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
                              >
                                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                삭제 확인
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                disabled={deleteMutation.isPending}
                                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 rounded-lg transition-colors"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(schedule.id)}
                            disabled={deleteMutation.isPending}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-4 h-4" />
            <span>스케줄 삭제는 되돌릴 수 없습니다</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
