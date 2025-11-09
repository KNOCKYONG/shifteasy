import React, { memo } from 'react';
import { Lock, X, RefreshCcw } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isConfirming: boolean;
  validationScore: number | null;
  scheduleName: string;
  onScheduleNameChange: (name: string) => void;
  defaultScheduleName: string;
}

export const ConfirmationDialog = memo(function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  isConfirming,
  validationScore,
  scheduleName,
  onScheduleNameChange,
  defaultScheduleName,
}: ConfirmationDialogProps) {
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
          <div className="mb-6">
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              현재 스케줄을 확정하시겠습니까?
            </p>

            {/* 스케줄 명 입력 필드 */}
            <div className="mb-4">
              <label htmlFor="scheduleName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                스케줄 명
              </label>
              <input
                type="text"
                id="scheduleName"
                value={scheduleName}
                onChange={(e) => onScheduleNameChange(e.target.value)}
                placeholder={defaultScheduleName}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:ring-2 focus:ring-purple-500 focus:border-transparent
                         transition-colors"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                입력하지 않으면 "{defaultScheduleName}"로 저장됩니다.
              </p>
            </div>

            {validationScore !== null && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    검증 점수
                  </span>
                  <span className={`text-lg font-bold ${
                    validationScore >= 80
                      ? 'text-green-600 dark:text-green-400'
                      : validationScore >= 60
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {validationScore}점
                  </span>
                </div>
                {validationScore < 80 && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    ⚠️ 검증 점수가 낮습니다. 최적화를 먼저 실행하는 것을 권장합니다.
                  </p>
                )}
              </div>
            )}

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
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
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
