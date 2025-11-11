import { type Shift } from '@/lib/types/scheduler';

// ShiftType 인터페이스 정의
export interface ShiftType {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  allowOvertime: boolean;
}

// 색상 문자열을 hex 값으로 매핑
export const SHIFT_COLOR_MAP: Record<string, string> = {
  blue: '#3B82F6',
  green: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  purple: '#8B5CF6',
  indigo: '#6366F1',
  pink: '#EC4899',
  gray: '#6B7280',
};

/**
 * customShiftTypes를 Shift[] 형식으로 변환
 * @param customShiftTypes - 변환할 시프트 타입 배열
 * @returns Shift 배열
 */
export function convertShiftTypesToShifts(customShiftTypes: ShiftType[]): Shift[] {
  return customShiftTypes.map((shiftType) => {
    // Calculate hours
    const startParts = shiftType.startTime.split(':');
    const endParts = shiftType.endTime.split(':');
    const startHour = parseInt(startParts[0]);
    const endHour = parseInt(endParts[0]);
    let hours = endHour - startHour;
    if (hours <= 0) hours += 24; // Handle overnight shifts

    const normalizedCode = shiftType.code.toUpperCase();

    // Map shift code to type
    let type: 'day' | 'evening' | 'night' | 'off' | 'leave' | 'custom' = 'custom';
    if (normalizedCode === 'D') type = 'day';
    else if (normalizedCode === 'E') type = 'evening';
    else if (normalizedCode === 'N') type = 'night';
    else if (normalizedCode === 'O' || normalizedCode === 'OFF') type = 'off';
    else if (normalizedCode === 'A') type = 'custom'; // 행정 근무 (administrative work)
    else if (normalizedCode === 'V' || shiftType.name.includes('휴가')) type = 'leave';

    // Determine color: Try multiple approaches
    let color = '#6B7280'; // Default gray

    // 1. If color is already a hex code, use it
    if (shiftType.color && shiftType.color.startsWith('#')) {
      color = shiftType.color;
    }
    // 2. Try mapping from SHIFT_COLOR_MAP (case-insensitive)
    else if (shiftType.color && SHIFT_COLOR_MAP[shiftType.color.toLowerCase()]) {
      color = SHIFT_COLOR_MAP[shiftType.color.toLowerCase()];
    }
    // 3. Fall back to code-based colors
    else {
      const codeColorMap: Record<string, string> = {
        'D': '#EAB308',   // day - yellow
        'E': '#F59E0B',   // evening - amber
        'N': '#6366F1',   // night - indigo
        'O': '#9CA3AF',   // off - gray
        'A': '#10B981',   // administrative - green
      };
      color = codeColorMap[normalizedCode] || '#6B7280';
    }

    const staffingDefaults: Record<string, { required: number; min: number; max: number }> = {
      D: { required: 5, min: 4, max: 6 },
      E: { required: 4, min: 3, max: 5 },
      N: { required: 3, min: 2, max: 4 },
    };
    const staffing = staffingDefaults[normalizedCode] ?? { required: 0, min: 0, max: 99 };

    return {
      id: `shift-${normalizedCode.toLowerCase()}`,
      code: normalizedCode,
      type,
      name: shiftType.name,
      time: { start: shiftType.startTime, end: shiftType.endTime, hours },
      color,
      requiredStaff: staffing.required,
      minStaff: staffing.min,
      maxStaff: staffing.max,
    };
  });
}
