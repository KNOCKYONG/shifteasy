"use client";
import { useState } from "react";
import { Settings, Users, Clock, Shield, Calendar, AlertCircle, ChevronRight, Save, RotateCcw, Zap, Brain, Heart, Scale, AlertTriangle } from "lucide-react";
import { type Constraint, type ShiftPattern, type Shift, type OptimizationGoal } from "@/lib/scheduler/types";

interface ScheduleConfigPanelProps {
  onConfigChange: (config: ScheduleConfig) => void;
  currentConfig?: ScheduleConfig;
}

export interface ScheduleConfig {
  // 기본 설정
  departmentId: string;
  period: {
    startDate: Date;
    endDate: Date;
    type: 'weekly' | 'biweekly' | 'monthly';
  };

  // 시프트 설정
  shifts: CustomShift[];
  pattern?: ShiftPattern;

  // 제약조건 설정
  constraints: ConstraintConfig;

  // 최적화 목표
  optimizationGoal: OptimizationGoal;
  weights: OptimizationWeights;

  // 특별 규칙
  specialRules: SpecialRule[];

  // 자동화 설정
  automation: AutomationSettings;
}

interface CustomShift extends Shift {
  flexibleStart?: boolean; // 유연근무 시작시간
  breakTime?: number; // 휴게시간 (분)
  mealAllowance?: boolean; // 식대 지급
  nightAllowance?: boolean; // 야간수당
  requiredSkills?: string[]; // 필요 스킬
  seniorityLevel?: number; // 필요 경력 수준
}

interface ConstraintConfig {
  // 법적 제약
  legal: {
    maxWeeklyHours: number;
    maxDailyHours: number;
    maxConsecutiveDays: number;
    minRestBetweenShifts: number;
    minWeeklyRestDays: number;
    overtimeAllowed: boolean;
    overtimeMaxHours?: number;
  };

  // 운영 제약
  operational: {
    minStaffPerShift: Record<string, number>;
    maxStaffPerShift: Record<string, number>;
    requiredSeniorStaff: number; // 시프트당 필요 선임 간호사
    maxJuniorOnly: number; // 신입만 있을 수 있는 최대 인원
    skillMixRequired: boolean; // 스킬 믹스 필요 여부
  };

  // 공정성 제약
  fairness: {
    maxWeekendShiftsPerMonth: number;
    maxNightShiftsPerMonth: number;
    maxHolidayShiftsPerYear: number;
    consecutiveWeekendsAllowed: boolean;
    fairnessStrictness: 'low' | 'medium' | 'high' | 'strict';
  };

  // 개인 선호도
  preference: {
    respectDayOffRequests: boolean;
    respectShiftPreferences: boolean;
    respectTeamPreferences: boolean; // 같이 일하고 싶은 동료
    avoidanceRules: boolean; // 같이 일하기 싫은 동료
    flexibilityBonus: boolean; // 유연한 직원에게 보너스
  };
}

interface OptimizationWeights {
  fairness: number; // 0-100
  preference: number; // 0-100
  coverage: number; // 0-100
  cost: number; // 0-100
  continuity: number; // 0-100 (같은 팀 유지)
}

interface SpecialRule {
  id: string;
  name: string;
  type: 'holiday' | 'training' | 'meeting' | 'emergency' | 'custom';
  description: string;
  dateRange?: { start: Date; end: Date };
  affectedShifts?: string[];
  staffingAdjustment?: number; // 인원 조정 (+/- 명)
  priority: 'low' | 'medium' | 'high' | 'critical';
  active: boolean;
}

interface AutomationSettings {
  autoApproveSwaps: boolean;
  swapValidationLevel: 'none' | 'basic' | 'strict';
  autoFillSickLeave: boolean;
  suggestOptimalSwaps: boolean;
  notifyOnViolations: boolean;
  escalationRules: {
    understaffing: boolean;
    overtime: boolean;
    violations: boolean;
  };
}

