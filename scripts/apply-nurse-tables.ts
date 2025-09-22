/**
 * Script to apply nurse-related tables to database
 * 간호사 관련 테이블을 데이터베이스에 적용하는 스크립트
 */

import { db } from '../src/db';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

async function applyNurseTables() {
  console.log('🚀 간호사 스케줄링 테이블 생성 시작...');

  try {
    // Create skill_categories table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "skill_categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "display_order" integer DEFAULT 0,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ skill_categories 테이블 생성 완료');

    // Create skills table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "skills" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "category_id" uuid REFERENCES skill_categories(id),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "skill_type" text NOT NULL,
        "required_for_unit" jsonb,
        "requires_renewal" boolean DEFAULT false,
        "renewal_period_months" integer,
        "has_proficiency_levels" boolean DEFAULT true,
        "proficiency_levels" jsonb,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ skills 테이블 생성 완료');

    // Create nurse_skills table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "nurse_skills" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "nurse_id" uuid NOT NULL REFERENCES users(id),
        "skill_id" uuid NOT NULL REFERENCES skills(id),
        "proficiency_level" text,
        "proficiency_score" integer,
        "certification_date" timestamp,
        "expiration_date" timestamp,
        "certification_number" text,
        "issuing_authority" text,
        "is_verified" boolean DEFAULT false,
        "verified_by" uuid REFERENCES users(id),
        "verified_at" timestamp,
        "verification_notes" text,
        "hours_of_experience" integer,
        "last_used_date" timestamp,
        "frequency_of_use" text,
        "status" text DEFAULT 'active',
        "notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ nurse_skills 테이블 생성 완료');

    // Create unit_skill_requirements table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "unit_skill_requirements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "unit_type" text NOT NULL,
        "shift_type" text,
        "skill_id" uuid NOT NULL REFERENCES skills(id),
        "is_required" boolean DEFAULT true,
        "minimum_proficiency" text,
        "minimum_nurses_per_shift" integer DEFAULT 1,
        "ratio_type" text,
        "ratio_value" integer,
        "priority" integer DEFAULT 1,
        "effective_from" timestamp DEFAULT now(),
        "effective_to" timestamp,
        "notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ unit_skill_requirements 테이블 생성 완료');

    // Create skill_training_records table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "skill_training_records" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "nurse_id" uuid NOT NULL REFERENCES users(id),
        "skill_id" uuid NOT NULL REFERENCES skills(id),
        "training_type" text NOT NULL,
        "training_date" timestamp NOT NULL,
        "completion_date" timestamp,
        "instructor_name" text,
        "instructor_id" uuid REFERENCES users(id),
        "training_facility" text,
        "passed" boolean,
        "score" integer,
        "certificate_issued" boolean DEFAULT false,
        "certificate_number" text,
        "theory_hours" integer,
        "practical_hours" integer,
        "total_hours" integer,
        "notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ skill_training_records 테이블 생성 완료');

    // Create skill_assessments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "skill_assessments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "nurse_id" uuid NOT NULL REFERENCES users(id),
        "skill_id" uuid NOT NULL REFERENCES skills(id),
        "assessment_date" timestamp NOT NULL,
        "assessor_id" uuid NOT NULL REFERENCES users(id),
        "assessment_type" text NOT NULL,
        "previous_level" text,
        "assessed_level" text,
        "score" integer,
        "theoretical_knowledge" integer,
        "practical_skills" integer,
        "critical_thinking" integer,
        "communication" integer,
        "recommended_for_advancement" boolean DEFAULT false,
        "requires_improvement" boolean DEFAULT false,
        "improvement_areas" jsonb,
        "comments" text,
        "next_assessment_date" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ skill_assessments 테이블 생성 완료');

    // Create preceptor_relationships table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "preceptor_relationships" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "preceptor_id" uuid NOT NULL REFERENCES users(id),
        "orientee_id" uuid NOT NULL REFERENCES users(id),
        "start_date" timestamp NOT NULL,
        "end_date" timestamp,
        "status" text DEFAULT 'active',
        "program_type" text,
        "unit_type" text,
        "total_shifts_required" integer,
        "completed_shifts" integer DEFAULT 0,
        "progress_percentage" integer DEFAULT 0,
        "focus_skills" jsonb,
        "last_evaluation_date" timestamp,
        "next_evaluation_date" timestamp,
        "notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ preceptor_relationships 테이블 생성 완료');

    // Create nurse_preferences table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "nurse_preferences" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "nurse_id" uuid NOT NULL REFERENCES users(id),
        "preferred_shift_types" jsonb,
        "preferred_patterns" jsonb,
        "max_consecutive_days_preferred" integer DEFAULT 4,
        "max_consecutive_nights_preferred" integer DEFAULT 2,
        "prefer_consecutive_days_off" integer DEFAULT 2,
        "avoid_back_to_back_shifts" boolean DEFAULT false,
        "weekday_preferences" jsonb,
        "weekend_preference" text,
        "max_weekends_per_month" integer,
        "prefer_alternating_weekends" boolean DEFAULT false,
        "holiday_preference" text,
        "specific_holiday_preferences" jsonb,
        "preferred_units" jsonb,
        "avoid_units" jsonb,
        "float_pool_willing" boolean DEFAULT false,
        "float_pool_preferences" jsonb,
        "preferred_colleagues" jsonb,
        "avoid_colleagues" jsonb,
        "preferred_team_size" text,
        "mentorship_preference" text,
        "preferred_mentors" jsonb,
        "overtime_willing" boolean DEFAULT false,
        "max_overtime_hours_per_month" integer,
        "overtime_notice_required" integer,
        "call_shift_willing" boolean DEFAULT false,
        "emergency_availability" boolean DEFAULT false,
        "unavailable_dates" jsonb,
        "earliest_start_time" time,
        "latest_end_time" time,
        "has_transportation_issues" boolean DEFAULT false,
        "transportation_notes" text,
        "has_care_responsibilities" boolean DEFAULT false,
        "care_responsibility_details" jsonb,
        "education_in_progress" boolean DEFAULT false,
        "education_schedule" jsonb,
        "training_interests" jsonb,
        "certification_goals" jsonb,
        "has_accommodation_needs" boolean DEFAULT false,
        "accommodation_details" text,
        "pregnancy_status" text,
        "pregnancy_restrictions" jsonb,
        "expected_return_date" date,
        "preference_priorities" jsonb,
        "is_active" boolean DEFAULT true,
        "last_reviewed_at" timestamp,
        "next_review_date" date,
        "approved_by" uuid REFERENCES users(id),
        "approved_at" timestamp,
        "notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ nurse_preferences 테이블 생성 완료');

    // Create schedule_requests table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "schedule_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "nurse_id" uuid NOT NULL REFERENCES users(id),
        "request_type" text NOT NULL,
        "status" text DEFAULT 'pending',
        "priority" text DEFAULT 'normal',
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "specific_shifts" jsonb,
        "swap_with_nurse_id" uuid REFERENCES users(id),
        "swap_agreed" boolean DEFAULT false,
        "reason" text NOT NULL,
        "category" text,
        "urgency_level" integer DEFAULT 1,
        "has_documentation" boolean DEFAULT false,
        "documentation_url" text,
        "reviewed_by" uuid REFERENCES users(id),
        "reviewed_at" timestamp,
        "review_notes" text,
        "alternative_suggested" jsonb,
        "alternative_accepted" boolean DEFAULT false,
        "submitted_at" timestamp DEFAULT now() NOT NULL,
        "last_modified_at" timestamp DEFAULT now() NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ schedule_requests 테이블 생성 완료');

    // Create preference_templates table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "preference_templates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "category" text,
        "template_data" jsonb NOT NULL,
        "usage_count" integer DEFAULT 0,
        "last_used_at" timestamp,
        "is_active" boolean DEFAULT true,
        "created_by" uuid REFERENCES users(id),
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ preference_templates 테이블 생성 완료');

    // Create preference_history table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "preference_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "nurse_id" uuid NOT NULL REFERENCES users(id),
        "preference_id" uuid NOT NULL REFERENCES nurse_preferences(id),
        "change_type" text NOT NULL,
        "changed_fields" jsonb,
        "previous_values" jsonb,
        "new_values" jsonb,
        "changed_by" uuid REFERENCES users(id),
        "change_reason" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ preference_history 테이블 생성 완료');

    // Create indexes
    console.log('\n📊 인덱스 생성 중...');

    // Indexes for nurse_skills
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "nurse_skills_idx" ON "nurse_skills" ("nurse_id", "skill_id");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "nurse_skills_tenant_idx" ON "nurse_skills" ("tenant_id");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "nurse_skills_expiration_idx" ON "nurse_skills" ("expiration_date");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "nurse_skills_status_idx" ON "nurse_skills" ("status");`);

    // Indexes for nurse_preferences
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "nurse_preferences_nurse_idx" ON "nurse_preferences" ("nurse_id");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "nurse_preferences_tenant_idx" ON "nurse_preferences" ("tenant_id");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "nurse_preferences_active_idx" ON "nurse_preferences" ("is_active");`);

    // Indexes for schedule_requests
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "schedule_requests_nurse_idx" ON "schedule_requests" ("nurse_id");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "schedule_requests_status_idx" ON "schedule_requests" ("status");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "schedule_requests_date_idx" ON "schedule_requests" ("start_date", "end_date");`);

    console.log('✅ 모든 인덱스 생성 완료');

    console.log('\n🎉 간호사 스케줄링 테이블 생성 완료!');
    console.log('총 11개의 새로운 테이블이 생성되었습니다.');

  } catch (error) {
    console.error('❌ 테이블 생성 중 오류 발생:', error);
    process.exit(1);
  }
}

// Run the migration
applyNurseTables()
  .then(() => {
    console.log('\n✅ 모든 작업이 성공적으로 완료되었습니다.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 작업 실행 중 오류:', error);
    process.exit(1);
  });