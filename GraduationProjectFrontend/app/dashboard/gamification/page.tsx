"use client"

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react"
import { motion } from "framer-motion"
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Code,
  Coins,
  Crown,
  FileText,
  Flame,
  Gift,
  GitBranch,
  Loader2,
  Lock,
  Medal,
  RefreshCw,
  Rocket,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { getRewardStyle } from "@/lib/gamification/reward-styles"
import { useAuthStore } from "@/lib/stores/auth-store"
import {
  useGamificationBadges,
  useGamificationHistory,
  useGamificationOverview,
  useLeaderboard,
  useTeamGamificationSummary,
} from "@/lib/hooks/use-gamification"
import { useEconomyOverview } from "@/lib/hooks/use-economy"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import type { BadgeInfo, LeaderboardEntry, XpTransaction } from "@/lib/api/gamification"
import { economyApi, type CoinTransaction, type QuestProgress, type RewardItem } from "@/lib/api/economy"

type Icon = ComponentType<{ className?: string }>

const XP_PER_LEVEL = 100
const DESKTOP_CARD_PAGE_SIZE = 4
const MOBILE_CARD_PAGE_SIZE = 1
const leaderboardOptions = [
  { key: "INDIVIDUAL_WEEKLY", label: "Weekly" },
  { key: "INDIVIDUAL_SEMESTER", label: "Semester" },
  { key: "INDIVIDUAL_LIFETIME", label: "All-time" },
  { key: "TEAM_WEEKLY", label: "Team week" },
  { key: "TEAM_SEMESTER", label: "Team semester" },
]

const xpEarningCatalog = [
  {
    id: "task-approved",
    name: "Task approved",
    description: "Approved tasks award 10 XP per story point, or 50 XP when no points are set.",
    eventType: "TASK_APPROVED",
    targetType: "User",
    xpLabel: "10 XP / SP",
  },
  {
    id: "submission-approved",
    name: "Submission approved",
    description: "Approved deliverables award team XP.",
    eventType: "SUBMISSION_APPROVED",
    targetType: "Team",
    xpLabel: "+100 XP",
  },
  {
    id: "weekly-report-approved",
    name: "Weekly report approved",
    description: "Approved weekly reports award team XP.",
    eventType: "WEEKLY_REPORT_APPROVED",
    targetType: "Team",
    xpLabel: "+50 XP",
  },
  {
    id: "pr-merged",
    name: "Pull request merged",
    description: "Merged GitHub pull requests award user XP.",
    eventType: "GITHUB_PR_MERGED",
    targetType: "User",
    xpLabel: "+20 XP",
  },
  {
    id: "pr-reviewed",
    name: "Pull request reviewed",
    description: "Submitted GitHub pull request reviews award user XP.",
    eventType: "GITHUB_PR_REVIEWED",
    targetType: "User",
    xpLabel: "+10 XP",
  },
  {
    id: "sprint-completed",
    name: "Sprint completed",
    description: "Completed sprints award team XP.",
    eventType: "SPRINT_COMPLETED",
    targetType: "Team",
    xpLabel: "+100 XP",
  },
  {
    id: "stage-advanced",
    name: "Stage advanced",
    description: "Advancing the project stage awards team XP.",
    eventType: "TEAM_STAGE_ADVANCED",
    targetType: "Team",
    xpLabel: "+150 XP",
  },
]

const rarityColors: Record<string, string> = {
  COMMON: "border-slate-300 dark:border-slate-600",
  RARE: "border-cyan-400/70",
  EPIC: "border-violet-400/70",
  LEGENDARY: "border-amber-400/80",
}

const rarityBg: Record<string, string> = {
  COMMON: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  RARE: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  EPIC: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  LEGENDARY: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
}

const badgeIcons: Record<string, Icon> = {
  award: Award,
  "book-open": BookOpen,
  clock: Clock,
  code: Code,
  crown: Crown,
  "file-text": FileText,
  flame: Flame,
  "git-branch": GitBranch,
  medal: Medal,
  rocket: Rocket,
  shield: Shield,
  sparkles: Sparkles,
  star: Star,
  target: Target,
  trophy: Trophy,
  users: Users,
  zap: Zap,
}

const rewardTypeIcons: Record<RewardItem["type"], Icon> = {
  AVATAR_FRAME: Shield,
  BADGE_SKIN: Medal,
  PROFILE_THEME: Sparkles,
  TITLE: Crown,
}

function xpForLevel(level: number) {
  return level * level * XP_PER_LEVEL
}

function xpProgress(lifetimeXp: number, level: number) {
  const currentLevelXp = xpForLevel(Math.max(0, level - 1))
  const nextLevelXp = xpForLevel(level)
  const range = Math.max(1, nextLevelXp - currentLevelXp)
  return Math.min(100, Math.max(0, Math.round(((lifetimeXp - currentLevelXp) / range) * 100)))
}

function formatDate(value?: string | null) {
  if (!value) return ""
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatNumber(value: number) {
  return value.toLocaleString()
}

function normalizeSourceType(sourceType?: string | null) {
  return (sourceType ?? "")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replaceAll(" ", "_")
    .toUpperCase()
}

function formatSourceLabel(sourceType?: string | null) {
  const normalized = normalizeSourceType(sourceType)
  if (!normalized) return "Unknown"
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => (part === "XP" ? "XP" : `${part[0]}${part.slice(1).toLowerCase()}`))
    .join(" ")
}

function formatCompactSourceLabel(sourceType?: string | null) {
  const compactLabels: Record<string, string> = {
    QUEST: "Quest",
    REWARD_PURCHASE: "Reward",
    XP_AWARD: "XP Award",
    XP_ADJUSTMENT_REQUEST: "XP Adjustment",
    MANUAL: "Manual",
    SEED: "Seed",
  }
  const normalized = normalizeSourceType(sourceType)
  return compactLabels[normalized] ?? formatSourceLabel(sourceType)
}

function formatQuestMetric(metric: string) {
  return metric.replaceAll("_", " ").toLowerCase()
}

function formatRewardType(type: RewardItem["type"]) {
  return getRewardStyle(type).label
}

