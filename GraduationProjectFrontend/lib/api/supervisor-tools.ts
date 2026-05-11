import { apiRequest, API_BASE_URL } from "./http"

// ─── Supervisor Notes ────────────────────────────────────────────────────────

export interface SupervisorNoteUser {
  id: string
  firstName: string
  lastName: string
  fullName: string
  role: string
  avatarUrl: string | null
}

export interface SupervisorNote {
  id: string
  teamId: string
  authorUserId: string
  authorRole: "DOCTOR" | "TA" | "ADMIN"
  content: string
  createdAt: string
  updatedAt: string
  author: SupervisorNoteUser | null
}

export const supervisorNotesApi = {
  list: (teamId: string) =>
    apiRequest<SupervisorNote[]>(`/supervisor-notes?teamId=${encodeURIComponent(teamId)}`),

  create: (teamId: string, content: string) =>
    apiRequest<SupervisorNote>("/supervisor-notes", {
      method: "POST",
      body: { teamId, content },
    }),

  update: (id: string, content: string) =>
    apiRequest<SupervisorNote>(`/supervisor-notes/${id}`, {
      method: "PATCH",
      body: { content },
    }),

  delete: (id: string) =>
    apiRequest<{ ok: true }>(`/supervisor-notes/${id}`, { method: "DELETE" }),
}

// ─── Deadlines ───────────────────────────────────────────────────────────────

export type DeliverableType =
  | "SRS" | "UML" | "PROTOTYPE" | "CODE" | "TEST_PLAN" | "FINAL_REPORT" | "PRESENTATION"

export interface DeadlineUser {
  id: string
  firstName: string
  lastName: string
  fullName: string
  role: string
  avatarUrl: string | null
}

export interface Deadline {
  id: string
  teamId: string
  deliverableType: DeliverableType
  dueDate: string
  setByUserId: string
  note: string | null
  createdAt: string
  updatedAt: string
  setBy: DeadlineUser | null
  team: { id: string; name: string; leaderId: string; doctorId: string | null; taId: string | null } | null
}

export const deadlinesApi = {
  list: (params?: { teamId?: string; upcoming?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.teamId) q.set("teamId", params.teamId)
    if (params?.upcoming) q.set("upcoming", "true")
    const qs = q.toString()
    return apiRequest<Deadline[]>(qs ? `/deadlines?${qs}` : "/deadlines")
  },

  upsert: (payload: { teamId: string; deliverableType: DeliverableType; dueDate: string; note?: string }) =>
    apiRequest<Deadline>("/deadlines", { method: "POST", body: payload }),

  delete: (id: string) =>
    apiRequest<{ ok: true }>(`/deadlines/${id}`, { method: "DELETE" }),
}

// ─── Announcements ───────────────────────────────────────────────────────────

export interface Announcement {
  id: string
  authorUserId: string
  authorRole: "DOCTOR" | "TA" | "ADMIN"
  teamId: string | null
  title: string
  content: string
  pinned: boolean
  createdAt: string
  updatedAt: string
  author: SupervisorNoteUser | null
  team:   { id: string; name: string } | null
}

export const announcementsApi = {
  list: () => apiRequest<Announcement[]>("/announcements"),

  create: (payload: { title: string; content: string; teamId?: string | null; pinned?: boolean }) =>
    apiRequest<Announcement>("/announcements", { method: "POST", body: payload }),

  update: (id: string, payload: { title?: string; content?: string; pinned?: boolean }) =>
    apiRequest<Announcement>(`/announcements/${id}`, { method: "PATCH", body: payload }),

  delete: (id: string) =>
    apiRequest<{ ok: true }>(`/announcements/${id}`, { method: "DELETE" }),
}

// ─── Activity Timeline ───────────────────────────────────────────────────────

export interface ActivityEvent {
  id: string
  type: "submission" | "proposal" | "meeting" | "risk" | "task" | "note" | "deadline" | "announcement"
  category: string
  action: string
  timestamp: string
  title: string
  detail: string | null
  actor: { name: string | null; avatarUrl: string | null; role: string | null } | null
}

export const activityApi = {
  forTeam: (teamId: string) =>
    apiRequest<ActivityEvent[]>(`/admin/teams/${encodeURIComponent(teamId)}/activity`),
}

// ─── PDF Report Card ─────────────────────────────────────────────────────────

export const reportCardApi = {
  /**
   * Returns a direct URL to the team's report-card PDF — open in a new tab
   * (the browser will download it). Uses the same auth token via Authorization
   * header is NOT possible for a download, so we fetch blob then download.
   */
  download: async (teamId: string, teamName: string): Promise<void> => {
    const token = (await import("@/lib/stores/auth-store")).useAuthStore.getState().accessToken
    const res = await fetch(`${API_BASE_URL}/admin/teams/${encodeURIComponent(teamId)}/report-card.pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new Error(`Failed to download report card (${res.status})`)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `report-card-${teamName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },
}
