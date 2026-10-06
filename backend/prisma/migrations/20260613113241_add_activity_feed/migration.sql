-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "entity_name" TEXT,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "actor_user_id" TEXT,
    "actor_name" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_subscriptions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_types" TEXT[],
    "channels" TEXT[] DEFAULT ARRAY['in_app']::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_events_org_id_created_at_idx" ON "activity_events"("org_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_events_org_id_event_type_created_at_idx" ON "activity_events"("org_id", "event_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_events_org_id_actor_user_id_created_at_idx" ON "activity_events"("org_id", "actor_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_events_org_id_is_read_created_at_idx" ON "activity_events"("org_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "activity_subscriptions_org_id_user_id_key" ON "activity_subscriptions"("org_id", "user_id");

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_subscriptions" ADD CONSTRAINT "activity_subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
