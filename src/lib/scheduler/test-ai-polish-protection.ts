/**
 * Test scenarios for AI Polish special request protection
 *
 * This test file verifies that the multi-layer protection mechanisms
 * prevent AI Polish from modifying special requests and locked assignments.
 */

import { autoPolishWithAI } from './ai-polish';
import type { AiScheduleGenerationResult, AiScheduleRequest } from './ai-scheduler';
import type { ScheduleAssignment } from '@/lib/types/scheduler';

/**
 * Create test data for protection verification
 */
function createTestData(): {
  aiResult: AiScheduleGenerationResult;
  input: AiScheduleRequest;
} {
  const baseDate = new Date('2024-11-16');

  // Create test assignments with various protection states
  const assignments: ScheduleAssignment[] = [
    // 🔒 Protected: Special OFF request
    {
      employeeId: 'emp-001',
      date: new Date('2024-11-16'),
      shiftId: 'OFF',
      shiftType: 'OFF',
      isLocked: true, // Protected
      // employeeName: 'Kim', // Not part of ScheduleAssignment type
      constraintViolations: [],
    },
    // 🔒 Protected: Specific shift request
    {
      employeeId: 'emp-002',
      date: new Date('2024-11-16'),
      shiftId: 'N',
      shiftType: 'N',
      isLocked: true, // Protected
      // employeeName: 'Lee',
      constraintViolations: [],
    },
    // ✅ Modifiable: Regular assignment (unfair distribution)
    {
      employeeId: 'emp-003',
      date: new Date('2024-11-16'),
      shiftId: 'D',
      shiftType: 'D',
      isLocked: false,
      // employeeName: 'Park',
      constraintViolations: [],
    },
    // ✅ Modifiable: Regular assignment (can swap)
    {
      employeeId: 'emp-004',
      date: new Date('2024-11-16'),
      shiftId: 'E',
      shiftType: 'E',
      isLocked: false,
      // employeeName: 'Choi',
      constraintViolations: [],
    },
    // 🔒 Protected: Another special request
    {
      employeeId: 'emp-005',
      date: new Date('2024-11-17'),
      shiftId: 'OFF',
      shiftType: 'OFF',
      isLocked: true, // Protected
      // employeeName: 'Jung',
      constraintViolations: [],
    },
    // Create unfair distribution (emp-003 has many more shifts)
    ...Array.from({ length: 10 }, (_, i) => ({
      employeeId: 'emp-003',
      date: new Date(`2024-11-${17 + i}`),
      shiftId: 'D',
      shiftType: 'D',
      isLocked: false,
      // employeeName: 'Park',
      constraintViolations: [],
    } as ScheduleAssignment)),
  ];

  const aiResult: AiScheduleGenerationResult = {
    assignments,
    score: {
      total: 75, // Low enough to trigger AI Polish
      fairness: 60,
      coverage: 85,
      preference: 75,
      constraint: 80,
    },
    violations: [
      {
        constraintName: 'fairness',
        employeeId: 'emp-003',
        date: '2024-11-16',
        message: 'Employee has 50% more assignments than average',
        severity: 'warning',
      },
    ],
    stats: {
      totalShifts: assignments.length,
      unassignedShifts: 0,
      employeesScheduled: 5,
      averageShiftsPerEmployee: assignments.length / 5,
      constraintViolations: 1,
      processingTime: 1000,
    },
  };

  const input: AiScheduleRequest = {
    startDate: '2024-11-16',
    endDate: '2024-11-30',
    departmentId: 'dept-001',
    requiredStaffPerShift: {
      D: 5,
      E: 4,
      N: 3,
    },
    employees: [
      {
        id: 'emp-001',
        name: 'Kim',
        workPatternType: '5-day',
        maxConsecutiveDays: 5,
        minRestDays: 2,
        preferredShiftTypes: { D: 1.0 },
        constraints: [],
      },
      {
        id: 'emp-002',
        name: 'Lee',
        workPatternType: '5-day',
        maxConsecutiveDays: 5,
        minRestDays: 2,
        preferredShiftTypes: { E: 1.0 },
        constraints: [],
      },
      {
        id: 'emp-003',
        name: 'Park',
        workPatternType: '5-day',
        maxConsecutiveDays: 5,
        minRestDays: 2,
        preferredShiftTypes: { D: 1.0 },
        constraints: [],
      },
      {
        id: 'emp-004',
        name: 'Choi',
        workPatternType: '5-day',
        maxConsecutiveDays: 5,
        minRestDays: 2,
        preferredShiftTypes: { E: 1.0 },
        constraints: [],
      },
      {
        id: 'emp-005',
        name: 'Jung',
        workPatternType: '5-day',
        maxConsecutiveDays: 5,
        minRestDays: 2,
        preferredShiftTypes: { N: 1.0 },
        constraints: [],
      },
    ],
    specialRequests: [
      {
        employeeId: 'emp-001',
        date: '2024-11-16',
        requestType: 'off',
        shiftTypeCode: 'OFF',
        priority: 1,
        status: 'approved',
      },
      {
        employeeId: 'emp-002',
        date: '2024-11-16',
        requestType: 'shift',
        shiftTypeCode: 'N',
        priority: 1,
        status: 'approved',
      },
      {
        employeeId: 'emp-005',
        date: '2024-11-17',
        requestType: 'off',
        shiftTypeCode: 'OFF',
        priority: 1,
        status: 'approved',
      },
    ],
    constraints: [],
    customShiftTypes: [
      { code: 'D', name: 'Day', startTime: '07:00', endTime: '15:00' },
      { code: 'E', name: 'Evening', startTime: '15:00', endTime: '23:00' },
      { code: 'N', name: 'Night', startTime: '23:00', endTime: '07:00' },
      { code: 'OFF', name: 'Off', startTime: '00:00', endTime: '00:00' },
    ],
  };

  return { aiResult, input };
}

