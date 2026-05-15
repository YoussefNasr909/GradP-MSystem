import { apiRequest } from "./http"

// ─── Types ───────────────────────────────────────────────────

export type GamificationBalance = {
  lifetimeXp: number
  semesterXp: number
  monthlyXp: number
  weeklyXp: number
  pendingXp: number
  frozenXp: number
  level: number
  qualityScore: number | null
  lastRecalculatedAt: string | null
}

export type GamificationTeamBalance = {
  lifetimeTeamXp: number
  semesterTeamXp: number
  monthlyTeamXp: number
  weeklyTeamXp: number
  pendingTeamXp: number
  frozenTeamXp: number
  teamHealthScore: number | null
  leaderboardScore: number | null
  lastRecalculatedAt: string | null
}

export type XpTransaction = {
  id: string
  recipientType: string
  userId: string | null
  teamId: string | null
  amount: number
  direction: "CREDIT" | "DEBIT"
  status: string
  reason: string
  sourceType: string
  sourceId: string
  ruleCode: string
  baseXp: number
  qualityMultiplier: number | null
  timelinessMultiplier: number | null
  evidenceMultiplier: number | null
  difficultyMultiplier: number | null
  createdAt: string
}

export type BadgeInfo = {
  code: string
  name: string
  description: string
  category?: string
  rarity?: string
  targetType?: string
  xpReward?: number
  icon?: string
  isHidden?: boolean
  earned: boolean
  unlockedAt: string | null
  progress: number
}

export type GamificationOverview = {
  balance: GamificationBalance
  badges: BadgeInfo[]
  recentTransactions: XpTransaction[]
}

export type PaginatedTransactions = {
  items: XpTransaction[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type LeaderboardEntry = {
  rank: number
  score: number
  userId: string | null
  teamId: string | null
  user: { id: string; firstName: string; lastName: string; avatarUrl: string | null; role: string } | null
  team: { id: string; name: string } | null
  breakdown: Record<string, number>
}

export type LeaderboardResult = {
  type: string
  source: string
  items: LeaderboardEntry[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type GamificationRule = {
  id: string
  code: string
  name: string
  description: string | null
  eventType: string
  targetType: string
  baseXp: number
  conditions: Record<string, unknown> | null
  multipliers: Record<string, unknown> | null
  caps: Record<string, unknown> | null
  version: number
  isActive: boolean
}

export type TeamSummary = {
  teamId: string
  balance: GamificationTeamBalance
}

export type GamificationCase = {
  id: string
  userId: string | null
  teamId: string | null
  eventId: string | null
  transactionId: string | null
  score: number
  status: string
  reason: string
  resolution: string | null
  studentVisibleReason: string | null
  assignedReviewerId: string | null
  createdAt: string
  resolvedAt: string | null
  user?: { id: string; firstName: string; lastName: string; avatarUrl: string | null; role: string } | null
  team?: { id: string; name: string } | null
}

export type GamificationAdjustment = {
  id: string
  requestedByUserId: string
  targetUserId: string | null
  targetTeamId: string | null
  amount: number
  reason: string
  sourceReference: string | null
  status: string
  reviewComment: string | null
  createdEventId: string | null
  createdTransactionId: string | null
  createdAt: string
  reviewedAt: string | null
  requestedBy?: { id: string; firstName: string; lastName: string; avatarUrl: string | null; role: string } | null
  targetUser?: { id: string; firstName: string; lastName: string; avatarUrl: string | null; role: string } | null
  targetTeam?: { id: string; name: string; leaderId: string | null } | null
  approvedBy?: { id: string; firstName: string; lastName: string; avatarUrl: string | null; role: string } | null
}

export type PaginatedCases = {
  items: GamificationCase[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type PaginatedAdjustments = {
  items: GamificationAdjustment[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── API Client ──────────────────────────────────────────────

function qs(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export const gamificationApi = {
  // ─── Student / User ──────────────────────────────────────
  getOverview: () =>
    apiRequest<GamificationOverview>("/gamification/me"),

  getHistory: (params?: { page?: number; limit?: number; status?: string; sourceType?: string }) =>
    apiRequest<PaginatedTransactions>(`/gamification/me/history${qs(params ?? {})}`),

  getBadges: () =>
    apiRequest<BadgeInfo[]>("/gamification/me/badges"),

  // ─── Team ────────────────────────────────────────────────
  getTeamSummary: (teamId: string) =>
    apiRequest<TeamSummary>(`/gamification/team/${teamId}`),

  getTeamHistory: (teamId: string, params?: { page?: number; limit?: number }) =>
    apiRequest<PaginatedTransactions>(`/gamification/team/${teamId}/history${qs(params ?? {})}`),

  // ─── Leaderboards ────────────────────────────────────────
  getLeaderboards: (params?: { type?: string; page?: number; limit?: number }) =>
    apiRequest<LeaderboardResult>(`/gamification/leaderboards${qs(params ?? {})}`),

  // ─── Rules ───────────────────────────────────────────────
  getRules: (params?: { eventType?: string; activeOnly?: string }) =>
    apiRequest<GamificationRule[]>(`/gamification/rules${qs(params ?? {})}`),

  // ─── Admin ───────────────────────────────────────────────
  processEvents: () =>
    apiRequest<{ processed: number; failed: number; skipped: number }>("/gamification/admin/process-events", { method: "POST" }),

  getCases: (params?: { page?: number; limit?: number; status?: string; teamId?: string; userId?: string }) =>
    apiRequest<PaginatedCases>(`/gamification/admin/cases${qs(params ?? {})}`),

  resolveCase: (
    caseId: string,
    body: { decision: "APPROVE" | "REJECT"; resolution: string; studentVisibleReason?: string },
  ) =>
    apiRequest<GamificationCase>(`/gamification/admin/cases/${caseId}/resolve`, {
      method: "PATCH",
      body,
    }),

  getAdjustments: (params?: { page?: number; limit?: number; status?: string }) =>
    apiRequest<PaginatedAdjustments>(`/gamification/admin/adjustments${qs(params ?? {})}`),

  createAdjustment: (body: {
    targetUserId?: string
    targetTeamId?: string
    amount: number
    reason: string
    sourceReference?: string
  }) =>
    apiRequest<GamificationAdjustment>("/gamification/admin/adjustments", {
      method: "POST",
      body,
    }),

  reviewAdjustment: (
    adjustmentId: string,
    body: { decision: "APPROVE" | "REJECT"; reviewComment?: string },
  ) =>
    apiRequest<GamificationAdjustment>(`/gamification/admin/adjustments/${adjustmentId}/review`, {
      method: "PATCH",
      body,
    }),

  generateLeaderboardSnapshots: (body?: { types?: string[] }) =>
    apiRequest<{ generated: number; types: Array<{ type: string; created: number; periodStart: string; periodEnd: string }> }>(
      "/gamification/admin/leaderboards/snapshots",
      { method: "POST", body: body ?? {} },
    ),
}
