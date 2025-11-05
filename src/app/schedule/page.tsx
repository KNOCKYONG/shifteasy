"use client";
import React, { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, startOfWeek, endOfWeek, isWeekend } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Users, Download, Upload, Lock, Unlock, Wand2, RefreshCcw, X, BarChart3, FileText, Clock, Heart, AlertCircle, ListChecks, Edit3, FileSpreadsheet, Package, FileUp, CheckCircle, Zap, MoreVertical, Settings, FolderOpen, ArrowLeftRight, Save } from "lucide-react";
import { MainLayout } from "../../components/layout/MainLayout";
import { SimpleScheduler, type Employee as SimpleEmployee, type Holiday, type SpecialRequest as SimpleSpecialRequest, type ScheduleAssignment as SimpleAssignment } from "../../lib/scheduler/simple-scheduler";
import { api } from "../../lib/trpc/client";
import { type Employee, type Shift, type Constraint, type ScheduleAssignment, type SchedulingResult } from "../../lib/scheduler/types";
import { EmployeeAdapter } from "../../lib/adapters/employee-adapter";
import type { UnifiedEmployee } from "@/lib/types/unified-employee";
import { validateSchedulingRequest, validateEmployee } from "@/lib/validation/schemas";
import { EmployeePreferencesModal, type ExtendedEmployeePreferences } from "@/components/schedule/EmployeePreferencesModal";
import { type ComprehensivePreferences } from "@/components/team/MyPreferencesPanel";
import { toEmployee } from "@/lib/utils/employee-converter";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ImportModal } from "@/components/schedule/modals/ImportModal";
import { ExportModal } from "@/components/schedule/modals/ExportModal";
import { ValidationResultsModal } from "@/components/schedule/modals/ValidationResultsModal";
import { ConfirmationDialog } from "@/components/schedule/modals/ConfirmationDialog";
import { ReportModal } from "@/components/schedule/modals/ReportModal";
import { ManageSchedulesModal } from "@/components/schedule/modals/ManageSchedulesModal";
import { SwapRequestModal } from "@/components/schedule/modals/SwapRequestModal";
import {
  ViewTabs,
  ShiftTypeFilters,
  ViewToggles,
  StaffPreferencesGrid,
  MonthNavigation,
  AIGenerationResult,
  ScheduleGridView,
  ScheduleCalendarView,
  ScheduleStats
} from "@/components/schedule/views";
import { TeamFilter } from "@/components/schedule/views/TeamFilter";
import { TodayScheduleBoard } from "@/components/schedule/TodayScheduleBoard";
import { convertShiftTypesToShifts, type ShiftType } from "@/lib/utils/shift-utils";
import { normalizeDate } from "@/lib/utils/date-utils";
import { useScheduleModals } from "@/hooks/useScheduleModals";
import { useScheduleFilters } from "@/hooks/useScheduleFilters";

// 스케줄 페이지에서 사용하는 확장된 ScheduleAssignment 타입
interface ExtendedScheduleAssignment extends ScheduleAssignment {
  shiftType?: 'day' | 'evening' | 'night' | 'off' | 'leave' | 'custom';
  isRequested?: boolean; // 직원이 요청한 근무인지 표시
}

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

/**
 * 선호 시프트와 휴무일을 기반으로 맞춤 패턴 생성
 * @param preferredShift 선호하는 근무 시간 (1개)
 * @param preferredDaysOff 선호하는 휴무일 (예: [4, 5] = 목금)
 * @returns 생성된 패턴 문자열 (예: "N-N-N-OFF-OFF")
 */
function generateCustomPatternFromPreferences(
  preferredShift: 'day' | 'evening' | 'night',
  preferredDaysOff: number[]
): string {
  // 시프트 타입 매핑
  const shiftMap = {
    day: 'D',
    evening: 'E',
    night: 'N'
  };

  // 선호 휴무일이 없으면 기본 주말 (토일)
  const offDays = preferredDaysOff.length > 0 ? preferredDaysOff : [0, 6];

  // 7일 주기 패턴 생성
  const weekPattern: string[] = [];

  // 휴무일이 아닌 날에 근무 배치
  const nonOffDays = [0, 1, 2, 3, 4, 5, 6].filter(day => !offDays.includes(day));

  // 선호 시프트로 대부분 채우기
  const preferredShiftCode = shiftMap[preferredShift];

  for (let day = 0; day < 7; day++) {
    if (offDays.includes(day)) {
      weekPattern.push('OFF');
    } else {
      weekPattern.push(preferredShiftCode);
    }
  }

  return weekPattern.join('-');
}

/**
 * 선호 시프트에 1.2 비중을 적용하여 월간 시프트 배분 계산
 * @param preferredShift 선호하는 근무 시간
 * @param totalWorkDays 총 근무일 수
 * @returns 각 시프트 타입별 일수 { day: number, evening: number, night: number }
 */
function calculateShiftDistribution(
  preferredShift: 'day' | 'evening' | 'night',
  totalWorkDays: number
): { day: number; evening: number; night: number } {
  const preferenceWeight = 1.2;

  // 기본 배분 (균등)
  const baseAllocation = totalWorkDays / 3;

  // 선호 시프트에 1.2 배 적용
  const preferredAllocation = Math.round(baseAllocation * preferenceWeight);

  // 나머지를 다른 시프트에 균등 배분
  const remainingDays = totalWorkDays - preferredAllocation;
  const otherAllocation = Math.floor(remainingDays / 2);
  const lastAllocation = remainingDays - otherAllocation; // 나머지 처리

  const distribution = {
    day: preferredShift === 'day' ? preferredAllocation : (preferredShift === 'evening' ? otherAllocation : lastAllocation),
    evening: preferredShift === 'evening' ? preferredAllocation : (preferredShift === 'night' ? otherAllocation : lastAllocation),
    night: preferredShift === 'night' ? preferredAllocation : (preferredShift === 'day' ? otherAllocation : lastAllocation)
  };

  return distribution;
}

/**
 * 나이트 집중 근무 후 유급 휴가 추가
 * @param schedule 생성된 스케줄 배열
 * @param employees UnifiedEmployee 배열
 * @param paidLeaveDaysPerMonth 월별 유급 휴가 일수
 */
