"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Settings, Save, Trash2, Activity, Plus, Edit2, Briefcase, Loader2, FolderOpen, Download, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MainLayout } from "../../components/layout/MainLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ShiftTypesTab } from "./ShiftTypesTab";
import { HandoffTemplatesTab } from "./HandoffTemplatesTab";
import { api as trpc } from "@/lib/trpc/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { SavedConfigPresetsModal } from "@/components/config/SavedConfigPresetsModal";
import { SavedPatternPresetsModal } from "@/components/config/SavedPatternPresetsModal";
import {
  DEFAULT_SCHEDULER_ADVANCED,
  SchedulerAdvancedSettings,
  ConstraintWeightsConfig,
  CspSettingsConfig,
  CspAnnealingConfig,
  mergeSchedulerAdvancedSettings,
  MilpSolverType,
  MilpMultiRunConfig,
} from "@/lib/config/schedulerAdvanced";

interface ConfigPreferences {
  nightIntensivePaidLeaveDays: number;
  schedulerAdvanced: SchedulerAdvancedSettings;
}

interface ConfigData {
  preferences: ConfigPreferences;
}

type ShiftConfig = {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  allowOvertime: boolean;
};

const normalizeShiftTypes = (list: ShiftConfig[]): ShiftConfig[] => {
  const deduped = new Map<string, ShiftConfig>();

  list.forEach((shift) => {
    const normalizedCode = (shift.code ?? '').trim().toUpperCase();
    if (!normalizedCode) {
      return;
    }

    deduped.set(normalizedCode, {
      ...shift,
      code: normalizedCode,
      name: (shift.name ?? '').trim() || normalizedCode,
      startTime: shift.startTime || '00:00',
      endTime: shift.endTime || '00:00',
      color: shift.color || 'blue',
      allowOvertime: Boolean(shift.allowOvertime),
    });
  });

  return Array.from(deduped.values());
};

const mergePreferencesConfig = (value?: Partial<ConfigPreferences>): ConfigPreferences => ({
  nightIntensivePaidLeaveDays: value?.nightIntensivePaidLeaveDays ?? 0,
  schedulerAdvanced: mergeSchedulerAdvancedSettings(value?.schedulerAdvanced),
});

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  helpText?: string;
  warning?: string;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
}

const SliderField = ({
  label,
  value,
  min,
  max,
  step,
  suffix = '',
  helpText,
  warning,
  formatValue,
  onChange,
}: SliderFieldProps) => {
  const displayValue = formatValue ? formatValue(value) : value.toFixed(step < 1 ? 1 : 0);
  const ratio = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;

  return (
    <label className="flex flex-col text-sm text-gray-700 dark:text-gray-300">
      <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
        <span>{label}</span>
        <span className="text-gray-900 dark:text-gray-100 font-semibold">
          {displayValue}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 accent-blue-600 dark:accent-blue-400"
      />
      <div className="mt-2 h-1 rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-300"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {helpText && <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helpText}</span>}
      {warning && <span className="mt-1 text-xs text-red-500 dark:text-red-400">{warning}</span>}
    </label>
  );
};

const CONSTRAINT_WEIGHT_FIELDS: Array<{ key: keyof ConstraintWeightsConfig; label: string; accent: string }> = [
  { key: 'staffing', label: '필수 인원', accent: 'bg-blue-500 dark:bg-blue-400' },
  { key: 'teamBalance', label: '팀 커버리지', accent: 'bg-emerald-500 dark:bg-emerald-400' },
  { key: 'careerBalance', label: '경력 그룹', accent: 'bg-indigo-500 dark:bg-indigo-400' },
  { key: 'offBalance', label: '휴무 편차', accent: 'bg-amber-500 dark:bg-amber-400' },
];

