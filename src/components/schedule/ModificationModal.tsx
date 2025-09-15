"use client";

import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  X,
  User,
  Clock,
  Heart,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Info,
  ArrowRight,
  Sparkles,
  Filter,
  ChevronRight,
} from "lucide-react";
import { type Staff } from "@/lib/types";
import { type ScheduleAssignment } from "@/lib/scheduler/types";

interface ModificationModalProps {
  selectedCell: {
    employeeId: string;
    date: Date;
    shiftId: string;
  };
  staff: Staff[];
  schedule: ScheduleAssignment[];
  onClose: () => void;
  onApply: (newAssignment: ScheduleAssignment) => void;
}

interface EmployeeOption {
  employee: Staff;
  penalty: number;
  violations: string[];
  benefits: string[];
  compatibility: number; // 0-100
  recommendation: "optimal" | "good" | "acceptable" | "poor";
}

export function ModificationModal({
  selectedCell,
  staff,
  schedule,
  onClose,
  onApply,
}: ModificationModalProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [filterSkills, setFilterSkills] = useState<string[]>([]);
  const [filterAvailability, setFilterAvailability] = useState(true);
  const [sortBy, setSortBy] = useState<"penalty" | "compatibility" | "name">("penalty");
  const [showOnlyRecommended, setShowOnlyRecommended] = useState(false);

  const currentEmployee = staff.find(s => s.id === selectedCell.employeeId);

  // 직원 옵션 계산 (실제 구현에서는 서버 API 호출)
  const employeeOptions = useMemo((): EmployeeOption[] => {
    return staff
      .filter(s => s.id !== selectedCell.employeeId && s.active)
      .map(employee => {
        // 페널티 계산 (예시)
        let penalty = 0;
        const violations: string[] = [];
        const benefits: string[] = [];

        // 선호도 체크 (예시 - 실제로는 preferences 데이터 참조 필요)
        if (selectedCell.shiftId.includes("day")) {
          benefits.push("주간 근무 가능");
          penalty -= 10;
        } else if (selectedCell.shiftId.includes("night")) {
          violations.push("야간 근무 배정");
          penalty += 20;
        }

        // 연속 근무 체크
        const consecutiveDays = checkConsecutiveDays(employee.id);
        if (consecutiveDays >= 5) {
          violations.push(`연속 ${consecutiveDays}일 근무`);
          penalty += 50;
        }

        // 주간 시간 체크
        const weeklyHours = calculateWeeklyHours(employee.id);
        if (weeklyHours > employee.maxWeeklyHours) {
          violations.push(`주 ${weeklyHours}시간 초과`);
          penalty += 30;
        } else if (weeklyHours < employee.maxWeeklyHours * 0.8) {
          benefits.push("최소 근무시간 충족 가능");
          penalty -= 5;
        }

        // 스킬 매칭
        if (employee.skills?.length > 3) {
          benefits.push("다양한 스킬 보유");
          penalty -= 5;
        }

        // 경험 레벨 보너스
        if (employee.experienceLevel === 'SENIOR' || employee.experienceLevel === 'EXPERT') {
          benefits.push("숙련 직원");
          penalty -= 10;
        }

        // 호환성 계산
        const compatibility = Math.max(0, Math.min(100, 100 - penalty));

        // 추천 레벨 결정
        let recommendation: EmployeeOption["recommendation"];
        if (penalty <= 0 && violations.length === 0) {
          recommendation = "optimal";
        } else if (penalty <= 20) {
          recommendation = "good";
        } else if (penalty <= 50) {
          recommendation = "acceptable";
        } else {
          recommendation = "poor";
        }

        return {
          employee,
          penalty: Math.max(0, penalty),
          violations,
          benefits,
          compatibility,
          recommendation,
        };
      })
      .sort((a, b) => {
        if (sortBy === "penalty") return a.penalty - b.penalty;
        if (sortBy === "compatibility") return b.compatibility - a.compatibility;
        return a.employee.name.localeCompare(b.employee.name);
      });
  }, [staff, selectedCell, sortBy]);

  // 연속 근무일 체크 (예시)
  const checkConsecutiveDays = (employeeId: string): number => {
    // 실제 구현에서는 schedule 데이터를 분석
    return Math.floor(Math.random() * 7);
  };

  // 주간 근무시간 계산 (예시)
  const calculateWeeklyHours = (employeeId: string): number => {
    // 실제 구현에서는 schedule 데이터를 분석
    return Math.floor(Math.random() * 20) + 30;
  };

  const getRecommendationColor = (recommendation: EmployeeOption["recommendation"]) => {
    switch (recommendation) {
      case "optimal":
        return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800";
      case "good":
        return "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800";
      case "acceptable":
        return "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800";
      default:
        return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
    }
  };

  const getRecommendationBadge = (recommendation: EmployeeOption["recommendation"]) => {
    switch (recommendation) {
      case "optimal":
        return (
          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
            최적
          </span>
        );
      case "good":
        return (
          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
            양호
          </span>
        );
      case "acceptable":
        return (
          <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded-full text-xs font-medium">
            보통
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full text-xs font-medium">
            주의
          </span>
        );
    }
  };

  const filteredOptions = employeeOptions.filter(option => {
    if (showOnlyRecommended && option.recommendation === "poor") return false;
    if (filterSkills.length > 0 && !filterSkills.some(skill => option.employee.skills?.includes(skill))) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 bg-gray-900/50 dark:bg-gray-950/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" />
                직원 교체
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {format(selectedCell.date, "M월 d일 (EEE)", { locale: ko })} · {currentEmployee?.name} → ?
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* 필터 및 정렬 */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">필터:</span>

              <button
                onClick={() => setShowOnlyRecommended(!showOnlyRecommended)}
                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                  showOnlyRecommended
                    ? "bg-blue-500 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                추천만
              </button>

              <button className="px-3 py-1 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                <Filter className="w-3.5 h-3.5 inline mr-1" />
                스킬 필터
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">정렬:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="penalty">페널티 순</option>
                <option value="compatibility">호환성 순</option>
                <option value="name">이름 순</option>
              </select>
            </div>
          </div>
        </div>

        {/* 직원 목록 */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-250px)]">
          <div className="space-y-3">
            {/* AI 최적 추천 */}
            {filteredOptions[0]?.recommendation === "optimal" && (
              <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 rounded-xl border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">AI 최적 추천</span>
                </div>
                <EmployeeCard
                  option={filteredOptions[0]}
                  isSelected={selectedEmployee === filteredOptions[0].employee.id}
                  onSelect={() => setSelectedEmployee(filteredOptions[0].employee.id)}
                />
              </div>
            )}

            {/* 일반 직원 목록 */}
            <div className="grid grid-cols-2 gap-3">
              {filteredOptions.map((option) => (
                <EmployeeCard
                  key={option.employee.id}
                  option={option}
                  isSelected={selectedEmployee === option.employee.id}
                  onSelect={() => setSelectedEmployee(option.employee.id)}
                />
              ))}
            </div>

            {filteredOptions.length === 0 && (
              <div className="text-center py-12">
                <User className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  조건에 맞는 직원이 없습니다
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 하단 액션 */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedEmployee && (
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {staff.find(s => s.id === selectedEmployee)?.name} 선택됨
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (selectedEmployee) {
                    onApply({
                      employeeId: selectedEmployee,
                      shiftId: selectedCell.shiftId,
                      date: selectedCell.date,
                    } as ScheduleAssignment);
                  }
                }}
                disabled={!selectedEmployee}
                className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                교체 적용
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 직원 카드 컴포넌트
function EmployeeCard({
  option,
  isSelected,
  onSelect,
}: {
  option: EmployeeOption;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const getRecommendationColor = (recommendation: EmployeeOption["recommendation"]) => {
    switch (recommendation) {
      case "optimal":
        return "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950/30";
      case "good":
        return "border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30";
      case "acceptable":
        return "border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-950/30";
      default:
        return "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/30";
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-lg"
          : getRecommendationColor(option.recommendation)
      } hover:shadow-md`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {option.employee.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {option.employee.role} • {option.employee.experienceLevel}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {option.recommendation === "optimal" && (
            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
              최적
            </span>
          )}
          {option.penalty > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              option.penalty > 50
                ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                : option.penalty > 20
                ? "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300"
                : "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
            }`}>
              +{option.penalty}
            </span>
          )}
        </div>
      </div>

      {/* 호환성 바 */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500 dark:text-gray-400">호환성</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {option.compatibility}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${
              option.compatibility >= 80
                ? "bg-green-500"
                : option.compatibility >= 60
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
            style={{ width: `${option.compatibility}%` }}
          />
        </div>
      </div>

      {/* 장점 */}
      {option.benefits.length > 0 && (
        <div className="space-y-1 mb-2">
          {option.benefits.slice(0, 2).map((benefit, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-xs">
              <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
              <span className="text-gray-600 dark:text-gray-400">{benefit}</span>
            </div>
          ))}
        </div>
      )}

      {/* 주의사항 */}
      {option.violations.length > 0 && (
        <div className="space-y-1">
          {option.violations.slice(0, 2).map((violation, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-xs">
              <AlertTriangle className="w-3 h-3 text-orange-500 flex-shrink-0" />
              <span className="text-gray-600 dark:text-gray-400">{violation}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}