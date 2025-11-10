"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, Suspense, useDeferredValue } from "react";
import equal from "fast-deep-equal";
import { useSearchParams } from "next/navigation";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, startOfWeek, endOfWeek, isWeekend } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Users, Download, Upload, Lock, Unlock, Wand2, RefreshCcw, X, BarChart3, FileText, Clock, Heart, AlertCircle, ListChecks, Edit3, FileSpreadsheet, Package, FileUp, CheckCircle, Zap, MoreVertical, Settings, FolderOpen, ArrowLeftRight, Save } from "lucide-react";
import { MainLayout } from "../../components/layout/MainLayout";
import { api } from "../../lib/trpc/client";
import { type Employee, type Shift, type Constraint, type ScheduleAssignment, type SchedulingResult } from "../../lib/scheduler/types";
import { EmployeeAdapter } from "../../lib/adapters/employee-adapter";
import type { UnifiedEmployee } from "@/lib/types/unified-employee";
import { validateSchedulingRequest, validateEmployee } from "@/lib/validation/schemas";
import { EmployeePreferencesModal, type ExtendedEmployeePreferences } from "@/components/schedule/EmployeePreferencesModal";
import { type SimplifiedPreferences } from "@/components/department/MyPreferencesPanel";
import { toEmployee } from "@/lib/utils/employee-converter";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ImportModal } from "@/components/schedule/modals/ImportModal";
import { ExportModal } from "@/components/schedule/modals/ExportModal";
import { ValidationResultsModal } from "@/components/schedule/modals/ValidationResultsModal";
import { ConfirmationDialog } from "@/components/schedule/modals/ConfirmationDialog";
import { ReportModal } from "@/components/schedule/modals/ReportModal";
import { ManageSchedulesModal } from "@/components/schedule/modals/ManageSchedulesModal";
import { SwapRequestModal } from "@/components/schedule/modals/SwapRequestModal";
import { ScheduleSwapModal } from "@/components/schedule/modals/ScheduleSwapModal";
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
import { useScheduleFilters, type ScheduleView } from "@/hooks/useScheduleFilters";
import { ScheduleSkeleton } from "@/components/schedule/ScheduleSkeleton";

// 스케줄 페이지에서 사용하는 확장된 ScheduleAssignment 타입
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
 * 나이트 집중 근무 후 유급 휴가 추가
 * @param schedule 생성된 스케줄 배열
 * @param employees UnifiedEmployee 배열
 * @param paidLeaveDaysPerMonth 월별 유급 휴가 일수
 */

