"use client";
import { useState, useEffect } from "react";
import { User, Heart, Calendar, Clock, Users, Shield, X, Save, AlertCircle, Star, UserCheck, UserMinus, ChevronLeft, ChevronRight, Info, CheckCircle } from "lucide-react";
import { type Employee, type EmployeePreferences, type ShiftType } from "@/lib/scheduler/types";
import { validatePattern as validatePatternUtil, describePattern, EXAMPLE_PATTERNS, KEYWORD_DESCRIPTIONS, type ShiftToken } from "@/lib/utils/pattern-validator";
import { api } from "@/lib/trpc/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";

interface EmployeePreferencesModalProps {
  employee: Employee;
  onSave: (preferences: ExtendedEmployeePreferences) => void;
  onClose: () => void;
  teamMembers: Employee[];
}

// 근무 패턴 타입 정의
export type WorkPatternType = 'three-shift' | 'night-intensive' | 'weekday-only';

// 확장된 직원 선호도 인터페이스
export interface ExtendedEmployeePreferences extends EmployeePreferences {
  // 근무 패턴
  workPatternType?: WorkPatternType;

  // 기본 선호도
  preferredShifts: ShiftType[];
  avoidShifts: ShiftType[];
  preferredDaysOff: number[];
  maxConsecutiveDays: number;
  preferNightShift: boolean;
  preferredPattern?: string;

  // 확장된 선호도
  workLoadPreference: 'light' | 'normal' | 'heavy'; // 업무량 선호
  flexibilityLevel: 'low' | 'medium' | 'high'; // 유연성 수준
  preferredPatterns?: string[]; // 선호하는 근무 패턴들 (멀티 선택)

  // 팀 선호도
  preferredPartners: string[]; // 선호하는 동료 ID
  avoidPartners: string[]; // 피하고 싶은 동료 ID

