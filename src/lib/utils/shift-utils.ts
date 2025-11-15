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

    // Use color from shiftType (always hex) or default gray
    const color = shiftType.color || '#6B7280';

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
