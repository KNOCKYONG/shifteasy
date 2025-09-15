"use client";

import React, { useState, useCallback, useMemo } from "react";
import { format, addDays } from "date-fns";
import { ko } from "date-fns/locale";
import {
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Users,
  TrendingUp,
  TrendingDown,
  Undo2,
  Redo2,
  Save,
  X,
  RefreshCw,
  Sparkles,
  UserCheck,
  AlertCircle,
  Clock,
  Heart,
  Shield,
  ChevronDown,
} from "lucide-react";
import { type ScheduleAssignment } from "@/lib/scheduler/types";
import { type Staff } from "@/lib/types";
import { ModificationModal } from "./ModificationModal";
import { PenaltyIndicator } from "./PenaltyIndicator";
import { SmartSuggestions } from "./SmartSuggestions";
import { DraggableScheduleView } from "./DraggableScheduleView";

interface ScheduleReviewPanelProps {
  originalSchedule: ScheduleAssignment[];
  modifiedSchedule: ScheduleAssignment[];
  staff: Staff[];
  currentWeek: Date;
  onScheduleUpdate: (schedule: ScheduleAssignment[]) => void;
  onApplyChanges: () => void;
  onDiscardChanges: () => void;
}

interface ModificationHistory {
  id: string;
  timestamp: Date;
  type: "swap" | "add" | "remove" | "bulk";
  description: string;
  previousState: ScheduleAssignment[];
  newState: ScheduleAssignment[];
  penaltyDelta: number;
}

interface PenaltyMetrics {
  total: number;
  legal: number;
  preference: number;
  fairness: number;
  coverage: number;
  details: {
    category: string;
    value: number;
    severity: "low" | "medium" | "high" | "critical";
    message: string;
  }[];
}