/**
 * Test protection verification
 */
export async function testSpecialRequestProtection() {
  console.log('🧪 Starting AI Polish Protection Test');
  console.log('=====================================\n');

  const { aiResult, input } = createTestData();

  // Store original protected assignments
  const protectedAssignments = aiResult.assignments.filter(a => a.isLocked);
  const protectedKeys = protectedAssignments.map(a => ({
    key: `${a.employeeId}-${a.date.toISOString().split('T')[0]}`,
    originalShift: a.shiftId,
  }));

  console.log(`📋 Test Setup:`);
  console.log(`- Total assignments: ${aiResult.assignments.length}`);
  console.log(`- Protected assignments: ${protectedAssignments.length}`);
  console.log(`- Special requests: ${input.specialRequests?.length || 0}`);
  console.log(`- Initial score: ${aiResult.score.total}/100`);
  console.log('\n🔒 Protected Assignments:');
  protectedKeys.forEach(p => {
    console.log(`  - ${p.key} → ${p.originalShift} (MUST NOT CHANGE)`);
  });

  console.log('\n🚀 Running AI Polish...');

  try {
    // Run AI Polish
    const result = await autoPolishWithAI(aiResult, input);

    console.log('\n📊 Results:');
    console.log(`- Improved: ${result.improved}`);
    console.log(`- New score: ${result.score.total}/100`);
    console.log(`- Improvements made: ${result.improvements.length}`);

    if (result.improvements.length > 0) {
      console.log('\n📝 Improvements Applied:');
      result.improvements.forEach(imp => {
        console.log(`  - [${imp.impact}] ${imp.type}: ${imp.description} (confidence: ${imp.confidence})`);
      });
    }

    // Verify protection
    console.log('\n🔍 Verifying Protection...');
    let protectionViolated = false;

    protectedKeys.forEach(protected => {
      const [employeeId, date] = protected.key.split('-');
      const modifiedAssignment = result.assignments.find(
        a => a.employeeId === employeeId &&
             a.date.toISOString().split('T')[0] === date
      );

      if (!modifiedAssignment) {
        console.error(`❌ CRITICAL: Protected assignment missing: ${protected.key}`);
        protectionViolated = true;
      } else if (modifiedAssignment.shiftId !== protected.originalShift) {
        console.error(`❌ CRITICAL: Protected assignment modified!`);
        console.error(`   ${protected.key}: ${protected.originalShift} → ${modifiedAssignment.shiftId}`);
        protectionViolated = true;
      } else {
        console.log(`✅ Protected: ${protected.key} → ${protected.originalShift} (unchanged)`);
      }
    });

    // Check if any non-protected assignments were improved
    const modifiableAssignments = aiResult.assignments.filter(a => !a.isLocked);
    let improvementsMade = 0;

    modifiableAssignments.forEach(original => {
      const dateStr = original.date.toISOString().split('T')[0];
      const modified = result.assignments.find(
        a => a.employeeId === original.employeeId &&
             a.date.toISOString().split('T')[0] === dateStr
      );

      if (modified && modified.shiftId !== original.shiftId) {
        console.log(`✨ Improved: ${original.employeeId} on ${dateStr}: ${original.shiftId} → ${modified.shiftId}`);
        improvementsMade++;
      }
    });

    console.log(`\n📈 Summary:`);
    console.log(`- Improvements to non-protected: ${improvementsMade}`);
    console.log(`- Protected assignments preserved: ${!protectionViolated}`);

    // Final verdict
    console.log('\n🎯 Test Result:');
    if (!protectionViolated) {
      console.log('✅ SUCCESS: All special requests and locked assignments were protected!');
      console.log('✅ The AI Polish module respects the service motto: "우선 반영하고 배치를 잘해줄게"');
      return true;
    } else {
      console.log('❌ FAILURE: Protection was violated! Special requests were modified!');
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

/**
 * Run edge case tests
 */
export async function testEdgeCases() {
  console.log('\n🧪 Testing Edge Cases');
  console.log('====================\n');

  // Test 1: All assignments are protected
  console.log('Test 1: All assignments protected');
  const allProtected = createTestData();
  allProtected.aiResult.assignments.forEach(a => { a.isLocked = true; });

  const result1 = await autoPolishWithAI(allProtected.aiResult, allProtected.input);
  console.log(`- Result: ${result1.improved ? '❌ FAIL (should not improve)' : '✅ PASS (no changes made)'}`);

  // Test 2: High score (>95) should skip polish
  console.log('\nTest 2: High score scenario');
  const highScore = createTestData();
  highScore.aiResult.score.total = 96;

  const result2 = await autoPolishWithAI(highScore.aiResult, highScore.input);
  console.log(`- Result: ${result2.improved ? '❌ FAIL (should skip)' : '✅ PASS (skipped due to high score)'}`);

  // Test 3: Mixed protection levels
  console.log('\nTest 3: Mixed protection with complex swaps needed');
  const mixed = createTestData();
  // This is already our default test case
  const result3 = await autoPolishWithAI(mixed.aiResult, mixed.input);
  const protectedCount = mixed.aiResult.assignments.filter(a => a.isLocked).length;
  const protectedPreserved = result3.assignments.filter(a => a.isLocked).length === protectedCount;
  console.log(`- Result: ${protectedPreserved ? '✅ PASS (protected count preserved)' : '❌ FAIL (protected count changed)'}`);

  console.log('\n✨ Edge case testing complete!');
}

/**
 * Main test runner
 */
export async function runAllProtectionTests() {
  console.log('🏁 Starting Comprehensive AI Polish Protection Tests');
  console.log('====================================================\n');

  // Run main protection test
  const mainTestPassed = await testSpecialRequestProtection();

  // Run edge cases
  await testEdgeCases();

  console.log('\n🏁 All tests completed!');
  console.log('=======================');

  if (mainTestPassed) {
    console.log('✅ AI Scheduling is ready to be presented to the world! 🌍');
    console.log('✅ Special requests are fully protected');
    console.log('✅ The service motto is upheld: "우선 반영하고 배치를 잘해줄게"');
  } else {
    console.log('⚠️ Issues found - please review and fix before launch');
  }

  return mainTestPassed;
}

// Allow running as a script
if (require.main === module) {
  runAllProtectionTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}