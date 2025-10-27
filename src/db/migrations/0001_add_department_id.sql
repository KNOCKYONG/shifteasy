-- Migration: Add department_id to nurse_preferences and special_requests
-- Date: 2025-10-27

-- Add department_id column to nurse_preferences
ALTER TABLE nurse_preferences
ADD COLUMN IF NOT EXISTS department_id UUID;

-- Add department_id column to special_requests
ALTER TABLE special_requests
ADD COLUMN IF NOT EXISTS department_id UUID;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS nurse_preferences_department_idx
ON nurse_preferences(department_id);

CREATE INDEX IF NOT EXISTS special_requests_department_idx
ON special_requests(department_id);

-- Populate nurse_preferences.department_id from users table
UPDATE nurse_preferences
SET department_id = users.department_id
FROM users
WHERE nurse_preferences.nurse_id = users.id
AND nurse_preferences.department_id IS NULL;

-- Populate special_requests.department_id from users table
UPDATE special_requests
SET department_id = users.department_id
FROM users
WHERE special_requests.employee_id = users.id
AND special_requests.department_id IS NULL;

-- Verification queries (optional - comment out for production)
-- SELECT COUNT(*) as total,
--        COUNT(department_id) as with_dept,
--        COUNT(*) - COUNT(department_id) as without_dept
-- FROM nurse_preferences;

-- SELECT COUNT(*) as total,
--        COUNT(department_id) as with_dept,
--        COUNT(*) - COUNT(department_id) as without_dept
-- FROM special_requests;
