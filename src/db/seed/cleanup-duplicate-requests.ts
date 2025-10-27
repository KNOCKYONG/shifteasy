/**
 * Cleanup Duplicate Special Requests
 * 같은 employee_id + start_date + request_type 조합의 중복 레코드를 정리
 * 가장 최근에 생성된 레코드만 남김
 */

import postgres from 'postgres';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env.local') });

async function cleanupDuplicateRequests() {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: 'require'
  });

  console.log('🔄 Cleaning up duplicate special requests...\n');

  try {
    // 1. Find duplicates
    console.log('📋 Finding duplicate requests...');

    const duplicates = await sql`
      SELECT
        tenant_id,
        employee_id,
        start_date,
        request_type,
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY created_at DESC) as ids
      FROM special_requests
      GROUP BY tenant_id, employee_id, start_date, request_type
      HAVING COUNT(*) > 1
    `;

    console.log(`Found ${duplicates.length} duplicate groups\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!\n');
      await sql.end();
      return;
    }

    // Show duplicates details
    console.log('📊 Duplicate details:');
    for (const dup of duplicates) {
      console.log(`  - Employee ${dup.employee_id.substring(0, 8)}... on ${dup.start_date}: ${dup.count} records`);
    }
    console.log();

    // 2. Delete duplicates (keep the most recent one - first in the array)
    console.log('🗑️  Deleting duplicate records...');

    let totalDeleted = 0;

    for (const dup of duplicates) {
      const idsToDelete = dup.ids.slice(1); // Keep first (most recent), delete rest

      if (idsToDelete.length > 0) {
        await sql`
          DELETE FROM special_requests
          WHERE id = ANY(${idsToDelete})
        `;

        totalDeleted += idsToDelete.length;
        console.log(`  - Deleted ${idsToDelete.length} duplicate(s) for ${dup.employee_id.substring(0, 8)}... on ${dup.start_date}`);
      }
    }

    console.log(`\n✅ Deleted ${totalDeleted} duplicate records\n`);

    // 3. Verify cleanup
    console.log('🔍 Verifying cleanup...');

    const remainingDuplicates = await sql`
      SELECT
        COUNT(*) as count
      FROM (
        SELECT
          tenant_id,
          employee_id,
          start_date,
          request_type,
          COUNT(*) as cnt
        FROM special_requests
        GROUP BY tenant_id, employee_id, start_date, request_type
        HAVING COUNT(*) > 1
      ) as duplicates
    `;

    const dupCount = remainingDuplicates[0]?.count || 0;

    if (dupCount === '0') {
      console.log('✅ All duplicates cleaned up successfully!\n');
    } else {
      console.log(`⚠️  Still ${dupCount} duplicate group(s) remaining\n`);
    }

    // 4. Show final statistics
    console.log('📊 Final statistics:');

    const stats = await sql`
      SELECT
        request_type,
        COUNT(*) as count
      FROM special_requests
      GROUP BY request_type
      ORDER BY request_type
    `;

    console.log('  Requests by type:');
    stats.forEach(row => {
      console.log(`    - ${row.request_type}: ${row.count}`);
    });

    console.log('\n✅ Cleanup completed!\n');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run cleanup if called directly
if (require.main === module) {
  cleanupDuplicateRequests()
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { cleanupDuplicateRequests };
