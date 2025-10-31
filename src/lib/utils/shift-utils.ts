import { type Shift } from '../scheduler/types';

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

    // Map shift code to type
    let type: 'day' | 'evening' | 'night' | 'off' | 'leave' | 'custom' = 'custom';
    if (shiftType.code === 'D') type = 'day';
    else if (shiftType.code === 'E') type = 'evening';
    else if (shiftType.code === 'N') type = 'night';
    else if (shiftType.code === 'O' || shiftType.code === 'OFF') type = 'off';
    else if (shiftType.code === 'A') type = 'custom'; // 행정 근무 (administrative work)

    return {
      id: `shift-${shiftType.code.toLowerCase()}`,
      type,
      name: shiftType.name,
      time: { start: shiftType.startTime, end: shiftType.endTime, hours },
      color: SHIFT_COLOR_MAP[shiftType.color] || '#6B7280',
      requiredStaff: shiftType.code === 'D' ? 5 : shiftType.code === 'E' ? 4 : shiftType.code === 'N' ? 3 : 1,
      minStaff: shiftType.code === 'D' ? 4 : shiftType.code === 'E' ? 3 : shiftType.code === 'N' ? 2 : 1,
      maxStaff: shiftType.code === 'D' ? 6 : shiftType.code === 'E' ? 5 : shiftType.code === 'N' ? 4 : 3,
    };
  });
}
