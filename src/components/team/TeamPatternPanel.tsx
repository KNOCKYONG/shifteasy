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
  CheckCircle,
  Info,
  Keyboard
} from 'lucide-react';
import {
  TeamPattern,
  validateTeamPattern,
  DEFAULT_PATTERNS,
  SHIFT_TYPES,
  type ShiftType
} from '@/lib/types/team-pattern';
import {
  validatePattern,
  tokensToString,
  describePattern,
  EXAMPLE_PATTERNS,
  KEYWORD_DESCRIPTIONS,
  type ShiftToken
} from '@/lib/utils/pattern-validator';

interface ShiftType {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
}

interface TeamPatternPanelProps {
  departmentId: string;
  departmentName?: string;
  totalMembers: number;
  canEdit: boolean;
  shiftTypes: ShiftType[];
}

export function TeamPatternPanel({
  departmentId,
  departmentName,
  totalMembers,
  canEdit,
  shiftTypes
}: TeamPatternPanelProps) {
  const [pattern, setPattern] = useState<Partial<TeamPattern>>({
    departmentId,
    requiredStaffDay: 5,
    requiredStaffEvening: 4,
    requiredStaffNight: 3,
    defaultPatterns: [['D', 'D', 'D', 'OFF', 'OFF']],
    avoidPatterns: [], // 기피 패턴 초기화
    totalMembers,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  // 패턴 텍스트 입력 관련 상태
  const [patternInput, setPatternInput] = useState('');
  const [patternValidation, setPatternValidation] = useState<ReturnType<typeof validatePattern> | null>(null);
  const [showPatternHelp, setShowPatternHelp] = useState(false);

  // Team Pattern 불러오기
  useEffect(() => {
    // departmentId가 유효할 때만 fetch
    if (departmentId && departmentId !== 'all') {
      fetchTeamPattern();
    }
  }, [departmentId]);

  const fetchTeamPattern = async () => {
    if (!departmentId || departmentId === 'all') {
      return;
    }

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

  // 패턴 텍스트 입력 핸들러
  const handlePatternInputChange = (value: string) => {
    setPatternInput(value);

    // 실시간 검증
    if (value.trim()) {
      const validation = validatePattern(value);
      setPatternValidation(validation);
    } else {
      setPatternValidation(null);
    }
  };

  // 패턴 텍스트를 적용
  const applyPatternInput = () => {
    if (!patternValidation || !patternValidation.isValid) {
      return;
    }

    // 검증된 토큰을 패턴 배열에 추가
    const newPatternArray = patternValidation.tokens.map(token =>
      token === 'O' ? 'OFF' : token
    ) as ShiftType[];

    setPattern(prev => ({
      ...prev,
      defaultPatterns: [
        ...(prev.defaultPatterns || []),
        newPatternArray,
      ],
    }));

    // 입력 초기화
    setPatternInput('');
    setPatternValidation(null);
  };

  // 예시 패턴 적용
  const applyExamplePattern = (examplePattern: string) => {
    setPatternInput(examplePattern);
    const validation = validatePattern(examplePattern);
    setPatternValidation(validation);
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
      // POST: 새 패턴 생성 - 필요한 필드만 전송
      // PUT: 기존 패턴 수정 - id를 쿼리 파라미터로 전송
      const url = pattern.id
        ? `/api/team-patterns?id=${pattern.id}`
        : '/api/team-patterns';

      const body = pattern.id
        ? {
            // PUT: 수정 가능한 필드만
            requiredStaffDay: pattern.requiredStaffDay,
            requiredStaffEvening: pattern.requiredStaffEvening,
            requiredStaffNight: pattern.requiredStaffNight,
            defaultPatterns: pattern.defaultPatterns,
            avoidPatterns: pattern.avoidPatterns || [], // 기피 패턴 포함
            totalMembers: pattern.totalMembers,
          }
        : {
            // POST: 생성에 필요한 필드만
            departmentId,
            requiredStaffDay: pattern.requiredStaffDay || 5,
            requiredStaffEvening: pattern.requiredStaffEvening || 4,
            requiredStaffNight: pattern.requiredStaffNight || 3,
            defaultPatterns: pattern.defaultPatterns || [['D', 'D', 'D', 'OFF', 'OFF']],
            avoidPatterns: pattern.avoidPatterns || [], // 기피 패턴 포함
            totalMembers,
          };

      // 📋 상세 로깅: 어떤 부서에서 어떻게 저장되는지 명확히 표시
      console.log('\n🔵 ============== Team Pattern 저장 시작 ==============');
      console.log('📍 부서 정보:');
      console.log(`   - Department ID: ${departmentId || '(없음)'}`);
      console.log(`   - Department Name: ${departmentName || '(이름 없음)'}`);
      console.log('\n📝 저장 모드:', pattern.id ? `UPDATE (ID: ${pattern.id})` : 'CREATE (신규)');
      console.log('\n📊 저장할 데이터:');
      console.log('   - 주간(D) 필요 인원:', body.requiredStaffDay || pattern.requiredStaffDay, '명');
      console.log('   - 저녁(E) 필요 인원:', body.requiredStaffEvening || pattern.requiredStaffEvening, '명');
      console.log('   - 야간(N) 필요 인원:', body.requiredStaffNight || pattern.requiredStaffNight, '명');
      console.log('   - 전체 인원:', body.totalMembers || totalMembers, '명');
      console.log('   - 기본 패턴 개수:', (body.defaultPatterns || pattern.defaultPatterns)?.length || 0, '개');
      console.log('   - 기피 패턴 개수:', (body.avoidPatterns || pattern.avoidPatterns || []).length, '개');
      console.log('\n📦 전체 요청 본문:', JSON.stringify(body, null, 2));
      console.log('🌐 API URL:', url);
      console.log('📡 HTTP Method:', pattern.id ? 'PUT' : 'POST');
      console.log('🔵 ================================================\n');

      const response = await fetch(url, {
        method: pattern.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        console.log('\n❌ ============== Team Pattern 저장 실패 ==============');
        console.log('📍 부서:', departmentName || departmentId);
        console.log('❌ 에러:', error);
        console.log('❌ ================================================\n');
        setErrors(error.details || [error.error]);
        return;
      }

      const result = await response.json();
      console.log('\n✅ ============== Team Pattern 저장 성공 ==============');
      console.log('📍 부서:', departmentName || departmentId);
      console.log('✅ 응답 데이터:', result);
      console.log('✅ 저장된 Pattern ID:', result.pattern?.id);
      console.log('✅ ================================================\n');

      setPattern(result.pattern);
      setSuccessMessage('Team Pattern이 성공적으로 저장되었습니다.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.log('\n💥 ============== Team Pattern 저장 오류 ==============');
      console.log('📍 부서:', departmentName || departmentId);
      console.log('💥 예외 발생:', error);
      console.log('💥 ================================================\n');
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

        {/* 텍스트 입력으로 패턴 추가 */}
        {canEdit && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-start gap-2 mb-2">
              <Keyboard className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  패턴 직접 입력
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  하이픈(-), 쉼표(,), 공백으로 구분하여 입력하세요. 예: N-N-N-OFF-OFF
                </p>
              </div>
              <button
                onClick={() => setShowPatternHelp(!showPatternHelp)}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="도움말"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>

            {/* 도움말 */}
            {showPatternHelp && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="text-xs text-blue-900 space-y-2">
                  <div>
                    <p className="font-medium mb-1">✅ 유효한 키워드:</p>
                    <div className="grid grid-cols-2 gap-1 ml-2">
                      {Object.entries(KEYWORD_DESCRIPTIONS).map(([token, desc]) => (
                        <div key={token} className="flex items-center gap-1">
                          <span className="font-mono font-bold">{token}:</span>
                          <span className="text-gray-600">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium mb-1">📝 예시:</p>
                    <div className="ml-2 space-y-1">
                      {EXAMPLE_PATTERNS.slice(0, 3).map((ex, idx) => (
                        <button
                          key={idx}
                          onClick={() => applyExamplePattern(ex.pattern)}
                          className="block w-full text-left hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                        >
                          <span className="font-mono">{ex.pattern}</span>
                          <span className="text-gray-500 ml-2">→ {ex.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 입력 필드 */}
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={patternInput}
                  onChange={(e) => handlePatternInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && patternValidation?.isValid) {
                      applyPatternInput();
                    }
                  }}
                  placeholder="예: N-N-N-OFF-OFF 또는 D,D,D,OFF,OFF (Enter로 추가)"
                  className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${
                    patternValidation?.isValid
                      ? 'border-green-300 bg-green-50 focus:ring-green-500'
                      : patternValidation?.errors.length
                      ? 'border-red-300 bg-red-50 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  } focus:outline-none focus:ring-2`}
                />

                {/* 실시간 검증 피드백 */}
                {patternValidation && (
                  <div className="mt-2 space-y-1">
                    {/* 에러 메시지 */}
                    {patternValidation.errors.length > 0 && (
                      <div className="flex items-start gap-1 text-xs text-red-600">
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <div>
                          {patternValidation.errors.map((err, idx) => (
                            <div key={idx}>{err}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 경고 메시지 */}
                    {patternValidation.warnings.length > 0 && (
                      <div className="flex items-start gap-1 text-xs text-amber-600">
                        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <div>
                          {patternValidation.warnings.map((warn, idx) => (
                            <div key={idx}>{warn}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 성공 메시지 */}
                    {patternValidation.isValid && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="w-3 h-3" />
                        <span>
                          유효한 패턴: {describePattern(patternValidation.tokens)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={applyPatternInput}
                disabled={!patternValidation?.isValid}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {pattern.defaultPatterns?.map((patternArray, patternIndex) => (
            <div key={patternIndex} className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1 flex-wrap">
                {patternArray.map((shift, dayIndex) => (
                  <div key={dayIndex} className="inline-flex items-center gap-0.5 group">
                    <select
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
                      {shiftTypes.map((st) => (
                        <option key={st.id} value={st.code}>
                          {st.code}
                        </option>
                      ))}
                      <option value="OFF">OFF</option>
                    </select>
                    {canEdit && patternArray.length > 1 && (
                      <button
                        onClick={() => removeDayFromPattern(patternIndex, dayIndex)}
                        className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition-opacity"
                        title="이 날짜 제거"
                      >
                        <span className="text-xs text-red-600">✕</span>
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <button
                    onClick={() => addDayToPattern(patternIndex)}
                    className="p-1 text-blue-600 hover:text-blue-700"
                    title="날짜 추가"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => removePattern(patternIndex)}
                className="p-1 text-red-600 hover:text-red-700"
                title="패턴 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 p-3 bg-blue-50 rounded-md">
          <p className="text-xs text-blue-700">
            * 개인 선호도가 입력되지 않은 직원은 위 기본 패턴이 자동으로 적용됩니다.
          </p>
        </div>
      </div>

      {/* 기피 근무 패턴 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              기피 근무 패턴 (선택사항)
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              피해야 할 연속 시프트 조합을 설정하세요. 예: 야간 2일 후 주간 근무
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setPattern(prev => ({
                ...prev,
                avoidPatterns: [
                  ...(prev.avoidPatterns || []),
                  ['N', 'D']
                ],
              }))}
              className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              기피 패턴 추가
            </button>
          )}
        </div>

        <div className="space-y-3">
          {pattern.avoidPatterns && pattern.avoidPatterns.length > 0 ? (
            pattern.avoidPatterns.map((avoidArray, patternIndex) => (
              <div key={patternIndex} className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex-1 flex items-center gap-1 flex-wrap">
                  {avoidArray.map((shift, dayIndex) => (
                    <div key={dayIndex} className="inline-flex items-center gap-0.5 group">
                      <select
                        value={shift}
                        onChange={(e) => {
                          setPattern(prev => {
                            const newPatterns = [...(prev.avoidPatterns || [])];
                            newPatterns[patternIndex] = [...newPatterns[patternIndex]];
                            newPatterns[patternIndex][dayIndex] = e.target.value as ShiftType;
                            return { ...prev, avoidPatterns: newPatterns };
                          });
                        }}
                        disabled={!canEdit}
                        className={`px-2 py-1 border rounded text-sm font-medium ${
                          shift === 'D' ? 'bg-blue-100 border-blue-400 text-blue-800' :
                          shift === 'E' ? 'bg-purple-100 border-purple-400 text-purple-800' :
                          shift === 'N' ? 'bg-indigo-100 border-indigo-400 text-indigo-800' :
                          'bg-gray-100 border-gray-400 text-gray-800'
                        } disabled:opacity-50`}
                      >
                        {shiftTypes.map((st) => (
                          <option key={st.id} value={st.code}>
                            {st.code}
                          </option>
                        ))}
                      </select>
                      {canEdit && avoidArray.length > 2 && (
                        <button
                          onClick={() => {
                            setPattern(prev => {
                              const newPatterns = [...(prev.avoidPatterns || [])];
                              newPatterns[patternIndex] = newPatterns[patternIndex].filter((_, i) => i !== dayIndex);
                              return { ...prev, avoidPatterns: newPatterns };
                            });
                          }}
                          className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded transition-opacity"
                          title="이 시프트 제거"
                        >
                          <span className="text-xs text-red-700">✕</span>
                        </button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <button
                      onClick={() => {
                        setPattern(prev => {
                          const newPatterns = [...(prev.avoidPatterns || [])];
                          newPatterns[patternIndex] = [...newPatterns[patternIndex], 'D'];
                          return { ...prev, avoidPatterns: newPatterns };
                        });
                      }}
                      className="p-1 text-red-600 hover:text-red-700"
                      title="시프트 추가"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={() => {
                      setPattern(prev => ({
                        ...prev,
                        avoidPatterns: prev.avoidPatterns?.filter((_, i) => i !== patternIndex) || [],
                      }));
                    }}
                    className="p-1 text-red-700 hover:text-red-800"
                    title="기피 패턴 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md text-center">
              <p className="text-sm text-gray-500">
                설정된 기피 패턴이 없습니다. 필요한 경우 위 버튼으로 추가하세요.
              </p>
            </div>
          )}
        </div>

        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-800">
              <p className="font-medium mb-1">기피 패턴 사용 예시:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><span className="font-mono">N-D</span>: 야간 근무 직후 주간 근무는 피함</li>
                <li><span className="font-mono">N-N-D</span>: 야간 2일 후 주간 근무는 피함</li>
                <li><span className="font-mono">D-D-D-D-D-D</span>: 주간 6일 연속 근무는 피함</li>
              </ul>
              <p className="mt-2 text-amber-700">
                * 스케줄 생성 시 이 패턴들이 발생하지 않도록 조정됩니다.
              </p>
            </div>
          </div>
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