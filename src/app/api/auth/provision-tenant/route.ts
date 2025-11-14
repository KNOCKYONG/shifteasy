import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants, departments } from '@/db/schema/tenants';
import { eq } from 'drizzle-orm';

const SECRET_CODE_LENGTH = 8;
const SECRET_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRandomSecretCode() {
  let code = '';
  for (let i = 0; i < SECRET_CODE_LENGTH; i += 1) {
    const idx = Math.floor(Math.random() * SECRET_CHARS.length);
    code += SECRET_CHARS[idx];
  }
  return code;
}

function slugifyHospitalName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'workspace';
}

async function generateUniqueSecretCode() {
  while (true) {
    const candidate = generateRandomSecretCode();
    const existing = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.secretCode, candidate))
      .limit(1);
    if (existing.length === 0) {
      return candidate;
    }
  }
}

async function generateUniqueSlug(base: string) {
  let slug = base;
  let suffix = 1;

  while (true) {
    const existing = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (existing.length === 0) {
      return slug;
    }

    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const hospitalName = typeof body.hospitalName === 'string' ? body.hospitalName.trim() : '';

    if (!hospitalName) {
      return NextResponse.json(
        { error: '병원명을 입력해주세요.' },
        { status: 400 }
      );
    }

    const secretCode = await generateUniqueSecretCode();
    const slugBase = slugifyHospitalName(hospitalName);
    const slug = await generateUniqueSlug(slugBase);

    const trialExpiresAt = new Date();
    trialExpiresAt.setDate(trialExpiresAt.getDate() + 90);

    const [createdTenant] = await db
      .insert(tenants)
      .values({
        name: hospitalName,
        slug,
        secretCode,
        plan: 'professional',
        settings: {
          timezone: 'Asia/Seoul',
          locale: 'ko',
          maxUsers: 50,
          maxDepartments: 10,
          features: ['ai-scheduling', 'analytics', 'priority-support'],
          signupEnabled: true,
          planExpiresAt: trialExpiresAt.toISOString(),
        },
      })
      .returning();

    if (!createdTenant) {
      return NextResponse.json(
        { error: '워크스페이스 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    await db.insert(departments).values({
      tenantId: createdTenant.id,
      name: '기본 부서',
      code: `${slug}-dept`,
      settings: {
        minStaff: 1,
        maxStaff: 50,
      },
    });

    return NextResponse.json({
      success: true,
      secretCode,
      tenantId: createdTenant.id,
      slug: createdTenant.slug,
    });
  } catch (error) {
    console.error('Provision tenant error:', error);
    return NextResponse.json(
      { error: '워크스페이스 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
