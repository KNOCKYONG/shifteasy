// 이벤트 타입 정의
export type SSEEventType =
  | 'schedule.updated'
  | 'schedule.published'
  | 'swap.requested'
  | 'swap.approved'
  | 'swap.rejected'
  | 'notification'
  | 'ping';

export interface SSEEvent {
  type: SSEEventType;
  data: any;
  userId?: string;
  timestamp: number;
}

// 연결된 클라이언트 관리
class SSEManager {
  private clients: Map<string, ReadableStreamDefaultController> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private clientUserMap: Map<string, string> = new Map(); // clientId -> userId 매핑

  addClient(clientId: string, controller: ReadableStreamDefaultController, userId?: string) {
    this.clients.set(clientId, controller);

    // userId 매핑 저장
    if (userId) {
      this.clientUserMap.set(clientId, userId);
      console.log(`[SSEManager] Client registered - clientId: ${clientId}, userId: ${userId}, total clients: ${this.clients.size}`);
    } else {
      console.log(`[SSEManager] Client registered without userId - clientId: ${clientId}, total clients: ${this.clients.size}`);
    }

    // Heartbeat 설정 (30초마다 ping)
    const interval = setInterval(() => {
      this.sendToClient(clientId, {
        type: 'ping',
        data: { timestamp: Date.now() },
        timestamp: Date.now()
      });
    }, 30000);

    this.heartbeatIntervals.set(clientId, interval);
  }

  removeClient(clientId: string) {
    const interval = this.heartbeatIntervals.get(clientId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(clientId);
    }
    this.clients.delete(clientId);
    this.clientUserMap.delete(clientId); // userId 매핑도 제거
    console.log(`[SSEManager] Client removed - clientId: ${clientId}, remaining clients: ${this.clients.size}`);
  }

  // 특정 userId에 해당하는 모든 clientId를 찾기
  getClientIdsByUserId(userId: string): string[] {
    console.log(`[SSEManager] getClientIdsByUserId called for userId: ${userId}`);
    console.log(`[SSEManager] Current clientUserMap:`, Array.from(this.clientUserMap.entries()));
    console.log(`[SSEManager] Total clients in map: ${this.clients.size}, Total userId mappings: ${this.clientUserMap.size}`);

    const clientIds: string[] = [];
    this.clientUserMap.forEach((mappedUserId, clientId) => {
      if (mappedUserId === userId) {
        clientIds.push(clientId);
      }
    });

    console.log(`[SSEManager] Found ${clientIds.length} clients for userId ${userId}:`, clientIds);
    return clientIds;
  }

  sendToClient(clientId: string, event: SSEEvent) {
    const controller = this.clients.get(clientId);
    if (controller) {
      try {
        const message = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\nid: ${event.timestamp}\n\n`;
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(message));
      } catch (error) {
        console.error(`Failed to send event to client ${clientId}:`, error);
        this.removeClient(clientId);
      }
    }
  }

  broadcast(event: SSEEvent, filterFn?: (clientId: string) => boolean) {
    this.clients.forEach((controller, clientId) => {
      if (!filterFn || filterFn(clientId)) {
        this.sendToClient(clientId, event);
      }
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

// 전역 SSE 매니저 인스턴스 (HMR 및 서버리스 환경에서도 유지)
const globalForSSE = globalThis as unknown as {
  sseManager: SSEManager | undefined;
};

export const sseManager = globalForSSE.sseManager ?? new SSEManager();

// 개발 환경에서 HMR 시에도 인스턴스 유지
if (process.env.NODE_ENV !== 'production') {
  globalForSSE.sseManager = sseManager;
}

// 이벤트 발송 헬퍼 함수들
export function notifyScheduleUpdate(scheduleId: string, changes: any) {
  sseManager.broadcast({
    type: 'schedule.updated',
    data: {
      scheduleId,
      changes,
      updatedAt: new Date().toISOString()
    },
    timestamp: Date.now()
  });
}

export function notifySwapRequest(swapData: any) {
  sseManager.broadcast({
    type: 'swap.requested',
    data: swapData,
    timestamp: Date.now()
  }, (clientId) => {
    // 관련 직원에게만 알림
    // 실제로는 클라이언트 ID와 사용자 매핑 필요
    return true;
  });
}

export function notifySwapApproval(swapId: string, approvedBy: string) {
  sseManager.broadcast({
    type: 'swap.approved',
    data: {
      swapId,
      approvedBy,
      approvedAt: new Date().toISOString()
    },
    timestamp: Date.now()
  });
}

export function sendNotification(userId: string, notification: any) {
  sseManager.broadcast({
    type: 'notification',
    data: notification,
    userId,
    timestamp: Date.now()
  }, (clientId) => {
    // userId에 해당하는 클라이언트에게만 전송
    // 실제 구현에서는 clientId-userId 매핑 필요
    return true;
  });
}