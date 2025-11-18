import React from 'react';
import { FileText, X, Clock, RefreshCcw, AlertTriangle, Users, Award } from 'lucide-react';
import type {
  GenerationDiagnostics,
  StaffingShortageInfo,
  TeamCoverageGapInfo,
  CareerGroupCoverageGapInfo,
  SpecialRequestMissInfo,
  OffBalanceGapInfo,
  ShiftPatternBreakInfo,
  PostprocessStats,
  TeamWorkloadGapInfo,
  AvoidPatternViolationInfo,
} from '@/lib/types/scheduler';

interface ScoreBreakdown {
  category: string;
  details: string;
  score: number;
}

interface Violation {
  constraintName: string;
  message: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedEmployees: string[];
}

interface Suggestion {
  description: string;
  impact: string;
  priority: 'high' | 'medium' | 'low';
}

interface GenerationResult {
  score: {
    total: number;
    fairness: number;
    preference: number;
    coverage: number;
    breakdown: ScoreBreakdown[];
  };
  violations: Violation[];
  suggestions?: Suggestion[];
  computationTime: number;
  iterations: number;
  diagnostics?: GenerationDiagnostics;
  postprocess?: PostprocessStats;
}

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  generationResult: GenerationResult | null;
}

const renderShortageLine = (shortage: StaffingShortageInfo) =>
  `${shortage.date} ${shortage.shiftType} - 필요 ${shortage.required}명, 실제 ${shortage.covered}명`;

const renderTeamGapLine = (gap: TeamCoverageGapInfo) =>
  `${gap.date} ${gap.shiftType} - ${gap.teamId}팀 부족 (${gap.shortage}명)`;

const renderCareerGapLine = (gap: CareerGroupCoverageGapInfo) =>
  `${gap.date} ${gap.shiftType} - 경력 그룹 ${gap.careerGroupAlias} 부족 (${gap.shortage}명)`;

const renderSpecialRequestLine = (miss: SpecialRequestMissInfo) =>
  `${miss.date} ${miss.employeeId} → ${miss.shiftType}`;

const renderOffBalanceLine = (gap: OffBalanceGapInfo) =>
  `${gap.teamId}팀 ${gap.employeeA}/${gap.employeeB} 휴무 차이 ${gap.difference}일 (허용 ${gap.tolerance}일)`;

const renderShiftBreakLine = (issue: ShiftPatternBreakInfo) =>
  `${issue.employeeId} - ${issue.shiftType} ${issue.startDate} 시작 ${issue.window}일 창 내 초과 ${issue.excess}일`;

const renderTeamWorkloadLine = (gap: TeamWorkloadGapInfo) =>
  `${gap.teamA} vs ${gap.teamB} 근무일 차이 ${gap.difference}일 (허용 ${gap.tolerance}일)`;

const renderAvoidPatternLine = (issue: AvoidPatternViolationInfo) =>
  `${issue.employeeId} - ${issue.startDate}부터 ${issue.pattern.join(' → ')} 패턴 반복`;

const describePreflightIssue = (issue: Record<string, unknown>) => {
  const type = typeof issue.type === 'string' ? issue.type : 'unknown';
  if (type === 'insufficientPotentialStaff') {
    return `${issue.date} ${issue.shiftType}: 공급 < 수요 (${issue.available}/${issue.required})`;
  }
  if (type === 'teamCoverageImpossible') {
    return `${issue.date} ${issue.shiftType}: ${issue.teamId}팀 인원 없음`;
  }
  if (type === 'careerGroupCoverageImpossible') {
    return `${issue.date} ${issue.shiftType}: 경력 그룹 ${issue.careerGroupAlias} 배치 불가`;
  }
  if (type === 'specialRequestPatternConflict') {
    return `${issue.date} ${issue.employeeId}: 패턴상 ${issue.requestedShift} 불가`;
  }
  return type;
};

