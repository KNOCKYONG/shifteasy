import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { departments, users } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString);
const db = drizzle(client);

async function addNewDepartment() {
  try {
    console.log('🏥 Adding new department and members...');

    // Get the tenant ID from existing data
    const existingDepartments = await db.select().from(departments).limit(1);
    if (!existingDepartments.length) {
      console.error('No existing departments found');
      process.exit(1);
    }

    const tenantId = existingDepartments[0].tenantId;
    console.log(`Found tenant ID: ${tenantId}`);

    // Check if Department B already exists
    const existingDeptB = await db.select()
      .from(departments)
      .where(and(
        eq(departments.tenantId, tenantId),
        eq(departments.name, '병동 B')
      ));

    let departmentBId: string;

    if (existingDeptB.length > 0) {
      console.log('병동 B already exists, using existing department');
      departmentBId = existingDeptB[0].id;
    } else {
      // Create new department
      const [newDepartment] = await db.insert(departments).values({
        tenantId,
        name: '병동 B',
        code: 'WARD_B',
        description: '병동 B - 일반 내과'
      }).returning();

      departmentBId = newDepartment.id;
      console.log(`✅ Created 병동 B with ID: ${departmentBId}`);
    }

    // Get count of existing users in Department A
    const existingUsersInDeptA = await db.select()
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.departmentId, existingDepartments[0].id)
      ));

    console.log(`Found ${existingUsersInDeptA.length} users in Department A`);

    // Create new users for Department B
    const newUsers = [];
    const positions = ['수간호사', '주임간호사', '간호사', '간호조무사'];
    const roles = ['manager', 'member', 'member', 'member'];

    // Create similar distribution of users
    const userDistribution = [
      { name: '이은정', position: '수간호사', role: 'manager', employeeId: 'B001' },
      { name: '박서연', position: '주임간호사', role: 'member', employeeId: 'B002' },
      { name: '최지훈', position: '간호사', role: 'member', employeeId: 'B003' },
      { name: '강민서', position: '간호사', role: 'member', employeeId: 'B004' },
      { name: '윤태호', position: '간호사', role: 'member', employeeId: 'B005' },
      { name: '임하늘', position: '간호사', role: 'member', employeeId: 'B006' },
      { name: '송유진', position: '간호사', role: 'member', employeeId: 'B007' },
      { name: '남궁민', position: '간호조무사', role: 'member', employeeId: 'B008' },
      { name: '서현우', position: '간호조무사', role: 'member', employeeId: 'B009' },
      { name: '한소희', position: '간호조무사', role: 'member', employeeId: 'B010' },
    ];

    for (const userData of userDistribution) {
      const email = `${userData.employeeId.toLowerCase()}@shifteasy.com`;

      // Check if user already exists
      const existingUser = await db.select()
        .from(users)
        .where(and(
          eq(users.tenantId, tenantId),
          eq(users.email, email)
        ));

      if (existingUser.length === 0) {
        const [newUser] = await db.insert(users).values({
          tenantId,
          departmentId: departmentBId,
          email,
          name: userData.name,
          role: userData.role,
          employeeId: userData.employeeId,
          position: userData.position,
          status: 'active',
          profile: {
            phone: `010-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
            skills: ['기본간호', '응급처치', '환자케어'],
            certifications: userData.position === '간호사' ? ['간호사면허'] : userData.position === '간호조무사' ? ['간호조무사자격증'] : ['간호사면허', '관리자교육'],
            preferences: {
              preferredShifts: ['D', 'E'],
              maxHoursPerWeek: 40,
              minHoursPerWeek: 32
            }
          }
        }).returning();

        newUsers.push(newUser);
        console.log(`✅ Created user: ${newUser.name} (${newUser.email})`);
      } else {
        console.log(`⏭️ User already exists: ${email}`);
      }
    }

    console.log(`\n🎉 Successfully added 병동 B with ${newUsers.length} new members!`);

    // Display summary
    const allDepartments = await db.select().from(departments).where(eq(departments.tenantId, tenantId));
    const allUsers = await db.select().from(users).where(eq(users.tenantId, tenantId));

    console.log('\n📊 Current Status:');
    console.log(`- Total Departments: ${allDepartments.length}`);
    for (const dept of allDepartments) {
      const deptUsers = await db.select()
        .from(users)
        .where(and(
          eq(users.tenantId, tenantId),
          eq(users.departmentId, dept.id)
        ));
      console.log(`  - ${dept.name}: ${deptUsers.length} members`);
    }
    console.log(`- Total Users: ${allUsers.length}`);

  } catch (error) {
    console.error('❌ Error adding new department:', error);
    process.exit(1);
  } finally {
    await client.end();
    process.exit(0);
  }
}

// Run the script
addNewDepartment();