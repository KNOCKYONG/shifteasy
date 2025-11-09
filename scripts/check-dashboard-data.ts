import { db } from '@/db';
import { schedules } from '@/db/schema';
import { eq, and, gte, lte, desc, or, isNull, ne } from 'drizzle-orm';

async function checkDashboardData() {
  const tenantId = '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log('=== Dashboard Data Check ===');
  console.log('Today:', today.toISOString());
  console.log('Tenant ID:', tenantId);
  console.log('');

  // Check all published schedules
  const publishedSchedules = await db
    .select()
    .from(schedules)
    .where(and(
      eq(schedules.tenantId, tenantId),
      eq(schedules.status, 'published'),
      or(
        isNull(schedules.deletedFlag),
        ne(schedules.deletedFlag, 'X')
      )
    ))
    .orderBy(desc(schedules.publishedAt));

  console.log('=== All Published Schedules ===');
  console.log(`Found ${publishedSchedules.length} published schedules`);
  publishedSchedules.forEach((schedule, idx) => {
    const includesDate = schedule.startDate <= today && schedule.endDate >= today;
    console.log(`\n${idx + 1}. ${schedule.name}`);
    console.log(`   ID: ${schedule.id}`);
    console.log(`   Start: ${schedule.startDate.toISOString().split('T')[0]}`);
    console.log(`   End: ${schedule.endDate.toISOString().split('T')[0]}`);
    console.log(`   Includes Today: ${includesDate ? 'YES ✓' : 'NO'}`);
    console.log(`   Published At: ${schedule.publishedAt?.toISOString() || 'N/A'}`);
  });

  // Check for schedule that includes today
  const todaySchedule = await db
    .select()
    .from(schedules)
    .where(and(
      eq(schedules.tenantId, tenantId),
      eq(schedules.status, 'published'),
      or(
        isNull(schedules.deletedFlag),
        ne(schedules.deletedFlag, 'X')
      ),
      lte(schedules.startDate, today),
      gte(schedules.endDate, today)
    ))
    .orderBy(desc(schedules.publishedAt))
    .limit(1)
    .then(rows => rows[0] || null);

  console.log('\n=== Schedule for Today ===');
  if (!todaySchedule) {
    console.log('❌ No published schedule found that includes today');
    console.log('This is why workingToday = 0');
  } else {
    console.log(`✓ Found schedule: ${todaySchedule.name}`);
    console.log(`   Start: ${todaySchedule.startDate.toISOString().split('T')[0]}`);
    console.log(`   End: ${todaySchedule.endDate.toISOString().split('T')[0]}`);

    // Check metadata
    const metadata = todaySchedule.metadata as any;
    const assignments = metadata?.assignments || [];
    const todayStr = today.toISOString().split('T')[0];

    console.log(`\n   Total assignments in metadata: ${assignments.length}`);

    const todayAssignments = assignments.filter((a: any) => {
      const assignmentDate = new Date(a.date).toISOString().split('T')[0];
      return assignmentDate === todayStr;
    });

    console.log(`   Assignments for today (${todayStr}): ${todayAssignments.length}`);

    const workingToday = todayAssignments.filter((a: any) => a.shiftId !== 'off').length;
    console.log(`   Working today (shiftId != 'off'): ${workingToday}`);

    if (todayAssignments.length > 0) {
      console.log('\n   Sample assignments for today:');
      todayAssignments.slice(0, 5).forEach((a: any) => {
        console.log(`   - Staff: ${a.staffId}, Shift: ${a.shiftId}`);
      });
    }
  }

  process.exit(0);
}

checkDashboardData().catch(console.error);
