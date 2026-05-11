"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { motion, AnimatePresence } from "framer-motion"
import {
  Award,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Trophy,
  Target,
  BarChart3,
  Lock,
  Sparkles,
  Download,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth-store"
import { gradesOverviewApi } from "@/lib/api/admin-logs"
import type { GradesOverviewRow, GradesOverviewResponse } from "@/lib/api/admin-logs"
import { reportCardApi } from "@/lib/api/supervisor-tools"
import { toast } from "sonner"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<string, string> = {
  REQUIREMENTS: "Requirements",
  DESIGN: "Design",
  IMPLEMENTATION: "Implementation",
  TESTING: "Testing",
  DEPLOYMENT: "Deployment",
  MAINTENANCE: "Maintenance",
}

const STAGE_COLOR: Record<string, string> = {
  REQUIREMENTS: "border-blue-500/30 text-blue-500 bg-blue-500/5",
  DESIGN: "border-purple-500/30 text-purple-500 bg-purple-500/5",
  IMPLEMENTATION: "border-amber-500/30 text-amber-500 bg-amber-500/5",
  TESTING: "border-cyan-500/30 text-cyan-500 bg-cyan-500/5",
  DEPLOYMENT: "border-green-500/30 text-green-500 bg-green-500/5",
  MAINTENANCE: "border-gray-500/30 text-gray-500 bg-gray-500/5",
}

function gradeColor(grade: number | null) {
  if (grade === null) return "text-muted-foreground"
  if (grade >= 90) return "text-green-500"
  if (grade >= 80) return "text-blue-500"
  if (grade >= 70) return "text-amber-500"
  if (grade >= 60) return "text-orange-500"
  return "text-red-500"
}

function gradeBg(grade: number | null) {
  if (grade === null) return "bg-muted/40"
  if (grade >= 90) return "bg-green-500/10 border-green-500/30"
  if (grade >= 80) return "bg-blue-500/10 border-blue-500/30"
  if (grade >= 70) return "bg-amber-500/10 border-amber-500/30"
  if (grade >= 60) return "bg-orange-500/10 border-orange-500/30"
  return "bg-red-500/10 border-red-500/30"
}

function gradeLetter(grade: number | null) {
  if (grade === null) return "—"
  if (grade >= 90) return "A"
  if (grade >= 80) return "B"
  if (grade >= 70) return "C"
  if (grade >= 60) return "D"
  return "F"
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, accent, delay,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  accent: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="p-5 border-border/50 hover:border-border/80 transition-all hover:shadow-md relative overflow-hidden">
        <div className={cn("absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20", accent)} />
        <div className="flex items-center gap-3 relative">
          <div className={cn("p-2.5 rounded-xl", accent)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

// ─── Team Row Card ──────────────────────────────────────────────────────────

function TeamRow({ row, index }: { row: GradesOverviewRow; index: number }) {
  const [downloading, setDownloading] = useState(false)
  async function handleDownloadPdf() {
    setDownloading(true)
    try {
      await reportCardApi.download(row.teamId, row.teamName)
      toast.success("Report card downloaded")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to download report card")
    } finally {
      setDownloading(false)
    }
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.3 }}
    >
      <Card className="p-5 border-border/50 hover:border-border/80 transition-all hover:shadow-lg group">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1.5fr_auto] items-center">
          {/* Team identity */}
          <div className="flex items-center gap-3 min-w-0">
            <motion.div
              className={cn(
                "h-14 w-14 rounded-2xl flex items-center justify-center font-bold text-lg border-2 shrink-0",
                gradeBg(row.weightedFinal ?? row.averageGrade),
              )}
              whileHover={{ scale: 1.05, rotate: -5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <span className={gradeColor(row.weightedFinal ?? row.averageGrade)}>
                {gradeLetter(row.weightedFinal ?? row.averageGrade)}
              </span>
            </motion.div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-base truncate">{row.teamName}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", STAGE_COLOR[row.stage])}>
                  {STAGE_LABEL[row.stage] ?? row.stage}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> {row.memberCount}
                </span>
              </div>
            </div>
          </div>

          {/* Final grade big number */}
          <div className="text-center lg:text-left">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Final Grade</p>
            <div className="flex items-baseline gap-1.5">
              <span className={cn("text-4xl font-bold tabular-nums", gradeColor(row.weightedFinal ?? row.averageGrade))}>
                {row.weightedFinal ?? row.averageGrade ?? "—"}
              </span>
              {(row.weightedFinal ?? row.averageGrade) !== null && (
                <span className="text-muted-foreground text-sm">/100</span>
              )}
            </div>
          </div>

          {/* Progress bar with submission stats */}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{row.stats.approved}/{row.stats.total} approved</span>
            </div>
            <Progress
              value={row.stats.total > 0 ? (row.stats.approved / row.stats.total) * 100 : 0}
              className="h-1.5"
            />
            <div className="flex items-center gap-2 text-[10px] flex-wrap">
              {row.stats.pendingReview > 0 && (
                <Badge variant="outline" className="border-amber-500/30 text-amber-500 px-1.5 py-0">
                  {row.stats.pendingReview} pending
                </Badge>
              )}
              {row.stats.underReview > 0 && (
                <Badge variant="outline" className="border-blue-500/30 text-blue-500 px-1.5 py-0">
                  {row.stats.underReview} TA reviewed
                </Badge>
              )}
              {row.stats.needsRevision > 0 && (
                <Badge variant="outline" className="border-red-500/30 text-red-500 px-1.5 py-0">
                  {row.stats.needsRevision} revision
                </Badge>
              )}
            </div>
          </div>

          {/* Supervisors + PDF download */}
          <div className="flex items-center gap-2 shrink-0">
            {row.doctor && (
              <Avatar className="h-9 w-9 ring-2 ring-blue-500/30">
                <AvatarImage src={row.doctor.avatarUrl ?? undefined} />
                <AvatarFallback className="text-xs bg-blue-500/10 text-blue-500">
                  {getInitials(row.doctor.fullName)}
                </AvatarFallback>
              </Avatar>
            )}
            {row.ta && (
              <Avatar className="h-9 w-9 ring-2 ring-cyan-500/30">
                <AvatarImage src={row.ta.avatarUrl ?? undefined} />
                <AvatarFallback className="text-xs bg-cyan-500/10 text-cyan-500">
                  {getInitials(row.ta.fullName)}
                </AvatarFallback>
              </Avatar>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-9 ml-1"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); void handleDownloadPdf() }}
              disabled={downloading}
            >
              {downloading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  <Download className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Phase breakdown bar */}
        {Object.keys(row.phaseAverages).length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/40">
            <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              {["REQUIREMENTS", "DESIGN", "IMPLEMENTATION", "TESTING", "DEPLOYMENT", "MAINTENANCE"].map((phase) => {
                const score = row.phaseAverages[phase]
                return (
                  <div key={phase} className="text-center">
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1 truncate">
                      {STAGE_LABEL[phase]}
                    </p>
                    <p className={cn("text-sm font-semibold tabular-nums", gradeColor(score ?? null))}>
                      {score !== undefined ? score : "—"}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function GradesOverviewPage() {
  const { currentUser } = useAuthStore()
  const [data, setData] = useState<GradesOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [refreshing, setRefreshing] = useState(false)

  const canView = currentUser?.role === "admin" || currentUser?.role === "doctor"

  const fetchData = useCallback(async () => {
    setError(false)
    try {
      const res = await gradesOverviewApi.get({ search: search || undefined, stage: stageFilter })
      setData(res)
    } catch {
      setError(true)
    }
  }, [search, stageFilter])

  useEffect(() => {
    if (!canView) return
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [canView, fetchData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const topTeams = useMemo(() => {
    if (!data) return []
    return [...data.rows]
      .filter((r) => r.weightedFinal !== null || r.averageGrade !== null)
      .sort((a, b) => (b.weightedFinal ?? b.averageGrade ?? 0) - (a.weightedFinal ?? a.averageGrade ?? 0))
      .slice(0, 3)
  }, [data])

  if (!canView) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="min-h-[60vh] flex items-center justify-center">
        <Card className="p-12 text-center max-w-md border-border/50">
          <Lock className="h-16 w-16 mx-auto mb-6 text-destructive" />
          <h2 className="text-2xl font-bold mb-3">Access Denied</h2>
          <p className="text-muted-foreground">Grades Overview is only available to admins and doctors.</p>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* Hero */}
      <div className="rounded-2xl p-6 border border-border/50 relative overflow-hidden bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-purple-500/5" />
        <motion.div
          className="absolute -right-20 -top-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <motion.h1
              className="text-3xl font-bold mb-1.5 flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            >
              <Trophy className="h-7 w-7 text-amber-500" />
              Grades Overview
            </motion.h1>
            <motion.p className="text-muted-foreground"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              Final grades across every team, weighted by SDLC phase
            </motion.p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      {loading || !data ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-14 w-full" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Total Teams"        value={data.summary.totalTeams}        icon={Users}        accent="bg-blue-500"   delay={0} />
          <StatCard label="Global Average"     value={`${data.summary.globalAverage}/100`} icon={TrendingUp} accent="bg-amber-500"  delay={0.05} />
          <StatCard label="Submissions Graded" value={data.summary.totalApproved}     icon={CheckCircle2} accent="bg-green-500"  delay={0.1} />
          <StatCard label="Awaiting Action"    value={data.summary.totalPendingReview + data.summary.totalUnderReview} icon={Clock} accent="bg-orange-500" delay={0.15} />
        </div>
      )}

      {/* Top 3 podium */}
      {!loading && topTeams.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-5 border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Leaderboard</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {topTeams.map((t, i) => {
                const grade = t.weightedFinal ?? t.averageGrade ?? 0
                const medal = ["🥇", "🥈", "🥉"][i]
                return (
                  <motion.div
                    key={t.teamId}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.25 + i * 0.08, type: "spring", stiffness: 200 }}
                    className={cn(
                      "p-4 rounded-xl border-2 relative overflow-hidden",
                      i === 0 && "border-amber-500/40 bg-amber-500/5",
                      i === 1 && "border-gray-400/40 bg-gray-400/5",
                      i === 2 && "border-orange-700/40 bg-orange-700/5",
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{medal}</span>
                      <Badge variant="outline" className="text-[10px]">{STAGE_LABEL[t.stage]}</Badge>
                    </div>
                    <p className="font-semibold truncate">{t.teamName}</p>
                    <p className={cn("text-3xl font-bold mt-1 tabular-nums", gradeColor(grade))}>{grade}<span className="text-sm text-muted-foreground">/100</span></p>
                  </motion.div>
                )
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Filters */}
      <Card className="p-4 border-border/50">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search team, leader, or doctor…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {Object.entries(STAGE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(search || stageFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStageFilter("all") }}>
              <Filter className="h-4 w-4 mr-1.5" />
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Team rows */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-20 w-full" /></Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-12 text-center border-border/50">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <p className="text-muted-foreground mb-4">Failed to load grades overview</p>
          <Button variant="outline" onClick={() => void fetchData()}>Try again</Button>
        </Card>
      ) : !data || data.rows.length === 0 ? (
        <Card className="p-12 text-center border-border/50">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No teams match your filters.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {data.rows.map((row, i) => (
              <TeamRow key={row.teamId} row={row} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}
