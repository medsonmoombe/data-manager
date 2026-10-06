-- CreateTable
CREATE TABLE "marketplace_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'template',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "includes" JSONB NOT NULL DEFAULT '[]',
    "installPayload" JSONB NOT NULL DEFAULT '{}',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "publisher_org_id" TEXT,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_installations" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "installed_entities" JSONB NOT NULL DEFAULT '[]',
    "installed_forms" JSONB NOT NULL DEFAULT '[]',
    "installed_workflows" JSONB NOT NULL DEFAULT '[]',
    "installed_dashboards" JSONB NOT NULL DEFAULT '[]',
    "installed_rules" JSONB NOT NULL DEFAULT '[]',
    "customizations" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "installed_by" TEXT,
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_installations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "template_installations_org_id_template_id_key" ON "template_installations"("org_id", "template_id");

-- AddForeignKey
ALTER TABLE "marketplace_templates" ADD CONSTRAINT "marketplace_templates_publisher_org_id_fkey" FOREIGN KEY ("publisher_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_installations" ADD CONSTRAINT "template_installations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "marketplace_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_installations" ADD CONSTRAINT "template_installations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
