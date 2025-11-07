import { config } from 'dotenv';
import { resolve } from 'path';
import { db } from '../src/db';
import { users, departments } from '../src/db/schema';
import { eq } from 'drizzle-orm';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

/**
 * Script to fix missing user in database
 * This user exists in Clerk but not in the database, causing infinite loading
 */

const STUCK_USER_CLERK_ID = 'user_34aGuals7cGqUNzSTKTes2NAqrG';
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

console.log('🔧 Environment check:');
console.log('   CLERK_SECRET_KEY:', CLERK_SECRET_KEY ? '✅ Loaded' : '❌ Missing');
console.log('   DATABASE_URL:', DATABASE_URL ? `✅ ${DATABASE_URL.substring(0, 40)}...` : '❌ Missing');
console.log('');

if (!CLERK_SECRET_KEY) {
  console.error('❌ CLERK_SECRET_KEY not found in environment');
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

async function fixMissingUser() {
  console.log('🔍 Checking for user in database...');
  console.log(`   Clerk User ID: ${STUCK_USER_CLERK_ID}`);
  console.log('');

  // Check if user already exists in database
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, STUCK_USER_CLERK_ID))
    .limit(1);

  if (existingUser.length > 0) {
    console.log('✅ User already exists in database!');
    console.log('   User ID:', existingUser[0].id);
    console.log('   Name:', existingUser[0].name);
    console.log('   Email:', existingUser[0].email);
    console.log('   Role:', existingUser[0].role);
    console.log('   Tenant ID:', existingUser[0].tenantId);
    console.log('');
    console.log('❌ The dashboard loading issue may be caused by something else.');
    return;
  }

  console.log('❌ User NOT found in database');
  console.log('');

  // Fetch user from Clerk using REST API
  console.log('🔍 Fetching user info from Clerk API...');
  try {
    const clerkResponse = await fetch(
      `https://api.clerk.com/v1/users/${STUCK_USER_CLERK_ID}`,
      {
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!clerkResponse.ok) {
      if (clerkResponse.status === 404) {
        console.error('❌ User does not exist in Clerk!');
        console.error('   The user may have been deleted or the Clerk ID is incorrect.');
        process.exit(1);
      }
      throw new Error(`Clerk API error: ${clerkResponse.status} ${clerkResponse.statusText}`);
    }

    const clerkUser = await clerkResponse.json();

    console.log('✅ Found user in Clerk:');
    const email = clerkUser.email_addresses?.[0]?.email_address || 'NO_EMAIL';
    const firstName = clerkUser.first_name || '';
    const lastName = clerkUser.last_name || '';
    const name = firstName && lastName
      ? `${firstName} ${lastName}`
      : firstName || email?.split('@')[0] || 'User';

    console.log('   Email:', email);
    console.log('   Name:', name);
    console.log('');

    if (!email || email === 'NO_EMAIL') {
      console.error('❌ Cannot create user: No email address found in Clerk');
      process.exit(1);
    }

    // Check if user has an organization
    console.log('🔍 Fetching organization memberships...');
    const orgResponse = await fetch(
      `https://api.clerk.com/v1/users/${STUCK_USER_CLERK_ID}/organization_memberships`,
      {
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let tenantId = null;
    let departmentId = null;

    if (orgResponse.ok) {
      const orgData = await orgResponse.json();
      if (orgData.data && orgData.data.length > 0) {
        tenantId = orgData.data[0].organization.id;
        console.log('✅ Found organization membership:');
        console.log('   Organization ID:', tenantId);
        console.log('   Organization Name:', orgData.data[0].organization.name);
        console.log('');

        // Try to find the first department in this tenant
        const firstDepartment = await db
          .select()
          .from(departments)
          .where(eq(departments.tenantId, tenantId))
          .limit(1);

        if (firstDepartment.length > 0) {
          departmentId = firstDepartment[0].id;
          console.log('✅ Found department for user:');
          console.log('   Department ID:', departmentId);
          console.log('   Department Name:', firstDepartment[0].name);
          console.log('');
        }
      } else {
        console.log('⚠️  No organization membership found');
        console.log('   User will be created without tenant/department');
        console.log('');
      }
    }

    // Create user in database
    console.log('📝 Creating user in database...');
    const [newUser] = await db
      .insert(users)
      .values({
        clerkUserId: STUCK_USER_CLERK_ID,
        email,
        name,
        role: 'member', // Default role
        status: 'active',
        tenantId,
        departmentId,
        employeeId: email.split('@')[0], // Use email prefix as employee ID
      })
      .returning();

    console.log('✅ User created successfully!');
    console.log('   Database User ID:', newUser.id);
    console.log('   Name:', newUser.name);
    console.log('   Email:', newUser.email);
    console.log('   Role:', newUser.role);
    console.log('   Tenant ID:', newUser.tenantId || 'NULL');
    console.log('   Department ID:', newUser.departmentId || 'NULL');
    console.log('');
    console.log('✅ User should now be able to access the dashboard!');
    console.log('   Please refresh the dashboard page to verify.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixMissingUser()
  .then(() => {
    console.log('');
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
