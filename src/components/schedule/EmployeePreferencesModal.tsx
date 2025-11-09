"use client";
import { useState, useEffect } from "react";
import { User, Heart, Calendar, Clock, Users, Shield, X, Save, AlertCircle, Star, UserCheck, UserMinus, Info, Edit2, Trash2, CheckCircle, Briefcase, Wallet } from "lucide-react";
import { type Employee, type EmployeePreferences, type ShiftType } from "@/lib/scheduler/types";
import { validatePattern as validatePatternUtil, describePattern, EXAMPLE_PATTERNS, KEYWORD_DESCRIPTIONS, type ShiftToken } from "@/lib/utils/pattern-validator";
import { api } from "@/lib/trpc/client";

interface EmployeePreferencesModalProps {
  employee: Employee;
  onSave: (preferences: ExtendedEmployeePreferences) => void;
  onClose: () => void;
  teamMembers: Employee[];
  canManageTeams?: boolean; // manager 이상 권한
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
  avoidPatterns?: string[][]; // 기피하는 근무 패턴들 (개인)

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
  teamMembers,
  canManageTeams = false
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
      avoidPatterns: [],
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

  const [activeTab, setActiveTab] = useState<'basic' | 'personal' | 'career' | 'request' | 'off-balance'>('basic');
  const [selectedTeam, setSelectedTeam] = useState<string>((employee as any).teamId || '');

  // employee가 변경될 때 selectedTeam 업데이트
  useEffect(() => {
    setSelectedTeam((employee as any).teamId || '');
  }, [employee.id, (employee as any).teamId]);
  const [customPatternInput, setCustomPatternInput] = useState('');
  const [patternValidation, setPatternValidation] = useState<ReturnType<typeof validatePatternUtil> | null>(null);
  const [showPatternHelp, setShowPatternHelp] = useState(false);

  // 기피 패턴 텍스트 입력 관련 상태
  const [avoidPatternInput, setAvoidPatternInput] = useState('');
  const [avoidPatternValidation, setAvoidPatternValidation] = useState<ReturnType<typeof validatePatternUtil> | null>(null);
  const [showAvoidPatternHelp, setShowAvoidPatternHelp] = useState(false);

  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState<any>(null);

  // tRPC utils and mutations
  const utils = api.useUtils();

  const updateStaffProfile = api.staff.update.useMutation({
    onSuccess: async () => {
      // 캐시 무효화로 UI 자동 업데이트
      await utils.staff.list.invalidate();
      await utils.tenant.users.list.invalidate(); // schedule 페이지에서 사용하는 쿼리
    },
  });

  // Teams query and mutations
  const { data: teams = [], refetch: refetchTeams } = api.teams.getAll.useQuery();

  const updateTeam = api.teams.update.useMutation({
    onSuccess: async () => {
      await refetchTeams();
      setShowEditTeamModal(false);
      setEditingTeam(null);
      alert('팀이 수정되었습니다');
    },
    onError: (error) => {
      alert('팀 수정 실패: ' + error.message);
    },
  });

  const deleteTeam = api.teams.delete.useMutation({
    onSuccess: async () => {
      await refetchTeams();
      setShowDeleteConfirm(false);
      setDeletingTeam(null);
      // If the deleted team was selected, clear selection
      if (selectedTeam === deletingTeam?.id) {
        setSelectedTeam('');
      }
      alert('팀이 삭제되었습니다');
    },
    onError: (error) => {
      alert('팀 삭제 실패: ' + error.message);
    },
  });

  const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
  const shiftTypes: { value: ShiftType; label: string; color: string }[] = [
    { value: 'day', label: '주간', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'evening', label: '저녁', color: 'bg-purple-100 text-purple-800' },
    { value: 'night', label: '야간', color: 'bg-indigo-100 text-indigo-800' },
    { value: 'off', label: '휴무', color: 'bg-gray-100 text-gray-800 dark:text-gray-200' },
  ];

