-- AlterTable
ALTER TABLE "dashboard_widgets" ADD COLUMN     "alert_thresholds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "last_alerted_at" TIMESTAMP(3);
