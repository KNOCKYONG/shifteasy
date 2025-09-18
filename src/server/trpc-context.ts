import { type FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { db } from '@/db';

export async function createTRPCContext(opts?: FetchCreateContextFnOptions) {
  // Clerk 없이 테스트용 사용자 정보 설정
  const mockUserId = 'test-user-1';
  const mockOrgId = '3760b5ec-462f-443c-9a90-4a2b2e295e9d'; // 고정된 테넌트 ID

  return {
    db,
    userId: mockUserId,
    tenantId: mockOrgId,
    user: { id: mockUserId, email: 'test@example.com' },
    headers: opts?.req.headers,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;