-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "keycloak_user_id" TEXT,
    "invited_by" TEXT NOT NULL,
    "role_id" TEXT,
    "temp_password" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_org_id_email_key" ON "invitations"("org_id", "email");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
