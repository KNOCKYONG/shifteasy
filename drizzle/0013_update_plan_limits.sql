ALTER TABLE "tenants"
ALTER COLUMN "plan" SET DEFAULT 'guest';

ALTER TABLE "tenants"
ALTER COLUMN "settings" SET DEFAULT '{"timezone":"Asia/Seoul","locale":"ko","maxUsers":30,"maxDepartments":3,"features":[],"signupEnabled":true}'::jsonb;

UPDATE "tenants"
SET "plan" = 'guest'
WHERE "plan" = 'free';

UPDATE "tenants"
SET "settings" = jsonb_set(
  coalesce("tenants"."settings", '{}'::jsonb),
  '{maxUsers}',
  to_jsonb(30),
  true
)
WHERE ("plan" = 'guest' OR "plan" = 'free')
  AND (
    "tenants"."settings"->>'maxUsers' IS NULL
    OR ("tenants"."settings"->>'maxUsers')::int < 30
  );

UPDATE "tenants"
SET "settings" = jsonb_set(
  coalesce("tenants"."settings", '{}'::jsonb),
  '{maxUsers}',
  to_jsonb(50),
  true
)
WHERE "plan" = 'professional'
  AND (
    "tenants"."settings"->>'maxUsers' IS NULL
    OR ("tenants"."settings"->>'maxUsers')::int <> 50
  );
