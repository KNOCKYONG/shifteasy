import { config } from 'dotenv';
import { resolve } from 'path';
import postgres from 'postgres';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function checkTables() {
  const client = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    ssl: 'require',
    max: 1
  });

  try {
    console.log('📊 데이터베이스 테이블 확인 중...\n');

    // 모든 테이블 확인
    const tables = await client`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log('✅ 발견된 테이블:');
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

    // tenants 테이블 컬럼 확인
    const tenantColumns = await client`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tenants'
      ORDER BY ordinal_position;
    `;

    console.log('\n📋 tenants 테이블 구조:');
    tenantColumns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await client.end();
  }
}

checkTables()
  .then(() => {
    console.log('\n✨ 확인 완료!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 오류:', error);
    process.exit(1);
  });