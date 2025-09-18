"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Settings, Save, AlertCircle, Clock, Users, Calendar, Shield, ChevronRight, Info, Database, Trash2, Activity, Plus, Edit2, Briefcase, Building, FileText, UserCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type ShiftRule, type ShiftPattern } from "@/lib/types";
import { MainLayout } from "../../components/layout/MainLayout";
import { ShiftTypesTab } from "./ShiftTypesTab";
import { DepartmentsTab } from "./DepartmentsTab";
import { ContractTypesTab } from "./ContractTypesTab";
import { EmployeeStatusTab } from "./EmployeeStatusTab";
import { PositionGroupsTab } from "./PositionGroupsTab";

interface ContractType {
  code: string;
  name: string;
  description: string;
  maxHoursPerWeek?: number;
  minHoursPerWeek?: number;
  isPrimary: boolean;
}

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

  const [activeTab, setActiveTab] = useState<"patterns" | "rules" | "preferences" | "positions" | "positionGroups" | "shifts" | "departments" | "contracts" | "statuses">("patterns");
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

  useEffect(() => {
    // Load positions from localStorage
    const savedPositions = localStorage.getItem('customPositions');
    if (savedPositions) {
      const parsed = JSON.parse(savedPositions);
      // Migrate old positions without level to have appropriate levels
      const migratedPositions = parsed.map((p: any) => {
        if (!p.level) {
          // Assign default levels based on position code
          switch(p.value) {
            case 'HN': return { ...p, level: 9 };
            case 'SN': return { ...p, level: 7 };
            case 'CN': return { ...p, level: 5 };
            case 'RN': return { ...p, level: 3 };
            case 'NA': return { ...p, level: 1 };
            default: return { ...p, level: 1 };
          }
        }
        return p;
      });
      setPositions(migratedPositions);
      // Save migrated positions back if changed
      if (JSON.stringify(parsed) !== JSON.stringify(migratedPositions)) {
        localStorage.setItem('customPositions', JSON.stringify(migratedPositions));
      }
    } else {
      // Default positions if none saved
      const defaultPositions = [
        { value: 'HN', label: '수석간호사', level: 9 },
        { value: 'SN', label: '전문간호사', level: 7 },
        { value: 'CN', label: '책임간호사', level: 5 },
        { value: 'RN', label: '정규간호사', level: 3 },
        { value: 'NA', label: '간호조무사', level: 1 },
      ];
      setPositions(defaultPositions);
      localStorage.setItem('customPositions', JSON.stringify(defaultPositions));
    }

    // Load shift types from localStorage
    const savedShiftTypes = localStorage.getItem('customShiftTypes');
    if (savedShiftTypes) {
      setShiftTypes(JSON.parse(savedShiftTypes));
    } else {
      // Default shift types
      const defaultShiftTypes = [
        { code: 'D', name: '주간 근무', startTime: '07:00', endTime: '15:00', color: 'blue', allowOvertime: false },
        { code: 'E', name: '저녁 근무', startTime: '15:00', endTime: '23:00', color: 'amber', allowOvertime: false },
        { code: 'N', name: '야간 근무', startTime: '23:00', endTime: '07:00', color: 'indigo', allowOvertime: true },
        { code: 'O', name: '휴무', startTime: '00:00', endTime: '00:00', color: 'gray', allowOvertime: false },
      ];
      setShiftTypes(defaultShiftTypes);
      localStorage.setItem('customShiftTypes', JSON.stringify(defaultShiftTypes));
    }

    // Load departments from localStorage
    const savedDepartments = localStorage.getItem('customDepartments');
    if (savedDepartments) {
      setDepartments(JSON.parse(savedDepartments));
    } else {
      // Default departments
      const defaultDepartments = [
        { id: 'dept-er', name: '응급실', code: 'ER', requiresSpecialSkills: true },
        { id: 'dept-icu', name: '중환자실', code: 'ICU', requiresSpecialSkills: true },
        { id: 'dept-or', name: '수술실', code: 'OR', requiresSpecialSkills: true },
        { id: 'dept-ward', name: '일반병동', code: 'WARD', requiresSpecialSkills: false },
      ];
      setDepartments(defaultDepartments);
      localStorage.setItem('customDepartments', JSON.stringify(defaultDepartments));
    }

    // Load contract types from localStorage
    const savedContractTypes = localStorage.getItem('customContractTypes');
    if (savedContractTypes) {
      setContractTypes(JSON.parse(savedContractTypes));
    } else {
      // Default contract types
      const defaultContractTypes = [
        { code: 'FT', name: '정규직', description: '정규 고용 계약', isPrimary: true },
        { code: 'PT', name: '파트타임', description: '시간제 계약', maxHoursPerWeek: 30, isPrimary: false },
        { code: 'CT', name: '계약직', description: '기간 계약직', isPrimary: false },
        { code: 'IN', name: '인턴', description: '인턴십 프로그램', maxHoursPerWeek: 40, isPrimary: false },
      ];
      setContractTypes(defaultContractTypes);
      localStorage.setItem('customContractTypes', JSON.stringify(defaultContractTypes));
    }

    // Load employee statuses from localStorage
    const savedEmployeeStatuses = localStorage.getItem('customEmployeeStatuses');
    if (savedEmployeeStatuses) {
      setEmployeeStatuses(JSON.parse(savedEmployeeStatuses));
    } else {
      // Default employee statuses
      const defaultStatuses = [
        { code: 'ACTIVE', name: '활성', description: '정상 근무', isActive: true, allowScheduling: true, color: 'green' },
        { code: 'LEAVE', name: '휴가', description: '휴가 중', isActive: false, allowScheduling: false, color: 'amber' },
        { code: 'SICK', name: '병가', description: '병가 중', isActive: false, allowScheduling: false, color: 'red' },
        { code: 'TRAINING', name: '교육', description: '교육 참여 중', isActive: true, allowScheduling: false, color: 'blue' },
      ];
      setEmployeeStatuses(defaultStatuses);
      localStorage.setItem('customEmployeeStatuses', JSON.stringify(defaultStatuses));
    }

    // Load position groups from localStorage
    const savedPositionGroups = localStorage.getItem('customPositionGroups');
    if (savedPositionGroups) {
      setPositionGroups(JSON.parse(savedPositionGroups));
    }
  }, []);

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
              onClick={() => setActiveTab("departments")}
              className={`pb-3 px-1 text-sm border-b-2 transition-colors ${
                activeTab === "departments"
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t('tabs.departments', { ns: 'config', defaultValue: '부서/병동' })}
            </button>
            <button
              onClick={() => setActiveTab("contracts")}
              className={`pb-3 px-1 text-sm border-b-2 transition-colors ${
                activeTab === "contracts"
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t('tabs.contracts', { ns: 'config', defaultValue: '계약 유형' })}
            </button>
            <button
              onClick={() => setActiveTab("statuses")}
              className={`pb-3 px-1 text-sm border-b-2 transition-colors ${
                activeTab === "statuses"
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t('tabs.statuses', { ns: 'config', defaultValue: '직원 상태' })}
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
                      localStorage.setItem('customPositions', JSON.stringify(updatedPositions));
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
                            localStorage.setItem('customPositions', JSON.stringify(updatedPositions));
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
                              localStorage.setItem('customPositions', JSON.stringify(updatedPositions));
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
                            localStorage.setItem('customPositions', JSON.stringify(updatedPositions));
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

        {/* Departments Tab */}
        {activeTab === "departments" && (
          <DepartmentsTab
            departments={departments}
            setDepartments={setDepartments}
            newDepartment={newDepartment}
            setNewDepartment={setNewDepartment}
            editingDepartment={editingDepartment}
            setEditingDepartment={setEditingDepartment}
          />
        )}

        {/* Contracts Tab */}
        {activeTab === "contracts" && (
          <ContractTypesTab
            contractTypes={contractTypes}
            setContractTypes={setContractTypes}
            newContractType={newContractType}
            setNewContractType={setNewContractType}
            editingContractType={editingContractType}
            setEditingContractType={setEditingContractType}
          />
        )}

        {/* Statuses Tab */}
        {activeTab === "statuses" && (
          <EmployeeStatusTab
            employeeStatuses={employeeStatuses}
            setEmployeeStatuses={setEmployeeStatuses}
            newEmployeeStatus={newEmployeeStatus}
            setNewEmployeeStatus={setNewEmployeeStatus}
            editingEmployeeStatus={editingEmployeeStatus}
            setEditingEmployeeStatus={setEditingEmployeeStatus}
          />
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
    </MainLayout>
  );
}