-- CreateTable
CREATE TABLE "ip_whitelist" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "cidr" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    CONSTRAINT "ip_whitelist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ip_whitelist_org_id_ip_address_key" ON "ip_whitelist"("org_id", "ip_address");

-- AddForeignKey
ALTER TABLE "ip_whitelist" ADD CONSTRAINT "ip_whitelist_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
