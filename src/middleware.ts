import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 공개 라우트 정의
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/join(.*)',
  '/',
  '/api/webhooks(.*)',
  '/api/auth/verify-secret-code',
  '/api/auth/signup',
  '/api/auth/departments',
]);

// 보호된 API 라우트
const isProtectedApiRoute = createRouteMatcher([
  '/api/schedule(.*)',
  '/api/swap(.*)',
  '/api/users(.*)',
  '/api/departments(.*)',
  '/api/reports(.*)',
  '/api/audit(.*)',
]);

// 관리자 전용 라우트
const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
  '/settings/billing(.*)',
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, orgId, orgRole, sessionClaims } = await auth();

  // 공개 라우트는 통과
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // 인증되지 않은 사용자 리다이렉트
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  // 관리자 라우트 접근 제어
  if (isAdminRoute(req)) {
    if (orgRole !== 'org:admin' && orgRole !== 'org:owner') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }
  }

  // API 요청에 테넌트 정보 추가
  if (isProtectedApiRoute(req)) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-tenant-id', orgId || '');
    requestHeaders.set('x-user-id', userId || '');
    requestHeaders.set('x-user-role', orgRole || 'member');

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};