  const handleSave = async () => {
    // Save team assignment
    try {
      await updateStaffProfile.mutateAsync({
        id: employee.id,
        teamId: selectedTeam || null,
      });
      console.log('✅ Team assignment saved:', selectedTeam);
    } catch (error) {
      console.error('❌ Failed to save team assignment:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      alert(`⚠️ 팀 배정 저장 실패:\n\n${errorMessage}`);
      // Continue to save preferences even if team assignment fails
    }

    // Save preferences to database
    try {
      const response = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          preferences: {
            workPreferences: {
              workPatternType: preferences.workPatternType,
              preferredShifts: preferences.preferredShifts || [], // Use actual selected shifts
              avoidShifts: preferences.avoidShifts || [],
              preferredPatterns: preferences.preferredPatterns || [], // 개인 선호 패턴
              avoidPatterns: preferences.avoidPatterns || [], // 개인 기피 패턴
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

      // Check response status
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Parse response
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '선호도 저장에 실패했습니다.');
      }

      console.log('✅ Preferences saved to database for employee:', employee.id);
      console.log('✅ API Response:', result);
    } catch (error) {
      console.error('❌ Failed to save preferences:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      alert(`❌ 선호도 저장 실패:\n\n${errorMessage}\n\n콘솔을 확인하여 자세한 정보를 확인하세요.`);
      return; // Don't proceed if preferences save failed
    }

    // Save preferences to parent component and close modal
    onSave(preferences);
    onClose();
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
              { id: 'personal', label: '개인 사정', icon: Calendar },
              { id: 'career', label: '경력 관리', icon: Briefcase },
              { id: 'off-balance', label: '잔여 OFF', icon: Wallet },
              { id: 'request', label: 'Request', icon: Star },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
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
                              <p className="font-medium mb-1">✅ 유효한 키워드 (OFF 제외):</p>
                              <div className="grid grid-cols-2 gap-1 ml-2">
                                <div className="flex items-center gap-1">
                                  <span className="font-mono font-bold">D:</span>
                                  <span className="text-gray-700 dark:text-gray-300">주간 근무</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono font-bold">E:</span>
                                  <span className="text-gray-700 dark:text-gray-300">저녁 근무</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono font-bold">N:</span>
                                  <span className="text-gray-700 dark:text-gray-300">야간 근무</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <p className="font-medium mb-1">📝 예시:</p>
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
                      <p className="font-medium mb-1">기피 패턴 우선순위:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>개인 선호 패턴 (최우선)</li>
                        <li>개인 기피 패턴</li>
                        <li>팀 선호 패턴</li>
                        <li>팀 기피 패턴</li>
                      </ul>
                      <p className="mt-2 text-amber-700 dark:text-amber-300">
                        * 스케줄 생성 시 이 패턴들이 발생하지 않도록 조정됩니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'personal' && (
            <div className="space-y-6">
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">개인 사정 관리 기능은 준비 중입니다.</p>
              </div>
            </div>
          )}

          {activeTab === 'career' && (
            <div className="space-y-6">
              <div className="text-center py-12">
                <Briefcase className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">경력 관리 기능은 준비 중입니다.</p>
              </div>
            </div>
          )}

          {activeTab === 'off-balance' && (
            <div className="space-y-6">
              <div className="text-center py-12">
                <Wallet className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">잔여 OFF 관리 기능은 준비 중입니다.</p>
              </div>
            </div>
          )}

          {activeTab === 'request' && (
            <div className="space-y-6">
              <div className="text-center py-12">
                <Star className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Request 관리 기능은 준비 중입니다.</p>
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

      {/* Edit Team Modal */}
      {showEditTeamModal && editingTeam && (
        <EditTeamModal
          team={editingTeam}
          onSave={(updatedTeam) => {
            if (!updatedTeam.name.trim() || !updatedTeam.code.trim()) {
              alert('팀 이름과 코드를 입력해주세요');
              return;
            }
            updateTeam.mutate({
              id: editingTeam.id,
              name: updatedTeam.name,
              code: updatedTeam.code,
              color: updatedTeam.color,
            });
          }}
          onClose={() => {
            setShowEditTeamModal(false);
            setEditingTeam(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && deletingTeam && (
        <DeleteConfirmDialog
          teamName={deletingTeam.name}
          onConfirm={() => {
            deleteTeam.mutate({ id: deletingTeam.id });
          }}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setDeletingTeam(null);
          }}
        />
      )}
    </div>
  );
}

// Edit Team Modal Component
function EditTeamModal({
  team,
  onSave,
  onClose
}: {
  team: { id: string; name: string; code: string; color: string };
  onSave: (team: { name: string; code: string; color: string }) => void;
  onClose: () => void;
}) {
  const [editedTeam, setEditedTeam] = useState({
    name: team.name,
    code: team.code,
    color: team.color,
  });

  const DEFAULT_COLORS = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // yellow
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#14B8A6', // teal
    '#F97316', // orange
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-6 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">팀 수정</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">팀 이름</label>
              <input
                type="text"
                value={editedTeam.name}
                onChange={(e) => setEditedTeam({ ...editedTeam, name: e.target.value })}
                placeholder="A팀"
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">팀 코드</label>
              <input
                type="text"
                value={editedTeam.code}
                onChange={(e) => setEditedTeam({ ...editedTeam, code: e.target.value.toUpperCase() })}
                placeholder="A"
                maxLength={10}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">팀 색상</label>
              <div className="flex flex-wrap gap-3">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setEditedTeam({ ...editedTeam, color })}
                    className={`w-12 h-12 rounded-full border-2 transition-all ${
                      editedTeam.color === color
                        ? 'border-gray-900 dark:border-white scale-110 shadow-lg'
                        : 'border-gray-300 dark:border-slate-600 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600">취소</button>
          <button onClick={() => onSave(editedTeam)} disabled={!editedTeam.name.trim() || !editedTeam.code.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"><Save className="w-4 h-4" />저장</button>
        </div>
      </div>
    </div>
  );
}

// Delete Confirmation Dialog Component
function DeleteConfirmDialog({
  teamName,
  onConfirm,
  onCancel
}: {
  teamName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">팀 삭제</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">이 작업은 되돌릴 수 없습니다</p>
            </div>
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            <span className="font-semibold text-red-600 dark:text-red-400">{teamName}</span> 팀을 삭제하시겠습니까?
            이 팀에 배정된 직원들의 팀 정보도 함께 제거됩니다.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={onCancel} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600">취소</button>
            <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
