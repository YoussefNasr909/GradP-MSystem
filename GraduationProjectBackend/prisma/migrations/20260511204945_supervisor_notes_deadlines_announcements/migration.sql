-- CreateTable
CREATE TABLE "TeamSupervisorNote" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorRole" "Role" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamSupervisorNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamDeliverableDeadline" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "deliverableType" "DeliverableType" NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "setByUserId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamDeliverableDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorRole" "Role" NOT NULL,
    "teamId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamSupervisorNote_teamId_createdAt_idx" ON "TeamSupervisorNote"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamSupervisorNote_authorUserId_idx" ON "TeamSupervisorNote"("authorUserId");

-- CreateIndex
CREATE INDEX "TeamDeliverableDeadline_dueDate_idx" ON "TeamDeliverableDeadline"("dueDate");

-- CreateIndex
CREATE INDEX "TeamDeliverableDeadline_teamId_idx" ON "TeamDeliverableDeadline"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamDeliverableDeadline_teamId_deliverableType_key" ON "TeamDeliverableDeadline"("teamId", "deliverableType");

-- CreateIndex
CREATE INDEX "Announcement_authorUserId_createdAt_idx" ON "Announcement"("authorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_teamId_createdAt_idx" ON "Announcement"("teamId", "createdAt");

-- AddForeignKey
ALTER TABLE "TeamSupervisorNote" ADD CONSTRAINT "TeamSupervisorNote_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSupervisorNote" ADD CONSTRAINT "TeamSupervisorNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamDeliverableDeadline" ADD CONSTRAINT "TeamDeliverableDeadline_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamDeliverableDeadline" ADD CONSTRAINT "TeamDeliverableDeadline_setByUserId_fkey" FOREIGN KEY ("setByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