export function ScheduleConfigPanel({ onConfigChange, currentConfig }: ScheduleConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'shifts' | 'constraints' | 'fairness' | 'special' | 'automation'>('basic');
  const [config, setConfig] = useState<ScheduleConfig>(currentConfig || getDefaultConfig());
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 수간호사 프리셋 - 일반적인 병원 설정
  const nursingPresets = {
    general_ward: {
      name: "일반 병동",
      description: "일반 병동 3교대 표준 설정",
      config: {
        shifts: [
          { id: 'day', name: '주간', type: 'day' as const, color: 'bg-blue-100', time: { start: '07:00', end: '15:00', hours: 8 }, requiredStaff: 7, minStaff: 5 },
          { id: 'evening', name: '저녁', type: 'evening' as const, color: 'bg-purple-100', time: { start: '15:00', end: '23:00', hours: 8 }, requiredStaff: 5, minStaff: 4 },
          { id: 'night', name: '야간', type: 'night' as const, color: 'bg-indigo-100', time: { start: '23:00', end: '07:00', hours: 8 }, requiredStaff: 4, minStaff: 3 },
        ],
        constraints: {
          operational: {
            requiredSeniorStaff: 1,
            maxJuniorOnly: 2,
          }
        }
      }
    },
    icu: {
      name: "중환자실",
      description: "중환자실 강화된 인력 배치",
      config: {
        shifts: [
          { id: 'day', name: '주간', type: 'day' as const, color: 'bg-blue-100', time: { start: '07:00', end: '19:00', hours: 12 }, requiredStaff: 10, minStaff: 8 },
          { id: 'night', name: '야간', type: 'night' as const, color: 'bg-indigo-100', time: { start: '19:00', end: '07:00', hours: 12 }, requiredStaff: 8, minStaff: 6 },
        ],
        constraints: {
          operational: {
            requiredSeniorStaff: 2,
            maxJuniorOnly: 1,
            skillMixRequired: true,
          }
        }
      }
    },
    emergency: {
      name: "응급실",
      description: "24시간 응급실 변동 인력",
      config: {
        shifts: [
          { id: 'day', name: '주간', type: 'day' as const, color: 'bg-blue-100', time: { start: '08:00', end: '16:00', hours: 8 }, requiredStaff: 8, minStaff: 6 },
          { id: 'evening', name: '저녁', type: 'evening' as const, color: 'bg-purple-100', time: { start: '16:00', end: '00:00', hours: 8 }, requiredStaff: 10, minStaff: 8 },
          { id: 'night', name: '야간', type: 'night' as const, color: 'bg-indigo-100', time: { start: '00:00', end: '08:00', hours: 8 }, requiredStaff: 6, minStaff: 5 },
        ],
        specialRules: [
          {
            name: "주말 응급 증원",
            type: 'custom',
            description: "주말 저녁 시간대 인력 20% 증원",
            staffingAdjustment: 2,
            priority: 'high'
          }
        ]
      }
    }
  };

  const handlePresetSelect = (presetKey: string) => {
    const preset = nursingPresets[presetKey as keyof typeof nursingPresets];
    if (preset) {
      setConfig(prev => ({
        ...prev,
        shifts: preset.config.shifts,
        constraints: {
          ...prev.constraints,
          operational: {
            ...prev.constraints.operational,
            ...(preset.config as any).constraints?.operational
          }
        },
        specialRules: (preset.config as any).specialRules || prev.specialRules
      }));
    }
  };

  const handleSave = () => {
    onConfigChange(config);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="w-6 h-6" />
              스케줄 설정 관리
            </h2>
            <p className="text-blue-100 mt-1">수간호사님의 스케줄링 부담을 덜어드립니다</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {showAdvanced ? '기본 설정' : '고급 설정'}
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
            >
              <Save className="w-4 h-4" />
              설정 저장
            </button>
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="bg-blue-50 border-b border-blue-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-900">
            <Brain className="w-5 h-5" />
            <span className="font-medium">빠른 프리셋</span>
          </div>
          <div className="flex gap-2">
            {Object.entries(nursingPresets).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => handlePresetSelect(key)}
                className="px-3 py-1.5 bg-white hover:bg-blue-100 border border-blue-200 rounded-lg text-sm transition-colors"
                title={preset.description}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4 px-6" aria-label="Tabs">
          {[
            { id: 'basic', label: '기본 설정', icon: Calendar },
            { id: 'shifts', label: '시프트 관리', icon: Clock },
            { id: 'constraints', label: '제약 조건', icon: Shield },
            { id: 'fairness', label: '공정성', icon: Scale },
            { id: 'special', label: '특별 규칙', icon: AlertTriangle },
            { id: 'automation', label: '자동화', icon: Zap },
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
      <div className="p-6">
        {activeTab === 'basic' && (
          <BasicSettings config={config} setConfig={setConfig} />
        )}

        {activeTab === 'shifts' && (
          <ShiftSettings config={config} setConfig={setConfig} showAdvanced={showAdvanced} />
        )}

        {activeTab === 'constraints' && (
          <ConstraintSettings config={config} setConfig={setConfig} />
        )}

        {activeTab === 'fairness' && (
          <FairnessSettings config={config} setConfig={setConfig} />
        )}

        {activeTab === 'special' && (
          <SpecialRulesSettings config={config} setConfig={setConfig} />
        )}

        {activeTab === 'automation' && (
          <AutomationSettings config={config} setConfig={setConfig} />
        )}
      </div>
    </div>
  );
}

// 각 탭의 세부 구현 컴포넌트들...
function BasicSettings({ config, setConfig }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">스케줄 기간 설정</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              스케줄 타입
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={config.period.type}
              onChange={(e) => setConfig({...config, period: {...config.period, type: e.target.value}})}
            >
              <option value="weekly">주간 (1주)</option>
              <option value="biweekly">격주 (2주)</option>
              <option value="monthly">월간 (4주)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              최적화 목표
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={config.optimizationGoal}
              onChange={(e) => setConfig({...config, optimizationGoal: e.target.value})}
            >
              <option value="balanced">균형 (추천)</option>
              <option value="fairness">공정성 우선</option>
              <option value="preference">선호도 우선</option>
              <option value="coverage">인력 충족 우선</option>
              <option value="cost">비용 최소화</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">최적화 가중치</h3>
        <div className="space-y-3">
          {Object.entries(config.weights).map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">
                  {key === 'fairness' && '공정성'}
                  {key === 'preference' && '개인 선호도'}
                  {key === 'coverage' && '인력 충족도'}
                  {key === 'cost' && '비용 효율성'}
                  {key === 'continuity' && '팀 연속성'}
                </label>
                <span className="text-sm text-gray-500">{value as number}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={value as number}
                onChange={(e) => setConfig({
                  ...config,
                  weights: {...config.weights, [key]: parseInt(e.target.value)}
                })}
                className="w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShiftSettings({ config, setConfig, showAdvanced }: any) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">시프트 설정</h3>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          + 시프트 추가
        </button>
      </div>

      <div className="space-y-4">
        {config.shifts.map((shift: CustomShift, index: number) => (
          <div key={shift.id} className="border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시프트명</label>
                <input
                  type="text"
                  value={shift.name}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시작 시간</label>
                <input
                  type="time"
                  value={shift.time.start}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">종료 시간</label>
                <input
                  type="time"
                  value={shift.time.end}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">필요 인원</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={shift.minStaff}
                    placeholder="최소"
                    className="w-1/3 px-2 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="number"
                    value={shift.requiredStaff}
                    placeholder="적정"
                    className="w-1/3 px-2 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="number"
                    value={shift.maxStaff}
                    placeholder="최대"
                    className="w-1/3 px-2 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {showAdvanced && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id={`flex-${shift.id}`} checked={shift.flexibleStart} />
                    <label htmlFor={`flex-${shift.id}`} className="text-sm">유연 시작시간 (±30분)</label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="checkbox" id={`meal-${shift.id}`} checked={shift.mealAllowance} />
                    <label htmlFor={`meal-${shift.id}`} className="text-sm">식대 지급</label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="checkbox" id={`night-${shift.id}`} checked={shift.nightAllowance} />
                    <label htmlFor={`night-${shift.id}`} className="text-sm">야간 수당</label>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConstraintSettings({ config, setConfig }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-900">법적 제약사항</h4>
            <p className="text-sm text-red-700 mt-1">근로기준법에 따른 필수 준수 사항입니다.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-3">근로시간 제한</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">주당 최대 근로시간</label>
              <input
                type="number"
                value={config.constraints.legal.maxWeeklyHours}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">일일 최대 근로시간</label>
              <input
                type="number"
                value={config.constraints.legal.maxDailyHours}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">연속 근무 가능일</label>
              <input
                type="number"
                value={config.constraints.legal.maxConsecutiveDays}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-3">휴식 보장</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">교대 간 최소 휴식(시간)</label>
              <input
                type="number"
                value={config.constraints.legal.minRestBetweenShifts}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">주당 최소 휴무일</label>
              <input
                type="number"
                value={config.constraints.legal.minWeeklyRestDays}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="overtime"
                checked={config.constraints.legal.overtimeAllowed}
              />
              <label htmlFor="overtime" className="text-sm">초과근무 허용</label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FairnessSettings({ config, setConfig }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Heart className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">공정성 보장</h4>
            <p className="text-sm text-blue-700 mt-1">모든 직원이 만족할 수 있는 공정한 스케줄을 만듭니다.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-3">근무 배분</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">월 최대 주말 근무</label>
              <input
                type="number"
                value={config.constraints.fairness.maxWeekendShiftsPerMonth}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">월 최대 야간 근무</label>
              <input
                type="number"
                value={config.constraints.fairness.maxNightShiftsPerMonth}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">연간 최대 공휴일 근무</label>
              <input
                type="number"
                value={config.constraints.fairness.maxHolidayShiftsPerYear}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-3">공정성 수준</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">공정성 엄격도</label>
              <select
                value={config.constraints.fairness.fairnessStrictness}
                onChange={(e) => setConfig({
                  ...config,
                  constraints: {
                    ...config.constraints,
                    fairness: {
                      ...config.constraints.fairness,
                      fairnessStrictness: e.target.value
                    }
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="low">낮음 - 유연한 배치</option>
                <option value="medium">중간 - 균형적 배치</option>
                <option value="high">높음 - 엄격한 공정성</option>
                <option value="strict">매우 높음 - 완벽한 균등</option>
              </select>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="consecutive-weekends"
                checked={config.constraints.fairness.consecutiveWeekendsAllowed}
              />
              <label htmlFor="consecutive-weekends" className="text-sm">연속 주말 근무 허용</label>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium mb-3">개인 선호도 반영</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="day-off-requests"
              checked={config.constraints.preference.respectDayOffRequests}
            />
            <label htmlFor="day-off-requests" className="text-sm">휴무 요청 우선 반영</label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="shift-preferences"
              checked={config.constraints.preference.respectShiftPreferences}
            />
            <label htmlFor="shift-preferences" className="text-sm">선호 시프트 반영</label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="team-preferences"
              checked={config.constraints.preference.respectTeamPreferences}
            />
            <label htmlFor="team-preferences" className="text-sm">선호 팀원 배치</label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="flexibility-bonus"
              checked={config.constraints.preference.flexibilityBonus}
            />
            <label htmlFor="flexibility-bonus" className="text-sm">유연한 직원 우대</label>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecialRulesSettings({ config, setConfig }: any) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">특별 규칙 관리</h3>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          + 규칙 추가
        </button>
      </div>

      <div className="space-y-3">
        {config.specialRules.map((rule: SpecialRule) => (
          <div key={rule.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{rule.name}</h4>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    rule.priority === 'critical' ? 'bg-red-100 text-red-700' :
                    rule.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                    rule.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {rule.priority}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                {rule.staffingAdjustment && (
                  <p className="text-sm text-blue-600 mt-2">
                    인원 조정: {rule.staffingAdjustment > 0 ? '+' : ''}{rule.staffingAdjustment}명
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={rule.active} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-900 mb-2">예시 규칙</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• 연말연시 특별 근무 (12/24, 12/31 인원 50% 축소)</li>
          <li>• 월례 교육일 (매월 첫째 주 수요일 오후 인원 조정)</li>
          <li>• 신규 간호사 OT 기간 (별도 스케줄 적용)</li>
          <li>• 응급 상황 대비 인력 (주말 야간 +1명)</li>
        </ul>
      </div>
    </div>
  );
}

function AutomationSettings({ config, setConfig }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Zap className="w-5 h-5 text-purple-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-purple-900">자동화 설정</h4>
            <p className="text-sm text-purple-700 mt-1">반복적인 작업을 자동화하여 시간을 절약합니다.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium mb-3">교대 요청 자동화</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="auto-approve" className="text-sm">
                조건 충족 시 자동 승인
              </label>
              <input
                type="checkbox"
                id="auto-approve"
                checked={config.automation.autoApproveSwaps}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">검증 수준</label>
              <select
                value={config.automation.swapValidationLevel}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="none">검증 없음 (빠른 처리)</option>
                <option value="basic">기본 검증 (법규만)</option>
                <option value="strict">엄격 검증 (모든 제약)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium mb-3">스마트 기능</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="auto-fill" className="text-sm">
                병가 자동 대체 인력 배치
              </label>
              <input
                type="checkbox"
                id="auto-fill"
                checked={config.automation.autoFillSickLeave}
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="suggest-swaps" className="text-sm">
                최적 교대 매칭 제안
              </label>
              <input
                type="checkbox"
                id="suggest-swaps"
                checked={config.automation.suggestOptimalSwaps}
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="notify-violations" className="text-sm">
                제약 위반 시 즉시 알림
              </label>
              <input
                type="checkbox"
                id="notify-violations"
                checked={config.automation.notifyOnViolations}
              />
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium mb-3">에스컬레이션 규칙</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="escalate-understaffing" className="text-sm">
                인력 부족 시 상위 관리자 알림
              </label>
              <input
                type="checkbox"
                id="escalate-understaffing"
                checked={config.automation.escalationRules.understaffing}
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="escalate-overtime" className="text-sm">
                초과근무 발생 시 알림
              </label>
              <input
                type="checkbox"
                id="escalate-overtime"
                checked={config.automation.escalationRules.overtime}
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="escalate-violations" className="text-sm">
                법규 위반 위험 시 긴급 알림
              </label>
              <input
                type="checkbox"
                id="escalate-violations"
                checked={config.automation.escalationRules.violations}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getDefaultConfig(): ScheduleConfig {
  return {
    departmentId: 'all',
    period: {
      startDate: new Date(),
      endDate: new Date(),
      type: 'weekly'
    },
    shifts: [
      {
        id: 'day',
        type: 'day',
        name: '주간',
        time: { start: '07:00', end: '15:00', hours: 8 },
        color: '#3B82F6',
        requiredStaff: 5,
        minStaff: 4,
        maxStaff: 6,
      },
      {
        id: 'evening',
        type: 'evening',
        name: '저녁',
        time: { start: '15:00', end: '23:00', hours: 8 },
        color: '#8B5CF6',
        requiredStaff: 4,
        minStaff: 3,
        maxStaff: 5,
      },
      {
        id: 'night',
        type: 'night',
        name: '야간',
        time: { start: '23:00', end: '07:00', hours: 8 },
        color: '#6366F1',
        requiredStaff: 3,
        minStaff: 2,
        maxStaff: 4,
      },
    ],
    constraints: {
      legal: {
        maxWeeklyHours: 52,
        maxDailyHours: 12,
        maxConsecutiveDays: 6,
        minRestBetweenShifts: 11,
        minWeeklyRestDays: 1,
        overtimeAllowed: true,
        overtimeMaxHours: 12,
      },
      operational: {
        minStaffPerShift: { day: 4, evening: 3, night: 2 },
        maxStaffPerShift: { day: 8, evening: 6, night: 5 },
        requiredSeniorStaff: 1,
        maxJuniorOnly: 2,
        skillMixRequired: true,
      },
      fairness: {
        maxWeekendShiftsPerMonth: 2,
        maxNightShiftsPerMonth: 7,
        maxHolidayShiftsPerYear: 4,
        consecutiveWeekendsAllowed: false,
        fairnessStrictness: 'medium',
      },
      preference: {
        respectDayOffRequests: true,
        respectShiftPreferences: true,
        respectTeamPreferences: true,
        avoidanceRules: true,
        flexibilityBonus: true,
      },
    },
    optimizationGoal: 'balanced',
    weights: {
      fairness: 30,
      preference: 25,
      coverage: 25,
      cost: 10,
      continuity: 10,
    },
    specialRules: [],
    automation: {
      autoApproveSwaps: false,
      swapValidationLevel: 'basic',
      autoFillSickLeave: true,
      suggestOptimalSwaps: true,
      notifyOnViolations: true,
      escalationRules: {
        understaffing: true,
        overtime: true,
        violations: true,
      },
    },
  };
}