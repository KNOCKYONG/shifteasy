import { type Staff, type ShiftType, type WeekSchedule } from '@/lib/types';
import { notifySwapRequest, notifySwapApproval, sendNotification } from '@/lib/sse/sseManager';

export interface SwapRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterShift: {
    date: string;
    dayIndex: number;
    shift: ShiftType;
  };
  targetId: string;
  targetName: string;
  targetShift: {
    date: string;
    dayIndex: number;
    shift: ShiftType;
  };
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

export class SwapManager {
  private swapRequests: Map<string, SwapRequest> = new Map();
  private pendingRequests: Map<string, Set<string>> = new Map(); // userId -> requestIds

  /**
   * 스왑 요청 생성
   */
  createSwapRequest(
    requester: Staff,
    target: Staff,
    requesterShift: SwapRequest['requesterShift'],
    targetShift: SwapRequest['targetShift'],
    reason?: string
  ): SwapRequest {
    const request: SwapRequest = {
      id: `swap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      requesterId: requester.id,
      requesterName: requester.name,
      requesterShift,
      targetId: target.id,
      targetName: target.name,
      targetShift,
      reason,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 요청 저장
    this.swapRequests.set(request.id, request);

    // 대기 중인 요청 목록 업데이트
    if (!this.pendingRequests.has(target.id)) {
      this.pendingRequests.set(target.id, new Set());
    }
    this.pendingRequests.get(target.id)!.add(request.id);

    // 실시간 알림 발송
    this.notifySwapRequest(request);

    return request;
  }

  /**
   * 스왑 요청 승인
   */
  approveSwapRequest(
    requestId: string,
    approvedBy: string,
    schedule: WeekSchedule
  ): { success: boolean; updatedSchedule?: WeekSchedule; error?: string } {
    const request = this.swapRequests.get(requestId);

    if (!request) {
      return { success: false, error: '요청을 찾을 수 없습니다.' };
    }

    if (request.status !== 'pending') {
      return { success: false, error: '이미 처리된 요청입니다.' };
    }

    // 스케줄 업데이트
    const updatedSchedule = this.applySwap(schedule, request);

    // 요청 상태 업데이트
    request.status = 'approved';
    request.approvedBy = approvedBy;
    request.updatedAt = new Date();

    // 대기 목록에서 제거
    this.pendingRequests.get(request.targetId)?.delete(requestId);

    // 실시간 알림 발송
    this.notifySwapApproval(request);

    return { success: true, updatedSchedule };
  }

  /**
   * 스왑 요청 거절
   */
  rejectSwapRequest(
    requestId: string,
    rejectedBy: string,
    reason?: string
  ): { success: boolean; error?: string } {
    const request = this.swapRequests.get(requestId);

    if (!request) {
      return { success: false, error: '요청을 찾을 수 없습니다.' };
    }

    if (request.status !== 'pending') {
      return { success: false, error: '이미 처리된 요청입니다.' };
    }

    // 요청 상태 업데이트
    request.status = 'rejected';
    request.rejectedBy = rejectedBy;
    request.rejectionReason = reason;
    request.updatedAt = new Date();

    // 대기 목록에서 제거
    this.pendingRequests.get(request.targetId)?.delete(requestId);

    // 실시간 알림 발송
    this.notifySwapRejection(request);

    return { success: true };
  }

  /**
   * 스왑 요청 취소
   */
  cancelSwapRequest(requestId: string): { success: boolean; error?: string } {
    const request = this.swapRequests.get(requestId);

    if (!request) {
      return { success: false, error: '요청을 찾을 수 없습니다.' };
    }

    if (request.status !== 'pending') {
      return { success: false, error: '이미 처리된 요청입니다.' };
    }

    // 요청 상태 업데이트
    request.status = 'cancelled';
    request.updatedAt = new Date();

    // 대기 목록에서 제거
    this.pendingRequests.get(request.targetId)?.delete(requestId);

    // 실시간 알림 발송
    sendNotification(request.targetId, {
      type: 'swap.cancelled',
      title: '근무 교대 요청 취소',
      message: `${request.requesterName}님이 교대 요청을 취소했습니다.`,
      requestId
    });

    return { success: true };
  }

  /**
   * 사용자의 대기 중인 스왑 요청 조회
   */
  getPendingRequestsForUser(userId: string): SwapRequest[] {
    const requestIds = this.pendingRequests.get(userId);
    if (!requestIds) return [];

    return Array.from(requestIds)
      .map(id => this.swapRequests.get(id))
      .filter((req): req is SwapRequest => req !== undefined && req.status === 'pending')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 사용자가 보낸 스왑 요청 조회
   */
  getRequestsByRequester(requesterId: string): SwapRequest[] {
    return Array.from(this.swapRequests.values())
      .filter(req => req.requesterId === requesterId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 모든 스왑 요청 조회 (관리자용)
   */
  getAllRequests(): SwapRequest[] {
    return Array.from(this.swapRequests.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 스왑 적용
   */
  private applySwap(schedule: WeekSchedule, request: SwapRequest): WeekSchedule {
    const newSchedule = JSON.parse(JSON.stringify(schedule));

    // 요청자와 대상자의 시프트 교환
    const requesterShift = newSchedule[request.requesterId]?.[request.requesterShift.dayIndex];
    const targetShift = newSchedule[request.targetId]?.[request.targetShift.dayIndex];

    if (newSchedule[request.requesterId]) {
      newSchedule[request.requesterId][request.targetShift.dayIndex] = targetShift || 'O';
    }

    if (newSchedule[request.targetId]) {
      newSchedule[request.targetId][request.requesterShift.dayIndex] = requesterShift || 'O';
    }

    return newSchedule;
  }

  /**
   * 알림 발송 헬퍼 함수들
   */
  private notifySwapRequest(request: SwapRequest) {
    // SSE로 실시간 알림 발송
    notifySwapRequest({
      requestId: request.id,
      requesterId: request.requesterId,
      requesterName: request.requesterName,
      targetId: request.targetId,
      targetName: request.targetName,
      requesterShift: request.requesterShift,
      targetShift: request.targetShift,
      reason: request.reason
    });

    // 대상자에게 개별 알림
    sendNotification(request.targetId, {
      type: 'swap.request',
      title: '새로운 근무 교대 요청',
      message: `${request.requesterName}님이 ${request.requesterShift.date} ${request.requesterShift.shift}근무와 ${request.targetShift.date} ${request.targetShift.shift}근무 교대를 요청했습니다.`,
      requestId: request.id,
      actions: [
        { label: '승인', action: 'approve' },
        { label: '거절', action: 'reject' }
      ]
    });
  }

  private notifySwapApproval(request: SwapRequest) {
    // SSE로 실시간 알림 발송
    notifySwapApproval(request.id, request.approvedBy!);

    // 요청자에게 개별 알림
    sendNotification(request.requesterId, {
      type: 'swap.approved',
      title: '근무 교대 승인됨',
      message: `${request.targetName}님이 교대 요청을 승인했습니다.`,
      requestId: request.id
    });
  }

  private notifySwapRejection(request: SwapRequest) {
    // 요청자에게 개별 알림
    sendNotification(request.requesterId, {
      type: 'swap.rejected',
      title: '근무 교대 거절됨',
      message: `${request.targetName}님이 교대 요청을 거절했습니다. ${request.rejectionReason ? `사유: ${request.rejectionReason}` : ''}`,
      requestId: request.id
    });
  }
}

// 전역 스왑 매니저 인스턴스
export const swapManager = new SwapManager();