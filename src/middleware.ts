import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/billing(.*)', // Allow viewing billing page without login
  '/master(.*)',
  '/api/webhooks/(.*)',
  '/api/auth/validate-secret-code',
  '/api/auth/signup',
  '/api/auth/guest-signup',
  '/api/schedule/validate', // Validation is a pure computation, no DB access
]);

export default clerkMiddleware(
  async (auth, req) => {
    // Protect all routes except public ones
    if (!isPublicRoute(req)) {
      await auth.protect();
    }
  },
  {
    // Reduce noisy Clerk logs unless explicitly enabled
    debug: process.env.NEXT_PUBLIC_CLERK_DEBUG === 'true',
  }
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
