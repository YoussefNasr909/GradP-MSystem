import type { ApiNotification } from "@/lib/api/notifications"

export type NotificationDisplay = {
  label: string
  toneClassName: string
  title: string
  message: string
  category:
    | "announcement"
    | "meeting"
    | "task"
    | "submission"
    | "team"
    | "supervisor"
    | "support"
    | "system"
    | "info"
}

function isAnnouncement(notification: ApiNotification) {
  return (
    notification.actionUrl?.startsWith("/dashboard/announcements") ||
    notification.title.toLowerCase().startsWith("announcement:")
  )
}

function isMeeting(notification: ApiNotification) {
  const text = `${notification.title} ${notification.message} ${notification.actionUrl ?? ""}`.toLowerCase()
  return text.includes("meeting") || text.includes("calendar")
}

function cleanAnnouncementTitle(title: string) {
  return title.replace(/^announcement:\s*/i, "").trim()
}

export function getNotificationDisplay(notification: ApiNotification): NotificationDisplay {
  const type = notification.type

  if (isAnnouncement(notification)) {
    const title = cleanAnnouncementTitle(notification.title)
    return {
      label: "Announcement",
      category: "announcement",
      toneClassName: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
      title: title ? `Announcement: ${title}` : "New announcement",
      message: notification.message,
    }
  }

  if (type === "SYSTEM" && isMeeting(notification)) {
    return {
      label: "Meeting",
      category: "meeting",
      toneClassName: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
      title: notification.title || "Meeting update",
      message: notification.message,
    }
  }

  if (type === "TASK_ASSIGNED") {
    return {
      label: "Task assigned",
      category: "task",
      toneClassName: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
      title: notification.title || "New task assigned",
      message: notification.message,
    }
  }

  if (type === "TASK_REVIEWED") {
    return {
      label: "Review request",
      category: "task",
      toneClassName: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
      title: notification.title || "Task ready for review",
      message: notification.message,
    }
  }

  if (type === "TASK_APPROVED") {
    return {
      label: "Task approved",
      category: "task",
      toneClassName: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      title: notification.title || "Task approved",
      message: notification.message,
    }
  }

  if (type === "TASK_CHANGES_REQUESTED") {
    return {
      label: "Changes requested",
      category: "task",
      toneClassName: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
      title: notification.title || "Changes requested",
      message: notification.message,
    }
  }

  if (type.startsWith("TASK")) {
    return {
      label: "Task",
      category: "task",
      toneClassName: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
      title: notification.title || "Task update",
      message: notification.message,
    }
  }

  if (type === "TEAM_INVITE_RECEIVED") {
    return {
      label: "Team invitation",
      category: "team",
      toneClassName: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
      title: notification.title || "Team invitation",
      message: notification.message,
    }
  }

  if (type.startsWith("TEAM_JOIN")) {
    return {
      label: "Join request",
      category: "team",
      toneClassName: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
      title: notification.title || "Team join request",
      message: notification.message,
    }
  }

  if (type.startsWith("TEAM")) {
    return {
      label: "Team update",
      category: "team",
      toneClassName: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
      title: notification.title || "Team update",
      message: notification.message,
    }
  }

  if (type.startsWith("SUPERVISOR")) {
    return {
      label: "Supervisor",
      category: "supervisor",
      toneClassName: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      title: notification.title || "Supervisor update",
      message: notification.message,
    }
  }

  if (type.startsWith("SUPPORT_TICKET")) {
    return {
      label: "Support",
      category: "support",
      toneClassName: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      title: notification.title || "Support ticket update",
      message: notification.message,
    }
  }

  if (type === "SUBMISSION_GRADED") {
    return {
      label: "Grade posted",
      category: "submission",
      toneClassName: "bg-green-500/10 text-green-700 dark:text-green-300",
      title: notification.title || "Submission graded",
      message: notification.message,
    }
  }

  if (type.startsWith("SUBMISSION")) {
    return {
      label: "Submission",
      category: "submission",
      toneClassName: "bg-green-500/10 text-green-700 dark:text-green-300",
      title: notification.title || "Submission update",
      message: notification.message,
    }
  }

  if (type === "SYSTEM") {
    return {
      label: "System update",
      category: "system",
      toneClassName: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
      title: notification.title || "System update",
      message: notification.message,
    }
  }

  return {
    label: "Info",
    category: "info",
    toneClassName: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
    title: notification.title || "Notification",
    message: notification.message,
  }
}
