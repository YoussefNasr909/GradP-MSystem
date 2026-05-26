-- Add SLA, tagging, and saved reply support for the helpdesk workspace.
ALTER TABLE "SupportTicket"
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "firstResponseDueAt" TIMESTAMP(3),
ADD COLUMN "nextResponseDueAt" TIMESTAMP(3),
ADD COLUMN "firstSupportResponseAt" TIMESTAMP(3),
ADD COLUMN "snoozedUntil" TIMESTAMP(3);

CREATE TABLE "SupportSavedReply" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "category" "SupportTicketCategory",
  "createdByUserId" TEXT NOT NULL,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportSavedReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicket_nextResponseDueAt_idx" ON "SupportTicket"("nextResponseDueAt");
CREATE INDEX "SupportTicket_firstResponseDueAt_idx" ON "SupportTicket"("firstResponseDueAt");
CREATE INDEX "SupportTicket_tags_idx" ON "SupportTicket" USING GIN ("tags");
CREATE INDEX "SupportSavedReply_isActive_category_idx" ON "SupportSavedReply"("isActive", "category");
CREATE INDEX "SupportSavedReply_createdByUserId_createdAt_idx" ON "SupportSavedReply"("createdByUserId", "createdAt");

ALTER TABLE "SupportSavedReply"
ADD CONSTRAINT "SupportSavedReply_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
