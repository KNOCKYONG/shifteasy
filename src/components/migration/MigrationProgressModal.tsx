'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { MigrationStep } from '@/lib/utils/migration';

interface MigrationProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  migrationId?: string;
  migrationResult?: {
    success: boolean;
    newTenantId?: string;
    newDepartmentId?: string;
    secretCode?: string;
    migratedData?: {
      configs: number;
      teams: number;
      users: number;
      preferences: number;
      holidays: number;
      schedules: number;
      specialRequests: number;
    };
    error?: {
      code: string;
      message: string;
      details?: unknown;
    };
  };
}

interface ProgressData {
  step: MigrationStep;
  current: number;
  total: number;
  message: string;
  completed?: boolean;
  success?: boolean;
  error?: string;
  migratedData?: {
    configs: number;
    teams: number;
    users: number;
    preferences: number;
    holidays: number;
    schedules: number;
    specialRequests: number;
  };
  secretCode?: string;
}

const STEP_LABELS: Record<MigrationStep, string> = {
  [MigrationStep.CREATING_TENANT]: '새 워크스페이스 생성 중...',
  [MigrationStep.CREATING_DEPARTMENT]: '부서 설정 중...',
  [MigrationStep.MIGRATING_CONFIGS]: '근무 타입 설정 복사 중...',
  [MigrationStep.MIGRATING_TEAMS]: '팀 정보 복사 중...',
  [MigrationStep.MIGRATING_USERS]: '팀원 정보 복사 중...',
  [MigrationStep.MIGRATING_PREFERENCES]: '개인 선호도 복사 중...',
  [MigrationStep.MIGRATING_HOLIDAYS]: '공휴일 설정 복사 중...',
  [MigrationStep.MIGRATING_SCHEDULES]: '스케줄 복사 중...',
  [MigrationStep.MIGRATING_SPECIAL_REQUESTS]: '특별 요청 복사 중...',
  [MigrationStep.COMPLETED]: '완료!',
  [MigrationStep.FAILED]: '실패',
};

