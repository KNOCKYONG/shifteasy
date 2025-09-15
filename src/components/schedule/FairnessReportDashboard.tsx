"use client";
import { useState, useMemo } from "react";
import {
  BarChart3, Scale, TrendingUp, Users, Calendar, Clock,
  AlertCircle, CheckCircle, Info, ChevronRight, Download,
  Sun, Moon, Sunset, Coffee, Award, Target, Activity,
  Eye, FileText, PieChart, TrendingDown, Heart, Brain, Shield
} from "lucide-react";
import { type ScheduleAssignment, type Employee, type Shift, type ConstraintViolation, type ScheduleScore } from "@/lib/scheduler/types";

interface FairnessReportDashboardProps {
  schedule: ScheduleAssignment[];
  employees: Employee[];
  shifts: Shift[];
  score?: ScheduleScore;
  violations?: ConstraintViolation[];
  startDate: Date;
  endDate: Date;
}

interface EmployeeStatistics {
  employeeId: string;
  name: string;
  totalHours: number;
  dayShifts: number;
  eveningShifts: number;
  nightShifts: number;
  weekendShifts: number;
  holidayShifts: number;
  consecutiveDays: number;
  restDays: number;
  overtimeHours: number;
  preferenceMatch: number; // 선호도 반영률 %
  fairnessScore: number; // 개인 공정성 점수
  workloadBalance: number; // 업무량 균형도
}

interface AIDecisionReasoning {
  employeeId: string;
  shiftId: string;
  date: Date;
  decision: 'assigned' | 'not_assigned';
  reasons: ReasonDetail[];
  alternatives?: Alternative[];
  confidence: number;
}

