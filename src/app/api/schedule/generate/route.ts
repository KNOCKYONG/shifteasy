import { NextRequest, NextResponse } from 'next/server';
import { ScheduleOptimizer } from '@/lib/scheduling/optimizer';
import { notifyScheduleUpdate } from '@/lib/sse/sseManager';

export async function POST(req: NextRequest) {
  try {
    const { startDate, config, teamData } = await req.json();

    // 팀 데이터 검증
    if (!teamData || !teamData.staff || teamData.staff.length === 0) {
      return NextResponse.json(
        { error: '팀 데이터를 찾을 수 없습니다. 먼저 팀을 구성해주세요.' },
        { status: 400 }
      );
    }

    // 스케줄 최적화 실행
    const optimizer = new ScheduleOptimizer(
      teamData.staff,
      new Date(startDate),
      config
    );

    const startTime = Date.now();
    const result = optimizer.optimize();
    const processingTime = Date.now() - startTime;

    // 처리 시간이 5초를 초과하면 경고
    if (processingTime > 5000) {
      console.warn(`Schedule generation took ${processingTime}ms`);
    }

    // 실시간 알림 발송
    notifyScheduleUpdate('new-schedule', {
      action: 'generated',
      startDate,
      staffCount: teamData.staff.length,
      metrics: result.metrics
    });

    return NextResponse.json({
      success: true,
      schedule: result.schedule,
      metrics: {
        ...result.metrics,
        processingTime
      },
      validation: result.validationResult,
      fairnessScore: result.fairnessScore,
      violations: result.validationResult?.violations || []
    });

  } catch (error) {
    console.error('Schedule generation error:', error);
    return NextResponse.json(
      { error: '스케줄 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}