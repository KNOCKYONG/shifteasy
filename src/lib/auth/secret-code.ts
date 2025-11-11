/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { db } from '@/db';
import { tenants, departments } from '@/db/schema/tenants';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * 시크릿 코드 생성 (8자리 랜덤 문자열)
 * 형식: XXXX-XXXX (대문자 영숫자)
 */
export function generateSecretCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}

/**
 * 고유한 시크릿 코드 생성 (중복 체크 포함)
 */
export async function generateUniqueSecretCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateSecretCode();

    // 중복 체크
    const existing = await db
      .select()
      .from(tenants)
      .where(eq(tenants.secretCode, code))
      .limit(1);

    if (existing.length === 0) {
      return code;
    }

    attempts++;
  }

  // 매우 희귀한 경우: 타임스탬프 기반 코드 생성
  return `T${Date.now().toString(36).toUpperCase()}`;
}

/**
 * 시크릿 코드로 테넌트/부서 검증
 * 부서 시크릿 코드를 우선 체크하고, 없으면 테넌트 시크릿 코드를 체크
 */
export async function validateSecretCode(secretCode: string): Promise<{
  valid: boolean;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    signupEnabled: boolean;
  };
  department?: {
    id: string;
    name: string;
    code?: string;
  };
  error?: string;
}> {
  try {
    // 대소문자 구분 없이 검색
    const normalizedCode = secretCode.toUpperCase().trim();

    // 1. 먼저 부서 시크릿 코드를 체크
    const departmentResult = await db
      .select({
        departmentId: departments.id,
        departmentName: departments.name,
        departmentCode: departments.code,
        tenantId: tenants.id,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        tenantSettings: tenants.settings,
      })
      .from(departments)
      .innerJoin(tenants, eq(departments.tenantId, tenants.id))
      .where(eq(departments.secretCode, normalizedCode))
      .limit(1);

    if (departmentResult.length > 0) {
      const result = departmentResult[0];
      const signupEnabled = result.tenantSettings?.signupEnabled !== false;

      if (!signupEnabled) {
        return {
          valid: false,
          error: '현재 이 조직은 신규 가입을 받지 않습니다.',
        };
      }

      return {
        valid: true,
        tenant: {
          id: result.tenantId,
          name: result.tenantName,
          slug: result.tenantSlug,
          signupEnabled,
        },
        department: {
          id: result.departmentId,
          name: result.departmentName,
          code: result.departmentCode || undefined,
        },
      };
    }

    // 2. 부서 코드가 없으면 테넌트 시크릿 코드 체크
    const tenantResult = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        settings: tenants.settings,
        secretCode: tenants.secretCode,
      })
      .from(tenants)
      .where(eq(tenants.secretCode, normalizedCode))
      .limit(1);

    if (tenantResult.length === 0) {
      return {
        valid: false,
        error: '유효하지 않은 시크릿 코드입니다.',
      };
    }

    const tenant = tenantResult[0];
    const signupEnabled = tenant.settings?.signupEnabled !== false;

    if (!signupEnabled) {
      return {
        valid: false,
        error: '현재 이 조직은 신규 가입을 받지 않습니다.',
      };
    }

    return {
      valid: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        signupEnabled,
      },
    };
  } catch (error) {
    console.error('Secret code validation error:', error);
    return {
      valid: false,
      error: '시크릿 코드 검증 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 테넌트의 시크릿 코드 재생성
 */
export async function regenerateSecretCode(tenantId: string): Promise<{
  success: boolean;
  secretCode?: string;
  error?: string;
}> {
  try {
    const newCode = await generateUniqueSecretCode();

    const result = await db
      .update(tenants)
      .set({
        secretCode: newCode,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning({
        secretCode: tenants.secretCode,
      });

    if (result.length === 0) {
      return {
        success: false,
        error: '테넌트를 찾을 수 없습니다.',
      };
    }

    return {
      success: true,
      secretCode: result[0].secretCode,
    };
  } catch (error) {
    console.error('Secret code regeneration error:', error);
    return {
      success: false,
      error: '시크릿 코드 재생성 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 테넌트 가입 활성화/비활성화
 */
export async function toggleSignupEnabled(
  tenantId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (tenant.length === 0) {
      return {
        success: false,
        error: '테넌트를 찾을 수 없습니다.',
      };
    }

    const currentSettings = tenant[0].settings || {};

    await db
      .update(tenants)
      .set({
        settings: {
          ...currentSettings,
          signupEnabled: enabled,
        },
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    return { success: true };
  } catch (error) {
    console.error('Toggle signup error:', error);
    return {
      success: false,
      error: '설정 변경 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 시크릿 코드 형식 검증
 */
export function isValidSecretCodeFormat(code: string): boolean {
  // XXXX-XXXX 형식 또는 특수 형식 허용
  const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  const specialPattern = /^T[A-Z0-9]+$/;

  const normalized = code.toUpperCase().trim();
  return pattern.test(normalized) || specialPattern.test(normalized);
}