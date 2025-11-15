import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { departmentPatterns, departments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  EXCLUDED_REQUIRED_SHIFT_CODES,
  deriveRequiredStaffByShift,
  validateTeamPattern,
} from '@/lib/types/team-pattern';
import { getShiftTypes, type ConfigurableShiftType } from '@/lib/config/shiftTypes';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

// 요청 검증 스키마
const RequiredStaffRecordSchema = z.record(z.string(), z.number().min(0)).optional();

const CreateDepartmentPatternSchema = z.object({
  departmentId: z.string().uuid(),
  requiredStaffByShift: RequiredStaffRecordSchema,
  requiredStaffDay: z.number().min(1).optional(),
  requiredStaffEvening: z.number().min(1).optional(),
  requiredStaffNight: z.number().min(1).optional(),
  defaultPatterns: z.array(z.array(z.string())).min(1),
  avoidPatterns: z.array(z.array(z.string())).optional().default([]), // 기피 근무 패턴 (선택사항)
  totalMembers: z.number().min(3),
});

const UpdateDepartmentPatternSchema = z.object({
  requiredStaffByShift: RequiredStaffRecordSchema,
  requiredStaffDay: z.number().min(1).optional(),
  requiredStaffEvening: z.number().min(1).optional(),
  requiredStaffNight: z.number().min(1).optional(),
  defaultPatterns: z.array(z.array(z.string())).min(1).optional(),
  avoidPatterns: z.array(z.array(z.string())).optional(), // 기피 근무 패턴 (선택사항)
  totalMembers: z.number().min(3).optional(),
  isActive: z.boolean().transform(val => val ? 'true' : 'false').optional(),
});

const CORE_SHIFT_CODES = ['D', 'E', 'N'];

const sanitizeRequiredStaff = (
  payload: {
    requiredStaffByShift?: Record<string, number>;
    requiredStaffDay?: number;
    requiredStaffEvening?: number;
    requiredStaffNight?: number;
  },
  shiftTypes: ConfigurableShiftType[],
) => {
  const allowedCodes = new Set(
    shiftTypes.map((st) => st.code.toUpperCase()).filter((code) => !EXCLUDED_REQUIRED_SHIFT_CODES.has(code))
  );

  CORE_SHIFT_CODES.forEach((code) => allowedCodes.add(code));

  const baseMap = deriveRequiredStaffByShift(payload);

  allowedCodes.forEach((code) => {
    if (!(code in baseMap)) {
      baseMap[code] = 0;
    }
  });

  const normalized: Record<string, number> = {};
  Object.entries(baseMap).forEach(([code, value]) => {
    const normalizedCode = code.toUpperCase();
    if (!allowedCodes.has(normalizedCode)) {
      return;
    }
    normalized[normalizedCode] = Math.max(0, Math.floor(value ?? 0));
  });

  return {
    requiredStaffByShift: normalized,
    requiredStaffDay: normalized.D ?? 0,
    requiredStaffEvening: normalized.E ?? 0,
    requiredStaffNight: normalized.N ?? 0,
  };
};

