"use client"

import { useState } from "react"
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
  ShieldAlert,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  useGamificationOverview,
  useGamificationHistory,
  useGamificationBadges,
  useLeaderboard,
  useGamificationRules,
  useTeamGamificationSummary,
} from "@/lib/hooks/use-gamification"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import type { XpTransaction, BadgeInfo, LeaderboardEntry, GamificationRule } from "@/lib/api/gamification"

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
  const [activeTab, setActiveTab] = useState("overview")
  const [leaderboardType, setLeaderboardType] = useState("INDIVIDUAL_WEEKLY")
  const [historyPage, setHistoryPage] = useState(1)

  const overview = useGamificationOverview()
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
  const progress = xpProgress(lifetimeXp, level)

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
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="glass-card w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview"><Trophy className="h-4 w-4 mr-1.5" /> Overview</TabsTrigger>
          <TabsTrigger value="badges"><Award className="h-4 w-4 mr-1.5" /> Badges</TabsTrigger>
          <TabsTrigger value="leaderboard"><Crown className="h-4 w-4 mr-1.5" /> Leaderboard</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1.5" /> History</TabsTrigger>
          <TabsTrigger value="rules"><BookOpen className="h-4 w-4 mr-1.5" /> Rules</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {overview.loading ? <LoadingState /> : overview.error ? <ErrorState message={overview.error} onRetry={overview.refetch} /> : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatsCard icon={Zap} label="Lifetime XP" value={lifetimeXp.toLocaleString()} color="text-yellow-500" bg="bg-yellow-500/10" />
                <StatsCard icon={Flame} label="Weekly XP" value={weeklyXp.toLocaleString()} color="text-orange-500" bg="bg-orange-500/10" />
                <StatsCard icon={Clock} label="Monthly XP" value={monthlyXp.toLocaleString()} color="text-cyan-500" bg="bg-cyan-500/10" />
                <StatsCard icon={Sparkles} label="Semester XP" value={semesterXp.toLocaleString()} color="text-indigo-500" bg="bg-indigo-500/10" />
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
                      <BadgeCard key={badge.code} badge={badge} compact />
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
                {badges.data?.map((badge) => <BadgeCard key={badge.code} badge={badge} />)}
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
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 p-3 rounded-xl glass-card border border-border/30">
      <div className={cn("p-2 rounded-lg", isCredit ? "bg-green-500/10" : "bg-red-500/10")}>
        {isCredit ? <ArrowUp className="h-4 w-4 text-green-500" /> : <ArrowDown className="h-4 w-4 text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tx.reason}</p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
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
      <span className={cn("text-sm font-bold", isCredit ? "text-green-500" : "text-red-500")}>
        {isCredit ? "+" : "-"}{tx.amount} XP
      </span>
    </motion.div>
  )
}

function BadgeCard({ badge, compact }: { badge: BadgeInfo; compact?: boolean }) {
  const Icon = badgeIcons[badge.icon ?? "star"] ?? Star
  const rarity = badge.rarity?.toUpperCase() ?? "COMMON"
  return (
    <motion.div whileHover={{ scale: 1.03, y: -2 }} className={cn(
      "glass-card p-4 rounded-xl border transition-all",
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
