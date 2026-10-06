-- CreateTable
CREATE TABLE "validation_rules" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_entity" TEXT NOT NULL,
    "target_field" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "rule_config" JSONB NOT NULL,
    "error_message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'error',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_results" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "golden_record_id" TEXT,
    "submission_id" TEXT,
    "field_name" TEXT NOT NULL,
    "current_value" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "validation_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "validation_results_rule_id_status_idx" ON "validation_results"("rule_id", "status");

-- AddForeignKey
ALTER TABLE "validation_rules" ADD CONSTRAINT "validation_rules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "validation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
