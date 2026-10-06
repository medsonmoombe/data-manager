-- CreateTable
CREATE TABLE "api_key_usage_logs" (
    "id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "response_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_key_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_key_usage_logs_api_key_id_created_at_idx" ON "api_key_usage_logs"("api_key_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "api_key_usage_logs_org_id_created_at_idx" ON "api_key_usage_logs"("org_id", "created_at" DESC);
