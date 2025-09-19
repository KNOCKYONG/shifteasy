/**
 * Rate Limit Management API - 임시 구현
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 임시로 성공 응답 반환
  return NextResponse.json({
    success: true,
    message: 'Rate limiting is temporarily disabled',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  // 임시로 성공 응답 반환
  return NextResponse.json({
    success: true,
    message: 'Rate limiting is temporarily disabled',
  });
}

export async function DELETE(request: NextRequest) {
  // 임시로 성공 응답 반환
  return NextResponse.json({
    success: true,
    message: 'Rate limiting is temporarily disabled',
  });
}