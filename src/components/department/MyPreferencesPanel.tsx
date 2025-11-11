"use client";

import { useState } from "react";
import { X, Save, AlertCircle } from "lucide-react";

export type WorkPatternType = 'three-shift' | 'night-intensive' | 'weekday-only';

export interface SimplifiedPreferences {
  workPatternType: WorkPatternType;
  preferredPatterns: {
    pattern: string;
    preference: number;
  }[];
  avoidPatterns: string[][];
}

interface MyPreferencesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preferences: SimplifiedPreferences) => void;
  initialPreferences?: Partial<SimplifiedPreferences>;
}

export function MyPreferencesPanel({
  isOpen,
  onClose,
  onSave,
  initialPreferences
}: MyPreferencesPanelProps) {
  const [preferences, setPreferences] = useState<SimplifiedPreferences>({
    workPatternType: initialPreferences?.workPatternType || 'three-shift',
    preferredPatterns: initialPreferences?.preferredPatterns || [],
    avoidPatterns: initialPreferences?.avoidPatterns || []
  });

  const [isSaving, setIsSaving] = useState(false);
  const [newPattern, setNewPattern] = useState('');
  const [newPatternPreference, setNewPatternPreference] = useState(5);
  const [newAvoidPattern, setNewAvoidPattern] = useState('');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(preferences);
      onClose();
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('선호도 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const addPreferredPattern = () => {
    if (!newPattern.trim()) return;

    setPreferences(prev => ({
      ...prev,
      preferredPatterns: [
        ...prev.preferredPatterns,
        { pattern: newPattern.trim(), preference: newPatternPreference }
      ]
    }));
    setNewPattern('');
    setNewPatternPreference(5);
  };

  const removePreferredPattern = (index: number) => {
    setPreferences(prev => ({
      ...prev,
      preferredPatterns: prev.preferredPatterns.filter((_, i) => i !== index)
    }));
  };

  const addAvoidPattern = () => {
    if (!newAvoidPattern.trim()) return;

    const patternArray = newAvoidPattern.trim().split('-').map(s => s.trim()).filter(Boolean);
    if (patternArray.length === 0) return;

    setPreferences(prev => ({
      ...prev,
      avoidPatterns: [...prev.avoidPatterns, patternArray]
    }));
    setNewAvoidPattern('');
  };

  const removeAvoidPattern = (index: number) => {
    setPreferences(prev => ({
      ...prev,
      avoidPatterns: prev.avoidPatterns.filter((_, i) => i !== index)
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              내 근무 선호도 설정
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              스케줄 자동 생성 시 참고됩니다
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* 근무 패턴 타입 */}
          <section>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              근무 패턴 유형
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: 'three-shift', label: '3교대 근무', desc: 'D-E-N 교대' },
                { value: 'night-intensive', label: '야간 집중', desc: '주로 야간 근무' },
                { value: 'weekday-only', label: '주중 근무', desc: '행정/주간 근무' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setPreferences(prev => ({ ...prev, workPatternType: option.value as WorkPatternType }))}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    preferences.workPatternType === option.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">{option.label}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{option.desc}</div>
                </button>
              ))}
            </div>
          </section>

          {/* 선호 근무 패턴 */}
          <section>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              선호하는 근무 패턴
            </h3>
            <div className="space-y-3">
              {preferences.preferredPatterns.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex-1">
                    <span className="font-mono text-gray-900 dark:text-white">{item.pattern}</span>
                    <span className="ml-3 text-sm text-gray-500">선호도: {item.preference}/10</span>
                  </div>
                  <button
                    onClick={() => removePreferredPattern(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    삭제
                  </button>
                </div>
              ))}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  placeholder="예: DD-EE-NN-OFF"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={newPatternPreference}
                  onChange={(e) => setNewPatternPreference(Number(e.target.value))}
                  className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={addPreferredPattern}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  추가
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                예시: DD-EE-NN-OFF (주간 2일, 저녁 2일, 야간 2일, 휴무 2일)
              </p>
            </div>
          </section>

          {/* 기피 근무 패턴 */}
          <section>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              기피하는 근무 패턴
            </h3>
            <div className="space-y-3">
              {preferences.avoidPatterns.map((pattern, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex-1">
                    <span className="font-mono text-gray-900 dark:text-white">{pattern.join(' → ')}</span>
                  </div>
                  <button
                    onClick={() => removeAvoidPattern(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    삭제
                  </button>
                </div>
              ))}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAvoidPattern}
                  onChange={(e) => setNewAvoidPattern(e.target.value)}
                  placeholder="예: N-D (야간 후 주간)"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={addAvoidPattern}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  추가
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                예시: N-D (야간 후 주간 기피), E-N-D (저녁-야간-주간 연속 기피)
              </p>
            </div>
          </section>

          {/* Info Box */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">선호도는 자동 스케줄 생성 시 참고사항입니다</p>
              <p>실제 스케줄은 병동 요구사항, 인력 상황 등을 종합적으로 고려하여 배정됩니다.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
