-- Add version column to schedules table for tracking schedule changes
ALTER TABLE "schedules" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint

-- Create index on version for efficient filtering and sorting
CREATE INDEX "schedules_version_idx" ON "schedules" USING btree ("version");--> statement-breakpoint

-- Update existing schedules to have version 1
UPDATE "schedules" SET "version" = 1 WHERE "version" IS NULL;
