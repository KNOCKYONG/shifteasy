-- Phase 1: Database Cleanup for nurse_preferences system
-- Drop preference_templates table and 34 unused fields from nurse_preferences
-- Executed after code cleanup to match new simplified schema

-- 1. Drop preference_templates table (confirmed unused by user)
DROP TABLE IF EXISTS public.preference_templates CASCADE;

-- 2. Drop 34 unused fields from nurse_preferences table

-- Drop Unit/Location preference fields (5 fields)
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS preferred_units CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS avoid_units CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS float_pool_willing CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS float_pool_preferences CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS preferred_mentors CASCADE;

-- Drop Overtime/Extra shift fields (5 fields)
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS overtime_willing CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS max_overtime_hours_per_month CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS overtime_notice_required CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS call_shift_willing CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS emergency_availability CASCADE;

-- Drop Time constraint fields (3 fields)
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS unavailable_dates CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS earliest_start_time CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS latest_end_time CASCADE;

-- Drop Education/Training fields (4 fields)
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS education_in_progress CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS education_schedule CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS training_interests CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS certification_goals CASCADE;

-- Drop Health/Accommodation fields (5 fields)
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS has_accommodation_needs CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS accommodation_details CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS pregnancy_status CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS pregnancy_restrictions CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS expected_return_date CASCADE;

-- Drop Priority/Admin fields (9 fields)
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS preference_priorities CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS is_active CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS last_reviewed_at CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS next_review_date CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS approved_by CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS approved_at CASCADE;
ALTER TABLE public.nurse_preferences DROP COLUMN IF EXISTS notes CASCADE;

-- Drop indexes associated with removed fields
DROP INDEX IF EXISTS public.nurse_preferences_active_idx;

-- Verify cleanup
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'nurse_preferences'
ORDER BY ordinal_position;
