-- CreateTable
CREATE TABLE "auto_link_rules" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source_entity_type" TEXT NOT NULL,
    "target_entity_type" TEXT NOT NULL,
    "field_mappings" JSONB NOT NULL,
    "relationship_type" TEXT NOT NULL,
    "auto_accept_above" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "suggest_above" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_link_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "suggestion_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "entity_type_a" TEXT,
    "entity_id_a" TEXT,
    "entity_type_b" TEXT,
    "entity_id_b" TEXT,
    "proposed_action" JSONB NOT NULL DEFAULT '{}',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suggestions_org_id_status_idx" ON "suggestions"("org_id", "status");

-- CreateIndex
CREATE INDEX "suggestions_org_id_suggestion_type_idx" ON "suggestions"("org_id", "suggestion_type");

-- AddForeignKey
ALTER TABLE "auto_link_rules" ADD CONSTRAINT "auto_link_rules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
