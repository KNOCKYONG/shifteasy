/**
 * Employee 데이터 모델 간 변환 어댑터
 */

import type { Employee, EmployeePreferences, EmployeeAvailability } from '@/lib/scheduler/types';
import type { ComprehensivePreferences } from '@/components/team/MyPreferencesPanel';
import type { UnifiedEmployee, EmployeeStatistics } from '@/lib/types/unified-employee';

// Generic team member interface
interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  departmentId?: string;
  departmentName?: string;
  role?: string;
  status?: string;
  skills?: string[];
  joinedAt?: string;
  avatar?: string;
  workSchedule?: {
    preferredShifts?: string[];
    maxHoursPerWeek?: number;
    minHoursPerWeek?: number;
    availableDays?: number[];
    unavailableDates?: string[];
  };
}

/**
 * 다양한 Employee 형식 간 변환을 담당하는 어댑터
 */
export class EmployeeAdapter {
  /**
   * TeamMember를 UnifiedEmployee로 변환
   */
  static fromMockToUnified(
    member: TeamMember,
    comprehensivePrefs?: ComprehensivePreferences,
    statistics?: EmployeeStatistics
  ): UnifiedEmployee {
    return {
      // 기본 정보
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone || '',
      position: member.position || '',
      department: member.departmentName || member.department || '',
      departmentId: member.departmentId || '',
      role: member.role === 'admin' ? 'admin' : member.role === 'manager' ? 'manager' : 'staff',
      contractType: 'full-time' as any,
      status: member.status as any || 'active',
      joinDate: member.joinedAt || new Date().toISOString(),
      avatar: member.avatar || '',

      // 근무 제한
      maxHoursPerWeek: member.workSchedule?.maxHoursPerWeek || 40,
      minHoursPerWeek: member.workSchedule?.minHoursPerWeek || 30,

      // 스킬
      skills: member.skills || [],

      // 기본 선호도
      preferences: {
        preferredShifts: (member.workSchedule?.preferredShifts || []) as any,
        avoidShifts: [],
        preferredDaysOff: [0, 6], // 기본값: 주말
        maxConsecutiveDays: 5,
        preferNightShift: (member.workSchedule?.preferredShifts || []).includes('night')
      },

      // 가용성
      availability: {
        availableDays: [true, true, true, true, true, true, false], // 월-토 가능
        unavailableDates: [],
        timeOffRequests: [],
      },

      // 확장 정보
      comprehensivePreferences: comprehensivePrefs,
      statistics,
      specialRequests: [],
    };
  }

  /**
   * UnifiedEmployee를 스케줄러용 Employee로 변환
   */
  static toSchedulerEmployee(unified: UnifiedEmployee): Employee {
    // ComprehensivePreferences가 있으면 이를 우선 사용
    const preferences = unified.comprehensivePreferences
      ? this.convertComprehensiveToBasic(unified.comprehensivePreferences)
      : unified.preferences;

    // Extract workPatternType and preferredShiftTypes from comprehensivePreferences
    let workPatternType: 'three-shift' | 'night-intensive' | 'weekday-only' | undefined;
    let preferredShiftTypes: { D?: number; E?: number; N?: number; } | undefined;
    let maxConsecutiveDaysPreferred: number | undefined;
    let maxConsecutiveNightsPreferred: number | undefined;

    if (unified.comprehensivePreferences) {
      const comp = unified.comprehensivePreferences as any;

      // 🔧 지원: flat 구조와 nested 구조 모두 처리
      // DB에서 로드된 preferences는 flat 구조일 수 있음
      workPatternType = comp.workPatternType || comp.workPreferences?.workPatternType as any;

      // 🔍 디버깅: workPatternType 추출 확인 (weekday-only 직원만)
      if (workPatternType === 'weekday-only') {
        console.log(`   📋 ${unified.name}: workPatternType="${workPatternType}" 추출 성공 (행정 근무자)`);
      }

      // preferredShiftTypes: flat 구조 우선, nested 구조 대체
      if (comp.preferredShiftTypes) {
        // Flat 구조: {D: 0, E: 0, N: 0}
        preferredShiftTypes = comp.preferredShiftTypes;
      } else {
        // Nested 구조: workPreferences.preferredShifts = ['day', 'evening', 'night']
        const prefs = comp.workPreferences?.preferredShifts || [];
        preferredShiftTypes = {
          D: prefs.includes('day') ? 10 : 0,
          E: prefs.includes('evening') ? 10 : 0,
          N: prefs.includes('night') ? 10 : 0,
        };
      }

      // maxConsecutiveDaysPreferred: flat 구조 우선
      maxConsecutiveDaysPreferred = comp.maxConsecutiveDaysPreferred || comp.workPreferences?.maxConsecutiveDays;

      // maxConsecutiveNightsPreferred is optional, keep as undefined
      maxConsecutiveNightsPreferred = comp.maxConsecutiveNightsPreferred;
    }

    return {
      id: unified.id,
      name: unified.name,
      departmentId: unified.departmentId,
      role: unified.position, // position을 role로 사용
      contractType: unified.contractType,
      maxHoursPerWeek: unified.maxHoursPerWeek,
      minHoursPerWeek: unified.minHoursPerWeek,
      skills: unified.skills,
      preferences,
      availability: this.enhanceAvailability(unified),
      workPatternType,
      preferredShiftTypes,
      maxConsecutiveDaysPreferred,
      maxConsecutiveNightsPreferred,
    };
  }

