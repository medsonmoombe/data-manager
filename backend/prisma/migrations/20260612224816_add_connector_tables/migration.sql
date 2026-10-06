-- CreateTable
CREATE TABLE "connectors" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "connector_type" TEXT NOT NULL,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_jobs" (
    "id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schedule" TEXT,
    "transformation_rules" JSONB NOT NULL DEFAULT '[]',
    "target_entity" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),

    CONSTRAINT "connector_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_runs" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "records_succeeded" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "error_log" JSONB,
    "raw_data_ref" TEXT,
    "started_by" TEXT,

    CONSTRAINT "connector_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_run_items" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "source_identifier" TEXT,
    "raw_data" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "golden_record_id" TEXT,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "connector_run_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_jobs" ADD CONSTRAINT "connector_jobs_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_runs" ADD CONSTRAINT "connector_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "connector_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_run_items" ADD CONSTRAINT "connector_run_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "connector_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