function getInitials(firstName?: string, lastName?: string, fallback?: string) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase()
  return initials || fallback?.[0]?.toUpperCase() || "U"
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
}: {
  icon: Icon
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary shadow-sm">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-semibold uppercase text-muted-foreground">{eyebrow}</p> : null}
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-muted-foreground sm:block">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0 sm:pt-1">{action}</div> : null}
    </div>
  )
}

function InlineLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/25 p-6 text-sm text-muted-foreground">
      <span className="flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-2 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        {label}
      </span>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" className="h-10 sm:h-8" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function FilterBar({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? "default" : "outline"}
          size="sm"
          className="h-9 shrink-0 rounded-md px-3 text-xs sm:h-8"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function PagerControls({
  page,
  totalPages,
  totalItems,
  onPrevious,
  onNext,
}: {
  page: number
  totalPages: number
  totalItems: number
  onPrevious: () => void
  onNext: () => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 text-xs text-muted-foreground shadow-sm">
      <span className="truncate">
        Page {page} of {totalPages}
        <span className="hidden sm:inline"> - {formatNumber(totalItems)} items</span>
      </span>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="h-9 rounded-md px-3 text-xs sm:h-8 sm:px-2.5" disabled={page <= 1} onClick={onPrevious}>
          Prev
        </Button>
        <Button variant="outline" size="sm" className="h-9 rounded-md px-3 text-xs sm:h-8 sm:px-2.5" disabled={page >= totalPages} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  )
}