  /**
   * ComprehensivePreferences를 기본 EmployeePreferences로 변환
   */
  static convertComprehensiveToBasic(
    comprehensive: ComprehensivePreferences
  ): EmployeePreferences {
    const workPrefs = comprehensive.workPreferences || {};

    // 통근 시간과 건강 상태를 고려한 시프트 선호도 조정
    let adjustedPreferredShifts = [...(workPrefs.preferredShifts || [])];
    let adjustedAvoidShifts: Array<'day' | 'evening' | 'night'> = [];

    // 야간 교통 어려움이 있으면 야간 시프트 회피
    if (comprehensive.commutePreferences?.nightTransportDifficulty) {
      adjustedAvoidShifts.push('night');
      adjustedPreferredShifts = adjustedPreferredShifts.filter(s => s !== 'night');
    }

    // 육아가 필요하면 주간 선호
    if (comprehensive.personalCircumstances?.hasYoungChildren) {
      if (!adjustedPreferredShifts.includes('day')) {
        adjustedPreferredShifts.push('day');
      }
      adjustedAvoidShifts.push('night');
    }

    // 건강 문제가 있으면 야간 회피
    if (comprehensive.healthConsiderations?.hasChronicCondition ||
        comprehensive.healthConsiderations?.needsFrequentBreaks) {
      adjustedAvoidShifts.push('night');
    }

    // 학업 병행 시 특정 시간대 조정
    if (comprehensive.personalCircumstances?.isStudying) {
      // 학업 스케줄에 따라 조정 (상세 로직 필요)
      adjustedPreferredShifts = ['evening']; // 예시
    }

    // 휴무 패턴 선호도를 반영한 연속 근무일 조정
    let adjustedMaxConsecutiveDays = workPrefs.maxConsecutiveDays || 5;
    if (workPrefs.offDayPattern === 'short') {
      // 짧은 휴무 선호 - 연속 근무일을 줄임
      adjustedMaxConsecutiveDays = Math.min(adjustedMaxConsecutiveDays, 3);
    } else if (workPrefs.offDayPattern === 'long') {
      // 긴 휴무 선호 - 연속 근무일을 늘려서 긴 휴무 확보
      adjustedMaxConsecutiveDays = Math.max(adjustedMaxConsecutiveDays, 5);
    }

    return {
      preferredShifts: adjustedPreferredShifts,
      avoidShifts: [...new Set(adjustedAvoidShifts)], // 중복 제거
      preferredDaysOff: this.calculatePreferredDaysOff(comprehensive),
      maxConsecutiveDays: adjustedMaxConsecutiveDays,
      preferNightShift: !adjustedAvoidShifts.includes('night'),
      // 추가: 휴무 패턴 선호도를 스케줄러가 이해할 수 있는 형태로 전달
      offDayPattern: workPrefs.offDayPattern
    };
  }

  /**
   * 선호 휴무일 계산
   */
  private static calculatePreferredDaysOff(
    comprehensive: ComprehensivePreferences
  ): number[] {
    const daysOff: number[] = [];

    // 주말 선호도에 따라
    if (comprehensive.workPreferences?.weekendPreference === 'avoid') {
      daysOff.push(0, 6); // 일요일, 토요일
    }

    // 종교적 의무가 있는 경우
    if (comprehensive.specialRequests?.religiousObservances?.needed) {
      // 예: 일요일 예배
      if (!daysOff.includes(0)) {
        daysOff.push(0);
      }
    }

    // 가족 시간 우선순위가 높은 경우
    if ((comprehensive.priorities?.familyTime ?? 0) >= 8) {
      if (!daysOff.includes(6)) {
        daysOff.push(6); // 토요일 추가
      }
    }

    return daysOff.length > 0 ? daysOff : [0]; // 최소 하루는 휴무
  }

  /**
   * 가용성 정보 향상
   */
  private static enhanceAvailability(
    unified: UnifiedEmployee
  ): EmployeeAvailability {
    const availability = { ...unified.availability };

    // ComprehensivePreferences 기반 가용성 조정
    if (unified.comprehensivePreferences) {
      const prefs = unified.comprehensivePreferences;

      // 임신/출산 상태에 따른 조정
      if (prefs.personalCircumstances?.pregnancyStatus === 'late' ||
          prefs.personalCircumstances?.pregnancyStatus === 'postpartum') {
        // 야간 근무 불가능한 날 추가
        // (실제 구현 시 더 상세한 로직 필요)
      }

      // 통근 시간이 긴 경우 조정
      if ((prefs.commutePreferences?.commuteTime ?? 0) > 90) {
        // 연속 근무 제한 등
      }
    }

    // 특별 요청 반영
    if (unified.specialRequests) {
      unified.specialRequests.forEach(request => {
        if (request.status === 'approved' && request.startDate && request.endDate) {
          // 승인된 요청 기간을 불가능한 날짜로 추가
          const dates = this.getDatesBetween(request.startDate, request.endDate);
          availability.unavailableDates.push(...dates);
        }
      });
    }

    return availability;
  }

