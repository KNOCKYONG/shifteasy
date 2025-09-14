"use client";
import { useState, useEffect } from "react";
import { format, startOfWeek, addWeeks, subWeeks, addDays } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Users, Download, Lock, Unlock, Wand2, RefreshCw, X, BarChart3 } from "lucide-react";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { mockTeamMembers } from "@/lib/mock/team-members";
import { Scheduler, type SchedulingRequest, type SchedulingResult } from "@/lib/scheduler/core";
import { type Employee, type Shift, type Constraint, type ScheduleAssignment } from "@/lib/scheduler/types";
import { EmployeeAdapter } from "@/lib/adapters/employee-adapter";
import type { ComprehensivePreferences } from "@/components/team/MyPreferencesPanel";
import type { UnifiedEmployee } from "@/lib/types/unified-employee";
import { validateSchedulingRequest, validateEmployee } from "@/lib/validation/schemas";

// 기본 시프트 정의
const DEFAULT_SHIFTS: Shift[] = [
  {
    id: 'shift-day',
    type: 'day',
    name: '주간',
    time: { start: '07:00', end: '15:00', hours: 8 },
    color: '#3B82F6',
    requiredStaff: 5,
    minStaff: 4,
    maxStaff: 6,
  },
  {
    id: 'shift-evening',
    type: 'evening',
    name: '저녁',
    time: { start: '15:00', end: '23:00', hours: 8 },
    color: '#8B5CF6',
    requiredStaff: 4,
    minStaff: 3,
    maxStaff: 5,
  },
  {
    id: 'shift-night',
    type: 'night',
    name: '야간',
    time: { start: '23:00', end: '07:00', hours: 8 },
    color: '#6366F1',
    requiredStaff: 3,
    minStaff: 2,
    maxStaff: 4,
  },
];

// 기본 제약조건
const DEFAULT_CONSTRAINTS: Constraint[] = [
  {
    id: 'legal-max-hours-week',
    name: '주 최대 근로시간',
    type: 'hard',
    category: 'legal',
    weight: 1.0,
    active: true,
  },
  {
    id: 'legal-max-consecutive-days',
    name: '최대 연속 근무일',
    type: 'hard',
    category: 'legal',
    weight: 1.0,
    active: true,
  },
  {
    id: 'legal-min-rest-hours',
    name: '최소 휴식시간',
    type: 'hard',
    category: 'legal',
    weight: 1.0,
    active: true,
  },
  {
    id: 'preferred-shift',
    name: '선호 시프트',
    type: 'soft',
    category: 'preference',
    weight: 0.5,
    active: true,
  },
  {
    id: 'weekend-fairness',
    name: '주말 근무 공정성',
    type: 'soft',
    category: 'fairness',
    weight: 0.7,
    active: true,
  },
];