export function ScheduleReviewPanel({
  originalSchedule,
  modifiedSchedule,
  staff,
  currentWeek,
  onScheduleUpdate,
  onApplyChanges,
  onDiscardChanges,
}: ScheduleReviewPanelProps) {
  const [selectedCell, setSelectedCell] = useState<{
    employeeId: string;
    date: Date;
    shiftId: string;
  } | null>(null);
  const [showModificationModal, setShowModificationModal] = useState(false);
  const [history, setHistory] = useState<ModificationHistory[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showComparison, setShowComparison] = useState(true);
  const [highlightChanges, setHighlightChanges] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 페널티 계산 (실제 구현에서는 서버 API 호출)
  const calculatePenalties = useCallback((): PenaltyMetrics => {
    const changes = findChanges();
    let totalPenalty = 0;
    let legalPenalty = 0;
    const details = [];

    // 법적 제약 검사
    if (changes.length > 0) {
      // 예시 페널티 계산
      legalPenalty = changes.filter(c => c.type === "violation").length * 100;
      if (legalPenalty > 0) {
        details.push({
          category: "법적 제약",
          value: legalPenalty,
          severity: "critical" as const,
          message: "최대 연속 근무일 초과",
        });
      }
      totalPenalty += legalPenalty;
    }

    // 선호도 영향
    const preferencePenalty = Math.round(changes.length * 15);
    if (preferencePenalty > 0) {
      details.push({
        category: "선호도",
        value: preferencePenalty,
        severity: "medium" as const,
        message: `${changes.length}명의 선호 시프트 변경`,
      });
    }
    totalPenalty += preferencePenalty;

    // 공정성 영향
    const fairnessPenalty = Math.round(changes.length * 10);
    if (fairnessPenalty > 0) {
      details.push({
        category: "공정성",
        value: fairnessPenalty,
        severity: "low" as const,
        message: "근무 시간 불균형 증가",
      });
    }
    totalPenalty += fairnessPenalty;

    return {
      total: totalPenalty,
      legal: legalPenalty,
      preference: preferencePenalty,
      fairness: fairnessPenalty,
      coverage: 0,
      details,
    };
  }, [modifiedSchedule, originalSchedule]);

  // 변경사항 찾기
  const findChanges = useCallback(() => {
    const changes: any[] = [];

    // 간단한 비교 로직 (실제 구현에서는 더 정교하게)
    modifiedSchedule.forEach(assignment => {
      const original = originalSchedule.find(
        o => o.employeeId === assignment.employeeId &&
            o.date === assignment.date
      );
      if (!original || original.shiftId !== assignment.shiftId) {
        changes.push({
          type: "modification",
          employeeId: assignment.employeeId,
          date: assignment.date,
          from: original?.shiftId,
          to: assignment.shiftId,
        });
      }
    });

    return changes;
  }, [modifiedSchedule, originalSchedule]);

  const penalties = useMemo(() => calculatePenalties(), [calculatePenalties]);
  const changes = useMemo(() => findChanges(), [findChanges]);
  const hasChanges = changes.length > 0;

  // 되돌리기
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onScheduleUpdate(history[newIndex].previousState);
    }
  };

  // 다시하기
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onScheduleUpdate(history[newIndex].newState);
    }
  };

  // 셀 클릭 핸들러
  const handleCellClick = (employeeId: string, date: Date, shiftId: string) => {
    setSelectedCell({ employeeId, date, shiftId });
    setShowModificationModal(true);
  };

  // 스마트 제안 적용
  const handleApplySuggestion = (suggestion: any) => {
    // 제안 적용 로직
    console.log("Applying suggestion:", suggestion);
  };

  // 페널티 색상 결정
  const getPenaltyColor = (value: number) => {
    if (value === 0) return "text-green-500 bg-green-50 dark:bg-green-950/30";
    if (value <= 10) return "text-yellow-500 bg-yellow-50 dark:bg-yellow-950/30";
    if (value <= 30) return "text-orange-500 bg-orange-50 dark:bg-orange-950/30";
    return "text-red-500 bg-red-50 dark:bg-red-950/30";
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case "high":
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case "medium":
        return <Info className="w-4 h-4 text-yellow-500" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* 상단 툴바 */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-500" />
              스케줄 검토 및 수정
            </h2>

            {/* 변경 상태 표시 */}
            {hasChanges && (
              <span className="px-3 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium">
                {changes.length}개 변경사항
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* 비교 모드 토글 */}
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                showComparison
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
            >
              <ArrowLeftRight className="w-4 h-4 inline mr-1" />
              비교 보기
            </button>

            {/* 변경사항 하이라이트 */}
            <button
              onClick={() => setHighlightChanges(!highlightChanges)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                highlightChanges
                  ? "bg-purple-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
            >
              <Sparkles className="w-4 h-4 inline mr-1" />
              변경 강조
            </button>

            {/* 스마트 제안 */}
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="px-3 py-1.5 text-sm font-medium bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all"
            >
              <Sparkles className="w-4 h-4 inline mr-1" />
              AI 제안
            </button>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

            {/* 되돌리기/다시하기 */}
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Undo2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Redo2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

            {/* 액션 버튼 */}
            <button
              onClick={onDiscardChanges}
              disabled={!hasChanges}
              className="px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4 inline mr-1" />
              취소
            </button>
            <button
              onClick={onApplyChanges}
              disabled={!hasChanges}
              className="px-4 py-1.5 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 inline mr-1" />
              변경사항 적용
            </button>
          </div>
        </div>
      </div>

      {/* 페널티 대시보드 */}
      {hasChanges && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
          <div className="grid grid-cols-5 gap-4">
            {/* 총 페널티 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">총 페널티</span>
                {penalties.total > 0 ? (
                  <TrendingUp className="w-4 h-4 text-red-500" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
              </div>
              <div className={`text-2xl font-bold ${getPenaltyColor(penalties.total).split(' ')[0]}`}>
                {penalties.total > 0 ? '+' : ''}{penalties.total}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                점수 변화
              </div>
            </div>

            {/* 법적 제약 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-red-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">법적 제약</span>
              </div>
              <div className={`text-xl font-bold ${penalties.legal > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {penalties.legal}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                위반 건수
              </div>
            </div>

            {/* 선호도 영향 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-pink-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">선호도</span>
              </div>
              <div className={`text-xl font-bold ${penalties.preference > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                -{penalties.preference}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                만족도 변화
              </div>
            </div>

            {/* 공정성 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">공정성</span>
              </div>
              <div className={`text-xl font-bold ${penalties.fairness > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                -{penalties.fairness}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                균형 지수
              </div>
            </div>

            {/* 커버리지 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <UserCheck className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">커버리지</span>
              </div>
              <div className="text-xl font-bold text-green-500">
                100%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                충족률
              </div>
            </div>
          </div>

          {/* 상세 페널티 목록 */}
          {penalties.details.length > 0 && (
            <div className="mt-4 space-y-2">
              <button className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <ChevronDown className="w-4 h-4" />
                상세 페널티 내역
              </button>
              <div className="grid grid-cols-2 gap-2">
                {penalties.details.map((detail, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-gray-900 rounded-lg p-3 flex items-start gap-3"
                  >
                    {getSeverityIcon(detail.severity)}
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {detail.category}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {detail.message}
                      </div>
                    </div>
                    <div className={`text-sm font-bold ${getPenaltyColor(detail.value).split(' ')[0]}`}>
                      +{detail.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 스마트 제안 패널 */}
      {showSuggestions && (
        <SmartSuggestions
          schedule={modifiedSchedule}
          staff={staff}
          penalties={penalties}
          onApplySuggestion={handleApplySuggestion}
          onClose={() => setShowSuggestions(false)}
        />
      )}

      {/* 수정 모달 */}
      {showModificationModal && selectedCell && (
        <ModificationModal
          selectedCell={selectedCell}
          staff={staff}
          schedule={modifiedSchedule}
          onClose={() => setShowModificationModal(false)}
          onApply={(newAssignment) => {
            // 수정 적용 로직
            console.log("Applying modification:", newAssignment);
            setShowModificationModal(false);
          }}
        />
      )}

      {/* 드래그 앤 드롭 가능한 스케줄 뷰 */}
      <DraggableScheduleView
        schedule={modifiedSchedule}
        staff={staff}
        currentWeek={currentWeek}
        onScheduleUpdate={(newSchedule) => {
          onScheduleUpdate(newSchedule);
          // 변경사항을 히스토리에 추가
          const newHistory: ModificationHistory = {
            id: Date.now().toString(),
            timestamp: new Date(),
            type: "swap",
            description: "드래그 앤 드롭으로 스케줄 수정",
            previousState: modifiedSchedule,
            newState: newSchedule,
            penaltyDelta: 0, // 실제로는 계산 필요
          };
          setHistory([...history.slice(0, historyIndex + 1), newHistory]);
          setHistoryIndex(historyIndex + 1);
        }}
        onCellClick={(employeeId, date, shiftId) => {
          setSelectedCell({ employeeId, date, shiftId });
          setShowModificationModal(true);
        }}
        highlightChanges={highlightChanges}
        originalSchedule={originalSchedule}
      />
    </div>
  );
}