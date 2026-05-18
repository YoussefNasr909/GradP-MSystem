CREATE TYPE "WeeklyReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED');

ALTER TABLE "WeeklyReport"
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "status" "WeeklyReportStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "reviewComment" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

UPDATE "WeeklyReport"
SET "status" = CASE
  WHEN "isSubmitted" = true THEN 'SUBMITTED'::"WeeklyReportStatus"
  ELSE 'DRAFT'::"WeeklyReportStatus"
END;

CREATE INDEX "WeeklyReport_teamId_status_idx" ON "WeeklyReport"("teamId", "status");
CREATE INDEX "WeeklyReport_reviewedById_idx" ON "WeeklyReport"("reviewedById");

ALTER TABLE "WeeklyReport"
  ADD CONSTRAINT "WeeklyReport_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
