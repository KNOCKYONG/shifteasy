"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, Suspense, useDeferredValue } from "react";
import dynamicImport from "next/dynamic";
import equal from "fast-deep-equal";
import { useSearchParams } from "next/navigation";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, startOfWeek, endOfWeek, isWeekend, differenceInCalendarYears } from "date-fns";
import { Download, Upload, Lock, Wand2, RefreshCcw, FileText, Heart, CheckCircle, MoreVertical, Settings, FolderOpen, Save, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { MainLayout } from "../../components/layout/MainLayout";
import { api } from "../../lib/trpc/client";
import { type Employee, type Constraint, type ScheduleAssignment, type SchedulingResult, type OffAccrualSummary } from "@/lib/types/scheduler";
import type { Assignment } from "@/types/schedule";
import { EmployeeAdapter } from "../../lib/adapters/employee-adapter";
import type { UnifiedEmployee } from "@/lib/types/unified-employee";
import { type ExtendedEmployeePreferences } from "@/components/schedule/EmployeePreferencesModal";
import { type SimplifiedPreferences } from "@/components/department/MyPreferencesPanel";
import { toEmployee } from "@/lib/utils/employee-converter";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { ImprovementReport } from "@/lib/scheduler/types";

// Dynamic imports for heavy modal components to reduce initial bundle size
const EmployeePreferencesModal = dynamicImport(() => import("@/components/schedule/EmployeePreferencesModal").then(mod => ({ default: mod.EmployeePreferencesModal })), { ssr: false });
const ImportModal = dynamicImport(() => import("@/components/schedule/modals/ImportModal").then(mod => ({ default: mod.ImportModal })), { ssr: false });
const ExportModal = dynamicImport(() => import("@/components/schedule/modals/ExportModal").then(mod => ({ default: mod.ExportModal })), { ssr: false });
const ValidationResultsModal = dynamicImport(() => import("@/components/schedule/modals/ValidationResultsModal").then(mod => ({ default: mod.ValidationResultsModal })), { ssr: false });
const ConfirmationDialog = dynamicImport(() => import("@/components/schedule/modals/ConfirmationDialog").then(mod => ({ default: mod.ConfirmationDialog })), { ssr: false });
const ManageSchedulesModal = dynamicImport(() => import("@/components/schedule/modals/ManageSchedulesModal").then(mod => ({ default: mod.ManageSchedulesModal })), { ssr: false });
const SwapRequestModal = dynamicImport(() => import("@/components/schedule/modals/SwapRequestModal").then(mod => ({ default: mod.SwapRequestModal })), { ssr: false });
const ScheduleSwapModal = dynamicImport(() => import("@/components/schedule/modals/ScheduleSwapModal").then(mod => ({ default: mod.ScheduleSwapModal })), { ssr: false });
const ImprovementResultModal = dynamicImport(() => import("@/components/schedule/modals/ImprovementResultModal").then(mod => ({ default: mod.ImprovementResultModal })), { ssr: false });
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
import { LottieLoadingOverlay } from "@/components/common/LottieLoadingOverlay";
import type { SSEEvent } from "@/lib/sse/events";
// import { useSSEContext } from "@/providers/SSEProvider";

// 스케줄 페이지에서 사용하는 확장된 ScheduleAssignment 타입
type SwapShift = {
  date: string;
  employeeId: string;
  employeeName: string;
  shiftId: string;
  shiftName: string;
};

// DB에서 가져온 스케줄 메타데이터 타입
type ScheduleMetadata = {
  assignments?: Array<{
    id?: string;
    employeeId: string;
    shiftId: string;
    date: string | Date;
    isLocked?: boolean;
    shiftType?: string;
  }>;
  offAccruals?: OffAccrualSummary[];
  [key: string]: unknown;
};

// DB에서 가져온 원본 배정 타입
type DbAssignment = {
  id?: string;
  employeeId: string;
  shiftId: string;
  date: string | Date;
  isLocked?: boolean;
  shiftType?: string;
};

// Config에서 가져온 시프트 타입
type ConfigShiftType = {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  displayOrder?: number;
};

// 특별 요청 타입
type SpecialRequest = {
  employeeId: string;
  requestType: string;
  date: string;
  shiftTypeCode?: string | null;
};

// 공휴일 타입
type Holiday = {
  date: string;
  name: string;
};

// 사용자 데이터 타입 (API 응답)
type UserDataItem = {
  id: string;
  employeeId?: string | null;
  name: string;
  email: string;
  role: string;
  departmentId?: string | null;
  department?: { name: string } | null;
  status: string;
  position?: string | null;
  hireDate?: Date | string | null;
  yearsOfService?: number | null;
  createdAt?: Date;
  profile?: { phone?: string | null } | null;
  teamId?: string | null;
};

const calculateYearsOfService = (user: UserDataItem): number | undefined => {
  if (typeof user.yearsOfService === 'number' && Number.isFinite(user.yearsOfService)) {
    return Math.max(0, user.yearsOfService);
  }

  if (user.hireDate) {
    const hireDate = new Date(user.hireDate);
    if (!Number.isNaN(hireDate.getTime())) {
      return Math.max(0, differenceInCalendarYears(new Date(), hireDate));
    }
  }

  return undefined;
};

// 팀 패턴 타입
type TeamPattern = {
  id?: string;
  patternData?: unknown;
  defaultPatterns?: string[][];
  avoidPatterns?: string[][];
  [key: string]: unknown;
};

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

const STANDARD_AI_SHIFT_CODES = ['D', 'E', 'N', 'O', 'A'] as const;
type StandardShiftCode = typeof STANDARD_AI_SHIFT_CODES[number];

const DEFAULT_STANDARD_SHIFT_TYPES: Record<StandardShiftCode, ShiftType> = {
  D: { code: 'D', name: '주간', startTime: '08:00', endTime: '16:00', color: '#EAB308', allowOvertime: false },
  E: { code: 'E', name: '저녁', startTime: '16:00', endTime: '24:00', color: '#F59E0B', allowOvertime: false },
  N: { code: 'N', name: '야간', startTime: '00:00', endTime: '08:00', color: '#6366F1', allowOvertime: false },
  O: { code: 'O', name: '휴무', startTime: '00:00', endTime: '00:00', color: '#9CA3AF', allowOvertime: false },
  A: { code: 'A', name: '행정', startTime: '09:00', endTime: '18:00', color: '#10B981', allowOvertime: false },
};

const DEFAULT_FALLBACK_SHIFT_TYPE: ShiftType = {
  code: 'X',
  name: '커스텀',
  startTime: '09:00',
  endTime: '18:00',
  color: '#64748B',
  allowOvertime: false,
};

const SELECTED_DEPARTMENT_STORAGE_KEY = 'schedule:last-selected-department';

/**
 * 나이트 집중 근무 후 유급 휴가 추가
 * @param schedule 생성된 스케줄 배열
 * @param employees UnifiedEmployee 배열
 * @param paidLeaveDaysPerMonth 월별 유급 휴가 일수
 */

function SchedulePageContent() {
  const utils = api.useUtils();
  const currentUser = useCurrentUser();
  const currentUserId = currentUser.dbUser?.id || currentUser.userId || '';
  const userRole = (currentUser.dbUser?.role ?? currentUser.role) as string | undefined;
  const isMember = userRole === 'member';
  const isManager = userRole === 'manager';
  const memberDepartmentId = currentUser.dbUser?.departmentId ?? null;
  const effectiveTenantId = currentUser.dbUser?.tenantId ?? currentUser.orgId ?? '';
  const effectiveUserRole = currentUser.dbUser?.role ?? currentUser.role ?? 'admin';
  const tenantPlan = currentUser.tenantPlan ?? currentUser.dbUser?.tenantPlan ?? null;
  const headerDepartmentId = memberDepartmentId ?? undefined;
  const isAuthReady = Boolean(currentUserId && effectiveTenantId);

  const authHeaders = React.useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (currentUserId) {
      headers['x-user-id'] = currentUserId;
    }
    if (effectiveTenantId) {
      headers['x-tenant-id'] = effectiveTenantId;
    }
    if (effectiveUserRole) {
      headers['x-user-role'] = effectiveUserRole;
    }
    if (headerDepartmentId) {
      headers['x-department-id'] = headerDepartmentId;
    }
    return headers;
  }, [currentUserId, effectiveTenantId, effectiveUserRole, headerDepartmentId]);

  const fetchWithAuth = useCallback((url: RequestInfo | URL, options: RequestInit = {}) => {
    if (!isAuthReady) {
      return Promise.reject(new Error('사용자 세션이 아직 준비되지 않았습니다.'));
    }
    const mergedHeaders = {
      ...authHeaders,
      ...(options.headers as Record<string, string> | undefined),
    };
    return fetch(url, {
      credentials: 'include',
      ...options,
      headers: mergedHeaders,
    });
  }, [authHeaders, isAuthReady]);
  const canManageSchedules = userRole ? ['admin', 'manager', 'owner'].includes(userRole) : false;
  const canViewStaffPreferences = canManageSchedules && !isMember;
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
  const setActiveView = filters.setActiveView;
  const deferredActiveView = useDeferredValue(filters.activeView);
  const modals = useScheduleModals();
  // SSE context available but not currently used in this component
  // const { isConnected: isSSEConnected, reconnectAttempt } = useSSEContext();
  const generateScheduleMutation = api.schedule.generate.useMutation();
  const deleteMutation = api.schedule.delete.useMutation();

  // 🆕 스케줄 개선 mutation
  const improveMutation = api.schedule.improveSchedule.useMutation({
    onSuccess: (data) => {
      setImprovementReport(data.report);
      setShowImprovementModal(true);
      setIsImproving(false);
    },
    onError: (error) => {
      alert(`스케줄 개선 실패: ${error.message}`);
      setIsImproving(false);
    },
  });

  // AI 기능 사용 권한 확인
  const { data: aiPermission } = api.payments.canUseAIFeatures.useQuery(undefined, {
    enabled: isAuthReady,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
      return;
    }
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries?.[0]?.type === 'reload') {
      setActiveView('today');
    }
  }, [setActiveView]);

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
  const [, setOriginalSchedule] = useState<ScheduleAssignment[]>([]); // Setter used for state tracking
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<SchedulingResult | null>(null);
  const [offAccrualSummaries, setOffAccrualSummaries] = useState<OffAccrualSummary[]>([]);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPreparingConfirmation, setIsPreparingConfirmation] = useState(false);
  const [toolbarAnimatedIn, setToolbarAnimatedIn] = useState(false);
  const [selectedDepartmentState, setSelectedDepartmentState] = useState<string>('all');
  const setSelectedDepartment = useCallback((value: string | ((prev: string) => string)) => {
    setSelectedDepartmentState((prev) => {
      const nextValue = typeof value === 'function' ? (value as (prev: string) => string)(prev) : value;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SELECTED_DEPARTMENT_STORAGE_KEY, nextValue);
      }
      return nextValue;
    });
  }, []);
  const selectedDepartment = selectedDepartmentState;
  const [scheduleName, setScheduleName] = useState('');
  const [existingScheduleToReplace, setExistingScheduleToReplace] = useState<{
    id: string;
    startDate: Date;
    endDate: Date;
    publishedAt: Date | null;
  } | null>(null);
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
  const [, setLoadedScheduleId] = useState<string | null>(null); // Setter used for state tracking
  const [selectedDate, setSelectedDate] = useState<Date>(getInitialDate()); // 오늘의 근무 날짜 선택
  const [careerOverrides, setCareerOverrides] = useState<Record<string, { yearsOfService?: number; hireYear?: number }>>({});
  const [aiEnabled, setAiEnabled] = useState(false); // AI 스케줄 검토 기능 토글

  // 🆕 스케줄 개선 관련 상태
  const [isImproving, setIsImproving] = useState(false);
  const [improvementReport, setImprovementReport] = useState<ImprovementReport | null>(null);
  const [showImprovementModal, setShowImprovementModal] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedDepartment = window.localStorage.getItem(SELECTED_DEPARTMENT_STORAGE_KEY);
    if (storedDepartment) {
      setSelectedDepartmentState((prev) => (prev === storedDepartment ? prev : storedDepartment));
    }
  }, []);


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
    myShift: SwapShift;
    targetShift: SwapShift;
  } | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showEditShiftModal, setShowEditShiftModal] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    date: Date;
    employeeId: string;
    currentShift?: Assignment | null;
  } | null>(null);

  // Handle URL parameter changes for view
  useEffect(() => {
    if (!viewParam) return;

    if (viewParam === 'preferences' && !canViewStaffPreferences) {
      filters.setActiveView('today');
      return;
    }

    filters.setActiveView(viewParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewParam, canViewStaffPreferences]);

  // Employee preferences modal state
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedPreferences, setSelectedPreferences] = useState<SimplifiedPreferences | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = React.useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    [monthStart, monthEnd]
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

  // Fetch users from database (shared between views)
  const userListInput = React.useMemo(() => {
    return {
      limit: 100,
      offset: 0,
      status: 'active' as const,
      includeDetails: false,
      departmentId:
        !isMember && userRole !== 'manager' && selectedDepartment !== 'all' && selectedDepartment !== 'no-department'
          ? selectedDepartment
          : undefined,
    };
  }, [isMember, selectedDepartment, userRole]);

  const cachedUsers = utils.tenant.users.list.getData(userListInput);
  const shouldEnableUsersQuery = filters.activeView === 'preferences' || !cachedUsers;

  const { data: usersData } = api.tenant.users.list.useQuery(
    userListInput,
    {
      enabled: shouldEnableUsersQuery,
      staleTime: 10 * 60 * 1000, // 10분 동안 fresh 유지 (사용자 정보는 잦은 변동이 아님)
      refetchOnWindowFocus: false,
    }
  );

  const resolvedUsersData = usersData ?? cachedUsers;

  const updateTenantUsersCache = useCallback((
    userId: string,
    updater: (current: UserDataItem | undefined) => Partial<UserDataItem> | null | undefined
  ) => {
    utils.tenant.users.list.setData(userListInput, (previous) => {
      if (!previous?.items) {
        return previous;
      }

      let changed = false;
      const nextItems = previous.items.map((item) => {
        if (item.id !== userId) {
          return item;
        }

        const patch = updater(item as UserDataItem);
        if (!patch || Object.keys(patch).length === 0) {
          return item;
        }

        changed = true;
        return {
          ...item,
          ...patch,
        } as typeof item;
      });

      if (!changed) {
        return previous;
      }

      return {
        ...previous,
        items: nextItems,
      };
    });
  }, [userListInput, utils]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleCareerUpdate: EventListener = (event) => {
      const customEvent = event as CustomEvent<SSEEvent<'staff.career_updated'>>;
      const payload = customEvent.detail?.data;
      if (!payload?.careerInfo) {
        return;
      }

      const derivedYears =
        typeof payload.careerInfo.yearsOfService === 'number'
          ? Math.max(0, payload.careerInfo.yearsOfService)
          : typeof payload.careerInfo.hireYear === 'number'
            ? Math.max(0, new Date().getFullYear() - payload.careerInfo.hireYear)
            : undefined;

      setCareerOverrides(prev => {
        const previous = prev[payload.userId];
        if (
          previous &&
          previous.yearsOfService === derivedYears &&
          previous.hireYear === payload.careerInfo.hireYear
        ) {
          return prev;
        }
        return {
          ...prev,
          [payload.userId]: {
            yearsOfService: derivedYears,
            hireYear: payload.careerInfo.hireYear,
          },
        };
      });

      updateTenantUsersCache(payload.userId, () => {
        if (derivedYears === undefined) {
          return null;
        }
        return { yearsOfService: derivedYears };
      });
    };

    window.addEventListener('sse:staff.career_updated', handleCareerUpdate);
    return () => {
      window.removeEventListener('sse:staff.career_updated', handleCareerUpdate);
    };
  }, [updateTenantUsersCache]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStaffUpdated: EventListener = (event) => {
      const customEvent = event as CustomEvent<SSEEvent<'staff.updated'>>;
      const payload = customEvent.detail?.data;
      if (!payload?.changes) {
        return;
      }

      const rawHireDate = payload.changes.hireDate;
      let hireYear: number | undefined;
      if (rawHireDate instanceof Date) {
        hireYear = rawHireDate.getFullYear();
      } else if (typeof rawHireDate === 'string') {
        const parsed = new Date(rawHireDate);
        if (!Number.isNaN(parsed.getTime())) {
          hireYear = parsed.getFullYear();
        }
      }

      const years = typeof payload.changes.yearsOfService === 'number'
        ? Math.max(0, payload.changes.yearsOfService)
        : undefined;

      if (hireYear === undefined && years === undefined) {
        return;
      }

      setCareerOverrides(prev => ({
        ...prev,
        [payload.userId]: {
          yearsOfService: years ?? prev[payload.userId]?.yearsOfService,
          hireYear: hireYear ?? prev[payload.userId]?.hireYear,
        },
      }));

      updateTenantUsersCache(payload.userId, (current) => {
        if (!payload.changes) {
          return null;
        }

        const changes = payload.changes as Record<string, unknown>;
        const patch: Partial<UserDataItem> = {};

        if (typeof changes.name === 'string') {
          patch.name = changes.name;
        }
        if (typeof changes.email === 'string') {
          patch.email = changes.email;
        }
        if (typeof changes.role === 'string') {
          patch.role = changes.role;
        }
        if (typeof changes.status === 'string') {
          patch.status = changes.status;
        }
        if (typeof changes.position === 'string' || changes.position === null) {
          patch.position = changes.position as string | null | undefined;
        }
        if (typeof changes.teamId === 'string' || changes.teamId === null) {
          patch.teamId = changes.teamId as string | null | undefined;
        }
        if (changes.departmentId === null || typeof changes.departmentId === 'string') {
          patch.departmentId = changes.departmentId as string | null | undefined;
        }
        if (typeof changes.hireDate === 'string' || changes.hireDate instanceof Date) {
          patch.hireDate = changes.hireDate as string | Date | undefined;
        }
        if (typeof changes.yearsOfService === 'number') {
          patch.yearsOfService = Math.max(0, changes.yearsOfService);
        }
        if (changes.department && typeof changes.department === 'object') {
          patch.department = {
            name: (changes.department as { name?: string })?.name ?? current?.department?.name ?? '',
          };
        }

        if (changes.profile && typeof changes.profile === 'object') {
          patch.profile = {
            ...current?.profile,
            ...(changes.profile as { phone?: string | null }),
          };
        }

        return Object.keys(patch).length > 0 ? patch : null;
      });
    };

    window.addEventListener('sse:staff.updated', handleStaffUpdated);
    return () => {
      window.removeEventListener('sse:staff.updated', handleStaffUpdated);
    };
  }, [updateTenantUsersCache]);

  // ✅ Prefetch all staff preferences (모든 직원의 선호도 미리 불러오기)
  const { data: allPreferencesMap } = api.preferences.listAll.useQuery(
    undefined,
    {
      enabled: true,
      staleTime: 5 * 60 * 1000, // 5분 동안 fresh 유지 (선호도는 자주 변경되지 않음)
      refetchOnWindowFocus: false,
    }
  );

  const [shouldPrefetchFullData, setShouldPrefetchFullData] = useState(false);
  const isScheduleViewActive = deferredActiveView === 'schedule';
  const isTodayViewActive = deferredActiveView === 'today';

  const requestFullDataPrefetch = useCallback(() => {
    setShouldPrefetchFullData((prev) => (prev ? prev : true));
  }, []);

  const handleViewIntent = useCallback((view: ScheduleView) => {
    if (view === 'schedule') {
      requestFullDataPrefetch();
    }
  }, [requestFullDataPrefetch]);

  useEffect(() => {
    if (isScheduleViewActive) {
      requestFullDataPrefetch();
    }
  }, [isScheduleViewActive, requestFullDataPrefetch]);

  const shouldLoadFullScheduleData = shouldPrefetchFullData || isScheduleViewActive || isTodayViewActive;

  // ✅ Load full month schedule only when 필요 또는 백그라운드 프리패치
  const needsFullSchedule = shouldLoadFullScheduleData;
  const scheduleListQuery = api.schedule.list.useQuery({
    departmentId: (isManager || isMember) && memberDepartmentId ? memberDepartmentId :
                  selectedDepartment !== 'all' && selectedDepartment !== 'no-department' ? selectedDepartment : undefined,
    status: isMember ? 'published' : undefined, // Members only see published, managers/admins see all including drafts
    startDate: monthStart,
    endDate: monthEnd,
    includeMetadata: true, // Need full metadata for assignments
  }, {
    enabled: needsFullSchedule, // 필요한 경우에만 로드
    staleTime: 5 * 60 * 1000, // 5분 동안 fresh 유지
    refetchOnWindowFocus: false, // 탭 전환 시 refetch 비활성화
  });
  const savedSchedules = scheduleListQuery.data;
  const isScheduleQueryLoading = shouldLoadFullScheduleData && (
    scheduleListQuery.status === 'pending' ||
    (scheduleListQuery.isFetching && !scheduleListQuery.data)
  );
  const isTodayViewLoading = isTodayViewActive && isScheduleQueryLoading;
  const isScheduleViewLoading = isScheduleViewActive && isScheduleQueryLoading;
  useEffect(() => {
    if (isScheduleQueryLoading) {
      setToolbarAnimatedIn(false);
    } else {
      setToolbarAnimatedIn(true);
    }
  }, [isScheduleQueryLoading]);

  // ✅ Derive today's assignments from loaded schedule to avoid 반복 fetch
  const todayAssignments = React.useMemo(() => {
    if (schedule.length === 0) return [];
    const targetDateStr = format(selectedDate, 'yyyy-MM-dd');
    return schedule.filter(assignment => format(assignment.date, 'yyyy-MM-dd') === targetDateStr);
  }, [schedule, selectedDate]);
  const hasSchedule = schedule.length > 0;

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
      // No saved schedule, clear cached state only if previously set
      setLoadedScheduleId((prev) => (prev === null ? prev : null));
      lastLoadedRef.current = null;
      setSchedule((prev) => (prev.length === 0 ? prev : []));
      setOriginalSchedule((prev) => (prev.length === 0 ? prev : []));
      setIsConfirmed(false);
      setGenerationResult(null);
      setOffAccrualSummaries((prev) => (prev.length === 0 ? prev : []));
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
      setLoadedScheduleId((prev) => (prev === null ? prev : null));
      lastLoadedRef.current = null;
      setSchedule((prev) => (prev.length === 0 ? prev : []));
      setOriginalSchedule((prev) => (prev.length === 0 ? prev : []));
      setIsConfirmed(false);
      setGenerationResult(null);
      setOffAccrualSummaries((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    // ✅ Skip if already loaded this exact version (same ID and updatedAt)
    const currentUpdatedAt = currentMonthSchedule.updatedAt?.toString() || '';
    if (lastLoadedRef.current?.id === currentMonthSchedule.id &&
        lastLoadedRef.current?.updatedAt === currentUpdatedAt) {
      return;
    }

    // Extract assignments from metadata
    const metadata = currentMonthSchedule.metadata as ScheduleMetadata;
    const assignments = metadata?.assignments || [];

    if (assignments.length > 0) {
      // Convert DB assignments to ScheduleAssignment format
      const convertedAssignments: ScheduleAssignment[] = assignments.map((a: DbAssignment) => ({
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
        setOffAccrualSummaries((metadata?.offAccruals as OffAccrualSummary[] | undefined) ?? []);
        setIsConfirmed(currentMonthSchedule.status === 'published'); // Only confirmed if published
        setLoadedScheduleId(currentMonthSchedule.id);
        lastLoadedRef.current = { id: currentMonthSchedule.id, updatedAt: currentUpdatedAt };
        if (currentMonthSchedule.departmentId && !isMember) {
          setSelectedDepartment(prev => (
            prev === currentMonthSchedule.departmentId ? prev : currentMonthSchedule.departmentId!
          ));
        }
        console.log(`✅ Loaded ${convertedAssignments.length} assignments from ${currentMonthSchedule.status} schedule ${currentMonthSchedule.id} (updated: ${currentMonthSchedule.updatedAt})`);
      });
    } else {
      setOffAccrualSummaries([]);
    }
  }, [savedSchedules, monthStart, canManageSchedules, isMember, setSelectedDepartment]);

  const deriveShiftTypeFromId = (shiftId: string) => {
    if (!shiftId) {
      return 'CUSTOM';
    }

    const trimmed = shiftId.trim();
    const withoutPrefix = trimmed.startsWith('shift-') ? trimmed.slice(6) : trimmed;
    const upper = withoutPrefix.toUpperCase();

    if (upper === 'OFF') {
      return 'O';
    }

    return upper || 'CUSTOM';
  };

  const currentMonthAssignments = React.useMemo(() => {
    const targetMonthKey = format(monthStart, 'yyyy-MM');
    return schedule.filter((assignment) => {
      const assignmentDate = normalizeDate(assignment.date);
      return format(assignmentDate, 'yyyy-MM') === targetMonthKey;
    });
  }, [schedule, monthStart]);

  const toStableDateISOString = React.useCallback((value: Date | string) => {
    const date = normalizeDate(value);
    const stable = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0));
    return stable.toISOString();
  }, []);
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
      startDate: toStableDateISOString(monthStart),
      endDate: toStableDateISOString(monthEnd),
      assignments: currentMonthAssignments.map(assignment => ({
        employeeId: assignment.employeeId,
        shiftId: assignment.shiftId,
        date: toStableDateISOString(assignment.date),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        isLocked: (assignment as any).isLocked ?? false,
        shiftType: deriveShiftTypeFromId(assignment.shiftId),
      })),
      status: 'draft' as const,
    };
  };

  useEffect(() => {
    if (!isMember) {
      return;
    }

    const targetDepartment = memberDepartmentId ?? 'no-department';
    setSelectedDepartment(prev => (prev === targetDepartment ? prev : targetDepartment));
  }, [isMember, memberDepartmentId, setSelectedDepartment]);

  // member 권한은 '오늘의 근무' 탭을 기본으로 설정
  useEffect(() => {
    if (isMember && filters.activeView === 'preferences') {
      filters.setActiveView('today');
    } else if (!canViewStaffPreferences && filters.activeView === 'preferences') {
      filters.setActiveView('today');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMember, canViewStaffPreferences, filters.activeView]);

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
    staleTime: 2 * 60 * 60 * 1000, // 2시간 동안 캐시
    gcTime: 2.5 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  // Load shift config (나이트 집중 근무 유급 휴가 설정 등)
  const { data: shiftConfigData } = api.configs.getByKey.useQuery({
    configKey: 'shiftConfig',
    departmentId: configDepartmentId, // Use department-specific config
  }, {
    staleTime: 60 * 60 * 1000, // 1시간 동안 fresh 유지
    gcTime: 65 * 60 * 1000,
    refetchOnWindowFocus: false, // 탭 전환 시 refetch 비활성화
    refetchOnReconnect: true,
    refetchOnMount: true,
  });

  const nightLeaveSetting = React.useMemo(() => {
    const shiftConfigValue = (shiftConfigData?.configValue ?? {}) as {
      preferences?: { nightIntensivePaidLeaveDays?: number };
      nightIntensivePaidLeaveDays?: number;
    };
    return (
      shiftConfigValue.preferences?.nightIntensivePaidLeaveDays ??
      shiftConfigValue.nightIntensivePaidLeaveDays ??
      0
    );
  }, [shiftConfigData]);

  // Fetch teams from database
  const { data: dbTeams = [] } = api.teams.getAll.useQuery(undefined, {
    staleTime: 60 * 60 * 1000, // 1시간 동안 fresh 유지
    refetchOnWindowFocus: false, // 탭 전환 시 refetch 비활성화
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (isLoadingShiftTypesConfig) {
      console.log('⏳ shiftTypesConfig 로딩 중 - 기존 커스텀 시프트 유지');
      return;
    }

    console.log('📥 shiftTypesConfig changed:', shiftTypesConfig);

    if (shiftTypesConfig?.configValue && Array.isArray(shiftTypesConfig.configValue) && shiftTypesConfig.configValue.length > 0) {
      // Transform from tenant_configs format to CustomShiftType format
      const transformedShiftTypes = shiftTypesConfig.configValue.map((st: ConfigShiftType) => ({
        code: st.code,
        name: st.name,
        startTime: st.startTime,
        endTime: st.endTime,
        color: st.color,
        allowOvertime: (st as ConfigShiftType & { allowOvertime?: boolean }).allowOvertime ?? false, // Default value for backward compatibility
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

  // Listen for SSE shift type updates to refresh filters immediately
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleShiftTypesUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<SSEEvent<'config.shift_types_updated'>>;
      const payload = customEvent.detail?.data;
      if (!payload || !Array.isArray(payload.shiftTypes)) {
        return;
      }

      const targetDept = payload.departmentId ?? null;
      const currentDept = configDepartmentId ?? null;
      const selectedDeptForView =
        selectedDepartment !== 'all' && selectedDepartment !== 'no-department'
          ? selectedDepartment
          : null;

      const shouldUpdate =
        targetDept === null ||
        targetDept === currentDept ||
        (currentDept === null && targetDept === selectedDeptForView);

      if (shouldUpdate) {
        const transformedShiftTypes = payload.shiftTypes.map((raw) => {
          const st = raw as ConfigShiftType;
          return {
            code: st?.code ?? '',
            name: st?.name ?? '',
            startTime: st?.startTime ?? '00:00',
            endTime: st?.endTime ?? '00:00',
            color: st?.color ?? '#A3A3A3',
            allowOvertime: (st as ConfigShiftType & { allowOvertime?: boolean })?.allowOvertime ?? false,
          };
        });

        setCustomShiftTypes(prev => equal(prev, transformedShiftTypes) ? prev : transformedShiftTypes);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('customShiftTypes', JSON.stringify(transformedShiftTypes));
        }
      }

      void utils.configs.getByKey.invalidate({
        configKey: 'shift_types',
        departmentId: configDepartmentId,
      });
    };

    window.addEventListener('sse:config.shift_types_updated', handleShiftTypesUpdate);
    return () => window.removeEventListener('sse:config.shift_types_updated', handleShiftTypesUpdate);
  }, [configDepartmentId, selectedDepartment, utils]);

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

  // Load special requests for the current month
  const shouldLoadSpecialRequests = shouldLoadFullScheduleData || modals.isPreferencesModalOpen;

  const { data: specialRequestsData } = api.specialRequests.getByDateRange.useQuery({
    startDate: format(monthStart, 'yyyy-MM-dd'),
    endDate: format(monthEnd, 'yyyy-MM-dd'),
  }, {
    enabled: shouldLoadSpecialRequests,
    staleTime: 5 * 60 * 1000, // 5분 동안 fresh 유지 (요청은 자주 변경될 수 있음)
    refetchOnWindowFocus: false, // 탭 전환 시 refetch 비활성화
  });

  // Transform users data to match expected format
  // 전체 멤버 리스트 (필터링 없음 - 직원 선호사항 탭에서 사용)
  const allMembers = React.useMemo((): UnifiedEmployee[] => {
    if (!resolvedUsersData?.items) return [];

    return (resolvedUsersData.items as UserDataItem[]).map((item: UserDataItem): UnifiedEmployee => {
      const override = careerOverrides[item.id];
      const yearsOfService = override?.yearsOfService ?? calculateYearsOfService(item);
      const joinDateSource = item.hireDate ?? item.createdAt;
      const joinDate = joinDateSource ? new Date(joinDateSource).toISOString() : new Date().toISOString();

      return {
        id: item.id,
        name: item.name,
        email: item.email,
        role: item.role as 'admin' | 'manager' | 'staff',
        departmentId: item.departmentId || '',
        department: item.department?.name || '',
        status: (item.status === 'on_leave' ? 'on-leave' : item.status) as 'active' | 'inactive' | 'on-leave',
        position: item.position || '',
        joinDate,
        yearsOfService,
        avatar: '',
        phone: item.profile?.phone || '',
        teamId: item.teamId || null,
      };
    });
  }, [resolvedUsersData, careerOverrides]);

  const employeeNameMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    allMembers.forEach((member) => {
      const displayName = member.name || '이름 미등록';
      map[member.id] = displayName;
    });
    return map;
  }, [allMembers]);

  // 필터링된 멤버 리스트 (나의 스케줄만 보기 적용 - 스케줄 보기 탭에서 사용)
  const filteredMembers = React.useMemo(() => {
    let members = [...allMembers];

    // member가 "나의 스케줄만 보기"를 체크한 경우
    if ((isMember || isManager) && filters.showMyScheduleOnly && currentUser.dbUser?.id) {
      members = members.filter(member => member.id === currentUser.dbUser?.id);
    }

    // "나와 같은 스케줄 보기"를 체크한 경우
    if ((isMember || isManager) && filters.showSameSchedule && currentUser.dbUser?.id && hasSchedule) {
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
  }, [allMembers, isMember, isManager, filters.showMyScheduleOnly, filters.showSameSchedule, currentUser.dbUser?.id, schedule, hasSchedule]);

  const handlePreviousMonth = React.useCallback(() => {
    setCurrentMonth(prev => subMonths(prev, 1));
    setSchedule([]);
    setGenerationResult(null);
    setOffAccrualSummaries([]);
    setLoadedScheduleId(null); // ✅ Reset to allow loading new month's schedule
  }, []);

  const handleNextMonth = React.useCallback(() => {
    setCurrentMonth(prev => addMonths(prev, 1));
    setSchedule([]);
    setGenerationResult(null);
    setOffAccrualSummaries([]);
    setLoadedScheduleId(null); // ✅ Reset to allow loading new month's schedule
  }, []);

  const handleThisMonth = React.useCallback(() => {
    setCurrentMonth(startOfMonth(new Date()));
    setSchedule([]);
    setGenerationResult(null);
    setOffAccrualSummaries([]);
    setLoadedScheduleId(null); // ✅ Reset to allow loading current month's schedule
  }, []);

  const handleToggleSwapMode = React.useCallback(() => {
    setShowScheduleSwapModal(true);
  }, []);

  const handleCloseGenerationResult = React.useCallback(() => {
    setGenerationResult(null);
    setOffAccrualSummaries([]);
  }, []);

  const handleScheduleNameChange = (value: string) => {
    setScheduleName(value);
  };

  const handleSwapRequest = (myShift: SwapShift, targetShift: SwapShift) => {
    setSwapRequestData({ myShift, targetShift });
    setShowSwapRequestModal(true);
  };

  const handleSwapSubmit = (reason: string) => {
    console.log('Swap request submitted:', reason, swapRequestData);
    setShowSwapRequestModal(false);
    setSwapRequestData(null);
    alert('교환 요청이 제출되었습니다. 승인 대기 상태입니다.');
  };

  // Handle employee card click to open preferences modal
  const handleEmployeeClick = async (member: UnifiedEmployee) => {
    // 1️⃣ 현재 화면의 데이터로 모달을 연다
    const employee = toEmployee(member);

    // ✅ 캐시된 선호도 데이터 사용 (API 호출 없음!)
    const cachedPrefs = allPreferencesMap?.[member.id];
    if (cachedPrefs) {
      const simplifiedPrefs: SimplifiedPreferences = {
        workPatternType: cachedPrefs.workPatternType as 'three-shift' | 'night-intensive' | 'weekday-only' || 'three-shift',
        preferredPatterns: cachedPrefs.preferredPatterns || [],
        avoidPatterns: cachedPrefs.avoidPatterns || [],
      };
      employee.workPatternType = simplifiedPrefs.workPatternType;
      setSelectedPreferences(simplifiedPrefs);
      console.log('✅ Loaded cached preferences for', member.name);
    } else {
      console.log('ℹ️ No preferences found for', member.name);
      setSelectedPreferences(null);
    }

    setSelectedEmployee(employee);
    modals.setIsPreferencesModalOpen(true);
  };

  // ✅ tRPC mutation with Optimistic Update for instant UI feedback
  const savePreferencesMutation = api.preferences.upsert.useMutation({
    onMutate: async (newPreferences) => {
      // 🚀 Cancel outgoing refetches to avoid overwriting optimistic update
      await utils.preferences.listAll.cancel();

      // Snapshot current state for rollback
      const previousPreferences = utils.preferences.listAll.getData();

      // 🚀 Optimistically update cache immediately
      utils.preferences.listAll.setData(undefined, (old) => {
        if (!old) return old;
        return {
          ...old,
          [newPreferences.staffId]: {
            id: old[newPreferences.staffId]?.id || crypto.randomUUID(),
            tenantId: old[newPreferences.staffId]?.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d',
            nurseId: newPreferences.staffId,
            departmentId: old[newPreferences.staffId]?.departmentId || null,
            workPatternType: newPreferences.workPatternType || 'three-shift',
            preferredPatterns: newPreferences.preferredPatterns || [],
            avoidPatterns: newPreferences.avoidPatterns || [],
            createdAt: old[newPreferences.staffId]?.createdAt || new Date(),
            updatedAt: new Date(),
          },
        };
      });

      console.log('🚀 Optimistic update applied instantly');

      return { previousPreferences };
    },
    onError: (error, _variables, context) => {
      // ⏪ Rollback on error
      if (context?.previousPreferences) {
        utils.preferences.listAll.setData(undefined, context.previousPreferences);
        console.log('⏪ Rolled back due to error');
      }
      console.error('❌ Error saving preferences:', error);
      alert('선호도 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    },
    onSuccess: () => {
      console.log('✅ Preferences saved to server');
    },
    onSettled: () => {
      // Refetch in background to sync with server (non-blocking)
      void utils.preferences.listAll.invalidate();
    },
  });

  // Handle preferences save
  const handlePreferencesSave = (preferences: ExtendedEmployeePreferences) => {
    if (!selectedEmployee) return;

    const employeeSnapshot = selectedEmployee;

    console.log('💾 Saving preferences for', employeeSnapshot.name);

    // 🚀 Mutate with optimistic update (non-blocking)
    savePreferencesMutation.mutate({
      staffId: employeeSnapshot.id,
      workPatternType: preferences.workPatternType,
      preferredPatterns: (preferences.preferredPatterns || []).map(p =>
        typeof p === 'string' ? { pattern: p, preference: 5 } : p
      ),
      avoidPatterns: preferences.avoidPatterns,
    });
  };

  // Handle modal close
  const handleModalClose = () => {
    modals.setIsPreferencesModalOpen(false);
    setSelectedEmployee(null);
    setSelectedPreferences(null);
    void utils.tenant.users.list.invalidate();
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
  const shouldLoadOffBalance = (
    (shouldLoadFullScheduleData && displayMemberIds.length > 0) ||
    modals.isPreferencesModalOpen
  );

  const offBalanceDepartmentId = React.useMemo(() => {
    if (isManager || isMember) {
      return memberDepartmentId || undefined;
    }
    if (selectedDepartment !== 'all' && selectedDepartment !== 'no-department') {
      return selectedDepartment;
    }
    return undefined;
  }, [isManager, isMember, memberDepartmentId, selectedDepartment]);

  const { data: offBalanceData } = api.offBalance.getBulkCurrentBalance.useQuery({
    employeeIds: displayMemberIds,
    departmentId: offBalanceDepartmentId,
  }, {
    enabled: shouldLoadOffBalance,
  });

  // Convert off-balance data to Map for easy lookup
  type OffBalanceEntry = {
    accumulatedOffDays: number;
    allocatedToAccumulation: number;
    allocatedToAllowance: number;
    allocationStatus?: string | null;
    departmentId?: string | null;
    pendingExtraOffDays?: number;
  };

  const offBalanceMap = React.useMemo(() => {
    const map = new Map<string, OffBalanceEntry>();
    if (offBalanceData) {
      offBalanceData.forEach(item => {
        map.set(item.nurseId, {
          accumulatedOffDays: item.accumulatedOffDays || 0,
          allocatedToAccumulation: item.allocatedToAccumulation || 0,
          allocatedToAllowance: item.allocatedToAllowance || 0,
          allocationStatus: item.allocationStatus,
          departmentId: item.departmentId,
        });
      });
    }
    if (offAccrualSummaries.length > 0) {
      offAccrualSummaries.forEach(record => {
        const entry = map.get(record.employeeId) || {
          accumulatedOffDays: 0,
          allocatedToAccumulation: 0,
          allocatedToAllowance: 0,
          allocationStatus: 'pending',
          departmentId: offBalanceDepartmentId ?? null,
        };
        entry.pendingExtraOffDays = (entry.pendingExtraOffDays || 0) + record.extraOffDays;
        map.set(record.employeeId, entry);
      });
    }
    return map;
  }, [offBalanceData, offAccrualSummaries, offBalanceDepartmentId]);

  const recomputeOffAccrualSummaries = React.useCallback((): OffAccrualSummary[] => {
    if (currentMonthAssignments.length === 0) {
      return [];
    }

    const dateRange = eachDayOfInterval({ start: monthStart, end: monthEnd });
    if (dateRange.length === 0) {
      return [];
    }

    const restDayCount = dateRange.reduce((count, date) => {
      const key = format(date, 'yyyy-MM-dd');
      if (isWeekend(date) || holidayDates.has(key)) {
        return count + 1;
      }
      return count;
    }, 0);

    const baseGuarantee = restDayCount;
    const carryOverMap = new Map<string, number>();
    (offBalanceData ?? []).forEach((entry) => {
      const remainingOffDays =
        (entry as { remainingOffDays?: number }).remainingOffDays;
      const carryOver = Math.max(0, entry.accumulatedOffDays ?? remainingOffDays ?? 0);
      carryOverMap.set(entry.nurseId, carryOver);
    });

    const memberMap = new Map(filteredMembers.map(member => [member.id, member]));
    const offCounts = new Map<string, number>();
    const employeeIds = new Set<string>();

    currentMonthAssignments.forEach((assignment) => {
      employeeIds.add(assignment.employeeId);
      const shiftCode =
        (assignment.shiftType?.toUpperCase() ?? deriveShiftTypeFromId(assignment.shiftId)) || 'CUSTOM';
      if (shiftCode === 'O' || shiftCode === 'OFF') {
        offCounts.set(assignment.employeeId, (offCounts.get(assignment.employeeId) ?? 0) + 1);
      }
    });

    const summaries: OffAccrualSummary[] = [];
    employeeIds.forEach((employeeId) => {
      const member = memberMap.get(employeeId);
      const workPatternType =
        member?.simplifiedPreferences?.workPatternType ??
        member?.workPatternType ??
        'three-shift';
      const nightLeaveDays =
        workPatternType === 'night-intensive' ? Math.max(0, nightLeaveSetting) : 0;
      const carryOver = carryOverMap.get(employeeId) ?? 0;
      const guaranteedOffDays = baseGuarantee + nightLeaveDays + carryOver;
      const actualOffDays = offCounts.get(employeeId) ?? 0;

      summaries.push({
        employeeId,
        guaranteedOffDays,
        actualOffDays,
        extraOffDays: Math.max(0, guaranteedOffDays - actualOffDays),
      });
    });

    console.log('[OffBalance] Recomputed off accrual summaries', {
      employeeCount: summaries.length,
      baseGuarantee,
    });

    return summaries;
  }, [
    currentMonthAssignments,
    filteredMembers,
    offBalanceData,
    holidayDates,
    nightLeaveSetting,
    monthStart,
    monthEnd,
  ]);

  React.useEffect(() => {
    if (currentMonthAssignments.length === 0) {
      setOffAccrualSummaries([]);
      return;
    }
    const refreshed = recomputeOffAccrualSummaries();
    setOffAccrualSummaries(refreshed);
  }, [currentMonthAssignments, recomputeOffAccrualSummaries]);

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
      const preferencesResponse = await fetchWithAuth('/api/preferences');
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

      // Use regular fetch for public validate endpoint (no auth required)
      const response = await fetch('/api/schedule/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      const convertedAssignments: ScheduleAssignment[] = assignments.map((a: DbAssignment) => ({
        id: a.id || `${a.employeeId}-${a.date}`,
        employeeId: a.employeeId,
        shiftId: a.shiftId,
        date: new Date(a.date),
        isLocked: a.isLocked || false,
        shiftType: a.shiftType,
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

  const handleManagerCellClick = useCallback((
    date: Date,
    employeeId: string,
    assignment: { employeeId: string; shiftId: string; isSwapRequested?: boolean } | null
  ) => {
    if (!canManageSchedules) {
      return;
    }
    setEditingCell({
      date,
      employeeId,
      currentShift: assignment as Assignment ?? undefined,
    });
    setShowEditShiftModal(true);
  }, [canManageSchedules]);

  const handleShiftChange = (newShiftId: string) => {
    if (!editingCell) return;
    const targetDate = format(editingCell.date, 'yyyy-MM-dd');
    setSchedule(prev => prev.map((assignment) => {
      const assignmentDate = format(new Date(assignment.date), 'yyyy-MM-dd');
      if (assignment.employeeId === editingCell.employeeId && assignmentDate === targetDate) {
        return { ...assignment, shiftId: newShiftId };
      }
      return assignment;
    }));
    setShowEditShiftModal(false);
    setEditingCell(null);
  };

  const handleConfirmToggle = async () => {
    let validDepartmentId: string | null = selectedDepartment;

    if (selectedDepartment === 'all' || selectedDepartment === 'no-department') {
      if (isMember || isManager) {
        validDepartmentId = currentUser.dbUser?.departmentId || null;
      } else {
        alert('스케줄을 확정하려면 부서를 선택해주세요.');
        return;
      }
    }

    if (!validDepartmentId) {
      alert('부서 정보가 없습니다.');
      return;
    }

    setIsPreparingConfirmation(true);
    modals.setShowConfirmDialog(true);

    try {
      const existingCheck = await utils.schedule.checkExisting.fetch({
        departmentId: validDepartmentId,
        startDate: monthStart,
        endDate: endOfMonth(monthStart),
      });

      if (existingCheck.hasExisting && existingCheck.schedules.length > 0) {
        const existingSchedule = existingCheck.schedules[0];
        setExistingScheduleToReplace({
          id: existingSchedule.id,
          startDate: new Date(existingSchedule.startDate),
          endDate: new Date(existingSchedule.endDate),
          publishedAt: existingSchedule.publishedAt ? new Date(existingSchedule.publishedAt) : null,
        });
      } else {
        setExistingScheduleToReplace(null);
      }
    } catch (error) {
      console.error('Error checking existing schedules:', error);
      setExistingScheduleToReplace(null);
    } finally {
      setIsPreparingConfirmation(false);
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
      // Delete existing schedule if present
      if (existingScheduleToReplace) {
        try {
          await deleteMutation.mutateAsync({ id: existingScheduleToReplace.id });
          console.log(`✅ Deleted existing schedule: ${existingScheduleToReplace.id}`);
        } catch (deleteError) {
          console.error(`❌ Failed to delete existing schedule:`, deleteError);
          alert(`기존 스케줄 삭제 실패: ${deleteError instanceof Error ? deleteError.message : '알 수 없는 오류'}`);
          modals.setIsConfirming(false);
          return;
        }
      }

      const schedulePayload = buildSchedulePayload();
      const ensuredOffAccruals = recomputeOffAccrualSummaries();
      setOffAccrualSummaries(ensuredOffAccruals);

      // 스케줄 명이 입력되지 않은 경우 기본값 설정
      const finalScheduleName = scheduleName.trim() || `${format(monthStart, 'yyyy년 M월')} 스케줄`;

      const response = await fetchWithAuth('/api/schedule/confirm', {
        method: 'POST',
        body: JSON.stringify({
          scheduleId: schedulePayload.id,
          schedule: schedulePayload,
          scheduleName: finalScheduleName, // 스케줄 명 추가
          month: format(monthStart, 'yyyy-MM-dd'),
          departmentId: validDepartmentId,
          notifyEmployees: true,
          metadata: {
            createdBy: currentUserId,
            createdAt: new Date().toISOString(),
            validationScore: modals.validationScore,
            offAccruals: ensuredOffAccruals,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (Array.isArray(result.offBalanceDebug)) {
          result.offBalanceDebug.forEach((entry: { message?: string; data?: Record<string, unknown> }) => {
            const msg = entry?.message || 'OffBalance debug';
            const data = entry?.data ?? {};
            // eslint-disable-next-line no-console
            console.log(`[OffBalance] ${msg}`, data);
          });
        }

        modals.setShowConfirmDialog(false);
        setScheduleName(''); // 스케줄 명 초기화
        setExistingScheduleToReplace(null); // Clear existing schedule state

        // ✅ Invalidate related queries to refresh UI immediately
        await Promise.all([
          utils.schedule.invalidate(),
          utils.offBalance.getBulkCurrentBalance.invalidate(),
          utils.offBalance.getByEmployee.invalidate(),
        ]);

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

    setIsSavingDraft(true);
    try {
      const schedulePayload = buildSchedulePayload();

      const response = await fetchWithAuth('/api/schedule/save-draft', {
        method: 'POST',
        body: JSON.stringify({
          schedule: schedulePayload,
          month: format(monthStart, 'yyyy-MM-dd'),
          departmentId: validDepartmentId,
          name: `임시 저장 - ${format(monthStart, 'yyyy년 MM월')}`,
          metadata: {
            createdBy: currentUserId,
            createdAt: new Date().toISOString(),
            offAccruals: offAccrualSummaries,
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
    finally {
      setIsSavingDraft(false);
    }
  };

  // 스케줄 생성 시작 핸들러
  const handleInitiateScheduleGeneration = () => {
    if (!canManageSchedules) {
      alert('스케줄 생성 권한이 없습니다.');
      return;
    }

    if (filteredMembers.length === 0) {
      alert('선택된 부서에 활성 직원이 없습니다.');
      return;
    }

    void handleGenerateSchedule();
  };

  const handleGenerateSchedule = async (shiftRequirements?: Record<string, number>) => {
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
    setOffAccrualSummaries([]);

    try {
      // 1. Get active shift types
      let activeCustomShiftTypes = customShiftTypes;
      if (!activeCustomShiftTypes || activeCustomShiftTypes.length === 0) {
        if (shiftTypesConfig?.configValue && Array.isArray(shiftTypesConfig.configValue) && shiftTypesConfig.configValue.length > 0) {
          activeCustomShiftTypes = shiftTypesConfig.configValue.map((st: ConfigShiftType) => ({
            code: st.code,
            name: st.name,
            startTime: st.startTime,
            endTime: st.endTime,
            color: st.color,
            allowOvertime: (st as ConfigShiftType & { allowOvertime?: boolean }).allowOvertime ?? false,
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

      activeCustomShiftTypes = activeCustomShiftTypes ?? [];

      const preferencesResponse = await fetchWithAuth('/api/preferences');
      const preferencesData = await preferencesResponse.json();
      const preferencesMap = new Map<string, SimplifiedPreferences>();
      if (preferencesData.success && preferencesData.data) {
        Object.entries(preferencesData.data).forEach(([employeeId, prefs]) => {
          preferencesMap.set(employeeId, prefs as SimplifiedPreferences);
        });
      }

    const inferredDepartmentId =
      currentUser.dbUser?.departmentId ||
      memberDepartmentId ||
      (filteredMembers[0]?.departmentId ?? '') ||
      selectedDepartment ||
      '';

    if (!inferredDepartmentId) {
      alert('해당 계정에 부서가 연결되어 있지 않아 스케줄을 생성할 수 없습니다. 관리자에게 문의하세요.');
      setIsGenerating(false);
      return;
    }

      // 2. Load department pattern and use provided shift requirements
      let teamPattern: TeamPattern | null = null;
      try {
        const teamPatternResponse = await fetch(`/api/department-patterns?departmentId=${inferredDepartmentId}`);
        const teamPatternData = await teamPatternResponse.json() as TeamPattern & { pattern?: TeamPattern; defaultPattern?: TeamPattern };
        teamPattern = teamPatternData.pattern || teamPatternData.defaultPattern || teamPatternData;

        // Override with provided shift requirements
        if (teamPattern && shiftRequirements) {
          teamPattern.requiredStaffByShift = shiftRequirements;
          // Update legacy fields for backward compatibility
          teamPattern.requiredStaffDay = shiftRequirements['D'] || 5;
          teamPattern.requiredStaffEvening = shiftRequirements['E'] || 4;
          teamPattern.requiredStaffNight = shiftRequirements['N'] || 3;
        }
      } catch (error) {
        console.warn('Failed to load department pattern:', error);
      }

      let simpleSpecialRequests: Array<{
        employeeId: string;
        requestType: string;
        date: string;
        shiftTypeCode?: string;
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
        const specialRequestsData = await specialRequestsResponse.json() as Array<{ result?: { data?: { json?: SpecialRequest[] } } }>;
        if (specialRequestsData && specialRequestsData[0]?.result?.data?.json) {
          simpleSpecialRequests = specialRequestsData[0].result.data.json.map((req: SpecialRequest) => ({
            employeeId: req.employeeId,
            requestType: req.requestType,
            date: req.date,
            shiftTypeCode: req.shiftTypeCode ?? undefined,
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
      for (const unified of unifiedEmployees) {
        const employee = EmployeeAdapter.toSchedulerEmployee(unified);
        employees.push(employee);
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
        const holidaysData = await holidaysResponse.json() as Array<{ result?: { data?: { json?: Holiday[] } } }>;
        if (holidaysData && holidaysData[0]?.result?.data?.json) {
          holidays = holidaysData[0].result.data.json.map((h: Holiday) => ({
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

      const requiredStaffPerShift = teamPattern
        ? (() => {
            const baseMap: Record<string, number> = teamPattern.requiredStaffByShift
              ? { ...teamPattern.requiredStaffByShift }
              : {
                  D: (teamPattern.requiredStaffDay as number) || 5,
                  E: (teamPattern.requiredStaffEvening as number) || 4,
                  N: (teamPattern.requiredStaffNight as number) || 3,
                };
            ['D', 'E', 'N'].forEach((code, index) => {
              if (typeof baseMap[code] !== 'number') {
                baseMap[code] = [5, 4, 3][index];
              }
            });
            return baseMap;
          })()
        : undefined;

      const configShiftOverrides = new Map<string, ShiftType>();
      if (shiftTypesConfig?.configValue && Array.isArray(shiftTypesConfig.configValue)) {
        shiftTypesConfig.configValue.forEach((st: ConfigShiftType) => {
          const normalizedCode = typeof st.code === 'string' ? st.code.toUpperCase() : '';
          if (!normalizedCode) return;
          configShiftOverrides.set(normalizedCode, {
            code: normalizedCode,
            name: st.name,
            startTime: st.startTime,
            endTime: st.endTime,
            color: st.color,
            allowOvertime: (st as ConfigShiftType & { allowOvertime?: boolean }).allowOvertime ?? false,
          });
        });
      }

      const shiftCodeSet = new Set<string>(STANDARD_AI_SHIFT_CODES);
      const registerShiftCode = (raw?: string | null) => {
        if (typeof raw !== 'string') return;
        const normalized = raw.trim().toUpperCase();
        if (!normalized) return;
        shiftCodeSet.add(normalized);
      };

      if (requiredStaffPerShift) {
        Object.keys(requiredStaffPerShift).forEach(registerShiftCode);
      }
      teamPattern?.defaultPatterns?.forEach(pattern => pattern.forEach(registerShiftCode));
      const legacyPattern = (teamPattern as { pattern?: string[] } | null)?.pattern;
      legacyPattern?.forEach(registerShiftCode);
      teamPattern?.avoidPatterns?.forEach(pattern => pattern.forEach(registerShiftCode));
      activeCustomShiftTypes?.forEach(st => registerShiftCode(st.code));
      configShiftOverrides.forEach((_, code) => registerShiftCode(code));

      const orderedShiftCodes: string[] = [];
      STANDARD_AI_SHIFT_CODES.forEach(code => orderedShiftCodes.push(code));
      const additionalCodes = Array.from(shiftCodeSet).filter(code => !STANDARD_AI_SHIFT_CODES.includes(code as StandardShiftCode));
      additionalCodes.sort();
      additionalCodes.forEach(code => orderedShiftCodes.push(code));

      const generationShiftTypes: ShiftType[] = [];
      orderedShiftCodes.forEach(code => {
        const normalized = code.toUpperCase();
        if (configShiftOverrides.has(normalized)) {
          generationShiftTypes.push(configShiftOverrides.get(normalized)!);
          return;
        }
        const fallbackShift = activeCustomShiftTypes?.find(
          shift => typeof shift.code === 'string' && shift.code.toUpperCase() === normalized
        );
        if (fallbackShift) {
          generationShiftTypes.push({ ...fallbackShift, code: normalized });
          return;
        }
        if (DEFAULT_STANDARD_SHIFT_TYPES[normalized as StandardShiftCode]) {
          generationShiftTypes.push(DEFAULT_STANDARD_SHIFT_TYPES[normalized as StandardShiftCode]);
          return;
        }
        generationShiftTypes.push({
          ...DEFAULT_FALLBACK_SHIFT_TYPE,
          code: normalized,
          name: normalized,
        });
      });

      let generationShifts = convertShiftTypesToShifts(generationShiftTypes);
      if (generationShifts.length === 0) {
        generationShifts = convertShiftTypesToShifts(STANDARD_AI_SHIFT_CODES.map(code => DEFAULT_STANDARD_SHIFT_TYPES[code]));
      }

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
        nightIntensivePaidLeaveDays: nightLeaveSetting,
      };

      const result = await generateScheduleMutation.mutateAsync(payload);
      let normalizedAssignments: ScheduleAssignment[] = result.assignments.map((assignment: DbAssignment) => ({
        ...assignment,
        date: new Date(assignment.date),
        id: assignment.id || `${assignment.employeeId}-${assignment.date}`,
        isLocked: assignment.isLocked || false,
      }));

      // AI 검토 기능이 활성화되어 있고 권한이 있는 경우 AI 검토 실행
      if (aiEnabled && aiPermission?.canUse) {
        try {
          const { reviewScheduleWithAI } = await import('@/lib/ai/openai-client');

          const aiReviewResult = await reviewScheduleWithAI({
            schedule: {
              employees: employees.map(emp => ({
                id: emp.id,
                name: emp.name,
                role: emp.role,
                preferences: {
                  workPatternType: emp.workPatternType,
                },
              })),
              assignments: normalizedAssignments.map(a => ({
                date: format(a.date, 'yyyy-MM-dd'),
                employeeId: a.employeeId,
                shiftId: a.shiftId,
                shiftType: a.shiftType,
              })),
              constraints: {
                minStaff: requiredStaffPerShift ? Math.min(...Object.values(requiredStaffPerShift)) : undefined,
                maxConsecutiveDays: 6,
                minRestDays: 1,
              },
            },
            period: {
              startDate: format(monthStart, 'yyyy-MM-dd'),
              endDate: format(monthEnd, 'yyyy-MM-dd'),
            },
          });

          // AI 개선 제안이 있는 경우 사용자에게 표시
          if (aiReviewResult.analysis.qualityScore < 80 && aiReviewResult.suggestions.length > 0) {
            const shouldApply = confirm(
              `AI 분석 결과:\n` +
              `품질 점수: ${aiReviewResult.analysis.qualityScore}/100\n\n` +
              `주요 문제점:\n${aiReviewResult.analysis.issues.slice(0, 3).map(i => `- ${i.description}`).join('\n')}\n\n` +
              `AI가 ${aiReviewResult.suggestions.length}개의 개선 제안을 제공했습니다.\n` +
              `개선된 스케줄을 적용하시겠습니까?`
            );

            if (shouldApply && aiReviewResult.improvedSchedule) {
              // AI가 제안한 개선된 스케줄 적용
              normalizedAssignments = aiReviewResult.improvedSchedule.assignments.map((assignment) => ({
                employeeId: assignment.employeeId,
                date: new Date(assignment.date),
                shiftId: assignment.shiftId || '',
                shiftType: assignment.shiftType,
                id: `${assignment.employeeId}-${assignment.date}`,
                isLocked: false,
              }));
            }
          }
        } catch (aiError) {
          console.error('AI 스케줄 검토 중 오류:', aiError);
          // AI 검토 실패 시에도 원래 스케줄은 사용
          alert('AI 검토 중 오류가 발생했지만, 기본 스케줄은 생성되었습니다.');
        }
      }

      setSchedule(normalizedAssignments);
      setOriginalSchedule(normalizedAssignments);
      setIsConfirmed(false);
      setLoadedScheduleId(result.scheduleId);
      if (result.generationResult) {
        setGenerationResult({
          success: true,
          schedule: undefined,
          violations: result.generationResult.violations,
          score: result.generationResult.score,
          iterations: 0,
          computationTime: result.generationResult.computationTime,
          offAccruals: result.generationResult.offAccruals,
        });
        setOffAccrualSummaries(result.generationResult.offAccruals ?? []);
      } else {
        setGenerationResult(null);
        setOffAccrualSummaries([]);
      }

      // AI로 생성한 경우 자동 임시저장
      if (aiEnabled && aiPermission?.canUse) {
        try {
          const saveDraftResponse = await fetchWithAuth('/api/schedule/save-draft', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              schedule: {
                departmentId: inferredDepartmentId,
                startDate: format(monthStart, 'yyyy-MM-dd'),
                endDate: format(monthEnd, 'yyyy-MM-dd'),
                assignments: normalizedAssignments.map(a => ({
                  employeeId: a.employeeId,
                  shiftId: a.shiftId,
                  date: format(a.date, 'yyyy-MM-dd'),
                  isLocked: a.isLocked,
                  shiftType: a.shiftType,
                })),
              },
              name: `AI 생성 - ${format(monthStart, 'yyyy년 MM월')}`,
              metadata: {
                aiGenerated: true,
                generatedAt: new Date().toISOString(),
              },
            }),
          });

          if (saveDraftResponse.ok) {
            const saveData = await saveDraftResponse.json();
            console.log('AI 생성 스케줄 자동 임시저장 완료:', saveData);
            // 스케줄 목록 갱신
            await utils.schedule.invalidate();
          }
        } catch (saveError) {
          console.error('자동 임시저장 실패:', saveError);
          // 임시저장 실패해도 스케줄 생성은 성공했으므로 에러를 무시
        }
      }
    } catch (error) {
      console.error('AI schedule generation failed:', error);
      alert('스케줄 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 🆕 스케줄 개선 핸들러
  const handleImproveSchedule = async () => {
    if (!canManageSchedules) {
      alert('스케줄 개선 권한이 없습니다.');
      return;
    }

    if (schedule.length === 0) {
      alert('개선할 스케줄이 없습니다. 먼저 스케줄을 생성해주세요.');
      return;
    }

    setIsImproving(true);

    try {
      // 기존 스케줄을 API에 전달할 형식으로 변환
      const assignments = schedule.map((a) => ({
        date: format(a.date, 'yyyy-MM-dd'),
        employeeId: a.employeeId,
        shiftId: a.shiftId,
        shiftType: a.shiftType,
      }));

      // 직원 정보 준비
      const employees = filteredMembers.map((member) => {
        const memberWithPrefs = member as UnifiedEmployee & {
          preferences?: {
            workPatternType?: string;
            avoidPatterns?: string[][];
          };
        };

        return {
          id: member.id,
          name: member.name,
          role: member.role || '일반',
          workPatternType: member.workPatternType,
          preferences: memberWithPrefs.preferences
            ? {
                workPatternType: memberWithPrefs.preferences.workPatternType,
                avoidPatterns: memberWithPrefs.preferences.avoidPatterns,
              }
            : undefined,
        };
      });

      // 제약 조건 준비
      const constraints = {
        minStaff: 5, // 기본값, 필요시 teamPattern에서 가져오기
        maxConsecutiveDays: 6,
        minRestDays: 1,
      };

      // 개선 실행
      await improveMutation.mutateAsync({
        assignments,
        employees,
        constraints,
        period: {
          startDate: format(monthStart, 'yyyy-MM-dd'),
          endDate: format(monthEnd, 'yyyy-MM-dd'),
        },
      });
    } catch (error) {
      console.error('Schedule improvement error:', error);
      // mutation onError에서 이미 처리됨
    }
  };

  // 개선 적용 핸들러
  const handleApplyImprovement = () => {
    if (!improvementReport) return;

    // API 응답에서 improved 배정을 가져옴
    const improved = (improveMutation.data as { improved?: unknown })?.improved as Array<{
      date: string;
      employeeId: string;
      shiftId?: string;
      shiftType?: string;
    }> | undefined;

    if (!improved) {
      alert('개선된 스케줄 데이터를 찾을 수 없습니다.');
      return;
    }

    // 개선된 스케줄 적용
    const improvedAssignments: ScheduleAssignment[] = improved.map((a) => ({
      employeeId: a.employeeId,
      date: new Date(a.date),
      shiftId: a.shiftId || '',
      shiftType: a.shiftType,
      id: `${a.employeeId}-${a.date}`,
      isLocked: false,
    }));

    setSchedule(improvedAssignments);
    setShowImprovementModal(false);

    // 성공 메시지
    const gradeChange = `${improvementReport.summary.gradeChange.from} → ${improvementReport.summary.gradeChange.to}`;
    alert(
      `✨ 스케줄이 개선되었습니다!\n\n` +
        `등급: ${gradeChange}\n` +
        `개선 점수: +${improvementReport.summary.totalImprovement.toFixed(1)}점`
    );
  };

  // 개선 취소 핸들러
  const handleRejectImprovement = () => {
    setShowImprovementModal(false);
    setImprovementReport(null);
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
            const assignment: Record<string, string> = {};
            headers.forEach((header, index) => {
              assignment[header.trim()] = values[index]?.trim() || '';
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
        const processedAssignments: ScheduleAssignment[] = importData.assignments.map((a: ScheduleAssignment) => ({
          employeeId: a.employeeId,
          shiftId: a.shiftId,
          date: typeof a.date === 'string' ? new Date(a.date) : a.date,
          isLocked: a.isLocked || false,
          shiftType: a.shiftType,
        }));

        setSchedule(processedAssignments);
        setOriginalSchedule(processedAssignments);

        // 결과 정보가 있으면 적용
        if (importData.result) {
          setGenerationResult(importData.result);
          setOffAccrualSummaries(importData.result.offAccruals ?? []);
        } else {
          setOffAccrualSummaries([]);
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
      const response = await fetchWithAuth('/api/report/generate', {
        method: 'POST',
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
      specialRequestsData.forEach((req: SpecialRequest) => {
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
        <div
          className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-6 transition-all duration-500 ease-out transform ${
            toolbarAnimatedIn ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}
        >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Primary Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {isScheduleQueryLoading && (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>스케줄 데이터를 불러오는 중입니다...</span>
                    </div>
                  )}

                  {!isMember && (
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={handleInitiateScheduleGeneration}
                        disabled={isGenerating}
                        className={`inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg flex-1 sm:flex-none ${
                          isGenerating
                            ? "text-gray-400 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                            : "text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
                        }`}
                      >
                        {isGenerating ? (
                          <>
                            <RefreshCcw className="w-4 h-4 animate-spin" />
                            <span className="hidden sm:inline">생성 중...</span>
                            <span className="sm:hidden">생성중</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4" />
                            <span className="hidden sm:inline">스케줄 생성</span>
                            <span className="sm:hidden">생성</span>
                          </>
                        )}
                      </button>

                      {/* AI Toggle */}
                      <button
                        onClick={() => {
                          if (!aiPermission?.canUse) {
                            alert(aiPermission?.reason || '유료 플랜 구독이 필요합니다.');
                            return;
                          }
                          setAiEnabled(!aiEnabled);
                        }}
                        disabled={isGenerating}
                        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                          aiEnabled && aiPermission?.canUse
                            ? "bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                            : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={aiPermission?.canUse ? (aiEnabled ? "AI 검토 ON" : "AI 검토 OFF") : "유료 플랜 구독 필요"}
                      >
                        <Sparkles className={`w-4 h-4 ${aiEnabled && aiPermission?.canUse ? "text-purple-600 dark:text-purple-400" : "text-gray-400"}`} />
                        <span className="text-xs">AI</span>
                        {!aiPermission?.canUse && (
                          <span className="ml-1 text-xs">🔒</span>
                        )}
                      </button>

                      {/* 🆕 개선 버튼 */}
                      <button
                        onClick={handleImproveSchedule}
                        disabled={!hasSchedule || isImproving}
                        className={`inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all flex-1 sm:flex-none ${
                          !hasSchedule || isImproving
                            ? "text-gray-400 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                            : "text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg"
                        }`}
                        title={hasSchedule ? "스케줄 최적화" : "개선할 스케줄이 없습니다"}
                      >
                        {isImproving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="hidden sm:inline">개선 중...</span>
                            <span className="sm:hidden">개선중</span>
                          </>
                        ) : (
                          <>
                            <TrendingUp className="w-4 h-4" />
                            <span>개선</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleValidateSchedule}
                    disabled={modals.isValidating || !hasSchedule}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-70 disabled:cursor-not-allowed"
                    title={hasSchedule ? "스케줄 검증" : "검증할 스케줄이 없습니다"}
                  >
                    {modals.isValidating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="hidden sm:inline">검증 중...</span>
                        <span className="sm:hidden">진행중</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">검증</span>
                        <span className="sm:hidden">검증</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft || !hasSchedule}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-400 rounded-lg border border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
                    title={hasSchedule ? "스케줄 임시 저장 (멤버에게는 보이지 않음)" : "저장할 스케줄이 없습니다"}
                  >
                    {isSavingDraft ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="hidden sm:inline">저장 중...</span>
                        <span className="sm:hidden">저장중</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span className="hidden sm:inline">임시 저장</span>
                        <span className="sm:hidden">저장</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleConfirmToggle}
                    disabled={isPreparingConfirmation || !hasSchedule}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-70 disabled:cursor-not-allowed"
                    title={hasSchedule ? "스케줄 확정" : "확정할 스케줄이 없습니다"}
                  >
                    {isPreparingConfirmation ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="hidden sm:inline">확인 중...</span>
                        <span className="sm:hidden">대기</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span className="hidden sm:inline">확정</span>
                        <span className="sm:hidden">확정</span>
                      </>
                    )}
                  </button>
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

                  {hasSchedule && (
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
                        {hasSchedule && (
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
                          disabled={isPreparingConfirmation}
                          className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {isPreparingConfirmation ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Lock className="w-4 h-4" />
                          )}
                          스케줄 확정
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
            </div>
        </div>
        )}
        {!isScheduleQueryLoading && !hasSchedule && (
          <div className="mb-6 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4 text-sm text-gray-600 dark:text-gray-400">
            이 달에는 저장된 스케줄이 없습니다. 상단의 스케줄 생성이나 가져오기 버튼을 사용해 새 스케줄을 만들어주세요.
          </div>
        )}

        {/* View Tabs */}
        <ViewTabs
          activeView={filters.activeView}
          canViewStaffPreferences={canViewStaffPreferences}
          onViewChange={filters.setActiveView}
          onViewIntent={handleViewIntent}
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
          isTodayViewLoading ? (
            <LottieLoadingOverlay message="오늘의 근무 데이터를 불러오는 중입니다..." compact />
          ) : (
            <TodayScheduleBoard
              employees={allMembers}
              assignments={todayAssignments}
              shiftTypes={customShiftTypes}
              today={selectedDate}
              onDateChange={setSelectedDate}
            />
          )
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
          hasSchedule={hasSchedule}
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
            {isScheduleViewLoading ? (
              <LottieLoadingOverlay message="스케줄 데이터를 불러오는 중입니다..." />
            ) : (
              <>
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
              </>
            )}
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


      {/* 스케줄 관리 모달 */}
      <ManageSchedulesModal
        isOpen={modals.showManageModal}
        onClose={() => modals.setShowManageModal(false)}
        onScheduleDeleted={() => {
          // Clear current schedule and reload
          setSchedule([]);
          setLoadedScheduleId(null);
          setGenerationResult(null);
          setOffAccrualSummaries([]);
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
        employeeNameMap={employeeNameMap}
      />

      {/* 🆕 Improvement Result Modal */}
      <ImprovementResultModal
        isOpen={showImprovementModal}
        onClose={handleRejectImprovement}
        report={improvementReport}
        onApply={handleApplyImprovement}
        onReject={handleRejectImprovement}
      />

      {/* Schedule Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={modals.showConfirmDialog}
        onClose={() => modals.setShowConfirmDialog(false)}
        onConfirm={handleConfirmSchedule}
        isConfirming={modals.isConfirming}
        isCheckingConflicts={isPreparingConfirmation}
        validationScore={modals.validationScore}
        scheduleName={scheduleName}
        onScheduleNameChange={handleScheduleNameChange}
        defaultScheduleName={`${format(monthStart, 'yyyy년 M월')} 스케줄`}
        existingSchedule={existingScheduleToReplace}
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
                {editingCell.currentShift && editingCell.currentShift.shiftId && (
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
          onSave={handlePreferencesSave}
          onClose={handleModalClose}
          initialPreferences={selectedPreferences || undefined}
          tenantPlan={tenantPlan}
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
