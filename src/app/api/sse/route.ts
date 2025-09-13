import { NextRequest } from 'next/server';
import { sseManager } from '@/lib/sse/sseManager';

export async function GET(req: NextRequest) {
  // 클라이언트 ID 생성 (실제로는 인증된 사용자 ID 사용)
  const clientId = req.headers.get('x-client-id') || `client-${Date.now()}`;
  const userId = req.nextUrl.searchParams.get('userId') || 'dev-user-id';

  // SSE 응답 스트림 생성
  const stream = new ReadableStream({
    start(controller) {
      // 클라이언트 등록
      sseManager.addClient(clientId, controller);

      // 초기 연결 메시지
      const welcomeMessage = `event: connected\ndata: ${JSON.stringify({
        clientId,
        userId,
        timestamp: Date.now(),
        activeConnections: sseManager.getClientCount()
      })}\n\n`;

      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(welcomeMessage));

      // 연결 종료 시 정리
      req.signal.addEventListener('abort', () => {
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