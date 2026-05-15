-- CreateTable
CREATE TABLE "AnnouncementTargetTeam" (
    "announcementId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementTargetTeam_pkey" PRIMARY KEY ("announcementId","teamId")
);

-- Backfill existing announcement visibility into explicit target teams.
-- Specific-team announcements target that team. Legacy broadcast announcements
-- target all teams in the author's scope; admins target every team.
INSERT INTO "AnnouncementTargetTeam" ("announcementId", "teamId")
SELECT a."id", t."id"
FROM "Announcement" a
JOIN "Team" t
  ON (
    (a."teamId" IS NOT NULL AND t."id" = a."teamId")
    OR
    (
      a."teamId" IS NULL
      AND (
        a."authorRole" = 'ADMIN'::"Role"
        OR (a."authorRole" = 'DOCTOR'::"Role" AND t."doctorId" = a."authorUserId")
        OR (a."authorRole" = 'TA'::"Role" AND t."taId" = a."authorUserId")
      )
    )
  )
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE INDEX "AnnouncementTargetTeam_teamId_idx" ON "AnnouncementTargetTeam"("teamId");

-- AddForeignKey
ALTER TABLE "AnnouncementTargetTeam" ADD CONSTRAINT "AnnouncementTargetTeam_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementTargetTeam" ADD CONSTRAINT "AnnouncementTargetTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
