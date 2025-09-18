import { db } from './supabase';
import { nanoid } from 'nanoid';
import {
  tenants,
  departments,
  users,
  shiftTypes,
  schedules,
  shiftAssignments,
  type NewTenant,
  type NewDepartment,
  type NewUser,
  type NewShiftType,
  type NewSchedule,
  type NewShiftAssignment,
} from './schema';

async function seed() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create demo tenant
    console.log('Creating demo tenant...');
    const [demoTenant] = await db
      .insert(tenants)
      .values({
        name: 'Demo Hospital',
        slug: 'demo-hospital',
        secretCode: `demo-${nanoid(10)}`,
        plan: 'pro',
        settings: {
          timezone: 'Asia/Seoul',
          locale: 'ko',
          maxUsers: 50,
          maxDepartments: 10,
          signupEnabled: true,
          features: ['shift-swap', 'leave-management', 'reporting'],
        },
      } as NewTenant)
      .returning();

    console.log(`✅ Created tenant: ${demoTenant.name}`);

    // Create departments
    console.log('Creating departments...');
    const departmentData: Omit<NewDepartment, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        tenantId: demoTenant.id,
        name: 'Emergency Department',
        code: 'ER',
        description: 'Emergency medical services',
        settings: {
          minStaff: 3,
          maxStaff: 8,
          requiredRoles: ['nurse', 'doctor'],
        },
      },
      {
        tenantId: demoTenant.id,
        name: 'ICU',
        code: 'ICU',
        description: 'Intensive Care Unit',
        settings: {
          minStaff: 2,
          maxStaff: 5,
          requiredRoles: ['nurse'],
        },
      },
      {
        tenantId: demoTenant.id,
        name: 'General Ward',
        code: 'GW',
        description: 'General patient care',
        settings: {
          minStaff: 2,
          maxStaff: 6,
        },
      },
    ];

    const insertedDepartments = await db
      .insert(departments)
      .values(departmentData as NewDepartment[])
      .returning();

    console.log(`✅ Created ${insertedDepartments.length} departments`);

    // Create shift types
    console.log('Creating shift types...');
    const shiftTypeData: Omit<NewShiftType, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        tenantId: demoTenant.id,
        code: 'D',
        name: 'Day Shift',
        startTime: '07:00',
        endTime: '15:00',
        duration: 480, // 8 hours
        color: '#3B82F6',
        breakMinutes: 30,
        sortOrder: 0,
      },
      {
        tenantId: demoTenant.id,
        code: 'E',
        name: 'Evening Shift',
        startTime: '15:00',
        endTime: '23:00',
        duration: 480,
        color: '#10B981',
        breakMinutes: 30,
        sortOrder: 1,
      },
      {
        tenantId: demoTenant.id,
        code: 'N',
        name: 'Night Shift',
        startTime: '23:00',
        endTime: '07:00',
        duration: 480,
        color: '#6366F1',
        breakMinutes: 30,
        sortOrder: 2,
      },
      {
        tenantId: demoTenant.id,
        code: 'O',
        name: 'Off Day',
        startTime: '00:00',
        endTime: '00:00',
        duration: 0,
        color: '#9CA3AF',
        breakMinutes: 0,
        sortOrder: 3,
      },
    ];

    const insertedShiftTypes = await db
      .insert(shiftTypes)
      .values(shiftTypeData as NewShiftType[])
      .returning();

    console.log(`✅ Created ${insertedShiftTypes.length} shift types`);

    // Create users
    console.log('Creating users...');
    const userRoles = ['owner', 'admin', 'manager', 'member', 'member', 'member'];
    const userNames = [
      'John Admin',
      'Jane Manager',
      'Mike Supervisor',
      'Sarah Nurse',
      'Tom Nurse',
      'Lisa Nurse',
    ];

    const userData: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    for (let i = 0; i < userNames.length; i++) {
      const firstName = userNames[i].split(' ')[0].toLowerCase();
      userData.push({
        tenantId: demoTenant.id,
        departmentId: insertedDepartments[i % insertedDepartments.length].id,
        email: `${firstName}@demo-hospital.com`,
        name: userNames[i],
        role: userRoles[i] as any,
        employeeId: `EMP${String(i + 1).padStart(3, '0')}`,
        position: i === 0 ? 'Hospital Director' : i === 1 ? 'HR Manager' : i === 2 ? 'Department Head' : 'Staff Nurse',
        status: 'active',
        profile: {
          phone: `010-${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          skills: ['Emergency Care', 'Patient Management', 'Medical Documentation'],
          certifications: ['RN License', 'BLS', 'ACLS'],
          preferences: {
            preferredShifts: ['D', 'E'],
            maxHoursPerWeek: 40,
            minHoursPerWeek: 32,
          },
        },
      });
    }

    const insertedUsers = await db
      .insert(users)
      .values(userData as NewUser[])
      .returning();

    console.log(`✅ Created ${insertedUsers.length} users`);

    // Create a schedule for the current month
    console.log('Creating schedule...');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [schedule] = await db
      .insert(schedules)
      .values({
        tenantId: demoTenant.id,
        departmentId: insertedDepartments[0].id,
        startDate: startOfMonth,
        endDate: endOfMonth,
        status: 'published',
        publishedAt: new Date(),
        publishedBy: insertedUsers.find(u => u.role === 'admin')?.id,
        metadata: {
          notes: 'Demo schedule for testing',
          stats: {
            totalShifts: 0,
            averageHours: 0,
          },
        },
      } as NewSchedule)
      .returning();

    console.log(`✅ Created schedule for ${schedule.startDate.toLocaleDateString()}`);

    // Create some shift assignments
    console.log('Creating shift assignments...');
    const assignmentData: Omit<NewShiftAssignment, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    const staffUsers = insertedUsers.filter(u => u.role === 'member');

    // Create assignments for the first week
    for (let day = 0; day < 7; day++) {
      const date = new Date(startOfMonth);
      date.setDate(date.getDate() + day);

      // Rotate staff through shifts
      for (let staffIndex = 0; staffIndex < staffUsers.length; staffIndex++) {
        const shiftIndex = (staffIndex + day) % 3; // Rotate through D, E, N shifts
        const shiftType = insertedShiftTypes[shiftIndex];

        assignmentData.push({
          tenantId: demoTenant.id,
          scheduleId: schedule.id,
          userId: staffUsers[staffIndex].id,
          shiftTypeId: shiftType.id,
          date: date,
          startTime: shiftType.startTime,
          endTime: shiftType.endTime,
          breakMinutes: shiftType.breakMinutes,
          status: 'scheduled',
        });
      }
    }

    const insertedAssignments = await db
      .insert(shiftAssignments)
      .values(assignmentData as NewShiftAssignment[])
      .returning();

    console.log(`✅ Created ${insertedAssignments.length} shift assignments`);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`  - Tenant: ${demoTenant.name} (slug: ${demoTenant.slug})`);
    console.log(`  - Departments: ${insertedDepartments.length}`);
    console.log(`  - Users: ${insertedUsers.length}`);
    console.log(`  - Shift Types: ${insertedShiftTypes.length}`);
    console.log(`  - Schedule: ${schedule.startDate.toLocaleDateString()} - ${schedule.endDate.toLocaleDateString()}`);
    console.log(`  - Shift Assignments: ${insertedAssignments.length}`);

    console.log('\n🔑 Login credentials:');
    insertedUsers.forEach(user => {
      console.log(`  ${user.email} (${user.role})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run seed function
seed();