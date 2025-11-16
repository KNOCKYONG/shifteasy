import React, { memo } from 'react';
import { Lock, X, RefreshCcw, AlertTriangle, Loader2 } from 'lucide-react';

interface ExistingSchedule {
  id: string;
  startDate: string | Date;
  endDate: string | Date;
  publishedAt: string | Date | null;
}

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isConfirming: boolean;
  isCheckingConflicts?: boolean;
  scheduleName: string;
  existingSchedule?: ExistingSchedule | null;
}

export const ConfirmationDialog = memo(function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  isConfirming,
  scheduleName,
  existingSchedule,
  isCheckingConflicts = false,
}: ConfirmationDialogProps) {
  const handleConfirm = () => {
    setTimeout(onConfirm, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/50 dark:bg-gray-950/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              스케줄 확정
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6 space-y-4">
            {isCheckingConflicts && (
              <div className="flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-700 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-200">
                <Loader2 className="w-4 h-4 animate-spin" />
                기존 확정 스케줄을 확인하는 중입니다...
              </div>
            )}
            {/* 기존 스케줄 경고 */}
            {existingSchedule && (
              <div className="mb-6 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                      ⚠️ 같은 기간에 이미 확정된 스케줄이 있습니다.
                    </h3>
                    <div className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                      <p><strong>기간:</strong> {new Date(existingSchedule.startDate).toLocaleDateString('ko-KR')} ~ {new Date(existingSchedule.endDate).toLocaleDateString('ko-KR')}</p>
                      <p><strong>확정일:</strong> {existingSchedule.publishedAt
                        ? new Date(existingSchedule.publishedAt).toLocaleString('ko-KR', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                          })
                        : '알 수 없음'}</p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-amber-300 dark:border-amber-700">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                        확정 시 수행되는 작업:
                      </p>
                      <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                        <li>• 스케줄이 최종 확정되어 수정 불가</li>
                        <li>• 모든 직원에게 알림 발송</li>
                        <li>• 스케줄 공개 및 접근 가능</li>
                        <li>• 근무 일정 캘린더 동기화</li>
                      </ul>
                    </div>
                    <p className="mt-3 text-sm font-bold text-red-600 dark:text-red-400">
                      ※ 이 작업은 되돌릴 수 없으며, 기존 스케줄이 영구 삭제됩니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {existingSchedule
                ? '기존 스케줄을 삭제하고 새 스케줄을 확정하시겠습니까?'
                : '현재 스케줄을 확정하시겠습니까?'}
            </p>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">확정될 스케줄 명</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 break-words">{scheduleName}</p>
            </div>

            {/* 기존 스케줄이 없을 때만 정보 박스 표시 */}
            {!existingSchedule && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  <strong>확정 시 수행되는 작업:</strong>
                </p>
                <ul className="mt-2 space-y-1 text-sm text-blue-600 dark:text-blue-300">
                  <li>• 스케줄이 최종 확정되어 수정 불가</li>
                  <li>• 모든 직원에게 알림 발송</li>
                  <li>• 스케줄 공개 및 접근 가능</li>
                  <li>• 근무 일정 캘린더 동기화</li>
                </ul>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                isConfirming
                  ? "text-gray-400 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                  : "text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
              }`}
            >
              {isConfirming ? (
                <>
                  <RefreshCcw className="w-4 h-4 animate-spin inline mr-2" />
                  확정 중...
                </>
              ) : (
                "확정하기"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
