import postgres from 'postgres';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

async function checkHolidays() {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: 'require'
  });

  try {
    console.log('🔍 Checking holidays table...\n');

    const holidays = await sql`
      SELECT *
      FROM holidays
      ORDER BY date
    `;

    console.log(`✅ Found ${holidays.length} holidays:\n`);

    holidays.forEach(holiday => {
      console.log(`  📅 ${holiday.date}: ${holiday.name} (${holiday.is_recurring ? 'recurring' : 'one-time'})`);
    });

    // Count by month
    const byMonth: Record<string, number> = {};
    holidays.forEach(holiday => {
      const month = holiday.date.substring(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + 1;
    });

    console.log('\n📊 Holidays by month:');
    Object.entries(byMonth).sort().forEach(([month, count]) => {
      console.log(`  ${month}: ${count} holidays`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  checkHolidays()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { checkHolidays };
