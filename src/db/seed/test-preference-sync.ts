import postgres from 'postgres';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

/**
 * Test that preferences sync correctly between tenant_configs and nurse_preferences
 */
async function testPreferenceSync() {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: 'require'
  });

  try {
    console.log('🧪 Testing preference synchronization...\n');

    // Find 박선미
    const user = await sql`
      SELECT id, name, department_id, tenant_id
      FROM users
      WHERE name = '박선미'
      LIMIT 1
    `;

    if (user.length === 0) {
      console.log('❌ User 박선미 not found\n');
      return;
    }

    const employeeId = user[0].id;
    const tenantId = user[0].tenant_id;
    const departmentId = user[0].department_id;

    console.log(`✅ Found user: ${user[0].name}`);
    console.log(`   - user_id: ${employeeId}`);
    console.log(`   - tenant_id: ${tenantId}`);
    console.log(`   - department_id: ${departmentId}\n`);

    // Simulate API call to save preferences
    console.log('📝 Simulating preference save via API...\n');

    const mockPreferences = {
      workPreferences: {
        workPatternType: 'weekday-only' as const,
        preferredShifts: ['day'] as const,
        avoidShifts: [] as const,
        maxConsecutiveDays: 5,
        minRestDays: 2,
        preferredWorkload: 'moderate' as const,
        weekendPreference: 'avoid' as const,
        holidayPreference: 'avoid' as const,
        overtimeWillingness: 'sometimes' as const,
        offDayPattern: 'flexible' as const,
      },
      personalCircumstances: {
        hasYoungChildren: false,
        isSingleParent: false,
        hasCaregivingResponsibilities: false,
        isStudying: false,
      },
      healthConsiderations: {
        hasChronicCondition: false,
        needsFrequentBreaks: false,
        mobilityRestrictions: false,
        visualImpairment: false,
        hearingImpairment: false,
        mentalHealthSupport: false,
      },
      commutePreferences: {
        commuteTime: 30,
        transportMode: 'car' as const,
        parkingRequired: false,
        nightTransportDifficulty: false,
        weatherSensitive: false,
        needsTransportAssistance: false,
        carpoolInterested: false,
      },
      teamPreferences: {
        preferredPartners: [],
        avoidPartners: [],
        mentorshipRole: 'none' as const,
        languagePreferences: ['ko'],
        communicationStyle: 'direct' as const,
        conflictResolution: 'immediate' as const,
      },
      professionalDevelopment: {
        specializations: [],
        certifications: [],
        trainingInterests: [],
        careerGoals: '',
        preferredDepartments: [],
        avoidDepartments: [],
        teachingInterest: false,
        researchInterest: false,
        administrativeInterest: true, // 행정 업무 관심
      },
      specialRequests: {
        religiousObservances: { needed: false },
        culturalConsiderations: '',
        emergencyContact: { name: '', relationship: '', phone: '' },
        temporaryRequests: [],
      },
      priorities: {
        workLifeBalance: 8,
        careerGrowth: 5,
        teamHarmony: 7,
        incomeMaximization: 4,
        healthWellbeing: 8,
        familyTime: 7,
      },
    };

    // Call the actual API endpoint
    const response = await fetch('http://localhost:3000/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId,
        preferences: mockPreferences,
      }),
    });

    if (!response.ok) {
      console.log(`❌ API call failed: ${response.status} ${response.statusText}`);
      const error = await response.json();
      console.log('   Error:', error);
      return;
    }

    const result = await response.json();
    console.log('✅ API call successful:', result.message);
    console.log(`   Timestamp: ${result.timestamp}\n`);

    // Wait a bit for database to sync
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check tenant_configs
    console.log('🔍 Checking tenant_configs table...\n');
    const configKey = `preferences_${employeeId}`;
    const tenantConfig = await sql`
      SELECT config_value
      FROM tenant_configs
      WHERE tenant_id = ${tenantId}
        AND config_key = ${configKey}
      LIMIT 1
    `;

    if (tenantConfig.length === 0) {
      console.log('❌ No record found in tenant_configs\n');
    } else {
      const savedPrefs = tenantConfig[0].config_value as any;
      console.log('✅ Found in tenant_configs:');
      console.log(`   - workPatternType: ${savedPrefs.workPreferences.workPatternType}`);
      console.log(`   - preferredShifts: ${JSON.stringify(savedPrefs.workPreferences.preferredShifts)}\n`);
    }

    // Check nurse_preferences
    console.log('🔍 Checking nurse_preferences table...\n');
    const nursePrefs = await sql`
      SELECT *
      FROM nurse_preferences
      WHERE nurse_id = ${employeeId}
      LIMIT 1
    `;

    if (nursePrefs.length === 0) {
      console.log('❌ No record found in nurse_preferences\n');
    } else {
      console.log('✅ Found in nurse_preferences:');
      console.log(`   - work_pattern_type: ${nursePrefs[0].work_pattern_type}`);
      console.log(`   - preferred_shift_types: ${JSON.stringify(nursePrefs[0].preferred_shift_types)}`);
      console.log(`   - max_consecutive_days_preferred: ${nursePrefs[0].max_consecutive_days_preferred}`);
      console.log(`   - updated_at: ${nursePrefs[0].updated_at}\n`);
    }

    // Verify sync
    if (tenantConfig.length > 0 && nursePrefs.length > 0) {
      const configPrefs = tenantConfig[0].config_value as any;
      const isWorkPatternSynced = configPrefs.workPreferences.workPatternType === nursePrefs[0].work_pattern_type;

      if (isWorkPatternSynced) {
        console.log('✅ SUCCESS: Preferences are properly synced between tables!');
        console.log('   Real-time updates are working correctly.\n');
      } else {
        console.log('❌ ERROR: Preferences are NOT synced between tables!');
        console.log(`   tenant_configs: ${configPrefs.workPreferences.workPatternType}`);
        console.log(`   nurse_preferences: ${nursePrefs[0].work_pattern_type}\n`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  testPreferenceSync()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { testPreferenceSync };
