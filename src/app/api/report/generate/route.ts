import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

type ScheduleAssignment = {
  date: string;
  employeeId: string;
  shiftId: string;
};

type ScheduleStaff = {
  id: string;
  name: string;
};

type ScheduleShift = {
  id: string;
  name: string;
  time: {
    start: string;
    end: string;
  };
};

type ScheduleExportPayload = {
  assignments: ScheduleAssignment[];
  staff?: ScheduleStaff[];
  shifts?: ScheduleShift[];
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { format, period, options } = body as {
      format: 'excel' | 'pdf' | 'both';
      period?: { start?: string; end?: string };
      options?: { scheduleData?: ScheduleExportPayload };
    };

    // 간단한 CSV 데이터 생성
    if (format === 'excel' || format === 'both') {
      const scheduleData = options?.scheduleData;

      if (!scheduleData || !scheduleData.assignments) {
        return NextResponse.json({
          success: false,
          error: '스케줄 데이터가 없습니다.'
        }, { status: 400 });
      }

      // CSV 데이터 생성
      const headers = ['날짜', '직원', '시프트', '시간'];
      const staffById =
        scheduleData.staff?.reduce<Map<string, string>>((map, member) => {
          map.set(member.id, member.name);
          return map;
        }, new Map()) ?? new Map<string, string>();

      const shiftById =
        scheduleData.shifts?.reduce<
          Map<
            string,
            {
              name: string;
              time: { start: string; end: string };
            }
          >
        >((map, shift) => {
          map.set(shift.id, shift);
          return map;
        }, new Map()) ?? new Map<
          string,
          {
            name: string;
            time: { start: string; end: string };
          }
        >();

      const formatCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
      const csvLines = new Array<string>(scheduleData.assignments.length + 1);
      csvLines[0] = headers.join(',');

      scheduleData.assignments.forEach((assignment, index) => {
        const shift = shiftById.get(assignment.shiftId);
        const row = [
          assignment.date,
          staffById.get(assignment.employeeId) ?? 'Unknown',
          shift?.name ?? 'Unknown',
          shift ? `${shift.time.start} - ${shift.time.end}` : '',
        ]
          .map(formatCell)
          .join(',');

        csvLines[index + 1] = row;
      });

      // CSV 문자열 생성
      const csvContent = csvLines.join('\n');

      // Base64 인코딩
      const base64Data = Buffer.from('\uFEFF' + csvContent).toString('base64');

      return NextResponse.json({
        success: true,
        data: {
          excel: {
            data: base64Data,
            filename: `schedule_${period?.start || 'export'}.csv`,
            mimeType: 'text/csv'
          }
        }
      });
    }

    // PDF는 현재 지원하지 않음
    if (format === 'pdf') {
      return NextResponse.json({
        success: false,
        error: 'PDF 내보내기는 현재 준비 중입니다.'
      }, { status: 501 });
    }

    return NextResponse.json({
      success: false,
      error: '지원하지 않는 형식입니다.'
    }, { status: 400 });

  } catch (error: unknown) {
    console.error('Report generation error:', error);
    return NextResponse.json({
      success: false,
      error: '리포트 생성 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
