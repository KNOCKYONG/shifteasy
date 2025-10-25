'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import {
  TeamPattern,
  validateTeamPattern,
  DEFAULT_PATTERNS,
  SHIFT_TYPES,
  type ShiftType
} from '@/lib/types/team-pattern';

interface TeamPatternPanelProps {
  departmentId: string;
  totalMembers: number;
  canEdit: boolean;
}

export function TeamPatternPanel({
  departmentId,
  totalMembers,
  canEdit
}: TeamPatternPanelProps) {
  const [pattern, setPattern] = useState<Partial<TeamPattern>>({
    departmentId,
    requiredStaffDay: 5,
    requiredStaffEvening: 4,
    requiredStaffNight: 3,
    defaultPatterns: [['D', 'D', 'D', 'OFF', 'OFF']],
    totalMembers,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  // Team Pattern 불러오기
  useEffect(() => {
    fetchTeamPattern();
  }, [departmentId]);

  const fetchTeamPattern = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/team-patterns?departmentId=${departmentId}`);
      const data = await response.json();

      if (data.pattern) {
        setPattern(data.pattern);
      } else if (data.defaultPattern) {
        setPattern({ ...data.defaultPattern, totalMembers });
      }
    } catch (error) {
      console.error('Failed to fetch team pattern:', error);
    } finally {
      setLoading(false);
    }
  };

  // 시프트별 필요 인원 변경
  const handleRequiredStaffChange = (shift: 'Day' | 'Evening' | 'Night', inputValue: string) => {
    // leading zero 제거 및 숫자 변환
    const value = inputValue === '' ? 0 : parseInt(inputValue, 10) || 0;

    const newPattern = {
      ...pattern,
      [`requiredStaff${shift}`]: value,
    };

    setPattern(newPattern);

    // 실시간 검증
    const validation = validateTeamPattern({ ...newPattern, totalMembers });
    setErrors(validation.errors);
  };

  // 패턴 추가
  const addPattern = () => {
    setPattern(prev => ({
      ...prev,
      defaultPatterns: [
        ...(prev.defaultPatterns || []),
        ['D', 'OFF']
      ],
    }));
  };

  // 패턴 삭제
  const removePattern = (index: number) => {
    setPattern(prev => ({
      ...prev,
      defaultPatterns: prev.defaultPatterns?.filter((_, i) => i !== index) || [],
    }));
  };

  // 패턴 수정
  const updatePattern = (patternIndex: number, dayIndex: number, value: ShiftType) => {
    setPattern(prev => {
      const newPatterns = [...(prev.defaultPatterns || [])];
      newPatterns[patternIndex] = [...newPatterns[patternIndex]];
      newPatterns[patternIndex][dayIndex] = value;

      return {
        ...prev,
        defaultPatterns: newPatterns,
      };
    });
  };

  // 패턴에 날짜 추가
  const addDayToPattern = (patternIndex: number) => {
    setPattern(prev => {
      const newPatterns = [...(prev.defaultPatterns || [])];
      newPatterns[patternIndex] = [...newPatterns[patternIndex], 'OFF'];

      return {
        ...prev,
        defaultPatterns: newPatterns,
      };
    });
  };

  // 패턴에서 날짜 제거
  const removeDayFromPattern = (patternIndex: number, dayIndex: number) => {
    setPattern(prev => {
      const newPatterns = [...(prev.defaultPatterns || [])];
      newPatterns[patternIndex] = newPatterns[patternIndex].filter((_, i) => i !== dayIndex);

      return {
        ...prev,
        defaultPatterns: newPatterns,
      };
    });
  };

  // 저장
  const handleSave = async () => {
    // 검증
    const validation = validateTeamPattern({ ...pattern, totalMembers });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    setErrors([]);

    try {
      const response = await fetch('/api/team-patterns', {
        method: pattern.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pattern.id ?
          { ...pattern } :
          { ...pattern, departmentId, totalMembers }
        ),
      });

      if (!response.ok) {
        const error = await response.json();
        setErrors(error.details || [error.error]);
        return;
      }

      const result = await response.json();
      setPattern(result.pattern);
      setSuccessMessage('Team Pattern이 성공적으로 저장되었습니다.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save team pattern:', error);
      setErrors(['저장 중 오류가 발생했습니다.']);
    } finally {
      setSaving(false);
    }
  };

  // 초기화
  const handleReset = () => {
    fetchTeamPattern();
    setErrors([]);
    setSuccessMessage('');
  };

  // 필요 인원 합계 계산
  const totalRequired = (pattern.requiredStaffDay || 0) +
                       (pattern.requiredStaffEvening || 0) +
                       (pattern.requiredStaffNight || 0);

  const remainingStaff = totalMembers - totalRequired;

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-center py-8 text-gray-500">
          Team Pattern 불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Team Pattern 설정</h2>
        </div>
        <div className="text-sm text-gray-500">
          전체 인원: <span className="font-semibold">{totalMembers}명</span>
        </div>
      </div>

      {/* 시프트별 필요 인원 */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          시프트별 필요 인원
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              주간(D)
            </label>
            <input
              type="number"
              min="1"
              max={totalMembers}
              value={Number(pattern.requiredStaffDay || 0)}
              onChange={(e) => handleRequiredStaffChange('Day', e.target.value)}
              onInput={(e) => {
                const input = e.target as HTMLInputElement;
                const value = input.value.replace(/^0+(?=\d)/, '');
                if (input.value !== value) {
                  input.value = value;
                }
              }}
              disabled={!canEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              저녁(E)
            </label>
            <input
              type="number"
              min="1"
              max={totalMembers}
              value={Number(pattern.requiredStaffEvening || 0)}
              onChange={(e) => handleRequiredStaffChange('Evening', e.target.value)}
              onInput={(e) => {
                const input = e.target as HTMLInputElement;
                const value = input.value.replace(/^0+(?=\d)/, '');
                if (input.value !== value) {
                  input.value = value;
                }
              }}
              disabled={!canEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              야간(N)
            </label>
            <input
              type="number"
              min="1"
              max={totalMembers}
              value={Number(pattern.requiredStaffNight || 0)}
              onChange={(e) => handleRequiredStaffChange('Night', e.target.value)}
              onInput={(e) => {
                const input = e.target as HTMLInputElement;
                const value = input.value.replace(/^0+(?=\d)/, '');
                if (input.value !== value) {
                  input.value = value;
                }
              }}
              disabled={!canEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>
        </div>

        {/* 인원 배정 상태 */}
        <div className="mt-3 p-3 bg-gray-50 rounded-md">
          <div className="text-sm text-gray-600">
            배정된 인원: <span className="font-medium">{totalRequired}명</span> /
            남은 인원: <span className={`font-medium ${remainingStaff < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {remainingStaff}명
            </span>
          </div>
          {remainingStaff < 0 && (
            <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              전체 인원을 초과했습니다
            </div>
          )}
        </div>
      </div>

      {/* 기본 근무 패턴 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            기본 근무 패턴
          </h3>
          {canEdit && (
            <button
              onClick={addPattern}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              패턴 추가
            </button>
          )}
        </div>

        <div className="space-y-3">
          {pattern.defaultPatterns?.map((patternArray, patternIndex) => (
            <div key={patternIndex} className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1 flex-wrap">
                {patternArray.map((shift, dayIndex) => (
                  <select
                    key={dayIndex}
                    value={shift}
                    onChange={(e) => updatePattern(patternIndex, dayIndex, e.target.value as ShiftType)}
                    disabled={!canEdit}
                    className={`px-2 py-1 border rounded text-sm font-medium ${
                      shift === 'D' ? 'bg-blue-50 border-blue-300 text-blue-700' :
                      shift === 'E' ? 'bg-purple-50 border-purple-300 text-purple-700' :
                      shift === 'N' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' :
                      'bg-gray-50 border-gray-300 text-gray-700'
                    } disabled:opacity-50`}
                  >
                    <option value="D">D</option>
                    <option value="E">E</option>
                    <option value="N">N</option>
                    <option value="OFF">OFF</option>
                  </select>
                ))}
                {canEdit && (
                  <>
                    <button
                      onClick={() => addDayToPattern(patternIndex)}
                      className="p-1 text-blue-600 hover:text-blue-700"
                      title="날짜 추가"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    {patternArray.length > 1 && (
                      <button
                        onClick={() => removeDayFromPattern(patternIndex, patternArray.length - 1)}
                        className="p-1 text-red-600 hover:text-red-700"
                        title="마지막 날짜 제거"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
              {canEdit && pattern.defaultPatterns!.length > 1 && (
                <button
                  onClick={() => removePattern(patternIndex)}
                  className="p-1 text-red-600 hover:text-red-700"
                  title="패턴 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 p-3 bg-blue-50 rounded-md">
          <p className="text-xs text-blue-700">
            * 개인 선호도가 입력되지 않은 직원은 위 기본 패턴이 자동으로 적용됩니다.
          </p>
        </div>
      </div>

      {/* 에러 메시지 */}
      {errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
            <div className="text-sm text-red-600">
              {errors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 성공 메시지 */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <div className="text-sm text-green-600">{successMessage}</div>
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      {canEdit && (
        <div className="flex justify-end gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            초기화
          </button>
          <button
            onClick={handleSave}
            disabled={saving || errors.length > 0}
            className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      )}
    </div>
  );
}