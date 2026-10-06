-- CreateTable
CREATE TABLE "form_definitions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "formSchema" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submissions" (
    "id" TEXT NOT NULL,
    "form_definition_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "submitted_by" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "geolocation" JSONB,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_submissions_form_definition_id_org_id_idx" ON "form_submissions"("form_definition_id", "org_id");

-- CreateIndex
CREATE INDEX "form_submissions_org_id_submitted_at_idx" ON "form_submissions"("org_id", "submitted_at" DESC);

-- CreateIndex
CREATE INDEX "form_submissions_data_idx" ON "form_submissions" USING GIN ("data");

-- AddForeignKey
ALTER TABLE "form_definitions" ADD CONSTRAINT "form_definitions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_definition_id_fkey" FOREIGN KEY ("form_definition_id") REFERENCES "form_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
