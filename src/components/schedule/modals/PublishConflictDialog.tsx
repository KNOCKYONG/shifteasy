import React, { memo } from 'react';
import { AlertTriangle, X, RefreshCcw, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface PublishConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isConfirming: boolean;
  existingSchedule: {
    id: string;
    startDate: Date;
    endDate: Date;
    publishedAt?: Date | null;
  } | null;
}

export const PublishConflictDialog = memo(function PublishConflictDialog({
  isOpen,
  onClose,
  onConfirm,
  isConfirming,
  existingSchedule,
}: PublishConflictDialogProps) {
  if (!isOpen || !existingSchedule) return null;

  const startDate = new Date(existingSchedule.startDate);
  const endDate = new Date(existingSchedule.endDate);
  const publishedAt = existingSchedule.publishedAt ? new Date(existingSchedule.publishedAt) : null;

  return (
    <div className="fixed inset-0 bg-gray-900/50 dark:bg-gray-950/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              확정 충돌 감지
            </h2>
            <button
              onClick={onClose}
              disabled={isConfirming}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              같은 달에 이미 확정된 스케줄이 있습니다.
            </p>

            {/* 기존 스케줄 정보 */}
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-2">
                    기존 확정된 스케줄
                  </p>
                  <div className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                    <p>
                      • 기간: {format(startDate, 'yyyy년 MM월 dd일', { locale: ko })} ~ {format(endDate, 'MM월 dd일', { locale: ko })}
                    </p>
                    {publishedAt && (
                      <p>
                        • 확정일: {format(publishedAt, 'yyyy-MM-dd HH:mm', { locale: ko })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 경고 메시지 */}
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm font-medium text-red-900 dark:text-red-200 mb-2">
                ⚠️ 주의사항
              </p>
              <ul className="space-y-1 text-sm text-red-700 dark:text-red-300">
                <li>• 기존 스케줄이 삭제됩니다</li>
                <li>• 이 작업은 되돌릴 수 없습니다</li>
                <li>• 직원들에게 새로운 알림이 발송됩니다</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isConfirming}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              disabled={isConfirming}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                isConfirming
                  ? "text-gray-400 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                  : "text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
              }`}
            >
              {isConfirming ? (
                <>
                  <RefreshCcw className="w-4 h-4 animate-spin inline mr-2" />
                  처리 중...
                </>
              ) : (
                "기존 스케줄 삭제하고 확정"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
