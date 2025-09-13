import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testConnection() {
  try {
    const sql = postgres(process.env.DATABASE_URL!);

    const result = await sql`SELECT version()`;
    console.log('✅ Database connection successful!');
    console.log('PostgreSQL version:', result[0].version);

    await sql.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
}

testConnection();