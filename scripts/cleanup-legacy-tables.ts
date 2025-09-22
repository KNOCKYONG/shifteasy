/**
 * Legacy 테이블 정리 스크립트
 * Drizzle을 통해 생성된 마이그레이션을 적용
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function cleanupLegacyTables() {
  try {
    console.log('🗑️  Starting legacy table cleanup...\n');

    // 삭제할 테이블 목록
    const tablesToDrop = [
      'ward_assignments',
      'hospitals',
      'wards',
      'staff',
      'staff_compatibility',
      'shifts',
      'ward_schedules',
      'preferences',
      'requests'
    ];

    // 삭제할 enum 타입들
    const typesToDrop = [
      'staff_role',
      'shift_type',
      'schedule_status',
      'request_priority',
      'request_status',
      'request_type'
    ];

    console.log('📋 테이블 삭제 중...');

    for (const table of tablesToDrop) {
      const { error } = await supabase.rpc('exec_sql', {
        sql: `DROP TABLE IF EXISTS "${table}" CASCADE;`
      }).single();

      if (error) {
        console.error(`❌ Error dropping table ${table}:`, error.message);
      } else {
        console.log(`✅ Dropped table: ${table}`);
      }
    }

    console.log('\n📋 Enum 타입 삭제 중...');

    for (const type of typesToDrop) {
      const { error } = await supabase.rpc('exec_sql', {
        sql: `DROP TYPE IF EXISTS "public"."${type}" CASCADE;`
      }).single();

      if (error) {
        console.error(`❌ Error dropping type ${type}:`, error.message);
      } else {
        console.log(`✅ Dropped type: ${type}`);
      }
    }

    // tenants 테이블의 불필요한 컬럼 제거
    console.log('\n📋 불필요한 컬럼 제거 중...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "billing_info";`
    }).single();

    if (alterError) {
      console.error('❌ Error altering tenants table:', alterError.message);
    } else {
      console.log('✅ Removed billing_info column from tenants table');
    }

    console.log('\n✨ Legacy 테이블 정리 완료!');
    console.log('\n현재 유지되는 테이블들:');
    console.log('- Multi-tenant: tenants, departments, users');
    console.log('- 스케줄링: schedules, shiftTypes, patterns, shift_assignments');
    console.log('- 기능: swapRequests, notifications, attendance, pushSubscriptions');
    console.log('- 시스템: audit_log, system_config');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// RPC 함수가 없는 경우를 위한 대체 방법
async function createExecSqlFunction() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `
  }).single();

  if (error && !error.message.includes('already exists')) {
    console.log('ℹ️  exec_sql 함수를 생성할 수 없습니다. Supabase Dashboard에서 직접 SQL을 실행해주세요.');

    // 대신 실행할 SQL을 출력
    console.log('\n다음 SQL을 Supabase SQL Editor에서 실행하세요:\n');
    console.log(readFileSync(
      path.join(__dirname, '../src/db/migrations/0003_watery_living_mummy.sql'),
      'utf-8'
    ));

    process.exit(0);
  }
}

// 실행
(async () => {
  await createExecSqlFunction();
  await cleanupLegacyTables();
})();