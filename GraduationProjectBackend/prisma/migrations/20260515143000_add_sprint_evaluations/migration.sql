-- Sprint evaluations let TAs record detailed sprint feedback and doctors
-- review/finalize that feedback without changing the sprint planning workflow.
CREATE TYPE "SprintEvaluationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'NEEDS_CHANGES');

CREATE TYPE "SprintEvaluationEvaluatorRole" AS ENUM ('TA', 'DOCTOR');

CREATE TABLE "SprintEvaluation" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "evaluatorUserId" TEXT NOT NULL,
    "evaluatorRole" "SprintEvaluationEvaluatorRole" NOT NULL,
    "status" "SprintEvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "score" INTEGER,
    "feedback" TEXT,
    "planningQuality" INTEGER,
    "taskCompletion" INTEGER,
    "progressConsistency" INTEGER,
    "teamCollaboration" INTEGER,
    "deadlineCommitment" INTEGER,
    "earlyEvaluation" BOOLEAN NOT NULL DEFAULT false,
    "evaluatedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SprintEvaluation_sprintId_evaluatorUserId_evaluatorRole_key" ON "SprintEvaluation"("sprintId", "evaluatorUserId", "evaluatorRole");
CREATE INDEX "SprintEvaluation_sprintId_status_idx" ON "SprintEvaluation"("sprintId", "status");
CREATE INDEX "SprintEvaluation_evaluatorUserId_idx" ON "SprintEvaluation"("evaluatorUserId");
CREATE INDEX "SprintEvaluation_reviewedByUserId_idx" ON "SprintEvaluation"("reviewedByUserId");

ALTER TABLE "SprintEvaluation" ADD CONSTRAINT "SprintEvaluation_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SprintEvaluation" ADD CONSTRAINT "SprintEvaluation_evaluatorUserId_fkey" FOREIGN KEY ("evaluatorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SprintEvaluation" ADD CONSTRAINT "SprintEvaluation_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
