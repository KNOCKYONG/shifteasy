ALTER TABLE "departments" ADD COLUMN "secret_code" text;--> statement-breakpoint
ALTER TABLE "nurse_preferences" ADD COLUMN "work_pattern_type" text DEFAULT 'three-shift';--> statement-breakpoint
CREATE INDEX "departments_secret_code_idx" ON "departments" USING btree ("secret_code");--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_secret_code_unique" UNIQUE("secret_code");