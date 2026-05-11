import { apiRequest } from "./http"

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogLevel = "info" | "warning" | "error" | "success"
export type LogCategory = "user" | "system"

export interface SystemLog {
  id: string
  timestamp: string
  level: LogLevel
  category: LogCategory
  message: string
  details: Record<string, unknown>
  source: string
}

export interface LogCounts {
  total: number
  info: number
  warning: number
  error: number
  success: number
}

export interface SystemLogsResponse {
  logs: SystemLog[]
  total: number
  page: number
  limit: number
  counts: LogCounts
}

export interface ActivityUser {
  id: string
  name: string
  role: string
  avatarUrl: string | null
  email?: string
}

export interface ActivityEntry {
  id: string
  timestamp: string
  user: ActivityUser
  action: string
  target: string
  details: string
  teamName?: string
}

export interface UserActivityResponse {
  activities: ActivityEntry[]
  total: number
  page: number
  limit: number
}

// ─── Query builders ──────────────────────────────────────────────────────────

function buildSystemLogsQuery(params: {
  page?: number
  limit?: number
  level?: string
  category?: string
  search?: string
}) {
  const q = new URLSearchParams()
  if (params.page) q.set("page", String(params.page))
  if (params.limit) q.set("limit", String(params.limit))
  if (params.level && params.level !== "all") q.set("level", params.level)
  if (params.category && params.category !== "all") q.set("category", params.category)
  if (params.search) q.set("search", params.search)
  const qs = q.toString()
  return qs ? `/admin/logs/system?${qs}` : "/admin/logs/system"
}

function buildActivityQuery(params: {
  page?: number
  limit?: number
  search?: string
  role?: string
}) {
  const q = new URLSearchParams()
  if (params.page) q.set("page", String(params.page))
  if (params.limit) q.set("limit", String(params.limit))
  if (params.search) q.set("search", params.search)
  if (params.role && params.role !== "all") q.set("role", params.role)
  const qs = q.toString()
  return qs ? `/admin/logs/activity?${qs}` : "/admin/logs/activity"
}

// ─── API object ───────────────────────────────────────────────────────────────

export const adminLogsApi = {
  getSystemLogs: (params?: Parameters<typeof buildSystemLogsQuery>[0]) =>
    apiRequest<SystemLogsResponse>(buildSystemLogsQuery(params ?? {})),

  getUserActivity: (params?: Parameters<typeof buildActivityQuery>[0]) =>
    apiRequest<UserActivityResponse>(buildActivityQuery(params ?? {})),
}

// ─── Grades Overview (admin + doctor) ────────────────────────────────────────

export interface GradesOverviewUserRef {
  id: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  fullName: string
}

export interface GradesOverviewSubmission {
  id: string
  deliverableType: string
  sdlcPhase: string
  status: string
  grade: number | null
  taRecommendedGrade: number | null
  version: number
  submittedAt: string
  reviewedAt: string | null
  taReviewedAt: string | null
}

export interface GradesOverviewRow {
  teamId: string
  teamName: string
  stage: string
  memberCount: number
  leader: GradesOverviewUserRef | null
  doctor: GradesOverviewUserRef | null
  ta: GradesOverviewUserRef | null
  stats: {
    approved: number
    pendingReview: number
    underReview: number
    needsRevision: number
    total: number
  }
  averageGrade: number | null
  weightedFinal: number | null
  phaseAverages: Record<string, number>
  submissions: GradesOverviewSubmission[]
}

export interface GradesOverviewResponse {
  rows: GradesOverviewRow[]
  summary: {
    totalTeams: number
    teamsWithGrades: number
    globalAverage: number
    totalApproved: number
    totalPendingReview: number
    totalUnderReview: number
    totalNeedsRevision: number
  }
}

export const gradesOverviewApi = {
  get: (params?: { search?: string; stage?: string }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set("search", params.search)
    if (params?.stage && params.stage !== "all") q.set("stage", params.stage)
    const qs = q.toString()
    return apiRequest<GradesOverviewResponse>(qs ? `/admin/grades-overview?${qs}` : "/admin/grades-overview")
  },
}
