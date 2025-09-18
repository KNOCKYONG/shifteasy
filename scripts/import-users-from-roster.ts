/**
 * 근무표(.xls/.xlsx)에서 이름 명단을 추출하여 test tenant(users 테이블)에 사용자 생성/업데이트
 *
 * 사용법 예시:
 *   npx tsx scripts/import-users-from-roster.ts --dir ./roster_src --tenant dev-org-id \
 *     --department "테스트부서" --deptCode TEST
 *
 * 준비물:
 *   - .env.local 에 DATABASE_URL 설정 필요 (Supabase/Postgres 연결 문자열)
 *   - xlsx 패키지(구형 .xls 지원)를 설치하면 .xls/.xlsx 모두 직접 파싱 가능:
 *       npm i -D xlsx
 *     설치가 어려우면 .xls 파일을 .xlsx 또는 .csv로 변환 후 --dir 에 넣어 주세요.
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { db } from '@/db';
import { users, tenants, departments } from '@/db/schema/tenants';
import { and, eq } from 'drizzle-orm';

type Args = {
  dir: string;
  tenant: string;
  department?: string;
  deptCode?: string;
  role?: 'admin' | 'manager' | 'member';
  createTenant?: boolean;
};

function parseArgs(): Args {
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const k = process.argv[i];
    const v = process.argv[i + 1];
    if (k?.startsWith('--') && typeof v === 'string') {
      args[k.slice(2)] = v;
    } else if (k?.startsWith('--') && v === undefined) {
      // flags without value (ignore for now)
      args[k.slice(2)] = 'true';
      i -= 1; // compensate
    }
  }
  return {
    dir: args.dir || './roster_src',
    // 기본값: 환경변수 DEV_TENANT_ID -> 내부 테스트 UUID -> (최후) 빈 문자열
    tenant: args.tenant || process.env.DEV_TENANT_ID || '3760b5ec-462f-443c-9a90-4a2b2e295e9d',
    department: args.department || '테스트부서',
    deptCode: args.deptCode || 'TEST',
    role: (args.role as any) || 'member',
    createTenant: args.createTenant === 'true',
  };
}

// 간단 이름 필터: 한글 2~4자 또는 공백 포함 2~6자 정도만 수집
function isLikelyPersonName(s: string): boolean {
  const name = s.trim();
  if (!name) return false;
  if (/^(합계|계|총원|Remarks|비고)/.test(name)) return false;
  if (/[0-9]/.test(name)) return false;
  // 한글 범위 또는 일반 문자 2~6자
  if (/^[가-힣]{2,4}$/.test(name)) return true;
  if (/^[가-힣A-Za-z\s]{2,6}$/.test(name)) return true;
  return false;
}

// 파일에서 이름 목록 추출(.xls/.xlsx/.csv 지원)
async function extractNamesFromFile(filePath: string): Promise<string[]> {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (ext === '.csv') {
      const text = fs.readFileSync(filePath, 'utf8');
      const rows = text.split(/\r?\n/);
      // 첫 컬럼 또는 "이름" 컬럼을 우선 탐색
      let header: string[] | null = null;
      const names: string[] = [];
      for (let i = 0; i < rows.length; i++) {
        const cols = rows[i].split(',').map(c => c.trim());
        if (!header) {
          header = cols;
          // 이름 컬럼 인덱스 찾기
          const nameIdx = header.findIndex(h => /이름|성명|Name/i.test(h));
          if (nameIdx >= 0) {
            // 해당 컬럼만 수집
            for (let r = i + 1; r < rows.length; r++) {
              const c = rows[r].split(',')[nameIdx]?.trim();
              if (c && isLikelyPersonName(c)) names.push(c);
            }
            return names;
          }
          // 헤더에 이름 컬럼 없으면 첫 컬럼 기준으로 수집
          continue; // 아래 일반 수집으로 넘어감
        }
        const first = cols[0]?.trim();
        if (first && isLikelyPersonName(first)) names.push(first);
      }
      return names;
    }

    // xls/xlsx 처리: 동적 import (설치 안 되어 있으면 안내)
    const XLSX = await import('xlsx').catch(() => null as any);
    if (!XLSX) {
      console.warn(`xlsx 패키지가 설치되어 있지 않습니다: ${filePath}\n  -> npm i -D xlsx 후 다시 실행하거나, 파일을 .csv/.xlsx로 변환해 주세요.`);
      return [];
    }
    const wb = XLSX.readFile(filePath);
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const json: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });

    const rows: string[][] = json as any;
    const names: string[] = [];
    if (!rows || rows.length === 0) return names;

    // 이름 컬럼 헤더 탐색
    const header = rows[0] || [];
    let nameColIdx = header.findIndex(h => typeof h === 'string' && /이름|성명|Name/i.test(h));
    if (nameColIdx >= 0) {
      for (let r = 1; r < rows.length; r++) {
        const val = String(rows[r]?.[nameColIdx] ?? '').trim();
        if (val && isLikelyPersonName(val)) names.push(val);
      }
      return names;
    }

    // 헤더에 없으면, 첫 컬럼 기준으로 수집 (월간 근무표 형태 가정)
    for (let r = 1; r < rows.length; r++) {
      const first = String(rows[r]?.[0] ?? '').trim();
      if (first && isLikelyPersonName(first)) names.push(first);
    }
    return names;
  } catch (e) {
    console.warn(`파일 파싱 실패: ${filePath} -> ${(e as Error).message}`);
    return [];
  }
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function genEmailBaseFromName(name: string): string {
  // 한글 이름을 간단히 영문 base로 변환: 자모 제거 후 유니코드 코드포인트로 fallback
  const basic = name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
  return basic || 'user';
}

async function main() {
  const { dir, tenant, department, deptCode, role, createTenant } = parseArgs();

  // 0) Tenant 확인
  let tenantId = tenant;
  const tenantRow = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (tenantRow.length === 0) {
    if (createTenant) {
      // slug/secretCode 임시값 생성
      const rand = Math.random().toString(36).slice(2, 8);
      const [created] = await db.insert(tenants).values({
        name: 'Test Tenant',
        slug: `test-${rand}`,
        secretCode: `secret-${rand}-${Date.now()}`,
        plan: 'free',
        settings: { timezone: 'Asia/Seoul', locale: 'ko' },
      }).returning();
      tenantId = created.id as string;
      console.log(`테넌트가 없어 새로 생성했습니다. tenantId=${tenantId}`);
    } else {
      console.error(`지정한 tenant가 존재하지 않습니다. tenantId=${tenantId}\n--createTenant true 옵션으로 임시 테넌트를 생성하거나, --tenant 에 실제 UUID를 전달해 주세요.`);
      process.exit(1);
    }
  }

  // 1) 디렉토리 내 roster 파일 수집
  const files = fs.readdirSync(dir)
    .filter(f => /\.(xls|xlsx|csv)$/i.test(f))
    .map(f => path.join(dir, f));

  if (files.length === 0) {
    console.error(`로스터 파일(.xls/.xlsx/.csv)을 찾지 못했습니다: ${dir}`);
    process.exit(1);
  }

  // 2) 이름 목록 추출
  const allNames: string[] = [];
  for (const f of files) {
    const names = await extractNamesFromFile(f);
    if (names.length) {
      console.log(`- ${path.basename(f)}: ${names.length}명 감지`);
      allNames.push(...names);
    }
  }
  const names = unique(allNames).sort();
  if (names.length === 0) {
    console.error('이름을 추출하지 못했습니다. 파일의 형식을 확인해 주세요.');
    process.exit(1);
  }

  console.log(`\n총 고유 인원: ${names.length}명`);

  // 3) 부서 준비 (없으면 생성)
  let deptId: string | null = null;
  if (department) {
    const existing = await db.select().from(departments).where(and(eq(departments.tenantId, tenantId), eq(departments.name, department)));
    if (existing.length > 0) {
      deptId = existing[0].id as string;
    } else {
      const inserted = await db.insert(departments).values({
        tenantId: tenantId,
        name: department,
        code: deptCode,
        description: '로스터 임포트 생성',
      }).returning();
      deptId = inserted[0].id as string;
      console.log(`부서 생성: ${department} (${deptId})`);
    }
  }

  // 4) 기존 사용자 로드 (이름 기반 매칭)
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.tenantId, tenantId));
  const byName = new Map<string, typeof existingUsers[number]>();
  for (const u of existingUsers) {
    byName.set(u.name.trim(), u);
  }

  // 5) upsert
  const toInsert: any[] = [];
  const toUpdate: Array<{ id: string; patch: any }> = [];

  let emailCounter = 1;
  for (const name of names) {
    const found = byName.get(name.trim());
    if (found) {
      const patch: any = {};
      if (deptId && found.departmentId !== deptId) patch.departmentId = deptId;
      if (found.status !== 'active') patch.status = 'active';
      if (Object.keys(patch).length > 0) {
        toUpdate.push({ id: found.id as string, patch });
      }
      continue;
    }

    const base = genEmailBaseFromName(name);
    let email = `${base}@example.com`;
    while (existingUsers.find(u => u.email === email) || toInsert.find(u => u.email === email)) {
      email = `${base}${emailCounter++}@example.com`;
    }

    toInsert.push({
      tenantId: tenantId,
      departmentId: deptId,
      email,
      name,
      role: role || 'member',
      employeeId: `EMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      position: 'Staff',
      profile: {
        phone: '',
        avatar: '',
        skills: [],
        certifications: [],
        preferences: {
          preferredShifts: [],
          unavailableDates: [],
          maxHoursPerWeek: 40,
          minHoursPerWeek: 30,
        },
      },
      status: 'active',
    });
  }

  // 6) DB 적용
  if (toInsert.length > 0) {
    await db.insert(users).values(toInsert);
    console.log(`신규 사용자 ${toInsert.length}명 생성 완료`);
  }
  for (const upd of toUpdate) {
    await db.update(users).set(upd.patch).where(eq(users.id, upd.id));
  }
  if (toUpdate.length > 0) {
    console.log(`기존 사용자 ${toUpdate.length}명 업데이트 완료`);
  }

  console.log('완료!');
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export {}; // ESM 호환
