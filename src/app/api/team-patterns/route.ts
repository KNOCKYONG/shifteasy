import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { teamPatterns } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { validateTeamPattern } from '@/lib/types/team-pattern';

export const dynamic = 'force-dynamic';

// 요청 검증 스키마
const CreateTeamPatternSchema = z.object({
  departmentId: z.string().uuid(),
  requiredStaffDay: z.number().min(1),
  requiredStaffEvening: z.number().min(1),
  requiredStaffNight: z.number().min(1),
  defaultPatterns: z.array(z.array(z.string())).min(1),
  totalMembers: z.number().min(3),
});

const UpdateTeamPatternSchema = z.object({
  requiredStaffDay: z.number().min(1).optional(),
  requiredStaffEvening: z.number().min(1).optional(),
  requiredStaffNight: z.number().min(1).optional(),
  defaultPatterns: z.array(z.array(z.string())).min(1).optional(),
  totalMembers: z.number().min(3).optional(),
  isActive: z.boolean().transform(val => val ? 'true' : 'false').optional(),
});

// GET: Team Pattern 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    if (!departmentId) {
      return NextResponse.json(
        { error: 'Department ID is required' },
        { status: 400 }
      );
    }

    // 부서의 Team Pattern 조회
    const patterns = await db
      .select()
      .from(teamPatterns)
      .where(
        and(
          eq(teamPatterns.departmentId, departmentId),
          eq(teamPatterns.isActive, 'true')
        )
      );

    if (patterns.length === 0) {
      // 기본값 반환
      return NextResponse.json({
        pattern: null,
        defaultPattern: {
          departmentId,
          requiredStaffDay: 5,
          requiredStaffEvening: 4,
          requiredStaffNight: 3,
          defaultPatterns: [['D', 'D', 'D', 'OFF', 'OFF']],
          totalMembers: 15,
        }
      });
    }

    return NextResponse.json({ pattern: patterns[0] });
  } catch (error) {
    console.error('Error fetching team pattern:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team pattern' },
      { status: 500 }
    );
  }
}

// POST: Team Pattern 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 체크 (관리자 또는 매니저만)
    if (!['admin', 'manager'].includes(user.role)) {
      return NextResponse.json(
        { error: '권한이 없습니다. Team Pattern 설정은 관리자 또는 매니저만 가능합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = CreateTeamPatternSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // 매니저는 자신의 부서만 수정 가능
    if (user.role === 'manager' && user.departmentId !== data.departmentId) {
      return NextResponse.json(
        { error: '다른 부서의 Team Pattern을 설정할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 비즈니스 로직 검증
    const validation = validateTeamPattern(data);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: '검증 실패', details: validation.errors },
        { status: 400 }
      );
    }

    // 기존 패턴이 있는지 확인
    const existing = await db
      .select()
      .from(teamPatterns)
      .where(eq(teamPatterns.departmentId, data.departmentId));

    if (existing.length > 0) {
      // 기존 패턴 비활성화
      await db
        .update(teamPatterns)
        .set({ isActive: 'false', updatedAt: new Date() })
        .where(eq(teamPatterns.departmentId, data.departmentId));
    }

    // 새 패턴 생성
    const newPattern = await db
      .insert(teamPatterns)
      .values({
        ...data,
        isActive: 'true',
      })
      .returning();

    return NextResponse.json({ pattern: newPattern[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating team pattern:', error);
    return NextResponse.json(
      { error: 'Failed to create team pattern' },
      { status: 500 }
    );
  }
}

// PUT: Team Pattern 수정
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 체크 (관리자 또는 매니저만)
    if (!['admin', 'manager'].includes(user.role)) {
      return NextResponse.json(
        { error: '권한이 없습니다. Team Pattern 수정은 관리자 또는 매니저만 가능합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const patternId = searchParams.get('id');

    if (!patternId) {
      return NextResponse.json(
        { error: 'Pattern ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validationResult = UpdateTeamPatternSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // 패턴 조회
    const patterns = await db
      .select()
      .from(teamPatterns)
      .where(eq(teamPatterns.id, patternId));

    if (patterns.length === 0) {
      return NextResponse.json(
        { error: 'Pattern not found' },
        { status: 404 }
      );
    }

    const pattern = patterns[0];

    // 매니저는 자신의 부서만 수정 가능
    if (user.role === 'manager' && user.departmentId !== pattern.departmentId) {
      return NextResponse.json(
        { error: '다른 부서의 Team Pattern을 수정할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 업데이트할 데이터 병합
    const updatedData = {
      ...pattern,
      ...data,
    };

    // 비즈니스 로직 검증
    const validation = validateTeamPattern(updatedData);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: '검증 실패', details: validation.errors },
        { status: 400 }
      );
    }

    // 패턴 업데이트
    const updated = await db
      .update(teamPatterns)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(teamPatterns.id, patternId))
      .returning();

    return NextResponse.json({ pattern: updated[0] });
  } catch (error) {
    console.error('Error updating team pattern:', error);
    return NextResponse.json(
      { error: 'Failed to update team pattern' },
      { status: 500 }
    );
  }
}

// DELETE: Team Pattern 삭제
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 체크 (관리자만)
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: '권한이 없습니다. Team Pattern 삭제는 관리자만 가능합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const patternId = searchParams.get('id');

    if (!patternId) {
      return NextResponse.json(
        { error: 'Pattern ID is required' },
        { status: 400 }
      );
    }

    // 소프트 삭제 (비활성화)
    await db
      .update(teamPatterns)
      .set({ isActive: 'false', updatedAt: new Date() })
      .where(eq(teamPatterns.id, patternId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team pattern:', error);
    return NextResponse.json(
      { error: 'Failed to delete team pattern' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}