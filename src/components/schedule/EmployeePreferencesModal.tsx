"use client";
import { useState } from "react";
import { User, Heart, Calendar, Clock, Users, Shield, X, Save, AlertCircle, Star, UserCheck, UserMinus, ChevronLeft, ChevronRight } from "lucide-react";
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
  preferredPattern?: string;

  // 확장된 선호도
  workLoadPreference: 'light' | 'normal' | 'heavy'; // 업무량 선호
  flexibilityLevel: 'low' | 'medium' | 'high'; // 유연성 수준
  preferredPattern?: string; // 선호하는 근무 패턴

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
    preferredPattern: '',
  } as any);

  const [activeTab, setActiveTab] = useState<'basic' | 'personal' | 'request'>('basic');
  const [showConstraintForm, setShowConstraintForm] = useState(false);

  // Request 탭을 위한 state
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [shiftRequests, setShiftRequests] = useState<Record<string, 'D' | 'E' | 'N' | 'OFF' | '연차'>>({});

  const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
  const shiftTypes: { value: ShiftType; label: string; color: string }[] = [
    { value: 'day', label: '주간', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'evening', label: '저녁', color: 'bg-purple-100 text-purple-800' },
    { value: 'night', label: '야간', color: 'bg-indigo-100 text-indigo-800' },
    { value: 'off', label: '휴무', color: 'bg-gray-100 text-gray-800 dark:text-gray-200' },
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
              {/* 선호 시프트 */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">선호하는 근무 시간</h3>
                <div className="flex gap-2">
                  {shiftTypes.filter(s => s.value !== 'off').map(shift => (
                    <button
                      key={shift.value}
                      onClick={() => toggleShiftPreference(shift.value, 'preferred')}
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

              {/* 선호 휴무일 */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">선호하는 휴무일</h3>
                <div className="flex gap-2">
                  {daysOfWeek.map((day, index) => (
                    <button
                      key={index}
                      onClick={() => toggleDayOffPreference(index)}
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

              {/* 선호 근무 패턴 */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">선호 근무 패턴</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'D-D-E-E-N-N-OFF', label: '교대 근무', description: '주간 → 저녁 → 야간 순환' },
                    { value: 'D-D-D-D-D-OFF-OFF', label: '5일 근무', description: '주간 5일 연속 근무' },
                    { value: 'D-OFF-D-OFF-D-OFF-D', label: '격일 근무', description: '1일 근무, 1일 휴무' },
                    { value: 'N-N-N-OFF-OFF-OFF-OFF', label: '야간 집중', description: '야간 3일, 4일 휴무' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setPreferences({...preferences, preferredPattern: option.value})}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        (preferences as any).preferredPattern === option.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{option.label}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{option.description}</div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-mono">{option.value}</div>
                    </button>
                  ))}
                </div>
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
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{currentRequest}</span>
                            </div>
                          )}
                        </div>
                        {/* 클릭 시 선택 드롭다운 */}
                        <select
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          value={currentRequest || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              setShiftRequests({
                                ...shiftRequests,
                                [dateKey]: e.target.value as any
                              });
                            } else {
                              const newRequests = {...shiftRequests};
                              delete newRequests[dateKey];
                              setShiftRequests(newRequests);
                            }
                          }}
                        >
                          <option value="">선택 안함</option>
                          <option value="D">D (주간)</option>
                          <option value="E">E (저녁)</option>
                          <option value="N">N (야간)</option>
                          <option value="OFF">OFF (휴무)</option>
                          <option value="연차">연차</option>
                        </select>
                      </div>
                    );
                  }

                  return days;
                })()}
              </div>

              {/* 범례 */}
              <div className="flex gap-4 justify-center text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-blue-600">D</span> - 주간
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-blue-600">E</span> - 저녁
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-blue-600">N</span> - 야간
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-blue-600">OFF</span> - 휴무
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-blue-600">연차</span> - 연차
                </div>
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
