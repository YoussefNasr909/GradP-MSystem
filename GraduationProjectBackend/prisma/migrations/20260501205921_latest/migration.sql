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
ALTER TABLE "TeamGroupConversation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TeamGroupMessage" ALTER COLUMN "updatedAt" DROP DEFAULT;

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
