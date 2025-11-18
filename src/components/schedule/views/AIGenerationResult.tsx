import React from 'react';
import { BarChart3, AlertTriangle, Users, CalendarClock, X } from 'lucide-react';
import type { GenerationDiagnostics, PostprocessStats } from '@/lib/types/scheduler';

interface Violation {
  constraintName: string;
  message: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface GenerationResult {
  computationTime: number;
  score: {
    fairness: number;
    preference: number;
    total: number;
    coverage: number;
  };
  violations: Violation[];
  diagnostics?: GenerationDiagnostics;
  postprocess?: PostprocessStats;
}

interface AIGenerationResultProps {
  generationResult: GenerationResult | null;
  onClose: () => void;
}

export const AIGenerationResult = React.memo(function AIGenerationResult({ generationResult, onClose }: AIGenerationResultProps) {
  if (!generationResult) return null;

  const hardViolations = generationResult.violations.filter(v => v.type === 'hard');
  const diagnostics = generationResult.diagnostics;
  const postprocess = generationResult.postprocess ?? generationResult.diagnostics?.postprocess;
  const diagSummaries = [
    {
      label: '필수 인원 부족',
      count: diagnostics?.staffingShortages?.length ?? 0,
      icon: AlertTriangle,
      highlight: 'text-red-600 dark:text-red-400',
    },
    {
      label: '팀 커버리지 부족',
      count: diagnostics?.teamCoverageGaps?.length ?? 0,
      icon: Users,
      highlight: 'text-orange-500 dark:text-orange-300',
    },
    {
      label: '경력 그룹 불균형',
      count: diagnostics?.careerGroupCoverageGaps?.length ?? 0,
      icon: Users,
      highlight: 'text-blue-600 dark:text-blue-300',
    },
    {
      label: '팀 근무 편차',
      count: diagnostics?.teamWorkloadGaps?.length ?? 0,
      icon: Users,
      highlight: 'text-cyan-600 dark:text-cyan-300',
    },
    {
      label: '특별 요청 미충족',
      count: diagnostics?.specialRequestMisses?.length ?? 0,
      icon: CalendarClock,
      highlight: 'text-purple-600 dark:text-purple-300',
    },
    {
      label: '휴무 편차 초과',
      count: diagnostics?.offBalanceGaps?.length ?? 0,
      icon: Users,
      highlight: 'text-teal-600 dark:text-teal-300',
    },
    {
      label: '연속 시프트 위반',
      count: diagnostics?.shiftPatternBreaks?.length ?? 0,
      icon: AlertTriangle,
      highlight: 'text-rose-500 dark:text-rose-300',
    },
    {
      label: '기피 패턴 위반',
      count: diagnostics?.avoidPatternViolations?.length ?? 0,
      icon: AlertTriangle,
      highlight: 'text-yellow-600 dark:text-yellow-300',
    },
  ];
  const hasDiagnostics =
    diagSummaries.some((summary) => summary.count > 0) || (diagnostics?.preflightIssues?.length ?? 0) > 0;

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-xl border border-purple-100 dark:border-purple-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">AI 스케줄 생성 완료</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              처리 시간: {generationResult.computationTime}ms |
              공정성 점수: {generationResult.score.fairness}점 |
              선호도 만족: {generationResult.score.preference}점 |
              제약 위반: {hardViolations.length}건
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {hardViolations.length > 0 && (
        <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
          <p className="text-xs font-medium text-red-700 dark:text-red-400">경고: 하드 제약조건 위반이 있습니다</p>
          {hardViolations
            .slice(0, 3)
            .map((v, i) => (
              <p key={i} className="text-xs text-red-600 dark:text-red-400 mt-1">• {v.message}</p>
            ))
          }
        </div>
      )}

      {hasDiagnostics && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {diagSummaries
            .filter((summary) => summary.count > 0)
            .map((summary) => (
              <div key={summary.label} className="bg-white/80 dark:bg-gray-900/40 rounded-lg p-3 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <summary.icon className={`w-4 h-4 ${summary.highlight}`} />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{summary.label}</span>
                </div>
                <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {summary.count}건
                </div>
              </div>
            ))}
          {(diagnostics?.preflightIssues?.length ?? 0) > 0 && (
            <div className="bg-white/80 dark:bg-gray-900/40 rounded-lg p-3 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">사전 감지 이슈</span>
              </div>
              <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {diagnostics?.preflightIssues?.length ?? 0}건
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                일부 제약은 근본적으로 충족하기 어렵습니다.
              </p>
            </div>
          )}
          {postprocess && (
            <div className="bg-white/80 dark:bg-gray-900/40 rounded-lg p-3 border border-gray-100 dark:border-gray-800 col-span-1 sm:col-span-2 lg:col-span-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">CSP 후처리 통계</span>
              </div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-gray-700 dark:text-gray-300">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">반복 횟수</p>
                  <p className="font-semibold">{postprocess.iterations ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">개선 수</p>
                  <p className="font-semibold">{postprocess.improvements ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">허용된 worse move</p>
                  <p className="font-semibold">{postprocess.acceptedWorse ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">최종 Penalty</p>
                  <p className="font-semibold">
                    {postprocess.finalPenalty !== undefined ? Math.round(postprocess.finalPenalty) : '-'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
