/**
 * 게스트 계정 확인 API
 *
 * POST /api/migration/check-guest
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  checkGuestAccount,
  checkMigrationEligibility,
} from '@/lib/utils/migration';

// Route Segment Config (필수)
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

/**
 * POST: 현재 사용자가 게스트 계정인지 확인
 */
export async function POST() {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
          },
        },
        { status: 401 }
      );
    }

    // 2. 게스트 계정 정보 조회
    const guestInfo = await checkGuestAccount(userId);

    // 3. 마이그레이션 가능 여부 및 데이터 통계 확인
    let dataStats = null;
    if (guestInfo.isGuest && guestInfo.canMigrate && guestInfo.tenantId) {
      const eligibility = await checkMigrationEligibility(userId, guestInfo.tenantId);
      if (eligibility.eligible) {
        dataStats = eligibility.dataStats;
      }
    }

    return NextResponse.json({
      success: true,
      guestInfo,
      dataStats,
    });
  } catch (error) {
    console.error('Check guest account error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '게스트 계정 확인 중 오류가 발생했습니다.',
          details: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 }
    );
  }
}
