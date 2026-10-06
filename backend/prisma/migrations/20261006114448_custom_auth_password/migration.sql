-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "required_actions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "keycloak_user_id" DROP NOT NULL;

-- Cutover: every user that existed under Keycloak has no portable password hash
-- (Keycloak stores PBKDF2, which cannot be re-hashed into bcrypt). Flag those accounts
-- so the login flow forces a password set instead of failing with "invalid credentials".
UPDATE "users"
SET "required_actions" = ARRAY['UPDATE_PASSWORD']
WHERE "password_hash" IS NULL
  AND NOT ('UPDATE_PASSWORD' = ANY("required_actions"));