export default function MigrationProgressModal({
  isOpen,
  onClose,
  migrationId,
  migrationResult,
}: MigrationProgressModalProps) {
  const [progress, setProgress] = useState<ProgressData>({
    step: MigrationStep.CREATING_TENANT,
    current: 0,
    total: 100,
    message: '마이그레이션을 시작합니다...',
  });

  // Update progress based on migration result
  useEffect(() => {
    if (!migrationResult) {
      // Reset to initial state
      setProgress({
        step: MigrationStep.CREATING_TENANT,
        current: 0,
        total: 100,
        message: '마이그레이션을 시작합니다...',
      });
      return;
    }

    if (migrationResult.success) {
      setProgress({
        step: MigrationStep.COMPLETED,
        current: 100,
        total: 100,
        message: '마이그레이션이 완료되었습니다!',
        completed: true,
        success: true,
        migratedData: migrationResult.migratedData,
        secretCode: migrationResult.secretCode,
      });
    } else {
      setProgress({
        step: MigrationStep.FAILED,
        current: 0,
        total: 100,
        message: '마이그레이션 실패',
        completed: true,
        success: false,
        error: migrationResult.error?.message || '알 수 없는 오류가 발생했습니다.',
      });
    }
  }, [migrationResult]);

  // Simulated progress animation while waiting for result
  useEffect(() => {
    if (!isOpen || !migrationId || migrationResult) return;

    // Show animated progress while migration is in progress
    const steps = [
      { step: MigrationStep.CREATING_TENANT, duration: 1000 },
      { step: MigrationStep.CREATING_DEPARTMENT, duration: 800 },
      { step: MigrationStep.MIGRATING_CONFIGS, duration: 1200 },
      { step: MigrationStep.MIGRATING_TEAMS, duration: 1500 },
      { step: MigrationStep.MIGRATING_USERS, duration: 2000 },
      { step: MigrationStep.MIGRATING_PREFERENCES, duration: 1000 },
      { step: MigrationStep.MIGRATING_HOLIDAYS, duration: 800 },
    ];

    let currentStepIndex = 0;

    const progressInterval = setInterval(() => {
      if (currentStepIndex >= steps.length) {
        // Loop back to beginning if migration takes longer
        currentStepIndex = 0;
      }

      const currentStep = steps[currentStepIndex];
      setProgress({
        step: currentStep.step,
        current: currentStepIndex + 1,
        total: steps.length,
        message: STEP_LABELS[currentStep.step],
      });

      currentStepIndex++;
    }, 1500);

    return () => clearInterval(progressInterval);
  }, [isOpen, migrationId, migrationResult]);

  if (!isOpen) return null;

  const progressPercentage = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                {progress.completed && progress.success ? (
                  <>
                    <CheckCircle className="w-6 h-6" />
                    마이그레이션 완료
                  </>
                ) : progress.completed && !progress.success ? (
                  <>
                    <AlertTriangle className="w-6 h-6" />
                    마이그레이션 실패
                  </>
                ) : (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    데이터 마이그레이션 중
                  </>
                )}
              </h2>
              {progress.completed && (
                <button
                  onClick={onClose}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              )}
            </div>
          </div>

          {/* Progress Content */}
          <div className="px-6 py-8 space-y-6">
            {/* Progress Bar */}
            {!progress.completed && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{progress.message}</span>
                  <span className="font-semibold">{progressPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}

            {/* Success Message */}
            {progress.completed && progress.success && (
              <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-green-900 mb-2">
                        Professional 플랜으로 성공적으로 업그레이드되었습니다!
                      </h3>
                      <p className="text-sm text-green-800">
                        게스트 계정의 데이터가 새로운 워크스페이스로 안전하게 복사되었습니다.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Migration Statistics */}
                {progress.migratedData && (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">복사된 데이터</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {progress.migratedData.configs > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">근무 타입 설정</span>
                          <span className="font-semibold text-gray-900">
                            {progress.migratedData.configs}개
                          </span>
                        </div>
                      )}
                      {progress.migratedData.teams > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">팀</span>
                          <span className="font-semibold text-gray-900">
                            {progress.migratedData.teams}개
                          </span>
                        </div>
                      )}
                      {progress.migratedData.users > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">팀원</span>
                          <span className="font-semibold text-gray-900">
                            {progress.migratedData.users}명
                          </span>
                        </div>
                      )}
                      {progress.migratedData.preferences > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">개인 선호도</span>
                          <span className="font-semibold text-gray-900">
                            {progress.migratedData.preferences}개
                          </span>
                        </div>
                      )}
                      {progress.migratedData.holidays > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">공휴일</span>
                          <span className="font-semibold text-gray-900">
                            {progress.migratedData.holidays}개
                          </span>
                        </div>
                      )}
                      {progress.migratedData.schedules > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">스케줄</span>
                          <span className="font-semibold text-gray-900">
                            {progress.migratedData.schedules}개
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Secret Code (if available) */}
                {progress.secretCode && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="font-semibold text-blue-900 mb-2">
                      워크스페이스 초대 코드
                    </h3>
                    <div className="flex items-center gap-3">
                      <code className="flex-1 px-4 py-3 bg-white border border-blue-300 rounded text-lg font-mono text-blue-900">
                        {progress.secretCode}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(progress.secretCode!)}
                        className="px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        복사
                      </button>
                    </div>
                    <p className="text-sm text-blue-800 mt-2">
                      팀원을 초대할 때 이 코드를 사용하세요.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {progress.completed && !progress.success && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 mb-2">
                      마이그레이션 중 오류가 발생했습니다
                    </h3>
                    <p className="text-sm text-red-800">
                      {progress.error || '알 수 없는 오류가 발생했습니다. 다시 시도해주세요.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Processing Warning */}
            {!progress.completed && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <strong className="font-semibold">잠시만 기다려주세요</strong>
                    <p className="mt-1">
                      마이그레이션 중에는 브라우저를 닫거나 페이지를 새로고침하지 마세요.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {progress.completed && (
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  {progress.success ? '대시보드로 이동' : '닫기'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
