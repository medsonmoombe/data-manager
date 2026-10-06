-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "event_types" TEXT[],
    "secret_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event_payload" JSONB NOT NULL DEFAULT '{}',
    "response_status" INTEGER,
    "response_body" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhook_id_delivered_at_idx" ON "webhook_deliveries"("webhook_id", "delivered_at" DESC);

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
