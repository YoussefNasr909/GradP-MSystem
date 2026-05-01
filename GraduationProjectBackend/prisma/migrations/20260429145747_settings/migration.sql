-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE', 'OUTLOOK');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('PENDING_APPROVAL', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MeetingMode" AS ENUM ('VIRTUAL', 'IN_PERSON', 'HYBRID');

-- CreateEnum
CREATE TYPE "MeetingProvider" AS ENUM ('GOOGLE_MEET', 'MICROSOFT_TEAMS', 'MANUAL');

-- CreateEnum
CREATE TYPE "MeetingParticipantRole" AS ENUM ('ORGANIZER', 'LEADER', 'DOCTOR', 'TA', 'MEMBER', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "MeetingResponseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE');

-- CreateEnum
CREATE TYPE "MeetingApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'PROPOSED_NEW_TIME');

-- CreateEnum
CREATE TYPE "ExternalSyncStatus" AS ENUM ('NOT_CONNECTED', 'PENDING', 'SYNCED', 'ERROR', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "organizerRole" "Role" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "agenda" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Cairo',
    "mode" "MeetingMode" NOT NULL DEFAULT 'VIRTUAL',
    "status" "MeetingStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "provider" "MeetingProvider" NOT NULL DEFAULT 'MANUAL',
    "location" TEXT,
    "joinUrl" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalRequestedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "externalProvider" "CalendarProvider",
    "externalCalendarId" TEXT,
    "externalEventId" TEXT,
    "externalSyncStatus" "ExternalSyncStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "externalSyncError" TEXT,
    "externalSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingParticipant" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "displayName" TEXT,
    "participantRole" "MeetingParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "responseStatus" "MeetingResponseStatus" NOT NULL DEFAULT 'PENDING',
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "isExternalGuest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingApproval" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "approverRole" "Role" NOT NULL,
    "status" "MeetingApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "proposedStartAt" TIMESTAMP(3),
    "proposedEndAt" TIMESTAMP(3),
    "note" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "externalCalendarId" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" "ExternalSyncStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Meeting_teamId_startAt_idx" ON "Meeting"("teamId", "startAt");

-- CreateIndex
CREATE INDEX "Meeting_organizerId_startAt_idx" ON "Meeting"("organizerId", "startAt");

-- CreateIndex
CREATE INDEX "Meeting_status_startAt_idx" ON "Meeting"("status", "startAt");

-- CreateIndex
CREATE INDEX "MeetingParticipant_meetingId_idx" ON "MeetingParticipant"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingParticipant_userId_idx" ON "MeetingParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingParticipant_meetingId_userId_key" ON "MeetingParticipant"("meetingId", "userId");

-- CreateIndex
CREATE INDEX "MeetingApproval_meetingId_idx" ON "MeetingApproval"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingApproval_approverUserId_status_idx" ON "MeetingApproval"("approverUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingApproval_meetingId_approverUserId_key" ON "MeetingApproval"("meetingId", "approverUserId");

-- CreateIndex
CREATE INDEX "CalendarIntegration_provider_syncEnabled_idx" ON "CalendarIntegration"("provider", "syncEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarIntegration_userId_provider_key" ON "CalendarIntegration"("userId", "provider");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingApproval" ADD CONSTRAINT "MeetingApproval_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingApproval" ADD CONSTRAINT "MeetingApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarIntegration" ADD CONSTRAINT "CalendarIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
