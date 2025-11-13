export interface TeamPattern {
  id: string;
  departmentId: string;
  requiredStaffDay: number;
  requiredStaffEvening: number;
  requiredStaffNight: number;
  requiredStaffByShift: Record<string, number>;
  defaultPatterns: string[][];
  avoidPatterns?: string[][]; // 기피 근무 패턴 (연속 시프트 조합)
  totalMembers: number;
  isActive: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateTeamPatternRequest {
  departmentId: string;
  requiredStaffDay: number;
  requiredStaffEvening: number;
  requiredStaffNight: number;
  requiredStaffByShift?: Record<string, number>;
  defaultPatterns: string[][];
  avoidPatterns?: string[][]; // 기피 근무 패턴 (선택사항)
  totalMembers: number;
}

export interface UpdateTeamPatternRequest {
  requiredStaffDay?: number;
  requiredStaffEvening?: number;
  requiredStaffNight?: number;
  requiredStaffByShift?: Record<string, number>;
  defaultPatterns?: string[][];
  avoidPatterns?: string[][]; // 기피 근무 패턴 (선택사항)
  totalMembers?: number;
  isActive?: string;
}

export interface TeamPatternValidation {
  isValid: boolean;
  errors: string[];
}

export type RequiredStaffByShift = Record<string, number>;

// 시프트 타입 정의
export const SHIFT_TYPES = {
  DAY: 'D',
  EVENING: 'E',
  NIGHT: 'N',
  OFF: 'OFF',
  O: 'O', // 휴무 (단축 표기)
} as const;

export type ShiftType = typeof SHIFT_TYPES[keyof typeof SHIFT_TYPES];

export const DEFAULT_REQUIRED_STAFF_BY_SHIFT: RequiredStaffByShift = {
  D: 5,
  E: 4,
  N: 3,
};

export const EXCLUDED_REQUIRED_SHIFT_CODES = new Set(['A', 'O', 'V']);

// 기본 패턴 예시
export const DEFAULT_PATTERNS = [
  ['D', 'D', 'D', 'OFF', 'OFF'],        // 3일 주간, 2일 휴무
  ['D', 'D', 'E', 'E', 'OFF', 'OFF'],   // 2일 주간, 2일 저녁, 2일 휴무
  ['D', 'E', 'N', 'OFF', 'OFF'],        // 순환 근무
  ['D', 'D', 'D', 'D', 'OFF', 'OFF', 'OFF'], // 4일 근무, 3일 휴무
];

export function deriveRequiredStaffByShift(
  pattern?: Partial<TeamPattern> | null,
  fallback: RequiredStaffByShift = DEFAULT_REQUIRED_STAFF_BY_SHIFT
): RequiredStaffByShift {
  const base: RequiredStaffByShift = { ...fallback };

  if (!pattern) {
    return base;
  }

  if (pattern.requiredStaffByShift && Object.keys(pattern.requiredStaffByShift).length > 0) {
    Object.entries(pattern.requiredStaffByShift).forEach(([code, value]) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        base[code.toUpperCase()] = Math.max(0, Math.floor(value));
      }
    });
    return base;
  }

  if (typeof pattern.requiredStaffDay === 'number') {
    base.D = Math.max(0, Math.floor(pattern.requiredStaffDay));
  }
  if (typeof pattern.requiredStaffEvening === 'number') {
    base.E = Math.max(0, Math.floor(pattern.requiredStaffEvening));
  }
  if (typeof pattern.requiredStaffNight === 'number') {
    base.N = Math.max(0, Math.floor(pattern.requiredStaffNight));
  }

  return base;
}

