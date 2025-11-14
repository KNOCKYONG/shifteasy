'use client';

import React, { useState } from 'react';
import { X, TrendingUp, Award, CheckCircle, AlertTriangle, Info, ArrowRight } from 'lucide-react';
import type { ImprovementReport } from '@/lib/scheduler/types';

interface ImprovementResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ImprovementReport | null;
  onApply: () => void;
  onReject: () => void;
}

type Tab = 'summary' | 'metrics' | 'changes' | 'recommendations';

export function ImprovementResultModal({
  isOpen,
  onClose,
  report,
  onApply,
  onReject,
}: ImprovementResultModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  if (!isOpen || !report) return null;

  const { summary, metrics, changes, recommendations } = report;

  // 등급 색상
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'S':
        return 'bg-purple-600 text-white';
      case 'A':
        return 'bg-green-600 text-white';
      case 'B':
        return 'bg-blue-600 text-white';
      case 'C':
        return 'bg-yellow-600 text-white';
      case 'D':
        return 'bg-orange-600 text-white';
      case 'F':
        return 'bg-red-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  // 메트릭 변화 표시
  const renderMetricChange = (before: number, after: number) => {
    const delta = after - before;
    const isImproved = delta > 0;
    const color = isImproved ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-500';

    return (
      <span className={`font-semibold ${color}`}>
        {isImproved && '+'}
        {delta.toFixed(1)}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                스케줄 개선 결과
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {summary.iterations}회 반복 최적화 완료 ({summary.processingTime}ms)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'summary'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            요약
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'metrics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            메트릭 분석
          </button>
          <button
            onClick={() => setActiveTab('changes')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'changes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            변경 사항 ({changes.length})
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'recommendations'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            추천
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 요약 탭 */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* 등급 변화 */}
              <div className="flex items-center justify-center gap-4 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl">
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    개선 전
                  </div>
                  <div
                    className={`text-3xl font-bold px-6 py-3 rounded-lg ${getGradeColor(
                      summary.gradeChange.from
                    )}`}
                  >
                    {summary.gradeChange.from}
                  </div>
                </div>

                <ArrowRight className="w-8 h-8 text-gray-400" />

                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    개선 후
                  </div>
                  <div
                    className={`text-3xl font-bold px-6 py-3 rounded-lg ${getGradeColor(
                      summary.gradeChange.to
                    )}`}
                  >
                    {summary.gradeChange.to}
                  </div>
                </div>

                {summary.gradeChange.improved && (
                  <div className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="w-6 h-6" />
                    <span className="font-semibold">
                      {summary.totalImprovement.toFixed(1)}점 향상
                    </span>
                  </div>
                )}
              </div>

              {/* 핵심 지표 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    공정성
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {metrics.after.fairness.score.toFixed(0)}
                    </span>
                    {renderMetricChange(
                      metrics.before.fairness.score,
                      metrics.after.fairness.score
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    효율성
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {metrics.after.efficiency.score.toFixed(0)}
                    </span>
                    {renderMetricChange(
                      metrics.before.efficiency.score,
                      metrics.after.efficiency.score
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    만족도
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {metrics.after.satisfaction.score.toFixed(0)}
                    </span>
                    {renderMetricChange(
                      metrics.before.satisfaction.score,
                      metrics.after.satisfaction.score
                    )}
                  </div>
                </div>
              </div>

              {/* 핵심 개선 사항 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  핵심 개선 사항
                </h3>
                <div className="space-y-2">
                  {metrics.improvements.fairness.keyImprovements.map(
                    (improvement, idx) => (
                      <div
                        key={`fairness-${idx}`}
                        className="flex items-start gap-2 text-sm"
                      >
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">
                          {improvement}
                        </span>
                      </div>
                    )
                  )}
                  {metrics.improvements.efficiency.keyImprovements.map(
                    (improvement, idx) => (
                      <div
                        key={`efficiency-${idx}`}
                        className="flex items-start gap-2 text-sm"
                      >
                        <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">
                          {improvement}
                        </span>
                      </div>
                    )
                  )}
                  {metrics.improvements.satisfaction.keyImprovements.map(
                    (improvement, idx) => (
                      <div
                        key={`satisfaction-${idx}`}
                        className="flex items-start gap-2 text-sm"
                      >
                        <CheckCircle className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">
                          {improvement}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 메트릭 분석 탭 */}
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              {/* 공정성 분석 */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-green-600" />
                  공정성 분석
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Gini 계수
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {metrics.before.fairness.details.giniCoefficient.toFixed(
                          3
                        )}
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-green-600">
                        {metrics.after.fairness.details.giniCoefficient.toFixed(
                          3
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      근무일수 범위
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {metrics.before.fairness.details.workloadRange.min}-
                        {metrics.before.fairness.details.workloadRange.max}일
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-green-600">
                        {metrics.after.fairness.details.workloadRange.min}-
                        {metrics.after.fairness.details.workloadRange.max}일
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      문제 직원 수
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {metrics.before.fairness.details.problemEmployees.length}명
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-green-600">
                        {metrics.after.fairness.details.problemEmployees.length}명
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 효율성 분석 */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  효율성 분석
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      인력 부족 일수
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {metrics.before.efficiency.details.stats.understaffedDays}일
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-blue-600">
                        {metrics.after.efficiency.details.stats.understaffedDays}일
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      과잉 인력 일수
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {metrics.before.efficiency.details.stats.overstaffedDays}일
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-blue-600">
                        {metrics.after.efficiency.details.stats.overstaffedDays}일
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      최적 인력 일수
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {metrics.before.efficiency.details.stats.optimalDays}일
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-blue-600">
                        {metrics.after.efficiency.details.stats.optimalDays}일
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 만족도 분석 */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                  만족도 분석
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      만족률
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {metrics.before.satisfaction.details.satisfactionRate.toFixed(
                          1
                        )}
                        %
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-purple-600">
                        {metrics.after.satisfaction.details.satisfactionRate.toFixed(
                          1
                        )}
                        %
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      선호도 위반 건수
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {metrics.before.satisfaction.details.violations.length}건
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-purple-600">
                        {metrics.after.satisfaction.details.violations.length}건
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 변경 사항 탭 */}
          {activeTab === 'changes' && (
            <div className="space-y-3">
              {changes.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  변경 사항이 없습니다
                </div>
              ) : (
                changes.map((change, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            change.type === 'swap'
                              ? 'bg-blue-100 text-blue-700'
                              : change.type === 'reassign'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {change.type === 'swap'
                            ? '교환'
                            : change.type === 'reassign'
                              ? '재배정'
                              : '추가'}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {change.date}
                        </span>
                      </div>
                      <span className="text-xs text-green-600 font-medium">
                        +{change.impact.total.toFixed(1)}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {change.description}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {change.reason}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 추천 탭 */}
          {activeTab === 'recommendations' && (
            <div className="space-y-3">
              {recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg p-4 ${
                    rec.type === 'excellent'
                      ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                      : rec.type === 'warning'
                        ? 'border-red-200 bg-red-50 dark:bg-red-900/20'
                        : rec.type === 'continue_improving'
                          ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 bg-gray-50 dark:bg-gray-900/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {rec.type === 'excellent' ? (
                      <Award className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : rec.type === 'warning' ? (
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    ) : rec.type === 'continue_improving' ? (
                      <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                    ) : (
                      <Info className="w-5 h-5 text-gray-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div
                        className={`text-sm font-medium mb-1 ${
                          rec.type === 'excellent'
                            ? 'text-green-700'
                            : rec.type === 'warning'
                              ? 'text-red-700'
                              : rec.type === 'continue_improving'
                                ? 'text-blue-700'
                                : 'text-gray-700'
                        }`}
                      >
                        {rec.message}
                      </div>
                      <div className="text-xs text-gray-500">
                        우선순위: {rec.priority === 'high' ? '높음' : rec.priority === 'medium' ? '중간' : '낮음'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Info className="w-4 h-4" />
            <span>개선 사항을 적용하거나 취소할 수 있습니다</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onReject}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={onApply}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              적용
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