// GET: Department Pattern 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const departmentId = searchParams.get('departmentId');

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!departmentId) {
      return NextResponse.json(
        { error: 'Department ID is required' },
        { status: 400 }
      );
    }

    // 'no-department' or invalid UUID인 경우 기본값 반환
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (departmentId === 'no-department' || !uuidRegex.test(departmentId)) {
      console.log('[GET] Invalid or no-department ID, returning default pattern');
      const fallbackRequiredStaff = deriveRequiredStaffByShift();
      return NextResponse.json({
        pattern: null,
        defaultPattern: {
          departmentId,
          requiredStaffDay: 5,
          requiredStaffEvening: 4,
          requiredStaffNight: 3,
          requiredStaffByShift: fallbackRequiredStaff,
          defaultPatterns: [['D', 'D', 'D', 'OFF', 'OFF']],
          totalMembers: 15,
        }
      });
    }

    // 부서 정보 및 테넌트 확인
    const departmentInfo = await db
      .select({
        id: departments.id,
        tenantId: departments.tenantId,
      })
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);

    if (departmentInfo.length === 0) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    if (departmentInfo[0].tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: '해당 부서에 접근할 수 없습니다.' },
        { status: 403 }
      );
    }

    const tenantId = departmentInfo[0].tenantId;

    // 부서의 Department Pattern 조회
    console.log('[GET] Querying department patterns for departmentId:', departmentId);

    const patterns = await db
      .select()
      .from(departmentPatterns)
      .where(
        and(
          eq(departmentPatterns.departmentId, departmentId),
          eq(departmentPatterns.tenantId, tenantId),
          eq(departmentPatterns.isActive, 'true')
        )
      );

    console.log('[GET] Found patterns:', patterns.length);

    // shift_types 가져오기 (department별로 자동 생성)
    const shiftTypes = await getShiftTypes(tenantId, departmentId);

    if (patterns.length === 0) {
      // 기본값 반환
      return NextResponse.json({
        pattern: null,
        shiftTypes, // shift_types 추가
        defaultPattern: {
          departmentId,
          requiredStaffDay: 5,
          requiredStaffEvening: 4,
          requiredStaffNight: 3,
          requiredStaffByShift: deriveRequiredStaffByShift(),
          defaultPatterns: [['D', 'D', 'D', 'OFF', 'OFF']],
          totalMembers: 15,
        }
      });
    }

    const sanitized = sanitizeRequiredStaff(patterns[0], shiftTypes);

    return NextResponse.json({
      pattern: {
        ...patterns[0],
        ...sanitized,
      },
      shiftTypes // shift_types 추가
    });
  } catch (error) {
    console.error('Error fetching department pattern:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      departmentId,
    });
    return NextResponse.json(
      {
        error: 'Failed to fetch department pattern',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST: Department Pattern 생성
export async function POST(request: NextRequest) {
  try {
    console.log('[POST] Creating department pattern...');

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[POST] User role:', user.role);

    // 권한 체크 (관리자 또는 매니저만)
    if (!['admin', 'manager'].includes(user.role)) {
      return NextResponse.json(
        { error: '권한이 없습니다. Department Pattern 설정은 관리자 또는 매니저만 가능합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    console.log('[POST] Request body:', JSON.stringify(body, null, 2));

    const validationResult = CreateDepartmentPatternSchema.safeParse(body);

    if (!validationResult.success) {
      console.log('[POST] Validation failed:', validationResult.error.issues);
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    console.log('[POST] Validated data:', JSON.stringify(data, null, 2));

    // 매니저는 자신의 부서만 수정 가능
    if (user.role === 'manager' && user.departmentId !== data.departmentId) {
      return NextResponse.json(
        { error: '다른 부서의 Department Pattern을 설정할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 부서의 tenantId 가져오기
    const departmentInfo = await db
      .select({
        id: departments.id,
        tenantId: departments.tenantId,
      })
      .from(departments)
      .where(eq(departments.id, data.departmentId))
      .limit(1);

    if (departmentInfo.length === 0) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    if (departmentInfo[0].tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: '해당 부서에 패턴을 생성할 수 없습니다.' },
        { status: 403 }
      );
    }

    const tenantId = departmentInfo[0].tenantId;

    console.log('[POST] Fetching shift_types with tenantId:', tenantId, 'departmentId:', data.departmentId);

    // shift_types 가져오기 (department별로 자동 생성)
    const shiftTypes = await getShiftTypes(tenantId, data.departmentId);
    console.log('[POST] Retrieved shift types:', JSON.stringify(shiftTypes, null, 2));

    const validShiftCodes = shiftTypes.map((st) => st.code);

    // 'O' 코드가 있으면 'OFF' 별칭도 허용
    if (validShiftCodes.includes('O') && !validShiftCodes.includes('OFF')) {
      validShiftCodes.push('OFF');
    }

    console.log('[POST] Valid shift codes:', validShiftCodes);

    const requiredStaff = sanitizeRequiredStaff(data, shiftTypes);

    // 비즈니스 로직 검증 (실제 shift_types 기준으로 검증)
    const validation = validateTeamPattern({ ...data, ...requiredStaff }, validShiftCodes);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: '검증 실패', details: validation.errors },
        { status: 400 }
      );
    }

    // 기존 패턴이 있는지 확인
    console.log('[POST] Checking existing patterns...');
    const existing = await db
      .select()
      .from(departmentPatterns)
      .where(
        and(
          eq(departmentPatterns.departmentId, data.departmentId),
          eq(departmentPatterns.tenantId, tenantId)
        )
      );

    console.log('[POST] Found existing patterns:', existing.length);

    if (existing.length > 0) {
      // 기존 패턴 비활성화
      console.log('[POST] Deactivating existing patterns...');
      await db
        .update(departmentPatterns)
        .set({ isActive: 'false', updatedAt: new Date() })
        .where(
          and(
            eq(departmentPatterns.departmentId, data.departmentId),
            eq(departmentPatterns.tenantId, tenantId)
          )
        );
    }

    // 새 패턴 생성
    console.log('[POST] Inserting new pattern...');
    const newPattern = await db
      .insert(departmentPatterns)
      .values({
        ...data,
        ...requiredStaff,
        tenantId,
        isActive: 'true',
      })
      .returning();

    console.log('[POST] Pattern created successfully');
    return NextResponse.json({ pattern: newPattern[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating department pattern:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: 'Failed to create department pattern',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT: Department Pattern 수정
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 체크 (관리자 또는 매니저만)
    if (!['admin', 'manager'].includes(user.role)) {
      return NextResponse.json(
        { error: '권한이 없습니다. Department Pattern 수정은 관리자 또는 매니저만 가능합니다.' },
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
    const validationResult = UpdateDepartmentPatternSchema.safeParse(body);

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
      .from(departmentPatterns)
      .where(
        and(
          eq(departmentPatterns.id, patternId),
          eq(departmentPatterns.tenantId, user.tenantId)
        )
      );

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
        { error: '다른 부서의 Department Pattern을 수정할 수 없습니다.' },
        { status: 403 }
      );
    }

    // shift_types 가져오기 (department별로 자동 생성)
    const shiftTypes = await getShiftTypes(pattern.tenantId, pattern.departmentId);
    const validShiftCodes = shiftTypes.map((st) => st.code);

    // 'O' 코드가 있으면 'OFF' 별칭도 허용
    if (validShiftCodes.includes('O') && !validShiftCodes.includes('OFF')) {
      validShiftCodes.push('OFF');
    }

    const mergedStaffInput = {
      requiredStaffByShift: data.requiredStaffByShift ?? pattern.requiredStaffByShift,
      requiredStaffDay: data.requiredStaffDay ?? pattern.requiredStaffDay,
      requiredStaffEvening: data.requiredStaffEvening ?? pattern.requiredStaffEvening,
      requiredStaffNight: data.requiredStaffNight ?? pattern.requiredStaffNight,
    };

    const requiredStaff = sanitizeRequiredStaff(mergedStaffInput, shiftTypes);

    // 업데이트할 데이터 병합
    const updatedData = {
      ...pattern,
      ...data,
      ...requiredStaff,
      // null을 undefined로 변환
      avoidPatterns: (data.avoidPatterns ?? pattern.avoidPatterns) || undefined,
    };

    // 비즈니스 로직 검증 (실제 shift_types 기준으로 검증)
    const validation = validateTeamPattern(updatedData, validShiftCodes);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: '검증 실패', details: validation.errors },
        { status: 400 }
      );
    }

    // 패턴 업데이트
    const updated = await db
      .update(departmentPatterns)
      .set({
        ...data,
        ...requiredStaff,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(departmentPatterns.id, patternId),
          eq(departmentPatterns.tenantId, user.tenantId)
        )
      )
      .returning();

    return NextResponse.json({ pattern: updated[0] });
  } catch (error) {
    console.error('Error updating department pattern:', error);
    return NextResponse.json(
      { error: 'Failed to update department pattern' },
      { status: 500 }
    );
  }
}

// DELETE: Department Pattern 삭제
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 체크 (관리자만)
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: '권한이 없습니다. Department Pattern 삭제는 관리자만 가능합니다.' },
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

    const pattern = await db
      .select()
      .from(departmentPatterns)
      .where(
        and(
          eq(departmentPatterns.id, patternId),
          eq(departmentPatterns.tenantId, user.tenantId)
        )
      )
      .limit(1);

    if (pattern.length === 0) {
      return NextResponse.json(
        { error: 'Pattern not found' },
        { status: 404 }
      );
    }

    // 소프트 삭제 (비활성화)
    await db
      .update(departmentPatterns)
      .set({ isActive: 'false', updatedAt: new Date() })
      .where(
        and(
          eq(departmentPatterns.id, patternId),
          eq(departmentPatterns.tenantId, user.tenantId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting department pattern:', error);
    return NextResponse.json(
      { error: 'Failed to delete department pattern' },
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
