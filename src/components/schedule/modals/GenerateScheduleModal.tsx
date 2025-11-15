'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/trpc/client';

interface ShiftRequirement {
  shiftCode: string;
  shiftName: string;
  requiredCount: number;
}

interface GenerateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (shiftRequirements: Record<string, number>) => void;
  departmentId: string | null;
  customShiftTypes: Array<{
    code: string;
    name: string;
    startTime: string;
    endTime: string;
    color: string;
    allowOvertime?: boolean;
  }>;
}

export function GenerateScheduleModal({
  isOpen,
  onClose,
  onGenerate,
  departmentId,
  customShiftTypes,
}: GenerateScheduleModalProps) {
  const [shiftRequirements, setShiftRequirements] = useState<ShiftRequirement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch department pattern
  const { data: departmentPattern } = api.departmentPatterns.getByDepartment.useQuery(
    { departmentId: departmentId || '' },
    { enabled: !!departmentId && isOpen }
  );

  // Update shift requirements mutation
  const updatePatternMutation = api.departmentPatterns.upsert.useMutation();

  // Initialize shift requirements from department pattern or defaults
  useEffect(() => {
    if (!isOpen) return;

    if (departmentPattern?.requiredStaffByShift) {
      // Load from existing pattern
      const requirements = Object.entries(departmentPattern.requiredStaffByShift).map(
        ([code, count]) => {
          const shiftType = customShiftTypes.find((st) => st.code === code);
          return {
            shiftCode: code,
            shiftName: shiftType?.name || code,
            requiredCount: count as number,
          };
        }
      );
      setShiftRequirements(requirements);
    } else {
      // Initialize with custom shift types
      const defaultRequirements = customShiftTypes
        .filter((st) => st.code !== 'O' && st.code !== 'OFF')
        .map((st) => ({
          shiftCode: st.code,
          shiftName: st.name,
          requiredCount: 5, // Default value
        }));
      setShiftRequirements(defaultRequirements);
    }
    setHasChanges(false);
  }, [isOpen, departmentPattern, customShiftTypes]);

  const handleRequiredCountChange = (shiftCode: string, value: string) => {
    const count = parseInt(value) || 0;
    setShiftRequirements((prev) =>
      prev.map((req) =>
        req.shiftCode === shiftCode ? { ...req, requiredCount: count } : req
      )
    );
    setHasChanges(true);
  };

  const handleAddShift = () => {
    // Find shifts not yet in requirements
    const availableShifts = customShiftTypes.filter(
      (st) =>
        st.code !== 'O' &&
        st.code !== 'OFF' &&
        !shiftRequirements.some((req) => req.shiftCode === st.code)
    );

    if (availableShifts.length > 0) {
      setShiftRequirements((prev) => [
        ...prev,
        {
          shiftCode: availableShifts[0]!.code,
          shiftName: availableShifts[0]!.name,
          requiredCount: 5,
        },
      ]);
      setHasChanges(true);
    }
  };

  const handleRemoveShift = (shiftCode: string) => {
    setShiftRequirements((prev) => prev.filter((req) => req.shiftCode !== shiftCode));
    setHasChanges(true);
  };

  const handleGenerate = async () => {
    if (!departmentId) return;

    setIsLoading(true);
    try {
      // Convert requirements to record
      const requiredStaffByShift: Record<string, number> = {};
      shiftRequirements.forEach((req) => {
        requiredStaffByShift[req.shiftCode] = req.requiredCount;
      });

      // Update department pattern if there are changes
      if (hasChanges) {
        await updatePatternMutation.mutateAsync({
          departmentId,
          requiredStaffByShift,
          requiredStaffDay: requiredStaffByShift['D'] || 5,
          requiredStaffEvening: requiredStaffByShift['E'] || 4,
          requiredStaffNight: requiredStaffByShift['N'] || 3,
          defaultPatterns: departmentPattern?.defaultPatterns || [['D', 'D', 'D', 'OFF', 'OFF']],
          avoidPatterns: departmentPattern?.avoidPatterns || [],
          totalMembers: departmentPattern?.totalMembers || 15,
          isActive: departmentPattern?.isActive || 'true',
        });
      }

      // Proceed with schedule generation
      onGenerate(requiredStaffByShift);
      onClose();
    } catch (error) {
      console.error('Failed to update shift requirements:', error);
      alert('시프트별 필수 인원 저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            스케줄 생성
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Info Message */}
          <div className="flex gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">시프트별 필수 인원 설정</p>
              <p className="text-blue-600 dark:text-blue-400">
                각 시프트별로 필요한 최소 인원을 설정하세요. 수정된 값은 부서 패턴에 저장됩니다.
              </p>
            </div>
          </div>

          {/* Shift Requirements */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                시프트별 필수 인원
              </label>
              <button
                onClick={handleAddShift}
                disabled={
                  shiftRequirements.length >= customShiftTypes.length - 1 ||
                  isLoading
                }
                className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                시프트 추가
              </button>
            </div>

            <div className="space-y-2">
              {shiftRequirements.map((req) => {
                const shiftType = customShiftTypes.find((st) => st.code === req.shiftCode);
                return (
                  <div
                    key={req.shiftCode}
                    className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: shiftType?.color || '#9CA3AF' }}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {req.shiftName} ({req.shiftCode})
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {shiftType?.startTime} - {shiftType?.endTime}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={req.requiredCount}
                      onChange={(e) =>
                        handleRequiredCountChange(req.shiftCode, e.target.value)
                      }
                      disabled={isLoading}
                      className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                    <button
                      onClick={() => handleRemoveShift(req.shiftCode)}
                      disabled={shiftRequirements.length <= 1 || isLoading}
                      className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {shiftRequirements.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                시프트를 추가해주세요.
              </div>
            )}
          </div>

          {/* Change Indicator */}
          {hasChanges && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
              <span>변경사항이 있습니다. 생성 시 부서 패턴에 저장됩니다.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleGenerate}
            disabled={isLoading || shiftRequirements.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '생성 중...' : '생성'}
          </button>
        </div>
      </div>
    </div>
  );
}
