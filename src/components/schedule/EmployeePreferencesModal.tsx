"use client";
import { useState } from "react";
import { User, Heart, Calendar, Clock, Users, Shield, X, Save, AlertCircle, Star, UserCheck, UserX } from "lucide-react";
import { type Employee, type EmployeePreferences, type ShiftType } from "@/lib/scheduler/types";

interface EmployeePreferencesModalProps {
  employee: Employee;
  onSave: (preferences: ExtendedEmployeePreferences) => void;
  onClose: () => void;
  teamMembers: Employee[];
}

// 확장된 직원 선호도 인터페이스
export interface ExtendedEmployeePreferences extends EmployeePreferences {
  // 기본 선호도
  preferredShifts: ShiftType[];
  avoidShifts: ShiftType[];
  preferredDaysOff: number[];
  maxConsecutiveDays: number;
  preferNightShift: boolean;

  // 확장된 선호도
  workLoadPreference: 'light' | 'normal' | 'heavy'; // 업무량 선호
  flexibilityLevel: 'low' | 'medium' | 'high'; // 유연성 수준

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

export function EmployeePreferencesModal({
  employee,
  onSave,
  onClose,
  teamMembers
}: EmployeePreferencesModalProps) {
  const [preferences, setPreferences] = useState<ExtendedEmployeePreferences>({
    ...employee.preferences,
    workLoadPreference: 'normal',
    flexibilityLevel: 'medium',
    preferredPartners: [],
    avoidPartners: [],
    personalConstraints: [],
    trainingDays: [],
    mentorshipRole: 'none',
    specialization: [],
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
  });

  const [activeTab, setActiveTab] = useState<'basic' | 'team' | 'personal' | 'health' | 'development'>('basic');
  const [showConstraintForm, setShowConstraintForm] = useState(false);

  const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
  const shiftTypes: { value: ShiftType; label: string; color: string }[] = [
    { value: 'day', label: '주간', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'evening', label: '저녁', color: 'bg-purple-100 text-purple-800' },
    { value: 'night', label: '야간', color: 'bg-indigo-100 text-indigo-800' },
    { value: 'off', label: '휴무', color: 'bg-gray-100 text-gray-800' },
  ];

  const personalConstraintTypes = [
    { value: 'childcare', label: '육아', icon: '👶' },
    { value: 'eldercare', label: '간병', icon: '👵' },
    { value: 'education', label: '학업', icon: '📚' },
    { value: 'medical', label: '의료', icon: '🏥' },
    { value: 'religious', label: '종교', icon: '🙏' },
    { value: 'other', label: '기타', icon: '📝' },
  ];

  const handleSave = () => {
    onSave(preferences);
  };

  const toggleShiftPreference = (shift: ShiftType, type: 'preferred' | 'avoid') => {
    if (type === 'preferred') {
      const current = preferences.preferredShifts;
      if (current.includes(shift)) {
        setPreferences({
          ...preferences,
          preferredShifts: current.filter(s => s !== shift),
        });
      } else {
        setPreferences({
          ...preferences,
          preferredShifts: [...current, shift],
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
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
        <div className="border-b border-gray-200 bg-gray-50">
          <nav className="flex space-x-4 px-6" aria-label="Tabs">
            {[
              { id: 'basic', label: '기본 선호도', icon: Clock },
              { id: 'team', label: '팀 선호도', icon: Users },
              { id: 'personal', label: '개인 사정', icon: Calendar },
              { id: 'health', label: '건강/통근', icon: Shield },
              { id: 'development', label: '경력 개발', icon: Star },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
              {/* 선호 시프트 */}
              <div>
                <h3 className="font-semibold mb-3">선호하는 근무 시간</h3>
                <div className="flex gap-2">
                  {shiftTypes.filter(s => s.value !== 'off').map(shift => (
                    <button
                      key={shift.value}
                      onClick={() => toggleShiftPreference(shift.value, 'preferred')}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        preferences.preferredShifts.includes(shift.value)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className={`px-2 py-1 rounded text-sm ${shift.color}`}>
                        {shift.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 회피 시프트 */}
              <div>
                <h3 className="font-semibold mb-3">피하고 싶은 근무 시간</h3>
                <div className="flex gap-2">
                  {shiftTypes.filter(s => s.value !== 'off').map(shift => (
                    <button
                      key={shift.value}
                      onClick={() => toggleShiftPreference(shift.value, 'avoid')}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        preferences.avoidShifts.includes(shift.value)
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className={`px-2 py-1 rounded text-sm ${shift.color}`}>
                        {shift.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 선호 휴무일 */}
              <div>
                <h3 className="font-semibold mb-3">선호하는 휴무일</h3>
                <div className="flex gap-2">
                  {daysOfWeek.map((day, index) => (
                    <button
                      key={index}
                      onClick={() => toggleDayOffPreference(index)}
                      className={`w-12 h-12 rounded-lg border-2 transition-all ${
                        preferences.preferredDaysOff.includes(index)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : ''}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* 근무 강도 */}
              <div>
                <h3 className="font-semibold mb-3">선호 근무 강도</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'light', label: '가벼운 업무', description: '여유있는 근무 선호' },
                    { value: 'normal', label: '일반 업무', description: '표준 근무 강도' },
                    { value: 'heavy', label: '집중 업무', description: '바쁜 근무 선호' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setPreferences({...preferences, workLoadPreference: option.value as any})}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        preferences.workLoadPreference === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 연속 근무 제한 */}
              <div>
                <h3 className="font-semibold mb-3">최대 연속 근무일</h3>
                <input
                  type="range"
                  min="3"
                  max="7"
                  value={preferences.maxConsecutiveDays}
                  onChange={(e) => setPreferences({...preferences, maxConsecutiveDays: parseInt(e.target.value)})}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-600 mt-1">
                  <span>3일</span>
                  <span className="font-medium text-blue-600">{preferences.maxConsecutiveDays}일</span>
                  <span>7일</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-6">
              {/* 선호 동료 */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-green-600" />
                  같이 일하고 싶은 동료
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {teamMembers.filter(m => m.id !== employee.id).map(member => (
                    <button
                      key={member.id}
                      onClick={() => {
                        const current = preferences.preferredPartners;
                        if (current.includes(member.id)) {
                          setPreferences({
                            ...preferences,
                            preferredPartners: current.filter(id => id !== member.id),
                          });
                        } else {
                          setPreferences({
                            ...preferences,
                            preferredPartners: [...current, member.id],
                            avoidPartners: preferences.avoidPartners.filter(id => id !== member.id),
                          });
                        }
                      }}
                      className={`p-2 rounded-lg border text-sm transition-all ${
                        preferences.preferredPartners.includes(member.id)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {member.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 회피 동료 */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <UserX className="w-5 h-5 text-red-600" />
                  같이 일하기 어려운 동료
                </h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-red-700">
                    이 정보는 비밀로 유지되며, 스케줄링 알고리즘에만 사용됩니다.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {teamMembers.filter(m => m.id !== employee.id).map(member => (
                    <button
                      key={member.id}
                      onClick={() => {
                        const current = preferences.avoidPartners;
                        if (current.includes(member.id)) {
                          setPreferences({
                            ...preferences,
                            avoidPartners: current.filter(id => id !== member.id),
                          });
                        } else {
                          setPreferences({
                            ...preferences,
                            avoidPartners: [...current, member.id],
                            preferredPartners: preferences.preferredPartners.filter(id => id !== member.id),
                          });
                        }
                      }}
                      className={`p-2 rounded-lg border text-sm transition-all ${
                        preferences.avoidPartners.includes(member.id)
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {member.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 유연성 수준 */}
              <div>
                <h3 className="font-semibold mb-3">스케줄 유연성</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'low', label: '고정적', description: '일정한 패턴 선호' },
                    { value: 'medium', label: '보통', description: '적당한 변화 수용' },
                    { value: 'high', label: '유연함', description: '다양한 근무 가능' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setPreferences({...preferences, flexibilityLevel: option.value as any})}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        preferences.flexibilityLevel === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'personal' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">개인 사정 및 제약사항</h3>
                <button
                  onClick={() => setShowConstraintForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + 추가
                </button>
              </div>

              {preferences.personalConstraints.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>등록된 개인 사정이 없습니다.</p>
                  <p className="text-sm mt-1">육아, 간병, 학업 등의 사정을 등록하세요.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {preferences.personalConstraints.map(constraint => (
                    <div key={constraint.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl">
                              {personalConstraintTypes.find(t => t.value === constraint.type)?.icon}
                            </span>
                            <span className="font-medium">
                              {personalConstraintTypes.find(t => t.value === constraint.type)?.label}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              constraint.priority === 'critical' ? 'bg-red-100 text-red-700' :
                              constraint.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                              constraint.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {constraint.priority === 'critical' ? '필수' :
                               constraint.priority === 'high' ? '중요' :
                               constraint.priority === 'medium' ? '보통' : '낮음'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{constraint.description}</p>
                          {constraint.affectedDays && (
                            <div className="flex gap-1 mt-2">
                              {constraint.affectedDays.map(day => (
                                <span key={day} className="px-2 py-1 bg-gray-100 rounded text-xs">
                                  {daysOfWeek[day]}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setPreferences({
                              ...preferences,
                              personalConstraints: preferences.personalConstraints.filter(c => c.id !== constraint.id),
                            });
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'health' && (
            <div className="space-y-6">
              {/* 건강 고려사항 */}
              <div>
                <h3 className="font-semibold mb-3">건강 관련 배려사항</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={preferences.healthConsiderations.needsLightDuty}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        healthConsiderations: {
                          ...preferences.healthConsiderations,
                          needsLightDuty: e.target.checked,
                        },
                      })}
                    />
                    <span>가벼운 업무 필요 (체력적 부담 최소화)</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={preferences.healthConsiderations.avoidLongShifts}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        healthConsiderations: {
                          ...preferences.healthConsiderations,
                          avoidLongShifts: e.target.checked,
                        },
                      })}
                    />
                    <span>장시간 근무 회피 (8시간 초과 제한)</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={preferences.healthConsiderations.requiresRegularBreaks}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        healthConsiderations: {
                          ...preferences.healthConsiderations,
                          requiresRegularBreaks: e.target.checked,
                        },
                      })}
                    />
                    <span>정기적인 휴식 필요</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={preferences.healthConsiderations.pregnancyAccommodation}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        healthConsiderations: {
                          ...preferences.healthConsiderations,
                          pregnancyAccommodation: e.target.checked,
                        },
                      })}
                    />
                    <span>임신 관련 배려 필요</span>
                  </label>
                </div>
              </div>

              {/* 통근 고려사항 */}
              <div>
                <h3 className="font-semibold mb-3">통근 관련 사항</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">최대 통근 시간 (분)</label>
                    <input
                      type="number"
                      value={preferences.commuteConsiderations.maxCommuteTime}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        commuteConsiderations: {
                          ...preferences.commuteConsiderations,
                          maxCommuteTime: parseInt(e.target.value),
                        },
                      })}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={preferences.commuteConsiderations.avoidRushHour}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        commuteConsiderations: {
                          ...preferences.commuteConsiderations,
                          avoidRushHour: e.target.checked,
                        },
                      })}
                    />
                    <span>출퇴근 시간 회피 (7-9시, 18-20시)</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={preferences.commuteConsiderations.publicTransportDependent}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        commuteConsiderations: {
                          ...preferences.commuteConsiderations,
                          publicTransportDependent: e.target.checked,
                        },
                      })}
                    />
                    <span>대중교통 의존 (막차 시간 고려 필요)</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={preferences.commuteConsiderations.needsParking}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        commuteConsiderations: {
                          ...preferences.commuteConsiderations,
                          needsParking: e.target.checked,
                        },
                      })}
                    />
                    <span>주차 공간 필요</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'development' && (
            <div className="space-y-6">
              {/* 멘토링 역할 */}
              <div>
                <h3 className="font-semibold mb-3">멘토링 프로그램</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'none', label: '참여 안함', description: '멘토링 미참여' },
                    { value: 'mentee', label: '멘티', description: '지도받는 역할' },
                    { value: 'mentor', label: '멘토', description: '지도하는 역할' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setPreferences({...preferences, mentorshipRole: option.value as any})}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        preferences.mentorshipRole === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 교육 참여일 */}
              <div>
                <h3 className="font-semibold mb-3">교육 참여 가능일</h3>
                <div className="flex gap-2">
                  {daysOfWeek.map((day, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        const current = preferences.trainingDays;
                        const dayStr = index.toString();
                        if (current.includes(dayStr)) {
                          setPreferences({
                            ...preferences,
                            trainingDays: current.filter(d => d !== dayStr),
                          });
                        } else {
                          setPreferences({
                            ...preferences,
                            trainingDays: [...current, dayStr],
                          });
                        }
                      }}
                      className={`w-12 h-12 rounded-lg border-2 transition-all ${
                        preferences.trainingDays.includes(index.toString())
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* 전문 분야 */}
              <div>
                <h3 className="font-semibold mb-3">전문 분야</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    '응급처치', '중환자케어', '수술실', '신생아실',
                    '정신건강', '감염관리', '약물관리', '상처관리',
                    '교육담당'
                  ].map(specialty => (
                    <button
                      key={specialty}
                      onClick={() => {
                        const current = preferences.specialization;
                        if (current.includes(specialty)) {
                          setPreferences({
                            ...preferences,
                            specialization: current.filter(s => s !== specialty),
                          });
                        } else {
                          setPreferences({
                            ...preferences,
                            specialization: [...current, specialty],
                          });
                        }
                      }}
                      className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                        preferences.specialization.includes(specialty)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {specialty}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <AlertCircle className="w-4 h-4" />
              <span>모든 정보는 비밀로 유지되며 스케줄 최적화에만 사용됩니다.</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                저장하기
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
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">개인 사정 추가</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <textarea
              value={constraint.description}
              onChange={(e) => setConstraint({...constraint, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
              placeholder="예: 매주 화요일 오후 3시 자녀 학원 픽업"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">중요도</label>
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
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
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