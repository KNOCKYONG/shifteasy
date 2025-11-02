-- Add deleted_flag column to schedules table for soft delete functionality
ALTER TABLE "schedules" ADD COLUMN "deleted_flag" text;--> statement-breakpoint

-- Create index on deleted_flag for efficient filtering
CREATE INDEX "schedules_deleted_flag_idx" ON "schedules" USING btree ("deleted_flag");
