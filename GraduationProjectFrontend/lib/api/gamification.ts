import { apiRequest } from "./http"

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
  ruleCode: string | null
  baseXp: number | null
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

export type TeamSummary = {
  teamId: string
  balance: GamificationTeamBalance
}

export type ProcessEventsResult = {
  processed: number
  failed: number
  skipped: number
  retried?: number
  disabled?: boolean
  reason?: string
}

function qs(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") sp.set(key, String(value))
  }
  const query = sp.toString()
  return query ? `?${query}` : ""
}

export const gamificationApi = {
  getOverview: () =>
    apiRequest<GamificationOverview>("/gamification/me"),

  getHistory: (params?: { page?: number; limit?: number; status?: string; sourceType?: string }) =>
    apiRequest<PaginatedTransactions>(`/gamification/me/history${qs(params ?? {})}`),

  getBadges: () =>
    apiRequest<BadgeInfo[]>("/gamification/me/badges"),

  getTeamSummary: (teamId: string) =>
    apiRequest<TeamSummary>(`/gamification/team/${teamId}`),

  getTeamHistory: (teamId: string, params?: { page?: number; limit?: number }) =>
    apiRequest<PaginatedTransactions>(`/gamification/team/${teamId}/history${qs(params ?? {})}`),

  getLeaderboards: (params?: { type?: string; page?: number; limit?: number }) =>
    apiRequest<LeaderboardResult>(`/gamification/leaderboards${qs(params ?? {})}`),

  processEvents: (body?: { retryFailed?: boolean; eventIds?: string[] }) =>
    apiRequest<ProcessEventsResult>("/gamification/admin/process-events", { method: "POST", body: body ?? {} }),
}
