import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 임시로 Clerk 인증을 비활성화하고 모든 요청을 통과시킴
export default function middleware(req: NextRequest) {
  // 모든 요청에 대해 admin 권한을 가진 가상의 사용자 헤더 추가
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-tenant-id', 'test-tenant');
  requestHeaders.set('x-user-id', 'test-admin-user');
  requestHeaders.set('x-user-role', 'admin');

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};