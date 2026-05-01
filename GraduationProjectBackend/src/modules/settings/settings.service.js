import { ensureUserSettings, updateUserSettings } from "./settings.repository.js";

export const PROFILE_VISIBILITIES = {
  PUBLIC: "PUBLIC",
  TEAM_ONLY: "TEAM_ONLY",
  PRIVATE: "PRIVATE",
};

export function toSettingsResponse(settings) {
  return {
    notifications: {
      emailNotifications: settings.emailNotifications,
      websiteNotifications: settings.websiteNotifications,
      soundNotifications: settings.soundNotifications,
      taskReminders: settings.taskReminders,
      meetingReminders: settings.meetingReminders,
      submissionAlerts: settings.submissionAlerts,
      teamUpdates: settings.teamUpdates,
      mentionNotifications: settings.mentionNotifications,
      deadlineWarnings: settings.deadlineWarnings,
      gradeNotifications: settings.gradeNotifications,
      weeklyDigest: settings.weeklyDigest,
    },
    appearance: {
      theme: settings.theme,
      fontSize: settings.fontSize,
      compactMode: settings.compactMode,
      reducedMotion: settings.reducedMotion,
      highContrast: settings.highContrast,
      sidebarCollapsed: settings.sidebarCollapsed,
    },
    privacy: {
      profileVisibility: settings.profileVisibility,
      showEmail: settings.showEmail,
      showActivity: settings.showActivity,
      showTeam: settings.showTeam,
      showOnlineStatus: settings.showOnlineStatus,
    },
    security: {
      loginAlerts: settings.loginAlerts,
      sessionTimeout: settings.sessionTimeout,
      twoFactorEnabled: settings.twoFactorEnabled,
    },
    updatedAt: settings.updatedAt,
  };
}

function flattenSettingsPayload(payload) {
  const data = {};
  const { notifications, appearance, privacy, security } = payload;

  if (notifications) {
    for (const key of [
      "emailNotifications",
      "websiteNotifications",
      "soundNotifications",
      "taskReminders",
      "meetingReminders",
      "submissionAlerts",
      "teamUpdates",
      "mentionNotifications",
      "deadlineWarnings",
      "gradeNotifications",
      "weeklyDigest",
    ]) {
      if (notifications[key] !== undefined) data[key] = notifications[key];
    }
  }

  if (appearance) {
    for (const key of ["theme", "fontSize", "compactMode", "reducedMotion", "highContrast", "sidebarCollapsed"]) {
      if (appearance[key] !== undefined) data[key] = appearance[key];
    }
  }

  if (privacy) {
    for (const key of ["profileVisibility", "showEmail", "showActivity", "showTeam", "showOnlineStatus"]) {
      if (privacy[key] !== undefined) data[key] = privacy[key];
    }
  }

  if (security) {
    for (const key of ["loginAlerts", "sessionTimeout"]) {
      if (security[key] !== undefined) data[key] = security[key];
    }
  }

  return data;
}

export async function getMySettingsService(actor) {
  const settings = await ensureUserSettings(actor.id);
  return toSettingsResponse(settings);
}

export async function updateMySettingsService(actor, payload) {
  const data = flattenSettingsPayload(payload);
  const settings = await updateUserSettings(actor.id, data);
  return toSettingsResponse(settings);
}
