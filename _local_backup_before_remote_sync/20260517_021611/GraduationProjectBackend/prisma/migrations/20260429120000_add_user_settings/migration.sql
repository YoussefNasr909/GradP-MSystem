CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'TEAM_ONLY', 'PRIVATE');

CREATE TABLE "UserSettings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
  "websiteNotifications" BOOLEAN NOT NULL DEFAULT true,
  "soundNotifications" BOOLEAN NOT NULL DEFAULT true,
  "taskReminders" BOOLEAN NOT NULL DEFAULT true,
  "meetingReminders" BOOLEAN NOT NULL DEFAULT true,
  "submissionAlerts" BOOLEAN NOT NULL DEFAULT true,
  "teamUpdates" BOOLEAN NOT NULL DEFAULT true,
  "mentionNotifications" BOOLEAN NOT NULL DEFAULT true,
  "deadlineWarnings" BOOLEAN NOT NULL DEFAULT true,
  "gradeNotifications" BOOLEAN NOT NULL DEFAULT true,
  "weeklyDigest" BOOLEAN NOT NULL DEFAULT false,
  "theme" TEXT NOT NULL DEFAULT 'system',
  "fontSize" INTEGER NOT NULL DEFAULT 16,
  "compactMode" BOOLEAN NOT NULL DEFAULT false,
  "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
  "highContrast" BOOLEAN NOT NULL DEFAULT false,
  "sidebarCollapsed" BOOLEAN NOT NULL DEFAULT false,
  "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
  "showEmail" BOOLEAN NOT NULL DEFAULT true,
  "showActivity" BOOLEAN NOT NULL DEFAULT true,
  "showTeam" BOOLEAN NOT NULL DEFAULT true,
  "showOnlineStatus" BOOLEAN NOT NULL DEFAULT true,
  "loginAlerts" BOOLEAN NOT NULL DEFAULT true,
  "sessionTimeout" INTEGER NOT NULL DEFAULT 30,
  "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  "twoFactorSecretEncrypted" TEXT,
  "pendingTwoFactorSecretEncrypted" TEXT,
  "recoveryCodeHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
CREATE INDEX "UserSettings_profileVisibility_idx" ON "UserSettings"("profileVisibility");

ALTER TABLE "UserSettings"
  ADD CONSTRAINT "UserSettings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
