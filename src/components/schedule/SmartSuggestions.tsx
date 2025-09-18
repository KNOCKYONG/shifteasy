"use client";

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  X,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Users,
  Heart,
  Shield,
  Clock,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { type ScheduleAssignment } from "@/lib/scheduler/types";
import { type Staff } from "@/lib/types";

interface SmartSuggestionsProps {
  schedule: ScheduleAssignment[];
  staff: Staff[];
  penalties: any;
  onApplySuggestion: (suggestion: Suggestion) => void;
  onClose: () => void;
}

interface Suggestion {
  id: string;
  type: "swap" | "redistribute" | "optimize" | "fix";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  impact: {
    penaltyReduction: number;
    affectedEmployees: string[];
    improvements: string[];
    risks: string[];
  };
  actions: {
    from: { employeeId: string; date: Date; shiftId: string }[];
    to: { employeeId: string; date: Date; shiftId: string }[];
  };
  confidence: number; // 0-100
}

export function SmartSuggestions({
  schedule,
  staff,
  penalties,
  onApplySuggestion,
  onClose,
}: SmartSuggestionsProps) {
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<"all" | "legal" | "fairness" | "preference">("all");

  // AI 제안 생성 (실제 구현에서는 서버 API 호출)
  const suggestions = useMemo((): Suggestion[] => {
    const suggestions: Suggestion[] = [];

    // 법적 제약 위반 해결
    if (penalties.legal > 0) {
      suggestions.push({
        id: "fix-legal-1",
        type: "fix",
        priority: "high",
        title: "연속 근무일 초과 해결",
        description: "김간호사의 7일 연속 근무를 6일로 조정합니다.",
        impact: {
          penaltyReduction: 100,
          affectedEmployees: ["김간호사", "박간호사"],
          improvements: ["법적 제약 준수", "직원 피로도 감소"],
          risks: ["박간호사의 선호 시프트 변경"],
        },
        actions: {
          from: [{ employeeId: "emp-1", date: new Date(), shiftId: "shift-day" }],
          to: [{ employeeId: "emp-2", date: new Date(), shiftId: "shift-day" }],
        },
        confidence: 95,
      });
    }

    // 공정성 개선
    suggestions.push({
      id: "improve-fairness-1",
      type: "redistribute",
      priority: "medium",
      title: "주말 근무 재분배",
      description: "주말 근무를 더 공평하게 분배하여 공정성을 15% 향상시킵니다.",
      impact: {
        penaltyReduction: 30,
        affectedEmployees: ["이간호사", "정간호사", "최간호사"],
        improvements: ["공정성 지수 85% → 92%", "직원 만족도 향상"],
        risks: [],
      },
      actions: {
        from: [],
        to: [],
      },
      confidence: 88,
    });

    // 선호도 최적화
    suggestions.push({
      id: "optimize-pref-1",
      type: "optimize",
      priority: "low",
      title: "선호 시프트 매칭 개선",
      description: "3명의 직원을 선호하는 시프트로 재배치합니다.",
      impact: {
        penaltyReduction: 20,
        affectedEmployees: ["강간호사", "윤간호사", "한간호사"],
        improvements: ["선호도 만족 78% → 85%", "이직률 감소 예상"],
        risks: ["일부 직원의 근무 패턴 변경"],
      },
      actions: {
        from: [],
        to: [],
      },
      confidence: 75,
    });

    // 스마트 스왑 제안
    suggestions.push({
      id: "smart-swap-1",
      type: "swap",
      priority: "medium",
      title: "효율적인 직원 교체",
      description: "스킬과 경험을 고려한 최적의 직원 교체를 제안합니다.",
      impact: {
        penaltyReduction: 25,
        affectedEmployees: ["김간호사", "이간호사"],
        improvements: ["스킬 매칭 향상", "팀 시너지 증가"],
        risks: [],
      },
      actions: {
        from: [],
        to: [],
      },
      confidence: 82,
    });

    return suggestions;
  }, [schedule, staff, penalties]);

  // 카테고리별 필터링
  const filteredSuggestions = useMemo(() => {
    if (selectedCategory === "all") return suggestions;

    return suggestions.filter(s => {
      if (selectedCategory === "legal") return s.type === "fix" && s.priority === "high";
      if (selectedCategory === "fairness") return s.type === "redistribute";
      if (selectedCategory === "preference") return s.type === "optimize";
      return true;
    });
  }, [suggestions, selectedCategory]);

  const getPriorityColor = (priority: Suggestion["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
      case "medium":
        return "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800";
      default:
        return "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800";
    }
  };

  const getPriorityBadge = (priority: Suggestion["priority"]) => {
    switch (priority) {
      case "high":
        return (
          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full text-xs font-medium">
            긴급
          </span>
        );
      case "medium":
        return (
          <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded-full text-xs font-medium">
            중요
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
            개선
          </span>
        );
    }
  };

  const getTypeIcon = (type: Suggestion["type"]) => {
    switch (type) {
      case "fix":
        return <Shield className="w-5 h-5 text-red-500" />;
      case "redistribute":
        return <Users className="w-5 h-5 text-blue-500" />;
      case "optimize":
        return <Heart className="w-5 h-5 text-purple-500" />;
      case "swap":
        return <ArrowRight className="w-5 h-5 text-green-500" />;
    }
  };

  const handleApply = (suggestion: Suggestion) => {
    onApplySuggestion(suggestion);
    setAppliedSuggestions(prev => new Set([...prev, suggestion.id]));
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* 헤더 */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <Sparkles className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                AI 스마트 제안
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {suggestions.length}개의 개선 방안을 찾았습니다
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* 카테고리 필터 */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              selectedCategory === "all"
                ? "bg-blue-500 text-white"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            전체 ({suggestions.length})
          </button>
          <button
            onClick={() => setSelectedCategory("legal")}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              selectedCategory === "legal"
                ? "bg-red-500 text-white"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <Shield className="w-3.5 h-3.5 inline mr-1" />
            법적 제약
          </button>
          <button
            onClick={() => setSelectedCategory("fairness")}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              selectedCategory === "fairness"
                ? "bg-blue-500 text-white"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <Users className="w-3.5 h-3.5 inline mr-1" />
            공정성
          </button>
          <button
            onClick={() => setSelectedCategory("preference")}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              selectedCategory === "preference"
                ? "bg-purple-500 text-white"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <Heart className="w-3.5 h-3.5 inline mr-1" />
            선호도
          </button>
        </div>
      </div>

      {/* 제안 목록 */}
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {filteredSuggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className={`rounded-xl border-2 overflow-hidden transition-all ${
              getPriorityColor(suggestion.priority)
            } ${appliedSuggestions.has(suggestion.id) ? "opacity-50" : ""}`}
          >
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  {getTypeIcon(suggestion.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {suggestion.title}
                      </h4>
                      {getPriorityBadge(suggestion.priority)}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {suggestion.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedSuggestion(
                    expandedSuggestion === suggestion.id ? null : suggestion.id
                  )}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  {expandedSuggestion === suggestion.id ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>

              {/* 영향 요약 */}
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    -{suggestion.impact.penaltyReduction} 페널티
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {suggestion.impact.affectedEmployees.length}명 영향
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-purple-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    신뢰도 {suggestion.confidence}%
                  </span>
                </div>
              </div>

              {/* 상세 정보 (확장 시) */}
              {expandedSuggestion === suggestion.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  {/* 개선사항 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        개선사항
                      </span>
                    </div>
                    <div className="space-y-1">
                      {suggestion.impact.improvements.map((improvement, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <span className="w-1 h-1 bg-green-500 rounded-full" />
                          {improvement}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 리스크 */}
                  {suggestion.impact.risks.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          고려사항
                        </span>
                      </div>
                      <div className="space-y-1">
                        {suggestion.impact.risks.map((risk, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <span className="w-1 h-1 bg-orange-500 rounded-full" />
                            {risk}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 영향받는 직원 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        영향받는 직원
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suggestion.impact.affectedEmployees.map((emp, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs"
                        >
                          {emp}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex items-center justify-between mt-4">
                <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
                  <Info className="w-4 h-4 inline mr-1" />
                  상세 보기
                </button>
                <button
                  onClick={() => handleApply(suggestion)}
                  disabled={appliedSuggestions.has(suggestion.id)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    appliedSuggestions.has(suggestion.id)
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}
                >
                  {appliedSuggestions.has(suggestion.id) ? (
                    <>
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      적용됨
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 inline mr-1" />
                      적용하기
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredSuggestions.length === 0 && (
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              현재 카테고리에 해당하는 제안이 없습니다
            </p>
          </div>
        )}
      </div>

      {/* 하단 정보 */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            {appliedSuggestions.size}개 제안 적용됨
          </span>
          <button className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium">
            모든 제안 일괄 적용
          </button>
        </div>
      </div>
    </div>
  );
}