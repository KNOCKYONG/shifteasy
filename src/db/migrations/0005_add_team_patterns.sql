-- Create team_patterns table
CREATE TABLE IF NOT EXISTS "team_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"required_staff_day" integer DEFAULT 5 NOT NULL,
	"required_staff_evening" integer DEFAULT 4 NOT NULL,
	"required_staff_night" integer DEFAULT 3 NOT NULL,
	"default_patterns" jsonb DEFAULT '[["D","D","D","OFF","OFF"]]'::jsonb NOT NULL,
	"total_members" integer DEFAULT 15 NOT NULL,
	"is_active" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Add foreign key
ALTER TABLE "team_patterns" ADD CONSTRAINT "team_patterns_department_id_departments_id_fk"
FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Add indexes
CREATE INDEX IF NOT EXISTS "team_patterns_department_idx" ON "team_patterns" USING btree ("department_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_patterns_active_idx" ON "team_patterns" USING btree ("is_active");