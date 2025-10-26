"use client";
import React, { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, startOfWeek, endOfWeek, isWeekend } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Users, Download, Upload, Lock, Unlock, Wand2, RefreshCcw, X, BarChart3, FileText, Clock, Heart, AlertCircle, ListChecks, Edit3, FileSpreadsheet, Package, FileUp, CheckCircle, Zap, MoreVertical, Settings } from "lucide-react";
import { MainLayout } from "../../components/layout/MainLayout";
import { SimpleScheduler, type Employee as SimpleEmployee, type Holiday, type SpecialRequest as SimpleSpecialRequest, type ScheduleAssignment as SimpleAssignment } from "../../lib/scheduler/simple-scheduler";
import { api } from "../../lib/trpc/client";
import { type Employee, type Shift, type Constraint, type ScheduleAssignment } from "../../lib/scheduler/types";
import { EmployeeAdapter } from "../../lib/adapters/employee-adapter";
import type { UnifiedEmployee } from "@/lib/types/unified-employee";
import { validateSchedulingRequest, validateEmployee } from "@/lib/validation/schemas";
import { EmployeePreferencesModal, type ExtendedEmployeePreferences } from "@/components/schedule/EmployeePreferencesModal";
import { type ComprehensivePreferences } from "@/components/team/MyPreferencesPanel";
import { toEmployee } from "@/lib/utils/employee-converter";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// 스케줄 페이지에서 사용하는 확장된 ScheduleAssignment 타입
interface ExtendedScheduleAssignment extends ScheduleAssignment {
  shiftType?: 'day' | 'evening' | 'night' | 'off' | 'leave' | 'custom';
}

// ShiftType 인터페이스 정의
interface ShiftType {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  allowOvertime: boolean;
}

