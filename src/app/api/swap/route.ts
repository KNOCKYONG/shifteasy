import { NextRequest, NextResponse } from 'next/server';
import { swapManager } from '@/lib/swap/swapManager';
import { loadCurrentTeam } from '@/lib/teamStorage';

export const dynamic = 'force-dynamic';

// 스왑 요청 생성
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requesterId, targetId, requesterShift, targetShift, reason } = body;

    // 팀 데이터에서 직원 정보 조회
    const teamData = loadCurrentTeam();
    if (!teamData || !teamData.staff) {
      return NextResponse.json(
        { error: '팀 데이터를 찾을 수 없습니다.' },
        { status: 400 }
      );
    }

    const requester = teamData.staff.find(s => s.id === requesterId);
    const target = teamData.staff.find(s => s.id === targetId);

    if (!requester || !target) {
      return NextResponse.json(
        { error: '직원 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 스왑 요청 생성
    const swapRequest = swapManager.createSwapRequest(
      requester,
      target,
      requesterShift,
      targetShift,
      reason
    );

    return NextResponse.json({
      success: true,
      request: swapRequest
    });

  } catch (error) {
    console.error('Swap request creation error:', error);
    return NextResponse.json(
      { error: '스왑 요청 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 스왑 요청 목록 조회
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    const type = req.nextUrl.searchParams.get('type') || 'pending'; // pending, sent, all

    let requests;

    if (type === 'pending' && userId) {
      // 대기 중인 요청 (내가 받은)
      requests = swapManager.getPendingRequestsForUser(userId);
    } else if (type === 'sent' && userId) {
      // 내가 보낸 요청
      requests = swapManager.getRequestsByRequester(userId);
    } else if (type === 'all') {
      // 모든 요청 (관리자용)
      requests = swapManager.getAllRequests();
    } else {
      return NextResponse.json(
        { error: '잘못된 요청 타입입니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      requests
    });

  } catch (error) {
    console.error('Swap request fetch error:', error);
    return NextResponse.json(
      { error: '스왑 요청 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}