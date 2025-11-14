ALTER TABLE "users" RENAME COLUMN "clerk_user_id" TO "auth_user_id";

ALTER INDEX IF EXISTS "users_clerk_user_id_idx" RENAME TO "users_auth_user_id_idx";

ALTER INDEX IF EXISTS "users_clerk_user_id_unique" RENAME TO "users_auth_user_id_unique";
