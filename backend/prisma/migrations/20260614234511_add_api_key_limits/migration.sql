-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "max_requests" INTEGER,
ADD COLUMN     "request_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "max_api_keys" INTEGER NOT NULL DEFAULT 10;
