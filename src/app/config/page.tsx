"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Settings, Save, AlertCircle, Clock, Users, ChevronRight, Database, Trash2, Activity, Plus, Edit2, Briefcase, Building, FileText, UserCheck, GraduationCap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MainLayout } from "../../components/layout/MainLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ShiftTypesTab } from "./ShiftTypesTab";
import { PositionGroupsTab } from "./PositionGroupsTab";
import { ExperienceLevelsTab, ExperienceLevel } from "./ExperienceLevelsTab";
import { api as trpc } from "@/lib/trpc/client";

interface ContractType {
  code: string;
  name: string;
  description: string;
  maxHoursPerWeek?: number;
  minHoursPerWeek?: number;
  isPrimary: boolean;
}

interface ConfigData {
  preferences: {
    nightIntensivePaidLeaveDays: number; // 나이트 집중 근무 월별 유급 휴가 일수 (0이면 비활성화)
  };
}

function ConfigPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, ready } = useTranslation(['config', 'common']);

  // tRPC queries for fetching configs
  const { data: allConfigs, isLoading: configsLoading, refetch: refetchConfigs } = trpc.tenantConfigs.getAll.useQuery();
  const setConfigMutation = trpc.tenantConfigs.set.useMutation();

  // URL 파라미터에서 tab 읽기
  const tabFromUrl = searchParams.get('tab') as "preferences" | "positions" | "positionGroups" | "shifts" | "experienceLevels" | "secretCode" | null;
  const [activeTab, setActiveTab] = useState<"preferences" | "positions" | "positionGroups" | "shifts" | "experienceLevels" | "secretCode">(tabFromUrl || "preferences");
  const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null);
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
  const [newDepartment, setNewDepartment] = useState({
    id: '',
    name: '',
    code: '',
    requiresSpecialSkills: false
  });
  const [editingDepartment, setEditingDepartment] = useState<string | null>(null);

  // Contract types state
  const [contractTypes, setContractTypes] = useState<{
    code: string;
    name: string;
    description: string;
    maxHoursPerWeek?: number;
    minHoursPerWeek?: number;
    isPrimary: boolean;
  }[]>([]);
  const [newContractType, setNewContractType] = useState<ContractType>({
    code: '',
    name: '',
    description: '',
    maxHoursPerWeek: undefined,
    minHoursPerWeek: undefined,
    isPrimary: false,
  });
  const [editingContractType, setEditingContractType] = useState<string | null>(null);

  // Employee status state
  const [employeeStatuses, setEmployeeStatuses] = useState<{
    code: string;
    name: string;
    description: string;
    isActive: boolean;
    allowScheduling: boolean;
    color: string;
  }[]>([]);
  const [newEmployeeStatus, setNewEmployeeStatus] = useState({
    code: '',
    name: '',
    description: '',
    isActive: true,
    allowScheduling: true,
    color: 'green',
  });
  const [editingEmployeeStatus, setEditingEmployeeStatus] = useState<string | null>(null);

  // Position groups state
  const [positionGroups, setPositionGroups] = useState<{
    id: string;
    name: string;
    description: string;
    positionCodes: string[];
    color: string;
  }[]>([]);

  // Experience levels state
  const [experienceLevels, setExperienceLevels] = useState<ExperienceLevel[]>([]);

  useEffect(() => {
    // Fetch current user role
    fetch('/api/users/me')
      .then(res => res.json())
      .then(data => {
        setCurrentUser({ role: data.role });
      })
      .catch(err => console.error('Error fetching user:', err));
  }, []);

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

    const defaultShiftTypes = [
      { code: 'D', name: '주간 근무', startTime: '07:00', endTime: '15:00', color: 'blue', allowOvertime: false },
      { code: 'E', name: '저녁 근무', startTime: '15:00', endTime: '23:00', color: 'amber', allowOvertime: false },
      { code: 'N', name: '야간 근무', startTime: '23:00', endTime: '07:00', color: 'indigo', allowOvertime: true },
      { code: 'A', name: '행정 근무', startTime: '09:00', endTime: '18:00', color: 'green', allowOvertime: false },
      { code: 'O', name: '휴무', startTime: '00:00', endTime: '00:00', color: 'gray', allowOvertime: false },
    ];

    const defaultDepartments = [
      { id: 'dept-er', name: '응급실', code: 'ER', requiresSpecialSkills: true },
      { id: 'dept-icu', name: '중환자실', code: 'ICU', requiresSpecialSkills: true },
      { id: 'dept-or', name: '수술실', code: 'OR', requiresSpecialSkills: true },
      { id: 'dept-ward', name: '일반병동', code: 'WARD', requiresSpecialSkills: false },
    ];

    const defaultContractTypes = [
      { code: 'FT', name: '정규직', description: '정규 고용 계약', isPrimary: true },
      { code: 'PT', name: '파트타임', description: '시간제 계약', maxHoursPerWeek: 30, isPrimary: false },
      { code: 'CT', name: '계약직', description: '기간 계약직', isPrimary: false },
      { code: 'IN', name: '인턴', description: '인턴십 프로그램', maxHoursPerWeek: 40, isPrimary: false },
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
      const savedCodes = new Set(allConfigs.shift_types.map((st: any) => st.code));
      const missingDefaults = defaultShiftTypes.filter(dst => !savedCodes.has(dst.code));
      setShiftTypes([...allConfigs.shift_types, ...missingDefaults]);
    } else {
      setShiftTypes(defaultShiftTypes);
    }

    setDepartments(allConfigs.departments || defaultDepartments);
    setContractTypes(allConfigs.contract_types || defaultContractTypes);
    setEmployeeStatuses(allConfigs.employee_statuses || defaultEmployeeStatuses);
    setPositionGroups(allConfigs.position_groups || []);
    setExperienceLevels(allConfigs.experience_levels || []);

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

  const handleSave = async () => {
    try {
      // Save all configurations to tenant_configs via API
      await Promise.all([
        setConfigMutation.mutateAsync({ configKey: 'positions', configValue: positions }),
        setConfigMutation.mutateAsync({ configKey: 'shift_types', configValue: shiftTypes }),
        setConfigMutation.mutateAsync({ configKey: 'departments', configValue: departments }),
        setConfigMutation.mutateAsync({ configKey: 'contract_types', configValue: contractTypes }),
        setConfigMutation.mutateAsync({ configKey: 'employee_statuses', configValue: employeeStatuses }),
        setConfigMutation.mutateAsync({ configKey: 'position_groups', configValue: positionGroups }),
        setConfigMutation.mutateAsync({ configKey: 'experience_levels', configValue: experienceLevels }),
        setConfigMutation.mutateAsync({ configKey: 'preferences', configValue: config.preferences }),
      ]);

      // Refetch configs to update UI
      await refetchConfigs();

      alert(t('alerts.saved', { ns: 'config' }));
    } catch (error) {
      console.error('Failed to save configurations:', error);
      alert('설정 저장 중 오류가 발생했습니다.');
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
              onClick={() => setActiveTab("positionGroups")}
              className={`pb-3 px-1 text-sm border-b-2 transition-colors ${
                activeTab === "positionGroups"
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t('tabs.positionGroups', { ns: 'config', defaultValue: '직책 그룹' })}
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
              onClick={() => setActiveTab("experienceLevels")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "experienceLevels"
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <GraduationCap className="w-4 h-4 inline mr-2" />
              경력 단계
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

        {/* Position Groups Tab */}
        {activeTab === "positionGroups" && (
          <PositionGroupsTab
            positionGroups={positionGroups}
            setPositionGroups={setPositionGroups}
            positions={positions}
          />
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

        {/* Experience Levels Tab */}
        {activeTab === "experienceLevels" && (
          <ExperienceLevelsTab
            experienceLevels={experienceLevels}
            setExperienceLevels={setExperienceLevels}
          />
        )}

        {/* Departments Tab */}

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
            저장
          </button>
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
