CREATE TYPE "public"."staff_role" AS ENUM('RN', 'CN', 'SN', 'NA');--> statement-breakpoint
CREATE TYPE "public"."shift_type" AS ENUM('D', 'E', 'N', 'O');--> statement-breakpoint
CREATE TYPE "public"."schedule_status" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'CONFIRMED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."request_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."request_type" AS ENUM('ANNUAL_LEAVE', 'SICK_LEAVE', 'SHIFT_PREFERENCE', 'SHIFT_AVOIDANCE', 'OVERTIME');--> statement-breakpoint
CREATE TABLE "ward_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"is_overtime" boolean DEFAULT false NOT NULL,
	"is_replacement" boolean DEFAULT false NOT NULL,
	"confidence" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hospitals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"time_zone" text DEFAULT 'Asia/Seoul' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ward_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ward_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" "schedule_status" DEFAULT 'DRAFT' NOT NULL,
	"version" text DEFAULT 'draft' NOT NULL,
	"rules_snapshot" jsonb DEFAULT '{}'::jsonb,
	"generated_at" timestamp,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ward_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"type" "request_type" NOT NULL,
	"status" "request_status" DEFAULT 'PENDING' NOT NULL,
	"priority" "request_priority" DEFAULT 'MEDIUM' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"shift_type" "shift_type",
	"reason" text,
	"description" text,
	"approved_by" text,
	"approved_at" timestamp,
	"rejected_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"shift_type" "shift_type",
	"score" integer NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "settings" SET DEFAULT '{"timezone":"Asia/Seoul","locale":"ko","maxUsers":10,"maxDepartments":3,"features":[],"signupEnabled":true}'::jsonb;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "secret_code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ward_assignments" ADD CONSTRAINT "ward_assignments_schedule_id_ward_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."ward_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ward_assignments" ADD CONSTRAINT "ward_assignments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ward_assignments" ADD CONSTRAINT "ward_assignments_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wards" ADD CONSTRAINT "wards_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ward_schedules" ADD CONSTRAINT "ward_schedules_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ward_schedules" ADD CONSTRAINT "ward_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_secret_code_unique" UNIQUE("secret_code");