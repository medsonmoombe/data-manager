-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger_type" TEXT NOT NULL,
    "trigger_config" JSONB NOT NULL DEFAULT '{}',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_instances" (
    "id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "trigger_data" JSONB NOT NULL DEFAULT '{}',
    "variables" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_tasks" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    "assignee_role" TEXT,
    "task_type" TEXT NOT NULL,
    "task_name" TEXT NOT NULL,
    "task_config" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assigned_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "result" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_instances_org_id_status_idx" ON "workflow_instances"("org_id", "status");

-- CreateIndex
CREATE INDEX "workflow_instances_definition_id_started_at_idx" ON "workflow_instances"("definition_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "workflow_tasks_instance_id_status_idx" ON "workflow_tasks"("instance_id", "status");

-- CreateIndex
CREATE INDEX "workflow_tasks_assignee_id_status_idx" ON "workflow_tasks"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "workflow_tasks_assignee_role_status_idx" ON "workflow_tasks"("assignee_role", "status");

-- AddForeignKey
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
