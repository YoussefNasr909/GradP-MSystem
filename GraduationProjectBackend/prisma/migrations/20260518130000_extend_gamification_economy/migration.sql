-- AlterEnum
ALTER TYPE "CoinTransactionSourceType" ADD VALUE IF NOT EXISTS 'XP_AWARD';

-- AlterTable
ALTER TABLE "RewardPurchase" ADD COLUMN IF NOT EXISTS "isEquipped" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RewardPurchase" ADD COLUMN IF NOT EXISTS "equippedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RewardPurchase_userId_isEquipped_idx" ON "RewardPurchase"("userId", "isEquipped");
