/*
  Warnings:

  - You are about to drop the column `created_at` on the `workflow_definitions` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `workflow_definitions` table. All the data in the column will be lost.
  - You are about to drop the column `trigger_config` on the `workflow_definitions` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `workflow_definitions` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `workflow_definitions` table. All the data in the column will be lost.
  - You are about to drop the column `completed_at` on the `workflow_instances` table. All the data in the column will be lost.
  - You are about to drop the column `error_message` on the `workflow_instances` table. All the data in the column will be lost.
  - You are about to drop the column `started_at` on the `workflow_instances` table. All the data in the column will be lost.
  - You are about to drop the column `trigger_data` on the `workflow_instances` table. All the data in the column will be lost.
  - You are about to drop the column `assigned_at` on the `workflow_tasks` table. All the data in the column will be lost.
  - You are about to drop the column `assignee_id` on the `workflow_tasks` table. All the data in the column will be lost.
  - You are about to drop the column `assignee_role` on the `workflow_tasks` table. All the data in the column will be lost.
  - You are about to drop the column `completed_at` on the `workflow_tasks` table. All the data in the column will be lost.
  - You are about to drop the column `completed_by` on the `workflow_tasks` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `workflow_tasks` table. All the data in the column will be lost.
  - You are about to drop the column `error_message` on the `workflow_tasks` table. All the data in the column will be lost.
  - You are about to drop the column `task_config` on the `workflow_tasks` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `workflow_definitions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "workflow_instances_definition_id_started_at_idx";

-- DropIndex
DROP INDEX "workflow_tasks_assignee_id_status_idx";

-- DropIndex
DROP INDEX "workflow_tasks_assignee_role_status_idx";

-- AlterTable
ALTER TABLE "workflow_definitions" DROP COLUMN "created_at",
DROP COLUMN "is_active",
DROP COLUMN "trigger_config",
DROP COLUMN "updated_at",
DROP COLUMN "version",
ADD COLUMN     "category" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "failure_strategy" TEXT NOT NULL DEFAULT 'stop',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_template" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "triggerConfig" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "workflow_instances" DROP COLUMN "completed_at",
DROP COLUMN "error_message",
DROP COLUMN "started_at",
DROP COLUMN "trigger_data",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "errorStepId" TEXT,
ADD COLUMN     "executionGraph" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "triggerData" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "workflow_tasks" DROP COLUMN "assigned_at",
DROP COLUMN "assignee_id",
DROP COLUMN "assignee_role",
DROP COLUMN "completed_at",
DROP COLUMN "completed_by",
DROP COLUMN "created_at",
DROP COLUMN "error_message",
DROP COLUMN "task_config",
ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "assigneeRole" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedBy" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "max_retries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "step_id" TEXT,
ADD COLUMN     "taskConfig" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "workflow_compensations" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "action" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "executed_at" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "workflow_compensations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_definitions_org_id_category_idx" ON "workflow_definitions"("org_id", "category");

-- CreateIndex
CREATE INDEX "workflow_definitions_org_id_trigger_type_idx" ON "workflow_definitions"("org_id", "trigger_type");

-- CreateIndex
CREATE INDEX "workflow_instances_definition_id_startedAt_idx" ON "workflow_instances"("definition_id", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "workflow_tasks_assigneeId_status_idx" ON "workflow_tasks"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "workflow_tasks_dueAt_idx" ON "workflow_tasks"("dueAt");

-- AddForeignKey
ALTER TABLE "workflow_compensations" ADD CONSTRAINT "workflow_compensations_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
