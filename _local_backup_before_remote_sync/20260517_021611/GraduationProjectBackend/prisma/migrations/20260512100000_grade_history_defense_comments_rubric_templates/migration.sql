-- AlterTable: add gradeHistory and defenseMeetingId to Submission
ALTER TABLE "Submission"
  ADD COLUMN "gradeHistory" JSONB,
  ADD COLUMN "defenseMeetingId" TEXT;

-- CreateIndex: unique constraint on defenseMeetingId (one defense per submission)
CREATE UNIQUE INDEX "Submission_defenseMeetingId_key" ON "Submission"("defenseMeetingId");

-- AddForeignKey: link Submission.defenseMeetingId -> Meeting.id
ALTER TABLE "Submission"
  ADD CONSTRAINT "Submission_defenseMeetingId_fkey"
  FOREIGN KEY ("defenseMeetingId") REFERENCES "Meeting"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: SubmissionComment
CREATE TABLE "SubmissionComment" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorRole" "Role" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmissionComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubmissionComment_submissionId_createdAt_idx" ON "SubmissionComment"("submissionId", "createdAt");
CREATE INDEX "SubmissionComment_authorUserId_idx" ON "SubmissionComment"("authorUserId");

ALTER TABLE "SubmissionComment"
  ADD CONSTRAINT "SubmissionComment_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "Submission"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubmissionComment"
  ADD CONSTRAINT "SubmissionComment_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: TeamRubricTemplate
CREATE TABLE "TeamRubricTemplate" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "deliverableType" "DeliverableType" NOT NULL,
    "rubric" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamRubricTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamRubricTemplate_teamId_deliverableType_key" ON "TeamRubricTemplate"("teamId", "deliverableType");
CREATE INDEX "TeamRubricTemplate_teamId_idx" ON "TeamRubricTemplate"("teamId");

ALTER TABLE "TeamRubricTemplate"
  ADD CONSTRAINT "TeamRubricTemplate_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamRubricTemplate"
  ADD CONSTRAINT "TeamRubricTemplate_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