  // 개인 사정
  personalConstraints: PersonalConstraint[];

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

interface PersonalConstraint {
  id: string;
  type: 'childcare' | 'eldercare' | 'education' | 'medical' | 'religious' | 'other';
  description: string;
  affectedDays?: number[]; // 영향받는 요일
  affectedTimes?: { start: string; end: string }; // 영향받는 시간대
  priority: 'low' | 'medium' | 'high' | 'critical';
  startDate?: Date;
  endDate?: Date;
}

const personalConstraintTypes = [
  { value: 'childcare', label: '육아', icon: '👶' },
  { value: 'eldercare', label: '노인 돌봄', icon: '👴' },
  { value: 'education', label: '교육/학업', icon: '📚' },
  { value: 'medical', label: '의료/치료', icon: '🏥' },
  { value: 'religious', label: '종교 활동', icon: '🕌' },
  { value: 'other', label: '기타', icon: '📝' },
] as const;

export function EmployeePreferencesModal({
  employee,
  onSave,
  onClose,
  teamMembers
}: EmployeePreferencesModalProps) {
  const [preferences, setPreferences] = useState<ExtendedEmployeePreferences>(() => {
    // Spread employee.preferences first, then apply defaults for undefined fields
    const basePrefs = {
      workPatternType: 'three-shift' as WorkPatternType,
      workLoadPreference: 'normal' as const,
      flexibilityLevel: 'medium' as const,
      preferredPartners: [],
      avoidPartners: [],
      personalConstraints: [],
      trainingDays: [],
      mentorshipRole: 'none' as const,
      specialization: [],
      preferredShifts: [],
      avoidShifts: [],
      preferredDaysOff: [],
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
    };

    // Merge with employee preferences, using loaded values where available
    return {
      ...basePrefs,
      ...employee.preferences,
      // Ensure arrays are never undefined
      preferredShifts: employee.preferences?.preferredShifts || [],
      avoidShifts: employee.preferences?.avoidShifts || [],
      preferredDaysOff: employee.preferences?.preferredDaysOff || [],
      preferredPartners: employee.preferences?.preferredPartners || [],
      avoidPartners: employee.preferences?.avoidPartners || [],
    } as ExtendedEmployeePreferences;
  });

  const [activeTab, setActiveTab] = useState<'basic' | 'personal' | 'request'>('basic');
  const [showConstraintForm, setShowConstraintForm] = useState(false);
  const [customPatternInput, setCustomPatternInput] = useState('');
  const [patternValidation, setPatternValidation] = useState<ReturnType<typeof validatePatternUtil> | null>(null);
  const [showPatternHelp, setShowPatternHelp] = useState(false);

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

  // Query to fetch existing special requests for the selected month
  const { data: existingRequests } = api.specialRequests.getByDateRange.useQuery({
    startDate: format(startOfMonth(selectedMonth), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(selectedMonth), 'yyyy-MM-dd'),
    employeeId: employee.id,
    status: 'pending',
  });

  // Load custom shift types from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('customShiftTypes');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setCustomShiftTypes(parsed);
        } catch (e) {
          console.error('Failed to parse customShiftTypes:', e);
        }
      }
    }
  }, []);

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

  const handleSave = async () => {
    // Save preferences to database
    try {
      await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          preferences: {
            workPreferences: {
              workPatternType: preferences.workPatternType,
              preferredShifts: preferences.preferredShifts || [], // Use actual selected shifts
              avoidShifts: preferences.avoidShifts || [],
              maxConsecutiveDays: preferences.maxConsecutiveDays || 5,
              minRestDays: 2,
              preferredWorkload: preferences.workLoadPreference === 'light' ? 'light' : preferences.workLoadPreference === 'heavy' ? 'heavy' : 'moderate',
              weekendPreference: 'neutral',
              holidayPreference: 'neutral',
              overtimeWillingness: 'sometimes',
              offDayPattern: 'flexible',
            },
            personalCircumstances: {
              hasYoungChildren: false,
              isSingleParent: false,
              hasCaregivingResponsibilities: false,
              isStudying: false,
            },
            healthConsiderations: {
              hasChronicCondition: false,
              needsFrequentBreaks: false,
              mobilityRestrictions: false,
              visualImpairment: false,
              hearingImpairment: false,
              mentalHealthSupport: false,
            },
            commutePreferences: {
              commuteTime: 30,
              transportMode: 'car',
              parkingRequired: false,
              nightTransportDifficulty: false,
              weatherSensitive: false,
              needsTransportAssistance: false,
              carpoolInterested: false,
            },
            teamPreferences: {
              preferredPartners: preferences.preferredPartners || [],
              avoidPartners: preferences.avoidPartners || [],
              mentorshipRole: 'none',
              languagePreferences: ['korean'],
              communicationStyle: 'direct',
              conflictResolution: 'immediate',
            },
            professionalDevelopment: {
              specializations: [],
              certifications: [],
              trainingInterests: [],
              careerGoals: '',
              preferredDepartments: [],
              avoidDepartments: [],
              teachingInterest: false,
              researchInterest: false,
              administrativeInterest: false,
            },
            specialRequests: {
              religiousObservances: { needed: false },
              culturalConsiderations: '',
              emergencyContact: { name: '', relationship: '', phone: '' },
              temporaryRequests: [],
            },
            priorities: {
              workLifeBalance: 7,
              careerGrowth: 5,
              teamHarmony: 6,
              incomeMaximization: 4,
              healthWellbeing: 8,
              familyTime: 7,
            },
          },
        }),
      });
      console.log('✅ Preferences saved to database for employee:', employee.id);
    } catch (error) {
      console.error('❌ Failed to save preferences:', error);
    }

    // Save preferences to parent component
    onSave(preferences);

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
    }
  };

  const toggleShiftPreference = (shift: ShiftType, type: 'preferred' | 'avoid') => {
    if (type === 'preferred') {
      const current = preferences.preferredShifts;
      if (current.includes(shift)) {
        // 이미 선택된 것을 클릭하면 선택 해제
        setPreferences({
          ...preferences,
          preferredShifts: [],
        });
      } else {
        // 새로운 것을 선택하면 이전 선택은 해제하고 새것만 선택 (1개만 허용)
        setPreferences({
          ...preferences,
          preferredShifts: [shift],
          avoidShifts: preferences.avoidShifts.filter(s => s !== shift), // 충돌 방지
        });
      }
    } else {
      const current = preferences.avoidShifts;
      if (current.includes(shift)) {
        setPreferences({
          ...preferences,
          avoidShifts: current.filter(s => s !== shift),
        });
      } else {
        setPreferences({
          ...preferences,
          avoidShifts: [...current, shift],
          preferredShifts: preferences.preferredShifts.filter(s => s !== shift), // 충돌 방지
        });
      }
    }
  };

  const toggleDayOffPreference = (day: number) => {
    const current = preferences.preferredDaysOff;
    if (current.includes(day)) {
      setPreferences({
        ...preferences,
        preferredDaysOff: current.filter(d => d !== day),
      });
    } else {
      setPreferences({
        ...preferences,
        preferredDaysOff: [...current, day],
      });
    }
  };

  const addPersonalConstraint = (constraint: Omit<PersonalConstraint, 'id'>) => {
    const newConstraint: PersonalConstraint = {
      ...constraint,
      id: `constraint-${Date.now()}`,
    };
    setPreferences({
      ...preferences,
      personalConstraints: [...preferences.personalConstraints, newConstraint],
    });
    setShowConstraintForm(false);
  };

  const togglePatternPreference = (pattern: string) => {
    const current = preferences.preferredPatterns || [];

    // 이미 선택된 경우 제거
    if (current.includes(pattern)) {
      setPreferences({
        ...preferences,
        preferredPatterns: current.filter(p => p !== pattern),
      });
      return;
    }

    // 패턴 추가
    setPreferences({
      ...preferences,
      preferredPatterns: [...current, pattern],
    });
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
              { id: 'personal', label: '개인 사정', icon: Calendar },
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
              
              {/* 선호 휴무일 */}
              <div className={preferences.workPatternType === 'weekday-only' ? 'opacity-50 pointer-events-none' : ''}>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
                  선호하는 휴무일
                  {preferences.workPatternType === 'weekday-only' && (
                    <span className="ml-2 text-sm text-gray-500 font-normal">(행정 근무는 주말/공휴일 자동 휴무)</span>
                  )}
                </h3>
                <div className="flex gap-2">
                  {daysOfWeek.map((day, index) => (
                    <button
                      key={index}
                      onClick={() => toggleDayOffPreference(index)}
                      disabled={preferences.workPatternType === 'weekday-only'}
                      className={`w-12 h-12 rounded-lg border-2 transition-all ${
                        preferences.preferredDaysOff.includes(index)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700'
                          : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                      } ${index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : ''}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* 선호 시프트 */}
              <div className={preferences.workPatternType !== 'three-shift' ? 'opacity-50 pointer-events-none' : ''}>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
                  선호하는 근무 시간
                  {preferences.workPatternType !== 'three-shift' && (
                    <span className="ml-2 text-sm text-gray-500 font-normal">(3교대 근무 선택 시 활성화)</span>
                  )}
                </h3>
                <div className="flex gap-2">
                  {shiftTypes.filter(s => s.value !== 'off').map(shift => (
                    <button
                      key={shift.value}
                      onClick={() => toggleShiftPreference(shift.value, 'preferred')}
                      disabled={preferences.workPatternType !== 'three-shift'}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        preferences.preferredShifts.includes(shift.value)
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                      }`}
                    >
                      <span className={`px-2 py-1 rounded text-sm ${shift.color}`}>
                        {shift.label}
                      </span>
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

                {/* 기본 패턴 선택 */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                    일반 패턴 (다중 선택 가능)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'D-D-E-E-N-N-OFF', label: '교대 근무', description: '주간 → 저녁 → 야간 순환' },
                      { value: 'D-D-D-D-D-OFF-OFF', label: '5일 근무', description: '주간 5일 연속 근무' },
                      { value: 'D-OFF-D-OFF-D-OFF-D', label: '격일 근무', description: '1일 근무, 1일 휴무' },
                      { value: 'N-N-N-OFF-OFF-OFF-OFF', label: '야간 집중', description: '야간 3일, 4일 휴무' },
                    ].map(option => {
                      const isDisabled = preferences.workPatternType !== 'three-shift';
                      return (
                        <button
                          key={option.value}
                          onClick={() => !isDisabled && togglePatternPreference(option.value)}
                          disabled={isDisabled}
                          className={`p-3 rounded-lg border-2 transition-all text-left ${
                            (preferences.preferredPatterns || []).includes(option.value)
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : isDisabled
                              ? 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 cursor-not-allowed opacity-50'
                              : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                          }`}
                        >
                          <div className="font-medium text-gray-900 dark:text-white">{option.label}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{option.description}</div>
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-mono">{option.value}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                        <div>
                          <span className="font-semibold text-blue-900 dark:text-blue-300">사용 가능한 키워드:</span>
                          <div className="mt-1 space-y-1 text-gray-700 dark:text-gray-300">
                            {Object.entries(KEYWORD_DESCRIPTIONS).map(([token, desc]) => (
                              <div key={token}>• {desc}</div>
                            ))}
                          </div>
                        </div>
                        <div className="border-t border-blue-200 dark:border-blue-800 pt-2">
                          <span className="font-semibold text-blue-900 dark:text-blue-300">예시:</span>
                          <div className="mt-1 space-y-1 text-gray-700 dark:text-gray-300">
                            {EXAMPLE_PATTERNS.map((ex, idx) => (
                              <div key={idx}>• {ex.pattern} - {ex.description}</div>
                            ))}
                          </div>
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
            </div>
          )}

          {activeTab === 'personal' && (
            <div className="space-y-6">
              {/* 개인 사정 목록 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">개인 사정</h3>
                  <button
                    onClick={() => setShowConstraintForm(true)}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    추가
                  </button>
                </div>
                {preferences.personalConstraints.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    등록된 개인 사정이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {preferences.personalConstraints.map((constraint) => (
                      <div key={constraint.id} className="p-4 border border-gray-200 dark:border-slate-600 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-2xl">{personalConstraintTypes.find(t => t.value === constraint.type)?.icon}</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {personalConstraintTypes.find(t => t.value === constraint.type)?.label}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                constraint.priority === 'critical' ? 'bg-red-100 text-red-700' :
                                constraint.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                constraint.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {constraint.priority === 'critical' ? '필수' :
                                 constraint.priority === 'high' ? '높음' :
                                 constraint.priority === 'medium' ? '보통' : '낮음'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{constraint.description}</p>
                          </div>
                          <button
                            onClick={() => setPreferences({
                              ...preferences,
                              personalConstraints: preferences.personalConstraints.filter(c => c.id !== constraint.id)
                            })}
                            className="text-gray-400 hover:text-red-600 ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

      {/* Personal Constraint Form Modal */}
      {showConstraintForm && (
        <PersonalConstraintForm
          onSave={addPersonalConstraint}
          onClose={() => setShowConstraintForm(false)}
        />
      )}
    </div>
  );
}

// Personal Constraint Form Component
function PersonalConstraintForm({
  onSave,
  onClose
}: {
  onSave: (constraint: Omit<PersonalConstraint, 'id'>) => void;
  onClose: () => void;
}) {
  const [constraint, setConstraint] = useState<Omit<PersonalConstraint, 'id'>>({
    type: 'childcare',
    description: '',
    priority: 'medium',
    affectedDays: [],
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">개인 사정 추가</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">유형</label>
            <select
              value={constraint.type}
              onChange={(e) => setConstraint({...constraint, type: e.target.value as any})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="childcare">육아</option>
              <option value="eldercare">간병</option>
              <option value="education">학업</option>
              <option value="medical">의료</option>
              <option value="religious">종교</option>
              <option value="other">기타</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">설명</label>
            <textarea
              value={constraint.description}
              onChange={(e) => setConstraint({...constraint, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
              placeholder="예: 매주 화요일 오후 3시 자녀 학원 픽업"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">중요도</label>
            <select
              value={constraint.priority}
              onChange={(e) => setConstraint({...constraint, priority: e.target.value as any})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="low">낮음</option>
              <option value="medium">보통</option>
              <option value="high">높음</option>
              <option value="critical">필수</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600"
          >
            취소
          </button>
          <button
            onClick={() => {
              if (constraint.description) {
                onSave(constraint);
              }
            }}
            disabled={!constraint.description}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
