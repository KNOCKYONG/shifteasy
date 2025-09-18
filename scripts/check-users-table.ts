import { config } from 'dotenv';
import { resolve } from 'path';
import postgres from 'postgres';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function checkUsersTable() {
  const client = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    ssl: 'require',
    max: 1
  });

  try {
    // users 테이블 컬럼 확인
    const userColumns = await client`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `;

    console.log('📋 users 테이블 구조:');
    userColumns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await client.end();
  }
}

checkUsersTable();