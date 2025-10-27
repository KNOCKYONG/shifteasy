import postgres from 'postgres';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

async function updateShiftTypesDepartment() {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: 'require'
  });

  try {
    console.log('🔗 Connecting to database...\n');

    // 1. Find 김수진's department_id
    console.log('🔍 Finding 김수진\'s department_id...\n');

    const user = await sql`
      SELECT id, name, department_id
      FROM users
      WHERE name = '김수진'
      LIMIT 1
    `;

    if (user.length === 0) {
      console.log('❌ User 김수진 not found\n');
      return;
    }

    const targetDepartmentId = user[0].department_id;
    console.log(`✅ Found user: ${user[0].name}`);
    console.log(`   - user_id: ${user[0].id}`);
    console.log(`   - department_id: ${targetDepartmentId}\n`);

    if (!targetDepartmentId) {
      console.log('❌ User 김수진 has no department_id\n');
      return;
    }

    // 2. Check current shift_types state
    console.log('📊 Current shift_types state:\n');

    const currentShiftTypes = await sql`
      SELECT id, code, name, tenant_id, department_id
      FROM shift_types
      ORDER BY code, created_at
    `;

    console.log(`Total shift types: ${currentShiftTypes.length}`);
    currentShiftTypes.forEach(st => {
      const deptDisplay = st.department_id ? st.department_id.substring(0, 8) + '...' : 'GLOBAL';
      console.log(`  - ${st.code} (${st.name}): dept=${deptDisplay}`);
    });
    console.log('');

    // 3. Update all shift_types to use 김수진's department_id
    console.log('🔄 Updating all shift_types to use 김수진\'s department_id...\n');

    const updateResult = await sql`
      UPDATE shift_types
      SET department_id = ${targetDepartmentId}
      WHERE department_id IS NULL OR department_id != ${targetDepartmentId}
    `;

    console.log(`✅ Updated ${updateResult.count} shift_types\n`);

    // 4. Find duplicates by code (same tenant_id, department_id, code)
    console.log('🔍 Finding duplicate shift_types by code...\n');

    const duplicates = await sql`
      SELECT
        tenant_id,
        department_id,
        code,
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY created_at ASC) as ids,
        ARRAY_AGG(name ORDER BY created_at ASC) as names
      FROM shift_types
      GROUP BY tenant_id, department_id, code
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found\n');
    } else {
      console.log(`Found ${duplicates.length} duplicate code(s):\n`);

      for (const dup of duplicates) {
        console.log(`  Code: ${dup.code}`);
        console.log(`    - Count: ${dup.count}`);
        console.log(`    - IDs: ${dup.ids.map((id: string) => id.substring(0, 8) + '...').join(', ')}`);
        console.log(`    - Names: ${dup.names.join(', ')}`);

        // Keep the first one (oldest), delete the rest
        const idsToDelete = dup.ids.slice(1);

        if (idsToDelete.length > 0) {
          console.log(`    - Deleting ${idsToDelete.length} duplicate(s)...\n`);

          await sql`
            DELETE FROM shift_types
            WHERE id = ANY(${idsToDelete})
          `;
        }
      }

      console.log(`✅ Deleted ${duplicates.reduce((sum: number, dup: any) => sum + (dup.count - 1), 0)} duplicate(s)\n`);
    }

    // 5. Verify final state
    console.log('🔍 Final shift_types state:\n');

    const finalShiftTypes = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT code) as unique_codes,
        department_id
      FROM shift_types
      GROUP BY department_id
    `;

    console.log('Shift types by department:');
    finalShiftTypes.forEach(stat => {
      const deptDisplay = stat.department_id ? stat.department_id.substring(0, 8) + '...' : 'GLOBAL';
      console.log(`  - dept=${deptDisplay}: ${stat.total} total, ${stat.unique_codes} unique codes`);
    });
    console.log('');

    // Show all shift types
    const allShiftTypes = await sql`
      SELECT code, name, tenant_id, department_id
      FROM shift_types
      ORDER BY code
    `;

    console.log('All shift types:');
    allShiftTypes.forEach(st => {
      const deptDisplay = st.department_id ? st.department_id.substring(0, 8) + '...' : 'GLOBAL';
      console.log(`  - ${st.code} (${st.name}): dept=${deptDisplay}`);
    });

    console.log('\n✅ All done!\n');

  } catch (error) {
    console.error('❌ Update failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  updateShiftTypesDepartment()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { updateShiftTypesDepartment };