export default function SchedulePage() {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [schedule, setSchedule] = useState<ScheduleAssignment[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<SchedulingResult | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedShiftTypes, setSelectedShiftTypes] = useState<Set<string>>(new Set());
  const [showOnlyOvertime, setShowOnlyOvertime] = useState(false); // 초과근무 직원만 표시
  const [showOnlyConflicts, setShowOnlyConflicts] = useState(false); // 제약 위반 직원만 표시

  // 부서별 필터링
  const departments = [
    { id: 'all', name: '전체' },
    { id: 'dept-er', name: '응급실' },
    { id: 'dept-icu', name: '중환자실' },
    { id: 'dept-or', name: '수술실' },
    { id: 'dept-ward', name: '일반병동' },
  ];

  // 선택된 부서의 직원들만 필터링
  const filteredMembers = selectedDepartment === 'all'
    ? mockTeamMembers.filter(m => m.status === 'active')
    : mockTeamMembers.filter(m => m.status === 'active' && m.departmentId === selectedDepartment);

  const handlePreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1));
    setSchedule([]);
    setGenerationResult(null);
  };

  const handleNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1));
    setSchedule([]);
    setGenerationResult(null);
  };

  const handleToday = () => {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
    setSchedule([]);
    setGenerationResult(null);
  };

  // 시프트 타입 필터 토글
  const toggleShiftType = (shiftType: string) => {
    const newSelection = new Set(selectedShiftTypes);
    if (newSelection.has(shiftType)) {
      newSelection.delete(shiftType);
    } else {
      newSelection.add(shiftType);
    }
    setSelectedShiftTypes(newSelection);
  };

  // 직원별 주간 근무시간 계산
  const calculateWeeklyHours = (employeeId: string) => {
    let totalHours = 0;
    schedule.forEach(assignment => {
      if (assignment.employeeId === employeeId) {
        const shift = DEFAULT_SHIFTS.find(s => s.id === assignment.shiftId);
        if (shift) {
          totalHours += shift.time.hours;
        }
      }
    });
    return totalHours;
  };

  // 제약 위반 확인
  const hasViolations = (employeeId: string) => {
    if (!generationResult) return false;
    return generationResult.violations.some(v =>
      v.message?.includes(employeeId) ||
      (v as any).employeeId === employeeId
    );
  };

  // 시프트 타입별로 필터링된 직원 목록
  const getFilteredMembersForDisplay = () => {
    let result = filteredMembers;

    // 시프트 타입 필터
    if (selectedShiftTypes.size > 0) {
      // Off (휴무) 필터가 선택된 경우 특별 처리
      if (selectedShiftTypes.has('off')) {
        // 이번 주에 한 번도 배정이 없는 직원들 찾기
        const membersWithAnyShift = new Set<string>();
        schedule.forEach(assignment => {
          membersWithAnyShift.add(assignment.employeeId);
        });

        const membersOnlyOff = filteredMembers.filter(member => !membersWithAnyShift.has(member.id));

        // 다른 시프트 타입도 선택된 경우
        if (selectedShiftTypes.size > 1) {
          const membersWithSelectedShifts = new Set<string>(membersOnlyOff.map(m => m.id));

          schedule.forEach(assignment => {
            const shift = DEFAULT_SHIFTS.find(s => s.id === assignment.shiftId);
            if (shift && selectedShiftTypes.has(shift.type)) {
              membersWithSelectedShifts.add(assignment.employeeId);
            }
          });

          result = filteredMembers.filter(member => membersWithSelectedShifts.has(member.id));
        } else {
          result = membersOnlyOff;
        }
      } else {
        // 선택된 시프트 타입에 해당하는 배정이 있는 직원만 표시
        const membersWithSelectedShifts = new Set<string>();
        schedule.forEach(assignment => {
          const shift = DEFAULT_SHIFTS.find(s => s.id === assignment.shiftId);
          if (shift && selectedShiftTypes.has(shift.type)) {
            membersWithSelectedShifts.add(assignment.employeeId);
          }
        });

        result = result.filter(member => membersWithSelectedShifts.has(member.id));
      }
    }

    // 초과근무 필터 (주 40시간 초과)
    if (showOnlyOvertime) {
      result = result.filter(member => calculateWeeklyHours(member.id) > 40);
    }

    // 제약 위반 필터
    if (showOnlyConflicts) {
      result = result.filter(member => hasViolations(member.id));
    }

    return result;
  };

  const displayMembers = getFilteredMembersForDisplay();

  const handleGenerateSchedule = async () => {
    if (filteredMembers.length === 0) {
      alert('선택된 부서에 활성 직원이 없습니다.');
      return;
    }

    setIsGenerating(true);
    setGenerationResult(null);

    try {
      // 1. 모든 직원의 선호도 가져오기
      const preferencesResponse = await fetch('/api/preferences');
      const preferencesData = await preferencesResponse.json();
      const preferencesMap = new Map<string, ComprehensivePreferences>();

      if (preferencesData.success && preferencesData.data) {
        Object.entries(preferencesData.data).forEach(([employeeId, prefs]) => {
          preferencesMap.set(employeeId, prefs as ComprehensivePreferences);
        });
      }

      console.log(`Loaded preferences for ${preferencesMap.size} employees`);

      // 2. MockTeamMember를 UnifiedEmployee로 변환
      const unifiedEmployees: UnifiedEmployee[] = filteredMembers.map(member => {
        const comprehensivePrefs = preferencesMap.get(member.id);
        return EmployeeAdapter.fromMockToUnified(member, comprehensivePrefs);
      });

      // 3. UnifiedEmployee를 스케줄러용 Employee로 변환 및 검증
      const employees: Employee[] = [];
      const validationErrors: string[] = [];

      for (const unified of unifiedEmployees) {
        const employee = EmployeeAdapter.toSchedulerEmployee(unified);
        const validation = validateEmployee(employee);

        if (validation.success) {
          employees.push(employee);
        } else {
          validationErrors.push(`${unified.name}: ${validation.errors?.join(', ')}`);
        }
      }

      if (validationErrors.length > 0) {
        console.error('Employee validation errors:', validationErrors);
        alert(`일부 직원 데이터에 문제가 있습니다:\n${validationErrors.slice(0, 3).join('\n')}`);
      }

      // 4. 스케줄링 요청 생성 (미사용 필드 활용)
      const request: SchedulingRequest = {
        departmentId: selectedDepartment === 'all' ? 'all-departments' : selectedDepartment,
        startDate: currentWeek,
        endDate: addDays(currentWeek, 6),
        employees,
        shifts: DEFAULT_SHIFTS.map(shift => ({
          ...shift,
          // breakMinutes 필드 활성화
          time: {
            ...shift.time,
            breakMinutes: shift.type === 'night' ? 30 : 15, // 야간은 30분, 주간/저녁은 15분 휴식
          },
        })),
        constraints: DEFAULT_CONSTRAINTS,
        optimizationGoal: 'balanced',
      };

      // 5. 스케줄 생성
      const scheduler = new Scheduler();
      const result = await scheduler.createSchedule(request);

      if (result.success && result.schedule) {
        setSchedule(result.schedule.assignments);
        setGenerationResult(result);

        // 6. 생성 결과 로깅
        console.log('Schedule generated successfully:', {
          assignments: result.schedule.assignments.length,
          score: result.score,
          violations: result.violations.length,
          preferencesSatisfied: result.score.preference,
        });
      } else {
        alert('스케줄 생성에 실패했습니다. 제약조건을 확인해주세요.');
      }
    } catch (error) {
      console.error('Schedule generation error:', error);
      alert('스케줄 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmToggle = () => {
    if (!isConfirmed && schedule.length === 0) {
      alert('확정할 스케줄이 없습니다.');
      return;
    }
    setIsConfirmed(!isConfirmed);
  };

  const handleExport = () => {
    const exportData = {
      week: format(currentWeek, "yyyy-MM-dd"),
      department: selectedDepartment,
      assignments: schedule,
      result: generationResult,
      confirmed: isConfirmed,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schedule-${format(currentWeek, "yyyy-MM-dd")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 날짜별 스케줄 그룹화
  const getScheduleForDay = (date: Date) => {
    return schedule.filter(assignment =>
      format(assignment.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  };

  // 시프트별 색상 가져오기
  const getShiftColor = (shiftId: string) => {
    const shift = DEFAULT_SHIFTS.find(s => s.id === shiftId);
    return shift?.color || '#9CA3AF';
  };

  // 시프트 이름 가져오기
  const getShiftName = (shiftId: string) => {
    const shift = DEFAULT_SHIFTS.find(s => s.id === shiftId);
    return shift?.name || '?';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                ShiftEasy
              </span>
              <nav className="flex items-center gap-6">
                <a href="/dashboard" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  대시보드
                </a>
                <a href="/schedule" className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  스케줄
                </a>
                <a href="/swap" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  스왑
                </a>
                <a href="/team" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  팀 관리
                </a>
                <a href="/config" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  설정
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerateSchedule}
                disabled={isGenerating}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg ${
                  isGenerating
                    ? "text-gray-400 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                    : "text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
                }`}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    AI 스케줄 생성
                  </>
                )}
              </button>

              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Download className="w-4 h-4" />
                내보내기
              </button>

              <button
                onClick={handleConfirmToggle}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg ${
                  isConfirmed
                    ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/50"
                    : "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50"
                }`}
              >
                {isConfirmed ? (
                  <>
                    <Lock className="w-4 h-4" />
                    확정됨
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    스케줄 확정
                  </>
                )}
              </button>

              <ProfileDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Shift Type Filters */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">근무 필터:</span>
          <button
            onClick={() => toggleShiftType('day')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              selectedShiftTypes.has('day')
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            주간 (Day)
          </button>
          <button
            onClick={() => toggleShiftType('evening')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              selectedShiftTypes.has('evening')
                ? 'bg-purple-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            저녁 (Evening)
          </button>
          <button
            onClick={() => toggleShiftType('night')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              selectedShiftTypes.has('night')
                ? 'bg-indigo-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            야간 (Night)
          </button>
          <button
            onClick={() => toggleShiftType('off')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              selectedShiftTypes.has('off')
                ? 'bg-gray-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            휴무 (Off)
          </button>
          {selectedShiftTypes.size > 0 && (
            <button
              onClick={() => setSelectedShiftTypes(new Set())}
              className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
            >
              필터 초기화
            </button>
          )}
        </div>

        {/* Additional Filters */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">추가 필터:</span>
          <button
            onClick={() => setShowOnlyOvertime(!showOnlyOvertime)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              showOnlyOvertime
                ? 'bg-orange-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            초과근무 (40시간+)
          </button>
          <button
            onClick={() => setShowOnlyConflicts(!showOnlyConflicts)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              showOnlyConflicts
                ? 'bg-red-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            제약 위반
          </button>
        </div>

        {/* Week Navigation & Department Filter */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousWeek}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                오늘
              </button>
              <button
                onClick={handleNextWeek}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {format(currentWeek, "yyyy년 M월 d일", { locale: ko })} 주
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setSchedule([]);
                setGenerationResult(null);
              }}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100"
            >
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {displayMembers.length}명 {selectedShiftTypes.size > 0 && `(전체: ${filteredMembers.length}명)`}
            </span>
          </div>
        </div>

        {/* AI Generation Result */}
        {generationResult && (
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
                    제약 위반: {generationResult.violations.filter(v => v.type === 'hard').length}건
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGenerationResult(null)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {generationResult.violations.filter(v => v.type === 'hard').length > 0 && (
              <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <p className="text-xs font-medium text-red-700 dark:text-red-400">경고: 하드 제약조건 위반이 있습니다</p>
                {generationResult.violations
                  .filter(v => v.type === 'hard')
                  .slice(0, 3)
                  .map((v, i) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400 mt-1">• {v.message}</p>
                  ))
                }
              </div>
            )}
          </div>
        )}

        {/* Schedule Grid */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 font-medium text-sm text-gray-700 dark:text-gray-300">직원</div>
            {[...Array(7)].map((_, i) => {
              const date = addDays(currentWeek, i);
              return (
                <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 text-center border-l border-gray-200 dark:border-gray-700">
                  <div className="font-medium text-sm text-gray-700 dark:text-gray-300">
                    {format(date, 'EEE', { locale: ko })}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {format(date, 'M/d')}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {displayMembers.map(member => (
              <div key={member.id} className="grid grid-cols-8 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="p-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                    {member.name.slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{member.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{member.position}</div>
                  </div>
                  {schedule.length > 0 && (
                    <div className="flex flex-col items-end gap-1">
                      {(() => {
                        const hours = calculateWeeklyHours(member.id);
                        return hours > 0 && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              hours > 40
                                ? 'bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {hours}시간
                          </span>
                        );
                      })()}
                      {hasViolations(member.id) && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400">
                          위반
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {[...Array(7)].map((_, dayIndex) => {
                  const date = addDays(currentWeek, dayIndex);
                  const dayAssignments = getScheduleForDay(date).filter(a => a.employeeId === member.id);

                  return (
                    <div key={dayIndex} className="p-2 border-l border-gray-100 dark:border-gray-800">
                      {dayAssignments.map((assignment, i) => (
                        <div
                          key={i}
                          className="mb-1 px-2 py-1 rounded text-xs font-medium text-white text-center"
                          style={{ backgroundColor: getShiftColor(assignment.shiftId) }}
                        >
                          {getShiftName(assignment.shiftId)}
                        </div>
                      ))}
                      {dayAssignments.length === 0 && (
                        <div className="px-2 py-1 rounded text-xs text-gray-400 dark:text-gray-500 text-center bg-gray-50 dark:bg-gray-800">
                          휴무
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {displayMembers.length === 0 && (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  {selectedShiftTypes.size > 0
                    ? '선택된 시프트 타입에 해당하는 직원이 없습니다'
                    : '선택된 부서에 활성 직원이 없습니다'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        {schedule.length > 0 && (
          <div className="mt-6 grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">총 배정</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{schedule.length}</p>
                </div>
                <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              </div>
            </div>

            {DEFAULT_SHIFTS.map(shift => {
              const count = schedule.filter(a => a.shiftId === shift.id).length;
              return (
                <div key={shift.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{shift.name}</p>
                      <p className="text-2xl font-semibold" style={{ color: shift.color }}>
                        {count}
                      </p>
                    </div>
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: shift.color }}
                    >
                      {shift.type[0].toUpperCase()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}