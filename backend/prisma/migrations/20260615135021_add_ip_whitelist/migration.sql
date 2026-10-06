/*
  Warnings:

  - You are about to drop the column `keycloak_user_id` on the `invitations` table. All the data in the column will be lost.
  - You are about to drop the column `role_id` on the `invitations` table. All the data in the column will be lost.
  - You are about to drop the column `temp_password` on the `invitations` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `organizations` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token]` on the table `invitations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `token` to the `invitations` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_org_id_fkey";

-- DropIndex
DROP INDEX "invitations_org_id_email_key";

-- AlterTable
ALTER TABLE "invitations" DROP COLUMN "keycloak_user_id",
DROP COLUMN "role_id",
DROP COLUMN "temp_password",
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'member',
ADD COLUMN     "team_ids" TEXT[],
ADD COLUMN     "token" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "updated_at";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "last_active_at" TIMESTAMP(3),
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "preferences" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Africa/Lusaka';

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatar_url" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invited_by" TEXT,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");

-- CreateIndex
CREATE INDEX "user_activities_org_id_user_id_created_at_idx" ON "user_activities"("org_id", "user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_email_status_idx" ON "invitations"("email", "status");

-- CreateIndex
CREATE INDEX "invitations_token_idx" ON "invitations"("token");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
