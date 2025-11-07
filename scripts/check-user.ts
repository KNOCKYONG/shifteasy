import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function checkUser() {
  const clerkUserId = 'user_34aGuals7cGqUNzSTKTes2NAqrG';

  console.log('🔍 Searching for user with clerkUserId:', clerkUserId);

  const result = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId));

  console.log('\n📊 Query Results:');
  if (result.length === 0) {
    console.log('❌ NO USER FOUND with this clerkUserId');
    console.log('\n📝 This explains why the dashboard is stuck loading!');
    console.log('   The user exists in Clerk but not in the database.');
  } else {
    console.log('✅ Found user(s):');
    result.forEach((user, index) => {
      console.log(`\n   User ${index + 1}:`);
      console.log('   - ID:', user.id);
      console.log('   - Name:', user.name);
      console.log('   - Email:', user.email);
      console.log('   - Role:', user.role);
      console.log('   - Tenant ID:', user.tenantId);
      console.log('   - Department ID:', user.departmentId);
      console.log('   - Status:', user.status);
    });
  }

  // Also check all users to see what's in the database
  console.log('\n\n📋 All users in database:');
  const allUsers = await db.select().from(users);
  console.log(`Total users: ${allUsers.length}`);

  allUsers.slice(0, 5).forEach((user, index) => {
    console.log(`\n${index + 1}. ${user.name} (${user.email})`);
    console.log(`   Clerk ID: ${user.clerkUserId || 'NO_CLERK_ID'}`);
    console.log(`   Tenant ID: ${user.tenantId}`);
    console.log(`   Role: ${user.role}`);
  });

  process.exit(0);
}

checkUser().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
