"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useAuthStore } from "@/lib/stores/auth-store"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Trophy, Star, Zap, Target, Users, Flame, Award, Medal,
  CheckCircle2, Crown, Clock, ChevronRight, Sparkles, Lock,
  BookOpen, Code, GitBranch, FileText, Rocket, Shield, ArrowUp,
  ArrowDown, History, Loader2, AlertCircle, RefreshCw,
  ShieldAlert, Coins, ShoppingBag, Gift,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import {
  useGamificationOverview,
  useGamificationHistory,
  useGamificationBadges,
  useLeaderboard,
  useGamificationRules,
  useTeamGamificationSummary,
} from "@/lib/hooks/use-gamification"
import { useEconomyOverview } from "@/lib/hooks/use-economy"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import type { XpTransaction, BadgeInfo, LeaderboardEntry, GamificationRule } from "@/lib/api/gamification"
import { economyApi, type CoinTransaction, type QuestProgress, type RewardItem } from "@/lib/api/economy"

// ─── Helpers ─────────────────────────────────────────────────

const XP_PER_LEVEL = 100
function xpForLevel(level: number) { return level * level * XP_PER_LEVEL }
function xpProgress(lifetimeXp: number, level: number) {
  const currentLevelXp = xpForLevel(level - 1)
  const nextLevelXp = xpForLevel(level)
  const range = nextLevelXp - currentLevelXp
  if (range <= 0) return 100
  return Math.min(100, Math.round(((lifetimeXp - currentLevelXp) / range) * 100))
}

const rarityColors: Record<string, string> = {
  COMMON: "border-gray-400", RARE: "border-blue-500",
  EPIC: "border-purple-500", LEGENDARY: "border-yellow-500",
}
const rarityBg: Record<string, string> = {
  COMMON: "bg-gray-400/10", RARE: "bg-blue-500/10",
  EPIC: "bg-purple-500/10", LEGENDARY: "bg-yellow-500/10",
}

const badgeIcons: Record<string, any> = {
  target: Target, trophy: Trophy, star: Star, flame: Flame,
  code: Code, "git-branch": GitBranch, "file-text": FileText,
  users: Users, rocket: Rocket, shield: Shield, award: Award,
  "book-open": BookOpen, zap: Zap, crown: Crown, sparkles: Sparkles,
  "help-circle": AlertCircle, medal: Medal, clock: Clock,
}

