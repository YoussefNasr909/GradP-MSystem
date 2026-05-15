import { prisma } from "../../loaders/dbLoader.js";
import { sendNotificationEmail } from "./mailer.js";
import { emitToUser } from "../../realtime/socket.js";

function categoryPreferenceKey(type, title = "", actionUrl = "") {
  const normalizedType = String(type ?? "");
  const normalizedText = `${title} ${actionUrl}`.toLowerCase();

  if (normalizedType.startsWith("TASK")) return "taskReminders";
  if (normalizedType.startsWith("SUBMISSION")) return "submissionAlerts";
  if (normalizedType.startsWith("TEAM") || normalizedType.startsWith("SUPERVISOR")) return "teamUpdates";
  if (normalizedType.startsWith("MESSAGE") || normalizedType.includes("MENTION")) return "mentionNotifications";
  if (normalizedText.includes("deadline")) return "deadlineWarnings";
  if (normalizedText.includes("grade")) return "gradeNotifications";
  if (normalizedText.includes("meeting") || normalizedText.includes("calendar")) return "meetingReminders";
  return null;
}

function shouldSendPreferenceNotification(settings, type, title, actionUrl) {
  if (!settings) return true;

  const categoryKey = categoryPreferenceKey(type, title, actionUrl);
  if (categoryKey && settings[categoryKey] === false) return false;
  return true;
}

/**
 * Creates an in-app notification for a user, then best-effort email delivery.
 * In-app creation failures are swallowed by default so a missing notification
 * never breaks most core business actions; callers that must verify delivery
 * can pass { throwOnFailure: true }.
 *
 * @param {{ userId: string, type: string, title: string, message: string, actionUrl?: string, forceEmail?: boolean }} payload
 * @param {object} [tx] - optional Prisma transaction client
 * @param {{ throwOnFailure?: boolean }} [options]
 */
export async function notify(
  { userId, type, title, message, actionUrl = null, forceEmail = false },
  tx = prisma,
  { throwOnFailure = false } = {},
) {
  let notification;

  try {
    notification = await tx.notification.create({
      data: { userId, type, title, message, actionUrl },
    });

    emitToUser(userId, "notification.created", notification);
  } catch (err) {
    console.error("[notify] Failed to create notification:", err?.message ?? err);
    if (throwOnFailure) throw err;
    return null;
  }

  try {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        settings: {
          select: {
            emailNotifications: true,
            taskReminders: true,
            meetingReminders: true,
            submissionAlerts: true,
            teamUpdates: true,
            mentionNotifications: true,
            deadlineWarnings: true,
            gradeNotifications: true,
          },
        },
      },
    });

    const settings = user?.settings;
    const emailAllowed =
      forceEmail ||
      (settings?.emailNotifications !== false && shouldSendPreferenceNotification(settings, type, title, actionUrl));

    if (user?.email && emailAllowed) {
      await sendNotificationEmail({ to: user.email, title, message, actionUrl });
    }
  } catch (err) {
    console.error("[notify] Failed to send notification email:", err?.message ?? err);
  }

  return notification;
}
