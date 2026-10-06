-- CreateTable
CREATE TABLE "duplicate_scan_jobs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "total_records" INTEGER NOT NULL DEFAULT 0,
    "processed_pairs" INTEGER NOT NULL DEFAULT 0,
    "total_pairs" INTEGER NOT NULL DEFAULT 0,
    "duplicates_found" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "duplicate_scan_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "duplicate_scan_jobs_org_id_status_idx" ON "duplicate_scan_jobs"("org_id", "status");

-- AddForeignKey
ALTER TABLE "duplicate_scan_jobs" ADD CONSTRAINT "duplicate_scan_jobs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
