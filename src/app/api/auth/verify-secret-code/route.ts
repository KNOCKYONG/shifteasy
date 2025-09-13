import { NextRequest, NextResponse } from 'next/server';
import { validateSecretCode } from '@/lib/auth/secret-code';

export async function POST(req: NextRequest) {
  try {
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 30) + '...');
    const { email, secretCode } = await req.json();
    console.log('Received:', { email, secretCode });

    if (!email || !secretCode) {
      return NextResponse.json(
        { error: '이메일과 시크릿 코드를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 시크릿 코드 검증
    const result = await validateSecretCode(secretCode);

    if (!result.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: result.error || '유효하지 않은 시크릿 코드입니다.'
        },
        { status: 400 }
      );
    }

    // 이메일 중복 체크는 실제 가입 단계에서 진행
    return NextResponse.json({
      valid: true,
      tenant: result.tenant,
    });
  } catch (error) {
    console.error('Secret code verification error:', error);
    return NextResponse.json(
      { error: '시크릿 코드 검증 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}