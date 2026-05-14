-- CreateEnum
CREATE TYPE "TaskSubmissionEvidenceType" AS ENUM ('FILE', 'LINK');

-- CreateTable
CREATE TABLE "TaskSubmissionEvidence" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "type" "TaskSubmissionEvidenceType" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fileType" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSubmissionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskSubmissionEvidence_taskId_submittedAt_idx" ON "TaskSubmissionEvidence"("taskId", "submittedAt");

-- CreateIndex
CREATE INDEX "TaskSubmissionEvidence_teamId_createdAt_idx" ON "TaskSubmissionEvidence"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskSubmissionEvidence_uploadedByUserId_idx" ON "TaskSubmissionEvidence"("uploadedByUserId");

-- AddForeignKey
ALTER TABLE "TaskSubmissionEvidence" ADD CONSTRAINT "TaskSubmissionEvidence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmissionEvidence" ADD CONSTRAINT "TaskSubmissionEvidence_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmissionEvidence" ADD CONSTRAINT "TaskSubmissionEvidence_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
