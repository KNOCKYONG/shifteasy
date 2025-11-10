"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Settings, Save, Trash2, Activity, Plus, Edit2, Briefcase } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MainLayout } from "../../components/layout/MainLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ShiftTypesTab } from "./ShiftTypesTab";
import { api as trpc } from "@/lib/trpc/client";
import { LoadingButton } from "@/components/ui/LoadingButton";

interface ConfigData {
  preferences: {
    nightIntensivePaidLeaveDays: number; // 나이트 집중 근무 월별 유급 휴가 일수 (0이면 비활성화)
  };
}

type ShiftConfig = {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  allowOvertime: boolean;
};

function ConfigPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation(['config', 'common']);

  // tRPC queries for fetching configs
  const { data: allConfigs, refetch: refetchConfigs } = trpc.configs.getAll.useQuery();
  const setConfigMutation = trpc.configs.set.useMutation();

  // URL 파라미터에서 tab 읽기
  const tabFromUrl = searchParams.get('tab') as "preferences" | "positions" | "shifts" | "careers" | "secretCode" | null;
  const [activeTab, setActiveTab] = useState<"preferences" | "positions" | "shifts" | "careers" | "secretCode">(tabFromUrl || "preferences");
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
    color: 'blue',
    allowOvertime: false
  });
  const [editingShiftType, setEditingShiftType] = useState<string | null>(null);

  // Departments state
  const [departments, setDepartments] = useState<{
    id: string;
    name: string;
    code: string;
    requiresSpecialSkills: boolean;
  }[]>([]);
  // Employee status state
  const [employeeStatuses, setEmployeeStatuses] = useState<{
    code: string;
    name: string;
    description: string;
    isActive: boolean;
    allowScheduling: boolean;
    color: string;
  }[]>([]);
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
    maxYears: 2,
    description: '',
  });

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

    const defaultDepartments = [
      { id: 'dept-er', name: '응급실', code: 'ER', requiresSpecialSkills: true },
      { id: 'dept-icu', name: '중환자실', code: 'ICU', requiresSpecialSkills: true },
      { id: 'dept-or', name: '수술실', code: 'OR', requiresSpecialSkills: true },
      { id: 'dept-ward', name: '일반병동', code: 'WARD', requiresSpecialSkills: false },
    ];

    const defaultEmployeeStatuses = [
      { code: 'ACTIVE', name: '활성', description: '정상 근무', isActive: true, allowScheduling: true, color: 'green' },
      { code: 'LEAVE', name: '휴가', description: '휴가 중', isActive: false, allowScheduling: false, color: 'amber' },
      { code: 'SICK', name: '병가', description: '병가 중', isActive: false, allowScheduling: false, color: 'red' },
      { code: 'TRAINING', name: '교육', description: '교육 참여 중', isActive: true, allowScheduling: false, color: 'blue' },
    ];

    // Load from API or use defaults
    setPositions(allConfigs.positions || defaultPositions);

    // Merge saved shift types with defaults (add missing defaults)
    if (allConfigs.shift_types) {
      const savedShiftTypes = allConfigs.shift_types as ShiftConfig[];
      const savedCodes = new Set(savedShiftTypes.map((st) => st.code));
      const missingDefaults = defaultShiftTypes.filter(dst => !savedCodes.has(dst.code));
      setShiftTypes([...savedShiftTypes, ...missingDefaults]);
    } else {
      setShiftTypes(defaultShiftTypes);
    }

    setDepartments(allConfigs.departments || defaultDepartments);
    setEmployeeStatuses(allConfigs.employee_statuses || defaultEmployeeStatuses);

    // Load career groups
    if (allConfigs.career_groups) {
      setCareerGroups(allConfigs.career_groups);
    }

    // Load preferences
    if (allConfigs.preferences) {
      setConfig({ preferences: allConfigs.preferences });
    }
  }, [allConfigs]);

  const [config, setConfig] = useState<ConfigData>({
    preferences: {
      nightIntensivePaidLeaveDays: 2, // 기본값: 월 2회
    },
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save all configurations to tenant_configs via API
      await Promise.all([
        setConfigMutation.mutateAsync({ configKey: 'positions', configValue: positions }),
        setConfigMutation.mutateAsync({ configKey: 'shift_types', configValue: shiftTypes }),
        setConfigMutation.mutateAsync({ configKey: 'departments', configValue: departments }),
        setConfigMutation.mutateAsync({ configKey: 'employee_statuses', configValue: employeeStatuses }),
        setConfigMutation.mutateAsync({ configKey: 'career_groups', configValue: careerGroups }),
        setConfigMutation.mutateAsync({ configKey: 'preferences', configValue: config.preferences }),
      ]);

      // Refetch configs to update UI
      await refetchConfigs();

      alert(t('alerts.saved', { ns: 'config' }));
    } catch (error) {
      console.error('Failed to save configurations:', error);
      alert('설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RoleGuard>
      <MainLayout>
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
          <div className="mb-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
            3교대(주간/저녁/야간) 패턴을 기준으로 스케줄이 생성되며, 근무 패턴은 변경할 수 없습니다.
          </div>
          <nav className="flex gap-8">
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
                </div>
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
                  onClick={() => {
                    if (newPosition.value && newPosition.label && newPosition.level > 0) {
                      const updatedPositions = [...positions, newPosition];
                      setPositions(updatedPositions);
                      setNewPosition({ value: '', label: '', level: 1 });
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  추가
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
                          onBlur={(e) => {
                            const updatedPositions = positions.map(p =>
                              p.value === position.value ? { ...p, label: e.target.value } : p
                            );
                            setPositions(updatedPositions);
                          }}
                          className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600 dark:text-gray-400">레벨:</label>
                          <input
                            type="number"
                            defaultValue={position.level}
                            onBlur={(e) => {
                              const updatedPositions = positions.map(p =>
                                p.value === position.value ? { ...p, level: parseInt(e.target.value) || 1 } : p
                              );
                              setPositions(updatedPositions);
                              setEditingPosition(null);
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
                        onClick={() => {
                          if (confirm(`"${position.label}" 직책을 삭제하시겠습니까?`)) {
                            const updatedPositions = positions.filter(p => p.value !== position.value);
                            setPositions(updatedPositions);
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
            setShiftTypes={setShiftTypes}
            newShiftType={newShiftType}
            setNewShiftType={setNewShiftType}
            editingShiftType={editingShiftType}
            setEditingShiftType={setEditingShiftType}
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
                    코드
                  </label>
                  <input
                    type="text"
                    value={newCareerGroup.code}
                    onChange={(e) => setNewCareerGroup({ ...newCareerGroup, code: e.target.value.toUpperCase() })}
                    placeholder="예: Y1-2"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    이름
                  </label>
                  <input
                    type="text"
                    value={newCareerGroup.name}
                    onChange={(e) => setNewCareerGroup({ ...newCareerGroup, name: e.target.value })}
                    placeholder="예: 1-2년차"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                  />
                </div>
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
                    placeholder="0"
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
                onClick={() => {
                  if (newCareerGroup.code && newCareerGroup.name) {
                    setCareerGroups([...careerGroups, { ...newCareerGroup }]);
                    setNewCareerGroup({
                      code: '',
                      name: '',
                      minYears: 0,
                      maxYears: 2,
                      description: '',
                    });
                  }
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                추가
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
                      onClick={() => setCareerGroups(careerGroups.filter(g => g.code !== group.code))}
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

        {/* Departments Tab */}

        {/* Action Buttons */}
        <div className="mt-8 flex justify-between">
          <button
            onClick={() => router.push("/department")}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {t('actions.previousStep', { ns: 'config' })}
          </button>
          <LoadingButton
            onClick={handleSave}
            isLoading={isSaving}
            variant="primary"
            size="md"
            className="px-6 py-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? '저장 중...' : '저장'}
          </LoadingButton>
        </div>
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
