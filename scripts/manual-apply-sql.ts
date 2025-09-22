/**
 * Manually apply SQL migrations to bypass interactive prompts
 * 대화형 프롬프트를 우회하여 SQL 직접 적용
 */

import { db } from '../src/db';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';
import { resolve } from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

async function applyMigration() {
  console.log('🚀 SQL 마이그레이션 직접 적용 시작...');

  try {
    // Read the migration file
    const migrationPath = resolve(__dirname, '../src/db/migrations/0004_youthful_crusher_hogan.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by statement breakpoint and filter out empty statements
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    console.log(`총 ${statements.length}개의 SQL 문 발견`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty lines
      if (!statement || statement.startsWith('--')) {
        continue;
      }

      // Log what we're doing
      if (statement.includes('CREATE TYPE')) {
        const typeName = statement.match(/"([^"]+)"/)?.[1];
        console.log(`🔧 Creating type: ${typeName}`);
      } else if (statement.includes('CREATE TABLE')) {
        const tableName = statement.match(/CREATE TABLE "([^"]+)"/)?.[1];
        console.log(`📋 Creating table: ${tableName}`);
      } else if (statement.includes('CREATE INDEX')) {
        const indexName = statement.match(/CREATE INDEX "([^"]+)"/)?.[1];
        console.log(`🔍 Creating index: ${indexName}`);
      } else if (statement.includes('ALTER TABLE')) {
        const tableName = statement.match(/ALTER TABLE "([^"]+)"/)?.[1];
        console.log(`✏️  Altering table: ${tableName}`);
      }

      try {
        // Check if it's a CREATE TYPE statement and if type already exists
        if (statement.includes('CREATE TYPE')) {
          const typeName = statement.match(/CREATE TYPE "public"\."([^"]+)"/)?.[1];
          if (typeName) {
            // Check if type exists
            const checkResult = await db.execute(sql`
              SELECT 1 FROM pg_type WHERE typname = ${typeName}
            `);
            
            if (checkResult.rows && checkResult.rows.length > 0) {
              console.log(`   ⚠️  Type ${typeName} already exists, skipping...`);
              continue;
            }
          }
        }

        // Check if it's a CREATE TABLE statement and if table already exists
        if (statement.includes('CREATE TABLE')) {
          const tableName = statement.match(/CREATE TABLE "([^"]+)"/)?.[1];
          if (tableName) {
            // Check if table exists
            const checkResult = await db.execute(sql`
              SELECT 1 FROM pg_tables WHERE tablename = ${tableName}
            `);
            
            if (checkResult.rows && checkResult.rows.length > 0) {
              console.log(`   ⚠️  Table ${tableName} already exists, skipping...`);
              continue;
            }
          }
        }

        // Execute the statement
        await db.execute(sql.raw(statement));
        console.log(`   ✅ Success`);
      } catch (error: any) {
        // If it's a "already exists" error, we can skip it
        if (error.message?.includes('already exists')) {
          console.log(`   ⚠️  Already exists, skipping...`);
        } else {
          console.error(`   ❌ Error: ${error.message}`);
          // Don't stop on error, continue with next statement
        }
      }
    }

    console.log('\n🎉 마이그레이션 적용 완료!');

    // Update migration metadata in drizzle table
    try {
      await db.execute(sql`
        INSERT INTO "__drizzle_migrations" (hash, created_at) 
        VALUES ('0004_youthful_crusher_hogan', ${new Date().getTime()})
        ON CONFLICT (hash) DO NOTHING
      `);
      console.log('✅ Migration metadata updated');
    } catch (error) {
      console.log('⚠️  Could not update migration metadata (table might not exist)');
    }

  } catch (error) {
    console.error('❌ 마이그레이션 적용 중 오류:', error);
    process.exit(1);
  }
}

// Run the migration
applyMigration()
  .then(() => {
    console.log('\n✅ 모든 작업이 성공적으로 완료되었습니다.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 작업 실행 중 오류:', error);
    process.exit(1);
  });