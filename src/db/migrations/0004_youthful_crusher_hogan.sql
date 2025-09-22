CREATE TYPE "public"."request_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."request_type" AS ENUM('ANNUAL_LEAVE', 'SICK_LEAVE', 'SHIFT_PREFERENCE', 'SHIFT_AVOIDANCE', 'OVERTIME');--> statement-breakpoint
CREATE TYPE "public"."schedule_status" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'CONFIRMED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."shift_type" AS ENUM('D', 'E', 'N', 'O');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('RN', 'CN', 'SN', 'NA');--> statement-breakpoint
CREATE TABLE "ward_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"is_overtime" boolean DEFAULT false NOT NULL,
	"is_replacement" boolean DEFAULT false NOT NULL,
	"confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hospitals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"time_zone" text DEFAULT 'Asia/Seoul' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nurse_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nurse_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"proficiency_level" text,
	"proficiency_score" integer,
	"certification_date" timestamp,
	"expiration_date" timestamp,
	"certification_number" text,
	"issuing_authority" text,
	"is_verified" boolean DEFAULT false,
	"verified_by" uuid,
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
--> statement-breakpoint
CREATE TABLE "preceptor_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"preceptor_id" uuid NOT NULL,
	"orientee_id" uuid NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "skill_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nurse_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"assessment_date" timestamp NOT NULL,
	"assessor_id" uuid NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "skill_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_training_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nurse_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"training_type" text NOT NULL,
	"training_date" timestamp NOT NULL,
	"completion_date" timestamp,
	"instructor_name" text,
	"instructor_id" uuid,
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
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid,
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
--> statement-breakpoint
CREATE TABLE "unit_skill_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"unit_type" text NOT NULL,
	"shift_type" text,
	"skill_id" uuid NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "nurse_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nurse_id" uuid NOT NULL,
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
	"approved_by" uuid,
	"approved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preference_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nurse_id" uuid NOT NULL,
	"preference_id" uuid NOT NULL,
	"change_type" text NOT NULL,
	"changed_fields" jsonb,
	"previous_values" jsonb,
	"new_values" jsonb,
	"changed_by" uuid,
	"change_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preference_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"template_data" jsonb NOT NULL,
	"usage_count" integer DEFAULT 0,
	"last_used_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nurse_id" uuid NOT NULL,
	"request_type" text NOT NULL,
	"status" text DEFAULT 'pending',
	"priority" text DEFAULT 'normal',
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"specific_shifts" jsonb,
	"swap_with_nurse_id" uuid,
	"swap_agreed" boolean DEFAULT false,
	"reason" text NOT NULL,
	"category" text,
	"urgency_level" integer DEFAULT 1,
	"has_documentation" boolean DEFAULT false,
	"documentation_url" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_notes" text,
	"alternative_suggested" jsonb,
	"alternative_accepted" boolean DEFAULT false,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"shift_type" "shift_type",
	"score" integer NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ward_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"type" "request_type" NOT NULL,
	"status" "request_status" DEFAULT 'PENDING' NOT NULL,
	"priority" "request_priority" DEFAULT 'MEDIUM' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"shift_type" "shift_type",
	"reason" text,
	"description" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"rejected_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ward_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ward_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"status" "schedule_status" DEFAULT 'DRAFT' NOT NULL,
	"version" text DEFAULT 'draft' NOT NULL,
	"rules_snapshot" jsonb DEFAULT '{}'::jsonb,
	"generated_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ward_id" uuid NOT NULL,
	"type" "shift_type" NOT NULL,
	"label" text NOT NULL,
	"start_time" text,
	"end_time" text,
	"duration" integer,
	"min_staff" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ward_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"role" "staff_role" NOT NULL,
	"employee_id" text,
	"hire_date" timestamp,
	"max_weekly_hours" integer DEFAULT 40 NOT NULL,
	"skills" text[],
	"technical_skill" integer DEFAULT 3 NOT NULL,
	"leadership" integer DEFAULT 3 NOT NULL,
	"communication" integer DEFAULT 3 NOT NULL,
	"adaptability" integer DEFAULT 3 NOT NULL,
	"reliability" integer DEFAULT 3 NOT NULL,
	"experience_level" text DEFAULT 'JUNIOR' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "staff_compatibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff1_id" uuid NOT NULL,
	"staff2_id" uuid NOT NULL,
	"compatibility_score" real NOT NULL,
	"total_shifts_together" integer DEFAULT 0 NOT NULL,
	"successful_shifts" integer DEFAULT 0 NOT NULL,
	"communication_score" real,
	"work_style_score" real,
	"reliability_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"hard_rules" jsonb DEFAULT '{}'::jsonb,
	"soft_rules" jsonb DEFAULT '{}'::jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ward_assignments" ADD CONSTRAINT "ward_assignments_schedule_id_ward_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."ward_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ward_assignments" ADD CONSTRAINT "ward_assignments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ward_assignments" ADD CONSTRAINT "ward_assignments_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nurse_skills" ADD CONSTRAINT "nurse_skills_nurse_id_users_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nurse_skills" ADD CONSTRAINT "nurse_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nurse_skills" ADD CONSTRAINT "nurse_skills_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preceptor_relationships" ADD CONSTRAINT "preceptor_relationships_preceptor_id_users_id_fk" FOREIGN KEY ("preceptor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preceptor_relationships" ADD CONSTRAINT "preceptor_relationships_orientee_id_users_id_fk" FOREIGN KEY ("orientee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_nurse_id_users_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_assessor_id_users_id_fk" FOREIGN KEY ("assessor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_training_records" ADD CONSTRAINT "skill_training_records_nurse_id_users_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_training_records" ADD CONSTRAINT "skill_training_records_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_training_records" ADD CONSTRAINT "skill_training_records_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_category_id_skill_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."skill_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_skill_requirements" ADD CONSTRAINT "unit_skill_requirements_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nurse_preferences" ADD CONSTRAINT "nurse_preferences_nurse_id_users_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nurse_preferences" ADD CONSTRAINT "nurse_preferences_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_history" ADD CONSTRAINT "preference_history_nurse_id_users_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_history" ADD CONSTRAINT "preference_history_preference_id_nurse_preferences_id_fk" FOREIGN KEY ("preference_id") REFERENCES "public"."nurse_preferences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_history" ADD CONSTRAINT "preference_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_templates" ADD CONSTRAINT "preference_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_requests" ADD CONSTRAINT "schedule_requests_nurse_id_users_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_requests" ADD CONSTRAINT "schedule_requests_swap_with_nurse_id_users_id_fk" FOREIGN KEY ("swap_with_nurse_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_requests" ADD CONSTRAINT "schedule_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ward_schedules" ADD CONSTRAINT "ward_schedules_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ward_schedules" ADD CONSTRAINT "ward_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wards" ADD CONSTRAINT "wards_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ward_assignments_schedule_id_idx" ON "ward_assignments" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "ward_assignments_staff_id_idx" ON "ward_assignments" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "ward_assignments_shift_id_idx" ON "ward_assignments" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "ward_assignments_date_idx" ON "ward_assignments" USING btree ("date");--> statement-breakpoint
CREATE INDEX "hospitals_tenant_id_idx" ON "hospitals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "nurse_skills_idx" ON "nurse_skills" USING btree ("nurse_id","skill_id");--> statement-breakpoint
CREATE INDEX "nurse_skills_tenant_idx" ON "nurse_skills" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "nurse_skills_expiration_idx" ON "nurse_skills" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX "nurse_skills_status_idx" ON "nurse_skills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "preceptor_rel_preceptor_idx" ON "preceptor_relationships" USING btree ("preceptor_id");--> statement-breakpoint
CREATE INDEX "preceptor_rel_orientee_idx" ON "preceptor_relationships" USING btree ("orientee_id");--> statement-breakpoint
CREATE INDEX "preceptor_rel_status_idx" ON "preceptor_relationships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "skill_assessment_nurse_idx" ON "skill_assessments" USING btree ("nurse_id");--> statement-breakpoint
CREATE INDEX "skill_assessment_date_idx" ON "skill_assessments" USING btree ("assessment_date");--> statement-breakpoint
CREATE INDEX "skill_categories_tenant_idx" ON "skill_categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "skill_training_nurse_idx" ON "skill_training_records" USING btree ("nurse_id");--> statement-breakpoint
CREATE INDEX "skill_training_date_idx" ON "skill_training_records" USING btree ("training_date");--> statement-breakpoint
CREATE INDEX "skills_tenant_idx" ON "skills" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "skills_category_idx" ON "skills" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "skills_code_idx" ON "skills" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "unit_skill_req_idx" ON "unit_skill_requirements" USING btree ("unit_type","shift_type");--> statement-breakpoint
CREATE INDEX "unit_skill_req_tenant_idx" ON "unit_skill_requirements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "nurse_preferences_nurse_idx" ON "nurse_preferences" USING btree ("nurse_id");--> statement-breakpoint
CREATE INDEX "nurse_preferences_tenant_idx" ON "nurse_preferences" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "nurse_preferences_active_idx" ON "nurse_preferences" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "preference_history_nurse_idx" ON "preference_history" USING btree ("nurse_id");--> statement-breakpoint
CREATE INDEX "preference_history_pref_idx" ON "preference_history" USING btree ("preference_id");--> statement-breakpoint
CREATE INDEX "preference_history_date_idx" ON "preference_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "preference_templates_tenant_idx" ON "preference_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "preference_templates_category_idx" ON "preference_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "preference_templates_active_idx" ON "preference_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "schedule_requests_nurse_idx" ON "schedule_requests" USING btree ("nurse_id");--> statement-breakpoint
CREATE INDEX "schedule_requests_status_idx" ON "schedule_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "schedule_requests_date_idx" ON "schedule_requests" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "preferences_staff_id_idx" ON "preferences" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "preferences_date_idx" ON "preferences" USING btree ("date");--> statement-breakpoint
CREATE INDEX "requests_ward_id_idx" ON "requests" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX "requests_staff_id_idx" ON "requests" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "requests_status_idx" ON "requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "requests_date_range_idx" ON "requests" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "ward_schedules_ward_id_idx" ON "ward_schedules" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX "ward_schedules_status_idx" ON "ward_schedules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ward_schedules_date_range_idx" ON "ward_schedules" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "shifts_ward_id_idx" ON "shifts" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX "shifts_type_idx" ON "shifts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "staff_ward_id_idx" ON "staff" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX "staff_user_id_idx" ON "staff" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "staff_employee_id_idx" ON "staff" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "staff_compatibility_pair_idx" ON "staff_compatibility" USING btree ("staff1_id","staff2_id");--> statement-breakpoint
CREATE INDEX "wards_hospital_id_idx" ON "wards" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "wards_code_idx" ON "wards" USING btree ("code");