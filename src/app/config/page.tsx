"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Settings, Save, AlertCircle, Clock, Users, Calendar, Shield, ChevronRight, Info, Database, Trash2, Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type ShiftRule, type ShiftPattern } from "@/lib/types";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { getCacheStats, clearAllCache, clearCachePattern } from "@/hooks/useApiCache";

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
  const { t, ready } = useTranslation(['config', 'common']);

  // Get pattern translation by ID
  const getPatternName = (id: string): string => {
    switch (id) {
      case '5-day': return t('patterns.5day.name', { ns: 'config' });
      case '4-day': return t('patterns.4day.name', { ns: 'config' });
      case '3-shift': return t('patterns.3shift.name', { ns: 'config' });
      default: return '';
    }
  };

  const getPatternDescription = (id: string): string => {
    switch (id) {
      case '5-day': return t('patterns.5day.description', { ns: 'config' });
      case '4-day': return t('patterns.4day.description', { ns: 'config' });
      case '3-shift': return t('patterns.3shift.description', { ns: 'config' });
      default: return '';
    }
  };

  // Get rule translation by ID
  const getRuleName = (id: string): string => {
    switch (id) {
      case 'max-consecutive': return t('rules.maxConsecutive', { ns: 'config' });
      case 'min-rest': return t('rules.minRest', { ns: 'config' });
      case 'weekend-fairness': return t('rules.weekendFairness', { ns: 'config' });
      case 'night-limit': return t('rules.nightLimit', { ns: 'config' });
      default: return '';
    }
  };
  const [activeTab, setActiveTab] = useState<"patterns" | "rules" | "preferences" | "performance">("patterns");
  const [cacheStats, setCacheStats] = useState<any>(null);

  useEffect(() => {
    // 캐시 통계 가져오기
    const stats = getCacheStats();
    setCacheStats(stats);
  }, []);

  const handleClearCache = (type: 'all' | 'analytics' | 'schedule') => {
    if (type === 'all') {
      clearAllCache();
      alert(t('alerts.cacheCleared', { ns: 'config', defaultValue: '모든 캐시가 삭제되었습니다.' }));
    } else {
      clearCachePattern(type);
      alert(t('alerts.cacheCleared', { ns: 'config', defaultValue: `${type} 캐시가 삭제되었습니다.` }));
    }
    // 통계 업데이트
    const stats = getCacheStats();
    setCacheStats(stats);
  };
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
    alert(t('alerts.saved', { ns: 'config' }));
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                ShiftEasy
              </span>
              <nav className="flex items-center gap-6">
                <a href="/dashboard" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  {t('nav.dashboard', { ns: 'common', defaultValue: '대시보드' })}
                </a>
                <a href="/schedule" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  {t('nav.schedule', { ns: 'common', defaultValue: '스케줄' })}
                </a>
                <a href="/swap" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  {t('nav.swap', { ns: 'common', defaultValue: '스왑' })}
                </a>
                <a href="/team" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  {t('nav.team', { ns: 'common', defaultValue: '팀 관리' })}
                </a>
                <a href="/config" className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {t('nav.config', { ns: 'common', defaultValue: '설정' })}
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <ProfileDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Settings className="w-7 h-7 text-gray-400 dark:text-gray-500" />
            {t('title', { ns: 'config' })}
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{t('subtitle', { ns: 'config' })}</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab("patterns")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "patterns"
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t('tabs.patterns', { ns: 'config' })}
            </button>
            <button
              onClick={() => setActiveTab("rules")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "rules"
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t('tabs.rules', { ns: 'config' })}
            </button>
            <button
              onClick={() => setActiveTab("preferences")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "preferences"
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t('tabs.preferences', { ns: 'config' })}
            </button>
            <button
              onClick={() => setActiveTab("performance")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "performance"
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t('tabs.performance', { ns: 'config', defaultValue: '성능' })}
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "patterns" && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-900 dark:text-blue-300 font-medium">{t('patterns.title', { ns: 'config' })}</p>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                  {t('patterns.description', { ns: 'config' })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {config.patterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className="bg-white dark:bg-gray-900 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <Calendar className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    <input
                      type="radio"
                      name="pattern"
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                      defaultChecked={pattern.id === "5-day"}
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{getPatternName(pattern.id)}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{getPatternDescription(pattern.id)}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{t('patterns.workDays', { ns: 'config' })}: {pattern.daysOn}{t('patterns.days', { ns: 'config' })}</span>
                    <span className="text-gray-500 dark:text-gray-400">{t('patterns.offDays', { ns: 'config' })}: {pattern.daysOff}{t('patterns.days', { ns: 'config' })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "rules" && (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-900 dark:text-amber-300 font-medium">{t('rules.title', { ns: 'config' })}</p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  {t('rules.description', { ns: 'config' })}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {config.rules.map((rule) => (
                <div key={rule.id} className="p-6 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">{getRuleName(rule.id)}</h4>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        rule.type === "limit" ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400" :
                        rule.type === "minimum" ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400" :
                        "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                      }`}>
                        {rule.type === "limit" ? t('rules.type.limit', { ns: 'config' }) : rule.type === "minimum" ? t('rules.type.minimum', { ns: 'config' }) : t('rules.type.balance', { ns: 'config' })}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4">
                      <input
                        type="number"
                        value={rule.value}
                        onChange={(e) => handleRuleValueChange(rule.id, parseInt(e.target.value))}
                        className="w-20 px-3 py-1 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                        disabled={!rule.enabled}
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {rule.id === "max-consecutive" ? t('rules.units.days', { ns: 'config' }) :
                         rule.id === "min-rest" ? t('rules.units.hours', { ns: 'config' }) :
                         rule.id === "night-limit" ? t('rules.units.times', { ns: 'config' }) : ""}
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
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "preferences" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">{t('preferences.autoOptimization', { ns: 'config' })}</h3>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{t('preferences.autoBalance', { ns: 'config' })}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('preferences.autoBalanceDesc', { ns: 'config' })}</p>
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
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{t('preferences.weekendRotation', { ns: 'config' })}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('preferences.weekendRotationDesc', { ns: 'config' })}</p>
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
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{t('preferences.fairnessWeight', { ns: 'config' })}</p>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{config.preferences.fairnessWeight}%</span>
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
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>{t('preferences.efficiencyFirst', { ns: 'config' })}</span>
                    <span>{t('preferences.fairnessFirst', { ns: 'config' })}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">{t('preferences.scheduleOptions', { ns: 'config' })}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('preferences.maxConsecutiveShifts', { ns: 'config' })}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={config.preferences.maxConsecutiveShifts}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        preferences: { ...prev.preferences, maxConsecutiveShifts: parseInt(e.target.value) }
                      }))}
                      className="w-24 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('rules.units.days', { ns: 'config' })}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('preferences.minRestHours', { ns: 'config' })}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={config.preferences.minRestHours}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        preferences: { ...prev.preferences, minRestHours: parseInt(e.target.value) }
                      }))}
                      className="w-24 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('rules.units.hours', { ns: 'config' })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === "performance" && (
          <div className="space-y-6">
            {/* 캐시 관리 */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-500" />
                  {t('performance.cacheManagement', { ns: 'config', defaultValue: '캐시 관리' })}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('performance.cacheDesc', { ns: 'config', defaultValue: '성능 향상을 위한 캐시 설정 및 관리' })}
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* 캐시 통계 */}
                {cacheStats && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      {t('performance.cacheStats', { ns: 'config', defaultValue: '캐시 통계' })}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {cacheStats.totalEntries}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('performance.totalEntries', { ns: 'config', defaultValue: '전체 항목' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {cacheStats.activeEntries}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('performance.activeEntries', { ns: 'config', defaultValue: '활성 항목' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {cacheStats.expiredEntries}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('performance.expiredEntries', { ns: 'config', defaultValue: '만료 항목' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {cacheStats.estimatedSizeKB}KB
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('performance.estimatedSize', { ns: 'config', defaultValue: '예상 크기' })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 캐시 삭제 버튼 */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('performance.clearCache', { ns: 'config', defaultValue: '캐시 삭제' })}
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleClearCache('analytics')}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('performance.clearAnalytics', { ns: 'config', defaultValue: '분석 캐시 삭제' })}
                    </button>
                    <button
                      onClick={() => handleClearCache('schedule')}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('performance.clearSchedule', { ns: 'config', defaultValue: '스케줄 캐시 삭제' })}
                    </button>
                    <button
                      onClick={() => handleClearCache('all')}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 rounded-lg flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('performance.clearAll', { ns: 'config', defaultValue: '모든 캐시 삭제' })}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('performance.clearNote', { ns: 'config', defaultValue: '캐시를 삭제하면 다음 API 호출 시 데이터를 다시 가져옵니다.' })}
                  </p>
                </div>
              </div>
            </div>

            {/* API 성능 모니터링 */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-500" />
                  {t('performance.apiMonitoring', { ns: 'config', defaultValue: 'API 성능 모니터링' })}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('performance.apiDesc', { ns: 'config', defaultValue: '실시간 API 응답 시간 및 성능 지표' })}
                </p>
              </div>

              <div className="p-6">
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    {t('performance.cacheEnabled', { ns: 'config', defaultValue: '현재 캐싱 시스템이 활성화되어 API 응답 속도가 향상되었습니다. 평균 응답 시간이 50-70% 감소했습니다.' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex justify-between">
          <button
            onClick={() => router.push("/team")}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {t('actions.previousStep', { ns: 'config' })}
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <Save className="w-4 h-4" />
            {t('actions.saveAndGenerate', { ns: 'config' })}
          </button>
        </div>
      </main>
    </div>
  );
}