function ConfigPageContent() {
  const searchParams = useSearchParams();
  const { t } = useTranslation(['config', 'common']);
  const currentUser = useCurrentUser();
  const managedDepartmentId = currentUser.dbUser?.departmentId ?? null;

  // tRPC queries for fetching configs
  const { data: allConfigs } = trpc.configs.getAll.useQuery();
  const utils = trpc.useUtils();
  const setConfigMutation = trpc.configs.set.useMutation();

  // URL 파라미터에서 tab 읽기
  const tabFromUrl = searchParams.get('tab') as "preferences" | "positions" | "shifts" | "careers" | "handoffTemplates" | "secretCode" | null;
  const [activeTab, setActiveTab] = useState<"preferences" | "positions" | "shifts" | "careers" | "handoffTemplates" | "secretCode">(tabFromUrl || "preferences");
  const [positions, setPositions] = useState<{value: string; label: string; level: number}[]>([]);
  const [newPosition, setNewPosition] = useState({ value: '', label: '', level: 1 });
  const [editingPosition, setEditingPosition] = useState<string | null>(null);

  // Shift types state
  const [shiftTypes, setShiftTypes] = useState<{
    code: string;
    name: string;
    startTime: string;
    endTime: string;
    color: string;
    allowOvertime: boolean;
  }[]>([]);
  const [newShiftType, setNewShiftType] = useState({
    code: '',
    name: '',
    startTime: '09:00',
    endTime: '17:00',
    color: '#3b82f6', // default blue hex color
    allowOvertime: false
  });
  const [editingShiftType, setEditingShiftType] = useState<string | null>(null);

  // Career groups state
  const [careerGroups, setCareerGroups] = useState<{
    code: string;
    name: string;
    minYears: number;
    maxYears: number;
    description: string;
  }[]>([]);
  const [newCareerGroup, setNewCareerGroup] = useState({
    code: '',
    name: '',
    minYears: 0,
    maxYears: 0,
    description: '',
  });
  const [showMobileTabMenu, setShowMobileTabMenu] = useState(false);

  const tabLabelMap: Record<typeof activeTab, string> = {
    preferences: t('tabs.preferences', { ns: 'config' }),
    positions: t('tabs.positions', { ns: 'config', defaultValue: '직책 관리' }),
    shifts: t('tabs.shifts', { ns: 'config', defaultValue: '근무 타입' }),
    careers: t('tabs.careers', { ns: 'config', defaultValue: '경력 그룹' }),
    handoffTemplates: '인수인계 템플릿',
    secretCode: '시크릿 코드',
  };
  const configTabOptions: Array<{ value: typeof activeTab; label: string }> = [
    { value: 'preferences', label: tabLabelMap.preferences },
    { value: 'positions', label: tabLabelMap.positions },
    { value: 'shifts', label: tabLabelMap.shifts },
    { value: 'careers', label: tabLabelMap.careers },
    { value: 'handoffTemplates', label: tabLabelMap.handoffTemplates },
  ];

  // URL 파라미터 변경 시 activeTab 업데이트
  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    if (!allConfigs) return; // Wait for API data

    // Default values
    const defaultPositions = [
      { value: 'HN', label: '수석간호사', level: 9 },
      { value: 'SN', label: '전문간호사', level: 7 },
      { value: 'CN', label: '책임간호사', level: 5 },
      { value: 'RN', label: '정규간호사', level: 3 },
      { value: 'NA', label: '간호조무사', level: 1 },
    ];

    const defaultShiftTypes: ShiftConfig[] = [
      { code: 'D', name: '주간 근무', startTime: '07:00', endTime: '15:00', color: 'blue', allowOvertime: false },
      { code: 'E', name: '저녁 근무', startTime: '15:00', endTime: '23:00', color: 'amber', allowOvertime: false },
      { code: 'N', name: '야간 근무', startTime: '23:00', endTime: '07:00', color: 'indigo', allowOvertime: true },
      { code: 'A', name: '행정 근무', startTime: '09:00', endTime: '18:00', color: 'green', allowOvertime: false },
      { code: 'O', name: '휴무', startTime: '00:00', endTime: '00:00', color: 'gray', allowOvertime: false },
      { code: 'V', name: '휴가', startTime: '00:00', endTime: '00:00', color: 'purple', allowOvertime: false },
    ];

    // Load from API or use defaults
    setPositions(allConfigs.positions || defaultPositions);

    // Merge saved shift types with defaults (add missing defaults)
    if (allConfigs.shift_types) {
      const savedShiftTypes = normalizeShiftTypes(allConfigs.shift_types as ShiftConfig[]);
      const savedCodes = new Set(savedShiftTypes.map((st) => st.code));
      const missingDefaults = defaultShiftTypes.filter(dst => !savedCodes.has(dst.code));
      setShiftTypes([...savedShiftTypes, ...missingDefaults]);
    } else {
      setShiftTypes(defaultShiftTypes);
    }

    // Load career groups
    if (allConfigs.career_groups) {
      setCareerGroups(allConfigs.career_groups);
    }

    // Load preferences
    if (allConfigs.preferences) {
      setConfig({ preferences: mergePreferencesConfig(allConfigs.preferences) });
    } else {
      setConfig({ preferences: mergePreferencesConfig() });
    }
  }, [allConfigs]);

  const [config, setConfig] = useState<ConfigData>({
    preferences: {
      nightIntensivePaidLeaveDays: 2,
      schedulerAdvanced: DEFAULT_SCHEDULER_ADVANCED,
    },
  });
  const [isSavingShiftTypes, setIsSavingShiftTypes] = useState(false);
  const [isSavingNightPreference, setIsSavingNightPreference] = useState(false);
  const [isSavingPositions, setIsSavingPositions] = useState(false);
  const [isSavingCareerGroups, setIsSavingCareerGroups] = useState(false);

  // Preset modal state
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [showPatternsModal, setShowPatternsModal] = useState(false);
  const schedulerAdvanced = config.preferences.schedulerAdvanced;

  const updateSchedulerAdvanced = (updater: (current: SchedulerAdvancedSettings) => SchedulerAdvancedSettings) => {
    setConfig((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        schedulerAdvanced: updater(prev.preferences.schedulerAdvanced),
      },
    }));
  };

  const handleSolverPreferenceChange = (value: MilpSolverType) => {
    updateSchedulerAdvanced((current) => ({
      ...current,
      solverPreference: value,
    }));
  };

  const handleConstraintWeightChange = (key: keyof ConstraintWeightsConfig, value: number) => {
    updateSchedulerAdvanced((current) => ({
      ...current,
      constraintWeights: {
        ...current.constraintWeights,
        [key]: Number.isFinite(value) ? value : current.constraintWeights[key],
      },
    }));
  };

  const handleCspSettingChange = (key: keyof Omit<CspSettingsConfig, 'annealing'>, value: number) => {
    updateSchedulerAdvanced((current) => ({
      ...current,
      cspSettings: {
        ...current.cspSettings,
        [key]: Number.isFinite(value) ? value : current.cspSettings[key],
      },
    }));
  };

  const handleAnnealingChange = (key: keyof CspAnnealingConfig, value: number) => {
    updateSchedulerAdvanced((current) => ({
      ...current,
      cspSettings: {
        ...current.cspSettings,
        annealing: {
          ...current.cspSettings.annealing,
          [key]: Number.isFinite(value) ? value : current.cspSettings.annealing[key],
        },
      },
    }));
  };

  const handleMultiRunChange = <K extends keyof MilpMultiRunConfig>(key: K, value: MilpMultiRunConfig[K]) => {
    updateSchedulerAdvanced((current) => ({
      ...current,
      multiRun: {
        ...current.multiRun,
        [key]:
          typeof value === 'number'
            ? (Number.isFinite(value) ? value : current.multiRun[key])
            : value,
      },
    }));
  };

  // Preset save mutation
  const savePresetMutation = trpc.configs.savePreset.useMutation({
    onSuccess: () => {
      alert('설정 프리셋이 저장되었습니다!');
    },
    onError: (error) => {
      alert(`프리셋 저장 실패: ${error.message}`);
    },
  });

  const persistShiftTypes = async (updatedList: ShiftConfig[]) => {
    const previous = shiftTypes;
    const normalizedList = normalizeShiftTypes(updatedList);
    const targetDepartmentId = managedDepartmentId ?? undefined;
    setShiftTypes(normalizedList);
    setIsSavingShiftTypes(true);
    try {
      await setConfigMutation.mutateAsync({
        configKey: 'shift_types',
        configValue: normalizedList,
        departmentId: targetDepartmentId,
      });

      const getAllInvalidateInput = targetDepartmentId
        ? { departmentId: targetDepartmentId }
        : undefined;

      await Promise.all([
        utils.configs.getByKey.invalidate({ configKey: 'shift_types', departmentId: targetDepartmentId }),
        utils.configs.getAll.invalidate(getAllInvalidateInput),
      ]);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('customShiftTypes', JSON.stringify(normalizedList));
      }
    } catch (error) {
      console.error('Failed to save shift types:', error);
      alert('근무 타입 저장 중 오류가 발생했습니다.');
      setShiftTypes(previous);
      throw error;
    } finally {
      setIsSavingShiftTypes(false);
    }
  };

  const handleNightPreferenceSave = async () => {
    setIsSavingNightPreference(true);
    try {
      await setConfigMutation.mutateAsync({
        configKey: 'preferences',
        configValue: config.preferences,
        departmentId: managedDepartmentId ?? undefined,
      });
      await Promise.all([
        utils.configs.getAll.invalidate(),
        utils.configs.getByKey.invalidate({
          configKey: 'preferences',
          departmentId: managedDepartmentId ?? undefined,
        }),
      ]);
      alert('고급 설정이 저장되었습니다.');
    } catch (error) {
      console.error('Failed to save preference config:', error);
      alert('고급 설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingNightPreference(false);
    }
  };

  const persistPositions = async (updated: typeof positions) => {
    const previous = positions;
    setPositions(updated);
    setIsSavingPositions(true);
    try {
      await setConfigMutation.mutateAsync({ configKey: 'positions', configValue: updated });
      await utils.configs.getAll.invalidate();
    } catch (error) {
      console.error('Failed to save positions:', error);
      alert('직책 저장 중 오류가 발생했습니다.');
      setPositions(previous);
      throw error;
    } finally {
      setIsSavingPositions(false);
    }
  };

  const persistCareerGroups = async (updated: typeof careerGroups) => {
    const previous = careerGroups;
    setCareerGroups(updated);
    setIsSavingCareerGroups(true);
    try {
      await setConfigMutation.mutateAsync({ configKey: 'career_groups', configValue: updated });
      await utils.configs.getAll.invalidate();
    } catch (error) {
      console.error('Failed to save career groups:', error);
      alert('경력 그룹 저장 중 오류가 발생했습니다.');
      setCareerGroups(previous);
      throw error;
    } finally {
      setIsSavingCareerGroups(false);
    }
  };

  // Save current config as preset
  const handleSavePreset = async () => {
    const presetName = prompt('프리셋 이름을 입력하세요:');
    if (!presetName) return;

    const currentConfig = {
      positions,
      shift_types: shiftTypes,
      career_groups: careerGroups,
      preferences: config.preferences,
    };

    try {
      await savePresetMutation.mutateAsync({
        name: presetName,
        data: currentConfig,
      });
    } catch (error) {
      console.error('Failed to save preset:', error);
    }
  };

  // Load preset and apply to current state
  const handleLoadPreset = async (presetData: {
    positions?: unknown[];
    shift_types?: unknown[];
    career_groups?: unknown[];
    preferences?: unknown;
  }) => {
    try {
      // Apply loaded data to state
      if (presetData.positions) {
        setPositions(presetData.positions as typeof positions);
        await setConfigMutation.mutateAsync({ configKey: 'positions', configValue: presetData.positions });
      }
      if (presetData.shift_types) {
        setShiftTypes(presetData.shift_types as typeof shiftTypes);
        await setConfigMutation.mutateAsync({ configKey: 'shift_types', configValue: presetData.shift_types });
      }
      if (presetData.career_groups) {
        setCareerGroups(presetData.career_groups as typeof careerGroups);
        await setConfigMutation.mutateAsync({ configKey: 'career_groups', configValue: presetData.career_groups });
      }
      if (presetData.preferences) {
        setConfig({ preferences: presetData.preferences as ConfigData['preferences'] });
        await setConfigMutation.mutateAsync({ configKey: 'preferences', configValue: presetData.preferences });
      }

      await utils.configs.getAll.invalidate();
      alert('프리셋을 불러왔습니다!');
    } catch (error) {
      console.error('Failed to load preset:', error);
      alert('프리셋 불러오기 중 오류가 발생했습니다.');
    }
  };

  return (
    <RoleGuard>
      <MainLayout>
        {/* Page Title */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                <Settings className="w-7 h-7 text-gray-400 dark:text-gray-500" />
                {t('title', { ns: 'config' })}
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">{t('subtitle', { ns: 'config' })}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSavePreset}
                disabled={savePresetMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
              >
                {savePresetMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    현재 설정 저장
                  </>
                )}
              </button>
              <button
                onClick={() => setShowPresetsModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                설정 프리셋
              </button>
              <button
                onClick={() => setShowPatternsModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                부서 패턴
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="mb-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
            3교대(주간/저녁/야간) 패턴을 기준으로 스케줄이 생성되며, 근무 패턴은 변경할 수 없습니다.
          </div>

          {/* Mobile Dropdown */}
          <div className="md:hidden mb-4 relative">
            <button
              type="button"
              onClick={() => setShowMobileTabMenu((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <span>{tabLabelMap[activeTab]}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showMobileTabMenu ? 'rotate-180' : ''}`} />
            </button>

            {showMobileTabMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowMobileTabMenu(false)}
                />
                <div className="absolute z-30 w-full mt-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                  {configTabOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setActiveTab(option.value as typeof activeTab);
                        setShowMobileTabMenu(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm ${
                        activeTab === option.value
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                          : 'text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Desktop Tabs */}
          <nav className="hidden md:flex gap-8">
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
              onClick={() => setActiveTab("positions")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "positions"
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t('tabs.positions', { ns: 'config', defaultValue: '직책 관리' })}
            </button>
            <button
              onClick={() => setActiveTab("shifts")}
              className={`pb-3 px-1 text-sm border-b-2 transition-colors ${
                activeTab === "shifts"
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t('tabs.shifts', { ns: 'config', defaultValue: '근무 타입' })}
            </button>
            <button
              onClick={() => setActiveTab("careers")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "careers"
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t('tabs.careers', { ns: 'config', defaultValue: '경력 그룹' })}
            </button>
            <button
              onClick={() => setActiveTab("handoffTemplates")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "handoffTemplates"
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              인수인계 템플릿
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "preferences" && (
          <div className="space-y-6">
            {/* 나이트 집중 근무 유급 휴가 설정 */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">나이트 집중 근무 유급 휴가</h3>

              <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-indigo-900 dark:text-indigo-300">
                    <p className="font-medium mb-1">나이트 집중 근무 보상 제도</p>
                    <p className="text-indigo-700 dark:text-indigo-400">
                      야간 근무 집중 시기 후 보상성 유급 휴가를 부여합니다. 주로 2일 연속 사용되며, 스케줄 생성 시 자동으로 고려됩니다.
                    </p>
                    <p className="text-indigo-600 dark:text-indigo-500 mt-2 font-medium">
                      💡 0으로 설정하면 유급 휴가가 부여되지 않습니다.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  월별 유급 휴가 일수
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={config.preferences.nightIntensivePaidLeaveDays}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      preferences: { ...prev.preferences, nightIntensivePaidLeaveDays: parseInt(e.target.value) || 0 }
                    }))}
                    className="w-24 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">일/월</span>
                  {config.preferences.nightIntensivePaidLeaveDays > 0 && (
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                      ✓ 활성화됨 (주로 2일 연속 사용)
                    </span>
                  )}
                  {config.preferences.nightIntensivePaidLeaveDays === 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      비활성화됨
                    </span>
                  )}
                  <button
                    onClick={handleNightPreferenceSave}
                    disabled={isSavingNightPreference}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {isSavingNightPreference ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        저장 중...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        저장
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Advanced Scheduler Settings */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6 space-y-6">
              <div className="flex items-start gap-3">
                <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    고급 스케줄 제약 (MILP / CSP)
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    아래 슬라이더는 “어떤 규칙을 얼마나 우선시할지”를 정하는 곳입니다. 숫자가 높을수록 해당 규칙을 더 강하게 지키려 하고, 낮추면 다른 규칙에 양보합니다.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-4 py-3 rounded-lg border border-gray-100 dark:border-gray-700">
                <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">기본 MILP/CSP 스케줄 엔진 사용</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  ON으로 두면 스케줄 생성 버튼을 눌렀을 때 언제나 MILP/CSP 엔진이 먼저 실행됩니다. OFF면 기존 AI 방식이 기본이지만, 생성 시에는 여전히 직접 선택할 수 있습니다.
                </p>
                </div>
                <label className="inline-flex items-center cursor-pointer gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">OFF</span>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={schedulerAdvanced.useMilpEngine}
                    onChange={(e) => updateSchedulerAdvanced((current) => ({ ...current, useMilpEngine: e.target.checked }))}
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
                  <span className="text-sm text-gray-900 dark:text-gray-100">ON</span>
                </label>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 rounded-lg border border-gray-100 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">선호 Solver</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  “자동”은 OR-Tools로 시도했다가 실패하면 HiGHS로 넘어갑니다. 패턴/시퀀스 제약이 많으면 CP-SAT을 직접 선택해 더 빠른 탐색을 시도할 수 있습니다.
                </p>
                <select
                  value={schedulerAdvanced.solverPreference}
                  onChange={(e) => handleSolverPreferenceChange(e.target.value as MilpSolverType)}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="auto">자동 (OR-Tools 우선, 실패 시 HiGHS)</option>
                  <option value="cpsat">CP-SAT (패턴/시퀀스 제약에 강함)</option>
                  <option value="ortools">OR-Tools만 사용</option>
                  <option value="highs">항상 HiGHS 사용</option>
                </select>
              </div>

              <div>
                <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">제약 가중치</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                  “이 항목이 얼마나 중요한가?”를 설정하는 슬라이더입니다. 기본값은 1이며, 높일수록 해당 제약을 더 우선합니다.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {CONSTRAINT_WEIGHT_FIELDS.map(({ key, label }) => (
                    <SliderField
                      key={key}
                      label={label}
                      min={0}
                      max={5}
                      step={0.1}
                      value={schedulerAdvanced.constraintWeights[key]}
                      formatValue={(val) => val.toFixed(1)}
                      warning={
                        schedulerAdvanced.constraintWeights[key] < 0.5
                          ? '너무 낮으면 제약이 무시될 수 있습니다.'
                          : undefined
                      }
                      onChange={(val) => handleConstraintWeightChange(key, val)}
                    />
                  ))}
                </div>
                {(() => {
                  const totalWeight = CONSTRAINT_WEIGHT_FIELDS.reduce(
                    (sum, field) => sum + (schedulerAdvanced.constraintWeights[field.key] ?? 0),
                    0
                  );
                  if (totalWeight <= 0) {
                    return null;
                  }
                  return (
                    <div className="mt-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">현재 비중</p>
                      <div className="flex h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        {CONSTRAINT_WEIGHT_FIELDS.map(({ key, accent }) => {
                          const ratio = (schedulerAdvanced.constraintWeights[key] ?? 0) / totalWeight;
                          if (!ratio) {
                            return null;
                          }
                          return (
                            <div
                              key={key}
                              className={`${accent} transition-all duration-300`}
                              style={{ width: `${Math.max(ratio * 100, 1)}%` }}
                            />
                          );
                        })}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-600 dark:text-gray-400">
                        {CONSTRAINT_WEIGHT_FIELDS.map(({ key, label, accent }) => {
                          const ratio = (schedulerAdvanced.constraintWeights[key] ?? 0) / totalWeight;
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <span className={`inline-block h-2 w-2 rounded-full ${accent}`} />
                              <span className="font-medium text-gray-700 dark:text-gray-200">{label}</span>
                              <span>{(ratio * 100).toFixed(0)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">CSP 탐색 파라미터</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                  MILP가 만든 초안을 얼마나 오래, 얼마나 과감하게 다시 섞어볼지를 정합니다. 대부분의 경우 기본값이면 충분합니다.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SliderField
                    label="최대 반복 횟수"
                    min={50}
                    max={2000}
                    step={50}
                    value={schedulerAdvanced.cspSettings.maxIterations}
                    suffix="회"
                    warning={
                      schedulerAdvanced.cspSettings.maxIterations > 1500
                        ? '반복 횟수가 많으면 시간이 오래 걸릴 수 있습니다.'
                        : undefined
                    }
                    onChange={(val) => handleCspSettingChange('maxIterations', val)}
                  />
                  <SliderField
                    label="탐색 시간 제한"
                    min={500}
                    max={20000}
                    step={500}
                    value={schedulerAdvanced.cspSettings.timeLimitMs}
                    suffix="ms"
                    warning={
                      schedulerAdvanced.cspSettings.timeLimitMs > 10000
                        ? '시간 제한이 길면 스케줄 생성이 지연될 수 있습니다.'
                        : undefined
                    }
                    onChange={(val) => handleCspSettingChange('timeLimitMs', val)}
                  />
                  <SliderField
                    label="Tabu 크기"
                    min={0}
                    max={256}
                    step={1}
                    value={schedulerAdvanced.cspSettings.tabuSize}
                    suffix="건"
                    onChange={(val) => handleCspSettingChange('tabuSize', val)}
                  />
                  <SliderField
                    label="동일 시프트 허용"
                    min={1}
                    max={5}
                    step={1}
                    value={schedulerAdvanced.cspSettings.maxSameShift}
                    suffix="회"
                    onChange={(val) => handleCspSettingChange('maxSameShift', val)}
                  />
                  <SliderField
                    label="휴무 편차 허용"
                    min={0}
                    max={5}
                    step={1}
                    value={schedulerAdvanced.cspSettings.offTolerance}
                    suffix="일"
                    onChange={(val) => handleCspSettingChange('offTolerance', val)}
                  />
                  <SliderField
                    label="어닐링 온도"
                    min={0}
                    max={20}
                    step={0.5}
                    value={schedulerAdvanced.cspSettings.annealing.temperature}
                    onChange={(val) => handleAnnealingChange('temperature', val)}
                  />
                  <SliderField
                    label="냉각률"
                    min={0.5}
                    max={0.99}
                    step={0.01}
                    value={schedulerAdvanced.cspSettings.annealing.coolingRate}
                    formatValue={(val) => val.toFixed(2)}
                    onChange={(val) => handleAnnealingChange('coolingRate', parseFloat(val.toFixed(2)))}
                  />
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-4 rounded-lg border border-gray-100 dark:border-gray-700">
                <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">다중 MILP 반복</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                  동일한 입력을 여러 번 계산해 보고 가장 좋은 해를 고릅니다. 편차를 주면 매번 조금씩 다른 가중치로 계산하여 더 다양한 조합을 탐색합니다.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SliderField
                    label="반복 횟수"
                    min={1}
                    max={10}
                    step={1}
                    value={schedulerAdvanced.multiRun.attempts}
                    suffix="회"
                    helpText="최대 10회까지 반복 실행합니다. 횟수가 많을수록 생성 시간이 길어집니다."
                    onChange={(val) => handleMultiRunChange('attempts', val)}
                  />
                  <SliderField
                    label="가중치 랜덤 편차"
                    min={0}
                    max={30}
                    step={1}
                    value={schedulerAdvanced.multiRun.weightJitterPct}
                    suffix="%"
                    helpText="각 반복마다 가중치를 ±편차% 범위에서 섞어 새로운 조합을 찾습니다."
                    onChange={(val) => handleMultiRunChange('weightJitterPct', val)}
                  />
                  <div className="flex flex-col text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">고정 시드 (선택)</span>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="number"
                        min="0"
                        max="1000000000"
                        value={schedulerAdvanced.multiRun.seed ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (!raw) {
                            handleMultiRunChange('seed', null);
                            return;
                          }
                          const parsed = parseInt(raw, 10);
                          if (Number.isFinite(parsed)) {
                            const clamped = Math.min(1000000000, Math.max(0, parsed));
                            handleMultiRunChange('seed', clamped);
                          }
                        }}
                        placeholder="자동"
                        className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                        onClick={() => handleMultiRunChange('seed', null)}
                      >
                        랜덤
                      </button>
                    </div>
                    <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      빈칸이면 실행 시마다 다른 랜덤 시드를 사용합니다.
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleNightPreferenceSave}
                  disabled={isSavingNightPreference}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSavingNightPreference ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      적용 중...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      고급 설정 저장
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Positions Tab */}
        {activeTab === "positions" && (
          <div className="space-y-6">
            <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4 flex items-start gap-3">
              <Briefcase className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-purple-900 dark:text-purple-300 font-medium">
                  {t('positions.title', { ns: 'config', defaultValue: '직책 설정' })}
                </p>
                <p className="text-sm text-purple-700 dark:text-purple-400 mt-1">
                  {t('positions.description', { ns: 'config', defaultValue: '병원 또는 팀에 맞는 직책을 추가하거나 수정할 수 있습니다.' })}
                </p>
                <p className="text-sm text-purple-600 dark:text-purple-500 mt-1 font-medium">
                  💡 레벨이 높을수록 상급자입니다. (1: 초급, 10: 최고급)
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
                {t('positions.list', { ns: 'config', defaultValue: '직책 목록' })}
              </h3>

              {/* Add new position form */}
              <div className="mb-6 flex gap-3">
                <input
                  type="text"
                  placeholder="직책 코드 (예: HN)"
                  value={newPosition.value}
                  onChange={(e) => setNewPosition({ ...newPosition, value: e.target.value.toUpperCase() })}
                  className="w-32 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <input
                  type="text"
                  placeholder="직책명 (예: 수후간호사)"
                  value={newPosition.label}
                  onChange={(e) => setNewPosition({ ...newPosition, label: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">레벨:</label>
                  <input
                    type="number"
                    placeholder="레벨"
                    value={newPosition.level}
                    onChange={(e) => setNewPosition({ ...newPosition, level: parseInt(e.target.value) || 1 })}
                    min="1"
                    max="10"
                    className="w-20 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!newPosition.value || !newPosition.label || newPosition.level <= 0 || isSavingPositions) {
                      return;
                    }
                    const updatedPositions = [...positions, newPosition];
                    try {
                      await persistPositions(updatedPositions);
                      setNewPosition({ value: '', label: '', level: 1 });
                    } catch {
                      // error handled inside persistPositions
                    }
                  }}
                  disabled={isSavingPositions}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    isSavingPositions
                      ? "bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600"
                  }`}
                >
                  {isSavingPositions ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      추가
                    </>
                  )}
                </button>
              </div>

              {/* Positions list */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {positions.map((position) => (
                  <div key={position.value} className="py-4 flex items-center justify-between">
                    {editingPosition === position.value ? (
                      <div className="flex gap-3 flex-1">
                        <input
                          type="text"
                          value={position.value}
                          disabled
                          className="w-32 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg"
                        />
                        <input
                          type="text"
                          defaultValue={position.label}
                          onBlur={async (e) => {
                            const nextLabel = e.target.value.trim();
                            if (!nextLabel || nextLabel === position.label) {
                              setEditingPosition(null);
                              return;
                            }
                            const updatedPositions = positions.map((p) =>
                              p.value === position.value ? { ...p, label: nextLabel } : p
                            );
                            try {
                              await persistPositions(updatedPositions);
                            } catch {
                              // handled inside persistPositions
                            } finally {
                              setEditingPosition(null);
                            }
                          }}
                          className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600 dark:text-gray-400">레벨:</label>
                          <input
                            type="number"
                            defaultValue={position.level}
                            onBlur={async (e) => {
                              const nextLevel = parseInt(e.target.value) || 1;
                              if (nextLevel === position.level) {
                                setEditingPosition(null);
                                return;
                              }
                              const updatedPositions = positions.map((p) =>
                                p.value === position.value ? { ...p, level: nextLevel } : p
                              );
                              try {
                                await persistPositions(updatedPositions);
                              } catch {
                                // handled inside persistPositions
                              } finally {
                                setEditingPosition(null);
                              }
                            }}
                            min="1"
                            max="10"
                            className="w-20 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md font-mono text-sm">
                          {position.value}
                        </span>
                        <span className="text-gray-900 dark:text-gray-100 font-medium">
                          {position.label}
                        </span>
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md text-sm font-medium">
                          Level {position.level}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingPosition(position.value)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`"${position.label}" 직책을 삭제하시겠습니까?`)) {
                            const updatedPositions = positions.filter(p => p.value !== position.value);
                            try {
                              await persistPositions(updatedPositions);
                            } catch {
                              // handled inside persistPositions
                            }
                          }
                        }}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {positions.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  아직 등록된 직책이 없습니다.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shifts Tab */}
        {activeTab === "shifts" && (
          <ShiftTypesTab
            shiftTypes={shiftTypes}
            newShiftType={newShiftType}
            setNewShiftType={setNewShiftType}
            editingShiftType={editingShiftType}
            setEditingShiftType={setEditingShiftType}
            onPersistShiftTypes={persistShiftTypes}
            isSavingShiftTypes={isSavingShiftTypes}
          />
        )}

        {/* Careers Tab */}
        {activeTab === "careers" && (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
              <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  경력 그룹 관리
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  직원들의 경력 년수를 그룹으로 묶어 관리합니다. 스케줄 작성 시 각 근무조에 다양한 경력 수준의 직원이 배치되도록 자동으로 조정됩니다.
                </p>
              </div>
            </div>

            {/* Add new career group form */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                새 경력 그룹 추가
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    최소 년수
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newCareerGroup.minYears === 0 ? '' : newCareerGroup.minYears}
                    onChange={(e) => setNewCareerGroup({ ...newCareerGroup, minYears: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    최대 년수
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newCareerGroup.maxYears === 0 ? '' : newCareerGroup.maxYears}
                    onChange={(e) => setNewCareerGroup({ ...newCareerGroup, maxYears: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                    placeholder="예: 2"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    설명
                  </label>
                  <input
                    type="text"
                    value={newCareerGroup.description}
                    onChange={(e) => setNewCareerGroup({ ...newCareerGroup, description: e.target.value })}
                    placeholder="예: 신입 간호사"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                  />
                </div>
              </div>
              <button
                onClick={async () => {
                  if (isSavingCareerGroups) {
                    return;
                  }
                  const minYears = Math.max(0, newCareerGroup.minYears);
                  const maxYears = Math.max(minYears, newCareerGroup.maxYears);
                  if (maxYears === 0) {
                    alert('최대 년수를 입력해주세요.');
                    return;
                  }

                  const generatedCode = `Y${minYears}-${maxYears}`;
                  const generatedName = `${minYears}-${maxYears}년차`;
                  const nextGroup = {
                    ...newCareerGroup,
                    code: generatedCode,
                    name: generatedName,
                    minYears,
                    maxYears,
                  };

                  const updatedGroups = [...careerGroups, nextGroup];
                  try {
                    await persistCareerGroups(updatedGroups);
                    setNewCareerGroup({
                      code: '',
                      name: '',
                      minYears: 0,
                      maxYears: 0,
                      description: '',
                    });
                  } catch {
                    // handled in persistCareerGroups
                  }
                }}
                disabled={isSavingCareerGroups}
                className={`mt-4 px-4 py-2 rounded-lg ${
                  isSavingCareerGroups
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                }`}
              >
                {isSavingCareerGroups ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                    저장 중...
                  </>
                ) : (
                  '추가'
                )}
              </button>
            </div>

            {/* Career groups list */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">등록된 경력 그룹</h3>
              <div className="space-y-3">
                {careerGroups.map((group) => (
                  <div
                    key={group.code}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100">
                          {group.code}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{group.name}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          ({group.minYears}-{group.maxYears}년)
                        </span>
                      </div>
                      {group.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {group.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm(`"${group.name}" 경력 그룹을 삭제하시겠습니까?`)) {
                          const updatedGroups = careerGroups.filter(g => g.code !== group.code);
                          try {
                            await persistCareerGroups(updatedGroups);
                          } catch {
                            // handled inside persistCareerGroups
                          }
                        }
                      }}
                      className="ml-4 p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {careerGroups.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    아직 등록된 경력 그룹이 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Handoff Templates Tab */}
        {activeTab === "handoffTemplates" && <HandoffTemplatesTab />}

        {/* Saved Presets Modal */}
        <SavedConfigPresetsModal
          isOpen={showPresetsModal}
          onClose={() => setShowPresetsModal(false)}
          onPresetLoad={handleLoadPreset}
        />

        {/* Saved Patterns Modal */}
        <SavedPatternPresetsModal
          isOpen={showPatternsModal}
          onClose={() => setShowPatternsModal(false)}
          onPatternLoad={(pattern) => {
            console.log('Pattern loaded:', pattern);
            alert(`부서 "${pattern.department?.name}" 패턴을 확인했습니다.`);
          }}
        />
    </MainLayout>
    </RoleGuard>
  );
}

export default function ConfigPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfigPageContent />
    </Suspense>
  );
}
