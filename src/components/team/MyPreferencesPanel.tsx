"use client";

import { useState } from "react";
import {
  X, Save, AlertCircle, User, Calendar, Users,
  Coffee, Moon, Sun,
  Shield, Clock, Activity, Sparkles, Award,
  AlertTriangle, CheckCircle, Heart
} from "lucide-react";

// 근무 패턴 타입 정의
export type WorkPatternType = 'three-shift' | 'night-intensive' | 'weekday-only';

// 선호도 인터페이스 정의
export interface ComprehensivePreferences {
  // 기본 근무 선호
  workPreferences: {
    workPatternType: WorkPatternType; // 근무 패턴: 3교대 근무, 나이트 집중 근무, 평일 근무
    preferredShifts: ('day' | 'evening' | 'night')[];
    avoidShifts?: ('day' | 'evening' | 'night')[];
    maxConsecutiveDays: number;
    minRestDays: number;
    preferredWorkload: 'light' | 'moderate' | 'heavy' | 'flexible';
    weekendPreference: 'prefer' | 'avoid' | 'neutral';
    holidayPreference: 'prefer' | 'avoid' | 'neutral';
    overtimeWillingness: 'never' | 'emergency' | 'sometimes' | 'always';
    offDayPattern: 'short' | 'long' | 'flexible'; // 짧은 휴무 선호 vs 긴 휴무 선호
  };

  // 개인 사정
  personalCircumstances: {
    hasYoungChildren: boolean;
    childrenAges?: number[];
    isSingleParent: boolean;
    hasCaregivingResponsibilities: boolean;
    caregivingDetails?: string;
    isStudying: boolean;
    studySchedule?: {
      days: string[];
      timeSlots: string[];
    };
    pregnancyStatus?: 'none' | 'early' | 'late' | 'postpartum';
    weddingPlanned?: Date;
  };

  // 건강 고려사항
  healthConsiderations: {
    hasChronicCondition: boolean;
    conditionDetails?: string;
    needsFrequentBreaks: boolean;
    mobilityRestrictions: boolean;
    visualImpairment: boolean;
    hearingImpairment: boolean;
    mentalHealthSupport: boolean;
    medicationSchedule?: string[];
    recentSurgery?: Date;
    recoveryPeriod?: number; // days
  };

  // 통근 고려사항
  commutePreferences: {
    commuteTime: number; // minutes
    transportMode: 'car' | 'public' | 'walk' | 'bike' | 'mixed';
    parkingRequired: boolean;
    nightTransportDifficulty: boolean;
    weatherSensitive: boolean;
    needsTransportAssistance: boolean;
    carpoolInterested: boolean;
    preferredCarpoolPartners?: string[];
  };

  // 팀 & 협업 선호
  teamPreferences: {
    preferredPartners: string[];
    avoidPartners: string[];
    mentorshipRole: 'mentor' | 'mentee' | 'both' | 'none';
    preferredMentor?: string;
    languagePreferences: string[];
    communicationStyle: 'direct' | 'gentle' | 'detailed' | 'brief';
    conflictResolution: 'immediate' | 'planned' | 'mediator' | 'avoid';
  };

  // 전문성 & 경력개발
  professionalDevelopment: {
    specializations: string[];
    certifications: string[];
    trainingInterests: string[];
    careerGoals: string;
    preferredDepartments: string[];
    avoidDepartments: string[];
    teachingInterest: boolean;
    researchInterest: boolean;
    administrativeInterest: boolean;
  };

  // 특별 요청사항
  specialRequests: {
    religiousObservances: {
      needed: boolean;
      details?: string;
      dates?: Date[];
    };
    culturalConsiderations: string;
    dietaryRestrictions?: string;
    emergencyContact: {
      name: string;
      relationship: string;
      phone: string;
    };
    temporaryRequests: {
      reason: string;
      startDate: Date;
      endDate: Date;
      details: string;
    }[];
  };

  // 우선순위 설정
  priorities: {
    workLifeBalance: number; // 1-10
    careerGrowth: number; // 1-10
    teamHarmony: number; // 1-10
    incomeMaximization: number; // 1-10
    healthWellbeing: number; // 1-10
    familyTime: number; // 1-10
  };
}

