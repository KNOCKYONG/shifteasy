"use client";
import { useState, useEffect } from "react";
import { User, Heart, Calendar, Clock, Users, Shield, X, Save, AlertCircle, Star, UserCheck, UserMinus, ChevronLeft, ChevronRight, Info, CheckCircle, Wallet } from "lucide-react";
import { type Employee, type EmployeePreferences, type ShiftType } from "@/lib/types/scheduler";
import { validatePattern as validatePatternUtil, describePattern, EXAMPLE_PATTERNS, KEYWORD_DESCRIPTIONS, type ShiftToken } from "@/lib/utils/pattern-validator";
import { api } from "@/lib/trpc/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import type { SimplifiedPreferences } from "@/components/department/MyPreferencesPanel";

interface EmployeePreferencesModalProps {
  employee: Employee;
  onSave: (preferences: ExtendedEmployeePreferences) => void;
  onClose: () => void;
  initialPreferences?: SimplifiedPreferences;
}

// 근무 패턴 타입 정의
export type WorkPatternType = 'three-shift' | 'night-intensive' | 'weekday-only';

// 확장된 직원 선호도 인터페이스
export interface ExtendedEmployeePreferences extends EmployeePreferences {
  // 근무 패턴
  workPatternType?: WorkPatternType;

  // 기본 선호도
  avoidShifts: ShiftType[];
  maxConsecutiveDays: number;
  preferNightShift: boolean;
  preferredPattern?: string;

  // 확장된 선호도
  workLoadPreference: 'light' | 'normal' | 'heavy'; // 업무량 선호
  flexibilityLevel: 'low' | 'medium' | 'high'; // 유연성 수준
  preferredPatterns?: string[]; // 선호하는 근무 패턴들 (멀티 선택)
  avoidPatterns?: string[][]; // 기피하는 근무 패턴들 (개인)

  // 팀 선호도
  preferredPartners: string[]; // 선호하는 동료 ID
  avoidPartners: string[]; // 피하고 싶은 동료 ID

  // 경력 개발
  trainingDays: string[]; // 교육 참여 요일
  mentorshipRole: 'none' | 'mentee' | 'mentor'; // 멘토링 역할
  specialization: string[]; // 전문 분야

  // 건강 관련
  healthConsiderations: {
    needsLightDuty: boolean; // 가벼운 업무 필요
    avoidLongShifts: boolean; // 장시간 근무 회피
    requiresRegularBreaks: boolean; // 정기 휴식 필요
    pregnancyAccommodation: boolean; // 임신 관련 배려
  };

  // 통근 관련
  commuteConsiderations: {
    maxCommuteTime: number; // 최대 통근 시간 (분)
    avoidRushHour: boolean; // 출퇴근 시간 회피
    needsParking: boolean; // 주차 필요
    publicTransportDependent: boolean; // 대중교통 의존
  };
}