  /**
   * 날짜 범위 계산 헬퍼
   */
  private static getDatesBetween(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(start);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * 통계 정보 계산 (스케줄 기반)
   */
  static calculateStatistics(
    employeeId: string,
    assignments: any[],
    shifts: any[]
  ): EmployeeStatistics {
    const employeeAssignments = assignments.filter(a => a.employeeId === employeeId);

    // 총 근무 시간 계산
    const totalHours = employeeAssignments.reduce((sum, assignment) => {
      const shift = shifts.find(s => s.id === assignment.shiftId);
      return sum + (shift?.time.hours || 0);
    }, 0);

    // 야간 근무 카운트
    const nightShifts = employeeAssignments.filter(a => {
      const shift = shifts.find(s => s.id === a.shiftId);
      return shift?.type === 'night';
    }).length;

    // 주말 근무 카운트
    const weekendShifts = employeeAssignments.filter(a => {
      const day = new Date(a.date).getDay();
      return day === 0 || day === 6;
    }).length;

    // 연속 근무일 계산
    const consecutiveDays = this.calculateConsecutiveDays(employeeAssignments);

    // 마지막 휴무일
    const lastDayOff = this.findLastDayOff(employeeAssignments);

    return {
      totalHoursThisMonth: totalHours,
      averageHoursPerWeek: totalHours / 4, // 약 4주 기준
      nightShiftsCount: nightShifts,
      weekendShiftsCount: weekendShifts,
      consecutiveDaysWorked: consecutiveDays,
      lastDayOff: lastDayOff,
      overtimeHours: Math.max(0, totalHours - 160), // 월 160시간 초과분
      preferenceMatchRate: 75, // 계산 로직 필요
      fairnessScore: 85, // 계산 로직 필요
    };
  }

  /**
   * 연속 근무일 계산
   */
  private static calculateConsecutiveDays(assignments: any[]): number {
    if (assignments.length === 0) return 0;

    // 날짜순 정렬
    const sorted = [...assignments].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let maxConsecutive = 1;
    let currentConsecutive = 1;

    for (let i = 1; i < sorted.length; i++) {
      const prevDate = new Date(sorted[i - 1].date);
      const currDate = new Date(sorted[i].date);
      const dayDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (dayDiff === 1) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 1;
      }
    }

    return maxConsecutive;
  }

  /**
   * 마지막 휴무일 찾기
   */
  private static findLastDayOff(assignments: any[]): Date {
    if (assignments.length === 0) return new Date();

    const sorted = [...assignments].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const latestWork = new Date(sorted[0].date);
    const today = new Date();

    // 오늘이 근무일이 아니면 오늘이 휴무
    if (latestWork < today) {
      return today;
    }

    // 근무일 사이의 갭 찾기
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = new Date(sorted[i].date);
      const next = new Date(sorted[i + 1].date);
      const dayDiff = Math.floor((curr.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));

      if (dayDiff > 1) {
        // 갭이 있으면 그 사이가 휴무
        const dayOff = new Date(next);
        dayOff.setDate(dayOff.getDate() + 1);
        return dayOff;
      }
    }

    // 가장 오래된 근무일 이전
    const oldestWork = new Date(sorted[sorted.length - 1].date);
    const dayBefore = new Date(oldestWork);
    dayBefore.setDate(dayBefore.getDate() - 1);
    return dayBefore;
  }

  /**
   * 일괄 변환 유틸리티
   */
  static batchConvert(
    members: TeamMember[],
    preferencesMap?: Map<string, ComprehensivePreferences>
  ): UnifiedEmployee[] {
    return members.map(member => {
      const prefs = preferencesMap?.get(member.id);
      return this.fromMockToUnified(member, prefs);
    });
  }

  /**
   * 검증 유틸리티
   */
  static validateEmployee(employee: Partial<UnifiedEmployee>): string[] {
    const errors: string[] = [];

    if (!employee.id) errors.push('ID는 필수입니다');
    if (!employee.name) errors.push('이름은 필수입니다');
    if (!employee.email) errors.push('이메일은 필수입니다');
    if (!employee.departmentId) errors.push('부서 ID는 필수입니다');

    if (employee.maxHoursPerWeek && employee.minHoursPerWeek) {
      if (employee.maxHoursPerWeek < employee.minHoursPerWeek) {
        errors.push('최대 근무시간은 최소 근무시간보다 커야 합니다');
      }
    }

    if (employee.maxHoursPerWeek && employee.maxHoursPerWeek > 52) {
      errors.push('주당 최대 근무시간은 52시간을 초과할 수 없습니다');
    }

    return errors;
  }
}