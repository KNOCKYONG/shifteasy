import { NextRequest, NextResponse } from 'next/server';
import { validateSecretCode } from '@/lib/auth/secret-code';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const { secretCode } = await req.json();

    if (!secretCode) {
      return NextResponse.json(
        { valid: false, error: '시크릿 코드를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 기존 validateSecretCode 함수 사용
    const result = await validateSecretCode(secretCode);

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      tenant: result.tenant,
      department: result.department
    });

  } catch (error) {
    console.error('Secret code validation error:', error);
    return NextResponse.json(
      { valid: false, error: '시크릿 코드 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
