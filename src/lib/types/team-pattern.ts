export interface TeamPattern {
  id: string;
  departmentId: string;
  requiredStaffDay: number;
  requiredStaffEvening: number;
  requiredStaffNight: number;
  defaultPatterns: string[][];
  totalMembers: number;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateTeamPatternRequest {
  departmentId: string;
  requiredStaffDay: number;
  requiredStaffEvening: number;
  requiredStaffNight: number;
  defaultPatterns: string[][];
  totalMembers: number;
}

export interface UpdateTeamPatternRequest {
  requiredStaffDay?: number;
  requiredStaffEvening?: number;
  requiredStaffNight?: number;
  defaultPatterns?: string[][];
  totalMembers?: number;
  isActive?: boolean;
}

export interface TeamPatternValidation {
  isValid: boolean;
  errors: string[];
}

// 시프트 타입 정의
export const SHIFT_TYPES = {
  DAY: 'D',
  EVENING: 'E',
  NIGHT: 'N',
  OFF: 'OFF',
} as const;

export type ShiftType = typeof SHIFT_TYPES[keyof typeof SHIFT_TYPES];

// 기본 패턴 예시
export const DEFAULT_PATTERNS = [
  ['D', 'D', 'D', 'OFF', 'OFF'],        // 3일 주간, 2일 휴무
  ['D', 'D', 'E', 'E', 'OFF', 'OFF'],   // 2일 주간, 2일 저녁, 2일 휴무
  ['D', 'E', 'N', 'OFF', 'OFF'],        // 순환 근무
  ['D', 'D', 'D', 'D', 'OFF', 'OFF', 'OFF'], // 4일 근무, 3일 휴무
];

// 검증 함수
export function validateTeamPattern(pattern: Partial<TeamPattern>): TeamPatternValidation {
  const errors: string[] = [];

  // 필요 인원 합계 검증
  const totalRequired = (pattern.requiredStaffDay || 0) +
                       (pattern.requiredStaffEvening || 0) +
                       (pattern.requiredStaffNight || 0);

  if (pattern.totalMembers && totalRequired > pattern.totalMembers) {
    errors.push(`필요 인원 합계(${totalRequired}명)가 전체 팀 인원(${pattern.totalMembers}명)을 초과합니다.`);
  }

  // 각 시프트 최소 인원 검증
  if (pattern.requiredStaffDay !== undefined && pattern.requiredStaffDay < 1) {
    errors.push('주간 근무 인원은 최소 1명 이상이어야 합니다.');
  }
  if (pattern.requiredStaffEvening !== undefined && pattern.requiredStaffEvening < 1) {
    errors.push('저녁 근무 인원은 최소 1명 이상이어야 합니다.');
  }
  if (pattern.requiredStaffNight !== undefined && pattern.requiredStaffNight < 1) {
    errors.push('야간 근무 인원은 최소 1명 이상이어야 합니다.');
  }

  // 패턴 검증
  if (pattern.defaultPatterns && pattern.defaultPatterns.length === 0) {
    errors.push('최소 1개 이상의 기본 패턴을 설정해야 합니다.');
  }

  if (pattern.defaultPatterns) {
    pattern.defaultPatterns.forEach((patternArray, index) => {
      if (patternArray.length === 0) {
        errors.push(`패턴 ${index + 1}이 비어있습니다.`);
      }

      // 각 요소가 유효한 시프트 타입인지 검증
      patternArray.forEach((shift, shiftIndex) => {
        if (!Object.values(SHIFT_TYPES).includes(shift as ShiftType)) {
          errors.push(`패턴 ${index + 1}의 ${shiftIndex + 1}번째 시프트(${shift})가 유효하지 않습니다.`);
        }
      });

      // 연속 근무 일수 체크 (최대 6일)
      let consecutiveWorkDays = 0;
      for (const shift of patternArray) {
        if (shift !== 'OFF') {
          consecutiveWorkDays++;
          if (consecutiveWorkDays > 6) {
            errors.push(`패턴 ${index + 1}에 7일 이상 연속 근무가 포함되어 있습니다.`);
            break;
          }
        } else {
          consecutiveWorkDays = 0;
        }
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}