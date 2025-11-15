/**
 * 게스트 → Professional 플랜 마이그레이션 API - DEPRECATED
 *
 * Migration feature has been disabled after removing Clerk authentication.
 * This endpoint returns 501 Not Implemented.
 *
 * POST /api/migration/guest-to-professional
 */

import { NextResponse } from 'next/server';

// Route Segment Config (필수)
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST: Migration feature disabled
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Migration feature is no longer supported. Clerk authentication has been removed.',
      },
    },
    { status: 501 }
  );
}
