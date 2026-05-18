-- CreateEnum
CREATE TYPE "CoinTransactionDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "CoinTransactionStatus" AS ENUM ('POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "CoinTransactionSourceType" AS ENUM ('QUEST', 'REWARD_PURCHASE', 'MANUAL', 'SEED');

-- CreateEnum
CREATE TYPE "QuestType" AS ENUM ('DAILY', 'WEEKLY', 'MILESTONE');

-- CreateEnum
CREATE TYPE "QuestMetric" AS ENUM ('XP_EARNED', 'TASKS_DONE', 'SUBMISSIONS_APPROVED', 'PRS_MERGED', 'REVIEWS_GIVEN', 'SPRINTS_COMPLETED', 'WEEKLY_REPORTS_APPROVED', 'LOGIN_STREAK');

-- CreateEnum
CREATE TYPE "RewardItemType" AS ENUM ('AVATAR_FRAME', 'PROFILE_THEME', 'TITLE', 'BADGE_SKIN');

-- CreateEnum
CREATE TYPE "RewardItemStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RewardRedemptionStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "UserCoinBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimeSpent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCoinBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinTransaction" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "direction" "CoinTransactionDirection" NOT NULL,
    "status" "CoinTransactionStatus" NOT NULL DEFAULT 'POSTED',
    "sourceType" "CoinTransactionSourceType" NOT NULL,
    "sourceId" TEXT,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "QuestType" NOT NULL,
    "metric" "QuestMetric" NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "coinReward" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuestProgress" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "windowKey" TEXT NOT NULL DEFAULT 'lifetime',
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "coinTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserQuestProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "RewardItemType" NOT NULL,
    "cost" INTEGER NOT NULL,
    "status" "RewardItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "inventory" INTEGER,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardItemId" TEXT NOT NULL,
    "coinTransactionId" TEXT NOT NULL,
    "status" "RewardRedemptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCoinBalance_userId_key" ON "UserCoinBalance"("userId");

-- CreateIndex
CREATE INDEX "UserCoinBalance_balance_idx" ON "UserCoinBalance"("balance");

-- CreateIndex
CREATE UNIQUE INDEX "CoinTransaction_idempotencyKey_key" ON "CoinTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CoinTransaction_userId_createdAt_idx" ON "CoinTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CoinTransaction_sourceType_sourceId_idx" ON "CoinTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "CoinTransaction_status_createdAt_idx" ON "CoinTransaction"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quest_code_key" ON "Quest"("code");

-- CreateIndex
CREATE INDEX "Quest_isActive_type_idx" ON "Quest"("isActive", "type");

-- CreateIndex
CREATE INDEX "Quest_metric_idx" ON "Quest"("metric");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuestProgress_coinTransactionId_key" ON "UserQuestProgress"("coinTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuestProgress_questId_userId_windowKey_key" ON "UserQuestProgress"("questId", "userId", "windowKey");

-- CreateIndex
CREATE INDEX "UserQuestProgress_userId_completedAt_idx" ON "UserQuestProgress"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "UserQuestProgress_userId_claimedAt_idx" ON "UserQuestProgress"("userId", "claimedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardItem_code_key" ON "RewardItem"("code");

-- CreateIndex
CREATE INDEX "RewardItem_status_type_idx" ON "RewardItem"("status", "type");

-- CreateIndex
CREATE INDEX "RewardItem_cost_idx" ON "RewardItem"("cost");

-- CreateIndex
CREATE UNIQUE INDEX "RewardPurchase_coinTransactionId_key" ON "RewardPurchase"("coinTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardPurchase_userId_rewardItemId_key" ON "RewardPurchase"("userId", "rewardItemId");

-- CreateIndex
CREATE INDEX "RewardPurchase_userId_createdAt_idx" ON "RewardPurchase"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardPurchase_rewardItemId_status_idx" ON "RewardPurchase"("rewardItemId", "status");

-- AddForeignKey
ALTER TABLE "UserCoinBalance" ADD CONSTRAINT "UserCoinBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestProgress" ADD CONSTRAINT "UserQuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestProgress" ADD CONSTRAINT "UserQuestProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestProgress" ADD CONSTRAINT "UserQuestProgress_coinTransactionId_fkey" FOREIGN KEY ("coinTransactionId") REFERENCES "CoinTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardPurchase" ADD CONSTRAINT "RewardPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardPurchase" ADD CONSTRAINT "RewardPurchase_rewardItemId_fkey" FOREIGN KEY ("rewardItemId") REFERENCES "RewardItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardPurchase" ADD CONSTRAINT "RewardPurchase_coinTransactionId_fkey" FOREIGN KEY ("coinTransactionId") REFERENCES "CoinTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
