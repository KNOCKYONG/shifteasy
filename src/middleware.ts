// Clerk 인증 임시 비활성화
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 모든 요청을 통과시키는 임시 미들웨어
export default function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};