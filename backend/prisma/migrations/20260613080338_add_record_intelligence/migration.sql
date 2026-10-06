-- CreateTable
CREATE TABLE "record_relationships" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "source_entity_type" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "target_entity_type" TEXT NOT NULL,
    "target_record_id" TEXT NOT NULL,
    "relationship_type" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "is_inferred" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_timeline_events" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_data" JSONB NOT NULL DEFAULT '{}',
    "actor_user_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_profiles" (
    "entity_type" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "profile_json" JSONB NOT NULL DEFAULT '{}',
    "last_built_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_profiles_pkey" PRIMARY KEY ("entity_type","record_id","org_id")
);

-- CreateIndex
CREATE INDEX "record_relationships_org_id_source_entity_type_source_recor_idx" ON "record_relationships"("org_id", "source_entity_type", "source_record_id");

-- CreateIndex
CREATE INDEX "record_relationships_org_id_target_entity_type_target_recor_idx" ON "record_relationships"("org_id", "target_entity_type", "target_record_id");

-- CreateIndex
CREATE INDEX "record_timeline_events_org_id_entity_type_record_id_occurre_idx" ON "record_timeline_events"("org_id", "entity_type", "record_id", "occurred_at" DESC);