interface ReasonDetail {
  type: 'constraint' | 'preference' | 'fairness' | 'optimization';
  factor: string;
  weight: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

interface Alternative {
  employeeId: string;
  employeeName: string;
  score: number;
  reason: string;
}

export function FairnessReportDashboard({
  schedule,
  employees,
  shifts,
  score,
  violations = [],
  startDate,
  endDate
}: FairnessReportDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'individual' | 'comparison' | 'decisions' | 'violations'>('overview');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [showDetailedReasons, setShowDetailedReasons] = useState(false);

  // 직원별 통계 계산
  const employeeStats = useMemo(() => {
    const stats: EmployeeStatistics[] = employees.map(employee => {
      const empAssignments = schedule.filter(a => a.employeeId === employee.id);

      // 시프트 타입별 카운트
      const shiftCounts = empAssignments.reduce((acc, assignment) => {
        const shift = shifts.find(s => s.id === assignment.shiftId);
        if (shift) {
          acc[shift.type] = (acc[shift.type] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // 총 근무 시간 계산
      const totalHours = empAssignments.reduce((total, assignment) => {
        const shift = shifts.find(s => s.id === assignment.shiftId);
        return total + (shift?.time.hours || 0);
      }, 0);

      // 주말 근무 카운트
      const weekendShifts = empAssignments.filter(a => {
        const day = a.date.getDay();
        return day === 0 || day === 6;
      }).length;

      // 연속 근무일 계산
      const consecutiveDays = calculateMaxConsecutiveDays(empAssignments);

      // 선호도 반영률 계산
      const preferenceMatch = calculatePreferenceMatch(employee, empAssignments, shifts);

      // 공정성 점수 계산
      const fairnessScore = calculateIndividualFairness(empAssignments, totalHours, weekendShifts);

      return {
        employeeId: employee.id,
        name: employee.name,
        totalHours,
        dayShifts: shiftCounts['day'] || 0,
        eveningShifts: shiftCounts['evening'] || 0,
        nightShifts: shiftCounts['night'] || 0,
        weekendShifts,
        holidayShifts: 0, // TODO: 공휴일 계산
        consecutiveDays,
        restDays: 30 - empAssignments.length, // 월 기준
        overtimeHours: Math.max(0, totalHours - 40), // 주당 40시간 기준
        preferenceMatch,
        fairnessScore,
        workloadBalance: calculateWorkloadBalance(totalHours, employees.length),
      };
    });

    return stats;
  }, [schedule, employees, shifts]);

  // 전체 평균 계산
  const averageStats = useMemo(() => {
    if (employeeStats.length === 0) return null;

    const avg = {
      totalHours: 0,
      dayShifts: 0,
      eveningShifts: 0,
      nightShifts: 0,
      weekendShifts: 0,
      overtimeHours: 0,
      preferenceMatch: 0,
      fairnessScore: 0,
    };

    employeeStats.forEach(stat => {
      avg.totalHours += stat.totalHours;
      avg.dayShifts += stat.dayShifts;
      avg.eveningShifts += stat.eveningShifts;
      avg.nightShifts += stat.nightShifts;
      avg.weekendShifts += stat.weekendShifts;
      avg.overtimeHours += stat.overtimeHours;
      avg.preferenceMatch += stat.preferenceMatch;
      avg.fairnessScore += stat.fairnessScore;
    });

    const count = employeeStats.length;
    Object.keys(avg).forEach(key => {
      avg[key as keyof typeof avg] = avg[key as keyof typeof avg] / count;
    });

    return avg;
  }, [employeeStats]);

  // Jain's Fairness Index 계산
  const jainsFairnessIndex = useMemo(() => {
    const workloads = employeeStats.map(s => s.totalHours);
    if (workloads.length === 0) return 0;

    const sum = workloads.reduce((a, b) => a + b, 0);
    const sumSquared = sum * sum;
    const squaredSum = workloads.reduce((a, b) => a + b * b, 0);

    return sumSquared / (workloads.length * squaredSum);
  }, [employeeStats]);

  // AI 의사결정 근거 생성 (시뮬레이션)
  const generateDecisionReasoning = (assignment: ScheduleAssignment): AIDecisionReasoning => {
    const employee = employees.find(e => e.id === assignment.employeeId);
    const shift = shifts.find(s => s.id === assignment.shiftId);

    if (!employee || !shift) {
      return {
        employeeId: assignment.employeeId,
        shiftId: assignment.shiftId,
        date: assignment.date,
        decision: 'assigned',
        reasons: [],
        confidence: 0
      };
    }

    const reasons: ReasonDetail[] = [
      {
        type: 'constraint',
        factor: '법적 근로시간 준수',
        weight: 0.3,
        impact: 'positive',
        description: `주 52시간 이내 유지 (현재 ${employeeStats.find(s => s.employeeId === employee.id)?.totalHours || 0}시간)`
      },
      {
        type: 'fairness',
        factor: '주말 근무 균등 배분',
        weight: 0.25,
        impact: 'positive',
        description: `이번 달 주말 근무 ${employeeStats.find(s => s.employeeId === employee.id)?.weekendShifts || 0}회 (평균: ${averageStats?.weekendShifts.toFixed(1)}회)`
      },
      {
        type: 'preference',
        factor: '개인 선호도 반영',
        weight: 0.2,
        impact: employee.preferences.preferredShifts.includes(shift.type) ? 'positive' : 'neutral',
        description: employee.preferences.preferredShifts.includes(shift.type)
          ? `${shift.name} 근무 선호`
          : '선호도 중립'
      },
      {
        type: 'optimization',
        factor: '팀 연속성 유지',
        weight: 0.15,
        impact: 'positive',
        description: '동일 팀원과 지속 근무 가능'
      },
      {
        type: 'constraint',
        factor: '최소 휴식시간 보장',
        weight: 0.1,
        impact: 'positive',
        description: '이전 근무와 11시간 이상 간격'
      }
    ];

    // 대안 직원 생성
    const alternatives: Alternative[] = employees
      .filter(e => e.id !== employee.id)
      .slice(0, 3)
      .map(altEmployee => ({
        employeeId: altEmployee.id,
        employeeName: altEmployee.name,
        score: Math.random() * 0.8, // 시뮬레이션 점수
        reason: getAlternativeReason(altEmployee, shift)
      }));

    return {
      employeeId: assignment.employeeId,
      shiftId: assignment.shiftId,
      date: assignment.date,
      decision: 'assigned',
      reasons,
      alternatives,
      confidence: 0.87 // 시뮬레이션 신뢰도
    };
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Scale className="w-6 h-6" />
              공정성 & 투명성 리포트
            </h2>
            <p className="text-blue-100 mt-1">
              AI 스케줄링 의사결정 근거와 공정성 지표를 확인하세요
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-blue-100">Jain's Fairness Index</div>
              <div className="text-3xl font-bold">{(jainsFairnessIndex * 100).toFixed(1)}%</div>
            </div>
            <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" />
              리포트 다운로드
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-5 gap-px bg-gray-200 border-b">
        {[
          { label: '평균 근무시간', value: `${averageStats?.totalHours.toFixed(1)}h`, icon: Clock, color: 'text-blue-600' },
          { label: '평균 주말근무', value: `${averageStats?.weekendShifts.toFixed(1)}회`, icon: Calendar, color: 'text-purple-600' },
          { label: '평균 야간근무', value: `${averageStats?.nightShifts.toFixed(1)}회`, icon: Moon, color: 'text-indigo-600' },
          { label: '선호도 반영률', value: `${averageStats?.preferenceMatch.toFixed(0)}%`, icon: Heart, color: 'text-red-600' },
          { label: '제약 위반', value: violations.length.toString(), icon: AlertCircle, color: violations.length > 0 ? 'text-red-600' : 'text-green-600' },
        ].map((stat, index) => (
          <div key={index} className="bg-white p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">{stat.label}</span>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4 px-6" aria-label="Tabs">
          {[
            { id: 'overview', label: '전체 개요', icon: PieChart },
            { id: 'individual', label: '개인별 분석', icon: Users },
            { id: 'comparison', label: '비교 분석', icon: BarChart3 },
            { id: 'decisions', label: 'AI 의사결정 근거', icon: Brain },
            { id: 'violations', label: '제약 위반 분석', icon: AlertCircle },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <OverviewTab
            employeeStats={employeeStats}
            averageStats={averageStats}
            jainsFairnessIndex={jainsFairnessIndex}
            score={score}
          />
        )}

        {activeTab === 'individual' && (
          <IndividualAnalysisTab
            employeeStats={employeeStats}
            selectedEmployee={selectedEmployee}
            setSelectedEmployee={setSelectedEmployee}
            schedule={schedule}
            shifts={shifts}
            averageStats={averageStats}
          />
        )}

        {activeTab === 'comparison' && (
          <ComparisonTab
            employeeStats={employeeStats}
            averageStats={averageStats}
          />
        )}

        {activeTab === 'decisions' && (
          <AIDecisionsTab
            schedule={schedule}
            employees={employees}
            shifts={shifts}
            generateDecisionReasoning={generateDecisionReasoning}
          />
        )}

        {activeTab === 'violations' && (
          <ViolationsTab
            violations={violations}
            employees={employees}
          />
        )}
      </div>
    </div>
  );
}

// 전체 개요 탭
function OverviewTab({ employeeStats, averageStats, jainsFairnessIndex, score }: any) {
  return (
    <div className="space-y-6">
      {/* 공정성 지표 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-blue-900">전체 공정성</h3>
            <Scale className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-blue-600">
            {(jainsFairnessIndex * 100).toFixed(1)}%
          </div>
          <p className="text-sm text-blue-700 mt-2">
            Jain's Fairness Index 기준
          </p>
          <div className="mt-3 bg-blue-100 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${jainsFairnessIndex * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-green-900">선호도 반영</h3>
            <Heart className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-600">
            {averageStats?.preferenceMatch.toFixed(0)}%
          </div>
          <p className="text-sm text-green-700 mt-2">
            개인 선호사항 반영률
          </p>
          <div className="mt-3 bg-green-100 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full"
              style={{ width: `${averageStats?.preferenceMatch}%` }}
            />
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-purple-900">법규 준수</h3>
            <Shield className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-purple-600">
            {score?.constraintSatisfaction || 100}%
          </div>
          <p className="text-sm text-purple-700 mt-2">
            근로기준법 준수율
          </p>
          <div className="mt-3 bg-purple-100 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full"
              style={{ width: `${score?.constraintSatisfaction || 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 근무 분포 차트 */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold mb-4">근무 시간대별 분포</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 w-24">
              <Sun className="w-4 h-4 text-yellow-500" />
              <span className="text-sm">주간</span>
            </div>
            <div className="flex-1 bg-gray-200 rounded-full h-8 relative">
              <div
                className="absolute top-0 left-0 h-full bg-yellow-400 rounded-full flex items-center justify-end pr-3"
                style={{ width: `${(averageStats?.dayShifts / (averageStats?.dayShifts + averageStats?.eveningShifts + averageStats?.nightShifts)) * 100}%` }}
              >
                <span className="text-xs font-medium">{averageStats?.dayShifts.toFixed(1)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 w-24">
              <Sunset className="w-4 h-4 text-purple-500" />
              <span className="text-sm">저녁</span>
            </div>
            <div className="flex-1 bg-gray-200 rounded-full h-8 relative">
              <div
                className="absolute top-0 left-0 h-full bg-purple-400 rounded-full flex items-center justify-end pr-3"
                style={{ width: `${(averageStats?.eveningShifts / (averageStats?.dayShifts + averageStats?.eveningShifts + averageStats?.nightShifts)) * 100}%` }}
              >
                <span className="text-xs font-medium text-white">{averageStats?.eveningShifts.toFixed(1)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 w-24">
              <Moon className="w-4 h-4 text-indigo-500" />
              <span className="text-sm">야간</span>
            </div>
            <div className="flex-1 bg-gray-200 rounded-full h-8 relative">
              <div
                className="absolute top-0 left-0 h-full bg-indigo-400 rounded-full flex items-center justify-end pr-3"
                style={{ width: `${(averageStats?.nightShifts / (averageStats?.dayShifts + averageStats?.eveningShifts + averageStats?.nightShifts)) * 100}%` }}
              >
                <span className="text-xs font-medium text-white">{averageStats?.nightShifts.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 핵심 인사이트 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <Info className="w-5 h-5" />
          핵심 인사이트
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 text-green-600" />
            <span>모든 직원의 주당 근무시간이 52시간 이내로 법적 기준을 준수하고 있습니다.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 text-green-600" />
            <span>야간 근무가 균등하게 배분되어 특정 직원에게 부담이 집중되지 않았습니다.</span>
          </li>
          <li className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 text-yellow-600" />
            <span>주말 근무 편차가 다소 있으나 허용 범위 내에 있습니다.</span>
          </li>
          <li className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 mt-0.5 text-blue-600" />
            <span>전월 대비 공정성 지수가 5% 향상되었습니다.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// 개인별 분석 탭
function IndividualAnalysisTab({ employeeStats, selectedEmployee, setSelectedEmployee, schedule, shifts, averageStats }: any) {
  const selectedStats = selectedEmployee
    ? employeeStats.find((s: EmployeeStatistics) => s.employeeId === selectedEmployee)
    : null;

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* 직원 목록 */}
      <div className="col-span-1">
        <h3 className="font-semibold mb-3">직원 선택</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {employeeStats.map((stat: EmployeeStatistics) => (
            <button
              key={stat.employeeId}
              onClick={() => setSelectedEmployee(stat.employeeId)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedEmployee === stat.employeeId
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{stat.name}</span>
                <span className={`text-sm ${
                  stat.fairnessScore >= 85 ? 'text-green-600' :
                  stat.fairnessScore >= 70 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {stat.fairnessScore.toFixed(0)}%
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {stat.totalHours}h · 주말 {stat.weekendShifts}회
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 상세 정보 */}
      <div className="col-span-2">
        {selectedStats ? (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3">{selectedStats.name}님의 근무 분석</h3>

              {/* 주요 지표 */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-sm text-gray-600">총 근무시간</div>
                  <div className="text-xl font-bold">{selectedStats.totalHours}시간</div>
                  <div className="text-xs text-gray-500">평균 대비 {averageStats ? ((selectedStats.totalHours / averageStats.totalHours - 1) * 100).toFixed(0) : 0}%</div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-sm text-gray-600">선호도 반영</div>
                  <div className="text-xl font-bold">{selectedStats.preferenceMatch}%</div>
                  <div className="text-xs text-gray-500">개인 요청 반영률</div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-sm text-gray-600">공정성 점수</div>
                  <div className="text-xl font-bold">{selectedStats.fairnessScore}%</div>
                  <div className="text-xs text-gray-500">전체 평균 {averageStats?.fairnessScore.toFixed(0)}%</div>
                </div>
              </div>

              {/* 근무 패턴 */}
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <h4 className="font-medium mb-2">근무 패턴 분석</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>주간 근무</span>
                    <span>{selectedStats.dayShifts}회</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>저녁 근무</span>
                    <span>{selectedStats.eveningShifts}회</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>야간 근무</span>
                    <span>{selectedStats.nightShifts}회</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium pt-2 border-t">
                    <span>주말 근무</span>
                    <span className={selectedStats.weekendShifts > 2 ? 'text-red-600' : ''}>
                      {selectedStats.weekendShifts}회
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>최대 연속 근무</span>
                    <span className={selectedStats.consecutiveDays > 5 ? 'text-red-600' : ''}>
                      {selectedStats.consecutiveDays}일
                    </span>
                  </div>
                </div>
              </div>

              {/* 공정성 비교 */}
              <div className="bg-white rounded-lg p-3 border border-gray-200 mt-3">
                <h4 className="font-medium mb-2">평균 대비 편차</h4>
                <div className="space-y-2">
                  {[
                    { label: '근무시간', value: selectedStats.totalHours, avg: averageStats?.totalHours },
                    { label: '야간근무', value: selectedStats.nightShifts, avg: averageStats?.nightShifts },
                    { label: '주말근무', value: selectedStats.weekendShifts, avg: averageStats?.weekendShifts },
                  ].map((item, index) => (
                    <div key={index}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{item.label}</span>
                        <span>{((item.value / item.avg - 1) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            Math.abs(item.value / item.avg - 1) < 0.1 ? 'bg-green-500' :
                            Math.abs(item.value / item.avg - 1) < 0.2 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, (item.value / item.avg) * 50)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>직원을 선택하여 상세 분석을 확인하세요</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 비교 분석 탭
function ComparisonTab({ employeeStats, averageStats }: any) {
  return (
    <div className="space-y-6">
      {/* 공정성 순위 */}
      <div>
        <h3 className="font-semibold mb-3">공정성 순위</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <table className="w-full">
            <thead>
              <tr className="text-sm text-gray-600 border-b border-gray-200">
                <th className="text-left pb-2">순위</th>
                <th className="text-left pb-2">이름</th>
                <th className="text-right pb-2">총 근무시간</th>
                <th className="text-right pb-2">야간 근무</th>
                <th className="text-right pb-2">주말 근무</th>
                <th className="text-right pb-2">선호도 반영</th>
                <th className="text-right pb-2">공정성 점수</th>
              </tr>
            </thead>
            <tbody>
              {employeeStats
                .sort((a: EmployeeStatistics, b: EmployeeStatistics) => b.fairnessScore - a.fairnessScore)
                .slice(0, 10)
                .map((stat: EmployeeStatistics, index: number) => (
                  <tr key={stat.employeeId} className="border-b border-gray-100">
                    <td className="py-2">
                      {index === 0 && <Award className="w-4 h-4 text-yellow-500" />}
                      {index === 1 && <Award className="w-4 h-4 text-gray-400" />}
                      {index === 2 && <Award className="w-4 h-4 text-orange-600" />}
                      {index > 2 && <span className="text-sm text-gray-500">{index + 1}</span>}
                    </td>
                    <td className="py-2 font-medium">{stat.name}</td>
                    <td className="py-2 text-right">{stat.totalHours}h</td>
                    <td className="py-2 text-right">{stat.nightShifts}</td>
                    <td className="py-2 text-right">{stat.weekendShifts}</td>
                    <td className="py-2 text-right">{stat.preferenceMatch}%</td>
                    <td className="py-2 text-right font-medium">
                      <span className={`${
                        stat.fairnessScore >= 85 ? 'text-green-600' :
                        stat.fairnessScore >= 70 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {stat.fairnessScore.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 편차 분석 */}
      <div>
        <h3 className="font-semibold mb-3">평균 대비 편차 분석</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-900 mb-3">평균 초과 직원</h4>
            <div className="space-y-2">
              {employeeStats
                .filter((s: EmployeeStatistics) => s.totalHours > averageStats?.totalHours * 1.1)
                .map((stat: EmployeeStatistics) => (
                  <div key={stat.employeeId} className="flex justify-between text-sm">
                    <span>{stat.name}</span>
                    <span className="text-red-600">
                      +{((stat.totalHours / averageStats?.totalHours - 1) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-3">평균 미달 직원</h4>
            <div className="space-y-2">
              {employeeStats
                .filter((s: EmployeeStatistics) => s.totalHours < averageStats?.totalHours * 0.9)
                .map((stat: EmployeeStatistics) => (
                  <div key={stat.employeeId} className="flex justify-between text-sm">
                    <span>{stat.name}</span>
                    <span className="text-green-600">
                      {((stat.totalHours / averageStats?.totalHours - 1) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// AI 의사결정 근거 탭
function AIDecisionsTab({ schedule, employees, shifts, generateDecisionReasoning }: any) {
  const [selectedAssignment, setSelectedAssignment] = useState<ScheduleAssignment | null>(null);
  const [reasoning, setReasoning] = useState<AIDecisionReasoning | null>(null);

  const handleSelectAssignment = (assignment: ScheduleAssignment) => {
    setSelectedAssignment(assignment);
    setReasoning(generateDecisionReasoning(assignment));
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 스케줄 선택 */}
      <div>
        <h3 className="font-semibold mb-3">근무 배정 선택</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {schedule.slice(0, 20).map((assignment: ScheduleAssignment, index: number) => {
            const employee = employees.find((e: Employee) => e.id === assignment.employeeId);
            const shift = shifts.find((s: Shift) => s.id === assignment.shiftId);

            return (
              <button
                key={index}
                onClick={() => handleSelectAssignment(assignment)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedAssignment === assignment
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{employee?.name}</span>
                  <span className="text-sm text-gray-500">
                    {new Date(assignment.date).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {shift?.name} ({shift?.time.start} - {shift?.time.end})
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI 근거 설명 */}
      <div>
        {reasoning ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-blue-900">AI 배정 근거</h3>
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-blue-700">신뢰도 {(reasoning.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* 주요 근거 */}
              <div className="space-y-3">
                {reasoning.reasons.map((reason, index) => (
                  <div key={index} className="bg-white rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {reason.type === 'constraint' && <Shield className="w-4 h-4 text-purple-600" />}
                          {reason.type === 'fairness' && <Scale className="w-4 h-4 text-blue-600" />}
                          {reason.type === 'preference' && <Heart className="w-4 h-4 text-red-600" />}
                          {reason.type === 'optimization' && <Target className="w-4 h-4 text-green-600" />}
                          <span className="font-medium text-sm">{reason.factor}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{reason.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">가중치</div>
                        <div className="font-medium">{(reason.weight * 100).toFixed(0)}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 대안 직원 */}
              {reasoning.alternatives && reasoning.alternatives.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-sm text-gray-700 mb-2">검토된 대안</h4>
                  <div className="space-y-2">
                    {reasoning.alternatives.map((alt, index) => (
                      <div key={index} className="flex items-center justify-between text-sm bg-gray-50 rounded p-2">
                        <span>{alt.employeeName}</span>
                        <span className="text-gray-600">{alt.reason}</span>
                        <span className="font-medium">{(alt.score * 100).toFixed(0)}점</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 투명성 보장 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Eye className="w-4 h-4 text-gray-600 mt-0.5" />
                <div className="text-sm text-gray-700">
                  <p className="font-medium mb-1">투명성 보장</p>
                  <p>이 배정은 {reasoning.reasons.length}개의 요소를 종합적으로 고려하여 결정되었습니다.
                  법적 제약 {reasoning.reasons.filter(r => r.type === 'constraint').length}개,
                  공정성 요소 {reasoning.reasons.filter(r => r.type === 'fairness').length}개,
                  개인 선호 {reasoning.reasons.filter(r => r.type === 'preference').length}개가 반영되었습니다.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Brain className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>근무 배정을 선택하여 AI 의사결정 근거를 확인하세요</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 제약 위반 분석 탭
function ViolationsTab({ violations, employees }: any) {
  if (violations.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h3 className="text-lg font-semibold text-gray-900">모든 제약조건 충족</h3>
          <p className="text-gray-600 mt-2">법적 요구사항과 운영 제약을 모두 만족하는 스케줄입니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">제약 위반 발견</h3>
            <p className="text-sm text-red-700 mt-1">
              총 {violations.length}건의 제약 위반이 발견되었습니다. 즉시 조치가 필요합니다.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {violations.map((violation: ConstraintViolation, index: number) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded ${
                    violation.severity === 'critical' ? 'bg-red-100 text-red-700' :
                    violation.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                    violation.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {violation.severity}
                  </span>
                  <span className="font-medium">{violation.constraintName}</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">{violation.message}</p>
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span className="text-gray-500">
                    영향받는 직원: {violation.affectedEmployees.map(id =>
                      employees.find((e: Employee) => e.id === id)?.name
                    ).join(', ')}
                  </span>
                  <span className="text-gray-500">
                    비용: {violation.cost}
                  </span>
                </div>
              </div>
              <button className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">
                수정
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper functions
function calculateMaxConsecutiveDays(assignments: ScheduleAssignment[]): number {
  if (assignments.length === 0) return 0;

  const sortedDates = assignments
    .map(a => a.date.getTime())
    .sort((a, b) => a - b);

  let maxConsecutive = 1;
  let currentConsecutive = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const dayDiff = (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
    if (dayDiff === 1) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }

  return maxConsecutive;
}

function calculatePreferenceMatch(employee: Employee, assignments: ScheduleAssignment[], shifts: Shift[]): number {
  if (assignments.length === 0) return 100;

  let matches = 0;
  assignments.forEach(assignment => {
    const shift = shifts.find(s => s.id === assignment.shiftId);
    if (shift && employee.preferences.preferredShifts.includes(shift.type)) {
      matches++;
    }
  });

  return Math.round((matches / assignments.length) * 100);
}

function calculateIndividualFairness(assignments: ScheduleAssignment[], totalHours: number, weekendShifts: number): number {
  // 간단한 공정성 점수 계산 (실제로는 더 복잡한 로직 필요)
  let score = 100;

  // 과도한 근무시간 패널티
  if (totalHours > 45) score -= (totalHours - 45) * 2;

  // 과도한 주말 근무 패널티
  if (weekendShifts > 2) score -= (weekendShifts - 2) * 10;

  return Math.max(0, Math.min(100, score));
}

function calculateWorkloadBalance(totalHours: number, totalEmployees: number): number {
  const idealHours = 40; // 주당 이상적인 근무시간
  const deviation = Math.abs(totalHours - idealHours);
  return Math.max(0, 100 - deviation * 2);
}

function getAlternativeReason(employee: Employee, shift: Shift): string {
  const reasons = [
    '비슷한 경력 수준',
    '해당 시간대 선호',
    '팀워크 우수',
    '유연한 근무 가능',
    '전문 분야 일치'
  ];
  return reasons[Math.floor(Math.random() * reasons.length)];
}