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
  Keyboard,
  Loader2
} from 'lucide-react';
import { LottieLoadingOverlay } from '@/components/common/LottieLoadingOverlay';
import {
  TeamPattern,
  validateTeamPattern,
} from '@/lib/types/team-pattern';
import {
  validatePattern,
  describePattern,
  EXAMPLE_PATTERNS,
  KEYWORD_DESCRIPTIONS,
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

const teamPatternCache = new Map<string, { pattern: Partial<TeamPattern>; timestamp: number }>();

export function TeamPatternPanel({
  departmentId,
  departmentName,
  totalMembers,
  canEdit,
  shiftTypes
}: TeamPatternPanelProps) {
  // shiftTypes가 변경될 때 로그 출력
  React.useEffect(() => {
    console.log('[TeamPatternPanel] shiftTypes updated:', shiftTypes);
  }, [shiftTypes]);

  const [pattern, setPattern] = useState<Partial<TeamPattern>>({
    departmentId,
    totalMembers: totalMembers ?? 0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  // 패턴 텍스트 입력 관련 상태
  const [patternInput, setPatternInput] = useState('');
  const [patternValidation, setPatternValidation] = useState<ReturnType<typeof validatePattern> | null>(null);
  const [showPatternHelp, setShowPatternHelp] = useState(false);

  // 기피 패턴 텍스트 입력 관련 상태
  const [avoidPatternInput, setAvoidPatternInput] = useState('');
  const [avoidPatternValidation, setAvoidPatternValidation] = useState<ReturnType<typeof validatePattern> | null>(null);
  const [showAvoidPatternHelp, setShowAvoidPatternHelp] = useState(false);

  const fetchTeamPattern = React.useCallback(
    async (options: { silent?: boolean; force?: boolean } = {}) => {
      const { silent, force } = options;
      if (!departmentId || departmentId === 'all') {
        return;
      }

      if (!silent) {
        setLoading(true);
      }

      try {
        const response = await fetch(`/api/department-patterns?departmentId=${departmentId}`);
        const data = await response.json();

        let nextPattern: Partial<TeamPattern> | undefined;
        if (data.pattern) {
          nextPattern = data.pattern;
        } else if (data.defaultPattern) {
          nextPattern = { ...data.defaultPattern, totalMembers };
        }

        if (nextPattern) {
          setPattern(nextPattern);
          teamPatternCache.set(departmentId, { pattern: nextPattern, timestamp: Date.now() });
        } else if (force) {
          teamPatternCache.delete(departmentId);
        }
      } catch (error) {
        console.error('Failed to fetch team pattern:', error);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [departmentId, totalMembers]
  );

  // Department Pattern 불러오기 및 캐싱
  useEffect(() => {
    if (!departmentId || departmentId === 'all') {
      setLoading(false);
      return;
    }

    const cachedEntry = teamPatternCache.get(departmentId);
    if (cachedEntry && cachedEntry.pattern) {
      setPattern(prev => ({
        ...cachedEntry.pattern,
        totalMembers: cachedEntry.pattern.totalMembers ?? prev?.totalMembers ?? totalMembers ?? 0,
      }));
      setLoading(false);
      // 백그라운드 최신화
      void fetchTeamPattern({ silent: true });
    } else {
      void fetchTeamPattern();
    }
  }, [departmentId, totalMembers, fetchTeamPattern]);

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
        ['D', 'O']
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
  const updatePattern = (patternIndex: number, dayIndex: number, value: string) => {
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
      newPatterns[patternIndex] = [...newPatterns[patternIndex], 'O'];

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

  // shiftTypes 기반으로 커스텀 키워드 맵 생성
  const customKeywords = React.useMemo(() => {
    if (!shiftTypes || shiftTypes.length === 0) return undefined;

    const keywords: Record<string, string> = {};
    shiftTypes.forEach(st => {
      // code를 키워드로 등록
      keywords[st.code.toUpperCase()] = st.code;

      // name도 키워드로 등록 (예: DAY, EVENING, NIGHT)
      keywords[st.name.toUpperCase()] = st.code;
    });

    console.log('[TeamPatternPanel] Generated custom keywords:', keywords);
    return keywords;
  }, [shiftTypes]);

  // Tailwind 색상 이름을 hex 코드로 변환
  const colorMap: Record<string, string> = {
    blue: '#3b82f6',
    green: '#22c55e',
    amber: '#f59e0b',
    red: '#ef4444',
    purple: '#a855f7',
    indigo: '#6366f1',
    pink: '#ec4899',
    gray: '#6b7280',
  };

  // shiftTypes 기반으로 색상 스타일 가져오기
  const getShiftColorStyle = React.useCallback((shiftCode: string) => {
    const shiftType = shiftTypes.find(st => st.code === shiftCode);

    if (!shiftType) {
      console.log(`[getShiftColorStyle] Shift type not found for code: ${shiftCode}`);
      return 'bg-gray-50 border-gray-300 text-gray-700';
    }

    if (!shiftType.color) {
      console.log(`[getShiftColorStyle] No color for shift type:`, shiftType);
      return 'bg-gray-50 border-gray-300 text-gray-700';
    }

    // Tailwind 색상 이름을 hex 코드로 변환
    const hexColor = colorMap[shiftType.color.toLowerCase()] || shiftType.color;

    console.log(`[getShiftColorStyle] Code: ${shiftCode}, Color: ${shiftType.color} -> ${hexColor}`);

    // hex 코드를 사용하여 인라인 스타일 생성
    return {
      backgroundColor: `${hexColor}20`, // 20% opacity for background
      borderColor: hexColor,
      color: hexColor,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftTypes]);

  // 패턴 텍스트 입력 핸들러
  const handlePatternInputChange = (value: string) => {
    setPatternInput(value);

    // 실시간 검증 (커스텀 키워드 사용)
    if (value.trim()) {
      const validation = validatePattern(value, customKeywords);
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
    const newPatternArray = patternValidation.tokens as string[];

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

  // 기피 패턴 텍스트 입력 핸들러
  const handleAvoidPatternInputChange = (value: string) => {
    setAvoidPatternInput(value);

    // 실시간 검증 (커스텀 키워드 사용)
    if (value.trim()) {
      const validation = validatePattern(value, customKeywords);
      // 기피 패턴은 OFF를 포함할 수 없음 - 추가 검증
      if (validation.isValid && validation.tokens.includes('O')) {
        setAvoidPatternValidation({
          ...validation,
          isValid: false,
          errors: ['기피 패턴에는 OFF(O)를 포함할 수 없습니다. 근무 시프트만 조합하세요.'],
        });
      } else {
        setAvoidPatternValidation(validation);
      }
    } else {
      setAvoidPatternValidation(null);
    }
  };

  // 기피 패턴 텍스트를 적용
  const applyAvoidPatternInput = () => {
    if (!avoidPatternValidation || !avoidPatternValidation.isValid) {
      return;
    }

    // 검증된 토큰을 기피 패턴 배열에 추가
    const newPatternArray = avoidPatternValidation.tokens as string[];

    setPattern(prev => ({
      ...prev,
      avoidPatterns: [
        ...(prev.avoidPatterns || []),
        newPatternArray,
      ],
    }));

    // 입력 초기화
    setAvoidPatternInput('');
    setAvoidPatternValidation(null);
  };

  // 기피 패턴 예시 적용
  const applyAvoidExamplePattern = (examplePattern: string) => {
    setAvoidPatternInput(examplePattern);
    const validation = validatePattern(examplePattern);
    // OFF 체크
    if (validation.isValid && validation.tokens.includes('O')) {
      setAvoidPatternValidation({
        ...validation,
        isValid: false,
        errors: ['기피 패턴에는 OFF(O)를 포함할 수 없습니다. 근무 시프트만 조합하세요.'],
      });
    } else {
      setAvoidPatternValidation(validation);
    }
  };

  // 저장
  const handleSave = async () => {
    // shift_types 기반으로 유효한 코드 목록 생성
    const validShiftCodes = shiftTypes.map((st) => st.code);

    // 'O' 코드가 있으면 'OFF' 별칭도 허용
    if (validShiftCodes.includes('O') && !validShiftCodes.includes('OFF')) {
      validShiftCodes.push('OFF');
    }

    console.log('[handleSave] Validating with shift codes:', validShiftCodes);

    // 검증
    const validation = validateTeamPattern({ ...pattern, totalMembers }, validShiftCodes);
    if (!validation.isValid) {
      console.log('[handleSave] Validation failed:', validation.errors);
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    setErrors([]);

    try {
      // POST: 새 패턴 생성 - 필요한 필드만 전송
      // PUT: 기존 패턴 수정 - id를 쿼리 파라미터로 전송
      const url = pattern.id
        ? `/api/department-patterns?id=${pattern.id}`
        : '/api/department-patterns';

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
            defaultPatterns: pattern.defaultPatterns || [['D', 'D', 'D', 'O', 'O']],
            avoidPatterns: pattern.avoidPatterns || [], // 기피 패턴 포함
            totalMembers,
          };

      // 📋 상세 로깅: 어떤 부서에서 어떻게 저장되는지 명확히 표시
      console.log('\n🔵 ============== Department Pattern 저장 시작 ==============');
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
        console.log('\n❌ ============== Department Pattern 저장 실패 ==============');
        console.log('📍 부서:', departmentName || departmentId);
        console.log('❌ 에러:', error);
        console.log('❌ ================================================\n');
        setErrors(error.details || [error.error]);
        return;
      }

      const result = await response.json();
      console.log('\n✅ ============== Department Pattern 저장 성공 ==============');
      console.log('📍 부서:', departmentName || departmentId);
      console.log('✅ 응답 데이터:', result);
      console.log('✅ 저장된 Pattern ID:', result.pattern?.id);
      console.log('✅ ================================================\n');

      setPattern(result.pattern);
      teamPatternCache.set(departmentId, result.pattern);
      setSuccessMessage('부서 패턴이 성공적으로 저장되었습니다.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.log('\n💥 ============== Department Pattern 저장 오류 ==============');
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
        <LottieLoadingOverlay message="부서 패턴을 불러오는 중입니다..." />
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">부서 패턴 설정</h2>
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
                  하이픈(-), 쉼표(,), 공백으로 구분하여 입력하세요. 예: N-N-N-O-O
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
                  placeholder="예: N-N-N-O-O 또는 D,D,D,O,O (Enter로 추가)"
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
                {patternArray.map((shift, dayIndex) => {
                  const colorStyle = getShiftColorStyle(shift);
                  const isStyleObject = typeof colorStyle === 'object';

                  return (
                  <div key={dayIndex} className="inline-flex items-center gap-0.5 group">
                    <select
                      value={shift}
                      onChange={(e) => updatePattern(patternIndex, dayIndex, e.target.value)}
                      disabled={!canEdit}
                      className={`px-2 py-1 border rounded text-sm font-medium disabled:opacity-50 ${
                        isStyleObject ? '' : colorStyle
                      }`}
                      style={isStyleObject ? colorStyle as React.CSSProperties : undefined}
                    >
                      {shiftTypes.map((st) => (
                        <option key={st.id} value={st.code}>
                          {st.code}
                        </option>
                      ))}
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
                  );
                })}
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

        {/* 텍스트 입력으로 기피 패턴 추가 */}
        {canEdit && (
          <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-start gap-2 mb-2">
              <Keyboard className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  기피 패턴 직접 입력
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  하이픈(-), 쉼표(,), 공백으로 구분하여 입력하세요. 예: N-N-D (야간 2일 후 주간 금지)
                </p>
              </div>
              <button
                onClick={() => setShowAvoidPatternHelp(!showAvoidPatternHelp)}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="도움말"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>

            {/* 도움말 */}
            {showAvoidPatternHelp && (
              <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded-md">
                <div className="text-xs text-red-900 space-y-2">
                  <div>
                    <p className="font-medium mb-1">✅ 유효한 키워드 (OFF 제외):</p>
                    <div className="grid grid-cols-2 gap-1 ml-2">
                      <div key="D" className="flex items-center gap-1">
                        <span className="font-mono font-bold">D:</span>
                        <span className="text-gray-700">주간 근무</span>
                      </div>
                      <div key="E" className="flex items-center gap-1">
                        <span className="font-mono font-bold">E:</span>
                        <span className="text-gray-700">저녁 근무</span>
                      </div>
                      <div key="N" className="flex items-center gap-1">
                        <span className="font-mono font-bold">N:</span>
                        <span className="text-gray-700">야간 근무</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium mb-1">📝 예시 (클릭하여 적용):</p>
                    <div className="ml-2 space-y-1">
                      <button
                        onClick={() => applyAvoidExamplePattern('N-D')}
                        className="block w-full text-left hover:bg-red-200 px-2 py-1 rounded transition-colors"
                      >
                        <span className="font-mono">N-D</span>
                        <span className="text-gray-700 ml-2">→ 야간 직후 주간 금지</span>
                      </button>
                      <button
                        onClick={() => applyAvoidExamplePattern('N-N-D')}
                        className="block w-full text-left hover:bg-red-200 px-2 py-1 rounded transition-colors"
                      >
                        <span className="font-mono">N-N-D</span>
                        <span className="text-gray-700 ml-2">→ 야간 2일 후 주간 금지</span>
                      </button>
                      <button
                        onClick={() => applyAvoidExamplePattern('E-E-N')}
                        className="block w-full text-left hover:bg-red-200 px-2 py-1 rounded transition-colors"
                      >
                        <span className="font-mono">E-E-N</span>
                        <span className="text-gray-700 ml-2">→ 저녁 2일 후 야간 금지</span>
                      </button>
                      <button
                        onClick={() => applyAvoidExamplePattern('D-D-D-D-D-D')}
                        className="block w-full text-left hover:bg-red-200 px-2 py-1 rounded transition-colors"
                      >
                        <span className="font-mono">D-D-D-D-D-D</span>
                        <span className="text-gray-700 ml-2">→ 주간 6일 연속 금지</span>
                      </button>
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
                  value={avoidPatternInput}
                  onChange={(e) => handleAvoidPatternInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && avoidPatternValidation?.isValid) {
                      applyAvoidPatternInput();
                    }
                  }}
                  placeholder="예: N-N-D 또는 E,E,N (Enter로 추가)"
                  className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${
                    avoidPatternValidation?.isValid
                      ? 'border-green-300 bg-green-50 focus:ring-green-500'
                      : avoidPatternValidation?.errors.length
                      ? 'border-red-300 bg-red-50 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-red-500'
                  } focus:outline-none focus:ring-2`}
                />

                {/* 실시간 검증 피드백 */}
                {avoidPatternValidation && (
                  <div className="mt-2 space-y-1">
                    {/* 에러 메시지 */}
                    {avoidPatternValidation.errors.length > 0 && (
                      <div className="flex items-start gap-1 text-xs text-red-600">
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <div>
                          {avoidPatternValidation.errors.map((err, idx) => (
                            <div key={idx}>{err}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 경고 메시지 */}
                    {avoidPatternValidation.warnings.length > 0 && (
                      <div className="flex items-start gap-1 text-xs text-amber-600">
                        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <div>
                          {avoidPatternValidation.warnings.map((warn, idx) => (
                            <div key={idx}>{warn}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 성공 메시지 */}
                    {avoidPatternValidation.isValid && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="w-3 h-3" />
                        <span>
                          유효한 기피 패턴: {describePattern(avoidPatternValidation.tokens)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={applyAvoidPatternInput}
                disabled={!avoidPatternValidation?.isValid}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {pattern.avoidPatterns && pattern.avoidPatterns.length > 0 ? (
            pattern.avoidPatterns.map((avoidArray, patternIndex) => (
              <div key={patternIndex} className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex-1 flex items-center gap-1 flex-wrap">
                  {avoidArray.map((shift, dayIndex) => {
                    const colorStyle = getShiftColorStyle(shift);
                    const isStyleObject = typeof colorStyle === 'object';
                    // 기피 패턴은 좀 더 진한 색상 사용
                    const avoidColorStyle = isStyleObject ? {
                      backgroundColor: `${(colorStyle as Record<string, string>).borderColor}30`, // 30% opacity for more emphasis
                      borderColor: (colorStyle as Record<string, string>).borderColor,
                      color: (colorStyle as Record<string, string>).color,
                    } : colorStyle.replace('50', '100').replace('300', '400').replace('700', '800');

                    return (
                    <div key={dayIndex} className="inline-flex items-center gap-0.5 group">
                      <select
                        value={shift}
                        onChange={(e) => {
                          setPattern(prev => {
                            const newPatterns = [...(prev.avoidPatterns || [])];
                            newPatterns[patternIndex] = [...newPatterns[patternIndex]];
                            newPatterns[patternIndex][dayIndex] = e.target.value;
                            return { ...prev, avoidPatterns: newPatterns };
                          });
                        }}
                        disabled={!canEdit}
                        className={`px-2 py-1 border rounded text-sm font-medium disabled:opacity-50 ${
                          isStyleObject ? '' : avoidColorStyle
                        }`}
                        style={isStyleObject ? avoidColorStyle as React.CSSProperties : undefined}
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
                    );
                  })}
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
            className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      )}
    </div>
  );
}
