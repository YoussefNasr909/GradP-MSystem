import { z } from "zod";

const booleanOptional = z.boolean().optional();

const notificationSchema = z
  .object({
    emailNotifications: booleanOptional,
    websiteNotifications: booleanOptional,
    soundNotifications: booleanOptional,
    taskReminders: booleanOptional,
    meetingReminders: booleanOptional,
    submissionAlerts: booleanOptional,
    teamUpdates: booleanOptional,
    mentionNotifications: booleanOptional,
    deadlineWarnings: booleanOptional,
    gradeNotifications: booleanOptional,
    weeklyDigest: booleanOptional,
  })
  .strict()
  .optional();

const appearanceSchema = z
  .object({
    theme: z.enum(["light", "dark", "system"]).optional(),
    fontSize: z.number().int().min(12).max(20).optional(),
    compactMode: booleanOptional,
    reducedMotion: booleanOptional,
    highContrast: booleanOptional,
    sidebarCollapsed: booleanOptional,
  })
  .strict()
  .optional();

const privacySchema = z
  .object({
    profileVisibility: z.enum(["PUBLIC", "TEAM_ONLY", "PRIVATE"]).optional(),
    showEmail: booleanOptional,
    showActivity: booleanOptional,
    showTeam: booleanOptional,
    showOnlineStatus: booleanOptional,
  })
  .strict()
  .optional();

const securitySchema = z
  .object({
    loginAlerts: booleanOptional,
    sessionTimeout: z.number().int().min(5).max(120).optional(),
  })
  .strict()
  .optional();

export const getMySettingsSchema = z.object({
  body: z.any().optional(),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updateMySettingsSchema = z.object({
  body: z
    .object({
      notifications: notificationSchema,
      appearance: appearanceSchema,
      privacy: privacySchema,
      security: securitySchema,
    })
    .strict()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: "Provide at least one settings group to update",
    }),
  query: z.any().optional(),
  params: z.any().optional(),
});
