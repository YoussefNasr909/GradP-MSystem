"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import type { ComponentType } from "react"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useGamificationBadges, useGamificationOverview, useLeaderboard } from "@/lib/hooks/use-gamification"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Trophy, Zap, Award, Crown, ChevronRight, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

const XP_PER_LEVEL = 100

function xpForLevel(level: number) {
  return level * level * XP_PER_LEVEL
}

function levelProgress(lifetimeXp: number, level: number) {
  const current = xpForLevel(Math.max(0, level - 1))
  const next = xpForLevel(level)
  const span = Math.max(1, next - current)
  const value = Math.min(100, Math.max(0, ((lifetimeXp - current) / span) * 100))
  return Math.round(value)
}

function toInitials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?"
}

export function GamificationTab() {
  const { currentUser } = useAuthStore()
  const overview = useGamificationOverview()
  const badges = useGamificationBadges()
  const leaderboard = useLeaderboard("INDIVIDUAL_WEEKLY", 1, 5)

  if (overview.loading || badges.loading || leaderboard.loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">Loading gamification data...</p>
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </Card>
    )
  }

  const loadError = overview.error || badges.error || leaderboard.error
  if (loadError) {
    return (
      <Card className="p-6 space-y-3">
        <p className="text-sm text-destructive">{loadError}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void overview.refetch()
            void badges.refetch()
            void leaderboard.refetch()
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </Card>
    )
  }

  const balance = overview.data?.balance
  const lifetimeXp = balance?.lifetimeXp ?? 0
  const weeklyXp = balance?.weeklyXp ?? 0
  const level = balance?.level ?? 1
  const progress = levelProgress(lifetimeXp, level)
  const xpRemaining = Math.max(0, xpForLevel(level) - lifetimeXp)

  const earnedBadges = (badges.data ?? []).filter((b) => b.earned).slice(0, 4)
  const ranked = leaderboard.data?.items ?? []
  const myRank = ranked.find((entry) => entry.userId === currentUser?.id)?.rank ?? null

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-6 border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Your XP Progress</h3>
                <p className="text-sm text-muted-foreground">Live progress from the gamification engine</p>
              </div>
            </div>
            <Badge variant="outline">Level {level}</Badge>
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-5">
            <StatPill label="Lifetime XP" value={lifetimeXp.toLocaleString()} icon={Zap} />
            <StatPill label="Weekly XP" value={weeklyXp.toLocaleString()} icon={Trophy} />
            <StatPill label="Badges" value={String((badges.data ?? []).filter((b) => b.earned).length)} icon={Award} />
            <StatPill label="Weekly Rank" value={myRank ? `#${myRank}` : "-"} icon={Crown} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Level {level}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2.5" />
            <p className="text-xs text-muted-foreground">{xpRemaining.toLocaleString()} XP to level {level + 1}</p>
          </div>
        </Card>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                Recent Badges
              </h4>
              <Badge variant="outline">{(badges.data ?? []).filter((b) => b.earned).length}</Badge>
            </div>
            {earnedBadges.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No badges earned yet.</p>
            ) : (
              <div className="space-y-2.5">
                {earnedBadges.map((badge) => (
                  <div key={badge.code} className="p-3 rounded-xl border border-border/50 bg-muted/20">
                    <p className="text-sm font-medium">{badge.name}</p>
                    <p className="text-xs text-muted-foreground">{badge.description}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                Weekly Leaderboard
              </h4>
              <Badge variant="outline">Top 5</Badge>
            </div>
            {ranked.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No rankings yet.</p>
            ) : (
              <div className="space-y-2">
                {ranked.map((entry) => {
                  const isCurrentUser = entry.userId === currentUser?.id
                  const name = entry.user
                    ? `${entry.user.firstName} ${entry.user.lastName}`.trim()
                    : entry.team?.name ?? "Unknown"

                  return (
                    <div
                      key={`${entry.rank}-${entry.userId ?? entry.teamId ?? "unknown"}`}
                      className={cn(
                        "flex items-center gap-3 rounded-xl p-2.5 border border-transparent",
                        isCurrentUser && "bg-primary/5 border-primary/25",
                      )}
                    >
                      <div className="w-7 text-center font-semibold text-sm">{entry.rank}</div>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={entry.user?.avatarUrl ?? undefined} />
                        <AvatarFallback>{toInitials(entry.user?.firstName, entry.user?.lastName)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm truncate", isCurrentUser && "text-primary font-medium")}>
                          {name}
                          {isCurrentUser ? " (You)" : ""}
                        </p>
                      </div>
                      <p className="text-sm font-bold">{Math.round(entry.score).toLocaleString()}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Link href="/dashboard/gamification">
          <Button className="w-full" size="lg">
            Open Full Gamification Hub
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </motion.div>
    </div>
  )
}

function StatPill({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <div className="p-3 rounded-xl border border-border/50 bg-muted/20">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  )
}