// 검증 함수 (shift_types를 외부에서 받아서 검증)
export function validateTeamPattern(
  pattern: Partial<TeamPattern>,
  validShiftCodes?: string[]
): TeamPatternValidation {
  const errors: string[] = [];
  const allowedShiftCodes = validShiftCodes?.map((code) => code.toUpperCase()) || Object.values(SHIFT_TYPES);
  const allowedShiftCodeSet = new Set(allowedShiftCodes);

  const requiredStaffMap = deriveRequiredStaffByShift(pattern);
  const filteredEntries = Object.entries(requiredStaffMap).filter(([code]) => {
    const normalized = code.toUpperCase();
    if (EXCLUDED_REQUIRED_SHIFT_CODES.has(normalized)) {
      return false;
    }
    return allowedShiftCodeSet.has(normalized);
  });

  if (filteredEntries.length === 0) {
    errors.push('시프트별 필요 인원을 최소 1개 이상 설정해야 합니다.');
  }

  // 필요 인원 합계 검증
  const totalRequired = filteredEntries.reduce((sum, [, value]) => sum + (value || 0), 0);

  if (pattern.totalMembers && totalRequired > (pattern.totalMembers || 0)) {
    errors.push(`필요 인원 합계(${totalRequired}명)가 전체 팀 인원(${pattern.totalMembers}명)을 초과합니다.`);
  }

  // 각 시프트 최소 인원 검증
  filteredEntries.forEach(([code, value]) => {
    if (value < 0) {
      errors.push(`${code} 시프트 필요 인원은 0명 이상이어야 합니다.`);
    }
  });

  // D/E/N가 빠진 경우 기본값 안내
  // 허용되지 않은 시프트 코드 검증
  Object.keys(requiredStaffMap).forEach((code) => {
    const normalized = code.toUpperCase();
    if (EXCLUDED_REQUIRED_SHIFT_CODES.has(normalized)) {
      errors.push(`${normalized} 시프트는 필요 인원 설정 대상이 아닙니다.`);
      return;
    }
    if (!allowedShiftCodeSet.has(normalized)) {
      errors.push(`${normalized} 시프트는 현재 근무 타입 목록에 없습니다.`);
    }
  });

  // 기본 패턴 검증
  if (pattern.defaultPatterns && pattern.defaultPatterns.length === 0) {
    errors.push('최소 1개 이상의 기본 패턴을 설정해야 합니다.');
  }

  if (pattern.defaultPatterns) {
    pattern.defaultPatterns.forEach((patternArray, index) => {
      if (patternArray.length === 0) {
        errors.push(`기본 패턴 ${index + 1}이 비어있습니다.`);
      }

      // 각 요소가 유효한 시프트 타입인지 검증
      patternArray.forEach((shift, shiftIndex) => {
        if (!allowedShiftCodes.includes(shift)) {
          errors.push(`기본 패턴 ${index + 1}의 ${shiftIndex + 1}번째 시프트(${shift})가 유효하지 않습니다.`);
        }
      });

      // 연속 근무 일수 체크 (최대 6일)
      let consecutiveWorkDays = 0;
      for (const shift of patternArray) {
        if (shift !== 'OFF') {
          consecutiveWorkDays++;
          if (consecutiveWorkDays > 6) {
            errors.push(`기본 패턴 ${index + 1}에 7일 이상 연속 근무가 포함되어 있습니다.`);
            break;
          }
        } else {
          consecutiveWorkDays = 0;
        }
      }
    });
  }

  // 기피 패턴 검증
  if (pattern.avoidPatterns && pattern.avoidPatterns.length > 0) {
    pattern.avoidPatterns.forEach((avoidArray, index) => {
      // 빈 패턴 체크
      if (avoidArray.length === 0) {
        errors.push(`기피 패턴 ${index + 1}이 비어있습니다.`);
        return;
      }

      // 최소 2개 이상의 시프트 조합이어야 의미가 있음
      if (avoidArray.length < 2) {
        errors.push(`기피 패턴 ${index + 1}은 최소 2개 이상의 시프트 조합이어야 합니다.`);
      }

      // 각 요소가 유효한 시프트 타입인지 검증 (OFF 제외 - 기피 패턴에서 OFF는 의미 없음)
      avoidArray.forEach((shift, shiftIndex) => {
        if (!allowedShiftCodes.includes(shift)) {
          errors.push(`기피 패턴 ${index + 1}의 ${shiftIndex + 1}번째 시프트(${shift})가 유효하지 않습니다.`);
        }
        if (shift === 'OFF' || shift === 'O') {
          errors.push(`기피 패턴 ${index + 1}에 OFF를 포함할 수 없습니다. 근무 시프트만 조합하세요.`);
        }
      });

      // 너무 긴 패턴은 의미가 없음 (최대 7일)
      if (avoidArray.length > 7) {
        errors.push(`기피 패턴 ${index + 1}이 너무 깁니다 (최대 7개 시프트).`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
