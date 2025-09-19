import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportType, format, period, options } = body;

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
      const rows = scheduleData.assignments.map((assignment: any) => {
        const employee = scheduleData.staff?.find((m: any) => m.id === assignment.employeeId);
        const shift = scheduleData.shifts?.find((s: any) => s.id === assignment.shiftId);
        return [
          assignment.date,
          employee?.name || 'Unknown',
          shift?.name || 'Unknown',
          shift ? `${shift.time.start} - ${shift.time.end}` : ''
        ];
      });

      // CSV 문자열 생성
      const csvContent = [
        headers.join(','),
        ...rows.map((row: string[]) => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

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

  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json({
      success: false,
      error: '리포트 생성 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}