interface MyPreferencesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onSave: (preferences: ComprehensivePreferences) => void;
  initialPreferences?: Partial<ComprehensivePreferences>;
}

export function MyPreferencesPanel({
  isOpen,
  onClose,
  currentUserId,
  onSave,
  initialPreferences
}: MyPreferencesPanelProps) {
  const [activeTab, setActiveTab] = useState<'work' | 'personal' | 'health' | 'team' | 'special' | 'priority'>('work');
  const [preferences, setPreferences] = useState<ComprehensivePreferences>({
    workPreferences: initialPreferences?.workPreferences || {
      workPatternType: 'three-shift', // 기본값: 3교대 근무
      preferredShifts: ['day'],
      avoidShifts: [],
      maxConsecutiveDays: 5,
      minRestDays: 2,
      preferredWorkload: 'moderate',
      weekendPreference: 'neutral',
      holidayPreference: 'neutral',
      overtimeWillingness: 'sometimes',
      offDayPattern: 'flexible'
    },
    personalCircumstances: initialPreferences?.personalCircumstances || {
      hasYoungChildren: false,
      isSingleParent: false,
      hasCaregivingResponsibilities: false,
      isStudying: false,
    },
    healthConsiderations: initialPreferences?.healthConsiderations || {
      hasChronicCondition: false,
      needsFrequentBreaks: false,
      mobilityRestrictions: false,
      visualImpairment: false,
      hearingImpairment: false,
      mentalHealthSupport: false,
    },
    commutePreferences: initialPreferences?.commutePreferences || {
      commuteTime: 30,
      transportMode: 'car',
      parkingRequired: false,
      nightTransportDifficulty: false,
      weatherSensitive: false,
      needsTransportAssistance: false,
      carpoolInterested: false,
    },
    teamPreferences: initialPreferences?.teamPreferences || {
      preferredPartners: [],
      avoidPartners: [],
      mentorshipRole: 'none',
      languagePreferences: ['korean'],
      communicationStyle: 'direct',
      conflictResolution: 'immediate',
    },
    professionalDevelopment: initialPreferences?.professionalDevelopment || {
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
    specialRequests: initialPreferences?.specialRequests || {
      religiousObservances: { needed: false },
      culturalConsiderations: '',
      emergencyContact: {
        name: '',
        relationship: '',
        phone: '',
      },
      temporaryRequests: [],
    },
    priorities: initialPreferences?.priorities || {
      workLifeBalance: 7,
      careerGrowth: 5,
      teamHarmony: 6,
      incomeMaximization: 4,
      healthWellbeing: 8,
      familyTime: 7,
    },
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleSave = () => {
    // 검증
    const errors: string[] = [];

    if (!preferences.workPreferences.preferredShifts || preferences.workPreferences.preferredShifts.length === 0) {
      errors.push('선호 시프트를 선택해주세요');
    }

    if (preferences.specialRequests.emergencyContact.name &&
        !preferences.specialRequests.emergencyContact.phone) {
      errors.push('비상연락처 전화번호를 입력해주세요');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSaveStatus('saving');

    // 저장 시뮬레이션
    setTimeout(() => {
      onSave(preferences);
      setSaveStatus('success');
      setTimeout(() => {
        onClose();
      }, 1500);
    }, 1000);
  };

  const renderWorkPreferences = () => {
    // 3교대 근무일 때만 선호 근무 시간/패턴 활성화
    const isThreeShiftPattern = preferences.workPreferences.workPatternType === 'three-shift';

    return (
    <div className="space-y-6">
      {/* 근무 패턴 선택 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">근무 패턴</h3>
        <div className="space-y-3 mt-4">
          {([
            { value: 'three-shift', label: '3교대 근무', description: '주간/저녁/야간을 순환하는 교대 근무' },
            { value: 'night-intensive', label: '나이트 집중 근무', description: '주로 야간 근무를 수행하는 패턴' },
            { value: 'weekday-only', label: '평일 근무', description: '평일 중심의 고정 근무 패턴' }
          ] as const).map(pattern => (
            <label
              key={pattern.value}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                preferences.workPreferences.workPatternType === pattern.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="workPattern"
                checked={preferences.workPreferences.workPatternType === pattern.value}
                onChange={() => {
                  setPreferences(prev => ({
                    ...prev,
                    workPreferences: {
                      ...prev.workPreferences,
                      workPatternType: pattern.value,
                      // 3교대가 아닌 경우 선호/기피 시프트 초기화
                      preferredShifts: pattern.value === 'three-shift' ? prev.workPreferences.preferredShifts : ['day'],
                      avoidShifts: pattern.value === 'three-shift' ? prev.workPreferences.avoidShifts : []
                    }
                  }));
                }}
                className="mt-0.5 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{pattern.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{pattern.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 선호 근무 시간 - 3교대 근무일 때만 활성화 */}
      <div className={!isThreeShiftPattern ? 'opacity-50 pointer-events-none' : ''}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
          근무 시간 선호
          {!isThreeShiftPattern && <span className="ml-2 text-xs text-gray-500">(3교대 근무 선택 시 활성화)</span>}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">선호 시프트</label>
            <div className="flex gap-3">
              {(['day', 'evening', 'night'] as const).map(shift => (
                <label key={shift} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="preferredShift"
                    checked={preferences.workPreferences.preferredShifts[0] === shift}
                    onChange={() => {
                      setPreferences(prev => ({
                        ...prev,
                        workPreferences: {
                          ...prev.workPreferences,
                          preferredShifts: [shift],
                          // Clear avoid shift if it conflicts with the new preferred shift
                          avoidShifts: prev.workPreferences.avoidShifts?.[0] === shift ? [] : prev.workPreferences.avoidShifts
                        }
                      }));
                    }}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">
                    {shift === 'day' && '주간 (07:00-15:00)'}
                    {shift === 'evening' && '저녁 (15:00-23:00)'}
                    {shift === 'night' && '야간 (23:00-07:00)'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">기피 시프트</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="avoidShift"
                  checked={!preferences.workPreferences.avoidShifts || preferences.workPreferences.avoidShifts.length === 0}
                  onChange={() => {
                    setPreferences(prev => ({
                      ...prev,
                      workPreferences: {
                        ...prev.workPreferences,
                        avoidShifts: []
                      }
                    }));
                  }}
                  className="text-gray-600 focus:ring-gray-500"
                />
                <span className="text-sm">없음</span>
              </label>
              {(['day', 'evening', 'night'] as const).map(shift => (
                <label key={shift} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="avoidShift"
                    checked={preferences.workPreferences.avoidShifts?.[0] === shift}
                    onChange={() => {
                      // Check if this shift is already preferred
                      if (preferences.workPreferences.preferredShifts[0] === shift) {
                        // Clear the avoid shift selection if it conflicts
                        setPreferences(prev => ({
                          ...prev,
                          workPreferences: {
                            ...prev.workPreferences,
                            avoidShifts: []
                          }
                        }));
                      } else {
                        setPreferences(prev => ({
                          ...prev,
                          workPreferences: {
                            ...prev.workPreferences,
                            avoidShifts: [shift]
                          }
                        }));
                      }
                    }}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm">
                    {shift === 'day' && '주간 (07:00-15:00)'}
                    {shift === 'evening' && '저녁 (15:00-23:00)'}
                    {shift === 'night' && '야간 (23:00-07:00)'}
                  </span>
                </label>
              ))}
            </div>
            {preferences.workPreferences.preferredShifts[0] &&
             preferences.workPreferences.avoidShifts?.[0] === preferences.workPreferences.preferredShifts[0] && (
              <p className="text-xs text-red-600 mt-1">
                ⚠️ 선호 시프트와 기피 시프트가 동일할 수 없습니다
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">휴무 패턴 선호</label>
            <select
              value={preferences.workPreferences.offDayPattern}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                workPreferences: {
                  ...prev.workPreferences,
                  offDayPattern: e.target.value as 'short' | 'long' | 'flexible'
                }
              }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="short">짧은 휴무 선호 (1-2일씩 자주)</option>
              <option value="long">긴 휴무 선호 (3일 이상 연속)</option>
              <option value="flexible">상관없음</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {preferences.workPreferences.offDayPattern === 'short'
                ? '규칙적인 짧은 휴식을 통해 체력 관리를 선호합니다'
                : preferences.workPreferences.offDayPattern === 'long'
                ? '연속 휴무로 충분한 휴식과 개인 시간을 선호합니다'
                : '스케줄에 따라 유연하게 조정 가능합니다'}
            </p>
          </div>
        </div>
      </div>

      {/* 예상 근무 패턴 - 3교대 근무일 때만 활성화 */}
      <div className={!isThreeShiftPattern ? 'opacity-50 pointer-events-none' : ''}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
          예상 근무 패턴
          {!isThreeShiftPattern && <span className="ml-2 text-xs text-gray-500">(3교대 근무 선택 시 활성화)</span>}
        </h3>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="font-mono text-lg text-gray-900">
              {(() => {
                const preferred = preferences.workPreferences.preferredShifts;
                const avoided = preferences.workPreferences.avoidShifts || [];
                const offPattern = preferences.workPreferences.offDayPattern;

                // Generate a sample weekly pattern
                const pattern: string[] = [];
                const validShifts = ['day', 'evening', 'night'].filter(
                  s => preferred.includes(s as any) && !avoided.includes(s as any)
                );

                if (validShifts.length === 0) {
                  // If no valid shifts after filtering, use preferred only
                  validShifts.push(...preferred);
                }

                // Helper function to check if shift transition is valid
                const canFollow = (prevShift: string, nextShift: string): boolean => {
                  // Night shift cannot be followed by day shift (need rest)
                  if (prevShift === 'night' && nextShift === 'day') return false;
                  // Night shift cannot be followed by evening shift either (need rest)
                  if (prevShift === 'night' && nextShift === 'evening') return false;
                  return true;
                };

                // Helper function to get next valid shift
                const getNextShift = (lastShift: string, availableShifts: string[]): string => {
                  // First try to find a valid shift that can follow
                  for (const shift of availableShifts) {
                    if (canFollow(lastShift, shift)) {
                      return shift;
                    }
                  }
                  // If no valid shift, return 'off' to provide rest
                  return 'off';
                };

                // Generate pattern based on off-day preference
                if (offPattern === 'short') {
                  // Short breaks: work 2 days, off 1 day pattern
                  let lastShift = '';
                  for (let i = 0; i < 7; i++) {
                    if (i % 3 === 2) {
                      pattern.push('off');
                      lastShift = 'off';
                    } else {
                      const shift = lastShift === 'off' || lastShift === ''
                        ? validShifts[0] || 'day'
                        : getNextShift(lastShift, validShifts);
                      pattern.push(shift);
                      lastShift = shift;
                    }
                  }
                } else if (offPattern === 'long') {
                  // Long breaks: work 4-5 days, off 2-3 days
                  // Start with a safe shift progression
                  if (validShifts.includes('day')) {
                    pattern.push('day', 'day', 'evening', 'evening', 'night', 'off', 'off');
                  } else if (validShifts.includes('evening')) {
                    pattern.push('evening', 'evening', 'evening', 'night', 'night', 'off', 'off');
                  } else if (validShifts.includes('night')) {
                    pattern.push('night', 'off', 'off', 'night', 'night', 'off', 'off');
                  } else {
                    pattern.push('day', 'day', 'day', 'day', 'day', 'off', 'off');
                  }
                } else {
                  // Flexible: mixed pattern with proper transitions
                  if (validShifts.length === 1) {
                    // Single shift type
                    const shift = validShifts[0];
                    if (shift === 'night') {
                      pattern.push('night', 'off', 'off', 'night', 'night', 'off', 'night');
                    } else {
                      pattern.push(shift, shift, 'off', shift, shift, shift, 'off');
                    }
                  } else if (validShifts.includes('day') && validShifts.includes('evening')) {
                    pattern.push('day', 'day', 'evening', 'off', 'day', 'evening', 'off');
                  } else if (validShifts.includes('evening') && validShifts.includes('night')) {
                    pattern.push('evening', 'evening', 'night', 'off', 'off', 'evening', 'night');
                  } else if (validShifts.includes('day') && validShifts.includes('night')) {
                    pattern.push('day', 'day', 'off', 'night', 'off', 'day', 'off');
                  } else {
                    // All three shifts
                    pattern.push('day', 'evening', 'night', 'off', 'off', 'day', 'evening');
                  }
                }

                return pattern.join('-');
              })()}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              * 실제 스케줄은 팀 상황과 다른 직원들의 선호도를 고려하여 조정될 수 있습니다
            </p>
            <p className="text-xs text-gray-500">
              * 야간 근무 후에는 충분한 휴식을 위해 주간/저녁 근무를 바로 배치하지 않습니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  };

  const renderPersonalCircumstances = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">가족 상황</h3>

        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.personalCircumstances.hasYoungChildren}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                personalCircumstances: {
                  ...prev.personalCircumstances,
                  hasYoungChildren: e.target.checked
                }
              }))}
              className="rounded text-blue-600"
            />
            <Heart className="w-4 h-4 text-gray-500" />
            <span className="text-sm">미취학 자녀가 있습니다</span>
          </label>

          {preferences.personalCircumstances.hasYoungChildren && (
            <div className="ml-6 p-3 bg-blue-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">자녀 연령</label>
              <input
                type="text"
                placeholder="예: 3세, 5세"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.personalCircumstances.isSingleParent}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                personalCircumstances: {
                  ...prev.personalCircumstances,
                  isSingleParent: e.target.checked
                }
              }))}
              className="rounded text-blue-600"
            />
            <span className="text-sm">한부모 가정입니다</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.personalCircumstances.hasCaregivingResponsibilities}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                personalCircumstances: {
                  ...prev.personalCircumstances,
                  hasCaregivingResponsibilities: e.target.checked
                }
              }))}
              className="rounded text-blue-600"
            />
            <Heart className="w-4 h-4 text-gray-500" />
            <span className="text-sm">가족 간병이 필요합니다</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.personalCircumstances.isStudying}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                personalCircumstances: {
                  ...prev.personalCircumstances,
                  isStudying: e.target.checked
                }
              }))}
              className="rounded text-blue-600"
            />
            <Award className="w-4 h-4 text-gray-500" />
            <span className="text-sm">학업을 병행하고 있습니다</span>
          </label>

          {preferences.personalCircumstances.isStudying && (
            <div className="ml-6 p-3 bg-blue-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">수업 일정</label>
              <textarea
                placeholder="예: 월,수 저녁 6-9시"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">특별 상황</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">임신/출산 상태</label>
            <select
              value={preferences.personalCircumstances.pregnancyStatus || 'none'}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                personalCircumstances: {
                  ...prev.personalCircumstances,
                  pregnancyStatus: e.target.value as 'none' | 'early' | 'late' | 'postpartum'
                }
              }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="none">해당없음</option>
              <option value="early">임신 초기 (1-3개월)</option>
              <option value="late">임신 후기 (7-9개월)</option>
              <option value="postpartum">출산 후 회복기</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHealthConsiderations = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">건강 상태</h3>

        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.healthConsiderations.hasChronicCondition}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                healthConsiderations: {
                  ...prev.healthConsiderations,
                  hasChronicCondition: e.target.checked
                }
              }))}
              className="rounded text-blue-600"
            />
            <Activity className="w-4 h-4 text-gray-500" />
            <span className="text-sm">만성질환이 있습니다</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.healthConsiderations.needsFrequentBreaks}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                healthConsiderations: {
                  ...prev.healthConsiderations,
                  needsFrequentBreaks: e.target.checked
                }
              }))}
              className="rounded text-blue-600"
            />
            <Coffee className="w-4 h-4 text-gray-500" />
            <span className="text-sm">자주 휴식이 필요합니다</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.healthConsiderations.mentalHealthSupport}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                healthConsiderations: {
                  ...prev.healthConsiderations,
                  mentalHealthSupport: e.target.checked
                }
              }))}
              className="rounded text-blue-600"
            />
            <Heart className="w-4 h-4 text-gray-500" />
            <span className="text-sm">정신건강 지원이 필요합니다</span>
          </label>

          {preferences.healthConsiderations.hasChronicCondition && (
            <div className="ml-6 p-3 bg-yellow-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상세 내용 (선택사항, 비밀보장)
              </label>
              <textarea
                placeholder="업무 배치에 참고할 내용을 입력해주세요"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                🔒 이 정보는 엄격히 보호되며, 적절한 근무 배치를 위해서만 사용됩니다.
              </p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">통근 상황</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">통근 시간</label>
            <select
              value={preferences.commutePreferences.commuteTime}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                commutePreferences: {
                  ...prev.commutePreferences,
                  commuteTime: parseInt(e.target.value)
                }
              }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={15}>15분 이내</option>
              <option value={30}>30분 이내</option>
              <option value={45}>45분 이내</option>
              <option value={60}>1시간 이내</option>
              <option value={90}>1시간 30분 이내</option>
              <option value={120}>2시간 이상</option>
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.commutePreferences.nightTransportDifficulty}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                commutePreferences: {
                  ...prev.commutePreferences,
                  nightTransportDifficulty: e.target.checked
                }
              }))}
              className="rounded text-blue-600"
            />
            <Moon className="w-4 h-4 text-gray-500" />
            <span className="text-sm">야간 대중교통 이용이 어렵습니다</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.commutePreferences.carpoolInterested}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                commutePreferences: {
                  ...prev.commutePreferences,
                  carpoolInterested: e.target.checked
                }
              }))}
              className="rounded text-blue-600"
            />
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-sm">카풀에 관심있습니다</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderTeamPreferences = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">팀워크 선호</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">멘토링 역할</label>
            <select
              value={preferences.teamPreferences.mentorshipRole}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                teamPreferences: {
                  ...prev.teamPreferences,
                  mentorshipRole: e.target.value as 'mentor' | 'mentee' | 'both' | 'none'
                }
              }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="mentor">멘토가 되고 싶음</option>
              <option value="mentee">멘토링을 받고 싶음</option>
              <option value="both">둘 다 관심있음</option>
              <option value="none">관심없음</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">의사소통 스타일</label>
            <select
              value={preferences.teamPreferences.communicationStyle}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                teamPreferences: {
                  ...prev.teamPreferences,
                  communicationStyle: e.target.value as 'direct' | 'gentle' | 'detailed' | 'brief'
                }
              }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="direct">직접적이고 명확한</option>
              <option value="gentle">부드럽고 배려하는</option>
              <option value="detailed">상세하고 구체적인</option>
              <option value="brief">간결하고 핵심적인</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">경력 개발</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Award className="w-4 h-4 inline mr-1" />
              관심있는 전문 분야
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['응급간호', '중환자간호', '수술간호', '소아간호', '노인간호', '정신간호'].map(spec => (
                <label key={spec} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm">{spec}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.professionalDevelopment.teachingInterest}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  professionalDevelopment: {
                    ...prev.professionalDevelopment,
                    teachingInterest: e.target.checked
                  }
                }))}
                className="rounded text-blue-600"
              />
              <span className="text-sm">교육에 관심</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.professionalDevelopment.researchInterest}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  professionalDevelopment: {
                    ...prev.professionalDevelopment,
                    researchInterest: e.target.checked
                  }
                }))}
                className="rounded text-blue-600"
              />
              <span className="text-sm">연구에 관심</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSpecialRequests = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">종교/문화적 고려사항</h3>

        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.specialRequests.religiousObservances.needed}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                specialRequests: {
                  ...prev.specialRequests,
                  religiousObservances: {
                    ...prev.specialRequests.religiousObservances,
                    needed: e.target.checked
                  }
                }
              }))}
              className="rounded text-blue-600"
            />
            <span className="text-sm">종교적 의무가 있습니다</span>
          </label>

          {preferences.specialRequests.religiousObservances.needed && (
            <div className="ml-6 p-3 bg-purple-50 rounded-lg">
              <textarea
                placeholder="예: 주일 예배, 라마단 기간 등"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">비상 연락처</h3>
        <div className="grid grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="이름"
            value={preferences.specialRequests.emergencyContact.name}
            onChange={(e) => setPreferences(prev => ({
              ...prev,
              specialRequests: {
                ...prev.specialRequests,
                emergencyContact: {
                  ...prev.specialRequests.emergencyContact,
                  name: e.target.value
                }
              }
            }))}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="관계"
            value={preferences.specialRequests.emergencyContact.relationship}
            onChange={(e) => setPreferences(prev => ({
              ...prev,
              specialRequests: {
                ...prev.specialRequests,
                emergencyContact: {
                  ...prev.specialRequests.emergencyContact,
                  relationship: e.target.value
                }
              }
            }))}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="tel"
            placeholder="전화번호"
            value={preferences.specialRequests.emergencyContact.phone}
            onChange={(e) => setPreferences(prev => ({
              ...prev,
              specialRequests: {
                ...prev.specialRequests,
                emergencyContact: {
                  ...prev.specialRequests.emergencyContact,
                  phone: e.target.value
                }
              }
            }))}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">임시 요청사항</h3>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-700 mb-3">
                특정 기간 동안만 필요한 요청사항을 입력해주세요
              </p>
              <button className="text-sm text-blue-600 hover:text-blue-700">
                + 임시 요청 추가
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPriorities = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">나의 우선순위</h3>
        <p className="text-sm text-gray-600 mb-4">
          각 항목의 중요도를 설정해주세요. AI가 스케줄을 생성할 때 참고합니다.
        </p>

        <div className="space-y-6">
          {Object.entries({
            workLifeBalance: { label: '일과 삶의 균형', icon: '⚖️' },
            careerGrowth: { label: '경력 성장', icon: '📈' },
            teamHarmony: { label: '팀 화합', icon: '🤝' },
            incomeMaximization: { label: '소득 극대화', icon: '💰' },
            healthWellbeing: { label: '건강과 웰빙', icon: '❤️' },
            familyTime: { label: '가족과의 시간', icon: '👨‍👩‍👧‍👦' },
          }).map(([key, { label, icon }]) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {icon} {label}
                </span>
                <span className="text-sm text-gray-500">
                  {preferences.priorities[key as keyof typeof preferences.priorities]}/10
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={preferences.priorities[key as keyof typeof preferences.priorities]}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  priorities: {
                    ...prev.priorities,
                    [key]: parseInt(e.target.value)
                  }
                }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>낮음</span>
                <span>보통</span>
                <span>높음</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-blue-50 rounded-lg">
        <div className="flex items-start gap-2">
          <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">AI 최적화 안내</h4>
            <p className="text-sm text-gray-600">
              설정하신 우선순위를 바탕으로 AI가 최적의 스케줄을 생성합니다.
              모든 요구사항을 100% 충족시킬 수는 없지만, 최대한 반영하려 노력합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'work', label: '근무 선호', icon: Clock },
    { id: 'team', label: '팀/경력', icon: Users },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">나의 선호도 설정</h2>
              <p className="text-sm text-gray-500 mt-1">
                근무 선호와 개인 상황을 상세히 입력하면 더 나은 스케줄을 받을 수 있습니다
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-6 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {validationErrors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  {validationErrors.map((error, idx) => (
                    <p key={idx} className="text-sm text-red-600">{error}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'work' && renderWorkPreferences()}
          {activeTab === 'team' && renderTeamPreferences()}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Shield className="w-4 h-4" />
              <span>모든 정보는 안전하게 보호되며 스케줄링 목적으로만 사용됩니다</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saveStatus === 'saving' && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {saveStatus === 'success' && <CheckCircle className="w-4 h-4" />}
                {saveStatus === 'idle' && <Save className="w-4 h-4" />}
                {saveStatus === 'saving' ? '저장 중...' : saveStatus === 'success' ? '저장 완료!' : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
