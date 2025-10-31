"use client";
import React, { useState, useEffect } from 'react';
import { X, Trash2, Calendar, Users, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface SavedSchedule {
  id: string;
  month: string;
  departmentId: string;
  departmentName: string;
  savedAt: string;
  assignmentCount: number;
  employeeCount: number;
}

interface ManageSchedulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduleDeleted?: () => void;
}

export function ManageSchedulesModal({ isOpen, onClose, onScheduleDeleted }: ManageSchedulesModalProps) {
  const [savedSchedules, setSavedSchedules] = useState<SavedSchedule[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSavedSchedules();
    }
  }, [isOpen]);

  const loadSavedSchedules = () => {
    try {
      const saved = localStorage.getItem('savedSchedules');
      if (saved) {
        const schedules = JSON.parse(saved);
        const scheduleList: SavedSchedule[] = Object.entries(schedules).map(([id, data]: [string, any]) => {
          // Parse month from schedule data
          const firstAssignment = data.assignments?.[0];
          const month = firstAssignment ? format(new Date(firstAssignment.date), 'yyyy년 MM월', { locale: ko }) : 'Unknown';

          // Get unique employee count
          const employeeIds = new Set(data.assignments?.map((a: any) => a.employeeId) || []);

          return {
            id,
            month,
            departmentId: data.departmentId || 'unknown',
            departmentName: getDepartmentName(data.departmentId),
            savedAt: data.savedAt || new Date().toISOString(),
            assignmentCount: data.assignments?.length || 0,
            employeeCount: employeeIds.size,
          };
        });

        // Sort by saved date (newest first)
        scheduleList.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        setSavedSchedules(scheduleList);
      } else {
        setSavedSchedules([]);
      }
    } catch (error) {
      console.error('Failed to load saved schedules:', error);
      setSavedSchedules([]);
    }
  };

  const getDepartmentName = (departmentId: string): string => {
    const deptMap: Record<string, string> = {
      'dept-er': '응급실',
      'dept-icu': '중환자실',
      'dept-or': '수술실',
      'dept-ward': '일반병동',
      'all-departments': '전체',
    };
    return deptMap[departmentId] || departmentId;
  };

  const handleDelete = (scheduleId: string) => {
    try {
      const saved = localStorage.getItem('savedSchedules');
      if (saved) {
        const schedules = JSON.parse(saved);
        delete schedules[scheduleId];
        localStorage.setItem('savedSchedules', JSON.stringify(schedules));
        loadSavedSchedules();
        setDeleteConfirmId(null);

        // Notify parent component
        if (onScheduleDeleted) {
          onScheduleDeleted();
        }
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const handleDeleteAll = () => {
    if (window.confirm('모든 저장된 스케줄을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      localStorage.removeItem('savedSchedules');
      setSavedSchedules([]);
      setDeleteConfirmId(null);

      if (onScheduleDeleted) {
        onScheduleDeleted();
      }
    }
  };

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
              로컬에 저장된 스케줄을 조회하고 삭제할 수 있습니다
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {savedSchedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                저장된 스케줄이 없습니다
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                스케줄을 생성하고 저장하면 여기에 표시됩니다
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-5 h-5 text-blue-500" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {schedule.month}
                        </h3>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {schedule.departmentName}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{schedule.employeeCount}명</span>
                        </div>
                        <div>
                          <span>{schedule.assignmentCount}건 배정</span>
                        </div>
                        <div className="text-gray-400 dark:text-gray-500">
                          저장: {format(new Date(schedule.savedAt), 'MM/dd HH:mm', { locale: ko })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {deleteConfirmId === schedule.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(schedule.id)}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                          >
                            삭제 확인
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(schedule.id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
            {savedSchedules.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                전체 삭제
              </button>
            )}
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
