-- Drop nurse_preferences tables that are no longer used by UI
-- UI uses REST API /api/preferences -> tenant_configs instead

DROP TABLE IF EXISTS public.schedule_requests CASCADE;
DROP TABLE IF EXISTS public.preference_history CASCADE;
DROP TABLE IF EXISTS public.preference_templates CASCADE;
DROP TABLE IF EXISTS public.nurse_preferences CASCADE;
