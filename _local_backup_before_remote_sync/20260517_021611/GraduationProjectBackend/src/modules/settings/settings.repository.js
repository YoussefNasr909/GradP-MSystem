import { prisma } from "../../loaders/dbLoader.js";

export const USER_SETTINGS_SELECT = {
  id: true,
  userId: true,
  emailNotifications: true,
  websiteNotifications: true,
  soundNotifications: true,
  taskReminders: true,
  meetingReminders: true,
  submissionAlerts: true,
  teamUpdates: true,
  mentionNotifications: true,
  deadlineWarnings: true,
  gradeNotifications: true,
  weeklyDigest: true,
  theme: true,
  fontSize: true,
  compactMode: true,
  reducedMotion: true,
  highContrast: true,
  sidebarCollapsed: true,
  profileVisibility: true,
  showEmail: true,
  showActivity: true,
  showTeam: true,
  showOnlineStatus: true,
  loginAlerts: true,
  sessionTimeout: true,
  twoFactorEnabled: true,
  createdAt: true,
  updatedAt: true,
};

export function getUserSettingsByUserId(userId, tx = prisma) {
  return tx.userSettings.findUnique({
    where: { userId },
    select: USER_SETTINGS_SELECT,
  });
}

export function ensureUserSettings(userId, tx = prisma) {
  return tx.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: USER_SETTINGS_SELECT,
  });
}

export function updateUserSettings(userId, data, tx = prisma) {
  return tx.userSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    select: USER_SETTINGS_SELECT,
  });
}
