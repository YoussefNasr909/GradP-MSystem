-- CreateEnum
CREATE TYPE "SprintStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');

-- DropForeignKey
ALTER TABLE "DirectChatConversation" DROP CONSTRAINT "DirectChatConversation_userOneId_fkey";

-- DropForeignKey
ALTER TABLE "DirectChatConversation" DROP CONSTRAINT "DirectChatConversation_userTwoId_fkey";

-- DropForeignKey
ALTER TABLE "DirectChatMessage" DROP CONSTRAINT "DirectChatMessage_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "DirectChatMessage" DROP CONSTRAINT "DirectChatMessage_deletedById_fkey";

-- DropForeignKey
ALTER TABLE "DirectChatMessage" DROP CONSTRAINT "DirectChatMessage_recipientId_fkey";

-- DropForeignKey
ALTER TABLE "DirectChatMessage" DROP CONSTRAINT "DirectChatMessage_senderId_fkey";

-- DropForeignKey
ALTER TABLE "TeamGroupConversation" DROP CONSTRAINT "TeamGroupConversation_teamId_fkey";

-- DropForeignKey
ALTER TABLE "TeamGroupConversationParticipant" DROP CONSTRAINT "TeamGroupConversationParticipant_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "TeamGroupConversationParticipant" DROP CONSTRAINT "TeamGroupConversationParticipant_userId_fkey";

-- DropForeignKey
ALTER TABLE "TeamGroupMessage" DROP CONSTRAINT "TeamGroupMessage_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "TeamGroupMessage" DROP CONSTRAINT "TeamGroupMessage_senderId_fkey";

-- AlterTable
ALTER TABLE "DirectChatConversation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DirectChatMessage" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "actualPoints" INTEGER,
ADD COLUMN     "sprintId" TEXT,
ADD COLUMN     "storyPoints" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "unplanned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TeamGroupConversation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TeamGroupMessage" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SprintStatus" NOT NULL DEFAULT 'PLANNED',
    "completedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sprint_teamId_status_idx" ON "Sprint"("teamId", "status");

-- CreateIndex
CREATE INDEX "Sprint_teamId_startDate_endDate_idx" ON "Sprint"("teamId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Sprint_createdByUserId_idx" ON "Sprint"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Sprint_teamId_name_key" ON "Sprint"("teamId", "name");

-- CreateIndex
CREATE INDEX "Task_teamId_sprintId_idx" ON "Task"("teamId", "sprintId");

-- CreateIndex
CREATE INDEX "Task_sprintId_status_idx" ON "Task"("sprintId", "status");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamGroupConversation" ADD CONSTRAINT "TeamGroupConversation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamGroupConversationParticipant" ADD CONSTRAINT "TeamGroupConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "TeamGroupConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamGroupConversationParticipant" ADD CONSTRAINT "TeamGroupConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamGroupMessage" ADD CONSTRAINT "TeamGroupMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "TeamGroupConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamGroupMessage" ADD CONSTRAINT "TeamGroupMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectChatConversation" ADD CONSTRAINT "DirectChatConversation_userOneId_fkey" FOREIGN KEY ("userOneId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectChatConversation" ADD CONSTRAINT "DirectChatConversation_userTwoId_fkey" FOREIGN KEY ("userTwoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectChatMessage" ADD CONSTRAINT "DirectChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectChatMessage" ADD CONSTRAINT "DirectChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectChatMessage" ADD CONSTRAINT "DirectChatMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectChatMessage" ADD CONSTRAINT "DirectChatMessage_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