function addNightIntensivePaidLeave(
  schedule: ExtendedScheduleAssignment[],
  employees: UnifiedEmployee[],
  paidLeaveDaysPerMonth: number
): void {
  if (paidLeaveDaysPerMonth === 0) return;

  console.log('\n💼 === 나이트 집중 근무 유급 휴가 적용 ===');
  console.log(`   설정: 월 ${paidLeaveDaysPerMonth}일 유급 휴가`);

  // 야간 근무를 선호하는 직원들 식별
  const nightIntensiveEmployees = employees.filter(emp => {
    const preferredShift = emp.comprehensivePreferences?.workPreferences?.preferredShifts?.[0];
    return preferredShift === 'night';
  });

  console.log(`   대상 직원: ${nightIntensiveEmployees.length}명`);

  nightIntensiveEmployees.forEach(employee => {
    // 해당 직원의 스케줄만 필터링
    const employeeSchedule = schedule
      .filter(s => s.employeeId === employee.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 야간 근무 연속 기간 찾기
    const nightShiftPeriods: { start: number; end: number; count: number }[] = [];
    let currentPeriodStart = -1;
    let consecutiveNights = 0;

    employeeSchedule.forEach((assignment, index) => {
      if (assignment.shiftType === 'night') {
        if (currentPeriodStart === -1) {
          currentPeriodStart = index;
        }
        consecutiveNights++;
      } else {
        if (consecutiveNights >= 3) { // 3일 이상 연속 야간 근무
          nightShiftPeriods.push({
            start: currentPeriodStart,
            end: index - 1,
            count: consecutiveNights
          });
        }
        currentPeriodStart = -1;
        consecutiveNights = 0;
      }
    });

    // 마지막 기간 처리
    if (consecutiveNights >= 3) {
      nightShiftPeriods.push({
        start: currentPeriodStart,
        end: employeeSchedule.length - 1,
        count: consecutiveNights
      });
    }

    // 가장 긴 야간 근무 기간들 선택 (유급 휴가를 줄 기간)
    const sortedPeriods = nightShiftPeriods.sort((a, b) => b.count - a.count);
    const periodsToReward = sortedPeriods.slice(0, Math.ceil(paidLeaveDaysPerMonth / 2)); // 2일씩 주므로

    console.log(`\n   👤 ${employee.name}:`);
    console.log(`      - 발견된 집중 야간 근무 기간: ${nightShiftPeriods.length}개`);

    let totalPaidLeaveDays = 0;

    periodsToReward.forEach((period, periodIndex) => {
      // 야간 근무 기간 직후에 유급 휴가 추가
      const afterPeriodIndex = period.end + 1;

      // 2일 연속 유급 휴가 (또는 남은 일수만큼)
      const daysToAdd = Math.min(2, paidLeaveDaysPerMonth - totalPaidLeaveDays);

      for (let i = 0; i < daysToAdd && (afterPeriodIndex + i) < employeeSchedule.length; i++) {
        const targetAssignment = employeeSchedule[afterPeriodIndex + i];

        // OFF가 아닌 경우에만 유급 휴가로 변경
        if (targetAssignment.shiftType !== 'off') {
          // 원래 스케줄에서 찾아서 수정
          const scheduleIndex = schedule.findIndex(
            s => s.employeeId === employee.id && s.date === targetAssignment.date
          );

          if (scheduleIndex !== -1) {
            schedule[scheduleIndex] = {
              ...schedule[scheduleIndex],
              shiftType: 'off',
              // 유급 휴가 표시를 위한 메모 추가 (있다면)
            };
            totalPaidLeaveDays++;
          }
        }
      }

      console.log(`      - 기간 ${periodIndex + 1}: ${period.count}일 연속 야간 → ${daysToAdd}일 유급 휴가 부여`);
    });

    console.log(`      - 총 부여된 유급 휴가: ${totalPaidLeaveDays}일`);
  });

  console.log('\n===========================================\n');
}

// Team Pattern을 기반으로 기본 선호도 생성 헬퍼 함수
function createDefaultPreferencesFromTeamPattern(
  member: any,
  teamPattern: any
): ComprehensivePreferences {
  // Team Pattern의 defaultPatterns 분석
  const patterns = teamPattern.defaultPatterns || [];
  const shiftCounts = { D: 0, E: 0, N: 0, OFF: 0 };
  let totalDays = 0;

  // 각 시프트 타입의 빈도 계산
  patterns.forEach((pattern: string[]) => {
    pattern.forEach((shift: string) => {
      if (shift in shiftCounts) {
        shiftCounts[shift as keyof typeof shiftCounts]++;
      }
      totalDays++;
    });
  });

  // preferredShifts는 빈 배열로 시작 - 사용자가 명시적으로 선택하도록 함
  const preferredShifts: ('day' | 'evening' | 'night')[] = [];

  // 연속 근무일 계산 (패턴에서 가장 긴 연속 근무 구간)
  let maxConsecutive = 5; // 기본값
  patterns.forEach((pattern: string[]) => {
    let consecutive = 0;
    let maxInPattern = 0;
    pattern.forEach((shift: string) => {
      if (shift !== 'OFF') {
        consecutive++;
        maxInPattern = Math.max(maxInPattern, consecutive);
      } else {
        consecutive = 0;
      }
    });
    maxConsecutive = Math.max(maxConsecutive, maxInPattern);
  });

  return {
    workPreferences: {
      workPatternType: member.workPatternType || 'three-shift',
      preferredShifts,
      avoidShifts: [],
      maxConsecutiveDays: maxConsecutive,
      minRestDays: 1,
      preferredWorkload: 'moderate',
      weekendPreference: 'neutral',
      holidayPreference: 'neutral',
      overtimeWillingness: 'sometimes',
      offDayPattern: 'flexible',
    },
    personalCircumstances: {
      hasYoungChildren: false,
      isSingleParent: false,
      hasCaregivingResponsibilities: false,
      isStudying: false,
      pregnancyStatus: 'none',
    },
    healthConsiderations: {
      hasChronicCondition: false,
      needsFrequentBreaks: false,
      mobilityRestrictions: false,
      visualImpairment: false,
      hearingImpairment: false,
      mentalHealthSupport: false,
      medicationSchedule: [],
    },
    commutePreferences: {
      commuteTime: 30,
      transportMode: 'car' as const,
      parkingRequired: false,
      nightTransportDifficulty: false,
      weatherSensitive: false,
      needsTransportAssistance: false,
      carpoolInterested: false,
    },
    teamPreferences: {
      preferredPartners: [],
      avoidPartners: [],
      mentorshipRole: 'none',
      languagePreferences: [],
      communicationStyle: 'direct',
      conflictResolution: 'immediate',
    },
    professionalDevelopment: {
      specializations: [],
      certifications: [],
      trainingInterests: [],
      careerGoals: '',
      preferredDepartments: [],
      avoidDepartments: [],
      teachingInterest: false,
      researchInterest: false,
      administrativeInterest: false,
    },
    priorities: {
      workLifeBalance: 5,
      careerGrowth: 5,
      teamHarmony: 5,
      incomeMaximization: 5,
      healthWellbeing: 5,
      familyTime: 5,
    },
    specialRequests: {
      religiousObservances: {
        needed: false,
      },
      culturalConsiderations: '',
      emergencyContact: {
        name: '',
        relationship: '',
        phone: '',
      },
      temporaryRequests: [],
    },
  };
}

export default function SchedulePage() {
  const utils = api.useUtils();
  const currentUser = useCurrentUser();
  const userRole = (currentUser.dbUser?.role ?? currentUser.role) as string | undefined;
  const isMember = userRole === 'member';
  const isManager = userRole === 'manager';
  const memberDepartmentId = currentUser.dbUser?.departmentId ?? null;
  const canManageSchedules = userRole ? ['admin', 'manager', 'owner'].includes(userRole) : false;
  const canViewStaffPreferences = canManageSchedules && !isMember;
  const currentUserId = currentUser.userId || "user-1";
  const currentUserName = currentUser.name || "사용자";

  // Custom hooks for state management
  const filters = useScheduleFilters();
  const modals = useScheduleModals();

  // Core schedule state (not extracted to hooks due to complex interdependencies)
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [schedule, setSchedule] = useState<ScheduleAssignment[]>([]);
  const [originalSchedule, setOriginalSchedule] = useState<ScheduleAssignment[]>([]); // 원본 스케줄 저장
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<SchedulingResult | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [customShiftTypes, setCustomShiftTypes] = useState<ShiftType[]>([]); // Config의 근무 타입 데이터
  const [showMyPreferences, setShowMyPreferences] = useState(false);
  const [loadedScheduleId, setLoadedScheduleId] = useState<string | null>(null); // 이미 로드된 스케줄 ID
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // 오늘의 근무 날짜 선택

  // Employee preferences modal state
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = React.useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    [monthStart, monthEnd]
  );
  const monthlyOvertimeThreshold = React.useMemo(
    () => 40 * (daysInMonth.length / 7),
    [daysInMonth.length]
  );
  const scheduleGridTemplate = React.useMemo(
    () => `120px repeat(${daysInMonth.length}, minmax(35px, 40px))`,
    [daysInMonth.length]
  );

  // Fetch holidays for the calendar view
  const calendarStart = React.useMemo(() => startOfWeek(monthStart, { weekStartsOn: 0 }), [monthStart]);
  const calendarEnd = React.useMemo(() => endOfWeek(monthEnd, { weekStartsOn: 0 }), [monthEnd]);

  const { data: holidays } = api.holidays.getByDateRange.useQuery({
    startDate: format(calendarStart, 'yyyy-MM-dd'),
    endDate: format(calendarEnd, 'yyyy-MM-dd'),
  }, {
    staleTime: 5 * 60 * 1000, // 5분 동안 fresh 유지
    refetchOnWindowFocus: false, // 탭 전환 시 refetch 비활성화
  });

  // Create a Set of holiday dates for quick lookup
  const holidayDates = React.useMemo(() => {
    return new Set(holidays?.map(h => h.date) || []);
  }, [holidays]);

  // ✅ Load saved schedules from DB
  const { data: savedSchedules } = api.schedule.list.useQuery({
    departmentId: (isManager || isMember) && memberDepartmentId ? memberDepartmentId :
                  selectedDepartment !== 'all' && selectedDepartment !== 'no-department' ? selectedDepartment : undefined,
    status: isMember ? 'published' : undefined, // Members only see published, managers/admins see all including drafts
    startDate: monthStart,
    endDate: monthEnd,
  }, {
    staleTime: 2 * 60 * 1000, // 2분 동안 fresh 유지 (스케줄은 자주 변경될 수 있음)
    refetchOnWindowFocus: false, // 탭 전환 시 refetch 비활성화
  });

  // ✅ Track last loaded schedule ID and updatedAt
  const lastLoadedRef = React.useRef<{ id: string; updatedAt: string } | null>(null);
  // ✅ Prevent auto-load after saving
  const skipAutoLoadRef = React.useRef<boolean>(false);

  // ✅ Load schedule from DB when month/department changes OR when schedule is updated (swap)
  useEffect(() => {
    // Skip auto-load if we just saved (to prevent overwriting current edits)
    if (skipAutoLoadRef.current) {
      skipAutoLoadRef.current = false;
      return;
    }

    if (!savedSchedules || savedSchedules.length === 0) {
      // No saved schedule, clear loaded ID
      setLoadedScheduleId(null);
      lastLoadedRef.current = null;
      return;
    }

    // Find the most recent published schedule for this month
    let currentMonthSchedule = savedSchedules
      .filter(s => s.status === 'published')
      .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())[0];

    // If no published schedule found and user can manage schedules, try to load most recent draft
    if (!currentMonthSchedule && canManageSchedules) {
      currentMonthSchedule = savedSchedules
        .filter(s => s.status === 'draft')
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
    }

    if (!currentMonthSchedule) {
      setLoadedScheduleId(null);
      lastLoadedRef.current = null;
      return;
    }

    // ✅ Skip if already loaded this exact version (same ID and updatedAt)
    const currentUpdatedAt = currentMonthSchedule.updatedAt?.toString() || '';
    if (lastLoadedRef.current?.id === currentMonthSchedule.id &&
        lastLoadedRef.current?.updatedAt === currentUpdatedAt) {
      return;
    }

    // Extract assignments from metadata
    const metadata = currentMonthSchedule.metadata as any;
    const assignments = metadata?.assignments || [];

    if (assignments.length > 0) {
      // Convert DB assignments to ScheduleAssignment format
      const convertedAssignments: ScheduleAssignment[] = assignments.map((a: any) => ({
        id: a.id || `${a.employeeId}-${a.date}`,
        employeeId: a.employeeId,
        shiftId: a.shiftId,
        date: new Date(a.date),
        isLocked: a.isLocked || false,
        shiftType: a.shiftType || 'custom',
      }));

      setSchedule(convertedAssignments);
      setOriginalSchedule(convertedAssignments);
      setIsConfirmed(currentMonthSchedule.status === 'published'); // Only confirmed if published
      setLoadedScheduleId(currentMonthSchedule.id);
      lastLoadedRef.current = { id: currentMonthSchedule.id, updatedAt: currentUpdatedAt };
      console.log(`✅ Loaded ${convertedAssignments.length} assignments from ${currentMonthSchedule.status} schedule ${currentMonthSchedule.id} (updated: ${currentMonthSchedule.updatedAt})`);
    }
  }, [savedSchedules, monthStart, canManageSchedules]);

  const currentWeek = monthStart;
  const buildSchedulePayload = () => {
    // ✅ Manager/Member는 항상 실제 departmentId 사용
    let actualDepartmentId: string;

    if ((isManager || isMember) && memberDepartmentId) {
      actualDepartmentId = memberDepartmentId;
    } else if (selectedDepartment === 'all') {
      actualDepartmentId = 'all-departments';
    } else if (selectedDepartment === 'no-department') {
      // 'no-department'는 더미 값이므로 memberDepartmentId 또는 첫 번째 실제 부서 사용
      actualDepartmentId = memberDepartmentId || 'dept-er';
    } else {
      actualDepartmentId = selectedDepartment;
    }

    return {
      id: `schedule-${format(monthStart, 'yyyy-MM')}-${actualDepartmentId}`,
      departmentId: actualDepartmentId,
      startDate: monthStart.toISOString(),
      endDate: monthEnd.toISOString(),
      assignments: schedule.map(assignment => ({
        employeeId: assignment.employeeId,
        shiftId: assignment.shiftId,
        date: normalizeDate(assignment.date).toISOString(),
        isLocked: (assignment as any).isLocked ?? false,
      })),
      status: 'draft' as const,
    };
  };

  const departmentOptions = React.useMemo(() => {
    if (isMember) {
      if (memberDepartmentId) {
        return [{ id: memberDepartmentId, name: '내 병동' }];
      }
      return [{ id: 'no-department', name: '배정된 병동이 없습니다' }];
    }

    return [
      { id: 'all', name: '전체' },
      { id: 'dept-er', name: '응급실' },
      { id: 'dept-icu', name: '중환자실' },
      { id: 'dept-or', name: '수술실' },
      { id: 'dept-ward', name: '일반병동' },
    ];
  }, [isMember, memberDepartmentId]);

  useEffect(() => {
    if (!isMember) {
      return;
    }

    const targetDepartment = memberDepartmentId ?? 'no-department';
    setSelectedDepartment(prev => (prev === targetDepartment ? prev : targetDepartment));
  }, [isMember, memberDepartmentId]);

  // member 권한은 '오늘의 근무' 탭을 기본으로 설정
  useEffect(() => {
    if (isMember && filters.activeView === 'preferences') {
      filters.setActiveView('today');
    } else if (!canViewStaffPreferences && filters.activeView === 'preferences') {
      filters.setActiveView('today');
    }
  }, [isMember, canViewStaffPreferences, filters.activeView, filters.setActiveView]);

  // Load shift types from tenant_configs table
  const { data: shiftTypesConfig } = api.tenantConfigs.getByKey.useQuery({
    configKey: 'shift_types'
  }, {
    staleTime: 0, // 항상 최신 데이터 가져오기
    refetchOnWindowFocus: true, // 탭 전환 시 refetch 활성화
    refetchOnMount: true, // 마운트 시 항상 refetch
  });

  // Load shift config (나이트 집중 근무 유급 휴가 설정 등)
  const { data: shiftConfigData } = api.tenantConfigs.getByKey.useQuery({
    configKey: 'shiftConfig'
  }, {
    staleTime: 10 * 60 * 1000, // 10분 동안 fresh 유지
    refetchOnWindowFocus: false, // 탭 전환 시 refetch 비활성화
  });

  // Fetch teams from database
  const { data: dbTeams = [] } = api.teams.getAll.useQuery(undefined, {
    staleTime: 10 * 60 * 1000, // 10분 동안 fresh 유지
    refetchOnWindowFocus: false, // 탭 전환 시 refetch 비활성화
  });

  useEffect(() => {
    console.log('📥 shiftTypesConfig changed:', shiftTypesConfig);

    if (shiftTypesConfig?.configValue && Array.isArray(shiftTypesConfig.configValue) && shiftTypesConfig.configValue.length > 0) {
      // Transform from tenant_configs format to CustomShiftType format
      const transformedShiftTypes = shiftTypesConfig.configValue.map((st: any) => ({
        code: st.code,
        name: st.name,
        startTime: st.startTime,
        endTime: st.endTime,
        color: st.color,
        allowOvertime: st.allowOvertime ?? false, // Default value for backward compatibility
      }));
      setCustomShiftTypes(transformedShiftTypes);
      console.log('✅ Loaded custom shift types from tenant_configs:', transformedShiftTypes);
      console.log('📊 Total shift types loaded:', transformedShiftTypes.length);
    } else {
      console.log('⚠️ shiftTypesConfig is empty or invalid, trying localStorage');
      // Fallback to localStorage for backward compatibility
      const savedShiftTypes = localStorage.getItem('customShiftTypes');
      if (savedShiftTypes) {
        try {
          const parsed = JSON.parse(savedShiftTypes);
          setCustomShiftTypes(parsed);
          console.log('✅ Loaded custom shift types from localStorage (fallback):', parsed);
        } catch (error) {
          console.error('Failed to load custom shift types:', error);
        }
      } else {
        console.log('❌ No shift types found in localStorage either');
      }
    }
  }, [shiftTypesConfig]);

  // Convert customShiftTypes to Shift[] format
  const shifts = React.useMemo(() => {
    if (customShiftTypes.length > 0) {
      const convertedShifts = convertShiftTypesToShifts(customShiftTypes);
      console.log('🔄 Converted shifts for modal:', convertedShifts);
      return convertedShifts;
    }
    // Fallback to default if not loaded yet
    console.log('⚠️ No custom shift types, returning empty array');
    return [];
  }, [customShiftTypes]);

  // Fetch users from database
  const { data: usersData } = api.tenant.users.list.useQuery(
    {
      limit: 100,
      offset: 0,
      status: 'active',
      // member와 manager는 백엔드에서 자동으로 자신의 department로 필터링됨
      // admin/owner만 departmentId를 명시적으로 전달
      departmentId:
        !isMember && userRole !== 'manager' && selectedDepartment !== 'all' && selectedDepartment !== 'no-department'
          ? selectedDepartment
          : undefined,
    },
    {
      enabled: true,
      staleTime: 3 * 60 * 1000, // 3분 동안 fresh 유지 (사용자 정보는 가끔 변경됨)
      refetchOnWindowFocus: false, // 탭 전환 시 refetch 비활성화
    }
  );

  // Load special requests for the current month
  const { data: specialRequestsData } = api.specialRequests.getByDateRange.useQuery({
    startDate: format(monthStart, 'yyyy-MM-dd'),
    endDate: format(monthEnd, 'yyyy-MM-dd'),
  }, {
    staleTime: 2 * 60 * 1000, // 2분 동안 fresh 유지 (요청은 자주 변경될 수 있음)
    refetchOnWindowFocus: false, // 탭 전환 시 refetch 비활성화
  });

  // Transform users data to match expected format
  // 전체 멤버 리스트 (필터링 없음 - 직원 선호사항 탭에서 사용)
  const allMembers = React.useMemo(() => {
    if (!usersData?.items) return [];

    return (usersData.items as any[]).map((item: any) => ({
      id: item.id,
      employeeId: item.employeeId || '',
      name: item.name,
      email: item.email,
      role: item.role as 'admin' | 'manager' | 'staff',
      departmentId: item.departmentId || '',
      departmentName: item.department?.name || '',
      status: item.status as 'active' | 'inactive' | 'on_leave',
      position: item.position || '',
      joinedAt: item.createdAt?.toISOString() || new Date().toISOString(),
      avatar: '',
      phone: item.profile?.phone || '',
      skills: item.profile?.skills || [],
      teamId: item.teamId || null,
      workSchedule: item.profile?.preferences || {
        preferredShifts: [],
        maxHoursPerWeek: 40,
        minHoursPerWeek: 30,
        availableDays: [1, 2, 3, 4, 5],
        unavailableDates: []
      }
    }));
  }, [usersData]);

  // 필터링된 멤버 리스트 (나의 스케줄만 보기 적용 - 스케줄 보기 탭에서 사용)
  const filteredMembers = React.useMemo(() => {
    let members = [...allMembers];

    // member가 "나의 스케줄만 보기"를 체크한 경우
    if ((isMember || isManager) && filters.showMyScheduleOnly && currentUser.dbUser?.id) {
      members = members.filter(member => member.id === currentUser.dbUser?.id);
    }

    // "나와 같은 스케줄 보기"를 체크한 경우
    if ((isMember || isManager) && filters.showSameSchedule && currentUser.dbUser?.id && schedule.length > 0) {
      // 현재 사용자가 근무하는 날짜들 추출
      const myWorkDates = new Set(
        schedule
          .filter(s => s.employeeId === currentUser.dbUser?.id && s.shiftId !== 'shift-off')
          .map(s => format(new Date(s.date), 'yyyy-MM-dd'))
      );

      // 같은 날짜에 근무하는 직원들만 필터링
      if (myWorkDates.size > 0) {
        members = members.filter(member => {
          if (member.id === currentUser.dbUser?.id) return true; // 본인은 항상 포함

          // 해당 직원이 같은 날짜에 근무하는지 확인
          return schedule.some(s =>
            s.employeeId === member.id &&
            s.shiftId !== 'shift-off' &&
            myWorkDates.has(format(new Date(s.date), 'yyyy-MM-dd'))
          );
        });
      }
    }

    return members;
  }, [allMembers, isMember, isManager, filters.showMyScheduleOnly, filters.showSameSchedule, currentUser.dbUser?.id, schedule]);

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
    setSchedule([]);
    setGenerationResult(null);
    setLoadedScheduleId(null); // ✅ Reset to allow loading new month's schedule
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
    setSchedule([]);
    setGenerationResult(null);
    setLoadedScheduleId(null); // ✅ Reset to allow loading new month's schedule
  };

  const handleThisMonth = () => {
    setCurrentMonth(startOfMonth(new Date()));
    setSchedule([]);
    setGenerationResult(null);
    setLoadedScheduleId(null); // ✅ Reset to allow loading current month's schedule
  };

  // TRPC mutation for saving preferences
  const savePreferences = api.preferences.upsert.useMutation({
    onSuccess: async (data) => {
      console.log('Preferences saved successfully:', data);
      // Invalidate both users and preferences queries
      await utils.tenant.users.list.invalidate();
      await utils.preferences.get.invalidate();
      // TODO: Show success toast
    },
    onError: (error) => {
      console.error('Failed to save preferences:', error);
      // TODO: Show error toast
    },
  });

  // Swap request mutation
  const createSwapRequest = api.swap.create.useMutation({
    onSuccess: () => {
      alert('교환 요청이 성공적으로 생성되었습니다. 관리자의 승인을 기다려주세요.');
      setShowSwapModal(false);
      setSelectedSwapCell(null);
      setTargetSwapCell(null);
      setSwapMode(false);
    },
    onError: (error) => {
      console.error('Swap request failed:', error);
      alert(`교환 요청에 실패했습니다: ${error.message}`);
    },
  });

  // Handle employee card click to open preferences modal
  const handleEmployeeClick = async (member: any) => {
    // 최신 데이터를 직접 가져오기
    const freshUsersData = await utils.tenant.users.list.fetch({
      limit: 100,
      offset: 0,
      status: 'active',
      departmentId:
        !isMember && userRole !== 'manager' && selectedDepartment !== 'all' && selectedDepartment !== 'no-department'
          ? selectedDepartment
          : undefined,
    });

    // 최신 데이터에서 member 찾기
    const latestMemberData = freshUsersData?.items?.find((item: any) => item.id === member.id);
    const latestMember = latestMemberData ? {
      id: latestMemberData.id,
      employeeId: latestMemberData.employeeId || '',
      name: latestMemberData.name,
      email: latestMemberData.email,
      role: latestMemberData.role as 'admin' | 'manager' | 'staff',
      departmentId: latestMemberData.departmentId || '',
      departmentName: latestMemberData.department?.name || '',
      status: latestMemberData.status as 'active' | 'inactive' | 'on_leave',
      position: latestMemberData.position || '',
      joinedAt: latestMemberData.createdAt?.toISOString() || new Date().toISOString(),
      avatar: '',
      phone: latestMemberData.profile?.phone || '',
      skills: latestMemberData.profile?.skills || [],
      teamId: latestMemberData.teamId || null,
      workSchedule: latestMemberData.profile?.preferences || {
        preferredShifts: [],
        maxHoursPerWeek: 40,
        minHoursPerWeek: 30,
        availableDays: [1, 2, 3, 4, 5],
        unavailableDates: []
      }
    } : member;

    const employee = toEmployee(latestMember);

    // Fetch saved preferences from database (bypass cache)
    try {
      const savedPreferences = await utils.preferences.get.fetch({
        staffId: member.id,
      });
      console.log('Loaded preferences for', member.name, ':', savedPreferences);

      // Merge saved preferences with employee data
      if (savedPreferences) {
        const prefs = savedPreferences as any;
        const mentorshipPreference = prefs.mentorshipPreference;
        const normalizedMentorshipRole: 'none' | 'mentor' | 'mentee' =
          mentorshipPreference === 'mentor' || mentorshipPreference === 'mentee'
            ? mentorshipPreference
            : 'none';

        employee.preferences = {
          ...employee.preferences,
          preferredShifts: [],
          avoidShifts: [],
          preferredDaysOff: [],
          maxConsecutiveDays: prefs.maxConsecutiveDaysPreferred || 5,
          preferNightShift: false,

          // Convert saved data to ExtendedEmployeePreferences format
          workPatternType: prefs.workPatternType || 'three-shift',
          workLoadPreference: 'normal' as const,
          flexibilityLevel: prefs.preferAlternatingWeekends ? 'high' as const : 'medium' as const,
          preferredPatterns: (() => {
            const patterns = prefs.preferredPatterns?.map((p: any) => p.pattern) || [];
            console.log('Loaded preferredPatterns from DB:', prefs.preferredPatterns);
            console.log('Converted to UI format:', patterns);
            return patterns;
          })(),
          preferredPartners: prefs.preferredColleagues || [],
          avoidPartners: prefs.avoidColleagues || [],
          personalConstraints: [],
          trainingDays: [],
          mentorshipRole: normalizedMentorshipRole,
          specialization: [],
          healthConsiderations: {
            needsLightDuty: false,
            avoidLongShifts: false,
            requiresRegularBreaks: false,
            pregnancyAccommodation: false,
          },
          commuteConsiderations: {
            maxCommuteTime: 60,
            avoidRushHour: false,
            needsParking: false,
            publicTransportDependent: false,
          },
        };

        // Convert preferredShiftTypes to preferredShifts array
        if (prefs.preferredShiftTypes) {
          const shiftMapping: { [key: string]: 'day' | 'evening' | 'night' } = {
            D: 'day',
            E: 'evening',
            N: 'night',
          };

          Object.entries(prefs.preferredShiftTypes).forEach(([key, value]) => {
            if (value && (value as number) > 0 && shiftMapping[key]) {
              employee.preferences.preferredShifts.push(shiftMapping[key]);
            }
          });
        }

        // Convert weekdayPreferences to preferredDaysOff array
        if (prefs.weekdayPreferences) {
          const dayMapping: { [key: string]: number } = {
            sunday: 0,
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6,
          };

          Object.entries(prefs.weekdayPreferences).forEach(([dayName, score]) => {
            // Days with score >= 7 are considered preferred days off
            if (score && (score as number) >= 7 && dayMapping[dayName] !== undefined) {
              employee.preferences.preferredDaysOff.push(dayMapping[dayName]);
            }
          });
        }

        // Convert DB careResponsibilities to UI personalConstraints
        if (prefs.hasCareResponsibilities && prefs.careResponsibilityDetails) {
          const details = prefs.careResponsibilityDetails;
          const constraints = employee.preferences.personalConstraints ?? [];
          constraints.push({
            id: `care-${Date.now()}`,
            type: details.type,
            description: `${details.type} 관련 사정`,
            priority: 'medium',
          });
          employee.preferences.personalConstraints = constraints;
        }

        // Parse transportationNotes to extract commute preferences
        if (prefs.hasTransportationIssues && prefs.transportationNotes) {
          const notes = prefs.transportationNotes;
          const commutePreferences = employee.preferences.commuteConsiderations ?? {
            maxCommuteTime: 60,
            avoidRushHour: false,
            needsParking: false,
            publicTransportDependent: false,
          };

          // Extract max commute time from "Max commute: 60 min."
          const commuteMatch = notes.match(/Max commute: (\d+) min/);
          if (commuteMatch) {
            commutePreferences.maxCommuteTime = parseInt(commuteMatch[1]);
          }

          // Extract public transport preference from "Public transport: Yes"
          if (notes.includes('Public transport: Yes')) {
            commutePreferences.publicTransportDependent = true;
          }

          // Extract parking requirement from "Parking: Required"
          if (notes.includes('Parking: Required')) {
            commutePreferences.needsParking = true;
          }

          employee.preferences.commuteConsiderations = commutePreferences;
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }

    setSelectedEmployee(employee);
    modals.setIsPreferencesModalOpen(true);
  };

  // Handle preferences save
  const handlePreferencesSave = async (preferences: ExtendedEmployeePreferences) => {
    if (!selectedEmployee) return;

    // Convert ExtendedEmployeePreferences to API format
    // Convert preferredDaysOff (0=Sun, 1=Mon, ..., 6=Sat) to weekdayPreferences
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const weekdayPreferences = {
      monday: 5,
      tuesday: 5,
      wednesday: 5,
      thursday: 5,
      friday: 5,
      saturday: 5,
      sunday: 5,
    };

    // Set preferred days to 10
    (preferences.preferredDaysOff || []).forEach(dayNum => {
      const dayName = dayNames[dayNum];
      if (dayName) {
        weekdayPreferences[dayName] = 10;
      }
    });

    const preferenceData = {
      staffId: selectedEmployee.id,
      workPatternType: preferences.workPatternType || 'three-shift',
      preferredShiftTypes: {
        D: preferences.preferredShifts.includes('day') ? 10 : 0,
        E: preferences.preferredShifts.includes('evening') ? 10 : 0,
        N: preferences.preferredShifts.includes('night') ? 10 : 0,
      },
      preferredPatterns: (preferences.preferredPatterns || []).map(pattern => {
        console.log('Saving pattern:', pattern);
        return {
          pattern,
          preference: 10, // Default preference value
        };
      }),
      weekdayPreferences,
      maxConsecutiveDaysPreferred: preferences.maxConsecutiveDays,
      preferAlternatingWeekends: preferences.flexibilityLevel === 'high',
      preferredColleagues: preferences.preferredPartners || [],
      avoidColleagues: preferences.avoidPartners || [],
      mentorshipPreference: preferences.mentorshipRole === 'none'
        ? ("neither" as 'mentor' | 'mentee' | 'neither')
        : preferences.mentorshipRole,
      workLifeBalance: {
        childcare: preferences.personalConstraints.some(c => c.type === 'childcare'),
        eldercare: preferences.personalConstraints.some(c => c.type === 'eldercare'),
        education: preferences.personalConstraints.some(c => c.type === 'education'),
        secondJob: false,
      },
      commutePreferences: {
        maxCommuteTime: preferences.commuteConsiderations.maxCommuteTime,
        preferPublicTransport: preferences.commuteConsiderations.publicTransportDependent,
        parkingRequired: preferences.commuteConsiderations.needsParking,
      },
    };

    console.log('Saving preferences for', selectedEmployee.name, ':', preferenceData);

    // Save via TRPC
    await savePreferences.mutateAsync(preferenceData);

    // Close modal
    modals.setIsPreferencesModalOpen(false);
    setSelectedEmployee(null);
  };

  // Handle modal close
  const handleModalClose = async () => {
    // 모달을 닫을 때 캐시 무효화하여 업데이트된 employee 데이터 가져오기
    await utils.tenant.users.list.invalidate();
    modals.setIsPreferencesModalOpen(false);
    setSelectedEmployee(null);
  };

  // My Preferences 핸들러 함수들
  const handleSavePreferences = async (preferences: ComprehensivePreferences) => {
    try {
      // API를 통해 저장
      const response = await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: currentUserId,
          preferences,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      const result = await response.json();
      console.log('Preferences saved:', result);

      // 성공 알림 (실제로는 토스트 사용 권장)
      alert('선호도가 성공적으로 저장되었습니다!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('선호도 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };


  // 직원별 주간 근무시간 계산
  const calculateMonthlyHours = (employeeId: string) => {
    let totalHours = 0;
    schedule.forEach(assignment => {
      if (assignment.employeeId === employeeId) {
        const assignmentDate = normalizeDate(assignment.date);
        if (assignmentDate < monthStart || assignmentDate > monthEnd) {
          return;
        }
        const shift = shifts.find(s => s.id === assignment.shiftId);
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

    // 팀 필터
    if (filters.selectedTeams.size > 0) {
      result = result.filter(member => {
        return filters.selectedTeams.has(member.teamId || '');
      });
    }

    // 시프트 타입 필터
    if (filters.selectedShiftTypes.size > 0 && customShiftTypes.length > 0) {
      // 선택된 코드들의 근무명 추출
      const selectedShiftNames = new Set<string>();
      filters.selectedShiftTypes.forEach(code => {
        const shiftType = customShiftTypes.find(st => st.code === code);
        if (shiftType) {
          selectedShiftNames.add(shiftType.name);
        }
      });

      // 선택된 근무명에 해당하는 배정이 있는 직원만 표시
      const membersWithSelectedShifts = new Set<string>();
      schedule.forEach(assignment => {
        const shift = shifts.find(s => s.id === assignment.shiftId);
        if (shift && selectedShiftNames.has(shift.name)) {
          membersWithSelectedShifts.add(assignment.employeeId);
        }
      });

      result = result.filter(member => membersWithSelectedShifts.has(member.id));
    }

    // 팀별로 정렬 (팀이 없는 직원은 마지막에 배치)
    result = result.sort((a, b) => {
      // Member인 경우 자신의 스케줄을 최상단으로
      if (isMember && currentUser.dbUser?.id) {
        const currentUserId = currentUser.dbUser.id;
        if (a.id === currentUserId) return -1;
        if (b.id === currentUserId) return 1;
      }

      // 팀별로 정렬
      const aTeamId = a.teamId || 'zzz'; // 팀이 없는 경우 마지막으로
      const bTeamId = b.teamId || 'zzz';

      if (aTeamId !== bTeamId) {
        return aTeamId.localeCompare(bTeamId);
      }

      // 같은 팀 내에서는 이름순으로 정렬
      return a.name.localeCompare(b.name, 'ko');
    });

    return result;
  };

  const displayMembers = getFilteredMembersForDisplay();

  // Extract employee IDs for off-balance query
  const displayMemberIds = React.useMemo(() =>
    displayMembers.map(m => m.id),
    [displayMembers]
  );

  // Fetch off-balance data for all displayed employees
  const { data: offBalanceData } = api.offBalance.getBulkCurrentBalance.useQuery({
    employeeIds: displayMemberIds,
  }, {
    enabled: displayMemberIds.length > 0,
  });

  // Convert off-balance data to Map for easy lookup
  const offBalanceMap = React.useMemo(() => {
    const map = new Map<string, {
      accumulatedOffDays: number;
      allocatedToAccumulation: number;
      allocatedToAllowance: number;
    }>();
    if (offBalanceData) {
      offBalanceData.forEach(item => {
        map.set(item.nurseId, {
          accumulatedOffDays: item.accumulatedOffDays || 0,
          allocatedToAccumulation: item.allocatedToAccumulation || 0,
          allocatedToAllowance: item.allocatedToAllowance || 0,
        });
      });
    }
    return map;
  }, [offBalanceData]);

  // Validate current schedule
  const handleValidateSchedule = async () => {
    if (!canManageSchedules) {
      alert('스케줄 검증 권한이 없습니다.');
      return;
    }

    modals.setIsValidating(true);
    modals.setShowValidationResults(false);

    try {
      const schedulePayload = buildSchedulePayload();

      const response = await fetch('/api/schedule/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-1', // 임시 사용자 ID
          'x-tenant-id': 'default-tenant',
        },
        body: JSON.stringify({
          schedule: schedulePayload,
          employees: filteredMembers,
          shifts: shifts,
          constraints: DEFAULT_CONSTRAINTS,
        }),
      });

      const result = await response.json();

      if (result.success) {
        modals.setValidationScore(result.data.score);
        modals.setValidationIssues(result.data.violations || []);
        modals.setShowValidationResults(true);

        if (result.data.score === 100) {
          alert('스케줄이 모든 제약조건을 만족합니다!');
        } else if (result.data.score >= 80) {
          alert(`스케줄 검증 점수: ${result.data.score}점\n경미한 문제가 있지만 사용 가능합니다.`);
        } else {
          alert(`스케줄 검증 점수: ${result.data.score}점\n개선이 필요한 사항이 있습니다.`);
        }
      } else {
        alert('스케줄 검증에 실패했습니다: ' + result.error);
      }
    } catch (error) {
      console.error('Validation error:', error);
      alert('스케줄 검증 중 오류가 발생했습니다.');
    } finally {
      modals.setIsValidating(false);
    }
  };

  // Optimize current schedule
  const handleOptimizeSchedule = async () => {
    if (!canManageSchedules) {
      alert('스케줄 최적화 권한이 없습니다.');
      return;
    }

    modals.setIsOptimizing(true);

    try {
      const schedulePayload = buildSchedulePayload();

      const response = await fetch('/api/schedule/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-1', // 임시 사용자 ID
          'x-tenant-id': 'default-tenant',
        },
        body: JSON.stringify({
          schedule: schedulePayload,
          employees: filteredMembers,
          shifts: shifts,
          constraints: DEFAULT_CONSTRAINTS,
          targetScore: 90,
          maxIterations: 10,
        }),
      });

      const result = await response.json();

      if (result.success && result.data.optimizedSchedule) {
        // Update schedule with optimized version
        const newSchedule = result.data.optimizedSchedule.map((item: any) => ({
          ...item,
          id: `${item.employeeId}-${item.date}-${item.shiftId}`,
        }));

        setSchedule(newSchedule);

        const improvement = result.data.finalScore - result.data.initialScore;
        alert(`스케줄 최적화 완료!\n개선도: ${improvement.toFixed(1)}점\n최종 점수: ${result.data.finalScore}점`);

        // Validate the optimized schedule
        setTimeout(() => handleValidateSchedule(), 500);
      } else {
        alert('스케줄 최적화에 실패했습니다: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Optimization error:', error);
      alert('스케줄 최적화 중 오류가 발생했습니다.');
    } finally {
      modals.setIsOptimizing(false);
    }
  };

  // Load saved schedule from database
  const handleLoadSchedule = async (scheduleId: string) => {
    try {
      console.log(`🔄 Loading schedule: ${scheduleId}`);

      // Fetch schedule data using TRPC
      const loadedSchedule = await utils.schedule.get.fetch({ id: scheduleId });

      if (!loadedSchedule) {
        console.warn('⚠️ Schedule not found');
        alert('스케줄을 찾을 수 없습니다.');
        return;
      }

      // Extract assignments from metadata
      const assignments = loadedSchedule.metadata?.assignments || [];

      if (assignments.length === 0) {
        console.warn('⚠️ No assignments found in schedule');
        alert('이 스케줄에는 배정 데이터가 없습니다.');
        return;
      }

      // Convert assignments to ScheduleAssignment format
      const convertedAssignments: ScheduleAssignment[] = assignments.map((a: any) => ({
        id: `${a.employeeId}-${a.date}`,
        employeeId: a.employeeId,
        shiftId: a.shiftId,
        date: new Date(a.date),
        isLocked: a.isLocked || false,
      }));

      // Update schedule state
      setSchedule(convertedAssignments);
      setLoadedScheduleId(scheduleId);
      setCurrentMonth(new Date(loadedSchedule.startDate));
      setIsConfirmed(loadedSchedule.status === 'published');

      // Set department filter if schedule has departmentId
      if (loadedSchedule.departmentId && !isMember) {
        setSelectedDepartment(loadedSchedule.departmentId);
      }

      // Switch to schedule view
      filters.setActiveView('schedule');

      // Close modal
      modals.setShowManageModal(false);

      console.log(`✅ Successfully loaded schedule with ${convertedAssignments.length} assignments`);
    } catch (error) {
      console.error('❌ Error loading schedule:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
      alert('스케줄 불러오기 중 오류가 발생했습니다.');
    }
  };

  // Confirm and publish schedule
  const handleConfirmSchedule = async () => {
    if (!canManageSchedules) {
      alert('스케줄 확정 권한이 없습니다.');
      return;
    }

    // ✅ Validate departmentId before saving
    let validDepartmentId: string | null = selectedDepartment;

    if (selectedDepartment === 'all' || selectedDepartment === 'no-department') {
      // For members and managers, use their departmentId
      if (isMember || isManager) {
        validDepartmentId = currentUser.dbUser?.departmentId || null;
      } else {
        // For admin/owner, require department selection
        alert('스케줄을 저장하려면 부서를 선택해주세요.');
        modals.setIsConfirming(false);
        return;
      }
    }

    if (!validDepartmentId) {
      alert('부서 정보가 없습니다. 관리자에게 문의하세요.');
      modals.setIsConfirming(false);
      return;
    }

    console.log(`📋 Saving schedule to department: ${validDepartmentId}`);

    modals.setIsConfirming(true);

    try {
      const schedulePayload = buildSchedulePayload();

      const response = await fetch('/api/schedule/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-1', // 임시 사용자 ID
          'x-tenant-id': 'default-tenant',
        },
        body: JSON.stringify({
          scheduleId: schedulePayload.id,
          schedule: schedulePayload,
          month: format(monthStart, 'yyyy-MM-dd'),
          departmentId: validDepartmentId,
          notifyEmployees: true,
          metadata: {
            createdBy: 'user-1', // 임시 사용자 ID
            createdAt: new Date().toISOString(),
            validationScore: modals.validationScore,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        setScheduleStatus('confirmed');
        setIsConfirmed(true);
        modals.setShowConfirmDialog(false);

        // ✅ Invalidate schedule cache to reload from DB
        await utils.schedule.list.invalidate();

        alert('스케줄이 확정되었습니다!\n직원들에게 알림이 발송되었습니다.');
      } else {
        alert('스케줄 확정에 실패했습니다: ' + result.error);
      }
    } catch (error) {
      console.error('Confirmation error:', error);
      alert('스케줄 확정 중 오류가 발생했습니다.');
    } finally {
      modals.setIsConfirming(false);
    }
  };

  // Save schedule as draft (임시 저장)
  const handleSaveDraft = async () => {
    if (!canManageSchedules) {
      alert('스케줄 저장 권한이 없습니다.');
      return;
    }

    // Validate departmentId before saving
    let validDepartmentId: string | null = selectedDepartment;

    if (selectedDepartment === 'all' || selectedDepartment === 'no-department') {
      // For members and managers, use their departmentId
      if (isMember || isManager) {
        validDepartmentId = currentUser.dbUser?.departmentId || null;
      } else {
        // For admin/owner, require department selection
        alert('스케줄을 저장하려면 부서를 선택해주세요.');
        return;
      }
    }

    if (!validDepartmentId) {
      alert('부서 정보가 없습니다. 관리자에게 문의하세요.');
      return;
    }

    if (schedule.length === 0) {
      alert('저장할 스케줄이 없습니다.');
      return;
    }

    console.log(`📋 Saving draft schedule to department: ${validDepartmentId}`);

    try {
      const schedulePayload = buildSchedulePayload();

      const response = await fetch('/api/schedule/save-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule: schedulePayload,
          month: format(monthStart, 'yyyy-MM-dd'),
          departmentId: validDepartmentId,
          name: `임시 저장 - ${format(monthStart, 'yyyy년 MM월')}`,
          metadata: {
            createdBy: currentUserId,
            createdAt: new Date().toISOString(),
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Set the loaded schedule ID to prevent re-loading on next render
        const savedScheduleId = result.schedule?.id;
        if (savedScheduleId) {
          setLoadedScheduleId(savedScheduleId);
          lastLoadedRef.current = {
            id: savedScheduleId,
            updatedAt: result.schedule.updatedAt?.toString() || new Date().toISOString()
          };
        }

        // Skip auto-load on next render to keep current screen state
        skipAutoLoadRef.current = true;

        // Invalidate schedule cache to refresh the list (for ManageSchedulesModal)
        await utils.schedule.list.invalidate();

        alert('스케줄이 임시 저장되었습니다.\n다른 멤버들에게는 보이지 않으며, 스케줄 보기에서 확인할 수 있습니다.');
      } else {
        alert('임시 저장에 실패했습니다: ' + result.error);
      }
    } catch (error) {
      console.error('Save draft error:', error);
      alert('임시 저장 중 오류가 발생했습니다.');
    }
  };

  const handleGenerateSchedule = async () => {
    if (!canManageSchedules) {
      alert('스케줄 생성 권한이 없습니다.');
      return;
    }

    if (filteredMembers.length === 0) {
      alert('선택된 부서에 활성 직원이 없습니다.');
      return;
    }

    setIsGenerating(true);
    setGenerationResult(null);

    try {
      // 0. customShiftTypes 확인 (비어있으면 다시 로드)
      let activeCustomShiftTypes = customShiftTypes;
      if (!activeCustomShiftTypes || activeCustomShiftTypes.length === 0) {
        console.warn('⚠️ customShiftTypes가 비어있음, DB/localStorage에서 재로드 시도');
        // Try to reload from tenant_configs
        if (shiftTypesConfig?.configValue && Array.isArray(shiftTypesConfig.configValue) && shiftTypesConfig.configValue.length > 0) {
          // Transform from tenant_configs format
          activeCustomShiftTypes = shiftTypesConfig.configValue.map((st: any) => ({
            code: st.code,
            name: st.name,
            startTime: st.startTime,
            endTime: st.endTime,
            color: st.color,
            allowOvertime: st.allowOvertime ?? false,
          }));
          console.log('✅ tenant_configs에서 재로드:', activeCustomShiftTypes);
        } else {
          // Try localStorage
          const savedShiftTypes = localStorage.getItem('customShiftTypes');
          if (savedShiftTypes) {
            try {
              activeCustomShiftTypes = JSON.parse(savedShiftTypes);
              console.log('✅ localStorage에서 재로드:', activeCustomShiftTypes);
            } catch (error) {
              console.error('❌ localStorage 파싱 실패:', error);
            }
          }
        }

        // If still empty, use default shift types
        if (!activeCustomShiftTypes || activeCustomShiftTypes.length === 0) {
          console.warn('⚠️ customShiftTypes를 로드할 수 없음, 기본값 사용');
          activeCustomShiftTypes = [
            { code: 'D', name: '주간', startTime: '08:00', endTime: '16:00', color: '#EAB308', allowOvertime: false },
            { code: 'E', name: '저녁', startTime: '16:00', endTime: '24:00', color: '#F59E0B', allowOvertime: false },
            { code: 'N', name: '야간', startTime: '00:00', endTime: '08:00', color: '#6366F1', allowOvertime: false },
            { code: 'O', name: '휴무', startTime: '00:00', endTime: '00:00', color: '#9CA3AF', allowOvertime: false },
            { code: 'A', name: '행정', startTime: '09:00', endTime: '18:00', color: '#10B981', allowOvertime: false },
          ];
        }
      }
      console.log('📋 활성 customShiftTypes:', activeCustomShiftTypes.map((st: any) => ({ code: st.code, name: st.name })));

      // 0.1. Config 설정 불러오기 (나이트 집중 근무 유급 휴가 설정 포함)
      let nightIntensivePaidLeaveDays = 0;
      try {
        if (shiftConfigData) {
          const config = shiftConfigData.configValue as any;
          nightIntensivePaidLeaveDays = config.preferences?.nightIntensivePaidLeaveDays || 0;
        } else {
          const savedConfig = localStorage.getItem('shiftConfig');
          if (savedConfig) {
            const config = JSON.parse(savedConfig);
            nightIntensivePaidLeaveDays = config.preferences?.nightIntensivePaidLeaveDays || 0;
          }
        }
        if (nightIntensivePaidLeaveDays > 0) {
          console.log(`⚙️ 나이트 집중 근무 유급 휴가: ${nightIntensivePaidLeaveDays}일/월`);
        }
      } catch (error) {
        console.warn('⚠️ Failed to load config, using default values:', error);
      }

      // 1. 모든 직원의 선호도 가져오기
      const preferencesResponse = await fetch('/api/preferences');
      const preferencesData = await preferencesResponse.json();
      const preferencesMap = new Map<string, ComprehensivePreferences>();

      if (preferencesData.success && preferencesData.data) {
        Object.entries(preferencesData.data).forEach(([employeeId, prefs]) => {
          preferencesMap.set(employeeId, prefs as ComprehensivePreferences);
        });
      }

      console.log(`✅ ${preferencesMap.size}명의 선호도 로드 완료`);

      // 1.5. 부서별 team pattern 가져오기 (fallback용)
      let teamPattern: any = null;
      try {
        // 선택된 부서 또는 첫 번째 직원의 부서로 team pattern 조회
        const targetDepartmentId = selectedDepartment === 'all'
          ? filteredMembers[0]?.departmentId
          : selectedDepartment;

        console.log(`🔍 팀 패턴 조회 시작: departmentId=${targetDepartmentId}`);

        if (targetDepartmentId) {
          const teamPatternResponse = await fetch(`/api/team-patterns?departmentId=${targetDepartmentId}`);
          const teamPatternData = await teamPatternResponse.json();
          console.log(`📦 팀 패턴 API 응답:`, teamPatternData);

          teamPattern = teamPatternData.pattern || teamPatternData.defaultPattern || teamPatternData;
          console.log(`📊 최종 teamPattern:`, {
            requiredStaffDay: teamPattern?.requiredStaffDay,
            requiredStaffEvening: teamPattern?.requiredStaffEvening,
            requiredStaffNight: teamPattern?.requiredStaffNight,
            defaultPatterns: teamPattern?.defaultPatterns,
          });

          if (teamPatternData.pattern) {
            console.log(`✅ 팀 패턴 로드: D=${teamPattern.requiredStaffDay}, E=${teamPattern.requiredStaffEvening}, N=${teamPattern.requiredStaffNight} (부서: ${targetDepartmentId})`);
          } else {
            console.warn(`⚠️ 팀 패턴 없음 - 기본값 사용 (부서: ${targetDepartmentId})`);
          }
        } else {
          console.warn(`⚠️ targetDepartmentId가 없음`);
        }
      } catch (error) {
        console.warn('⚠️ Failed to load team pattern, will use default preferences:', error);
      }

      // 1.8. Special requests 가져오기 (Request 탭에서 저장한 shift requests)
      let simpleSpecialRequests: Array<{
        employeeId: string;
        requestType: string;
        date: string;
        shiftTypeCode?: string | null;
      }> = [];
      try {
        // tRPC endpoint를 직접 호출
        const specialRequestsResponse = await fetch(
          `/api/trpc/specialRequests.getApprovedForScheduling?batch=1&input=${encodeURIComponent(JSON.stringify({
            "0": {
              json: {
                startDate: format(monthStart, 'yyyy-MM-dd'),
                endDate: format(monthEnd, 'yyyy-MM-dd'),
              }
            }
          }))}`
        );
        const specialRequestsData = await specialRequestsResponse.json();

        if (specialRequestsData && specialRequestsData[0]?.result?.data?.json) {
          const approvedRequests = specialRequestsData[0].result.data.json;
          console.log(`✅ Loaded ${approvedRequests.length} approved shift requests`);

          // SimpleScheduler의 SpecialRequest 형식으로 변환 (date 필드 사용)
          simpleSpecialRequests = approvedRequests.map((req: any) => ({
            employeeId: req.employeeId,
            requestType: req.requestType,
            date: req.date, // 단일 date 필드 사용
            shiftTypeCode: req.shiftTypeCode || null,
          }));

          console.log(`✅ ${simpleSpecialRequests.length}개의 특별 요청 로드 완료`);
        }
      } catch (error) {
        console.warn('⚠️ Failed to load special requests:', error);
      }

      // 2. MockTeamMember를 UnifiedEmployee로 변환
      let prefsFoundCount = 0;
      let teamPatternUsedCount = 0;
      let defaultUsedCount = 0;

      const unifiedEmployees: UnifiedEmployee[] = filteredMembers.map(member => {
        let comprehensivePrefs = preferencesMap.get(member.id);

        // preferencesMap에 값이 있는지 확인
        if (comprehensivePrefs) {
          prefsFoundCount++;
        } else if (teamPattern) {
          // team pattern을 기반으로 기본 선호도 생성
          comprehensivePrefs = createDefaultPreferencesFromTeamPattern(member, teamPattern);
          teamPatternUsedCount++;
        } else {
          // team pattern도 없으면 완전 기본값 사용
          defaultUsedCount++;
        }

        return EmployeeAdapter.fromMockToUnified(member, comprehensivePrefs);
      });

      console.log(`📊 선호도 출처: 개인설정 ${prefsFoundCount}명, 팀패턴 ${teamPatternUsedCount}명, 기본값 ${defaultUsedCount}명`);

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

      // 4. Holidays 가져오기 + 주말 자동 추가
      let holidays: Array<{ date: string; name: string }> = [];
      try {
        // DB에서 공휴일 로드
        const holidaysResponse = await fetch(
          `/api/trpc/holidays.getByDateRange?batch=1&input=${encodeURIComponent(JSON.stringify({
            "0": {
              json: {
                startDate: format(monthStart, 'yyyy-MM-dd'),
                endDate: format(monthEnd, 'yyyy-MM-dd'),
              }
            }
          }))}`
        );
        const holidaysData = await holidaysResponse.json();
        if (holidaysData && holidaysData[0]?.result?.data?.json) {
          holidays = holidaysData[0].result.data.json.map((h: any) => ({
            date: h.date,
            name: h.name
          }));
        }
      } catch (error) {
        console.warn('⚠️ Failed to load holidays from DB:', error);
      }

      // 주말을 holiday로 자동 추가 (주말 = 최소 인원만 배치)
      const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const weekendDays = allDaysInMonth.filter(day => isWeekend(day));
      weekendDays.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (!holidays.find(h => h.date === dateStr)) {
          holidays.push({
            date: dateStr,
            name: day.getDay() === 0 ? '일요일' : '토요일'
          });
        }
      });

      console.log(`✅ 휴일 ${holidays.length}개 (공휴일 ${holidays.length - weekendDays.length}개 + 주말 ${weekendDays.length}개)`);

      // 5. SimpleScheduler용 Employee 변환
      const simpleEmployees = employees.map(emp => ({
        id: emp.id,
        name: emp.name,
        role: emp.role as 'RN' | 'CN' | 'SN' | 'NA',
        experienceLevel: emp.experienceLevel,
        workPatternType: emp.workPatternType,
        preferredShiftTypes: emp.preferredShiftTypes,
        maxConsecutiveDaysPreferred: emp.maxConsecutiveDaysPreferred,
        maxConsecutiveNightsPreferred: emp.maxConsecutiveNightsPreferred,
      }));

      // 🔍 디버깅: 직원 workPatternType 분포 확인
      const empPatternDistribution: Record<string, string[]> = {
        'weekday-only': [],
        'three-shift': [],
        'night-intensive': [],
        'undefined': [],
      };
      simpleEmployees.forEach(emp => {
        const pattern = emp.workPatternType || 'undefined';
        if (!empPatternDistribution[pattern]) {
          empPatternDistribution[pattern] = [];
        }
        empPatternDistribution[pattern].push(emp.name);
      });
      console.log('📋 직원 근무 패턴 분류:');
      Object.entries(empPatternDistribution).forEach(([pattern, names]) => {
        if (names.length > 0) {
          console.log(`   ${pattern} (${names.length}명): ${names.slice(0, 5).join(', ')}${names.length > 5 ? ` 외 ${names.length - 5}명` : ''}`);
        }
      });

      // 6. SimpleSchedulerConfig 생성
      const schedulerConfig = {
        year: currentMonth.getFullYear(),
        month: currentMonth.getMonth() + 1, // 1-12
        employees: simpleEmployees,
        holidays: holidays,
        specialRequests: simpleSpecialRequests,
        teamPattern: teamPattern?.defaultPatterns ? {
          pattern: teamPattern.defaultPatterns[0] || ['D', 'D', 'E', 'E', 'N', 'N', 'OFF', 'OFF']
        } : undefined,
        requiredStaffPerShift: teamPattern ? {
          D: teamPattern.requiredStaffDay || 5,
          E: teamPattern.requiredStaffEvening || 4,
          N: teamPattern.requiredStaffNight || 3,
        } : { D: 5, E: 4, N: 3 },
      };

      console.log(`📋 스케줄러 설정: ${schedulerConfig.employees.length}명, 필요인원 D${schedulerConfig.requiredStaffPerShift.D}/E${schedulerConfig.requiredStaffPerShift.E}/N${schedulerConfig.requiredStaffPerShift.N}`);

      // 7. 스케줄 생성
      const scheduler = new SimpleScheduler(schedulerConfig);
      const scheduleAssignments = await scheduler.generate();

      console.log(`✅ Generated ${scheduleAssignments.length} schedule assignments`);

      // 8. SimpleScheduler 결과를 기존 형식으로 변환
      console.log(`🔍 activeCustomShiftTypes:`, activeCustomShiftTypes.map((st: any) => ({ code: st.code, name: st.name })));

      // 먼저 special requests Map 생성 (빠른 조회용)
      const specialRequestsLookup = new Map<string, string>();
      simpleSpecialRequests.forEach(req => {
        if (req.requestType === 'shift_request' && req.shiftTypeCode) {
          const key = `${req.employeeId}-${req.date}`;
          // shiftTypeCode에서 ^ 제거하고 대문자로 (예: 'd^' -> 'D')
          const cleanCode = req.shiftTypeCode.replace('^', '').toUpperCase();
          specialRequestsLookup.set(key, cleanCode);
        }
      });

      // 변환 전 시프트 분포 확인
      const preConversionDistribution = scheduleAssignments.reduce((acc, a) => {
        acc[a.shift] = (acc[a.shift] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`📊 변환 전 시프트 분포 (SimpleScheduler 출력):`, preConversionDistribution);

      const convertedAssignments: ExtendedScheduleAssignment[] = scheduleAssignments.map(assignment => {
        // activeCustomShiftTypes에서 shift code로 shiftId 찾기
        let shiftId = 'shift-off'; // Default
        let shiftType: ExtendedScheduleAssignment['shiftType'] = 'off';

        if (assignment.shift === 'OFF') {
          // OFF: activeCustomShiftTypes에서 "O" 코드를 찾거나 기본 'shift-off' 사용 (대소문자 구분 없이)
          const offShiftType = activeCustomShiftTypes.find((st: any) =>
            st.code.toUpperCase() === 'O' || st.code.toUpperCase() === 'OFF'
          );
          if (offShiftType) {
            shiftId = `shift-${offShiftType.code.toLowerCase()}`;
          } else {
            shiftId = 'shift-off'; // Fallback
          }
          shiftType = 'off';
        } else if (assignment.shift === 'A') {
          // 행정 근무 (평일 행정 업무) - 대소문자 구분 없이
          const adminShiftType = activeCustomShiftTypes.find((st: any) => st.code.toUpperCase() === 'A');
          if (adminShiftType) {
            shiftId = `shift-${adminShiftType.code.toLowerCase()}`;
            shiftType = 'custom';
          } else {
            // A 타입이 없으면 shift-a로 (D와 구분 필요)
            shiftId = 'shift-a';
            shiftType = 'custom';
          }
        } else {
          // D, E, N 시프트 - 대소문자 구분 없이 매칭
          const matchingShiftType = activeCustomShiftTypes.find((st: any) =>
            st.code.toUpperCase() === assignment.shift.toUpperCase()
          );
          if (matchingShiftType) {
            shiftId = `shift-${matchingShiftType.code.toLowerCase()}`;
          } else {
            // activeCustomShiftTypes에 없으면 기본 shiftId 생성
            shiftId = `shift-${assignment.shift.toLowerCase()}`;
          }
          shiftType = ((): ExtendedScheduleAssignment['shiftType'] => {
            switch (assignment.shift) {
              case 'D':
                return 'day';
              case 'E':
                return 'evening';
              case 'N':
                return 'night';
              default:
                return 'custom';
            }
          })();
        }

        // Check if this assignment matches a special request
        const requestKey = `${assignment.employeeId}-${assignment.date}`;
        const requestedShift = specialRequestsLookup.get(requestKey);
        const isRequested = requestedShift === assignment.shift;

        return {
          id: `${assignment.employeeId}-${assignment.date}`,
          employeeId: assignment.employeeId,
          shiftId,
          date: new Date(assignment.date),
          isLocked: false,
          shiftType,
          isRequested, // 직원이 요청한 근무인지 표시
        };
      });

      // 요청 반영 통계 로그
      const requestedCount = convertedAssignments.filter(a => a.isRequested).length;
      if (requestedCount > 0) {
        console.log(`✨ ${requestedCount}개의 직원 요청이 스케줄에 반영되었습니다!`);
      }

      // 변환 후 시프트 분포 확인
      try {
        const convertedDistribution = convertedAssignments.reduce((acc, a) => {
          const key = a.shiftId;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log(`📊 변환 후 시프트 분포:`, convertedDistribution);
      } catch (error) {
        console.error('❌ 변환 후 분포 계산 에러:', error);
      }

      // 8.5. 나이트 집중 근무 유급 휴가 적용
      if (nightIntensivePaidLeaveDays > 0) {
        addNightIntensivePaidLeave(
          convertedAssignments,
          unifiedEmployees,
          nightIntensivePaidLeaveDays
        );
      }

      setSchedule(convertedAssignments);
      setOriginalSchedule(convertedAssignments); // 원본 저장
      setGenerationResult(null); // SimpleScheduler는 result 객체를 반환하지 않음
      setLoadedScheduleId(null); // ✅ Clear loaded ID since this is a newly generated schedule
      filters.setActiveView('schedule'); // 스케줄 생성 후 스케줄 뷰로 전환

      console.log('✅ Schedule generated successfully:', {
        assignments: convertedAssignments.length,
        employees: simpleEmployees.length,
        specialRequests: simpleSpecialRequests.length,
      });
    } catch (error) {
      console.error('Schedule generation error:', error);
      alert('스케줄 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmToggle = () => {
    if (!canManageSchedules) {
      alert('스케줄 잠금 상태를 변경할 권한이 없습니다.');
      return;
    }

    if (!isConfirmed && schedule.length === 0) {
      alert('확정할 스케줄이 없습니다.');
      return;
    }
    setIsConfirmed(!isConfirmed);
  };

  // Additional local state not covered by hooks
  const [scheduleStatus, setScheduleStatus] = useState<'draft' | 'confirmed'>('draft');
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Swap 관련 상태
  const [swapMode, setSwapMode] = useState(false);
  const [selectedSwapCell, setSelectedSwapCell] = useState<{ date: string; employeeId: string; assignment: any } | null>(null);
  const [targetSwapCell, setTargetSwapCell] = useState<{ date: string; employeeId: string; assignment: any } | null>(null);
  const [showSwapModal, setShowSwapModal] = useState(false);

  // Manager 셀 편집 관련 상태
  const [showEditShiftModal, setShowEditShiftModal] = useState(false);
  const [editingCell, setEditingCell] = useState<{ date: Date; employeeId: string; currentShift: any } | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = () => setShowMoreMenu(false);
    if (showMoreMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMoreMenu]);

  useEffect(() => {
    if (!canManageSchedules && showMoreMenu) {
      setShowMoreMenu(false);
    }
  }, [canManageSchedules, showMoreMenu]);

  // Swap 관련 핸들러
  const handleSwapCellClick = (date: Date, employeeId: string, assignment: any) => {
    const dateStr = format(date, 'yyyy-MM-dd');

    // 자신의 셀을 클릭한 경우
    if (employeeId === currentUser.dbUser?.id) {
      if (!assignment) {
        alert('교환할 스케줄이 없습니다.');
        return;
      }
      setSelectedSwapCell({ date: dateStr, employeeId, assignment });
      setTargetSwapCell(null);
    }
    // 자신의 셀을 선택한 후 다른 사람의 셀을 클릭한 경우
    else if (selectedSwapCell && selectedSwapCell.date === dateStr) {
      if (!assignment) {
        alert('교환할 스케줄이 없습니다.');
        return;
      }
      setTargetSwapCell({ date: dateStr, employeeId, assignment });
      setShowSwapModal(true);
    }
  };

  const handleSwapSubmit = (reason: string) => {
    if (!selectedSwapCell || !targetSwapCell) return;

    createSwapRequest.mutate({
      date: selectedSwapCell.date,
      requesterShiftId: selectedSwapCell.assignment.shiftId,
      targetUserId: targetSwapCell.employeeId,
      targetShiftId: targetSwapCell.assignment.shiftId,
      reason,
    });
  };

  // Manager 셀 편집 핸들러
  const handleManagerCellClick = (date: Date, employeeId: string, assignment: any) => {
    if (!isManager) return; // manager 권한 확인

    setEditingCell({ date, employeeId, currentShift: assignment });
    setShowEditShiftModal(true);
  };

  // 근무 변경 처리
  const handleShiftChange = (newShiftId: string) => {
    if (!editingCell) return;

    const { date, employeeId, currentShift } = editingCell;

    // 기존 근무 제거 또는 변경
    setSchedule(prevSchedule => {
      const updatedSchedule = prevSchedule.filter(
        a => !(format(a.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') && a.employeeId === employeeId)
      );

      // OFF가 아닌 경우에만 새 근무 추가
      if (newShiftId !== 'off') {
        const newAssignment: ScheduleAssignment = {
          employeeId,
          shiftId: newShiftId,
          date: date,
          isLocked: false,
        };
        updatedSchedule.push(newAssignment);
      }

      return updatedSchedule;
    });

    setShowEditShiftModal(false);
    setEditingCell(null);
  };

  const handleSwapModalClose = () => {
    setShowSwapModal(false);
    setTargetSwapCell(null);
  };

  const handleImport = async () => {
    if (!canManageSchedules) {
      alert('스케줄 가져오기 권한이 없습니다.');
      return;
    }

    if (!modals.importFile) {
      alert('파일을 선택해주세요.');
      return;
    }

    modals.setIsImporting(true);
    try {
      const fileContent = await modals.importFile.text();
      let importData;

      if (modals.importFile.type === 'application/json') {
        // JSON 파일 처리
        importData = JSON.parse(fileContent);
      } else if (modals.importFile.type === 'text/csv') {
        // CSV 파일 처리 - 간단한 파싱
        const lines = fileContent.split('\n');
        const headers = lines[0].split(',');
        const assignments: ScheduleAssignment[] = [];

        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = lines[i].split(',');
            const assignment: any = {};
            headers.forEach((header, index) => {
              assignment[header.trim()] = values[index]?.trim();
            });

            // CSV 데이터를 ScheduleAssignment 형식으로 변환
            if (assignment.employeeId && assignment.date && assignment.shiftId) {
              assignments.push({
                employeeId: assignment.employeeId,
                date: new Date(assignment.date),
                shiftId: assignment.shiftId,
                isLocked: false,
              });
            }
          }
        }
        importData = { assignments };
      } else {
        throw new Error('지원하지 않는 파일 형식입니다.');
      }

      // 가져온 데이터 적용
      if (importData.assignments && Array.isArray(importData.assignments)) {
        // 날짜 문자열을 Date 객체로 변환
        const processedAssignments = importData.assignments.map((a: any) => ({
          ...a,
          date: typeof a.date === 'string' ? new Date(a.date) : a.date,
        }));

        setSchedule(processedAssignments);
        setOriginalSchedule(processedAssignments);

        // 결과 정보가 있으면 적용
        if (importData.result) {
          setGenerationResult(importData.result);
        }

        // 확정 상태가 있으면 적용
        if (importData.confirmed !== undefined) {
          setIsConfirmed(importData.confirmed);
        }

        // 부서 정보가 있으면 적용
        if (importData.department) {
          setSelectedDepartment(importData.department);
        }

        // 기간 정보가 있으면 적용
        if (importData.month) {
          setCurrentMonth(startOfMonth(new Date(importData.month)));
        } else if (importData.week) {
          setCurrentMonth(startOfMonth(new Date(importData.week)));
        }

        filters.setActiveView('schedule');
        alert('스케줄을 성공적으로 가져왔습니다.');
      } else {
        throw new Error('올바른 스케줄 데이터가 없습니다.');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('파일 가져오기 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
    } finally {
      modals.setIsImporting(false);
      modals.setShowImportModal(false);
      modals.setImportFile(null);
    }
  };

  const handleExport = async (exportFormat: 'excel' | 'pdf' | 'both') => {
    if (!canManageSchedules) {
      alert('스케줄 내보내기 권한이 없습니다.');
      return;
    }

    if (schedule.length === 0) {
      alert('내보낼 스케줄이 없습니다.');
      return;
    }

    modals.setIsExporting(true);
    try {
      const response = await fetch('/api/report/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'default-tenant', // 실제 환경에서는 적절한 테넌트 ID 사용
          'x-user-id': 'user-1', // 임시 사용자 ID
        },
        body: JSON.stringify({
          reportType: 'schedule',
          format: exportFormat,
          period: {
            start: format(monthStart, 'yyyy-MM-dd'),
            end: format(monthEnd, 'yyyy-MM-dd'),
          },
          async: false,
          options: {
            includeCharts: true,
            includeMetadata: true,
            departments: selectedDepartment === 'all' ? [] : [selectedDepartment],
            scheduleData: {
              assignments: schedule,
              staff: filteredMembers,
              shifts: shifts,
              generationResult: generationResult,
              confirmed: isConfirmed,
            },
          },
        }),
      });

      const result = await response.json();
      console.log('Report generation response:', result);

      if (!response.ok) {
        throw new Error(result.error || result.message || '리포트 생성 실패');
      }

      if (result.success && result.data) {
        // Excel 파일 다운로드
        if (result.data.excel) {
          const excelBlob = new Blob(
            [Uint8Array.from(atob(result.data.excel.data), c => c.charCodeAt(0))],
            { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
          );
          const excelUrl = URL.createObjectURL(excelBlob);
          const a = document.createElement('a');
          a.href = excelUrl;
          a.download = result.data.excel.filename;
          a.click();
          URL.revokeObjectURL(excelUrl);
        }

        // PDF 파일 다운로드
        if (result.data.pdf) {
          const pdfBlob = new Blob(
            [Uint8Array.from(atob(result.data.pdf.data), c => c.charCodeAt(0))],
            { type: 'application/pdf' }
          );
          const pdfUrl = URL.createObjectURL(pdfBlob);
          const a = document.createElement('a');
          a.href = pdfUrl;
          a.download = result.data.pdf.filename;
          a.click();
          URL.revokeObjectURL(pdfUrl);
        }

        alert(`스케줄이 ${exportFormat === 'both' ? 'Excel과 PDF' : exportFormat.toUpperCase()} 형식으로 내보내기되었습니다.`);
      } else {
        throw new Error(result.error || '리포트 생성 실패');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('내보내기 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      modals.setIsExporting(false);
      modals.setShowExportModal(false);
    }
  };

  // 날짜별 스케줄 그룹화
  const getScheduleForDay = (date: Date) => {
    return schedule.filter(assignment => {
      const assignmentDate = normalizeDate(assignment.date);
      return (
        assignmentDate >= monthStart &&
        assignmentDate <= monthEnd &&
        format(assignmentDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );
    });
  };

  // 시프트별 색상 가져오기
  const getShiftColor = (shiftId: string) => {
    // First try to find by ID in shifts array
    const shift = shifts.find(s => s.id === shiftId);
    if (shift) {
      return shift.color;
    }

    // Extract shift code from shiftId (e.g., 'shift-d' -> 'd')
    const shiftCode = shiftId.replace('shift-', '').toLowerCase();

    // Map shift codes to colors
    const codeColorMap: Record<string, string> = {
      'd': '#3B82F6',   // day - blue
      'e': '#F59E0B',   // evening - amber
      'n': '#6366F1',   // night - indigo
      'o': '#9CA3AF',   // off - gray
      'a': '#10B981',   // administrative - green
    };

    if (codeColorMap[shiftCode]) {
      return codeColorMap[shiftCode];
    }

    // Try to find in customShiftTypes by code
    const shiftType = customShiftTypes.find(st =>
      st.code.toLowerCase() === shiftCode
    );
    if (shiftType) {
      // Map color name to hex
      const colorMap: Record<string, string> = {
        'blue': '#3B82F6',
        'green': '#10B981',
        'amber': '#F59E0B',
        'red': '#EF4444',
        'purple': '#8B5CF6',
        'indigo': '#6366F1',
        'pink': '#EC4899',
        'gray': '#9CA3AF',
      };
      return colorMap[shiftType.color] || '#9CA3AF';
    }

    return '#9CA3AF';
  };

  // 시프트 이름 가져오기
  const getShiftName = (shiftId: string) => {
    // First try to find by ID in shifts array
    const shift = shifts.find(s => s.id === shiftId);
    if (shift) {
      return shift.name;
    }

    // Extract shift code from shiftId (e.g., 'shift-d' -> 'd')
    const shiftCode = shiftId.replace('shift-', '').toLowerCase();

    // Map shift codes to Korean display names
    const codeNameMap: Record<string, string> = {
      'd': '주간',      // day
      'e': '저녁',      // evening
      'n': '야간',      // night
      'o': '휴무',      // off
      'a': '행정',      // administrative
    };

    if (codeNameMap[shiftCode]) {
      return codeNameMap[shiftCode];
    }

    // Try to find in customShiftTypes by code
    const shiftType = customShiftTypes.find(st =>
      st.code.toLowerCase() === shiftCode
    );
    if (shiftType) {
      return shiftType.name;
    }

    return '?';
  };

  // Create a map of special requests for quick lookup
  // Key: `${employeeId}-${date}`, Value: shiftTypeCode
  const specialRequestsMap = React.useMemo(() => {
    const map = new Map<string, string>();
    if (specialRequestsData) {
      specialRequestsData.forEach((req: any) => {
        if (req.requestType === 'shift_request' && req.shiftTypeCode) {
          const key = `${req.employeeId}-${req.date}`;
          map.set(key, req.shiftTypeCode);
        }
      });
    }
    return map;
  }, [specialRequestsData]);

  // 시프트 코드 가져오기 (config에서 설정한 커스텀 shift types 기반)
  const getShiftCode = (assignment: {
    shiftId: string;
    date?: Date;
    employeeId?: string;
    isRequested?: boolean;
  }) => {
    const shiftId = assignment.shiftId;

    // shiftId format: 'shift-day', 'shift-evening', 'shift-night', 'shift-off', 'shift-o', 'shift-a'
    const codeMap: Record<string, string> = {
      'shift-off': 'O',
      'shift-o': 'O',
      'shift-leave': 'O',
      'shift-a': 'A',  // 행정 근무
      'shift-d': 'D',  // 주간
      'shift-e': 'E',  // 저녁
      'shift-n': 'N',  // 야간
    };

    // Check if it's a predefined code
    let code: string;
    if (codeMap[shiftId]) {
      code = codeMap[shiftId];
    } else {
      // Extract code from shiftId (e.g., 'shift-d' -> 'D')
      const extractedCode = shiftId.replace('shift-', '').toUpperCase();

      // Find in customShiftTypes
      const shiftType = customShiftTypes.find(st => st.code.toUpperCase() === extractedCode);
      if (shiftType) {
        code = shiftType.code.toUpperCase();
      } else {
        code = extractedCode || '?';
      }
    }

    // Check if this assignment is marked as requested (from schedule generation)
    if (assignment.isRequested) {
      code = code + '^';
      return code;
    }

    // Fallback: Check if this shift matches a special request (for loaded schedules)
    if (assignment.date && assignment.employeeId) {
      const assignmentDate = format(new Date(assignment.date), 'yyyy-MM-dd');
      const requestKey = `${assignment.employeeId}-${assignmentDate}`;
      const requestedShiftCode = specialRequestsMap.get(requestKey);

      // If there's a special request and it matches the current shift, add ^ suffix
      if (requestedShiftCode) {
        // Remove ^ from stored code if it exists (it's stored as 'd^')
        const cleanRequestCode = requestedShiftCode.replace('^', '').toUpperCase();
        const cleanCurrentCode = code.toUpperCase();

        if (cleanRequestCode === cleanCurrentCode) {
          code = code + '^';
        }
      }
    }

    return code;
  };

  return (
    <MainLayout>
        {/* My Preferences Section - member 권한에서만 표시 */}
        {(isMember || isManager)  && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 border border-blue-200 dark:border-blue-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">나의 근무 선호도</h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1 hidden sm:block">
                  개인 상황과 선호도를 입력하면 AI가 최적의 스케줄을 생성합니다
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                // member는 자신의 정보로 EmployeePreferencesModal 열기
                const currentEmployee = allMembers.find(m => m.id === currentUser.dbUser?.id);
                if (currentEmployee) {
                  await handleEmployeeClick(currentEmployee);
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">선호도 설정</span>
              <span className="sm:hidden">설정</span>
            </button>
          </div>

          {/* 현재 설정된 선호도 요약 - 모바일에서는 2열 그리드 */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">선호 시프트</p>
              <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">주간</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">주말 근무</p>
              <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">상관없음</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">최대 연속</p>
              <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">5일</p>
            </div>
          </div>

        </div>
        )}
        {/* Simplified Schedule Action Toolbar - Only for managers */}
        {canManageSchedules && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center justify-between">
            {canManageSchedules && (
              <>
                {/* Primary Actions - Only Essential Buttons */}
                <div className="flex items-center gap-2">
                  {/* AI Generate Button - Primary Action */}
                  {!isMember && (
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
                          <RefreshCcw className="w-4 h-4 animate-spin" />
                          생성 중...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          AI 스케줄 생성
                        </>
                      )}
                    </button>
                  )}

                  {/* Quick Actions for existing schedule */}
                  {schedule.length > 0 && (
                    <>
                      <button
                        onClick={handleValidateSchedule}
                        disabled={modals.isValidating}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        title="스케줄 검증"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">검증</span>
                      </button>

                      {canManageSchedules && (
                        <button
                          onClick={handleSaveDraft}
                          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 rounded-lg border border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          title="스케줄 임시 저장 (멤버에게는 보이지 않음)"
                        >
                          <Save className="w-4 h-4" />
                          <span className="hidden sm:inline">임시 저장</span>
                        </button>
                      )}

                      <button
                        onClick={() => modals.setShowConfirmDialog(true)}
                        disabled={scheduleStatus === 'confirmed'}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        title="스케줄 확정"
                      >
                        <Lock className="w-4 h-4" />
                        <span className="hidden sm:inline">확정</span>
                      </button>
                    </>
                  )}
                </div>

                {/* More Options Menu */}
                <div className="flex items-center gap-2">
                  {/* Import/Export as icon buttons */}
                  <button
                    onClick={() => modals.setShowImportModal(true)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    title="가져오기"
                  >
                    <Upload className="w-4 h-4" />
                  </button>

                  {schedule.length > 0 && (
                    <button
                      onClick={() => modals.setShowExportModal(true)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                      title="내보내기"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}

                  {/* Manage Saved Schedules */}
                  <button
                    onClick={() => modals.setShowManageModal(true)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    title="스케줄 관리"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu for Additional Options */}
                  <div className="relative">
                    <button
                      onClick={() => setShowMoreMenu(!showMoreMenu)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                      title="더 보기"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {showMoreMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                        {schedule.length > 0 && (
                          <>
                            <button
                              onClick={() => {
                                handleOptimizeSchedule();
                                setShowMoreMenu(false);
                              }}
                              className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                            >
                              <Zap className="w-4 h-4" />
                              스케줄 최적화
                            </button>

                            {generationResult && (
                              <>
                                <button
                                  onClick={() => {
                                    modals.setShowReport(true);
                                    setShowMoreMenu(false);
                                  }}
                                  className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                                >
                                  <FileText className="w-4 h-4" />
                                  리포트 보기
                                </button>
                              </>
                            )}

                            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                          </>
                        )}

                        <button
                          onClick={() => {
                            handleConfirmToggle();
                            setShowMoreMenu(false);
                          }}
                          className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                        >
                          {isConfirmed ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          {isConfirmed ? "스케줄 해제" : "스케줄 잠금"}
                        </button>

                        <button
                          onClick={() => {
                            // Settings or preferences
                            setShowMoreMenu(false);
                          }}
                          className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                        >
                          <Settings className="w-4 h-4" />
                          설정
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
        </div>
        </div>
        )}

        {/* View Tabs */}
        <ViewTabs
          activeView={filters.activeView}
          canViewStaffPreferences={canViewStaffPreferences}
          onViewChange={filters.setActiveView}
        />

        {/* Preferences View */}
        {canViewStaffPreferences && filters.activeView === 'preferences' && (
          <StaffPreferencesGrid
            allMembers={allMembers}
            onEmployeeClick={handleEmployeeClick}
          />
        )}

        {/* Today View */}
        {filters.activeView === 'today' && (
          <TodayScheduleBoard
            employees={allMembers}
            assignments={schedule}
            shiftTypes={customShiftTypes}
            today={selectedDate}
            onDateChange={setSelectedDate}
          />
        )}

        {/* Schedule View */}
        {filters.activeView === 'schedule' && (
          <>
        {/* 토글 버튼들 - 가로 한 줄 배치 */}
        <ViewToggles
          isMember={isMember}
          isManager={isManager}
          showMyScheduleOnly={filters.showMyScheduleOnly}
          showSameSchedule={filters.showSameSchedule}
          viewMode={filters.viewMode}
          onToggleMySchedule={(value) => {
            filters.setShowMyScheduleOnly(value);
            if (value) {
              filters.setShowSameSchedule(false);
            }
          }}
          onToggleSameSchedule={(value) => {
            filters.setShowSameSchedule(value);
            if (value) {
              filters.setShowMyScheduleOnly(false);
              filters.setViewMode('calendar');
            }
          }}
          onToggleViewMode={filters.setViewMode}
        />

        {/* Shift Type Filters - Now inside schedule view */}
        <ShiftTypeFilters
          customShiftTypes={customShiftTypes}
          selectedShiftTypes={filters.selectedShiftTypes}
          onToggleShiftType={filters.toggleShiftType}
          onClearFilters={filters.clearShiftTypeFilters}
        />

        {/* Team Filter */}
        {dbTeams.length > 0 && (
          <TeamFilter
            teams={dbTeams.map(team => ({ id: team.id, code: team.code, name: team.name, color: team.color }))}
            selectedTeams={filters.selectedTeams}
            onToggleTeam={filters.toggleTeam}
            onClearFilters={filters.clearTeamFilters}
          />
        )}

        {/* Week Navigation & Department Filter */}
        <MonthNavigation
          monthStart={monthStart}
          departmentOptions={departmentOptions}
          selectedDepartment={selectedDepartment}
          displayMembersCount={displayMembers.length}
          filteredMembersCount={filteredMembers.length}
          selectedShiftTypesSize={filters.selectedShiftTypes.size}
          isMember={isMember}
          swapMode={swapMode}
          hasSchedule={schedule.length > 0}
          onPreviousMonth={handlePreviousMonth}
          onThisMonth={handleThisMonth}
          onNextMonth={handleNextMonth}
          onDepartmentChange={(deptId) => {
            setSelectedDepartment(deptId);
            setSchedule([]);
            setGenerationResult(null);
          }}
          onToggleSwapMode={() => {
            setSwapMode(!swapMode);
            setSelectedSwapCell(null);
            setTargetSwapCell(null);
          }}
        />

        {/* AI Generation Result */}
        <AIGenerationResult
          generationResult={generationResult}
          onClose={() => setGenerationResult(null)}
        />

        {/* Schedule View */}
        <div>
          {/* Main Schedule View */}
          <div>
            {filters.viewMode === 'grid' ? (
              <ScheduleGridView
                daysInMonth={daysInMonth}
                displayMembers={displayMembers}
                selectedShiftTypesSize={filters.selectedShiftTypes.size}
                scheduleGridTemplate={scheduleGridTemplate}
                holidayDates={holidayDates}
                showCodeFormat={filters.showCodeFormat}
                getScheduleForDay={getScheduleForDay}
                getShiftColor={getShiftColor}
                getShiftName={getShiftName}
                getShiftCode={getShiftCode}
                enableSwapMode={isMember && swapMode}
                currentUserId={currentUser.dbUser?.id}
                selectedSwapCell={selectedSwapCell}
                onCellClick={isManager ? handleManagerCellClick : handleSwapCellClick}
                enableManagerEdit={isManager}
                offBalanceData={offBalanceMap}
                showOffBalance={true}
              />
            ) : (
              <ScheduleCalendarView
                currentMonth={currentMonth}
                displayMembers={displayMembers}
                holidayDates={holidayDates}
                showSameSchedule={filters.showSameSchedule}
                showCodeFormat={filters.showCodeFormat}
                currentUser={currentUser}
                getScheduleForDay={getScheduleForDay}
                getShiftColor={getShiftColor}
                getShiftName={getShiftName}
                getShiftCode={getShiftCode}
                onCellClick={isManager ? handleManagerCellClick : undefined}
                enableManagerEdit={isManager}
              />
            )}

            {/* Stats */}
            <div className="mt-6">
              <ScheduleStats
                schedule={schedule}
                shifts={shifts}
              />
            </div>
          </div>
        </div>
          </>
        )}

      {/* 가져오기 모달 */}
      <ImportModal
        isOpen={modals.showImportModal}
        onClose={() => modals.setShowImportModal(false)}
        importFile={modals.importFile}
        setImportFile={modals.setImportFile}
        onImport={handleImport}
        isImporting={modals.isImporting}
      />

      {/* 내보내기 형식 선택 모달 */}
      <ExportModal
        isOpen={modals.showExportModal}
        onClose={() => modals.setShowExportModal(false)}
        onExport={handleExport}
        isExporting={modals.isExporting}
        generationResult={generationResult}
        isConfirmed={isConfirmed}
      />

      {/* 스케줄링 리포트 모달 */}
      <ReportModal
        isOpen={modals.showReport}
        onClose={() => modals.setShowReport(false)}
        generationResult={generationResult}
      />

      {/* 스케줄 관리 모달 */}
      <ManageSchedulesModal
        isOpen={modals.showManageModal}
        onClose={() => modals.setShowManageModal(false)}
        onScheduleDeleted={() => {
          // Clear current schedule and reload
          setSchedule([]);
          setLoadedScheduleId(null);
          setGenerationResult(null);
        }}
        onScheduleLoad={handleLoadSchedule}
      />

      {/* Validation Results Modal */}
      <ValidationResultsModal
        isOpen={modals.showValidationResults}
        onClose={() => modals.setShowValidationResults(false)}
        validationScore={modals.validationScore}
        validationIssues={modals.validationIssues}
        onOptimize={handleOptimizeSchedule}
      />

      {/* Schedule Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={modals.showConfirmDialog}
        onClose={() => modals.setShowConfirmDialog(false)}
        onConfirm={handleConfirmSchedule}
        isConfirming={modals.isConfirming}
        validationScore={modals.validationScore}
      />

      {/* Swap Request Modal */}
      {selectedSwapCell && targetSwapCell && (
        <SwapRequestModal
          isOpen={showSwapModal}
          onClose={handleSwapModalClose}
          onSubmit={handleSwapSubmit}
          myAssignment={{
            date: selectedSwapCell.date,
            employeeName: currentUser.dbUser?.name || '',
            shiftName: getShiftName(selectedSwapCell.assignment.shiftId),
            shiftTime: (() => {
              const shift = shifts.find(s => s.id === selectedSwapCell.assignment.shiftId);
              return shift?.time ? `${shift.time.start} - ${shift.time.end}` : '';
            })(),
          }}
          targetAssignment={{
            date: targetSwapCell.date,
            employeeName: allMembers.find(m => m.id === targetSwapCell.employeeId)?.name || '',
            shiftName: getShiftName(targetSwapCell.assignment.shiftId),
            shiftTime: (() => {
              const shift = shifts.find(s => s.id === targetSwapCell.assignment.shiftId);
              return shift?.time ? `${shift.time.start} - ${shift.time.end}` : '';
            })(),
          }}
        />
      )}

      {/* Edit Shift Modal (Manager) */}
      {showEditShiftModal && editingCell && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">근무 변경</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {allMembers.find(m => m.id === editingCell.employeeId)?.name}
                  </span>
                  님의 {format(editingCell.date, 'M월 d일')} 근무
                </p>
                {editingCell.currentShift && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    현재: {getShiftName(editingCell.currentShift.shiftId)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  변경할 근무 선택
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {shifts.map((shift) => (
                    <button
                      key={shift.id}
                      onClick={() => handleShiftChange(shift.id)}
                      className="px-4 py-3 rounded-lg border-2 transition-all text-left"
                      style={{
                        borderColor: shift.color,
                        backgroundColor: `${shift.color}20`,
                      }}
                    >
                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                        {shift.name}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {shift.time.start}-{shift.time.end}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditShiftModal(false);
                  setEditingCell(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Preferences Modal */}
      {modals.isPreferencesModalOpen && selectedEmployee && (
        <EmployeePreferencesModal
          employee={selectedEmployee}
          teamMembers={filteredMembers.map(toEmployee)}
          onSave={handlePreferencesSave}
          onClose={handleModalClose}
          canManageTeams={canManageSchedules}
        />
      )}

    </MainLayout>
  );
}