export default function GamificationPage() {
  const { currentUser } = useAuthStore()
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [leaderboardType, setLeaderboardType] = useState("INDIVIDUAL_WEEKLY")
  const [historyPage, setHistoryPage] = useState(1)
  const [claimingQuestId, setClaimingQuestId] = useState<string | null>(null)
  const [purchasingRewardId, setPurchasingRewardId] = useState<string | null>(null)
  const [equippingPurchaseId, setEquippingPurchaseId] = useState<string | null>(null)
  const [seenQuestToastIds, setSeenQuestToastIds] = useState<Set<string>>(new Set())
  const [challengeFilter, setChallengeFilter] = useState("all")
  const [rewardFilter, setRewardFilter] = useState("all")
  const [badgeFilter, setBadgeFilter] = useState("earned")
  const [challengePage, setChallengePage] = useState(1)
  const [rewardPage, setRewardPage] = useState(1)
  const [badgePage, setBadgePage] = useState(1)

  const overview = useGamificationOverview()
  const economy = useEconomyOverview()
  const badges = useGamificationBadges()
  const history = useGamificationHistory(historyPage)
  const leaderboard = useLeaderboard(leaderboardType)
  const canHaveOwnTeam = ["leader", "member", "student"].includes((currentUser?.role ?? "").toLowerCase())
  const myTeamState = useMyTeamState(canHaveOwnTeam)
  const teamSummary = useTeamGamificationSummary(myTeamState.data?.team?.id ?? null)

  const balance = overview.data?.balance
  const level = balance?.level ?? 1
  const lifetimeXp = balance?.lifetimeXp ?? 0
  const weeklyXp = balance?.weeklyXp ?? 0
  const monthlyXp = balance?.monthlyXp ?? 0
  const semesterXp = balance?.semesterXp ?? 0
  const progress = xpProgress(lifetimeXp, level)
  const xpToNext = Math.max(0, xpForLevel(level) - lifetimeXp)
  const coinBalance = economy.data?.wallet.balance ?? 0

  const equippedTitle = economy.data?.equippedRewards.find((purchase) => purchase.rewardItem.type === "TITLE")
  const equippedFrame = economy.data?.equippedRewards.find((purchase) => purchase.rewardItem.type === "AVATAR_FRAME")
  const equippedTheme = economy.data?.equippedRewards.find((purchase) => purchase.rewardItem.type === "PROFILE_THEME")
  const equippedBadgeSkin = economy.data?.equippedRewards.find((purchase) => purchase.rewardItem.type === "BADGE_SKIN")
  const earnedBadges = useMemo(() => (badges.data ?? []).filter((badge) => badge.earned), [badges.data])
  const sortedBadges = useMemo(
    () =>
      [...(badges.data ?? [])]
        .sort((a, b) => new Date(b.unlockedAt ?? 0).getTime() - new Date(a.unlockedAt ?? 0).getTime())
        .sort((a, b) => Number(b.earned) - Number(a.earned)),
    [badges.data],
  )
  const filteredChallenges = useMemo(() => {
    const quests = economy.data?.quests ?? []
    if (challengeFilter === "ready") return quests.filter((quest) => quest.claimable)
    if (challengeFilter === "complete") return quests.filter((quest) => Boolean(quest.completedAt))
    if (challengeFilter === "active") return quests.filter((quest) => !quest.completedAt)
    return quests
  }, [challengeFilter, economy.data?.quests])
  const filteredRewards = useMemo(() => {
    const rewards = economy.data?.rewards ?? []
    if (rewardFilter === "owned") return rewards.filter((item) => item.owned)
    if (rewardFilter === "available") return rewards.filter((item) => !item.owned && item.inventory !== 0)
    if (rewardFilter === "affordable") return rewards.filter((item) => !item.owned && item.inventory !== 0 && coinBalance >= item.cost)
    return rewards
  }, [coinBalance, economy.data?.rewards, rewardFilter])
  const filteredBadges = useMemo(() => {
    if (badgeFilter === "locked") return sortedBadges.filter((badge) => !badge.earned)
    if (badgeFilter === "all") return sortedBadges
    return sortedBadges.filter((badge) => badge.earned)
  }, [badgeFilter, sortedBadges])
  const challengeCount = economy.data?.quests.length ?? 0
  const claimableCount = economy.data?.quests.filter((quest) => quest.claimable).length ?? 0
  const cardPageSize = isMobile ? MOBILE_CARD_PAGE_SIZE : DESKTOP_CARD_PAGE_SIZE
  const visibleChallenges = filteredChallenges.slice((challengePage - 1) * cardPageSize, challengePage * cardPageSize)
  const visibleRewards = filteredRewards.slice((rewardPage - 1) * cardPageSize, rewardPage * cardPageSize)
  const visibleBadges = filteredBadges.slice((badgePage - 1) * cardPageSize, badgePage * cardPageSize)
  const challengePages = Math.max(1, Math.ceil(filteredChallenges.length / cardPageSize))
  const rewardPages = Math.max(1, Math.ceil(filteredRewards.length / cardPageSize))
  const badgePages = Math.max(1, Math.ceil(filteredBadges.length / cardPageSize))

  useEffect(() => {
    setChallengePage(1)
  }, [challengeFilter])

  useEffect(() => {
    setRewardPage(1)
  }, [rewardFilter])

  useEffect(() => {
    setBadgePage(1)
  }, [badgeFilter])

  useEffect(() => {
    setChallengePage((page) => Math.min(Math.max(1, page), challengePages))
  }, [challengePages])

  useEffect(() => {
    setRewardPage((page) => Math.min(Math.max(1, page), rewardPages))
  }, [rewardPages])

  useEffect(() => {
    setBadgePage((page) => Math.min(Math.max(1, page), badgePages))
  }, [badgePages])

  useEffect(() => {
    const newlyClaimable = economy.data?.quests.filter((quest) => quest.claimable && !seenQuestToastIds.has(quest.id)) ?? []
    if (newlyClaimable.length === 0) return

    const first = newlyClaimable[0]
    toast({
      title: "Challenge reward ready",
      description: `${first.quest.title} can be claimed for ${first.quest.coinReward} coins.`,
    })
    setSeenQuestToastIds((current) => new Set([...current, ...newlyClaimable.map((quest) => quest.id)]))
  }, [economy.data?.quests, seenQuestToastIds, toast])

  async function handleClaimQuest(progressId: string) {
    setClaimingQuestId(progressId)
    try {
      await economyApi.claimQuest(progressId)
      economy.refetch()
      toast({ title: "Challenge claimed", description: "Coins were added to your wallet." })
    } catch (error: any) {
      toast({ title: "Could not claim challenge", description: error?.message ?? "Please try again.", variant: "destructive" })
    } finally {
      setClaimingQuestId(null)
    }
  }

  async function handlePurchaseReward(rewardItemId: string) {
    setPurchasingRewardId(rewardItemId)
    try {
      await economyApi.purchaseReward(rewardItemId)
      economy.refetch()
      toast({ title: "Reward purchased", description: "Your wallet and reward collection were updated." })
    } catch (error: any) {
      toast({ title: "Could not purchase reward", description: error?.message ?? "Please try again.", variant: "destructive" })
    } finally {
      setPurchasingRewardId(null)
    }
  }

  async function handleEquipReward(item: RewardItem, equipped = true) {
    if (!item.purchase) return
    setEquippingPurchaseId(item.purchase.id)
    try {
      await economyApi.equipReward(item.purchase.id, equipped)
      economy.refetch()
      toast({
        title: equipped ? "Reward equipped" : "Reward unequipped",
        description: `${item.name} is now ${equipped ? "active on" : "removed from"} your profile cosmetics.`,
      })
    } catch (error: any) {
      toast({ title: "Could not update reward", description: error?.message ?? "Please try again.", variant: "destructive" })
    } finally {
      setEquippingPurchaseId(null)
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-5 overflow-x-hidden px-3 py-3 pb-24 sm:space-y-7 sm:px-4 sm:py-4 sm:pb-8 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Gamification</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">Your progress hub</h1>
        </div>
      </div>

      {overview.error ? (
        <ErrorState message={overview.error} onRetry={overview.refetch} />
      ) : overview.loading ? (
        <InlineLoading label="Loading progress" />
      ) : (
        <PlayerHero
          avatarUrl={currentUser?.avatarUrl ?? currentUser?.avatar}
          coinBalance={coinBalance}
          currentUserName={currentUser?.name ?? "Student"}
          earnedBadgeCount={earnedBadges.length}
          equippedBadgeSkin={equippedBadgeSkin?.rewardItem.name}
          equippedFrame={equippedFrame?.rewardItem.name}
          equippedTheme={equippedTheme?.rewardItem.name}
          equippedTitle={equippedTitle?.rewardItem.name}
          level={level}
          lifetimeXp={lifetimeXp}
          progress={progress}
          weeklyXp={weeklyXp}
          xpToNext={xpToNext}
        />
      )}

      <section className="hidden grid-cols-2 gap-2 sm:grid sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard icon={Zap} label="Lifetime XP" value={formatNumber(lifetimeXp)} tone="gold" />
        <MetricCard icon={Flame} label="Weekly XP" value={formatNumber(weeklyXp)} tone="coral" />
        <MetricCard icon={Coins} label="Coins" value={formatNumber(coinBalance)} tone="gold" />
        <MetricCard icon={Award} label="Achievements" value={formatNumber(earnedBadges.length)} tone="cyan" />
        <MetricCard icon={Trophy} label="Level" value={String(level)} tone="primary" />
        {teamSummary.data ? (
          <MetricCard
            icon={Users}
            label="Team XP"
            value={formatNumber(teamSummary.data.balance.weeklyTeamXp)}
            tone="emerald"
          />
        ) : (
          <MetricCard icon={Target} label="Challenges" value={formatNumber(challengeCount)} tone="emerald" />
        )}
      </section>

      <section className="grid min-w-0 gap-5 sm:gap-7 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
        <div className="min-w-0 space-y-5 sm:space-y-7">
          <section className="min-w-0 space-y-3 sm:space-y-4">
            <SectionHeader
              icon={Target}
              eyebrow={claimableCount ? `${claimableCount} ready` : "Active goals"}
              title="Challenges"
              description="Daily, weekly, and milestone goals"
              action={<Badge variant="outline">{challengeCount} active</Badge>}
            />
            <FilterBar
              value={challengeFilter}
              onChange={setChallengeFilter}
              options={[
                { value: "all", label: "All" },
                { value: "ready", label: "Ready" },
                { value: "active", label: "Active" },
                { value: "complete", label: "Complete" },
              ]}
            />
            <div className="mt-3 sm:mt-5">
              {economy.loading ? (
                <InlineLoading label="Loading challenges" />
              ) : economy.error ? (
                <ErrorState message={economy.error} onRetry={economy.refetch} />
              ) : economy.data?.quests.length === 0 ? (
                <EmptyState icon={Target} title="No active challenges" />
              ) : filteredChallenges.length === 0 ? (
                <EmptyState icon={Target} title="No matching challenges" />
              ) : (
                <>
                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    {visibleChallenges.map((quest) => (
                      <ChallengeCard
                        key={quest.id}
                        progress={quest}
                        claiming={claimingQuestId === quest.id}
                        onClaim={() => handleClaimQuest(quest.id)}
                      />
                    ))}
                  </div>
                  <PagerControls
                    page={challengePage}
                    totalPages={challengePages}
                    totalItems={filteredChallenges.length}
                    onPrevious={() => setChallengePage((page) => Math.max(1, page - 1))}
                    onNext={() => setChallengePage((page) => Math.min(challengePages, page + 1))}
                  />
                </>
              )}
            </div>
          </section>

          <section className="min-w-0 space-y-3 sm:space-y-4">
            <SectionHeader
              icon={ShoppingBag}
              eyebrow={`${formatNumber(coinBalance)} coins`}
              title="Reward Store"
              description="Titles, frames, themes, and badge skins"
            />
            <FilterBar
              value={rewardFilter}
              onChange={setRewardFilter}
              options={[
                { value: "all", label: "All" },
                { value: "available", label: "Available" },
                { value: "affordable", label: "Affordable" },
                { value: "owned", label: "Owned" },
              ]}
            />
            <div className="mt-3 sm:mt-5">
              {economy.loading ? (
                <InlineLoading label="Loading rewards" />
              ) : economy.error ? (
                <ErrorState message={economy.error} onRetry={economy.refetch} />
              ) : economy.data?.rewards.length === 0 ? (
                <EmptyState icon={Gift} title="No rewards available" />
              ) : filteredRewards.length === 0 ? (
                <EmptyState icon={Gift} title="No matching rewards" />
              ) : (
                <>
                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    {visibleRewards.map((item) => (
                      <RewardCard
                        key={item.id}
                        item={item}
                        coinBalance={coinBalance}
                        purchasing={purchasingRewardId === item.id}
                        equipping={equippingPurchaseId === item.purchase?.id}
                        onPurchase={() => handlePurchaseReward(item.id)}
                        onEquip={(equipped) => handleEquipReward(item, equipped)}
                      />
                    ))}
                  </div>
                  <PagerControls
                    page={rewardPage}
                    totalPages={rewardPages}
                    totalItems={filteredRewards.length}
                    onPrevious={() => setRewardPage((page) => Math.max(1, page - 1))}
                    onNext={() => setRewardPage((page) => Math.min(rewardPages, page + 1))}
                  />
                </>
              )}
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5 sm:space-y-6">
          <Card className="overflow-hidden rounded-lg border-border/70 p-3 shadow-sm transition-shadow hover:shadow-md sm:p-5">
            <SectionHeader
              icon={Crown}
              eyebrow={leaderboard.data?.source ? `Source: ${leaderboard.data.source}` : "Ranking"}
              title="Leaderboard"
              action={<Badge variant="outline">{leaderboard.data?.total ?? 0} ranked</Badge>}
            />
            <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:mt-4 sm:flex-wrap sm:overflow-visible sm:px-0">
              {leaderboardOptions.map((option) => (
                <Button
                  key={option.key}
                  type="button"
                  variant={leaderboardType === option.key ? "default" : "outline"}
                  size="sm"
                  className="h-9 shrink-0 rounded-md px-3 text-xs sm:h-8"
                  aria-pressed={leaderboardType === option.key}
                  onClick={() => setLeaderboardType(option.key)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="mt-3 sm:mt-4">
              {leaderboard.loading ? (
                <InlineLoading label="Loading leaderboard" />
              ) : leaderboard.error ? (
                <ErrorState message={leaderboard.error} onRetry={leaderboard.refetch} />
              ) : leaderboard.data?.items.length === 0 ? (
                <EmptyState icon={Crown} title="No rankings yet" />
              ) : (
                <div className="overflow-hidden rounded-lg border border-border/60 bg-background/60">
                  {leaderboard.data?.items.map((entry) => (
                    <LeaderboardRow key={`${entry.rank}-${entry.userId ?? entry.teamId ?? "entry"}`} entry={entry} currentUserId={currentUser?.id} />
                  ))}
                </div>
              )}
            </div>
          </Card>

          <section className="min-w-0 space-y-3 sm:space-y-4">
            <SectionHeader
              icon={Award}
              eyebrow={`${earnedBadges.length} earned`}
              title="Achievements"
              action={<Badge variant="outline">{badges.data?.length ?? 0} total</Badge>}
            />
            <FilterBar
              value={badgeFilter}
              onChange={setBadgeFilter}
              options={[
                { value: "earned", label: "Earned" },
                { value: "locked", label: "Locked" },
                { value: "all", label: "All" },
              ]}
            />
            <div className="mt-3 sm:mt-4">
              {badges.loading ? (
                <InlineLoading label="Loading achievements" />
              ) : badges.error ? (
                <ErrorState message={badges.error} onRetry={badges.refetch} />
              ) : filteredBadges.length === 0 ? (
                <EmptyState icon={Award} title="No matching achievements" />
              ) : (
                <>
                  <div className="grid min-w-0 gap-3">
                    {visibleBadges.map((badge) => (
                      <BadgeCard key={badge.code} badge={badge} compact badgeSkinName={equippedBadgeSkin?.rewardItem.name} />
                    ))}
                  </div>
                  <PagerControls
                    page={badgePage}
                    totalPages={badgePages}
                    totalItems={filteredBadges.length}
                    onPrevious={() => setBadgePage((page) => Math.max(1, page - 1))}
                    onNext={() => setBadgePage((page) => Math.min(badgePages, page + 1))}
                  />
                </>
              )}
            </div>
          </section>

          {teamSummary.data ? (
            <Card className="rounded-lg border-emerald-500/25 bg-emerald-500/[0.03] p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
              <SectionHeader icon={Users} eyebrow="Team" title="Team XP Snapshot" />
              <div className="mt-4 grid gap-3">
                <CompactStat label="Lifetime" value={`${formatNumber(teamSummary.data.balance.lifetimeTeamXp)} XP`} />
                <CompactStat label="Weekly" value={`${formatNumber(teamSummary.data.balance.weeklyTeamXp)} XP`} />
                <CompactStat label="Semester" value={`${formatNumber(teamSummary.data.balance.semesterTeamXp)} XP`} />
              </div>
            </Card>
          ) : null}
        </aside>
      </section>

      <section className="grid min-w-0 gap-5 sm:gap-7 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="rounded-lg border-border/70 p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
          <SectionHeader icon={Clock} eyebrow={`${overview.data?.recentTransactions.length ?? 0} recent`} title="Recent XP Activity" />
          <div className="mt-4">
            {overview.loading ? (
              <InlineLoading label="Loading activity" />
            ) : overview.data?.recentTransactions.length === 0 ? (
              <EmptyState icon={Clock} title="No XP activity yet" />
            ) : (
              <div className="space-y-2">
                {overview.data?.recentTransactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
              </div>
            )}
          </div>
        </Card>

        <section className="min-w-0 space-y-4">
          <SectionHeader icon={BookOpen} eyebrow="Details" title="XP, coins, and values" />
          <Accordion type="multiple" defaultValue={["history"]} className="min-w-0 overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
            <AccordionItem value="history" className="min-w-0 border-border/70 px-3 sm:px-5">
              <AccordionTrigger className="min-w-0 py-3 text-left hover:no-underline sm:py-4 [&>svg]:shrink-0">
                <span className="flex min-w-0 items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">Full XP history</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {history.loading ? (
                  <InlineLoading label="Loading XP history" />
                ) : history.error ? (
                  <ErrorState message={history.error} onRetry={history.refetch} />
                ) : history.data?.items.length === 0 ? (
                  <EmptyState icon={Clock} title="No transactions yet" />
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {history.data?.items.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
                    </div>
                    {(history.data?.totalPages ?? 0) > 1 ? (
                      <div className="flex flex-col gap-2 border-t pt-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          Page {historyPage} of {history.data?.totalPages}
                        </span>
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                          <Button variant="outline" size="sm" className="h-10 sm:h-8" disabled={historyPage <= 1} onClick={() => setHistoryPage((page) => page - 1)}>
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 sm:h-8"
                            disabled={historyPage >= (history.data?.totalPages ?? 1)}
                            onClick={() => setHistoryPage((page) => page + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="coins" className="min-w-0 border-border/70 px-3 sm:px-5">
              <AccordionTrigger className="min-w-0 py-3 text-left hover:no-underline sm:py-4 [&>svg]:shrink-0">
                <span className="flex min-w-0 items-center gap-2">
                  <Coins className="h-4 w-4 text-amber-600" />
                  <span className="truncate">Coin ledger</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {economy.loading ? (
                  <InlineLoading label="Loading coins" />
                ) : economy.error ? (
                  <ErrorState message={economy.error} onRetry={economy.refetch} />
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <CompactStat label="Balance" value={formatNumber(economy.data?.wallet.balance ?? 0)} />
                      <CompactStat label="Earned" value={formatNumber(economy.data?.wallet.lifetimeEarned ?? 0)} />
                      <CompactStat label="Spent" value={formatNumber(economy.data?.wallet.lifetimeSpent ?? 0)} />
                    </div>
                    {economy.data?.recentTransactions.length === 0 ? (
                      <EmptyState icon={Coins} title="No coin transactions yet" />
                    ) : (
                      <div className="space-y-2">
                        {economy.data?.recentTransactions.map((tx) => <CoinTransactionRow key={tx.id} tx={tx} />)}
                      </div>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="rules" className="min-w-0 border-border/70 px-3 sm:px-5">
              <AccordionTrigger className="min-w-0 py-3 text-left hover:no-underline sm:py-4 [&>svg]:shrink-0">
                <span className="flex min-w-0 items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">How to earn XP</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {xpEarningCatalog.map((rule) => <RuleCard key={rule.id} rule={rule} />)}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      </section>

      <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground shadow-sm sm:grid-cols-3">
        <CompactStat label="Monthly XP" value={formatNumber(monthlyXp)} quiet />
        <CompactStat label="Semester XP" value={formatNumber(semesterXp)} quiet />
        <CompactStat label="Last sync" value={balance?.lastRecalculatedAt ? formatDate(balance.lastRecalculatedAt) : "Pending"} quiet />
      </div>
    </div>
  )
}

function PlayerHero({
  avatarUrl,
  coinBalance,
  currentUserName,
  earnedBadgeCount,
  equippedBadgeSkin,
  equippedFrame,
  equippedTheme,
  equippedTitle,
  level,
  lifetimeXp,
  progress,
  weeklyXp,
  xpToNext,
}: {
  avatarUrl?: string
  coinBalance: number
  currentUserName: string
  earnedBadgeCount: number
  equippedBadgeSkin?: string
  equippedFrame?: string
  equippedTheme?: string
  equippedTitle?: string
  level: number
  lifetimeXp: number
  progress: number
  weeklyXp: number
  xpToNext: number
}) {
  const hasCosmetics = Boolean(equippedTitle || equippedFrame || equippedTheme || equippedBadgeSkin)

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md",
        equippedTheme ? getRewardStyle("PROFILE_THEME").cardClass : "border-border/70",
      )}
    >
      <div className="relative">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),transparent_36%,rgba(6,182,212,0.10)_68%,transparent)]" />
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-cyan-400 to-emerald-400" />
        <div className="relative grid gap-3 p-3 sm:gap-6 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-7">
          <div className="min-w-0 space-y-3 sm:space-y-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div
                className={cn(
                  "w-fit rounded-full border-2 bg-background p-1 shadow-sm transition-shadow",
                  equippedFrame ? "border-amber-400 shadow-lg shadow-amber-500/15" : "border-border",
                )}
              >
                <Avatar className="h-12 w-12 sm:h-24 sm:w-24">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="bg-primary text-base font-semibold text-primary-foreground sm:text-xl">
                    {currentUserName[0] ?? "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="max-w-full truncate text-lg font-semibold sm:text-3xl">{currentUserName}</h2>
                  {equippedTitle ? <Badge className={cn("max-w-[130px] truncate rounded-md sm:max-w-none", getRewardStyle("TITLE").badgeClass)}>{equippedTitle}</Badge> : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                  <Badge variant="outline" className="rounded-md border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    <Trophy className="mr-1.5 h-3.5 w-3.5" />
                    Level {level}
                  </Badge>
                  <Badge variant="outline" className="hidden rounded-md sm:inline-flex">
                    <Award className="mr-1.5 h-3.5 w-3.5" />
                    {earnedBadgeCount} achievements
                  </Badge>
                  <Badge variant="outline" className="hidden rounded-md sm:inline-flex">
                    <Coins className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
                    {formatNumber(coinBalance)} coins
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/80 p-2.5 shadow-sm sm:p-4">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground sm:text-sm">Lifetime XP</p>
                  <p className="mt-0.5 truncate text-2xl font-semibold text-foreground sm:text-4xl">{formatNumber(lifetimeXp)}</p>
                </div>
                <div className="max-w-[46%] shrink-0 rounded-lg border border-amber-400/25 bg-amber-500/10 px-2 py-1.5 text-right sm:max-w-none sm:px-3 sm:py-2">
                  <p className="text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300 sm:text-xs">Next level</p>
                  <p className="truncate text-xs font-semibold text-foreground sm:text-sm">{xpToNext > 0 ? `${formatNumber(xpToNext)} XP` : "Max level reached"}</p>
                </div>
              </div>
              <div className="mt-2.5 space-y-2 sm:mt-4">
                <Progress
                  value={progress}
                  className="h-3 bg-muted [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-amber-500 [&_[data-slot=progress-indicator]]:via-cyan-500 [&_[data-slot=progress-indicator]]:to-emerald-500"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground sm:mt-3">
                <span>{progress}% complete</span>
                <span>{formatNumber(weeklyXp)} XP this week</span>
              </div>
            </div>

            {hasCosmetics ? (
              <div className="hidden gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-4">
                {equippedTitle ? <CosmeticMiniPreview type="TITLE" label={equippedTitle} /> : null}
                {equippedFrame ? <CosmeticMiniPreview type="AVATAR_FRAME" label={equippedFrame} /> : null}
                {equippedTheme ? <CosmeticMiniPreview type="PROFILE_THEME" label={equippedTheme} /> : null}
                {equippedBadgeSkin ? <CosmeticMiniPreview type="BADGE_SKIN" label={equippedBadgeSkin} /> : null}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-1">
            <HeroSideStat icon={Zap} label="Lifetime" value={`${formatNumber(lifetimeXp)} XP`} tone="gold" />
            <HeroSideStat icon={Flame} label="This week" value={`${formatNumber(weeklyXp)} XP`} tone="coral" />
            <HeroSideStat icon={Coins} label="Wallet" value={`${formatNumber(coinBalance)} coins`} tone="emerald" />
          </div>
        </div>
      </div>
    </motion.section>
  )
}

function HeroSideStat({ icon: Icon, label, value, tone }: { icon: Icon; label: string; value: string; tone: "gold" | "coral" | "emerald" }) {
  const toneClass = {
    coral: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    gold: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  }[tone]

  return (
    <div className="rounded-lg border border-border/70 bg-background/80 p-2 shadow-sm transition-colors hover:border-primary/25 sm:p-4">
      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md sm:h-10 sm:w-10", toneClass)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium uppercase text-muted-foreground sm:text-xs">{label}</p>
          <p className="truncate text-[11px] font-semibold sm:text-sm">{value}</p>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: Icon; label: string; value: string; tone: "primary" | "gold" | "emerald" | "cyan" | "coral" }) {
  const toneClass = {
    coral: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    cyan: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    gold: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    primary: "bg-primary/10 text-primary",
  }[tone]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
      <Card className="h-full rounded-lg border-border/70 bg-card/95 p-2.5 shadow-sm transition-all hover:border-primary/25 hover:shadow-md sm:p-4">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md sm:h-11 sm:w-11", toneClass)}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase text-muted-foreground">{label}</p>
            <p className="truncate text-lg font-semibold sm:text-xl">{value}</p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function EmptyState({ icon: Icon, title }: { icon: Icon; title: string }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-background shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      {title}
    </div>
  )
}

function CompactStat({ label, value, quiet }: { label: string; value: string; quiet?: boolean }) {
  return (
    <div className={cn("rounded-md border px-3 py-2", quiet ? "border-transparent bg-transparent p-0" : "border-border/70 bg-background/70 shadow-sm")}>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function CosmeticMiniPreview({ type, label }: { type: RewardItem["type"]; label: string }) {
  const style = getRewardStyle(type)
  const Icon = rewardTypeIcons[type] ?? Gift

  return (
    <div className={cn("rounded-md border p-2.5 shadow-sm", style.previewClass)}>
      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", style.iconClass)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{label}</p>
          <p className="text-[11px] text-muted-foreground">{style.shortLabel}</p>
        </div>
      </div>
    </div>
  )
}

function ChallengeCard({ progress, claiming, onClaim }: { progress: QuestProgress; claiming: boolean; onClaim: () => void }) {
  const complete = Boolean(progress.completedAt)
  const claimed = Boolean(progress.claimedAt)
  const expiresLabel = progress.windowEndsAt ? `Ends ${formatDate(progress.windowEndsAt)}` : progress.windowLabel
  const statusLabel = claimed ? "Claimed" : complete ? "Complete" : `${Math.round(progress.progressPercentage)}%`

  return (
    <motion.div className="h-full min-w-0" whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
      <Card
        className={cn(
          "group h-full overflow-hidden rounded-lg border p-3 shadow-sm transition-all hover:border-primary/25 hover:shadow-md sm:p-4",
          progress.claimable ? "border-emerald-500/35 bg-emerald-500/[0.04] shadow-emerald-500/10" : "border-border/70 bg-card",
        )}
      >
        <div className="flex h-full flex-col gap-3 sm:gap-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md shadow-sm transition-transform group-hover:scale-105 sm:h-11 sm:w-11",
                complete ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-primary/10 text-primary",
              )}
            >
              <Target className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 flex-1 text-sm font-semibold leading-5">{progress.quest.title}</h3>
                <Badge variant={progress.claimable ? "default" : "outline"} className="rounded-md text-xs">
                  {statusLabel}
                </Badge>
              </div>
              <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground sm:line-clamp-2">{progress.quest.description}</p>
            </div>
          </div>

          <div className="mt-auto space-y-2 sm:space-y-3">
            <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5 sm:p-3">
              <Progress
                value={progress.progressPercentage}
                className={cn(
                  "h-2.5 bg-muted",
                  progress.claimable
                    ? "[&_[data-slot=progress-indicator]]:bg-emerald-500"
                    : "[&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-primary [&_[data-slot=progress-indicator]]:to-cyan-500",
                )}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {formatNumber(progress.currentValue)} / {formatNumber(progress.targetValue)} {formatQuestMetric(progress.quest.metric)}
                </span>
                <span>{expiresLabel}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex w-fit items-center gap-1 rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 sm:px-2.5 sm:py-1.5 sm:text-sm">
                <Coins className="h-4 w-4" />
                {formatNumber(progress.quest.coinReward)}
              </span>
              <Button size="sm" className="h-8 rounded-md px-2.5 text-xs" disabled={!progress.claimable || claiming || claimed} onClick={onClaim}>
                {claiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {claimed ? "Claimed" : "Claim"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function RewardCard({
  item,
  coinBalance,
  purchasing,
  equipping,
  onPurchase,
  onEquip,
}: {
  item: RewardItem
  coinBalance: number
  purchasing: boolean
  equipping: boolean
  onPurchase: () => void
  onEquip: (equipped: boolean) => void
}) {
  const affordable = coinBalance >= item.cost
  const soldOut = item.inventory === 0
  const equipped = Boolean(item.purchase?.isEquipped)
  const style = getRewardStyle(item.type)
  const Icon = rewardTypeIcons[item.type] ?? Gift
  const disabled = item.owned ? equipping : !affordable || soldOut || purchasing
  const actionLabel = item.owned ? (equipped ? "Unequip" : "Equip") : soldOut ? "Sold out" : affordable ? "Buy" : "Need coins"

  return (
    <motion.div className="h-full min-w-0" whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
      <Card className={cn("group h-full overflow-hidden rounded-lg border p-3 shadow-sm transition-all hover:shadow-md sm:p-4", style.cardClass)}>
        <div className="flex h-full flex-col gap-3 sm:gap-4">
          <div className="flex items-start gap-3">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md shadow-sm transition-transform group-hover:scale-105 sm:h-11 sm:w-11", style.iconClass)}>
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 flex-1 text-sm font-semibold leading-5">{item.name}</h3>
                {equipped ? <Badge className="rounded-md text-xs">Equipped</Badge> : item.owned ? <Badge variant="secondary" className="rounded-md text-xs">Owned</Badge> : null}
              </div>
              <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground sm:line-clamp-2">{item.description}</p>
            </div>
          </div>

          <div className={cn("rounded-lg border p-2.5 shadow-sm sm:p-3", style.previewClass)}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{style.previewLabel}</p>
                <p className="text-[11px] text-muted-foreground">{style.shortLabel}</p>
              </div>
              <span className={cn("h-8 w-8 shrink-0 rounded-full bg-gradient-to-br shadow-sm ring-1 ring-background sm:h-9 sm:w-9", style.swatchClass)} />
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-2.5 sm:gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("rounded-md text-xs", style.badgeClass)}>
                {formatRewardType(item.type)}
              </Badge>
              {item.inventory !== null ? <Badge variant="outline" className="rounded-md text-xs">{formatNumber(item.inventory)} left</Badge> : null}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex w-fit items-center gap-1 rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 sm:px-2.5 sm:py-1.5 sm:text-sm">
                <Coins className="h-4 w-4" />
                {formatNumber(item.cost)}
              </span>
              <Button
                size="sm"
                className={cn("h-8 rounded-md px-2.5 text-xs", !item.owned && affordable && !soldOut ? style.actionClass : undefined)}
                disabled={disabled}
                variant={item.owned || !affordable || soldOut ? "outline" : "default"}
                onClick={() => (item.owned ? onEquip(!equipped) : onPurchase())}
              >
                {purchasing || equipping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingBag className="mr-2 h-4 w-4" />}
                {actionLabel}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function BadgeCard({ badge, compact, badgeSkinName }: { badge: BadgeInfo; compact?: boolean; badgeSkinName?: string }) {
  const Icon = badgeIcons[badge.icon ?? "star"] ?? Star
  const rarity = badge.rarity?.toUpperCase() ?? "COMMON"

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "group relative min-w-0 overflow-hidden rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md",
        badgeSkinName && badge.earned ? "ring-1 ring-amber-400/40" : "",
        badge.earned ? rarityColors[rarity] ?? "border-border/70" : "border-border/70 opacity-70",
      )}
    >
      {badge.earned ? <div className={cn("absolute inset-y-0 left-0 w-1", rarityBg[rarity] ?? "bg-muted")} /> : null}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md shadow-sm transition-transform group-hover:scale-105",
            badge.earned ? rarityBg[rarity] ?? "bg-muted" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{badge.name}</h3>
            {badge.earned ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />}
          </div>
          {!compact ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{badge.description}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-md text-xs capitalize">
              {rarity.toLowerCase()}
            </Badge>
            {badge.xpReward ? <span className="text-xs text-muted-foreground">+{badge.xpReward} XP</span> : null}
            {badgeSkinName && badge.earned ? <Badge variant="secondary" className="rounded-md text-xs">{badgeSkinName}</Badge> : null}
          </div>
          {badge.earned && badge.unlockedAt ? <p className="mt-1 text-xs text-muted-foreground">Earned {formatDate(badge.unlockedAt)}</p> : null}
        </div>
      </div>
    </motion.div>
  )
}

function LeaderboardRow({ entry, currentUserId }: { entry: LeaderboardEntry; currentUserId?: string }) {
  const isMe = entry.userId === currentUserId
  const name = entry.user ? `${entry.user.firstName} ${entry.user.lastName}`.trim() : entry.team?.name ?? "Unknown"
  const initials = entry.user ? getInitials(entry.user.firstName, entry.user.lastName) : entry.team?.name?.[0] ?? "?"
  const rankIcons = [
    { icon: Trophy, color: "text-amber-600", bg: "bg-amber-500/15" },
    { icon: Medal, color: "text-slate-500", bg: "bg-slate-500/10" },
    { icon: Medal, color: "text-orange-700", bg: "bg-orange-500/10" },
  ]
  const rankMeta = entry.rank <= 3 ? rankIcons[entry.rank - 1] : null
  const RankIcon = rankMeta?.icon ?? Award

  return (
    <motion.div
      whileHover={{ x: 2 }}
      transition={{ duration: 0.18 }}
      className={cn("flex min-w-0 items-center gap-2 border-b border-border/60 p-3 transition-colors last:border-b-0 hover:bg-muted/35 sm:gap-3", isMe && "bg-primary/5")}
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md shadow-sm", rankMeta?.bg ?? "bg-muted")}>
        <RankIcon className={cn("h-4 w-4", rankMeta?.color ?? "text-muted-foreground")} />
      </span>
      <span className="w-6 shrink-0 text-center text-sm font-semibold text-muted-foreground sm:w-7">{entry.rank}</span>
      <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/70">
        <AvatarImage src={entry.user?.avatarUrl ?? undefined} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{name}</p>
          {isMe ? <Badge variant="secondary" className="rounded-md text-[10px]">You</Badge> : null}
        </div>
        {entry.breakdown?.level ? <p className="text-xs text-muted-foreground">Level {entry.breakdown.level}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-primary">{formatNumber(Math.round(entry.score ?? 0))}</p>
        <p className="text-xs text-muted-foreground">XP</p>
      </div>
    </motion.div>
  )
}

function TransactionRow({ tx }: { tx: XpTransaction }) {
  const isCredit = tx.direction === "CREDIT"
  const isFrozen = tx.status === "FROZEN"
  const isRejected = tx.status === "REJECTED"
  const isReversed = tx.status === "REVERSED"
  const amountClass = isFrozen
    ? "text-amber-700 dark:text-amber-300"
    : isRejected || isReversed
      ? "text-muted-foreground"
      : isCredit
        ? "text-emerald-600 dark:text-emerald-300"
        : "text-rose-600 dark:text-rose-300"

  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[36px_minmax(0,1fr)_auto] gap-x-2 gap-y-1 rounded-lg border p-2.5 shadow-sm transition-colors hover:border-primary/20 hover:bg-muted/20 sm:flex sm:p-3 sm:items-center sm:gap-3",
        isFrozen ? "border-amber-500/30 bg-amber-500/[0.05]" : "border-border/70 bg-card",
        isRejected || isReversed ? "opacity-75" : "",
      )}
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md shadow-sm sm:h-10 sm:w-10", isCredit ? "bg-emerald-500/10" : "bg-rose-500/10", isFrozen && "bg-amber-500/10")}>
          {isCredit ? <ArrowUp className={cn("h-4 w-4 text-emerald-600", isFrozen && "text-amber-700")} /> : <ArrowDown className="h-4 w-4 text-rose-600" />}
      </span>
      <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-medium">{tx.reason}</p>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</span>
            <Badge variant={isFrozen ? "secondary" : isRejected ? "destructive" : "outline"} className="rounded-md px-1.5 py-0 text-[10px]">
              {tx.status.replaceAll("_", " ")}
            </Badge>
            <Badge variant="outline" className="max-w-[112px] truncate rounded-md px-1.5 py-0 text-[10px] sm:max-w-none">
              <span className="sm:hidden">{formatCompactSourceLabel(tx.sourceType)}</span>
              <span className="hidden sm:inline">{formatSourceLabel(tx.sourceType)}</span>
            </Badge>
          </div>
      </div>
      <span className={cn("shrink-0 self-start pt-0.5 text-right text-sm font-semibold sm:self-auto sm:pt-0 sm:text-right", amountClass)}>
        {isCredit ? "+" : "-"}
        {formatNumber(tx.amount)} XP
      </span>
    </div>
  )
}

function CoinTransactionRow({ tx }: { tx: CoinTransaction }) {
  const isCredit = tx.direction === "CREDIT"

  return (
    <div className="grid min-w-0 grid-cols-[36px_minmax(0,1fr)_auto] gap-x-2 gap-y-1 rounded-lg border border-border/70 bg-card p-2.5 shadow-sm transition-colors hover:border-primary/20 hover:bg-muted/20 sm:flex sm:items-center sm:gap-3 sm:p-3">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md shadow-sm sm:h-10 sm:w-10", isCredit ? "bg-emerald-500/10" : "bg-rose-500/10")}>
          {isCredit ? <ArrowUp className="h-4 w-4 text-emerald-600" /> : <ArrowDown className="h-4 w-4 text-rose-600" />}
      </span>
      <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-medium">{tx.reason}</p>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</span>
            <Badge variant="outline" className="max-w-[112px] truncate rounded-md px-1.5 py-0 text-[10px]">
              <span className="sm:hidden">{formatCompactSourceLabel(tx.sourceType)}</span>
              <span className="hidden sm:inline">{formatSourceLabel(tx.sourceType)}</span>
            </Badge>
          </div>
      </div>
      <span className={cn("shrink-0 self-start pt-0.5 text-right text-sm font-semibold sm:self-auto sm:pt-0 sm:text-right", isCredit ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
        {isCredit ? "+" : "-"}
        {formatNumber(tx.amount)}
      </span>
    </div>
  )
}

function RuleCard({ rule }: { rule: (typeof xpEarningCatalog)[number] }) {
  return (
    <Card className="rounded-lg border-border/70 p-4 shadow-sm transition-all hover:border-primary/25 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary shadow-sm">
          <Zap className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{rule.name}</h3>
          {rule.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{rule.description}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-md text-xs capitalize">
              {rule.eventType.replaceAll("_", " ").toLowerCase()}
            </Badge>
            <Badge className="rounded-md border-primary/20 bg-primary/10 text-xs text-primary">{rule.xpLabel}</Badge>
            <Badge variant="outline" className="rounded-md text-xs capitalize">
              {rule.targetType}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  )
}