// customShiftTypes를 Shift[] 형식으로 변환하는 함수
function convertShiftTypesToShifts(customShiftTypes: ShiftType[]): Shift[] {
  return customShiftTypes.map((shiftType) => {
    // Calculate hours
    const startParts = shiftType.startTime.split(':');
    const endParts = shiftType.endTime.split(':');
    const startHour = parseInt(startParts[0]);
    const endHour = parseInt(endParts[0]);
    let hours = endHour - startHour;
    if (hours <= 0) hours += 24; // Handle overnight shifts

    // Map shift code to type
    let type: 'day' | 'evening' | 'night' | 'off' | 'leave' | 'custom' = 'custom';
    if (shiftType.code === 'D') type = 'day';
    else if (shiftType.code === 'E') type = 'evening';
    else if (shiftType.code === 'N') type = 'night';
    else if (shiftType.code === 'O' || shiftType.code === 'OFF') type = 'off';
    else if (shiftType.code === 'A') type = 'day'; // 행정 근무

    // Map color string to hex
    const colorMap: Record<string, string> = {
      blue: '#3B82F6',
      green: '#10B981',
      amber: '#F59E0B',
      red: '#EF4444',
      purple: '#8B5CF6',
      indigo: '#6366F1',
      pink: '#EC4899',
      gray: '#6B7280',
    };

    return {
      id: `shift-${shiftType.code.toLowerCase()}`,
      type,
      name: shiftType.name,
      time: { start: shiftType.startTime, end: shiftType.endTime, hours },
      color: colorMap[shiftType.color] || '#6B7280',
      requiredStaff: shiftType.code === 'D' ? 5 : shiftType.code === 'E' ? 4 : shiftType.code === 'N' ? 3 : 1,
      minStaff: shiftType.code === 'D' ? 4 : shiftType.code === 'E' ? 3 : shiftType.code === 'N' ? 2 : 1,
      maxStaff: shiftType.code === 'D' ? 6 : shiftType.code === 'E' ? 5 : shiftType.code === 'N' ? 4 : 3,
    };
  });
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

  // 가장 많이 나타나는 시프트를 preferredShifts로 설정
  const preferredShifts: ('day' | 'evening' | 'night')[] = [];
  if (shiftCounts.D > 0) preferredShifts.push('day');
  if (shiftCounts.E > 0) preferredShifts.push('evening');
  if (shiftCounts.N > 0) preferredShifts.push('night');

  // 기본값이 없으면 주간 선호
  if (preferredShifts.length === 0) {
    preferredShifts.push('day');
  }

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

  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [schedule, setSchedule] = useState<ScheduleAssignment[]>([]);
  const [originalSchedule, setOriginalSchedule] = useState<ScheduleAssignment[]>([]); // 원본 스케줄 저장
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<SchedulingResult | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedShiftTypes, setSelectedShiftTypes] = useState<Set<string>>(new Set());
  const [customShiftTypes, setCustomShiftTypes] = useState<ShiftType[]>([]); // Config의 근무 타입 데이터
  const [showReport, setShowReport] = useState(false); // 스케줄링 리포트 모달
  const [activeView, setActiveView] = useState<'preferences' | 'schedule'>('preferences'); // 기본 뷰를 preferences로 설정
  const [showMyPreferences, setShowMyPreferences] = useState(false);
  const [showMyScheduleOnly, setShowMyScheduleOnly] = useState(false); // 나의 스케줄만 보기
  const [showSameSchedule, setShowSameSchedule] = useState(false); // 나와 같은 스케줄 보기
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid'); // 캘린더 형식 보기

  // Employee preferences modal state
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);

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
  });

  // Create a Set of holiday dates for quick lookup
  const holidayDates = React.useMemo(() => {
    return new Set(holidays?.map(h => h.date) || []);
  }, [holidays]);

  const normalizeDate = (value: Date | string) =>
    value instanceof Date ? value : new Date(value);
  const currentWeek = monthStart;
  const buildSchedulePayload = () => ({
    id: `schedule-${format(monthStart, 'yyyy-MM')}-${selectedDepartment}`,
    departmentId: selectedDepartment === 'all' ? 'all-departments' : selectedDepartment,
    startDate: monthStart.toISOString(),
    endDate: monthEnd.toISOString(),
    assignments: schedule.map(assignment => ({
      employeeId: assignment.employeeId,
      shiftId: assignment.shiftId,
      date: normalizeDate(assignment.date).toISOString(),
      isLocked: (assignment as any).isLocked ?? false,
    })),
    status: 'draft' as const,
  });

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

  useEffect(() => {
    if (!canViewStaffPreferences && activeView !== 'schedule') {
      setActiveView('schedule');
    }
  }, [canViewStaffPreferences, activeView]);

  // Load custom shift types from tenant_configs API
  const { data: shiftTypesConfig } = api.tenantConfigs.getByKey.useQuery({
    configKey: 'customShiftTypes'
  });

  // Load shift config (나이트 집중 근무 유급 휴가 설정 등)
  const { data: shiftConfigData } = api.tenantConfigs.getByKey.useQuery({
    configKey: 'shiftConfig'
  });

  useEffect(() => {
    if (shiftTypesConfig) {
      const shiftTypesData = shiftTypesConfig.configValue as any;
      setCustomShiftTypes(shiftTypesData);
      console.log('✅ Loaded custom shift types from DB:', shiftTypesData);
    } else {
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
      }
    }
  }, [shiftTypesConfig]);

  // Convert customShiftTypes to Shift[] format
  const shifts = React.useMemo(() => {
    if (customShiftTypes.length > 0) {
      return convertShiftTypesToShifts(customShiftTypes);
    }
    // Fallback to default if not loaded yet
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
    }
  );

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
    if ((isMember || isManager) && showMyScheduleOnly && currentUser.dbUser?.id) {
      members = members.filter(member => member.id === currentUser.dbUser?.id);
    }

    // "나와 같은 스케줄 보기"를 체크한 경우
    if ((isMember || isManager) && showSameSchedule && currentUser.dbUser?.id && schedule.length > 0) {
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
  }, [allMembers, isMember, isManager, showMyScheduleOnly, showSameSchedule, currentUser.dbUser?.id, schedule]);

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
    setSchedule([]);
    setGenerationResult(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
    setSchedule([]);
    setGenerationResult(null);
  };

  const handleThisMonth = () => {
    setCurrentMonth(startOfMonth(new Date()));
    setSchedule([]);
    setGenerationResult(null);
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

  // Handle employee card click to open preferences modal
  const handleEmployeeClick = async (member: any) => {
    const employee = toEmployee(member);

    // Fetch saved preferences from database (bypass cache)
    try {
      const savedPreferences = await utils.preferences.get.fetch({
        staffId: member.id,
      });
      console.log('Loaded preferences for', member.name, ':', savedPreferences);

      // Merge saved preferences with employee data
      if (savedPreferences) {
        employee.preferences = {
          ...employee.preferences,
          preferredShifts: [],
          avoidShifts: [],
          preferredDaysOff: [],
          maxConsecutiveDays: savedPreferences.maxConsecutiveDaysPreferred || 5,
          preferNightShift: false,

          // Convert saved data to ExtendedEmployeePreferences format
          workPatternType: savedPreferences.workPatternType as any || 'three-shift',
          workLoadPreference: 'normal' as const,
          flexibilityLevel: savedPreferences.preferAlternatingWeekends ? 'high' as const : 'medium' as const,
          preferredPatterns: (() => {
            const patterns = savedPreferences.preferredPatterns?.map((p: any) => p.pattern) || [];
            console.log('Loaded preferredPatterns from DB:', savedPreferences.preferredPatterns);
            console.log('Converted to UI format:', patterns);
            return patterns;
          })(),
          preferredPartners: savedPreferences.preferredColleagues || [],
          avoidPartners: savedPreferences.avoidColleagues || [],
          personalConstraints: [],
          trainingDays: [],
          mentorshipRole: savedPreferences.mentorshipPreference || 'none',
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
        if (savedPreferences.preferredShiftTypes) {
          const shiftMapping: { [key: string]: 'day' | 'evening' | 'night' } = {
            D: 'day',
            E: 'evening',
            N: 'night',
          };

          Object.entries(savedPreferences.preferredShiftTypes).forEach(([key, value]) => {
            if (value && value > 0 && shiftMapping[key]) {
              employee.preferences.preferredShifts.push(shiftMapping[key]);
            }
          });
        }

        // Convert weekdayPreferences to preferredDaysOff array
        if (savedPreferences.weekdayPreferences) {
          const dayMapping: { [key: string]: number } = {
            sunday: 0,
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6,
          };

          Object.entries(savedPreferences.weekdayPreferences).forEach(([dayName, score]) => {
            // Days with score >= 7 are considered preferred days off
            if (score && score >= 7 && dayMapping[dayName] !== undefined) {
              employee.preferences.preferredDaysOff.push(dayMapping[dayName]);
            }
          });
        }

        // Convert DB careResponsibilities to UI personalConstraints
        if (savedPreferences.hasCareResponsibilities && savedPreferences.careResponsibilityDetails) {
          const details = savedPreferences.careResponsibilityDetails as any;
          employee.preferences.personalConstraints.push({
            id: `care-${Date.now()}`,
            type: details.type,
            description: `${details.type} 관련 사정`,
            priority: 'medium',
          });
        }

        // Parse transportationNotes to extract commute preferences
        if (savedPreferences.hasTransportationIssues && savedPreferences.transportationNotes) {
          const notes = savedPreferences.transportationNotes;

          // Extract max commute time from "Max commute: 60 min."
          const commuteMatch = notes.match(/Max commute: (\d+) min/);
          if (commuteMatch) {
            employee.preferences.commuteConsiderations.maxCommuteTime = parseInt(commuteMatch[1]);
          }

          // Extract public transport preference from "Public transport: Yes"
          if (notes.includes('Public transport: Yes')) {
            employee.preferences.commuteConsiderations.publicTransportDependent = true;
          }

          // Extract parking requirement from "Parking: Required"
          if (notes.includes('Parking: Required')) {
            employee.preferences.commuteConsiderations.needsParking = true;
          }
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }

    setSelectedEmployee(employee);
    setIsPreferencesModalOpen(true);
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
    setIsPreferencesModalOpen(false);
    setSelectedEmployee(null);
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsPreferencesModalOpen(false);
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

    // 시프트 타입 필터
    if (selectedShiftTypes.size > 0 && customShiftTypes.length > 0) {
      // 선택된 코드들의 근무명 추출
      const selectedShiftNames = new Set<string>();
      selectedShiftTypes.forEach(code => {
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

    return result;
  };

  const displayMembers = getFilteredMembersForDisplay();

  // Validate current schedule
  const handleValidateSchedule = async () => {
    if (!canManageSchedules) {
      alert('스케줄 검증 권한이 없습니다.');
      return;
    }

    setIsValidating(true);
    setShowValidationResults(false);

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
        setValidationScore(result.data.score);
        setValidationIssues(result.data.violations || []);
        setShowValidationResults(true);

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
      setIsValidating(false);
    }
  };

  // Optimize current schedule
  const handleOptimizeSchedule = async () => {
    if (!canManageSchedules) {
      alert('스케줄 최적화 권한이 없습니다.');
      return;
    }

    setIsOptimizing(true);

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
      setIsOptimizing(false);
    }
  };

  // Confirm and publish schedule
  const handleConfirmSchedule = async () => {
    if (!canManageSchedules) {
      alert('스케줄 확정 권한이 없습니다.');
      return;
    }

    setIsConfirming(true);

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
          departmentId: selectedDepartment,
          notifyEmployees: true,
          metadata: {
            createdBy: 'user-1', // 임시 사용자 ID
            createdAt: new Date().toISOString(),
            validationScore: validationScore,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        setScheduleStatus('confirmed');
        setShowConfirmDialog(false);
        alert('스케줄이 확정되었습니다!\n직원들에게 알림이 발송되었습니다.');
      } else {
        alert('스케줄 확정에 실패했습니다: ' + result.error);
      }
    } catch (error) {
      console.error('Confirmation error:', error);
      alert('스케줄 확정 중 오류가 발생했습니다.');
    } finally {
      setIsConfirming(false);
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
      // 0. Config 설정 불러오기 (나이트 집중 근무 유급 휴가 설정 포함)
      let nightIntensivePaidLeaveDays = 0;
      try {
        if (shiftConfigData) {
          const config = shiftConfigData.configValue as any;
          nightIntensivePaidLeaveDays = config.preferences?.nightIntensivePaidLeaveDays || 0;
          console.log(`⚙️ Config loaded from DB: 나이트 집중 근무 유급 휴가 = ${nightIntensivePaidLeaveDays}일/월`);
        } else {
          // Fallback to localStorage
          const savedConfig = localStorage.getItem('shiftConfig');
          if (savedConfig) {
            const config = JSON.parse(savedConfig);
            nightIntensivePaidLeaveDays = config.preferences?.nightIntensivePaidLeaveDays || 0;
            console.log(`⚙️ Config loaded from localStorage (fallback): 나이트 집중 근무 유급 휴가 = ${nightIntensivePaidLeaveDays}일/월`);
          }
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

      console.log(`✅ Loaded preferences for ${preferencesMap.size} employees`);

      // 1.5. 부서별 team pattern 가져오기 (fallback용)
      let teamPattern: any = null;
      try {
        // 선택된 부서 또는 첫 번째 직원의 부서로 team pattern 조회
        const targetDepartmentId = selectedDepartment === 'all'
          ? filteredMembers[0]?.departmentId
          : selectedDepartment;

        console.log(`🔍 Looking for team pattern with departmentId: ${targetDepartmentId}`);

        if (targetDepartmentId) {
          const teamPatternResponse = await fetch(`/api/team-patterns?departmentId=${targetDepartmentId}`);
          const teamPatternData = await teamPatternResponse.json();
          console.log(`📋 Team pattern response:`, teamPatternData);

          teamPattern = teamPatternData.pattern || teamPatternData.defaultPattern || teamPatternData;
          console.log(`✅ Loaded team pattern for department ${targetDepartmentId}:`, teamPattern);
        } else {
          console.warn('⚠️ No department ID available for team pattern lookup');
        }
      } catch (error) {
        console.warn('⚠️ Failed to load team pattern, will use default preferences:', error);
      }

      // 1.8. Special requests 가져오기 (Request 탭에서 저장한 shift requests)
      let simpleSpecialRequests: Array<{
        employeeId: string;
        requestType: string;
        startDate: string;
        endDate?: string | null;
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

          // SimpleScheduler의 SpecialRequest 형식으로 변환
          simpleSpecialRequests = approvedRequests.map((req: any) => ({
            employeeId: req.employeeId,
            requestType: req.requestType,
            startDate: req.startDate,
            endDate: req.endDate || null,
            shiftTypeCode: req.shiftTypeCode || null,
          }));

          console.log(`✅ Converted ${simpleSpecialRequests.length} special requests for SimpleScheduler`);

          // Log shift requests details for debugging
          const shiftRequests = simpleSpecialRequests.filter(r => r.requestType === 'shift_request');
          if (shiftRequests.length > 0) {
            console.log(`📋 Shift requests breakdown:`, shiftRequests.map(r =>
              `Employee ${r.employeeId}: ${r.shiftTypeCode} on ${r.startDate}`
            ));
          }
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
          console.log(`🔄 Using team pattern for ${member.name} (ID: ${member.id})`);
        } else {
          // team pattern도 없으면 완전 기본값 사용
          defaultUsedCount++;
          console.log(`⚠️ Using default preferences for ${member.name} (ID: ${member.id})`);
        }

        return EmployeeAdapter.fromMockToUnified(member, comprehensivePrefs);
      });

      console.log(`📊 Preference sources: Personal=${prefsFoundCount}, TeamPattern=${teamPatternUsedCount}, Default=${defaultUsedCount}`);

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

      // 3.5. 각 직원의 선호도 기반 맞춤 패턴 및 시프트 배분 계산
      console.log('\n📋 === 개인별 선호도 기반 패턴 및 시프트 배분 ===');
      unifiedEmployees.forEach((unified) => {
        const prefs = unified.comprehensivePreferences;
        if (!prefs) return;

        // 선호 시프트가 1개인 경우에만 처리
        const preferredShift = prefs.workPreferences?.preferredShifts?.[0];
        if (!preferredShift) return;

        // 선호 휴무일 가져오기 (저장된 선호도에서 로드)
        // prefs를 로깅하여 실제 구조 확인
        console.log(`🔍 ${unified.name} preferences:`, prefs);

        // preferredDaysOff가 있으면 사용, 없으면 기본값
        const preferredDaysOff: number[] = (prefs as any).preferredDaysOff ||
                                            (prefs.workPreferences as any)?.preferredDaysOff ||
                                            [0, 6]; // 기본값: 일요일, 토요일

        // 맞춤 패턴 생성
        const customPattern = generateCustomPatternFromPreferences(
          preferredShift,
          preferredDaysOff
        );

        // 시프트 배분 계산 (22일 근무 가정)
        const totalWorkDays = 22;
        const distribution = calculateShiftDistribution(preferredShift, totalWorkDays);

        console.log(`\n👤 ${unified.name}:`);
        console.log(`   - 선호 시프트: ${preferredShift} (${preferredShift === 'day' ? '주간' : preferredShift === 'evening' ? '저녁' : '야간'})`);
        console.log(`   - 선호 휴무일: ${preferredDaysOff.map(d => ['일','월','화','수','목','금','토'][d]).join(', ')}`);
        console.log(`   - 생성된 패턴: ${customPattern}`);
        console.log(`   - 시프트 배분 (22일): 주간 ${distribution.day}일, 저녁 ${distribution.evening}일, 야간 ${distribution.night}일`);
        console.log(`   - 선호 시프트 비중: ${preferredShift === 'day' ? distribution.day : preferredShift === 'evening' ? distribution.evening : distribution.night}일 (1.2배 적용)`);
      });
      console.log('\n===========================================\n');

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

      const dbHolidayCount = (holidays.length - weekendDays.length);
      console.log(`✅ Loaded ${holidays.length} holidays (including weekends) for ${format(monthStart, 'yyyy-MM')}`);
      console.log(`   - DB holidays: ${dbHolidayCount}개`);
      console.log(`   - Weekends: ${weekendDays.length}개`);

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

      // 6. SimpleSchedulerConfig 생성
      console.log('🔍 Team pattern before config creation:', teamPattern);

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

      console.log('📋 SimpleScheduler config:', {
        year: schedulerConfig.year,
        month: schedulerConfig.month,
        employeeCount: schedulerConfig.employees.length,
        holidayCount: schedulerConfig.holidays.length,
        specialRequestCount: schedulerConfig.specialRequests.length,
        teamPattern: schedulerConfig.teamPattern,
        hasTeamPattern: !!schedulerConfig.teamPattern,
        requiredStaffPerShift: schedulerConfig.requiredStaffPerShift,
      });

      // 7. 스케줄 생성
      const scheduler = new SimpleScheduler(schedulerConfig);
      const scheduleAssignments = await scheduler.generate();

      console.log(`✅ Generated ${scheduleAssignments.length} schedule assignments`);

      // 8. SimpleScheduler 결과를 기존 형식으로 변환
      const convertedAssignments = scheduleAssignments.map(assignment => {
        // customShiftTypes에서 shift code로 shiftId 찾기
        let shiftId = 'shift-off'; // Default
        if (assignment.shift !== 'OFF') {
          const matchingShiftType = customShiftTypes.find(st => st.code === assignment.shift);
          if (matchingShiftType) {
            shiftId = `shift-${matchingShiftType.code.toLowerCase()}`;
          }
        }

        return {
          id: `${assignment.employeeId}-${assignment.date}`,
          employeeId: assignment.employeeId,
          shiftId,
          date: new Date(assignment.date),
        };
      });

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
      setActiveView('schedule'); // 스케줄 생성 후 스케줄 뷰로 전환

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

  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf' | 'both' | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  // Schedule optimization and validation states
  const [showValidationResults, setShowValidationResults] = useState(false);
  const [validationScore, setValidationScore] = useState<number | null>(null);
  const [validationIssues, setValidationIssues] = useState<any[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<'draft' | 'confirmed'>('draft');
  const [showMoreMenu, setShowMoreMenu] = useState(false);

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

  const handleImport = async () => {
    if (!canManageSchedules) {
      alert('스케줄 가져오기 권한이 없습니다.');
      return;
    }

    if (!importFile) {
      alert('파일을 선택해주세요.');
      return;
    }

    setIsImporting(true);
    try {
      const fileContent = await importFile.text();
      let importData;

      if (importFile.type === 'application/json') {
        // JSON 파일 처리
        importData = JSON.parse(fileContent);
      } else if (importFile.type === 'text/csv') {
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

        setActiveView('schedule');
        alert('스케줄을 성공적으로 가져왔습니다.');
      } else {
        throw new Error('올바른 스케줄 데이터가 없습니다.');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('파일 가져오기 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
    } finally {
      setIsImporting(false);
      setShowImportModal(false);
      setImportFile(null);
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

    setIsExporting(true);
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
      setIsExporting(false);
      setShowExportModal(false);
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
    const shift = shifts.find(s => s.id === shiftId);
    return shift?.color || '#9CA3AF';
  };

  // 시프트 이름 가져오기
  const getShiftName = (shiftId: string) => {
    const shift = shifts.find(s => s.id === shiftId);
    return shift?.name || '?';
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
        {/* Simplified Schedule Action Toolbar */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center justify-between">
            {canManageSchedules ? (
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
                        disabled={isValidating}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        title="스케줄 검증"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">검증</span>
                      </button>

                      <button
                        onClick={() => setShowConfirmDialog(true)}
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
                    onClick={() => setShowImportModal(true)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    title="가져오기"
                  >
                    <Upload className="w-4 h-4" />
                  </button>

                  {schedule.length > 0 && (
                    <button
                      onClick={() => setShowExportModal(true)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                      title="내보내기"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}

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
                                    setShowReport(true);
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
            ) : (
              <div className="flex w-full flex-col gap-2 text-sm text-gray-600 dark:text-gray-300 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span>일반 권한은 스케줄 조회만 가능합니다.</span>
                </div>
                {memberDepartmentId ? (
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    배정된 병동 스케줄만 표시됩니다.
                  </span>
                ) : (
                  <span className="text-xs sm:text-sm text-red-500 dark:text-red-400">
                    배정된 병동 정보가 없어 스케줄을 조회할 수 없습니다.
                  </span>
                )}
              </div>
            )}
        </div>
        </div>

        {/* View Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex flex-wrap gap-2 sm:flex-nowrap sm:gap-4 md:gap-8">
            {canViewStaffPreferences && (
              <button
                onClick={() => {
                  setActiveView('preferences');
                }}
                className={`pb-3 px-1 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                  activeView === 'preferences'
                    ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                    : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <Heart className="w-4 h-4" />
                <span className="hidden sm:inline">직원 </span>선호사항
              </button>
            )}
            <button
              onClick={() => {
                setActiveView('schedule');
              }}
              className={`pb-3 px-1 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                activeView === 'schedule'
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <Calendar className="w-4 h-4" />
              스케줄<span className="hidden sm:inline"> 보기</span>
            </button>
          </nav>
        </div>

        {/* Preferences View */}
        {canViewStaffPreferences && activeView === 'preferences' && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-6">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-blue-500" />
                이번 달 직원 요구사항 및 선호사항
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allMembers.map(member => (
                  <div
                    key={member.id}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => handleEmployeeClick(member)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">{member.name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{member.position}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        member.status === 'active'
                          ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {member.status === 'active' ? '근무중' : '휴직중'}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      {/* 선호 시프트 */}
                      {member.workSchedule?.preferredShifts && member.workSchedule.preferredShifts.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-green-500 dark:text-green-400">✓</span>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">선호:</span>
                            <span className="ml-1 text-gray-900 dark:text-gray-100">
                              {member.workSchedule.preferredShifts.map((shift: string) =>
                                shift === 'day' ? '주간' : shift === 'evening' ? '저녁' : shift === 'night' ? '야간' : shift
                              ).join(', ')}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 회피 시프트 */}
                      {(member as any).avoidShifts && (member as any).avoidShifts.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-red-500 dark:text-red-400">✗</span>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">회피:</span>
                            <span className="ml-1 text-gray-900 dark:text-gray-100">
                              {(member as any).avoidShifts.map((shift: string) =>
                                shift === 'day' ? '주간' : shift === 'evening' ? '저녁' : shift === 'night' ? '야간' : shift
                              ).join(', ')}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 주당 근무시간 */}
                      <div className="flex items-start gap-2">
                        <Clock className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">주당:</span>
                          <span className="ml-1 text-gray-900 dark:text-gray-100">
                            {member.workSchedule?.minHoursPerWeek || 30}-{member.workSchedule?.maxHoursPerWeek || 40}시간
                          </span>
                        </div>
                      </div>

                      {/* 특별 요구사항 */}
                      {(member.status === 'on_leave' || member.skills?.includes('신입')) && (
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
                          <div>
                            <span className="text-amber-600 dark:text-amber-400">
                              {member.status === 'on_leave' ? '휴직 중' : member.skills?.includes('신입') ? '신입 교육 중' : ''}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {allMembers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">선택된 부서에 직원이 없습니다</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schedule View */}
        {activeView === 'schedule' && (
          <>
        {/* 토글 버튼들 - 가로 한 줄 배치 */}
        <div className="mb-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700 flex flex-col md:flex-row">
          {/* 나의 스케줄만 보기 토글 - member/manager만 표시 */}
          {(isMember || isManager) && (
            <div className={`flex-1 p-3 transition-opacity ${showSameSchedule ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className={`w-4 h-4 ${showSameSchedule ? 'text-gray-400 dark:text-gray-600' : 'text-blue-600 dark:text-blue-400'}`} />
                  <span className={`text-sm font-medium ${showSameSchedule ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                    나의 스케줄만 보기
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (!showSameSchedule) {
                      const newValue = !showMyScheduleOnly;
                      setShowMyScheduleOnly(newValue);
                      if (newValue) {
                        setShowSameSchedule(false);
                      }
                    }
                  }}
                  disabled={showSameSchedule}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    showSameSchedule
                      ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed'
                      : showMyScheduleOnly
                        ? 'bg-blue-600'
                        : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showMyScheduleOnly ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {showSameSchedule
                  ? '※ 나와 같은 스케줄 보기가 활성화되어 있습니다.'
                  : showMyScheduleOnly
                    ? '현재 나의 스케줄만 표시됩니다.'
                    : '같은 부서의 모든 스케줄을 표시합니다.'}
              </p>
            </div>
          )}

          {/* 나와 같은 스케줄 보기 토글 - member/manager만 표시 */}
          {(isMember || isManager) && (
            <div className={`flex-1 p-3 transition-opacity ${showMyScheduleOnly ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className={`w-4 h-4 ${showMyScheduleOnly ? 'text-gray-400 dark:text-gray-600' : 'text-green-600 dark:text-green-400'}`} />
                  <span className={`text-sm font-medium ${showMyScheduleOnly ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                    나와 같은 스케줄 보기
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (!showMyScheduleOnly) {
                      const newValue = !showSameSchedule;
                      setShowSameSchedule(newValue);
                      if (newValue) {
                        setShowMyScheduleOnly(false);
                        setViewMode('calendar');
                      }
                    }
                  }}
                  disabled={showMyScheduleOnly}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                    showMyScheduleOnly
                      ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed'
                      : showSameSchedule
                        ? 'bg-green-600'
                        : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showSameSchedule ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {showMyScheduleOnly
                  ? '※ 나의 스케줄만 보기가 활성화되어 있습니다.'
                  : showSameSchedule
                    ? '나와 같은 날 근무하는 직원만 캘린더로 표시됩니다.'
                    : '같은 부서의 모든 스케줄을 표시합니다.'}
              </p>
            </div>
          )}

          {/* 캘린더 형식으로 보기 토글 */}
          <div className={`flex-1 p-3 transition-opacity ${showSameSchedule ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className={`w-4 h-4 ${showSameSchedule ? 'text-gray-400 dark:text-gray-600' : 'text-purple-600 dark:text-purple-400'}`} />
                <span className={`text-sm font-medium ${showSameSchedule ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                  캘린더 형식으로 보기
                </span>
              </div>
              <button
                onClick={() => {
                  if (!showSameSchedule) {
                    setViewMode(viewMode === 'grid' ? 'calendar' : 'grid');
                  }
                }}
                disabled={showSameSchedule}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  showSameSchedule
                    ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed'
                    : viewMode === 'calendar'
                      ? 'bg-purple-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    viewMode === 'calendar' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {showSameSchedule
                ? '※ 나와 같은 스케줄 보기가 활성화되어 있습니다.'
                : viewMode === 'calendar'
                  ? '캘린더 형식으로 표시됩니다.'
                  : '그리드 형식으로 표시됩니다.'}
            </p>
          </div>
        </div>

        {/* Shift Type Filters - Now inside schedule view */}
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">근무 필터:</span>
          {customShiftTypes.map((shiftType) => {
            const isSelected = selectedShiftTypes.has(shiftType.code);
            const colorMap: Record<string, string> = {
              'blue': isSelected ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300',
              'green': isSelected ? 'bg-green-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300',
              'amber': isSelected ? 'bg-amber-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300',
              'red': isSelected ? 'bg-red-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300',
              'purple': isSelected ? 'bg-purple-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300',
              'indigo': isSelected ? 'bg-indigo-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300',
              'pink': isSelected ? 'bg-pink-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300',
              'gray': isSelected ? 'bg-gray-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300',
            };
            const baseClass = !isSelected ? 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700' : '';

            return (
              <button
                key={shiftType.code}
                onClick={() => toggleShiftType(shiftType.code)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${colorMap[shiftType.color] || colorMap['blue']} ${baseClass}`}
              >
                {shiftType.name} ({shiftType.code})
              </button>
            );
          })}
          {selectedShiftTypes.size > 0 && (
            <button
              onClick={() => setSelectedShiftTypes(new Set())}
              className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
            >
              필터 초기화
            </button>
          )}
        </div>

        {/* Week Navigation & Department Filter */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={handleThisMonth}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                이번 달
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {format(monthStart, "yyyy년 M월")}
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
              disabled={isMember}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 disabled:dark:bg-gray-800 disabled:dark:text-gray-500"
            >
              {departmentOptions.map(dept => (
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

        {/* Schedule View - Grid or Calendar */}
        {viewMode === 'grid' ? (
          /* Grid View */
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
            <div className="min-w-max">
              <div
                className="grid border-b border-gray-200 dark:border-gray-700"
                style={{ gridTemplateColumns: scheduleGridTemplate }}
              >
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 font-medium text-xs text-gray-700 dark:text-gray-300 flex items-center">
                    직원
                  </div>
                  {daysInMonth.map((date) => {
                    const dayOfWeek = date.getDay();
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const isHoliday = holidayDates.has(dateStr);
                    const isHolidayOrSunday = isHoliday || dayOfWeek === 0;

                    return (
                      <div
                        key={date.toISOString()}
                        className={`py-1 px-0.5 bg-gray-50 dark:bg-gray-800 text-center border-l border-gray-200 dark:border-gray-700 ${
                          isHoliday ? 'bg-red-50/30 dark:bg-red-900/10' : ''
                        }`}
                      >
                        <div className={`font-medium text-[10px] ${
                          isHolidayOrSunday
                            ? 'text-red-500 dark:text-red-400'
                            : dayOfWeek === 6
                              ? 'text-blue-500 dark:text-blue-400'
                              : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {format(date, 'EEE', { locale: ko }).slice(0, 1)}
                        </div>
                        <div className={`text-[9px] ${
                          isHolidayOrSunday
                            ? 'text-red-500 dark:text-red-400'
                            : dayOfWeek === 6
                              ? 'text-blue-500 dark:text-blue-400'
                              : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {format(date, 'd')}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  {displayMembers.map(member => (
                    <div
                      key={member.id}
                      className="grid border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      style={{ gridTemplateColumns: scheduleGridTemplate }}
                    >
                      <div className="p-2 flex flex-col justify-center border-r border-gray-100 dark:border-gray-800">
                        <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{member.name}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{member.position}</div>
                      </div>

                      {daysInMonth.map((date) => {
                        const dayAssignments = getScheduleForDay(date).filter(a => a.employeeId === member.id);

                        return (
                          <div
                            key={`${member.id}-${date.toISOString()}`}
                            className="p-0.5 border-l border-gray-100 dark:border-gray-800 flex items-center justify-center"
                          >
                            {dayAssignments.map((assignment, i) => (
                              <div
                                key={i}
                                className="w-full px-0.5 py-1 rounded text-[9px] font-medium text-white text-center"
                                style={{ backgroundColor: getShiftColor(assignment.shiftId) }}
                                title={getShiftName(assignment.shiftId)}
                              >
                                {getShiftName(assignment.shiftId).charAt(0)}
                              </div>
                            ))}
                            {dayAssignments.length === 0 && (
                              <div className="w-full px-0.5 py-1 text-[9px] text-gray-300 dark:text-gray-600 text-center">
                                -
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
          </div>
        ) : (
          /* Calendar View */
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            {/* Calendar Header - Days of Week */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                <div key={i} className="text-center font-medium text-sm text-gray-700 dark:text-gray-300 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {(() => {
                const monthStart = startOfMonth(currentMonth);
                const monthEnd = endOfMonth(currentMonth);
                const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
                const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
                const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

                return calendarDays.map((date) => {
                  const isCurrentMonth = date >= monthStart && date <= monthEnd;
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const dayOfWeek = date.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const isHoliday = holidayDates.has(dateStr);
                  const isHolidayOrSunday = isHoliday || dayOfWeek === 0;

                  // Get all assignments for this date
                  const dayAssignments = getScheduleForDay(date);

                  // Filter by showSameSchedule if enabled
                  let filteredAssignments = dayAssignments;
                  if (showSameSchedule && currentUser.dbUser?.id) {
                    // Get current user's shift for this date
                    const myShift = dayAssignments.find(a => a.employeeId === currentUser.dbUser?.id);
                    if (myShift && myShift.shiftId !== 'shift-off') {
                      // Show only people with the same shift
                      filteredAssignments = dayAssignments.filter(a => a.shiftId === myShift.shiftId);
                    } else {
                      filteredAssignments = [];
                    }
                  }

                  return (
                    <div
                      key={dateStr}
                      className={`min-h-[100px] border rounded-lg p-2 ${
                        isCurrentMonth
                          ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                          : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800'
                      } ${isHoliday && isCurrentMonth ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}
                    >
                      <div className={`text-sm font-medium mb-1 ${
                        !isCurrentMonth
                          ? 'text-gray-400 dark:text-gray-600'
                          : isHolidayOrSunday
                            ? 'text-red-500 dark:text-red-400'
                            : dayOfWeek === 6
                              ? 'text-blue-500 dark:text-blue-400'
                              : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {format(date, 'd')}
                      </div>

                      <div className="space-y-1">
                        {filteredAssignments.map((assignment, i) => {
                          const member = displayMembers.find(m => m.id === assignment.employeeId);
                          if (!member) return null;

                          return (
                            <div
                              key={i}
                              className="text-[10px] px-1 py-0.5 rounded text-white truncate"
                              style={{ backgroundColor: getShiftColor(assignment.shiftId) }}
                              title={`${member.name} - ${getShiftName(assignment.shiftId)}`}
                            >
                              {member.name} {getShiftName(assignment.shiftId)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

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

            {shifts.map(shift => {
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
          </>
        )}

      {/* 가져오기 모달 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-gray-900/50 dark:bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  스케줄 가져오기
                </h2>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                이전에 내보낸 스케줄 파일을 선택하세요.
              </p>

              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
                  <input
                    type="file"
                    accept=".json,.csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <FileUp className="w-12 h-12 text-gray-400 mb-3" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      클릭하여 파일 선택
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      JSON 또는 CSV 형식 지원
                    </span>
                  </label>
                </div>

                {importFile && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {importFile.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({(importFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      onClick={() => setImportFile(null)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                    }}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={!importFile || isImporting}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg ${
                      !importFile || isImporting
                        ? "text-gray-400 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                        : "text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                    }`}
                  >
                    {isImporting ? (
                      <>
                        <RefreshCcw className="w-4 h-4 animate-spin inline mr-2" />
                        가져오는 중...
                      </>
                    ) : (
                      "가져오기"
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-3">
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    <strong>주의:</strong> 가져오기를 실행하면 현재 스케줄이 대체됩니다.
                    가져오기 전에 현재 스케줄을 저장하는 것을 권장합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 내보내기 형식 선택 모달 */}
      {showExportModal && (
        <div className="fixed inset-0 bg-gray-900/50 dark:bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  스케줄 내보내기
                </h2>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                스케줄을 내보낼 파일 형식을 선택하세요.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => handleExport('excel')}
                  disabled={isExporting}
                  className="w-full flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors"
                >
                  <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400" />
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">Excel 파일</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      편집 가능한 스프레드시트 형식 (.xlsx)
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleExport('pdf')}
                  disabled={isExporting}
                  className="w-full flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
                >
                  <FileText className="w-8 h-8 text-red-600 dark:text-red-400" />
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">PDF 파일</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      인쇄 및 공유용 문서 형식 (.pdf)
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleExport('both')}
                  disabled={isExporting}
                  className="w-full flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-colors"
                >
                  <Package className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">Excel + PDF</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      두 형식 모두 다운로드
                    </div>
                  </div>
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    <strong>포함 내용:</strong> 주간 스케줄, 직원별 근무시간, 시프트 통계,
                    {generationResult && "AI 생성 결과, "}
                    {isConfirmed && "확정 상태"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 스케줄링 리포트 모달 */}
      {showReport && generationResult && (
        <div className="fixed inset-0 bg-gray-900/50 dark:bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  스케줄링 상세 리포트
                </h2>
                <button
                  onClick={() => setShowReport(false)}
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
                      공정성 지수는 Jain's Fairness Index를 기반으로 계산되었으며,
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
      )}

      {/* Validation Results Modal */}
      {showValidationResults && (
        <div className="fixed inset-0 bg-gray-900/50 dark:bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  스케줄 검증 결과
                </h2>
                <button
                  onClick={() => setShowValidationResults(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
              {/* Validation Score */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    검증 점수
                  </h3>
                  <span className={`text-2xl font-bold ${
                    validationScore && validationScore >= 80
                      ? 'text-green-600 dark:text-green-400'
                      : validationScore && validationScore >= 60
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {validationScore}점
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      validationScore && validationScore >= 80
                        ? 'bg-green-500'
                        : validationScore && validationScore >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${validationScore}%` }}
                  />
                </div>
              </div>

              {/* Validation Issues */}
              {validationIssues.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    발견된 문제점
                  </h3>
                  <div className="space-y-3">
                    {validationIssues.map((issue, idx) => (
                      <div
                        key={idx}
                        className={`rounded-lg p-4 ${
                          issue.severity === 'critical'
                            ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
                            : issue.severity === 'high'
                            ? 'bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800'
                            : issue.severity === 'medium'
                            ? 'bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800'
                            : 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {issue.constraintName || issue.type}
                          </span>
                          <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                            issue.severity === 'critical'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                              : issue.severity === 'high'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                              : issue.severity === 'medium'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          }`}>
                            {issue.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {issue.message || issue.details}
                        </p>
                        {issue.suggestion && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                            💡 {issue.suggestion}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowValidationResults(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  닫기
                </button>
                {validationScore && validationScore < 80 && (
                  <button
                    onClick={() => {
                      setShowValidationResults(false);
                      handleOptimizeSchedule();
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 rounded-lg"
                  >
                    최적화 실행
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-gray-900/50 dark:bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  스케줄 확정
                </h2>
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  현재 스케줄을 확정하시겠습니까?
                </p>

                {validationScore !== null && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        검증 점수
                      </span>
                      <span className={`text-lg font-bold ${
                        validationScore >= 80
                          ? 'text-green-600 dark:text-green-400'
                          : validationScore >= 60
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {validationScore}점
                      </span>
                    </div>
                    {validationScore < 80 && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">
                        ⚠️ 검증 점수가 낮습니다. 최적화를 먼저 실행하는 것을 권장합니다.
                      </p>
                    )}
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    <strong>확정 시 수행되는 작업:</strong>
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-blue-600 dark:text-blue-300">
                    <li>• 스케줄이 최종 확정되어 수정 불가</li>
                    <li>• 모든 직원에게 알림 발송</li>
                    <li>• 스케줄 공개 및 접근 가능</li>
                    <li>• 근무 일정 캘린더 동기화</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmSchedule}
                  disabled={isConfirming}
                  className={`px-4 py-2 text-sm font-medium rounded-lg ${
                    isConfirming
                      ? "text-gray-400 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                      : "text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
                  }`}
                >
                  {isConfirming ? (
                    <>
                      <RefreshCcw className="w-4 h-4 animate-spin inline mr-2" />
                      확정 중...
                    </>
                  ) : (
                    "확정하기"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee Preferences Modal */}
      {isPreferencesModalOpen && selectedEmployee && (
        <EmployeePreferencesModal
          employee={selectedEmployee}
          teamMembers={filteredMembers.map(toEmployee)}
          onSave={handlePreferencesSave}
          onClose={handleModalClose}
        />
      )}

    </MainLayout>
  );
}