function formatDate(d: string | null) {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatSourceLabel(sourceType: string) {
  if (!sourceType) return "Unknown"
  return sourceType.replaceAll("_", " ")
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-muted-foreground mb-4">{message}</p>
      {onRetry && <Button variant="outline" onClick={onRetry}><RefreshCw className="h-4 w-4 mr-2" /> Retry</Button>}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────

export default function GamificationPage() {
  const { currentUser } = useAuthStore()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("overview")
  const [leaderboardType, setLeaderboardType] = useState("INDIVIDUAL_WEEKLY")
  const [historyPage, setHistoryPage] = useState(1)
  const [claimingQuestId, setClaimingQuestId] = useState<string | null>(null)
  const [purchasingRewardId, setPurchasingRewardId] = useState<string | null>(null)
  const [equippingPurchaseId, setEquippingPurchaseId] = useState<string | null>(null)
  const [seenQuestToastIds, setSeenQuestToastIds] = useState<Set<string>>(new Set())

  const overview = useGamificationOverview()
  const economy = useEconomyOverview()
  const badges = useGamificationBadges()
  const history = useGamificationHistory(historyPage)
  const leaderboard = useLeaderboard(leaderboardType)
  const rules = useGamificationRules()
  const canReviewGamification = ["admin", "doctor", "ta"].includes((currentUser?.role ?? "").toLowerCase())
  const canHaveOwnTeam = ["leader", "member", "student"].includes((currentUser?.role ?? "").toLowerCase())
  const myTeamState = useMyTeamState(canHaveOwnTeam)
  const teamSummary = useTeamGamificationSummary(myTeamState.data?.team?.id ?? null)

  const balance = overview.data?.balance
  const level = balance?.level ?? 1
  const lifetimeXp = balance?.lifetimeXp ?? 0
  const weeklyXp = balance?.weeklyXp ?? 0
  const monthlyXp = balance?.monthlyXp ?? 0
  const semesterXp = balance?.semesterXp ?? 0
  const pendingXp = balance?.pendingXp ?? 0
  const frozenXp = balance?.frozenXp ?? 0
  const progress = xpProgress(lifetimeXp, level)
  const coinBalance = economy.data?.wallet.balance ?? 0
  const equippedTitle = economy.data?.equippedRewards.find((purchase) => purchase.rewardItem.type === "TITLE")
  const equippedFrame = economy.data?.equippedRewards.find((purchase) => purchase.rewardItem.type === "AVATAR_FRAME")
  const equippedBadgeSkin = economy.data?.equippedRewards.find((purchase) => purchase.rewardItem.type === "BADGE_SKIN")

  useEffect(() => {
    const newlyClaimable = economy.data?.quests.filter((quest) => quest.claimable && !seenQuestToastIds.has(quest.id)) ?? []
    if (newlyClaimable.length === 0) return

    const first = newlyClaimable[0]
    toast({
      title: "Quest reward ready",
      description: `${first.quest.title} can be claimed for ${first.quest.coinReward} coins.`,
    })
    setSeenQuestToastIds((current) => new Set([...current, ...newlyClaimable.map((quest) => quest.id)]))
  }, [economy.data?.quests, seenQuestToastIds, toast])

  async function handleClaimQuest(progressId: string) {
    setClaimingQuestId(progressId)
    try {
      await economyApi.claimQuest(progressId)
      economy.refetch()
      toast({ title: "Quest reward claimed", description: "Coins were added to your wallet." })
    } catch (error: any) {
      toast({ title: "Could not claim quest", description: error?.message ?? "Please try again.", variant: "destructive" })
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
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" /> Gamification Hub
          </h1>
          <p className="text-muted-foreground mt-1">Track your XP, earn badges, and climb the leaderboard</p>
        </div>
        <div className="flex items-center gap-3">
          {canReviewGamification && (
            <Button variant="outline" asChild>
              <Link href="/dashboard/gamification/admin">
                <ShieldAlert className="h-4 w-4 mr-1.5" /> Review
              </Link>
            </Button>
          )}
          <Badge variant="outline" className="text-sm px-3 py-1.5 glass-card">
            <Flame className="h-4 w-4 mr-1.5 text-orange-500" /> Level {level}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1.5 glass-card">
            <Zap className="h-4 w-4 mr-1.5 text-yellow-500" /> {lifetimeXp.toLocaleString()} XP
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1.5 glass-card">
            <Coins className="h-4 w-4 mr-1.5 text-amber-500" /> {coinBalance.toLocaleString()} Coins
          </Badge>
          {equippedTitle && (
            <Badge variant="outline" className="text-sm px-3 py-1.5 glass-card">
              <Crown className="h-4 w-4 mr-1.5 text-primary" /> {equippedTitle.rewardItem.name}
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="glass-card w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview"><Trophy className="h-4 w-4 mr-1.5" /> Overview</TabsTrigger>
          <TabsTrigger value="badges"><Award className="h-4 w-4 mr-1.5" /> Badges</TabsTrigger>
          <TabsTrigger value="leaderboard"><Crown className="h-4 w-4 mr-1.5" /> Leaderboard</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1.5" /> History</TabsTrigger>
          <TabsTrigger value="quests"><Target className="h-4 w-4 mr-1.5" /> Quests</TabsTrigger>
          <TabsTrigger value="store"><ShoppingBag className="h-4 w-4 mr-1.5" /> Store</TabsTrigger>
          <TabsTrigger value="coins"><Coins className="h-4 w-4 mr-1.5" /> Coins</TabsTrigger>
          <TabsTrigger value="rules"><BookOpen className="h-4 w-4 mr-1.5" /> Rules</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {overview.loading ? <LoadingState /> : overview.error ? <ErrorState message={overview.error} onRetry={overview.refetch} /> : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
                <StatsCard icon={Zap} label="Lifetime XP" value={lifetimeXp.toLocaleString()} color="text-yellow-500" bg="bg-yellow-500/10" />
                <StatsCard icon={Coins} label="Coins" value={coinBalance.toLocaleString()} color="text-amber-500" bg="bg-amber-500/10" />
                <StatsCard icon={Flame} label="Weekly XP" value={weeklyXp.toLocaleString()} color="text-orange-500" bg="bg-orange-500/10" />
                <StatsCard icon={Clock} label="Monthly XP" value={monthlyXp.toLocaleString()} color="text-cyan-500" bg="bg-cyan-500/10" />
                <StatsCard icon={Sparkles} label="Semester XP" value={semesterXp.toLocaleString()} color="text-indigo-500" bg="bg-indigo-500/10" />
                <StatsCard icon={Clock} label="Pending XP" value={pendingXp.toLocaleString()} color="text-slate-500" bg="bg-slate-500/10" />
                <StatsCard icon={ShieldAlert} label="Frozen XP" value={frozenXp.toLocaleString()} color="text-amber-600" bg="bg-amber-500/10" />
                <StatsCard icon={Trophy} label="Level" value={String(level)} color="text-primary" bg="bg-primary/10" />
              </div>

              {/* Level Progress */}
              <Card className="glass-card p-6 rounded-2xl border border-primary/20">
                <div className="flex items-center gap-4 mb-4">
                  <motion.div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20" animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
                    <Trophy className="h-8 w-8 text-primary" />
                  </motion.div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-3xl font-bold gradient-text">{lifetimeXp.toLocaleString()}</span>
                      <span className="text-muted-foreground">XP</span>
                      <Badge variant="outline" className="ml-2">Level {level}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{xpForLevel(level) - lifetimeXp > 0 ? `${(xpForLevel(level) - lifetimeXp).toLocaleString()} XP to level ${level + 1}` : "Max level reached!"}</p>
                  </div>
                </div>
                <Progress value={progress} className="h-3" />
              </Card>

              {(equippedTitle || equippedFrame || equippedBadgeSkin) && (
                <Card className="glass-card p-6 rounded-2xl border border-amber-500/20">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Gift className="h-5 w-5 text-amber-500" /> Active Cosmetics
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 items-center">
                    <div className={cn(
                      "rounded-full p-1.5 border-2",
                      equippedFrame ? "border-amber-500 bg-amber-500/10" : "border-border",
                    )}>
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={currentUser?.avatarUrl ?? undefined} />
                        <AvatarFallback>{currentUser?.name?.[0] ?? "U"}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{currentUser?.name}</span>
                        {equippedTitle && <Badge variant="secondary">{equippedTitle.rewardItem.name}</Badge>}
                        {equippedFrame && <Badge variant="outline">{equippedFrame.rewardItem.name}</Badge>}
                        {equippedBadgeSkin && <Badge variant="outline">{equippedBadgeSkin.rewardItem.name}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">Equipped rewards show on your gamification profile preview and badge surfaces.</p>
                    </div>
                  </div>
                </Card>
              )}

              {teamSummary.data && (
                <Card className="glass-card p-6 rounded-2xl border border-emerald-500/20">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-500" /> Team XP Snapshot
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatsCard
                      icon={Zap}
                      label="Team Lifetime XP"
                      value={teamSummary.data.balance.lifetimeTeamXp.toLocaleString()}
                      color="text-emerald-500"
                      bg="bg-emerald-500/10"
                    />
                    <StatsCard
                      icon={Flame}
                      label="Team Weekly XP"
                      value={teamSummary.data.balance.weeklyTeamXp.toLocaleString()}
                      color="text-orange-500"
                      bg="bg-orange-500/10"
                    />
                    <StatsCard
                      icon={Sparkles}
                      label="Team Semester XP"
                      value={teamSummary.data.balance.semesterTeamXp.toLocaleString()}
                      color="text-violet-500"
                      bg="bg-violet-500/10"
                    />
                  </div>
                </Card>
              )}

              {/* Recent Transactions */}
              <Card className="glass-card p-6 rounded-2xl">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <History className="h-5 w-5 text-muted-foreground" /> Recent XP Activity
                </h3>
                {overview.data?.recentTransactions?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No XP transactions yet. Complete tasks and submissions to earn XP!</p>
                ) : (
                  <div className="space-y-3">
                    {overview.data?.recentTransactions?.map((tx) => (
                      <TransactionRow key={tx.id} tx={tx} />
                    ))}
                  </div>
                )}
                <Button variant="ghost" className="w-full mt-4" onClick={() => setActiveTab("history")}>
                  View Full History <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Card>

              {/* Earned Badges Preview */}
              <Card className="glass-card p-6 rounded-2xl">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> Recent Badges
                </h3>
                {overview.data?.badges?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No badges earned yet. Keep going!</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {overview.data?.badges?.slice(0, 6).map((badge) => (
                      <BadgeCard key={badge.code} badge={badge} compact badgeSkinName={equippedBadgeSkin?.rewardItem.name} />
                    ))}
                  </div>
                )}
                <Button variant="ghost" className="w-full mt-4" onClick={() => setActiveTab("badges")}>
                  View All Badges <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Card>
            </>
          )}
        </TabsContent>

        {/* BADGES TAB */}
        <TabsContent value="badges" className="mt-6">
          {badges.loading ? <LoadingState /> : badges.error ? <ErrorState message={badges.error} onRetry={badges.refetch} /> : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">All Badges</h2>
                <Badge variant="outline">{badges.data?.filter(b => b.earned).length ?? 0} / {badges.data?.length ?? 0} earned</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {badges.data?.map((badge) => <BadgeCard key={badge.code} badge={badge} badgeSkinName={equippedBadgeSkin?.rewardItem.name} />)}
              </div>
            </div>
          )}
        </TabsContent>

        {/* LEADERBOARD TAB */}
        <TabsContent value="leaderboard" className="mt-6">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "INDIVIDUAL_WEEKLY", label: "Weekly" },
                { key: "INDIVIDUAL_SEMESTER", label: "Semester" },
                { key: "INDIVIDUAL_LIFETIME", label: "All-Time" },
                { key: "TEAM_WEEKLY", label: "Teams (Weekly)" },
                { key: "TEAM_SEMESTER", label: "Teams (Semester)" },
              ].map(t => (
                <Button key={t.key} variant={leaderboardType === t.key ? "default" : "outline"} size="sm" onClick={() => setLeaderboardType(t.key)}>
                  {t.label}
                </Button>
              ))}
            </div>
            {leaderboard.loading ? <LoadingState /> : leaderboard.error ? <ErrorState message={leaderboard.error} onRetry={leaderboard.refetch} /> : (
              <>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">Source: {leaderboard.data?.source ?? "unknown"}</Badge>
                  <Badge variant="outline">Total: {leaderboard.data?.total ?? 0}</Badge>
                </div>
                <Card className="glass-card rounded-2xl overflow-hidden">
                  {leaderboard.data?.items?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-12">No rankings yet. Be the first to earn XP!</p>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {leaderboard.data?.items?.map((entry) => (
                        <LeaderboardRow key={entry.rank} entry={entry} currentUserId={currentUser?.id} />
                      ))}
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="mt-6">
          {history.loading ? <LoadingState /> : history.error ? <ErrorState message={history.error} onRetry={history.refetch} /> : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">XP History</h2>
                <Badge variant="outline">{history.data?.total ?? 0} transactions</Badge>
              </div>
              <Card className="glass-card rounded-2xl p-4">
                {history.data?.items?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12">No transactions yet.</p>
                ) : (
                  <div className="space-y-3">
                    {history.data?.items?.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
                  </div>
                )}
              </Card>
              {(history.data?.totalPages ?? 0) > 1 && (
                <div className="flex justify-center gap-2">
                  <Button variant="outline" size="sm" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}>Previous</Button>
                  <span className="text-sm text-muted-foreground self-center">Page {historyPage} of {history.data?.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={historyPage >= (history.data?.totalPages ?? 1)} onClick={() => setHistoryPage(p => p + 1)}>Next</Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* QUESTS TAB */}
        <TabsContent value="quests" className="mt-6">
          {economy.loading ? <LoadingState /> : economy.error ? <ErrorState message={economy.error} onRetry={economy.refetch} /> : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Quests</h2>
                  <p className="text-sm text-muted-foreground">Earn coins from healthy project activity without changing XP rules.</p>
                </div>
                <Badge variant="outline" className="w-fit">
                  <Coins className="h-3.5 w-3.5 mr-1.5 text-amber-500" /> {coinBalance.toLocaleString()} coins
                </Badge>
              </div>
              {economy.data?.quests?.length === 0 ? (
                <Card className="glass-card p-8 rounded-2xl text-center text-muted-foreground">
                  No quests are active right now.
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {economy.data?.quests.map((quest) => (
                    <QuestCard
                      key={quest.id}
                      progress={quest}
                      claiming={claimingQuestId === quest.id}
                      onClaim={() => handleClaimQuest(quest.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* STORE TAB */}
        <TabsContent value="store" className="mt-6">
          {economy.loading ? <LoadingState /> : economy.error ? <ErrorState message={economy.error} onRetry={economy.refetch} /> : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Reward Store</h2>
                  <p className="text-sm text-muted-foreground">Spend coins on profile cosmetics. XP, ranks, and anti-cheat stay untouched.</p>
                </div>
                <Badge variant="outline" className="w-fit">
                  <Coins className="h-3.5 w-3.5 mr-1.5 text-amber-500" /> {coinBalance.toLocaleString()} coins available
                </Badge>
              </div>
              {economy.data?.rewards?.length === 0 ? (
                <Card className="glass-card p-8 rounded-2xl text-center text-muted-foreground">
                  No reward items are available yet.
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {economy.data?.rewards.map((item) => (
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
              )}
            </div>
          )}
        </TabsContent>

        {/* COINS TAB */}
        <TabsContent value="coins" className="mt-6">
          {economy.loading ? <LoadingState /> : economy.error ? <ErrorState message={economy.error} onRetry={economy.refetch} /> : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatsCard icon={Coins} label="Balance" value={(economy.data?.wallet.balance ?? 0).toLocaleString()} color="text-amber-500" bg="bg-amber-500/10" />
                <StatsCard icon={ArrowUp} label="Lifetime Earned" value={(economy.data?.wallet.lifetimeEarned ?? 0).toLocaleString()} color="text-green-500" bg="bg-green-500/10" />
                <StatsCard icon={ArrowDown} label="Lifetime Spent" value={(economy.data?.wallet.lifetimeSpent ?? 0).toLocaleString()} color="text-red-500" bg="bg-red-500/10" />
              </div>
              <Card className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Coin Ledger</h2>
                  <Badge variant="outline">{economy.data?.recentTransactions.length ?? 0} recent</Badge>
                </div>
                {economy.data?.recentTransactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12">No coin transactions yet.</p>
                ) : (
                  <div className="space-y-3">
                    {economy.data?.recentTransactions.map((tx) => <CoinTransactionRow key={tx.id} tx={tx} />)}
                  </div>
                )}
              </Card>
            </div>
          )}
        </TabsContent>

        {/* RULES TAB */}
        <TabsContent value="rules" className="mt-6">
          {rules.loading ? <LoadingState /> : rules.error ? <ErrorState message={rules.error} onRetry={rules.refetch} /> : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">How to Earn XP</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rules.data?.map((rule) => <RuleCard key={rule.id} rule={rule} />)}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function StatsCard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: string; color: string; bg: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.03, y: -2 }}>
      <Card className="glass-card p-5 rounded-xl border border-border/50">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-lg", bg)}><Icon className={cn("h-5 w-5", color)} /></div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function TransactionRow({ tx }: { tx: XpTransaction }) {
  const isCredit = tx.direction === "CREDIT"
  const isFrozen = tx.status === "FROZEN"
  const isRejected = tx.status === "REJECTED"
  const isReversed = tx.status === "REVERSED"
  const amountClass = isFrozen
    ? "text-amber-600"
    : isRejected || isReversed
      ? "text-muted-foreground"
      : isCredit
        ? "text-green-500"
        : "text-red-500"
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl glass-card border",
        isFrozen ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-border/30",
        isRejected || isReversed ? "opacity-75" : "",
      )}
    >
      <div className={cn("p-2 rounded-lg", isCredit ? "bg-green-500/10" : "bg-red-500/10", isFrozen && "bg-amber-500/10")}>
        {isCredit ? (
          <ArrowUp className={cn("h-4 w-4 text-green-500", isFrozen && "text-amber-600")} />
        ) : (
          <ArrowDown className="h-4 w-4 text-red-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tx.reason}</p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
          <Badge
            variant={isFrozen ? "secondary" : isRejected ? "destructive" : "outline"}
            className={cn("text-[10px] py-0 px-1.5", isReversed && "text-muted-foreground")}
          >
            {tx.status.replaceAll("_", " ")}
          </Badge>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
            {formatSourceLabel(tx.sourceType)}
          </Badge>
          {tx.ruleCode ? (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
              {tx.ruleCode}
            </Badge>
          ) : null}
        </div>
      </div>
      <span className={cn("text-sm font-bold", amountClass)}>
        {isCredit ? "+" : "-"}{tx.amount} XP
      </span>
    </motion.div>
  )
}

function formatQuestMetric(metric: string) {
  return metric.replaceAll("_", " ").toLowerCase()
}

function formatRewardType(type: string) {
  return type.replaceAll("_", " ").toLowerCase()
}

function QuestCard({ progress, claiming, onClaim }: { progress: QuestProgress; claiming: boolean; onClaim: () => void }) {
  const complete = Boolean(progress.completedAt)
  const claimed = Boolean(progress.claimedAt)
  const expiresLabel = progress.windowEndsAt ? `Ends ${formatDate(progress.windowEndsAt)}` : progress.windowLabel

  return (
    <Card className="glass-card p-5 rounded-xl border border-border/50">
      <div className="flex items-start gap-3">
        <div className={cn("p-2.5 rounded-lg", complete ? "bg-green-500/10" : "bg-primary/10")}>
          <Target className={cn("h-5 w-5", complete ? "text-green-500" : "text-primary")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm">{progress.quest.title}</h4>
            <Badge variant="outline" className="text-xs capitalize">{progress.quest.type.toLowerCase()}</Badge>
            {claimed && <Badge variant="secondary" className="text-xs">Claimed</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mb-3">{progress.quest.description}</p>
          <Progress value={progress.progressPercentage} className="h-2" />
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <div className="text-xs text-muted-foreground">
              {progress.currentValue.toLocaleString()} / {progress.targetValue.toLocaleString()} {formatQuestMetric(progress.quest.metric)}
              <span className="mx-1">.</span>
              {expiresLabel}
            </div>
            <Button size="sm" disabled={!progress.claimable || claiming} onClick={onClaim}>
              {claiming ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Coins className="h-4 w-4 mr-1.5" />}
              {claimed ? "Claimed" : `Claim ${progress.quest.coinReward}`}
            </Button>
          </div>
        </div>
      </div>
    </Card>
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
  const disabled = !item.owned && (!affordable || soldOut || purchasing)
  const equipped = Boolean(item.purchase?.isEquipped)

  return (
    <motion.div whileHover={{ scale: 1.02, y: -2 }}>
      <Card className="glass-card p-5 rounded-xl border border-border/50 h-full flex flex-col">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2.5 rounded-lg bg-amber-500/10">
            <Gift className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm">{item.name}</h4>
              {item.owned && <Badge variant="secondary" className="text-xs">Owned</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge variant="outline" className="text-xs capitalize">{formatRewardType(item.type)}</Badge>
          {item.inventory !== null && <Badge variant="outline" className="text-xs">{item.inventory} available</Badge>}
        </div>
        <div className="mt-auto flex items-center justify-between gap-3">
          <div className="font-semibold text-amber-600 flex items-center gap-1">
            <Coins className="h-4 w-4" /> {item.cost.toLocaleString()}
          </div>
          <Button
            size="sm"
            disabled={disabled || equipping}
            variant={item.owned ? "outline" : "default"}
            onClick={() => (item.owned ? onEquip(!equipped) : onPurchase())}
          >
            {purchasing || equipping ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ShoppingBag className="h-4 w-4 mr-1.5" />}
            {item.owned ? (equipped ? "Unequip" : "Equip") : soldOut ? "Sold out" : affordable ? "Buy" : "Need coins"}
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

function CoinTransactionRow({ tx }: { tx: CoinTransaction }) {
  const isCredit = tx.direction === "CREDIT"

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl glass-card border border-border/30">
      <div className={cn("p-2 rounded-lg", isCredit ? "bg-green-500/10" : "bg-red-500/10")}>
        {isCredit ? <ArrowUp className="h-4 w-4 text-green-500" /> : <ArrowDown className="h-4 w-4 text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tx.reason}</p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">{formatSourceLabel(tx.sourceType)}</Badge>
        </div>
      </div>
      <span className={cn("text-sm font-bold", isCredit ? "text-green-500" : "text-red-500")}>
        {isCredit ? "+" : "-"}{tx.amount} coins
      </span>
    </div>
  )
}

function BadgeCard({ badge, compact, badgeSkinName }: { badge: BadgeInfo; compact?: boolean; badgeSkinName?: string }) {
  const Icon = badgeIcons[badge.icon ?? "star"] ?? Star
  const rarity = badge.rarity?.toUpperCase() ?? "COMMON"
  return (
    <motion.div whileHover={{ scale: 1.03, y: -2 }} className={cn(
      "glass-card p-4 rounded-xl border transition-all",
      badgeSkinName && badge.earned ? "ring-1 ring-amber-400/50" : "",
      badge.earned ? rarityColors[rarity] ?? "border-border/50" : "border-border/50 opacity-60",
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("p-2.5 rounded-lg", badge.earned ? (rarityBg[rarity] ?? "bg-muted") : "bg-muted")}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <h4 className="font-semibold text-sm truncate">{badge.name}</h4>
            {badge.earned ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> : <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
          </div>
          {!compact && <p className="text-xs text-muted-foreground mb-2">{badge.description}</p>}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs capitalize">{rarity.toLowerCase()}</Badge>
            {badge.xpReward ? <span className="text-xs text-muted-foreground">+{badge.xpReward} XP</span> : null}
            {badgeSkinName && badge.earned ? <Badge variant="secondary" className="text-xs">{badgeSkinName}</Badge> : null}
          </div>
          {badge.earned && badge.unlockedAt && <p className="text-xs text-muted-foreground mt-1">Earned {formatDate(badge.unlockedAt)}</p>}
        </div>
      </div>
    </motion.div>
  )
}

function LeaderboardRow({ entry, currentUserId }: { entry: LeaderboardEntry; currentUserId?: string }) {
  const isMe = entry.userId === currentUserId
  const name = entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : entry.team?.name ?? "Unknown"
  const initials = entry.user ? `${entry.user.firstName?.[0] ?? ""}${entry.user.lastName?.[0] ?? ""}` : entry.team?.name?.[0] ?? "?"
  const rankIcons = [
    { icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { icon: Medal, color: "text-gray-400", bg: "bg-gray-400/10" },
    { icon: Medal, color: "text-orange-600", bg: "bg-orange-600/10" },
  ]
  const ri = entry.rank <= 3 ? rankIcons[entry.rank - 1] : null
  const RankIcon = ri?.icon ?? Award

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: entry.rank * 0.05 }} whileHover={{ scale: 1.01, x: 4 }}
      className={cn("flex items-center gap-4 p-4 transition-all", isMe && "bg-primary/5")}
    >
      <div className={cn("p-2 rounded-lg", ri?.bg ?? "bg-muted")}>
        <RankIcon className={cn("h-5 w-5", ri?.color ?? "text-muted-foreground")} />
      </div>
      <span className="text-lg font-bold w-8 text-center">{entry.rank}</span>
      <Avatar className="h-10 w-10">
        <AvatarImage src={entry.user?.avatarUrl ?? undefined} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm truncate">{name}</h4>
          {isMe && <Badge variant="secondary" className="text-xs">You</Badge>}
        </div>
        {entry.breakdown?.level && <p className="text-xs text-muted-foreground">Level {entry.breakdown.level}</p>}
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-primary">{entry.score?.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">XP</p>
      </div>
    </motion.div>
  )
}

function RuleCard({ rule }: { rule: GamificationRule }) {
  return (
    <Card className="glass-card p-5 rounded-xl border border-border/50">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm mb-1">{rule.name}</h4>
          {rule.description && <p className="text-xs text-muted-foreground mb-2">{rule.description}</p>}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{rule.eventType.replace(/_/g, " ")}</Badge>
            <Badge className="text-xs bg-primary/10 text-primary border-primary/20">+{rule.baseXp} XP</Badge>
            <Badge variant="outline" className="text-xs capitalize">{rule.targetType.toLowerCase()}</Badge>
          </div>
        </div>
      </div>
    </Card>
  )
}