export function ReportModal({
  isOpen,
  onClose,
  generationResult,
}: ReportModalProps) {
  if (!isOpen || !generationResult) return null;
  const postprocess = generationResult.postprocess ?? generationResult.diagnostics?.postprocess;

  return (
    <div className="fixed inset-0 bg-gray-900/50 dark:bg-gray-950/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              스케줄링 상세 리포트
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {/* 전체 성과 요약 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              📊 전체 스케줄링 성과
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {generationResult.score.total}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">전체 점수</div>
              </div>
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {generationResult.score.fairness}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">공정성</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {generationResult.score.preference}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">선호도 반영</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {generationResult.score.coverage}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">커버리지</div>
              </div>
            </div>
          </div>

          {/* 선호도 반영 상세 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              💡 선호도 반영 내역
            </h3>
            <div className="space-y-3">
              {generationResult.score.breakdown
                .filter(item => item.category === 'preference')
                .map((item, idx) => (
                  <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {item.details}
                      </span>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">
                        {item.score}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {item.score >= 80
                        ? "✅ 선호도가 잘 반영되었습니다"
                        : item.score >= 60
                        ? "⚠️ 부분적으로 반영되었습니다"
                        : "❌ 다른 제약조건으로 인해 반영이 제한되었습니다"}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* 제약조건 준수 현황 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              ⚖️ 제약조건 준수 현황
            </h3>
            <div className="space-y-3">
              {generationResult.violations.length === 0 ? (
                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">모든 제약조건이 준수되었습니다!</span>
                  </div>
                </div>
              ) : (
                generationResult.violations.map((violation, idx) => (
                  <div key={idx} className={`rounded-lg p-4 ${
                    violation.severity === 'critical'
                      ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
                      : violation.severity === 'high'
                      ? 'bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800'
                      : 'bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800'
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {violation.constraintName}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        violation.severity === 'critical'
                          ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                          : violation.severity === 'high'
                          ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300'
                          : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                      }`}>
                        {violation.severity === 'critical' ? '심각' : violation.severity === 'high' ? '높음' : '보통'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {violation.message}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      <span className="font-medium">이유:</span>{' '}
                      {violation.type === 'hard'
                        ? "필수 제약조건으로 반드시 준수해야 하나, 직원 부족으로 인해 불가피하게 위반되었습니다."
                        : "소프트 제약조건으로 가능한 준수하려 했으나, 더 중요한 제약조건과의 충돌로 위반되었습니다."}
                    </div>
                    {violation.affectedEmployees.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                        <span className="font-medium">영향받은 직원:</span>{' '}
                        {violation.affectedEmployees.slice(0, 3).join(', ')}
                        {violation.affectedEmployees.length > 3 && ` 외 ${violation.affectedEmployees.length - 3}명`}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Diagnostics */}
          {generationResult.diagnostics && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                🔍 제약 진단 요약
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generationResult.diagnostics.staffingShortages && generationResult.diagnostics.staffingShortages.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-4 border border-red-100 dark:border-red-900/60">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      필수 인원 부족 {generationResult.diagnostics.staffingShortages.length}건
                    </p>
                    <div className="space-y-1 text-xs text-red-700 dark:text-red-200">
                      {generationResult.diagnostics.staffingShortages.slice(0, 4).map((shortage, idx) => (
                        <p key={`${shortage.date}-${shortage.shiftType}-${idx}`}>• {renderShortageLine(shortage)}</p>
                      ))}
                      {generationResult.diagnostics.staffingShortages.length > 4 && (
                        <p className="italic">… 추가 {generationResult.diagnostics.staffingShortages.length - 4}건</p>
                      )}
                    </div>
                  </div>
                )}

                {generationResult.diagnostics.teamCoverageGaps && generationResult.diagnostics.teamCoverageGaps.length > 0 && (
                  <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-4 border border-orange-100 dark:border-orange-900/60">
                    <p className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      팀 커버리지 부족 {generationResult.diagnostics.teamCoverageGaps.length}건
                    </p>
                    <div className="space-y-1 text-xs text-orange-700 dark:text-orange-200">
                      {generationResult.diagnostics.teamCoverageGaps.slice(0, 4).map((gap, idx) => (
                        <p key={`${gap.date}-${gap.teamId}-${gap.shiftType}-${idx}`}>• {renderTeamGapLine(gap)}</p>
                      ))}
                      {generationResult.diagnostics.teamCoverageGaps.length > 4 && (
                        <p className="italic">… 추가 {generationResult.diagnostics.teamCoverageGaps.length - 4}건</p>
                      )}
                    </div>
                  </div>
                )}

                {generationResult.diagnostics.careerGroupCoverageGaps && generationResult.diagnostics.careerGroupCoverageGaps.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-100 dark:border-blue-900/60">
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      경력 그룹 커버리지 부족 {generationResult.diagnostics.careerGroupCoverageGaps.length}건
                    </p>
                    <div className="space-y-1 text-xs text-blue-700 dark:text-blue-200">
                      {generationResult.diagnostics.careerGroupCoverageGaps.slice(0, 4).map((gap, idx) => (
                        <p key={`${gap.date}-${gap.careerGroupAlias}-${gap.shiftType}-${idx}`}>• {renderCareerGapLine(gap)}</p>
                      ))}
                      {generationResult.diagnostics.careerGroupCoverageGaps.length > 4 && (
                        <p className="italic">… 추가 {generationResult.diagnostics.careerGroupCoverageGaps.length - 4}건</p>
                      )}
                    </div>
                  </div>
                )}

                {generationResult.diagnostics.teamWorkloadGaps && generationResult.diagnostics.teamWorkloadGaps.length > 0 && (
                  <div className="bg-cyan-50 dark:bg-cyan-950/30 rounded-lg p-4 border border-cyan-100 dark:border-cyan-900/60">
                    <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      팀 근무 편차 {generationResult.diagnostics.teamWorkloadGaps.length}건
                    </p>
                    <div className="space-y-1 text-xs text-cyan-700 dark:text-cyan-200">
                      {generationResult.diagnostics.teamWorkloadGaps.slice(0, 4).map((gap, idx) => (
                        <p key={`team-workload-${idx}`}>• {renderTeamWorkloadLine(gap)}</p>
                      ))}
                      {generationResult.diagnostics.teamWorkloadGaps.length > 4 && (
                        <p className="italic">… 추가 {generationResult.diagnostics.teamWorkloadGaps.length - 4}건</p>
                      )}
                    </div>
                  </div>
                )}

                {generationResult.diagnostics.specialRequestMisses && generationResult.diagnostics.specialRequestMisses.length > 0 && (
                  <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 border border-purple-100 dark:border-purple-900/60">
                    <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      특별 요청 미충족 {generationResult.diagnostics.specialRequestMisses.length}건
                    </p>
                    <div className="space-y-1 text-xs text-purple-700 dark:text-purple-200">
                      {generationResult.diagnostics.specialRequestMisses.slice(0, 4).map((miss, idx) => (
                        <p key={`${miss.date}-${miss.employeeId}-${idx}`}>• {renderSpecialRequestLine(miss)}</p>
                      ))}
                      {generationResult.diagnostics.specialRequestMisses.length > 4 && (
                        <p className="italic">… 추가 {generationResult.diagnostics.specialRequestMisses.length - 4}건</p>
                      )}
                    </div>
                  </div>
                )}

                {generationResult.diagnostics.offBalanceGaps && generationResult.diagnostics.offBalanceGaps.length > 0 && (
                  <div className="bg-teal-50 dark:bg-teal-950/30 rounded-lg p-4 border border-teal-100 dark:border-teal-900/60">
                    <p className="text-sm font-semibold text-teal-700 dark:text-teal-300 mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      팀 휴무 편차 초과 {generationResult.diagnostics.offBalanceGaps.length}건
                    </p>
                    <div className="space-y-1 text-xs text-teal-700 dark:text-teal-200">
                      {generationResult.diagnostics.offBalanceGaps.slice(0, 4).map((gap, idx) => (
                        <p key={`off-balance-${idx}`}>• {renderOffBalanceLine(gap)}</p>
                      ))}
                      {generationResult.diagnostics.offBalanceGaps.length > 4 && (
                        <p className="italic">… 추가 {generationResult.diagnostics.offBalanceGaps.length - 4}건</p>
                      )}
                    </div>
                  </div>
                )}

                {generationResult.diagnostics.shiftPatternBreaks && generationResult.diagnostics.shiftPatternBreaks.length > 0 && (
                  <div className="bg-rose-50 dark:bg-rose-950/30 rounded-lg p-4 border border-rose-100 dark:border-rose-900/60">
                    <p className="text-sm font-semibold text-rose-700 dark:text-rose-300 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      연속 시프트 위반 {generationResult.diagnostics.shiftPatternBreaks.length}건
                    </p>
                    <div className="space-y-1 text-xs text-rose-700 dark:text-rose-200">
                      {generationResult.diagnostics.shiftPatternBreaks.slice(0, 4).map((issue, idx) => (
                        <p key={`shift-break-${idx}`}>• {renderShiftBreakLine(issue)}</p>
                      ))}
                      {generationResult.diagnostics.shiftPatternBreaks.length > 4 && (
                        <p className="italic">… 추가 {generationResult.diagnostics.shiftPatternBreaks.length - 4}건</p>
                      )}
                    </div>
                  </div>
                )}

                {generationResult.diagnostics.avoidPatternViolations && generationResult.diagnostics.avoidPatternViolations.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 border border-amber-100 dark:border-amber-900/60">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      기피 패턴 위반 {generationResult.diagnostics.avoidPatternViolations.length}건
                    </p>
                    <div className="space-y-1 text-xs text-amber-700 dark:text-amber-200">
                      {generationResult.diagnostics.avoidPatternViolations.slice(0, 4).map((issue, idx) => (
                        <p key={`avoid-pattern-${idx}`}>• {renderAvoidPatternLine(issue)}</p>
                      ))}
                      {generationResult.diagnostics.avoidPatternViolations.length > 4 && (
                        <p className="italic">… 추가 {generationResult.diagnostics.avoidPatternViolations.length - 4}건</p>
                      )}
                    </div>
                  </div>
                )}

                {generationResult.diagnostics.preflightIssues && generationResult.diagnostics.preflightIssues.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-800 md:col-span-2">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      사전 감지 이슈 {generationResult.diagnostics.preflightIssues.length}건
                    </p>
                    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                      {generationResult.diagnostics.preflightIssues.slice(0, 5).map((issue, idx) => (
                        <p key={`preflight-${idx}`}>• {describePreflightIssue(issue)}</p>
                      ))}
                      {generationResult.diagnostics.preflightIssues.length > 5 && (
                        <p className="italic">… 추가 {generationResult.diagnostics.preflightIssues.length - 5}건</p>
                      )}
                    </div>
                  </div>
                )}

                {postprocess && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-100 dark:border-blue-900/60 md:col-span-2">
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      CSP 후처리 요약
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-blue-800 dark:text-blue-200">
                      <div>
                        <p className="text-blue-600 dark:text-blue-400">반복 횟수</p>
                        <p className="text-base font-semibold">{postprocess.iterations ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-blue-600 dark:text-blue-400">개선 수</p>
                        <p className="text-base font-semibold">{postprocess.improvements ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-blue-600 dark:text-blue-400">허용된 worse move</p>
                        <p className="text-base font-semibold">{postprocess.acceptedWorse ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-blue-600 dark:text-blue-400">최종 Penalty</p>
                        <p className="text-base font-semibold">
                          {postprocess.finalPenalty !== undefined ? Math.round(postprocess.finalPenalty) : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 공정성 분석 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              🤝 공정성 분석
            </h3>
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                  <div className="flex justify-between">
                    <span>주간/야간 근무 분배</span>
                    <span className="font-medium">
                      {generationResult.score.fairness >= 80 ? '균등' : '불균등'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>주말 근무 분배</span>
                    <span className="font-medium">
                      {generationResult.score.fairness >= 75 ? '공평' : '개선 필요'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>총 근무시간 편차</span>
                    <span className="font-medium">
                      {generationResult.score.fairness >= 85 ? '적정' : '편차 존재'}
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  공정성 지수는 Jain&apos;s Fairness Index를 기반으로 계산되었으며,
                  모든 직원의 근무 부담이 얼마나 균등하게 분배되었는지를 나타냅니다.
                </div>
              </div>
            </div>
          </div>

          {/* 개선 제안 */}
          {generationResult.suggestions && generationResult.suggestions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                💭 개선 제안사항
              </h3>
              <div className="space-y-3">
                {generationResult.suggestions.map((suggestion, idx) => (
                  <div key={idx} className={`rounded-lg p-4 ${
                    suggestion.priority === 'high'
                      ? 'bg-red-50 dark:bg-red-950/30'
                      : suggestion.priority === 'medium'
                      ? 'bg-yellow-50 dark:bg-yellow-950/30'
                      : 'bg-blue-50 dark:bg-blue-950/30'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`px-2 py-1 text-xs font-medium rounded ${
                        suggestion.priority === 'high'
                          ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                          : suggestion.priority === 'medium'
                          ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                          : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      }`}>
                        {suggestion.priority === 'high' ? '높음' : suggestion.priority === 'medium' ? '중간' : '낮음'}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {suggestion.description}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {suggestion.impact}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 계산 정보 */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-3 h-3" />
                계산 시간: {generationResult.computationTime}ms
              </div>
              <div className="flex items-center gap-2">
                <RefreshCcw className="w-3 h-3" />
                반복 횟수: {generationResult.iterations}회
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
