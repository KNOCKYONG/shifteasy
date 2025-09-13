import { NextRequest, NextResponse } from 'next/server';
import { swapManager } from '@/lib/swap/swapManager';

// 스왑 요청 승인
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { action, approvedBy, rejectedBy, reason, schedule } = await req.json();
    const requestId = params.id;

    let result;

    switch (action) {
      case 'approve':
        if (!schedule) {
          return NextResponse.json(
            { error: '현재 스케줄 정보가 필요합니다.' },
            { status: 400 }
          );
        }
        result = swapManager.approveSwapRequest(requestId, approvedBy, schedule);
        break;

      case 'reject':
        result = swapManager.rejectSwapRequest(requestId, rejectedBy, reason);
        break;

      case 'cancel':
        result = swapManager.cancelSwapRequest(requestId);
        break;

      default:
        return NextResponse.json(
          { error: '잘못된 액션입니다.' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      updatedSchedule: 'updatedSchedule' in result ? result.updatedSchedule : undefined
    });

  } catch (error) {
    console.error('Swap request update error:', error);
    return NextResponse.json(
      { error: '스왑 요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}