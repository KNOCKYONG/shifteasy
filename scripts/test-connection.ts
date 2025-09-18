import { config } from 'dotenv';
import { resolve } from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function testConnection() {
  console.log('🔍 데이터베이스 연결 테스트...\n');

  const urls = [
    { name: 'DATABASE_URL', url: process.env.DATABASE_URL },
    { name: 'DIRECT_URL', url: process.env.DIRECT_URL },
    { name: 'SESSION_POOL_URL', url: process.env.SESSION_POOL_URL }
  ];

  for (const { name, url } of urls) {
    if (!url) {
      console.log(`❌ ${name}: 설정되지 않음`);
      continue;
    }

    console.log(`\n📡 ${name} 테스트 중...`);
    console.log(`   URL: ${url.replace(/:[^:@]+@/, ':****@')}`);

    try {
      const client = postgres(url, {
        prepare: false,
        ssl: 'require',
        max: 1,
        connect_timeout: 10
      });

      // 간단한 쿼리 실행
      const result = await client`SELECT NOW() as current_time`;
      console.log(`   ✅ 연결 성공! 서버 시간: ${result[0].current_time}`);

      await client.end();
    } catch (error: any) {
      console.log(`   ❌ 연결 실패:`, error.message);
    }
  }
}

testConnection()
  .then(() => {
    console.log('\n✨ 테스트 완료!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 오류 발생:', error);
    process.exit(1);
  });