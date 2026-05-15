-- CreateEnum
CREATE TYPE "GamificationEventType" AS ENUM ('TASK_APPROVED', 'TASK_REOPENED', 'SUBMISSION_APPROVED', 'SUBMISSION_GRADE_UPDATED', 'TEAM_STAGE_ADVANCED', 'WEEKLY_REPORT_APPROVED', 'GITHUB_PR_MERGED', 'GITHUB_PR_REVIEWED', 'GITHUB_RELEASE_CREATED', 'MANUAL_XP_ADJUSTMENT_APPROVED', 'BADGE_UNLOCKED');

-- CreateEnum
CREATE TYPE "GamificationEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "XpRecipientType" AS ENUM ('USER', 'TEAM');

-- CreateEnum
CREATE TYPE "XpTransactionStatus" AS ENUM ('PENDING', 'AWARDED', 'FROZEN', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "XpTransactionDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "GamificationActorType" AS ENUM ('SYSTEM', 'USER');

-- CreateEnum
CREATE TYPE "BadgeRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "BadgeTargetType" AS ENUM ('USER', 'TEAM');

-- CreateEnum
CREATE TYPE "LeaderboardScopeType" AS ENUM ('GLOBAL', 'SUPERVISOR', 'TEAM', 'TRACK', 'DEPARTMENT');

-- CreateEnum
CREATE TYPE "LeaderboardType" AS ENUM ('INDIVIDUAL_WEEKLY', 'INDIVIDUAL_SEMESTER', 'INDIVIDUAL_LIFETIME', 'TEAM_WEEKLY', 'TEAM_SEMESTER');

-- CreateEnum
CREATE TYPE "SuspiciousActivityStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ESCALATED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "XpAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GamificationAuditAction" AS ENUM ('RULE_CREATED', 'RULE_UPDATED', 'EVENT_EMITTED', 'EVENT_PROCESSED', 'TRANSACTION_CREATED', 'TRANSACTION_FROZEN', 'TRANSACTION_REVERSED', 'CASE_RESOLVED', 'ADJUSTMENT_REQUESTED', 'ADJUSTMENT_APPROVED', 'ADJUSTMENT_REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'XP_AWARDED';
ALTER TYPE "NotificationType" ADD VALUE 'XP_FROZEN';
ALTER TYPE "NotificationType" ADD VALUE 'XP_REVERSED';
ALTER TYPE "NotificationType" ADD VALUE 'BADGE_UNLOCKED';
ALTER TYPE "NotificationType" ADD VALUE 'XP_ADJUSTMENT_REVIEWED';

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "contentFingerprint" TEXT,
ADD COLUMN     "fileHash" TEXT,
ADD COLUMN     "normalizedTextHash" TEXT;

-- CreateTable
CREATE TABLE "GamificationRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "eventType" "GamificationEventType" NOT NULL,
    "targetType" "XpRecipientType" NOT NULL,
    "baseXp" INTEGER NOT NULL,
    "conditions" JSONB,
    "multipliers" JSONB,
    "caps" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamificationEvent" (
    "id" TEXT NOT NULL,
    "eventType" "GamificationEventType" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "teamId" TEXT,
    "actorUserId" TEXT,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "status" "GamificationEventStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpTransaction" (
    "id" TEXT NOT NULL,
    "recipientType" "XpRecipientType" NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "amount" INTEGER NOT NULL,
    "direction" "XpTransactionDirection" NOT NULL,
    "status" "XpTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "ruleCode" TEXT,
    "ruleVersion" INTEGER,
    "baseXp" INTEGER,
    "qualityMultiplier" DOUBLE PRECISION,
    "timelinessMultiplier" DOUBLE PRECISION,
    "evidenceMultiplier" DOUBLE PRECISION,
    "difficultyMultiplier" DOUBLE PRECISION,
    "createdByType" "GamificationActorType" NOT NULL DEFAULT 'SYSTEM',
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reversalOfTransactionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XpTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserXpBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lifetimeXp" INTEGER NOT NULL DEFAULT 0,
    "semesterXp" INTEGER NOT NULL DEFAULT 0,
    "monthlyXp" INTEGER NOT NULL DEFAULT 0,
    "weeklyXp" INTEGER NOT NULL DEFAULT 0,
    "pendingXp" INTEGER NOT NULL DEFAULT 0,
    "frozenXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "qualityScore" DOUBLE PRECISION,
    "lastRecalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserXpBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamXpBalance" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "lifetimeTeamXp" INTEGER NOT NULL DEFAULT 0,
    "semesterTeamXp" INTEGER NOT NULL DEFAULT 0,
    "monthlyTeamXp" INTEGER NOT NULL DEFAULT 0,
    "weeklyTeamXp" INTEGER NOT NULL DEFAULT 0,
    "pendingTeamXp" INTEGER NOT NULL DEFAULT 0,
    "frozenTeamXp" INTEGER NOT NULL DEFAULT 0,
    "teamHealthScore" DOUBLE PRECISION,
    "leaderboardScore" DOUBLE PRECISION,
    "lastRecalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamXpBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "rarity" "BadgeRarity" NOT NULL DEFAULT 'COMMON',
    "targetType" "BadgeTargetType" NOT NULL DEFAULT 'USER',
    "level" INTEGER NOT NULL DEFAULT 1,
    "criteria" JSONB,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isSeasonal" BOOLEAN NOT NULL DEFAULT false,
    "activeFrom" TIMESTAMP(3),
    "activeTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BadgeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeDefinitionId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3),
    "progress" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamBadge" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "badgeDefinitionId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3),
    "progress" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardSnapshot" (
    "id" TEXT NOT NULL,
    "scopeType" "LeaderboardScopeType" NOT NULL,
    "scopeId" TEXT,
    "leaderboardType" "LeaderboardType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "rank" INTEGER NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "breakdown" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubContribution" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "githubEventType" TEXT NOT NULL,
    "githubNodeId" TEXT,
    "githubUrl" TEXT,
    "userId" TEXT,
    "teamId" TEXT,
    "taskId" TEXT,
    "pullRequestNumber" INTEGER,
    "issueNumber" INTEGER,
    "commitSha" TEXT,
    "diffStats" JSONB,
    "qualitySignals" JSONB,
    "isRewardable" BOOLEAN NOT NULL DEFAULT true,
    "suspicionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payloadHash" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuspiciousActivityCase" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "eventId" TEXT,
    "transactionId" TEXT,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "SuspiciousActivityStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "signals" JSONB,
    "assignedReviewerId" TEXT,
    "resolution" TEXT,
    "studentVisibleReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SuspiciousActivityCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpAdjustmentRequest" (
    "id" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetTeamId" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceReference" TEXT,
    "status" "XpAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "approvedByUserId" TEXT,
    "createdEventId" TEXT,
    "createdTransactionId" TEXT,
    "reviewComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "XpAdjustmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamificationAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "GamificationAuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamificationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GamificationRule_eventType_isActive_idx" ON "GamificationRule"("eventType", "isActive");

-- CreateIndex
CREATE INDEX "GamificationRule_code_isActive_idx" ON "GamificationRule"("code", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "GamificationRule_code_version_key" ON "GamificationRule"("code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "GamificationEvent_idempotencyKey_key" ON "GamificationEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "GamificationEvent_status_createdAt_idx" ON "GamificationEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GamificationEvent_eventType_occurredAt_idx" ON "GamificationEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "GamificationEvent_sourceType_sourceId_idx" ON "GamificationEvent"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "GamificationEvent_teamId_occurredAt_idx" ON "GamificationEvent"("teamId", "occurredAt");

-- CreateIndex
CREATE INDEX "GamificationEvent_actorUserId_occurredAt_idx" ON "GamificationEvent"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "XpTransaction_userId_status_createdAt_idx" ON "XpTransaction"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "XpTransaction_teamId_status_createdAt_idx" ON "XpTransaction"("teamId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "XpTransaction_eventId_idx" ON "XpTransaction"("eventId");

-- CreateIndex
CREATE INDEX "XpTransaction_sourceType_sourceId_idx" ON "XpTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "XpTransaction_ruleCode_ruleVersion_idx" ON "XpTransaction"("ruleCode", "ruleVersion");

-- CreateIndex
CREATE INDEX "XpTransaction_reversalOfTransactionId_idx" ON "XpTransaction"("reversalOfTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserXpBalance_userId_key" ON "UserXpBalance"("userId");

-- CreateIndex
CREATE INDEX "UserXpBalance_weeklyXp_idx" ON "UserXpBalance"("weeklyXp");

-- CreateIndex
CREATE INDEX "UserXpBalance_semesterXp_idx" ON "UserXpBalance"("semesterXp");

-- CreateIndex
CREATE INDEX "UserXpBalance_level_idx" ON "UserXpBalance"("level");

-- CreateIndex
CREATE UNIQUE INDEX "TeamXpBalance_teamId_key" ON "TeamXpBalance"("teamId");

-- CreateIndex
CREATE INDEX "TeamXpBalance_weeklyTeamXp_idx" ON "TeamXpBalance"("weeklyTeamXp");

-- CreateIndex
CREATE INDEX "TeamXpBalance_semesterTeamXp_idx" ON "TeamXpBalance"("semesterTeamXp");

-- CreateIndex
CREATE INDEX "TeamXpBalance_leaderboardScore_idx" ON "TeamXpBalance"("leaderboardScore");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeDefinition_code_key" ON "BadgeDefinition"("code");

-- CreateIndex
CREATE INDEX "BadgeDefinition_targetType_isActive_idx" ON "BadgeDefinition"("targetType", "isActive");

-- CreateIndex
CREATE INDEX "BadgeDefinition_category_rarity_idx" ON "BadgeDefinition"("category", "rarity");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_createdTransactionId_key" ON "UserBadge"("createdTransactionId");

-- CreateIndex
CREATE INDEX "UserBadge_userId_unlockedAt_idx" ON "UserBadge"("userId", "unlockedAt");

-- CreateIndex
CREATE INDEX "UserBadge_badgeDefinitionId_idx" ON "UserBadge"("badgeDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeDefinitionId_key" ON "UserBadge"("userId", "badgeDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamBadge_createdTransactionId_key" ON "TeamBadge"("createdTransactionId");

-- CreateIndex
CREATE INDEX "TeamBadge_teamId_unlockedAt_idx" ON "TeamBadge"("teamId", "unlockedAt");

-- CreateIndex
CREATE INDEX "TeamBadge_badgeDefinitionId_idx" ON "TeamBadge"("badgeDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamBadge_teamId_badgeDefinitionId_key" ON "TeamBadge"("teamId", "badgeDefinitionId");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_leaderboardType_scopeType_scopeId_perio_idx" ON "LeaderboardSnapshot"("leaderboardType", "scopeType", "scopeId", "periodStart", "periodEnd", "rank");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_userId_leaderboardType_generatedAt_idx" ON "LeaderboardSnapshot"("userId", "leaderboardType", "generatedAt");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_teamId_leaderboardType_generatedAt_idx" ON "LeaderboardSnapshot"("teamId", "leaderboardType", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardSnapshot_leaderboardType_scopeType_scopeId_perio_key" ON "LeaderboardSnapshot"("leaderboardType", "scopeType", "scopeId", "periodStart", "periodEnd", "userId", "teamId");

-- CreateIndex
CREATE INDEX "GitHubContribution_teamId_occurredAt_idx" ON "GitHubContribution"("teamId", "occurredAt");

-- CreateIndex
CREATE INDEX "GitHubContribution_userId_occurredAt_idx" ON "GitHubContribution"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "GitHubContribution_taskId_idx" ON "GitHubContribution"("taskId");

-- CreateIndex
CREATE INDEX "GitHubContribution_isRewardable_suspicionScore_idx" ON "GitHubContribution"("isRewardable", "suspicionScore");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubContribution_repositoryId_githubEventType_githubNodeI_key" ON "GitHubContribution"("repositoryId", "githubEventType", "githubNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "SuspiciousActivityCase_transactionId_key" ON "SuspiciousActivityCase"("transactionId");

-- CreateIndex
CREATE INDEX "SuspiciousActivityCase_status_createdAt_idx" ON "SuspiciousActivityCase"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SuspiciousActivityCase_teamId_status_idx" ON "SuspiciousActivityCase"("teamId", "status");

-- CreateIndex
CREATE INDEX "SuspiciousActivityCase_userId_status_idx" ON "SuspiciousActivityCase"("userId", "status");

-- CreateIndex
CREATE INDEX "SuspiciousActivityCase_assignedReviewerId_status_idx" ON "SuspiciousActivityCase"("assignedReviewerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "XpAdjustmentRequest_createdEventId_key" ON "XpAdjustmentRequest"("createdEventId");

-- CreateIndex
CREATE UNIQUE INDEX "XpAdjustmentRequest_createdTransactionId_key" ON "XpAdjustmentRequest"("createdTransactionId");

-- CreateIndex
CREATE INDEX "XpAdjustmentRequest_status_createdAt_idx" ON "XpAdjustmentRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "XpAdjustmentRequest_requestedByUserId_createdAt_idx" ON "XpAdjustmentRequest"("requestedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "XpAdjustmentRequest_targetUserId_createdAt_idx" ON "XpAdjustmentRequest"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "XpAdjustmentRequest_targetTeamId_createdAt_idx" ON "XpAdjustmentRequest"("targetTeamId", "createdAt");

-- CreateIndex
CREATE INDEX "XpAdjustmentRequest_approvedByUserId_reviewedAt_idx" ON "XpAdjustmentRequest"("approvedByUserId", "reviewedAt");

-- CreateIndex
CREATE INDEX "GamificationAuditLog_actorUserId_createdAt_idx" ON "GamificationAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "GamificationAuditLog_targetType_targetId_idx" ON "GamificationAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "GamificationAuditLog_action_createdAt_idx" ON "GamificationAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "Submission_fileHash_idx" ON "Submission"("fileHash");

-- CreateIndex
CREATE INDEX "Submission_normalizedTextHash_idx" ON "Submission"("normalizedTextHash");

-- CreateIndex
CREATE INDEX "Submission_teamId_deliverableType_version_idx" ON "Submission"("teamId", "deliverableType", "version");

-- AddForeignKey
ALTER TABLE "GamificationRule" ADD CONSTRAINT "GamificationRule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamificationEvent" ADD CONSTRAINT "GamificationEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamificationEvent" ADD CONSTRAINT "GamificationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GamificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_reversalOfTransactionId_fkey" FOREIGN KEY ("reversalOfTransactionId") REFERENCES "XpTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserXpBalance" ADD CONSTRAINT "UserXpBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamXpBalance" ADD CONSTRAINT "TeamXpBalance_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeDefinitionId_fkey" FOREIGN KEY ("badgeDefinitionId") REFERENCES "BadgeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_createdTransactionId_fkey" FOREIGN KEY ("createdTransactionId") REFERENCES "XpTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamBadge" ADD CONSTRAINT "TeamBadge_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamBadge" ADD CONSTRAINT "TeamBadge_badgeDefinitionId_fkey" FOREIGN KEY ("badgeDefinitionId") REFERENCES "BadgeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamBadge" ADD CONSTRAINT "TeamBadge_createdTransactionId_fkey" FOREIGN KEY ("createdTransactionId") REFERENCES "XpTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardSnapshot" ADD CONSTRAINT "LeaderboardSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardSnapshot" ADD CONSTRAINT "LeaderboardSnapshot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubContribution" ADD CONSTRAINT "GitHubContribution_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GitHubTeamRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubContribution" ADD CONSTRAINT "GitHubContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubContribution" ADD CONSTRAINT "GitHubContribution_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubContribution" ADD CONSTRAINT "GitHubContribution_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspiciousActivityCase" ADD CONSTRAINT "SuspiciousActivityCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspiciousActivityCase" ADD CONSTRAINT "SuspiciousActivityCase_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspiciousActivityCase" ADD CONSTRAINT "SuspiciousActivityCase_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GamificationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspiciousActivityCase" ADD CONSTRAINT "SuspiciousActivityCase_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "XpTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspiciousActivityCase" ADD CONSTRAINT "SuspiciousActivityCase_assignedReviewerId_fkey" FOREIGN KEY ("assignedReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpAdjustmentRequest" ADD CONSTRAINT "XpAdjustmentRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpAdjustmentRequest" ADD CONSTRAINT "XpAdjustmentRequest_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpAdjustmentRequest" ADD CONSTRAINT "XpAdjustmentRequest_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpAdjustmentRequest" ADD CONSTRAINT "XpAdjustmentRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpAdjustmentRequest" ADD CONSTRAINT "XpAdjustmentRequest_createdEventId_fkey" FOREIGN KEY ("createdEventId") REFERENCES "GamificationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpAdjustmentRequest" ADD CONSTRAINT "XpAdjustmentRequest_createdTransactionId_fkey" FOREIGN KEY ("createdTransactionId") REFERENCES "XpTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamificationAuditLog" ADD CONSTRAINT "GamificationAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