function SchedulePageContent() {
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
  const searchParams = useSearchParams();

  const parseViewParam = (value: string | null): ScheduleView | null => {
    if (!value) return null;
    if (value === 'preferences' || value === 'today' || value === 'schedule' || value === 'calendar') {
      return value;
    }
    return null;
  };

  // Parse URL parameters for initial state
  const dateParam = searchParams.get('date');
  const monthParam = searchParams.get('month');
  const viewParam = parseViewParam(searchParams.get('view'));
  const defaultView: ScheduleView = 'today';
  const initialActiveView: ScheduleView = (() => {
    if (!viewParam) return defaultView;
    if (viewParam === 'preferences' && !canViewStaffPreferences) {
      return 'today';
    }
    return viewParam;
  })();

  // Custom hooks for state management
  const filters = useScheduleFilters(initialActiveView);
  const deferredActiveView = useDeferredValue(filters.activeView);
  const modals = useScheduleModals();
  const generateScheduleMutation = api.schedule.generate.useMutation();

  // Initialize dates from URL parameters
  const getInitialMonth = () => {
    if (monthParam) {
      if (monthParam === 'current') return startOfMonth(new Date());
      const parsedMonth = new Date(monthParam + '-01');
      if (!isNaN(parsedMonth.getTime())) return startOfMonth(parsedMonth);
    }
    return startOfMonth(new Date());
  };

  const getInitialDate = () => {
    if (dateParam) {
      if (dateParam === 'today') return new Date();
      const parsedDate = new Date(dateParam);
      if (!isNaN(parsedDate.getTime())) return parsedDate;
    }
    return new Date();
  };

  // Core schedule state (not extracted to hooks due to complex interdependencies)
  const [currentMonth, setCurrentMonth] = useState(getInitialMonth());
  const [schedule, setSchedule] = useState<ScheduleAssignment[]>([]);
  const [originalSchedule, setOriginalSchedule] = useState<ScheduleAssignment[]>([]); // 원본 스케줄 저장
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<SchedulingResult | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [customShiftTypes, setCustomShiftTypes] = useState<ShiftType[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const saved = window.localStorage.getItem('customShiftTypes');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to parse cached shift types:', error);
      return [];
    }
  }); // Config의 근무 타입 데이터
  const [showMyPreferences, setShowMyPreferences] = useState(false);
  const [loadedScheduleId, setLoadedScheduleId] = useState<string | null>(null); // 이미 로드된 스케줄 ID
  const [selectedDate, setSelectedDate] = useState<Date>(getInitialDate()); // 오늘의 근무 날짜 선택

  // 오늘의 근무 탭에서 날짜를 이동하면 해당 월 전체 데이터를 사전 로드
  useEffect(() => {
    if (filters.activeView !== 'today') return;
    const selectedMonthStart = startOfMonth(selectedDate);
    if (selectedMonthStart.getTime() !== currentMonth.getTime()) {
      setCurrentMonth(selectedMonthStart);
    }
  }, [filters.activeView, selectedDate, currentMonth]);

  // Swap 관련 상태
  const [showScheduleSwapModal, setShowScheduleSwapModal] = useState(false);
  const [showSwapRequestModal, setShowSwapRequestModal] = useState(false);
  const [swapRequestData, setSwapRequestData] = useState<{
    myShift: { date: string; employeeId: string; shiftId: string; employeeName: string };
    targetShift: { date: string; employeeId: string; shiftId: string; employeeName: string };
  } | null>(null);

  // Handle URL parameter changes for view
  useEffect(() => {
    if (!viewParam) return;

    if (viewParam === 'preferences' && !canViewStaffPreferences) {
      filters.setActiveView('today');
      return;
    }

    filters.setActiveView(viewParam);
  }, [viewParam, canViewStaffPreferences, filters.setActiveView]);

  // Employee preferences modal state
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedPreferences, setSelectedPreferences] = useState<SimplifiedPreferences | null>(null);

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
    () => `90px repeat(${daysInMonth.length}, minmax(28px, 1fr))`,
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

  // ✅ Load full month schedule for all views except preferences (오늘의 근무도 한번에 로드)
  const needsFullSchedule = filters.activeView !== 'preferences';
  const { data: savedSchedules } = api.schedule.list.useQuery({
    departmentId: (isManager || isMember) && memberDepartmentId ? memberDepartmentId :
                  selectedDepartment !== 'all' && selectedDepartment !== 'no-department' ? selectedDepartment : undefined,
    status: isMember ? 'published' : undefined, // Members only see published, managers/admins see all including drafts
    startDate: monthStart,
    endDate: monthEnd,
  }, {
    enabled: needsFullSchedule, // preferences 뷰가 아닐 때만 로드
    staleTime: 5 * 60 * 1000, // 5분 동안 fresh 유지
    refetchOnWindowFocus: false, // 탭 전환 시 refetch 비활성화
  });

  // ✅ Derive today's assignments from loaded schedule to avoid 반복 fetch
  const todayAssignments = React.useMemo(() => {
    if (schedule.length === 0) return [];
    const targetDateStr = format(selectedDate, 'yyyy-MM-dd');
    return schedule.filter(assignment => format(assignment.date, 'yyyy-MM-dd') === targetDateStr);
  }, [schedule, selectedDate]);

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

      React.startTransition(() => {
        setSchedule(convertedAssignments);
        setOriginalSchedule(convertedAssignments);
        setIsConfirmed(currentMonthSchedule.status === 'published'); // Only confirmed if published
        setLoadedScheduleId(currentMonthSchedule.id);
        lastLoadedRef.current = { id: currentMonthSchedule.id, updatedAt: currentUpdatedAt };
        console.log(`✅ Loaded ${convertedAssignments.length} assignments from ${currentMonthSchedule.status} schedule ${currentMonthSchedule.id} (updated: ${currentMonthSchedule.updatedAt})`);
      });
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

  // Determine which departmentId to use for configs
  const configDepartmentId = React.useMemo(() => {
    // Manager/Member: Use their actual department
    if (isManager || isMember) {
      return memberDepartmentId || undefined;
    }
    // Admin/Owner: Use selected department (if not 'all' or 'no-department')
    if (selectedDepartment !== 'all' && selectedDepartment !== 'no-department') {
      return selectedDepartment;
    }
    return undefined;
  }, [isManager, isMember, memberDepartmentId, selectedDepartment]);

  // Load shift types from configs table (department-specific)
  const { data: shiftTypesConfig, isLoading: isLoadingShiftTypesConfig } = api.configs.getByKey.useQuery({
    configKey: 'shift_types',
    departmentId: configDepartmentId, // Use department-specific config
  }, {
    staleTime: 30 * 60 * 1000, // 서버 캐시 TTL(30분)과 맞춰 과도한 refetch 방지
    gcTime: 35 * 60 * 1000, // 캐시도 비슷한 기간 유지
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Load shift config (나이트 집중 근무 유급 휴가 설정 등)
  const { data: shiftConfigData } = api.configs.getByKey.useQuery({
    configKey: 'shiftConfig',
    departmentId: configDepartmentId, // Use department-specific config
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
    if (isLoadingShiftTypesConfig) {
      console.log('⏳ shiftTypesConfig 로딩 중 - 기존 커스텀 시프트 유지');
      return;
    }

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
      setCustomShiftTypes(prev => {
        if (equal(prev, transformedShiftTypes)) {
          return prev;
        }
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('customShiftTypes', JSON.stringify(transformedShiftTypes));
        }
        return transformedShiftTypes;
      });
      console.log('✅ Loaded custom shift types from tenant_configs:', transformedShiftTypes);
      console.log('📊 Total shift types loaded:', transformedShiftTypes.length);
    } else {
      console.log('⚠️ shiftTypesConfig is empty or invalid, trying localStorage');
      // Fallback to localStorage for backward compatibility
      const savedShiftTypes = localStorage.getItem('customShiftTypes');
      if (savedShiftTypes) {
        try {
          const parsed = JSON.parse(savedShiftTypes);
          setCustomShiftTypes(prev => equal(prev, parsed) ? prev : parsed);
          console.log('✅ Loaded custom shift types from localStorage (fallback):', parsed);
        } catch (error) {
          console.error('Failed to load custom shift types:', error);
        }
      } else {
        console.log('❌ No shift types found in localStorage either');
      }
    }
  }, [shiftTypesConfig, isLoadingShiftTypesConfig]);

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
          .filter(s => s.employeeId === currentUser.dbUser?.id && !['O', 'shift-off', 'shift-o'].includes(s.shiftId))
          .map(s => format(new Date(s.date), 'yyyy-MM-dd'))
      );

      // 같은 날짜에 근무하는 직원들만 필터링
      if (myWorkDates.size > 0) {
        members = members.filter(member => {
          if (member.id === currentUser.dbUser?.id) return true; // 본인은 항상 포함

          // 해당 직원이 같은 날짜에 근무하는지 확인
          return schedule.some(s =>
            s.employeeId === member.id &&
            !['O', 'shift-off', 'shift-o'].includes(s.shiftId) &&
            myWorkDates.has(format(new Date(s.date), 'yyyy-MM-dd'))
          );
        });
      }
    }

    return members;
  }, [allMembers, isMember, isManager, filters.showMyScheduleOnly, filters.showSameSchedule, currentUser.dbUser?.id, schedule]);

  const handlePreviousMonth = React.useCallback(() => {
    setCurrentMonth(prev => subMonths(prev, 1));
    setSchedule([]);
    setGenerationResult(null);
    setLoadedScheduleId(null); // ✅ Reset to allow loading new month's schedule
  }, []);

  const handleNextMonth = React.useCallback(() => {
    setCurrentMonth(prev => addMonths(prev, 1));
    setSchedule([]);
    setGenerationResult(null);
    setLoadedScheduleId(null); // ✅ Reset to allow loading new month's schedule
  }, []);

  const handleThisMonth = React.useCallback(() => {
    setCurrentMonth(startOfMonth(new Date()));
    setSchedule([]);
    setGenerationResult(null);
    setLoadedScheduleId(null); // ✅ Reset to allow loading current month's schedule
  }, []);

  const handleDepartmentChange = React.useCallback((deptId: string) => {
    setSelectedDepartment(deptId);
    setSchedule([]);
    setGenerationResult(null);
  }, []);

  const handleToggleSwapMode = React.useCallback(() => {
    setShowScheduleSwapModal(true);
  }, []);

  const handleCloseGenerationResult = React.useCallback(() => {
    setGenerationResult(null);
  }, []);

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
      setShowSwapRequestModal(false);
      setSwapRequestData(null);
    },
    onError: (error) => {
      console.error('Swap request failed:', error);
      alert(`교환 요청에 실패했습니다: ${error.message}`);
    },
  });

  // Handle employee card click to open preferences modal
  const handleEmployeeClick = async (member: any) => {
    const mapUserToMember = (userData: any) => ({
      id: userData.id,
      employeeId: userData.employeeId || '',
      name: userData.name,
      email: userData.email,
      role: userData.role as 'admin' | 'manager' | 'staff',
      departmentId: userData.departmentId || '',
      departmentName: userData.department?.name || '',
      status: userData.status as 'active' | 'inactive' | 'on_leave',
      position: userData.position || '',
      joinedAt: userData.createdAt?.toISOString() || new Date().toISOString(),
      avatar: '',
      phone: userData.profile?.phone || '',
      skills: userData.profile?.skills || [],
      teamId: userData.teamId || null,
      workSchedule: userData.profile?.preferences || {
        preferredShifts: [],
        availableDays: [1, 2, 3, 4, 5],
        unavailableDates: []
      }
    });

    // 1️⃣ 우선 현재 화면의 데이터를 즉시 사용해 모달을 연다
    setSelectedEmployee(toEmployee(member));
    setSelectedPreferences(null);
    modals.setIsPreferencesModalOpen(true);

    try {
      const fetchLatestMember = utils.tenant.users.list.fetch({
        limit: 100,
        offset: 0,
        status: 'active',
        departmentId:
          !isMember && userRole !== 'manager' && selectedDepartment !== 'all' && selectedDepartment !== 'no-department'
            ? selectedDepartment
            : undefined,
      }).then(freshUsersData => {
        const latest = freshUsersData?.items?.find((item: any) => item.id === member.id);
        return latest ? mapUserToMember(latest) : null;
      }).catch(error => {
        console.error('Failed to refresh member data:', error);
        return null;
      });

      const fetchPreferences = fetch(`/api/preferences?employeeId=${member.id}`)
        .then(async response => {
          if (!response.ok) return null;
          const savedData = await response.json();
          console.log('Loaded preferences API response for', member.name, ':', savedData);
          return savedData.success ? (savedData.data as SimplifiedPreferences) : null;
        })
        .catch(error => {
          console.error('Failed to load preferences:', error);
          return null;
        });

      const [latestMember, savedPreferences] = await Promise.all([fetchLatestMember, fetchPreferences]);

      const resolvedMember = latestMember || member;
      const employee = toEmployee(resolvedMember);

      if (savedPreferences) {
        employee.workPatternType = savedPreferences.workPatternType || employee.workPatternType || 'three-shift';
        setSelectedPreferences(savedPreferences);
      }

      setSelectedEmployee(employee);
    } catch (error) {
      console.error('Failed to prepare preferences modal:', error);
    }
  };

  // Handle preferences save
  const handlePreferencesSave = async (preferences: ExtendedEmployeePreferences) => {
    if (!selectedEmployee) return;

    try {
      // Convert ExtendedEmployeePreferences to SimplifiedPreferences
      const simplifiedPrefs: SimplifiedPreferences = {
        workPatternType: preferences.workPatternType || 'three-shift',
        preferredPatterns: (preferences.preferredPatterns || []).map(p =>
          typeof p === 'string' ? { pattern: p, preference: 5 } : p
        ),
        avoidPatterns: preferences.avoidPatterns || [],
      };

      console.log('Saving preferences for', selectedEmployee.name, ':', simplifiedPrefs);

      // Save via REST API
      const response = await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          preferences: simplifiedPrefs,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      const result = await response.json();
      console.log('Preferences saved:', result);

      // Show success message
      alert('선호도가 성공적으로 저장되었습니다!');

      // Close modal
      modals.setIsPreferencesModalOpen(false);
      setSelectedEmployee(null);
      setSelectedPreferences(null);
      void utils.tenant.users.list.invalidate();
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('선호도 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    modals.setIsPreferencesModalOpen(false);
    setSelectedEmployee(null);
    setSelectedPreferences(null);
    void utils.tenant.users.list.invalidate();
  };

  // My Preferences 핸들러 함수들
  const handleSavePreferences = async (preferences: SimplifiedPreferences) => {
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

  // ✅ OPTIMIZED: Pre-compute shift ID to name mapping to avoid repeated .find() calls
  const shiftIdToNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    shifts.forEach(shift => {
      map.set(shift.id, shift.name);
    });
    return map;
  }, [shifts]);

  // ✅ OPTIMIZED: Pre-compute shift code to name mapping
  const shiftCodeToNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    customShiftTypes.forEach(shiftType => {
      map.set(shiftType.code, shiftType.name);
    });
    return map;
  }, [customShiftTypes]);

  // ✅ OPTIMIZED: Memoized filtered and sorted members list
  // Uses deferred filter values to prevent UI blocking during rapid filter changes
  const displayMembers = React.useMemo(() => {
    let result = filteredMembers;

    // ✅ OPTIMIZED: Use deferred team filter for non-blocking updates
    if (filters.deferredTeams.size > 0) {
      result = result.filter(member => filters.deferredTeams.has(member.teamId || ''));
    }

    // ✅ OPTIMIZED: 시프트 타입 필터 - O(n) instead of O(n²)
    if (filters.deferredShiftTypes.size > 0 && customShiftTypes.length > 0) {
      // Pre-compute selected shift names using the map
      const selectedShiftNames = new Set<string>();
      filters.deferredShiftTypes.forEach(code => {
        const shiftName = shiftCodeToNameMap.get(code);
        if (shiftName) {
          selectedShiftNames.add(shiftName);
        }
      });

      // Build employee set in single pass using the shift ID map
      const membersWithSelectedShifts = new Set<string>();
      schedule.forEach(assignment => {
        const shiftName = shiftIdToNameMap.get(assignment.shiftId);
        if (shiftName && selectedShiftNames.has(shiftName)) {
          membersWithSelectedShifts.add(assignment.employeeId);
        }
      });

      result = result.filter(member => membersWithSelectedShifts.has(member.id));
    }

    // ✅ OPTIMIZED: Sort only once when dependencies change
    return result.sort((a, b) => {
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
  }, [
    filteredMembers,
    filters.deferredTeams,
    filters.deferredShiftTypes,
    customShiftTypes,
    shiftCodeToNameMap,
    shiftIdToNameMap,
    schedule,
    isMember,
    currentUser.dbUser?.id
  ]);

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

      // Fetch nurse_preferences for all employees
      console.log('🔍 Fetching nurse_preferences for validation...');
      const preferencesResponse = await fetch('/api/preferences');
      const preferencesData = await preferencesResponse.json();

      console.log('📦 Preferences data:', preferencesData);

      // Merge preferences into employee data
      const employeesWithPreferences = filteredMembers.map(emp => {
        const empPrefs = preferencesData.data?.[emp.id];
        return {
          ...emp,
          preferences: empPrefs ? {
            maxConsecutiveDays: empPrefs.workPreferences?.maxConsecutiveDays || 5,
            preferredShifts: empPrefs.workPreferences?.preferredShifts || [],
            avoidShifts: empPrefs.workPreferences?.avoidShifts || [],
            preferredDaysOff: [], // TODO: Map from preferences if available
            preferNightShift: empPrefs.workPreferences?.preferredShifts?.includes('night') || false,
          } : undefined,
        };
      });

      console.log('✅ Employees with preferences:', employeesWithPreferences.length);

      const response = await fetch('/api/schedule/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-1', // 임시 사용자 ID
          'x-tenant-id': 'default-tenant',
        },
        body: JSON.stringify({
          schedule: schedulePayload,
          employees: employeesWithPreferences,
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
  // handleOptimizeSchedule function removed - complex genetic algorithm optimizer not needed

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

      // 스케줄 명이 입력되지 않은 경우 기본값 설정
      const finalScheduleName = scheduleName.trim() || `${format(monthStart, 'yyyy년 M월')} 스케줄`;

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
          scheduleName: finalScheduleName, // 스케줄 명 추가
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
        setScheduleName(''); // 스케줄 명 초기화

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
      let activeCustomShiftTypes = customShiftTypes;
      if (!activeCustomShiftTypes || activeCustomShiftTypes.length === 0) {
        if (shiftTypesConfig?.configValue && Array.isArray(shiftTypesConfig.configValue) && shiftTypesConfig.configValue.length > 0) {
          activeCustomShiftTypes = shiftTypesConfig.configValue.map((st: any) => ({
            code: st.code,
            name: st.name,
            startTime: st.startTime,
            endTime: st.endTime,
            color: st.color,
            allowOvertime: st.allowOvertime ?? false,
          }));
        } else {
          const savedShiftTypes = typeof window !== 'undefined' ? window.localStorage.getItem('customShiftTypes') : null;
          if (savedShiftTypes) {
            try {
              activeCustomShiftTypes = JSON.parse(savedShiftTypes);
            } catch (error) {
              console.error('Failed to parse cached shift types:', error);
            }
          }
        }

        if (!activeCustomShiftTypes || activeCustomShiftTypes.length === 0) {
          activeCustomShiftTypes = [
            { code: 'D', name: '주간', startTime: '08:00', endTime: '16:00', color: '#EAB308', allowOvertime: false },
            { code: 'E', name: '저녁', startTime: '16:00', endTime: '24:00', color: '#F59E0B', allowOvertime: false },
            { code: 'N', name: '야간', startTime: '00:00', endTime: '08:00', color: '#6366F1', allowOvertime: false },
            { code: 'O', name: '휴무', startTime: '00:00', endTime: '00:00', color: '#9CA3AF', allowOvertime: false },
            { code: 'A', name: '행정', startTime: '09:00', endTime: '18:00', color: '#10B981', allowOvertime: false },
          ];
        }
      }

      const preferencesResponse = await fetch('/api/preferences');
      const preferencesData = await preferencesResponse.json();
      const preferencesMap = new Map<string, SimplifiedPreferences>();
      if (preferencesData.success && preferencesData.data) {
        Object.entries(preferencesData.data).forEach(([employeeId, prefs]) => {
          preferencesMap.set(employeeId, prefs as SimplifiedPreferences);
        });
      }

      const inferredDepartmentId = selectedDepartment === 'all'
        ? (filteredMembers[0]?.departmentId || memberDepartmentId || currentUser.dbUser?.departmentId || '')
        : selectedDepartment;

      if (!inferredDepartmentId || inferredDepartmentId === 'no-department' || inferredDepartmentId === 'all') {
        alert('스케줄을 생성할 부서를 선택해주세요.');
        setIsGenerating(false);
        return;
      }

      let teamPattern: any = null;
      try {
        const teamPatternResponse = await fetch(`/api/department-patterns?departmentId=${inferredDepartmentId}`);
        const teamPatternData = await teamPatternResponse.json();
        teamPattern = teamPatternData.pattern || teamPatternData.defaultPattern || teamPatternData;
      } catch (error) {
        console.warn('Failed to load department pattern:', error);
      }

      let simpleSpecialRequests: Array<{
        employeeId: string;
        requestType: string;
        date: string;
        shiftTypeCode?: string | null;
      }> = [];
      try {
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
          simpleSpecialRequests = specialRequestsData[0].result.data.json.map((req: any) => ({
            employeeId: req.employeeId,
            requestType: req.requestType,
            date: req.date,
            shiftTypeCode: req.shiftTypeCode || null,
          }));
        }
      } catch (error) {
        console.warn('Failed to load special requests:', error);
      }

      const unifiedEmployees: UnifiedEmployee[] = filteredMembers.map(member => {
        const comprehensivePrefs = preferencesMap.get(member.id);
        return EmployeeAdapter.fromMockToUnified(member, comprehensivePrefs);
      });

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
        alert(`일부 직원 데이터에 문제가 있습니다:
${validationErrors.slice(0, 3).join('
')}`);
      }

      let holidays: Array<{ date: string; name: string }> = [];
      try {
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
            name: h.name,
          }));
        }
      } catch (error) {
        console.warn('Failed to load holidays from DB:', error);
      }

      const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
      allDaysInMonth.forEach(day => {
        if (isWeekend(day)) {
          const dateStr = format(day, 'yyyy-MM-dd');
          if (!holidays.find(h => h.date === dateStr)) {
            holidays.push({
              date: dateStr,
              name: day.getDay() === 0 ? '일요일' : '토요일',
            });
          }
        }
      });

      let teamPatternPayload: { pattern: string[]; avoidPatterns?: string[][] } | null = null;
      if (teamPattern?.defaultPatterns?.length) {
        teamPatternPayload = {
          pattern: teamPattern.defaultPatterns[0] || ['D', 'D', 'E', 'E', 'N', 'N', 'OFF', 'OFF'],
          avoidPatterns: teamPattern?.avoidPatterns || [],
        };
      } else if (Array.isArray(teamPattern?.pattern)) {
        teamPatternPayload = {
          pattern: teamPattern.pattern,
          avoidPatterns: teamPattern?.avoidPatterns || [],
        };
      }

      const requiredStaffPerShift = teamPattern ? {
        D: teamPattern.requiredStaffDay || 5,
        E: teamPattern.requiredStaffEvening || 4,
        N: teamPattern.requiredStaffNight || 3,
      } : undefined;

      const generationShifts = convertShiftTypesToShifts(activeCustomShiftTypes);

      const payload = {
        name: `AI 스케줄 - ${format(monthStart, 'yyyy-MM')}`,
        departmentId: inferredDepartmentId,
        startDate: monthStart,
        endDate: monthEnd,
        employees,
        shifts: generationShifts,
        constraints: DEFAULT_CONSTRAINTS,
        specialRequests: simpleSpecialRequests,
        holidays,
        teamPattern: teamPatternPayload,
        requiredStaffPerShift,
        optimizationGoal: 'balanced' as const,
      };

      const result = await generateScheduleMutation.mutateAsync(payload);
      const normalizedAssignments: ScheduleAssignment[] = result.assignments.map((assignment: any) => ({
        ...assignment,
        date: new Date(assignment.date),
      }));

      setSchedule(normalizedAssignments);
      setOriginalSchedule(normalizedAssignments);
      setIsConfirmed(false);
      setLoadedScheduleId(result.scheduleId);
      setGenerationResult(result.generationResult);
    } catch (error) {
      console.error('AI schedule generation failed:', error);
      alert('AI 스케줄 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
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
  const scheduleByDate = React.useMemo(() => {
    const map = new Map<string, ScheduleAssignment[]>();
    schedule.forEach((assignment) => {
      const assignmentDate = normalizeDate(assignment.date);
      if (assignmentDate < monthStart || assignmentDate > monthEnd) return;
      const key = format(assignmentDate, 'yyyy-MM-dd');
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(assignment);
    });
    return map;
  }, [schedule, monthStart, monthEnd]);

  const getScheduleForDay = React.useCallback((date: Date) => {
    const key = format(normalizeDate(date), 'yyyy-MM-dd');
    return scheduleByDate.get(key) ?? [];
  }, [scheduleByDate]);

  const scheduleByDateAndEmployee = React.useMemo(() => {
    const map = new Map<string, ScheduleAssignment[]>();
    scheduleByDate.forEach((assignments, dateKey) => {
      assignments.forEach((assignment) => {
        const key = `${dateKey}|${assignment.employeeId}`;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(assignment);
      });
    });
    return map;
  }, [scheduleByDate]);

  const getAssignmentsForCell = React.useCallback(
    (date: Date, employeeId: string) => {
      const dateKey = format(normalizeDate(date), 'yyyy-MM-dd');
      const key = `${dateKey}|${employeeId}`;
      return scheduleByDateAndEmployee.get(key) ?? [];
    },
    [scheduleByDateAndEmployee]
  );

  // 시프트별 색상 가져오기
  const getShiftColor = React.useCallback((shiftId: string) => {
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
  }, [shifts, customShiftTypes]);

  // 시프트 이름 가져오기
  const getShiftName = React.useCallback((shiftId: string) => {
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
  }, [shifts, customShiftTypes]);

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
  const getShiftCode = React.useCallback((assignment: {
    shiftId: string;
    date?: Date;
    employeeId?: string;
    isRequested?: boolean;
  }) => {
    const shiftId = assignment.shiftId;

    // shiftId format: Now stores direct codes like 'O', 'A', 'D', 'E', 'N' (also supports legacy 'shift-' format)
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
  }, [customShiftTypes, specialRequestsMap]);

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
              onClick={() => {
                // member는 자신의 정보로 EmployeePreferencesModal 열기
                const currentEmployee = allMembers.find(m => m.id === currentUser.dbUser?.id);
                if (currentEmployee) {
                  // 비동기 작업을 기다리지 않아 모달이 즉시 열리도록 처리
                  void handleEmployeeClick(currentEmployee);
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">선호도 설정</span>
              <span className="sm:hidden">설정</span>
            </button>
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
        {canViewStaffPreferences && deferredActiveView === 'preferences' && (
          <StaffPreferencesGrid
            allMembers={allMembers}
            onEmployeeClick={handleEmployeeClick}
          />
        )}

        {/* Today View */}
        {deferredActiveView === 'today' && (
          <TodayScheduleBoard
            employees={allMembers}
            assignments={todayAssignments}
            shiftTypes={customShiftTypes}
            today={selectedDate}
            onDateChange={setSelectedDate}
          />
        )}

        {/* Schedule View */}
        {deferredActiveView === 'schedule' && (
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

        {/* Month Navigation */}
        <MonthNavigation
          monthStart={monthStart}
          displayMembersCount={displayMembers.length}
          filteredMembersCount={filteredMembers.length}
          selectedShiftTypesSize={filters.selectedShiftTypes.size}
          isMember={isMember}
          swapMode={false}
          hasSchedule={schedule.length > 0}
          onPreviousMonth={handlePreviousMonth}
          onThisMonth={handleThisMonth}
          onNextMonth={handleNextMonth}
          onToggleSwapMode={handleToggleSwapMode}
        />

        {/* AI Generation Result */}
        <AIGenerationResult
          generationResult={generationResult}
          onClose={handleCloseGenerationResult}
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
                getAssignmentsForCell={getAssignmentsForCell}
                getShiftColor={getShiftColor}
                getShiftName={getShiftName}
                getShiftCode={getShiftCode}
                enableSwapMode={false}
                currentUserId={currentUser.dbUser?.id}
                selectedSwapCell={null}
                onCellClick={isManager ? handleManagerCellClick : undefined}
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
          setIsConfirmed(false); // Reset confirmed state
        }}
        onScheduleLoad={handleLoadSchedule}
      />

      {/* Validation Results Modal */}
      <ValidationResultsModal
        isOpen={modals.showValidationResults}
        onClose={() => modals.setShowValidationResults(false)}
        validationScore={modals.validationScore}
        validationIssues={modals.validationIssues}
      />

      {/* Schedule Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={modals.showConfirmDialog}
        onClose={() => modals.setShowConfirmDialog(false)}
        onConfirm={handleConfirmSchedule}
        isConfirming={modals.isConfirming}
        validationScore={modals.validationScore}
        scheduleName={scheduleName}
        onScheduleNameChange={handleScheduleNameChange}
        defaultScheduleName={`${format(monthStart, 'yyyy년 M월')} 스케줄`}
      />

      {/* Swap Request Modal */}
      {/* Schedule Swap Modal - Step 1 & 2 */}
      <ScheduleSwapModal
        isOpen={showScheduleSwapModal}
        onClose={() => setShowScheduleSwapModal(false)}
        currentUserId={currentUser.dbUser?.id || ''}
        currentUserName={currentUser.dbUser?.name || ''}
        schedule={schedule}
        allMembers={allMembers}
        getShiftName={getShiftName}
        getShiftColor={getShiftColor}
        onSwapRequest={handleSwapRequest}
      />

      {/* Swap Request Confirmation Modal */}
      {swapRequestData && (
        <SwapRequestModal
          isOpen={showSwapRequestModal}
          onClose={() => {
            setShowSwapRequestModal(false);
            setSwapRequestData(null);
          }}
          onSubmit={handleSwapSubmit}
          myAssignment={{
            date: swapRequestData.myShift.date,
            employeeName: swapRequestData.myShift.employeeName,
            shiftName: getShiftName(swapRequestData.myShift.shiftId),
            shiftTime: (() => {
              const shift = shifts.find(s => s.id === swapRequestData.myShift.shiftId);
              return shift?.time ? `${shift.time.start} - ${shift.time.end}` : '';
            })(),
          }}
          targetAssignment={{
            date: swapRequestData.targetShift.date,
            employeeName: swapRequestData.targetShift.employeeName,
            shiftName: getShiftName(swapRequestData.targetShift.shiftId),
            shiftTime: (() => {
              const shift = shifts.find(s => s.id === swapRequestData.targetShift.shiftId);
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
                  {shifts.map((shift, index) => (
                    <button
                      key={`${shift.id}-${index}`}
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
          initialPreferences={selectedPreferences || undefined}
        />
      )}

    </MainLayout>
  );
}

// Main page component with Suspense boundary
export default function SchedulePage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="container mx-auto px-4 py-6">
          <ScheduleSkeleton />
        </div>
      </MainLayout>
    }>
      <SchedulePageContent />
    </Suspense>
  );
}
