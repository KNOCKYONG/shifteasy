import { NextRequest } from 'next/server';
import { sseManager } from '@/lib/sse/sseManager';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // ✅ SSE는 장시간 연결 유지 필요 (5분)

export async function GET(req: NextRequest) {
  // 클라이언트 ID 생성 (실제로는 인증된 사용자 ID 사용)
  const clientId = req.headers.get('x-client-id') || `client-${Date.now()}`;
  const userId = req.nextUrl.searchParams.get('userId') || 'dev-user-id';

  console.log(`[SSE Route] New connection request - clientId: ${clientId}, userId: ${userId}`);

  // SSE 응답 스트림 생성
  const stream = new ReadableStream({
    start(controller) {
      // 클라이언트 등록 (userId 포함)
      console.log(`[SSE Route] Registering client - clientId: ${clientId}, userId: ${userId}`);
      sseManager.addClient(clientId, controller, userId);

      // 초기 연결 메시지
      const welcomeMessage = `event: connected\ndata: ${JSON.stringify({
        clientId,
        userId,
        timestamp: Date.now(),
        activeConnections: sseManager.getClientCount()
      })}\n\n`;

      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(welcomeMessage));

      // ✅ 30초마다 heartbeat 전송 (연결 유지)
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          console.log(`[SSE Route] Heartbeat failed for ${clientId}, cleaning up`);
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // 연결 종료 시 정리
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        sseManager.removeClient(clientId);
        controller.close();
      });
    },

    cancel() {
      // 스트림 취소 시 클라이언트 제거
      sseManager.removeClient(clientId);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Nginx 버퍼링 비활성화
    },
  });
}
