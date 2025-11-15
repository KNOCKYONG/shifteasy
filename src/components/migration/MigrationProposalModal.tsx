'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { MigrationOptions, DEFAULT_MIGRATION_OPTIONS } from '@/lib/utils/migration';

interface MigrationProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (hospitalName: string, departmentName: string, options: MigrationOptions) => Promise<void>;
  dataStats?: {
    configs: number;
    teams: number;
    users: number;
    preferences: number;
    holidays: number;
    schedules: number;
  };
}

export default function MigrationProposalModal({
  isOpen,
  onClose,
  onConfirm,
  dataStats,
}: MigrationProposalModalProps) {
  const [hospitalName, setHospitalName] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 마이그레이션 옵션 상태
  const [options, setOptions] = useState<MigrationOptions>(DEFAULT_MIGRATION_OPTIONS);

  const handleConfirm = async () => {
    // 유효성 검사
    if (!hospitalName.trim() || !departmentName.trim()) {
      setError('병원명과 부서명을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onConfirm(hospitalName, departmentName, options);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '마이그레이션 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOption = (key: keyof MigrationOptions) => {
    setOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                🎉 게스트 계정 데이터 가져오기
              </h2>
              <button
                onClick={onClose}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-white/90 mt-2">
              현재 게스트 계정으로 설정하신 데이터를 새로운 Professional 워크스페이스로 가져올 수 있습니다.
            </p>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-200px)] px-6 py-6 space-y-6">
            {/* 병원명 및 부서명 입력 */}
            <div className="space-y-4">
              <div>
                <label htmlFor="hospital-name" className="block text-sm font-semibold text-gray-700 mb-2">
                  병원명 <span className="text-red-500">*</span>
                </label>
                <input
                  id="hospital-name"
                  type="text"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="예: 서울아산병원"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="department-name" className="block text-sm font-semibold text-gray-700 mb-2">
                  부서명 <span className="text-red-500">*</span>
                </label>
                <input
                  id="department-name"
                  type="text"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  placeholder="예: 내과병동"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* 데이터 선택 */}
            <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-3">가져올 데이터 선택</h3>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.migrateConfigs}
                    onChange={() => toggleOption('migrateConfigs')}
                    disabled={isLoading}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    근무 타입 설정 {dataStats && `(${dataStats.configs}개)`}
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.migrateTeams}
                    onChange={() => toggleOption('migrateTeams')}
                    disabled={isLoading}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    팀 정보 {dataStats && `(${dataStats.teams}개 팀)`}
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.migrateUsers}
                    onChange={() => toggleOption('migrateUsers')}
                    disabled={isLoading}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    팀원 정보 {dataStats && `(${dataStats.users}명)`}
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.migratePreferences}
                    onChange={() => toggleOption('migratePreferences')}
                    disabled={isLoading}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    개인 선호도 {dataStats && `(${dataStats.preferences}개)`}
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.migrateHolidays}
                    onChange={() => toggleOption('migrateHolidays')}
                    disabled={isLoading}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    공휴일 설정 {dataStats && `(${dataStats.holidays}개)`}
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer opacity-50">
                  <input
                    type="checkbox"
                    checked={options.migrateSchedules}
                    onChange={() => toggleOption('migrateSchedules')}
                    disabled={isLoading}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    작성된 스케줄 (선택)
                  </span>
                </label>
              </div>
            </div>

            {/* 주의사항 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <strong className="font-semibold">주의사항:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>기존 게스트 워크스페이스는 읽기 전용으로 보관됩니다</li>
                    <li>마이그레이션은 5-10분 정도 소요될 수 있습니다</li>
                    <li>마이그레이션 중에는 다른 작업을 하지 마세요</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                새로 시작하기
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    마이그레이션 중...
                  </>
                ) : (
                  '데이터 가져오기'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
