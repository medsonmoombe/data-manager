-- CreateTable
CREATE TABLE "entity_definitions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_attributes" (
    "id" TEXT NOT NULL,
    "entity_definition_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT,
    "data_type" TEXT NOT NULL,
    "is_identifier" BOOLEAN NOT NULL DEFAULT false,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "validation_rules" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "entity_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matching_rules" (
    "id" TEXT NOT NULL,
    "entity_definition_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "field_weights" JSONB NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "matching_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "golden_records" (
    "id" TEXT NOT NULL,
    "entity_definition_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "external_id" TEXT,
    "hashed_identifier" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "match_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "golden_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_versions" (
    "id" TEXT NOT NULL,
    "golden_record_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "data_snapshot" JSONB NOT NULL,
    "changed_fields" TEXT[],
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_records" (
    "id" TEXT NOT NULL,
    "golden_record_id" TEXT,
    "connector_run_item_id" TEXT,
    "entity_definition_id" TEXT NOT NULL,
    "source_data" JSONB NOT NULL DEFAULT '{}',
    "source_system" TEXT NOT NULL,
    "source_id" TEXT,
    "import_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "source_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merge_history" (
    "id" TEXT NOT NULL,
    "entity_definition_id" TEXT NOT NULL,
    "surviving_record_id" TEXT NOT NULL,
    "merged_record_id" TEXT NOT NULL,
    "merged_by" TEXT,
    "merged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merge_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entity_definitions_org_id_name_key" ON "entity_definitions"("org_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "entity_attributes_entity_definition_id_name_key" ON "entity_attributes"("entity_definition_id", "name");

-- CreateIndex
CREATE INDEX "golden_records_org_id_entity_definition_id_idx" ON "golden_records"("org_id", "entity_definition_id");

-- CreateIndex
CREATE INDEX "golden_records_hashed_identifier_idx" ON "golden_records"("hashed_identifier");

-- CreateIndex
CREATE UNIQUE INDEX "record_versions_golden_record_id_version_number_key" ON "record_versions"("golden_record_id", "version_number");

-- CreateIndex
CREATE INDEX "source_records_entity_definition_id_status_idx" ON "source_records"("entity_definition_id", "status");

-- AddForeignKey
ALTER TABLE "entity_definitions" ADD CONSTRAINT "entity_definitions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_attributes" ADD CONSTRAINT "entity_attributes_entity_definition_id_fkey" FOREIGN KEY ("entity_definition_id") REFERENCES "entity_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matching_rules" ADD CONSTRAINT "matching_rules_entity_definition_id_fkey" FOREIGN KEY ("entity_definition_id") REFERENCES "entity_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "golden_records" ADD CONSTRAINT "golden_records_entity_definition_id_fkey" FOREIGN KEY ("entity_definition_id") REFERENCES "entity_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "golden_records" ADD CONSTRAINT "golden_records_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_versions" ADD CONSTRAINT "record_versions_golden_record_id_fkey" FOREIGN KEY ("golden_record_id") REFERENCES "golden_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_golden_record_id_fkey" FOREIGN KEY ("golden_record_id") REFERENCES "golden_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_connector_run_item_id_fkey" FOREIGN KEY ("connector_run_item_id") REFERENCES "connector_run_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
