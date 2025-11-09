import postgres from 'postgres';

async function checkDashboard() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  console.log('=== Dashboard Data Check ===');
  console.log('Today:', todayStr);
  console.log('');

  // Check all schedules
  const allSchedules = await sql`
    SELECT id, start_date, end_date, status, deleted_flag, published_at
    FROM schedules
    WHERE tenant_id = '3760b5ec-462f-443c-9a90-4a2b2e295e9d'
    ORDER BY published_at DESC NULLS LAST
  `;

  console.log(`Total schedules: ${allSchedules.length}`);

  const publishedSchedules = allSchedules.filter(s =>
    s.status === 'published' && (!s.deleted_flag || s.deleted_flag !== 'X')
  );

  console.log(`Published schedules: ${publishedSchedules.length}`);
  console.log('');

  if (publishedSchedules.length > 0) {
    console.log('Published schedules:');
    publishedSchedules.forEach((s, idx) => {
      const start = new Date(s.start_date).toISOString().split('T')[0];
      const end = new Date(s.end_date).toISOString().split('T')[0];
      const includesdate = s.start_date <= today && s.end_date >= today;
      console.log(`${idx + 1}. ID: ${s.id.slice(0, 8)}... | ${start} ~ ${end} | Includes today: ${includestoday ? 'YES' : 'NO'}`);
    });
  }

  console.log('');

  // Check for schedule that includes today
  const todaySchedules = await sql`
    SELECT id, start_date, end_date, metadata
    FROM schedules
    WHERE tenant_id = '3760b5ec-462f-443c-9a90-4a2b2e295e9d'
      AND status = 'published'
      AND (deleted_flag IS NULL OR deleted_flag <> 'X')
      AND start_date <= ${today}
      AND end_date >= ${today}
    ORDER BY published_at DESC NULLS LAST
    LIMIT 1
  `;

  console.log(`Schedules including today: ${todaySchedules.length}`);

  if (todaySchedules.length > 0) {
    const schedule = todaySchedules[0];
    const metadata = schedule.metadata as any;
    const assignments = metadata?.assignments || [];

    console.log(`Total assignments in metadata: ${assignments.length}`);

    const todayAssignments = assignments.filter((a: any) => {
      const assignmentDate = new Date(a.date).toISOString().split('T')[0];
      return assignmentDate === todayStr;
    });

    console.log(`Assignments for ${todayStr}: ${todayAssignments.length}`);

    const workingToday = todayAssignments.filter((a: any) => a.shiftId !== 'off').length;
    console.log(`Working today (shiftId != 'off'): ${workingToday}`);

    if (todayAssignments.length > 0) {
      console.log('\nSample assignments:');
      todayAssignments.slice(0, 3).forEach((a: any) => {
        console.log(`  - Staff: ${a.staffId}, Shift: ${a.shiftId}, Date: ${a.date}`);
      });
    }
  } else {
    console.log('❌ No published schedule found for today');
    console.log('   This is why dashboard shows 0');
  }

  await sql.end();
  process.exit(0);
}

checkDashboard().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