export function EmployeePreferencesModal({
  employee,
  onSave,
  onClose,
  initialPreferences,
}: EmployeePreferencesModalProps) {
  const buildInitialPreferences = (source?: SimplifiedPreferences): ExtendedEmployeePreferences => {
    const basePrefs = {
      workPatternType: 'three-shift' as WorkPatternType,
      workLoadPreference: 'normal' as const,
      flexibilityLevel: 'medium' as const,
      preferredPartners: [],
      avoidPartners: [],
      trainingDays: [],
      mentorshipRole: 'none' as const,
      specialization: [],
      avoidShifts: [],
      maxConsecutiveDays: 5,
      preferNightShift: false,
      healthConsiderations: {
        needsLightDuty: false,
        avoidLongShifts: false,
        requiresRegularBreaks: false,
        pregnancyAccommodation: false,
      },
      commuteConsiderations: {
        maxCommuteTime: 60,
        avoidRushHour: false,
        needsParking: false,
        publicTransportDependent: false,
      },
      preferredPattern: '',
      preferredPatterns: [],
      avoidPatterns: [],
    };

    const normalizedPreferredPatterns = (source?.preferredPatterns || []).map((patternEntry) => {
      if (typeof patternEntry === 'string') {
        return patternEntry;
      }
      return patternEntry?.pattern ?? '';
    }).filter(Boolean);

    return {
      ...basePrefs,
      workPatternType: source?.workPatternType || employee.workPatternType || 'three-shift',
      preferredPatterns: normalizedPreferredPatterns,
      avoidPatterns: source?.avoidPatterns || [],
    } as ExtendedEmployeePreferences;
  };

  const [preferences, setPreferences] = useState<ExtendedEmployeePreferences>(() => {
    return buildInitialPreferences(initialPreferences);
  });
  const [hasHydratedFromInitial, setHasHydratedFromInitial] = useState<boolean>(!!initialPreferences);

  useEffect(() => {
    setPreferences(buildInitialPreferences(initialPreferences));
    setHasHydratedFromInitial(!!initialPreferences);
  }, [employee.id]);

  useEffect(() => {
    if (!initialPreferences || hasHydratedFromInitial) {
      return;
    }
    setPreferences(buildInitialPreferences(initialPreferences));
    setHasHydratedFromInitial(true);
  }, [initialPreferences, hasHydratedFromInitial]);

  const [activeTab, setActiveTab] = useState<'basic' | 'request' | 'off-balance'>('basic');
  const [customPatternInput, setCustomPatternInput] = useState('');
  const [patternValidation, setPatternValidation] = useState<ReturnType<typeof validatePatternUtil> | null>(null);
  const [showPatternHelp, setShowPatternHelp] = useState(false);

  // 기피 패턴 텍스트 입력 관련 상태
  const [avoidPatternInput, setAvoidPatternInput] = useState('');
  const [avoidPatternValidation, setAvoidPatternValidation] = useState<ReturnType<typeof validatePatternUtil> | null>(null);
  const [showAvoidPatternHelp, setShowAvoidPatternHelp] = useState(false);

  // Off-balance data state
  const [offBalanceData, setOffBalanceData] = useState<{
    preferences: {
      accumulatedOffDays: number;
      allocatedToAccumulation: number;
      allocatedToAllowance: number;
    };
    history: Array<{
      id: string;
      year: number;
      month: number;
      guaranteedOffDays: number;
      actualOffDays: number;
      remainingOffDays: number;
      compensationType: string | null;
      status: string;
    }>;
  } | null>(null);

  // Local state for allocation inputs
  const [allocToAccumulation, setAllocToAccumulation] = useState(0);
  const [allocToAllowance, setAllocToAllowance] = useState(0);

  // Fetch off-balance data
  const { data: offBalance, refetch: refetchOffBalance } = api.offBalance.getByEmployee.useQuery(
    { employeeId: employee.id },
    { enabled: activeTab === 'off-balance' }
  );

  // Update offBalanceData when query data changes
  useEffect(() => {
    if (offBalance) {
      // Transform null values to 0 for type safety
      setOffBalanceData({
        preferences: {
          accumulatedOffDays: offBalance.preferences.accumulatedOffDays ?? 0,
          allocatedToAccumulation: offBalance.preferences.allocatedToAccumulation ?? 0,
          allocatedToAllowance: offBalance.preferences.allocatedToAllowance ?? 0,
        },
        history: offBalance.history.map(record => ({
          id: record.id,
          year: record.year,
          month: record.month,
          guaranteedOffDays: record.guaranteedOffDays ?? 0,
          actualOffDays: record.actualOffDays ?? 0,
          remainingOffDays: record.remainingOffDays ?? 0,
          compensationType: record.compensationType,
          status: record.status ?? 'pending',
        })),
      });
      // Initialize allocation inputs with current values
      setAllocToAccumulation(offBalance.preferences.allocatedToAccumulation ?? 0);
      setAllocToAllowance(offBalance.preferences.allocatedToAllowance ?? 0);
    }
  }, [offBalance]);

  // Update allocation mutation
  const updateAllocationMutation = api.offBalance.updateAllocation.useMutation({
    onSuccess: () => {
      refetchOffBalance();
      alert('OFF 배분이 저장되었습니다');
    },
    onError: (error) => {
      alert('저장 실패: ' + error.message);
    }
  });

  // Handle allocation save
  const handleSaveAllocation = () => {
    updateAllocationMutation.mutate({
      employeeId: employee.id,
      allocatedToAccumulation: allocToAccumulation,
      allocatedToAllowance: allocToAllowance,
    });
  };
  // Request 탭을 위한 state
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [shiftRequests, setShiftRequests] = useState<Record<string, string>>({});

  // Custom shift types from config
  interface CustomShiftType {
    code: string;
    name: string;
    startTime: string;
    endTime: string;
    color: string;
    allowOvertime: boolean;
  }
  const [customShiftTypes, setCustomShiftTypes] = useState<CustomShiftType[]>([]);

  // tRPC utils and mutations for managing special requests
  const utils = api.useUtils();
  const createSpecialRequest = api.specialRequests.create.useMutation({
    onSuccess: async () => {
      // 캐시 무효화로 UI 자동 업데이트
      await utils.specialRequests.getByDateRange.invalidate();
    },
  });

  const deleteShiftRequests = api.specialRequests.deleteByEmployeeAndDateRange.useMutation({
    onSuccess: async () => {
      // 캐시 무효화로 UI 자동 업데이트
      await utils.specialRequests.getByDateRange.invalidate();
    },
  });

  // Load shift types from shift_types table
  const { data: shiftTypesFromDB } = api.shiftTypes.getAll.useQuery();

  // Query to fetch existing special requests for the selected month
  const { data: existingRequests } = api.specialRequests.getByDateRange.useQuery({
    startDate: format(startOfMonth(selectedMonth), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(selectedMonth), 'yyyy-MM-dd'),
    employeeId: employee.id,
    status: 'pending',
  });

  // Load custom shift types from shift_types table with fallback chain
  useEffect(() => {
    let loadedShiftTypes: CustomShiftType[] = [];

    // Try to load from shift_types table (DB) first
    if (shiftTypesFromDB && shiftTypesFromDB.length > 0) {
      // Transform from shift_types table format to CustomShiftType format
      loadedShiftTypes = shiftTypesFromDB.map(st => ({
        code: st.code,
        name: st.name,
        startTime: st.startTime,
        endTime: st.endTime,
        color: st.color,
        allowOvertime: false, // Default value for backward compatibility
      }));
      console.log('✅ EmployeePreferencesModal: Loaded shift types from shift_types table:', loadedShiftTypes.length);
    }
    // Fallback to localStorage
    else if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('customShiftTypes');
      if (stored) {
        try {
          loadedShiftTypes = JSON.parse(stored);
          console.log('✅ EmployeePreferencesModal: Loaded shift types from localStorage:', loadedShiftTypes.length);
        } catch (e) {
          console.error('Failed to parse customShiftTypes from localStorage:', e);
        }
      }
    }

    // If still empty, use default shift types
    if (!loadedShiftTypes || loadedShiftTypes.length === 0) {
      console.warn('⚠️ EmployeePreferencesModal: Using default shift types');
      loadedShiftTypes = [
        { code: 'D', name: '주간', startTime: '08:00', endTime: '16:00', color: 'blue', allowOvertime: false },
        { code: 'E', name: '저녁', startTime: '16:00', endTime: '24:00', color: 'amber', allowOvertime: false },
        { code: 'N', name: '야간', startTime: '00:00', endTime: '08:00', color: 'purple', allowOvertime: false },
        { code: 'O', name: '휴무', startTime: '00:00', endTime: '00:00', color: 'gray', allowOvertime: false },
        { code: 'V', name: '휴가', startTime: '00:00', endTime: '00:00', color: 'purple', allowOvertime: false },
        { code: 'A', name: '행정', startTime: '09:00', endTime: '18:00', color: 'green', allowOvertime: false },
      ];
    }

    setCustomShiftTypes(loadedShiftTypes);
  }, [shiftTypesFromDB]);

  // Load existing shift requests when data is fetched
  useEffect(() => {
    if (existingRequests && existingRequests.length > 0) {
      const requestsMap: Record<string, string> = {};

      existingRequests.forEach(req => {
        // Each request now has a single date (not a range)
        const dateKey = req.date; // Already in 'yyyy-MM-dd' format
        if (req.shiftTypeCode) {
          requestsMap[dateKey] = req.shiftTypeCode;
        }
      });

      setShiftRequests(requestsMap);
    } else {
      // Clear requests if no data
      setShiftRequests({});
    }
  }, [existingRequests]);

  const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
  const shiftTypes: { value: ShiftType; label: string; color: string }[] = [
    { value: 'day', label: '주간', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'evening', label: '저녁', color: 'bg-purple-100 text-purple-800' },
    { value: 'night', label: '야간', color: 'bg-indigo-100 text-indigo-800' },
    { value: 'off', label: '휴무', color: 'bg-gray-100 text-gray-800 dark:text-gray-200' },
  ];

  const persistShiftRequests = async () => {
    // Save shift requests to database
    try {
      // 1. First, delete all existing shift_request type requests for this employee in the current month
      await deleteShiftRequests.mutateAsync({
        employeeId: employee.id,
        requestType: 'shift_request',
        startDate: format(startOfMonth(selectedMonth), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(selectedMonth), 'yyyy-MM-dd'),
      });
      console.log('✅ Existing shift requests deleted for month:', format(selectedMonth, 'yyyy-MM'));

      // 2. Then create new requests based on current shiftRequests state
      if (Object.keys(shiftRequests).length > 0) {
        // Save each date as an individual request (no grouping)
        // This ensures only selected dates are saved, not date ranges
        const dates = Object.keys(shiftRequests);

        // Save each request
        for (const date of dates) {
          await createSpecialRequest.mutateAsync({
            employeeId: employee.id,
            requestType: 'shift_request',
            shiftTypeCode: shiftRequests[date],
            date: date,
            status: 'pending',
          });
        }

        console.log('✅ Shift requests saved successfully:', dates.length, 'individual dates');
      } else {
        console.log('✅ No shift requests to save (all cleared)');
      }
    } catch (error) {
      console.error('❌ Failed to save shift requests:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      alert(`⚠️ 시프트 요청 저장 실패:\n\n${errorMessage}\n\n선호도는 저장되었지만 시프트 요청은 저장되지 않았습니다.`);
    }
  };
  
  const handleSave = () => {
    void persistShiftRequests();
    onSave(preferences);
  };

  // 패턴 입력 핸들러 (실시간 검증)
  const handlePatternInputChange = (value: string) => {
    setCustomPatternInput(value);

    // 실시간 검증
    if (value.trim()) {
      const validation = validatePatternUtil(value);
      setPatternValidation(validation);
    } else {
      setPatternValidation(null);
    }
  };

  // 패턴 추가
  const addCustomPattern = () => {
    if (!patternValidation || !patternValidation.isValid) {
      return;
    }

    const current = preferences.preferredPatterns || [];

    // 검증된 패턴을 문자열로 변환 (OFF는 그대로, 나머지는 단일 문자)
    const patternString = patternValidation.tokens
      .map(token => token === 'O' ? 'OFF' : token)
      .join('-');

    if (!current.includes(patternString)) {
      setPreferences({
        ...preferences,
        preferredPatterns: [...current, patternString],
      });
      setCustomPatternInput('');
      setPatternValidation(null);
    }
  };

  const removePattern = (pattern: string) => {
    setPreferences({
      ...preferences,
      preferredPatterns: (preferences.preferredPatterns || []).filter(p => p !== pattern),
    });
  };

  // 기피 패턴 텍스트 입력 핸들러
  const handleAvoidPatternInputChange = (value: string) => {
    setAvoidPatternInput(value);

    // 실시간 검증
    if (value.trim()) {
      const validation = validatePatternUtil(value);
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

    // 검증된 토큰을 패턴 배열에 추가
    const newPatternArray = avoidPatternValidation.tokens as string[];

    setPreferences(prev => ({
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

  // 기피 패턴 삭제
  const removeAvoidPattern = (index: number) => {
    setPreferences({
      ...preferences,
      avoidPatterns: (preferences.avoidPatterns || []).filter((_, i) => i !== index),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{employee.name}님의 근무 선호도</h2>
                <p className="text-blue-100 text-sm mt-1">{employee.role} · {employee.departmentId}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
          <nav className="flex space-x-4 px-6" aria-label="Tabs">
            {[
              { id: 'basic', label: '기본 선호도', icon: Clock },
              { id: 'off-balance', label: '잔여 OFF', icon: Wallet },
              { id: 'request', label: 'Request', icon: Star },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 240px)' }}>
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {/* 근무 패턴 */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">근무 패턴</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'three-shift', label: '3교대 근무', description: '주간/저녁/야간 순환 근무' },
                    { value: 'night-intensive', label: '나이트 집중 근무', description: '야간 근무 집중 배치' },
                    { value: 'weekday-only', label: '행정 근무', description: '평일 행정 업무, 주말/공휴일 휴무' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setPreferences({ ...preferences, workPatternType: option.value as WorkPatternType })}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        preferences.workPatternType === option.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{option.label}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              

              {/* 선호 근무 패턴 */}
              <div className={preferences.workPatternType !== 'three-shift' ? 'opacity-50 pointer-events-none' : ''}>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
                  선호 근무 패턴 (다중 선택 가능)
                  {preferences.workPatternType !== 'three-shift' && (
                    <span className="ml-2 text-sm text-gray-500 font-normal">(3교대 근무 선택 시 활성화)</span>
                  )}
                </h3>

                {/* 직접 입력 */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-400">
                      패턴 직접 입력
                    </label>
                    <button
                      onClick={() => setShowPatternHelp(!showPatternHelp)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Info className="w-3 h-3" />
                      {showPatternHelp ? '도움말 숨기기' : '도움말 보기'}
                    </button>
                  </div>

                  {/* 도움말 */}
                  {showPatternHelp && (
                    <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="space-y-2 text-xs">
                          <span className="font-semibold text-blue-900 dark:text-blue-300">예시:</span>
                          <div className="mt-1 space-y-1 text-gray-700 dark:text-gray-300">
                            {EXAMPLE_PATTERNS.map((ex, idx) => (
                              <div key={idx}>• {ex.pattern} - {ex.description}</div>
                            ))}
                          </div>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const isDisabled = preferences.workPatternType !== 'three-shift';
                    return (
                      <>
                        {/* 입력 필드 */}
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={customPatternInput}
                              onChange={(e) => handlePatternInputChange(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && patternValidation?.isValid && !isDisabled) {
                                  addCustomPattern();
                                }
                              }}
                              placeholder="예: N-N-N-OFF-OFF 또는 D,D,D,OFF,OFF (Enter로 추가)"
                              disabled={isDisabled}
                              className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${
                                patternValidation?.isValid
                                  ? 'border-green-300 bg-green-50 dark:bg-green-950/20 focus:ring-green-500'
                                  : patternValidation?.errors.length
                                  ? 'border-red-300 bg-red-50 dark:bg-red-950/20 focus:ring-red-500'
                                  : isDisabled
                                  ? 'bg-gray-100 dark:bg-slate-800 cursor-not-allowed opacity-50'
                                  : 'border-gray-300 dark:border-slate-600 focus:ring-blue-500'
                              } focus:outline-none focus:ring-2`}
                            />

                            {/* 검증 결과 표시 */}
                            {patternValidation && customPatternInput && (
                              <div className="mt-2 space-y-1">
                                {/* 에러 메시지 */}
                                {patternValidation.errors.map((error, idx) => (
                                  <div key={idx} className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>{error}</span>
                                  </div>
                                ))}

                                {/* 경고 메시지 */}
                                {patternValidation.warnings.map((warning, idx) => (
                                  <div key={idx} className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>{warning}</span>
                                  </div>
                                ))}

                                {/* 성공 메시지 */}
                                {patternValidation.isValid && (
                                  <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>
                                      유효한 패턴: {describePattern(patternValidation.tokens)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={addCustomPattern}
                            disabled={!patternValidation?.isValid || isDisabled}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            추가
                          </button>
                        </div>

                        {isDisabled && (
                          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            3교대 근무를 선택하면 패턴을 추가할 수 있습니다.
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* 선택된 패턴들 표시 */}
                {(preferences.preferredPatterns || []).length > 0 && (
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                      선택된 패턴
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(preferences.preferredPatterns || []).map((pattern) => (
                        <span
                          key={pattern}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-mono"
                        >
                          {pattern}
                          <button
                            onClick={() => removePattern(pattern)}
                            className="hover:text-blue-900 dark:hover:text-blue-100"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 기피 근무 패턴 */}
              <div className={preferences.workPatternType !== 'three-shift' ? 'opacity-50 pointer-events-none' : ''}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    기피 근무 패턴 (개인)
                    {preferences.workPatternType !== 'three-shift' && (
                      <span className="ml-2 text-sm text-gray-500 font-normal">(3교대 근무 선택 시 활성화)</span>
                    )}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  피하고 싶은 연속 시프트 조합을 설정하세요. 예: 야간 2일 후 주간 근무
                </p>

                {/* 기피 패턴 직접 입력 */}
                {(() => {
                  const isDisabled = preferences.workPatternType !== 'three-shift';
                  return (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            기피 패턴 직접 입력
                          </label>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            하이픈(-), 쉼표(,), 공백으로 구분하여 입력하세요. 예: N-N-D (야간 2일 후 주간 금지)
                          </p>
                        </div>
                        <button
                          onClick={() => setShowAvoidPatternHelp(!showAvoidPatternHelp)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="도움말"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 도움말 */}
                      {showAvoidPatternHelp && (
                        <div className="mb-3 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md">
                          <div className="text-xs text-red-900 dark:text-red-200 space-y-2">
                            <div>
                              <p className="font-medium mb-1">예시:</p>
                              <div className="ml-2 space-y-1 text-gray-700 dark:text-gray-300">
                                <div>• N-D: 야간 직후 주간 금지</div>
                                <div>• N-N-D: 야간 2일 후 주간 금지</div>
                                <div>• D-D-D-D-D-D: 주간 6일 연속 금지</div>
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
                              if (e.key === 'Enter' && avoidPatternValidation?.isValid && !isDisabled) {
                                applyAvoidPatternInput();
                              }
                            }}
                            placeholder="예: N-N-D 또는 E,E,N (Enter로 추가)"
                            disabled={isDisabled}
                            className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${
                              avoidPatternValidation?.isValid
                                ? 'border-green-300 bg-green-50 dark:bg-green-950/20 focus:ring-green-500'
                                : avoidPatternValidation?.errors.length
                                ? 'border-red-300 bg-red-50 dark:bg-red-950/20 focus:ring-red-500'
                                : isDisabled
                                ? 'bg-gray-100 dark:bg-slate-800 cursor-not-allowed opacity-50'
                                : 'border-gray-300 dark:border-slate-600 focus:ring-red-500'
                            } focus:outline-none focus:ring-2`}
                          />

                          {/* 실시간 검증 피드백 */}
                          {avoidPatternValidation && avoidPatternInput && (
                            <div className="mt-2 space-y-1">
                              {/* 에러 메시지 */}
                              {avoidPatternValidation.errors.map((error, idx) => (
                                <div key={idx} className="flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
                                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <div>{error}</div>
                                </div>
                              ))}

                              {/* 경고 메시지 */}
                              {avoidPatternValidation.warnings.map((warn, idx) => (
                                <div key={idx} className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <div>{warn}</div>
                                </div>
                              ))}

                              {/* 성공 메시지 */}
                              {avoidPatternValidation.isValid && (
                                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
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
                          disabled={!avoidPatternValidation?.isValid || isDisabled}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          추가
                        </button>
                      </div>

                      {isDisabled && (
                        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          3교대 근무를 선택하면 기피 패턴을 추가할 수 있습니다.
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 선택된 기피 패턴들 표시 */}
                {(preferences.avoidPatterns || []).length > 0 && (
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                      설정된 기피 패턴
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(preferences.avoidPatterns || []).map((pattern, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm font-mono"
                        >
                          {pattern.join('-')}
                          <button
                            onClick={() => removeAvoidPattern(index)}
                            className="hover:text-red-900 dark:hover:text-red-100"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 안내 메시지 */}
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-amber-800 dark:text-amber-200">
                      <p className="font-medium mb-1">패턴 우선순위:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>개인 선호 패턴 (최우선)</li>
                        <li>개인 기피 패턴</li>
                        <li>팀 선호 패턴</li>
                        <li>팀 기피 패턴</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'off-balance' && (
            <div className="space-y-6">
              {/* 잔여 OFF 시스템 안내 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                      잔여 OFF 시스템이란?
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      매월 보장받은 OFF 일수만큼 스케줄에 OFF가 배정되지 않으면 잔여 OFF가 발생합니다.
                      잔여 OFF는 다음 달에 수당으로 받거나, OFF를 추가로 사용할 수 있도록 적립할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>


              {/* 현재 적립된 OFF 잔액 */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-purple-500" />
                  현재 적립된 OFF 잔액
                </h3>
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                      {offBalanceData?.preferences.accumulatedOffDays || 0}<span className="text-2xl ml-1">일</span>
                    </div>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      다음 스케줄 작성 시 사용 가능합니다
                    </p>
                  </div>
                </div>
              </div>

              {/* OFF 배분 설정 */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                  OFF 배분 설정
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                  {/* 설명 */}
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    적립된 OFF를 미래 사용(적립)과 수당 지급으로 자유롭게 분배할 수 있습니다.
                  </p>

                  {/* OFF 적립 입력 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      OFF 적립 (다음 스케줄에서 사용)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={offBalanceData?.preferences.accumulatedOffDays || 0}
                        value={allocToAccumulation}
                        onChange={(e) => setAllocToAccumulation(Number(e.target.value))}
                        className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center"
                      />
                      <span className="text-gray-600 dark:text-gray-400">일</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      원하는 날짜에 유연하게 휴무를 배정받을 수 있습니다
                    </p>
                  </div>

                  {/* 수당 지급 입력 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      수당 지급 (금전적 보상)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={offBalanceData?.preferences.accumulatedOffDays || 0}
                        value={allocToAllowance}
                        onChange={(e) => setAllocToAllowance(Number(e.target.value))}
                        className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center"
                      />
                      <span className="text-gray-600 dark:text-gray-400">일</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      다음 달 급여에 수당으로 받습니다
                    </p>
                  </div>

                  {/* 배분 현황 */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600 dark:text-gray-400">총 적립 OFF:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {offBalanceData?.preferences.accumulatedOffDays || 0}일
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600 dark:text-gray-400">배분된 OFF:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {allocToAccumulation + allocToAllowance}일
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">미배분 OFF:</span>
                      <span className={`font-medium ${
                        (offBalanceData?.preferences.accumulatedOffDays || 0) - (allocToAccumulation + allocToAllowance) < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {(offBalanceData?.preferences.accumulatedOffDays || 0) - (allocToAccumulation + allocToAllowance)}일
                      </span>
                    </div>

                    {/* 경고 메시지 */}
                    {(allocToAccumulation + allocToAllowance) > (offBalanceData?.preferences.accumulatedOffDays || 0) && (
                      <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
                        ⚠️ 배분된 OFF 일수가 총 적립 OFF를 초과할 수 없습니다
                      </div>
                    )}
                  </div>

                  {/* 저장 버튼 */}
                  <button
                    onClick={handleSaveAllocation}
                    disabled={
                      updateAllocationMutation.isPending ||
                      (allocToAccumulation + allocToAllowance) > (offBalanceData?.preferences.accumulatedOffDays || 0)
                    }
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                  >
                    {updateAllocationMutation.isPending ? '저장 중...' : '배분 설정 저장'}
                  </button>
                </div>
              </div>

              {/* 최근 잔여 OFF 내역 */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-500" />
                  최근 잔여 OFF 내역
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {offBalanceData?.history && offBalanceData.history.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              기간
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              보장 OFF
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              배정 OFF
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              잔여 OFF
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              상태
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {offBalanceData.history.map((record) => (
                            <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                {record.year}년 {record.month}월
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-gray-100">
                                {record.guaranteedOffDays}일
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-gray-100">
                                {record.actualOffDays}일
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className={`font-medium ${
                                  record.remainingOffDays > 0
                                    ? 'text-orange-600 dark:text-orange-400'
                                    : 'text-green-600 dark:text-green-400'
                                }`}>
                                  {record.remainingOffDays > 0 ? '+' : ''}{record.remainingOffDays}일
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  record.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    : record.status === 'processed'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                                }`}>
                                  {record.status === 'pending' ? '대기중' : record.status === 'processed' ? '처리완료' : record.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Wallet className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">아직 기록이 없습니다</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                        스케줄이 확정되면 잔여 OFF 내역이 여기에 표시됩니다
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'request' && (
            <div className="space-y-4">
              {/* 월 선택 */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    const newMonth = new Date(selectedMonth);
                    newMonth.setMonth(newMonth.getMonth() - 1);
                    setSelectedMonth(newMonth);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedMonth.getFullYear()}년 {selectedMonth.getMonth() + 1}월
                </h3>
                <button
                  onClick={() => {
                    const newMonth = new Date(selectedMonth);
                    newMonth.setMonth(newMonth.getMonth() + 1);
                    setSelectedMonth(newMonth);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* 캘린더 */}
              <div className="grid grid-cols-7 gap-2">
                {/* 요일 헤더 */}
                {daysOfWeek.map((day, index) => (
                  <div key={index} className={`text-center text-sm font-medium py-2 ${
                    index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {day}
                  </div>
                ))}

                {/* 달력 날짜 */}
                {(() => {
                  const year = selectedMonth.getFullYear();
                  const month = selectedMonth.getMonth();
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const days = [];

                  // 빈 칸 추가
                  for (let i = 0; i < firstDay; i++) {
                    days.push(<div key={`empty-${i}`} className="aspect-square" />);
                  }

                  // 날짜 추가
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const currentRequest = shiftRequests[dateKey];

                    days.push(
                      <div key={day} className="relative">
                        <div className={`aspect-square border border-gray-200 dark:border-slate-600 rounded-lg p-1 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                          currentRequest ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}>
                          <div className="text-right text-sm text-gray-700 dark:text-gray-300">{day}</div>
                          {currentRequest && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                                {currentRequest}
                              </span>
                            </div>
                          )}
                        </div>
                        {/* 클릭 시 선택 드롭다운 */}
                        <select
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          value={currentRequest?.replace('^', '') || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              // Add "^" suffix to indicate it's a request
                              setShiftRequests({
                                ...shiftRequests,
                                [dateKey]: e.target.value + '^'
                              });
                            } else {
                              const newRequests = {...shiftRequests};
                              delete newRequests[dateKey];
                              setShiftRequests(newRequests);
                            }
                          }}
                        >
                          <option value="">선택 안함</option>
                          {customShiftTypes.map((shiftType) => (
                            <option key={shiftType.code} value={shiftType.code}>
                              {shiftType.code} ({shiftType.name})
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  return days;
                })()}
              </div>

              {/* 범례 */}
              <div className="flex gap-4 flex-wrap justify-center text-sm text-gray-600 dark:text-gray-400">
                {customShiftTypes.map((shiftType) => (
                  <div key={shiftType.code} className="flex items-center gap-1">
                    <span className="font-bold text-blue-600">{shiftType.code}</span> - {shiftType.name}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <AlertCircle className="w-4 h-4" />
              <span>모든 정보는 비밀로 유지되며 스케줄 최적화에만 사용됩니다.</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                저장
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
