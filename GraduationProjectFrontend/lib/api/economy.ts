import { apiRequest } from "./http"

export type CoinWallet = {
  id: string
  userId: string
  balance: number
  lifetimeEarned: number
  lifetimeSpent: number
  updatedAt: string
}

export type QuestType = "DAILY" | "WEEKLY" | "MILESTONE"
export type QuestMetric =
  | "XP_EARNED"
  | "TASKS_DONE"
  | "SUBMISSIONS_APPROVED"
  | "PRS_MERGED"
  | "REVIEWS_GIVEN"
  | "SPRINTS_COMPLETED"
  | "WEEKLY_REPORTS_APPROVED"
  | "LOGIN_STREAK"

export type Quest = {
  id: string
  code: string
  title: string
  description: string
  type: QuestType
  metric: QuestMetric
  targetValue: number
  coinReward: number
  startsAt: string | null
  endsAt: string | null
  isActive: boolean
  sortOrder: number
  metadata?: Record<string, unknown> | null
}

export type QuestProgress = {
  id: string
  quest: Quest
  windowKey: string
  windowLabel: string
  windowEndsAt: string | null
  currentValue: number
  targetValue: number
  progressPercentage: number
  completedAt: string | null
  claimedAt: string | null
  claimable: boolean
  newlyCompleted?: boolean
}

export type RewardItem = {
  id: string
  code: string
  name: string
  description: string
  type: "AVATAR_FRAME" | "PROFILE_THEME" | "TITLE" | "BADGE_SKIN"
  cost: number
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED"
  inventory: number | null
  imageUrl: string | null
  metadata?: Record<string, unknown> | null
  sortOrder: number
  owned: boolean
  purchase?: RewardPurchase | null
}

export type CoinTransaction = {
  id: string
  amount: number
  direction: "CREDIT" | "DEBIT"
  status: "POSTED" | "VOIDED"
  sourceType: "QUEST" | "REWARD_PURCHASE" | "XP_AWARD" | "MANUAL" | "SEED"
  sourceId: string | null
  reason: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export type RewardPurchase = {
  id: string
  userId: string
  rewardItemId: string
  status: "ACTIVE" | "REVOKED"
  isEquipped: boolean
  equippedAt: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
  rewardItem: Omit<RewardItem, "owned" | "purchase">
  coinTransaction: CoinTransaction
}

export type EconomyOverview = {
  wallet: CoinWallet
  quests: QuestProgress[]
  rewards: RewardItem[]
  purchases: RewardPurchase[]
  equippedRewards: RewardPurchase[]
  recentTransactions: CoinTransaction[]
}

export type PaginatedCoinTransactions = {
  items: CoinTransaction[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const economyApi = {
  overview: () => apiRequest<EconomyOverview>("/economy/me"),
  quests: () => apiRequest<{ items: QuestProgress[] }>("/economy/quests"),
  claimQuest: (progressId: string) =>
    apiRequest<{ progress: QuestProgress; transaction: CoinTransaction; wallet: CoinWallet }>(
      `/economy/quests/${progressId}/claim`,
      { method: "POST" },
    ),
  rewards: () => apiRequest<{ wallet: CoinWallet; items: RewardItem[]; purchases: RewardPurchase[] }>("/economy/rewards"),
  purchaseReward: (rewardItemId: string) =>
    apiRequest<{ item: RewardItem; purchase: RewardPurchase; transaction: CoinTransaction; wallet: CoinWallet }>(
      `/economy/rewards/${rewardItemId}/purchase`,
      { method: "POST" },
    ),
  equipReward: (purchaseId: string, equipped = true) =>
    apiRequest<{ purchase: RewardPurchase }>(`/economy/purchases/${purchaseId}/equip`, {
      method: "PATCH",
      body: { equipped },
    }),
  transactions: (params: { page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set("page", String(params.page))
    if (params.limit) query.set("limit", String(params.limit))
    const suffix = query.toString() ? `?${query.toString()}` : ""
    return apiRequest<PaginatedCoinTransactions>(`/economy/transactions${suffix}`)
  },
}
