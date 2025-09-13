"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Settings, Save, AlertCircle, Clock, Users, Calendar, Shield, ChevronRight, Info } from "lucide-react";
import { type ShiftRule, type ShiftPattern } from "@/lib/types";

interface ConfigData {
  patterns: ShiftPattern[];
  rules: ShiftRule[];
  preferences: {
    autoBalance: boolean;
    maxConsecutiveShifts: number;
    minRestHours: number;
    weekendRotation: boolean;
    fairnessWeight: number;
  };
}

const DEFAULT_PATTERNS: ShiftPattern[] = [
  { id: "5-day", name: "5일 근무", description: "주 5일 근무, 2일 휴무", daysOn: 5, daysOff: 2 },
  { id: "4-day", name: "4일 근무", description: "주 4일 근무, 3일 휴무", daysOn: 4, daysOff: 3 },
  { id: "3-shift", name: "3교대", description: "주간/저녁/야간 순환", daysOn: 5, daysOff: 2 },
];

const DEFAULT_RULES: ShiftRule[] = [
  { id: "max-consecutive", name: "최대 연속 근무", type: "limit", value: 5, enabled: true },
  { id: "min-rest", name: "최소 휴식 시간", type: "minimum", value: 11, enabled: true },
  { id: "weekend-fairness", name: "주말 공평 배분", type: "balance", value: 1, enabled: true },
  { id: "night-limit", name: "월 야간 근무 제한", type: "limit", value: 8, enabled: true },
];

export default function ConfigPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"patterns" | "rules" | "preferences">("patterns");
  const [config, setConfig] = useState<ConfigData>({
    patterns: DEFAULT_PATTERNS,
    rules: DEFAULT_RULES,
    preferences: {
      autoBalance: true,
      maxConsecutiveShifts: 5,
      minRestHours: 11,
      weekendRotation: true,
      fairnessWeight: 70,
    },
  });

  const handleSave = () => {
    // Save configuration to localStorage
    localStorage.setItem("shiftConfig", JSON.stringify(config));
    alert("설정이 저장되었습니다.");
    router.push("/schedule");
  };

  const handleRuleToggle = (ruleId: string) => {
    setConfig(prev => ({
      ...prev,
      rules: prev.rules.map(rule =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      ),
    }));
  };

  const handleRuleValueChange = (ruleId: string, value: number) => {
    setConfig(prev => ({
      ...prev,
      rules: prev.rules.map(rule =>
        rule.id === ruleId ? { ...rule, value } : rule
      ),
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-semibold text-gray-900">ShiftEasy</h1>
              <nav className="flex items-center gap-6">
                <a href="/schedule" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                  스케줄
                </a>
                <a href="/team" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                  팀 관리
                </a>
                <a href="/config" className="text-sm font-medium text-blue-600">
                  설정
                </a>
              </nav>
            </div>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Save className="w-4 h-4" />
              저장하고 스케줄 생성
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="w-7 h-7 text-gray-400" />
            스케줄 설정
          </h2>
          <p className="mt-2 text-gray-600">근무 패턴과 규칙을 설정하여 최적의 스케줄을 생성하세요.</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab("patterns")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "patterns"
                  ? "text-blue-600 border-blue-600"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              근무 패턴
            </button>
            <button
              onClick={() => setActiveTab("rules")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "rules"
                  ? "text-blue-600 border-blue-600"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              근무 규칙
            </button>
            <button
              onClick={() => setActiveTab("preferences")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "preferences"
                  ? "text-blue-600 border-blue-600"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              고급 설정
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "patterns" && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-900 font-medium">근무 패턴 선택</p>
                <p className="text-sm text-blue-700 mt-1">
                  팀의 근무 형태에 맞는 패턴을 선택하세요. 선택한 패턴에 따라 자동으로 스케줄이 생성됩니다.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {config.patterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className="bg-white rounded-xl border-2 border-gray-200 hover:border-blue-300 transition-colors cursor-pointer p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <Calendar className="w-8 h-8 text-gray-400" />
                    <input
                      type="radio"
                      name="pattern"
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      defaultChecked={pattern.id === "5-day"}
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{pattern.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{pattern.description}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">근무: {pattern.daysOn}일</span>
                    <span className="text-gray-500">휴무: {pattern.daysOff}일</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "rules" && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-900 font-medium">근무 규칙 설정</p>
                <p className="text-sm text-amber-700 mt-1">
                  법적 요구사항과 팀의 정책에 맞게 근무 규칙을 설정하세요. 이 규칙들은 스케줄 생성 시 자동으로 적용됩니다.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
              {config.rules.map((rule) => (
                <div key={rule.id} className="p-6 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-gray-400" />
                      <h4 className="font-medium text-gray-900">{rule.name}</h4>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        rule.type === "limit" ? "bg-red-50 text-red-700" :
                        rule.type === "minimum" ? "bg-blue-50 text-blue-700" :
                        "bg-green-50 text-green-700"
                      }`}>
                        {rule.type === "limit" ? "제한" : rule.type === "minimum" ? "최소" : "균형"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4">
                      <input
                        type="number"
                        value={rule.value}
                        onChange={(e) => handleRuleValueChange(rule.id, parseInt(e.target.value))}
                        className="w-20 px-3 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!rule.enabled}
                      />
                      <span className="text-sm text-gray-600">
                        {rule.id === "max-consecutive" ? "일" :
                         rule.id === "min-rest" ? "시간" :
                         rule.id === "night-limit" ? "회" : ""}
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleRuleToggle(rule.id)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "preferences" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">자동 최적화</h3>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">자동 균형 조정</p>
                    <p className="text-sm text-gray-500 mt-1">모든 직원의 근무 시간을 공평하게 분배합니다</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.preferences.autoBalance}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        preferences: { ...prev.preferences, autoBalance: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">주말 순환 근무</p>
                    <p className="text-sm text-gray-500 mt-1">주말 근무를 모든 직원이 순환하도록 설정합니다</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.preferences.weekendRotation}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        preferences: { ...prev.preferences, weekendRotation: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">공정성 가중치</p>
                    <span className="text-sm font-medium text-blue-600">{config.preferences.fairnessWeight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.preferences.fairnessWeight}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      preferences: { ...prev.preferences, fairnessWeight: parseInt(e.target.value) }
                    }))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>효율성 우선</span>
                    <span>공정성 우선</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">스케줄 생성 옵션</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    최대 연속 근무일
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={config.preferences.maxConsecutiveShifts}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        preferences: { ...prev.preferences, maxConsecutiveShifts: parseInt(e.target.value) }
                      }))}
                      className="w-24 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">일</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    최소 휴식 시간
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={config.preferences.minRestHours}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        preferences: { ...prev.preferences, minRestHours: parseInt(e.target.value) }
                      }))}
                      className="w-24 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">시간</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex justify-between">
          <button
            onClick={() => router.push("/team")}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            이전 단계
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Save className="w-4 h-4" />
            저장하고 스케줄 생성
          </button>
        </div>
      </main>
    </div>
  );
}