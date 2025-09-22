import { config } from 'dotenv';
import { db } from '@/db';
import { departments, users } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';

config({ path: '.env.local' });

async function addEmergencyDepartment() {
  console.log('Adding Emergency Department with members...');

  // Fixed tenant ID from the environment
  const tenantId = '3760b5ec-462f-443c-9a90-4a2b2e295e9d'; // DEV_TENANT_ID

  try {
    // 1. Create Emergency Department
    const departmentId = uuidv4();
    const [newDepartment] = await db.insert(departments).values({
      id: departmentId,
      tenantId,
      name: '응급실',
      code: 'ER',
      description: '24시간 응급 진료 부서',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    console.log('Created department:', newDepartment.name);

    // 2. Create department members
    // Note: In production, passwords should be hashed
    const hashedPassword = 'temp_password_hash';

    const members = [
      // Manager for Emergency Department
      {
        id: uuidv4(),
        clerkUserId: `clerk_er_manager_${Date.now()}`,
        tenantId,
        departmentId,
        email: 'er.manager@shifteasy.com',
        name: '박응급',
        role: 'manager' as const,
        position: '수간호사',
        employeeId: 'ER-M001',
        phone: '010-3333-0001',
        status: 'active' as const,
        hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Emergency Department Members
      {
        id: uuidv4(),
        clerkUserId: `clerk_er_nurse1_${Date.now()}`,
        tenantId,
        departmentId,
        email: 'er.nurse1@shifteasy.com',
        name: '김응급',
        role: 'member' as const,
        position: '간호사',
        employeeId: 'ER-N001',
        phone: '010-3333-0002',
        status: 'active' as const,
        hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        clerkUserId: `clerk_er_nurse2_${Date.now()}`,
        tenantId,
        departmentId,
        email: 'er.nurse2@shifteasy.com',
        name: '이응급',
        role: 'member' as const,
        position: '간호사',
        employeeId: 'ER-N002',
        phone: '010-3333-0003',
        status: 'active' as const,
        hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        clerkUserId: `clerk_er_nurse3_${Date.now()}`,
        tenantId,
        departmentId,
        email: 'er.nurse3@shifteasy.com',
        name: '정응급',
        role: 'member' as const,
        position: '간호사',
        employeeId: 'ER-N003',
        phone: '010-3333-0004',
        status: 'active' as const,
        hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        clerkUserId: `clerk_er_nurse4_${Date.now()}`,
        tenantId,
        departmentId,
        email: 'er.nurse4@shifteasy.com',
        name: '최응급',
        role: 'member' as const,
        position: '간호사',
        employeeId: 'ER-N004',
        phone: '010-3333-0005',
        status: 'active' as const,
        hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        clerkUserId: `clerk_er_nurse5_${Date.now()}`,
        tenantId,
        departmentId,
        email: 'er.nurse5@shifteasy.com',
        name: '강응급',
        role: 'member' as const,
        position: '전담간호사',
        employeeId: 'ER-N005',
        phone: '010-3333-0006',
        status: 'active' as const,
        hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        clerkUserId: `clerk_er_nurse6_${Date.now()}`,
        tenantId,
        departmentId,
        email: 'er.nurse6@shifteasy.com',
        name: '조응급',
        role: 'member' as const,
        position: '간호사',
        employeeId: 'ER-N006',
        phone: '010-3333-0007',
        status: 'active' as const,
        hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        clerkUserId: `clerk_er_nurse7_${Date.now()}`,
        tenantId,
        departmentId,
        email: 'er.nurse7@shifteasy.com',
        name: '윤응급',
        role: 'member' as const,
        position: '간호사',
        employeeId: 'ER-N007',
        phone: '010-3333-0008',
        status: 'active' as const,
        hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        clerkUserId: `clerk_er_nurse8_${Date.now()}`,
        tenantId,
        departmentId,
        email: 'er.nurse8@shifteasy.com',
        name: '장응급',
        role: 'member' as const,
        position: '간호사',
        employeeId: 'ER-N008',
        phone: '010-3333-0009',
        status: 'on_leave' as const, // One on leave
        hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        clerkUserId: `clerk_er_nurse9_${Date.now()}`,
        tenantId,
        departmentId,
        email: 'er.nurse9@shifteasy.com',
        name: '임응급',
        role: 'member' as const,
        position: '간호사',
        employeeId: 'ER-N009',
        phone: '010-3333-0010',
        status: 'active' as const,
        hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Insert all members
    const insertedMembers = await db.insert(users).values(members).returning();

    console.log(`Created ${insertedMembers.length} members for Emergency Department`);
    console.log('\nNew Department Details:');
    console.log('------------------------');
    console.log(`Department: ${newDepartment.name} (${newDepartment.code})`);
    console.log(`Department ID: ${newDepartment.id}`);
    console.log('\nMembers:');
    insertedMembers.forEach(member => {
      console.log(`- ${member.name} (${member.role}) - ${member.email}`);
    });

    console.log('\n✅ Emergency Department added successfully!');
    console.log('\nLogin credentials:');
    console.log('All users can login with password: password123');

  } catch (error) {
    console.error('Error adding department:', error);
    process.exit(1);
  }

  process.exit(0);
}

addEmergencyDepartment();