"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Users,
  CheckSquare,
  FileText,
  Calendar,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Lock,
  AlertCircle,
  Award,
  Github,
  Activity,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth-store"
import { analyticsApi } from "@/lib/api/admin-logs"
import type { AnalyticsResponse } from "@/lib/api/admin-logs"

// ─── Constants ───────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<string, string> = {
  REQUIREMENTS: "Requirements",
  DESIGN: "Design",
  IMPLEMENTATION: "Implementation",
  TESTING: "Testing",
  DEPLOYMENT: "Deployment",
  MAINTENANCE: "Maintenance",
}

const STAGE_COLOR: Record<string, string> = {
  REQUIREMENTS:   "bg-blue-500",
  DESIGN:         "bg-purple-500",
  IMPLEMENTATION: "bg-amber-500",
  TESTING:        "bg-cyan-500",
  DEPLOYMENT:     "bg-green-500",
  MAINTENANCE:    "bg-gray-500",
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function MetricCard({
  label, value, suffix, icon: Icon, accent, trend, delay,
}: {
  label: string
  value: string | number
  suffix?: string
  icon: React.ElementType
  accent: string
  trend?: { direction: "up" | "down"; text: string }
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="p-5 border-border/50 hover:border-border hover:shadow-md transition-all relative overflow-hidden group">
        <div className={cn("absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity", accent)} />
        <div className="relative flex items-start gap-3">
          <div className={cn("p-2.5 rounded-xl", accent)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5">
              {value}
              {suffix && <span className="text-sm text-muted-foreground ml-0.5">{suffix}</span>}
            </p>
            {trend && (
              <div className={cn(
                "flex items-center gap-1 text-[10px] mt-1",
                trend.direction === "up" ? "text-green-500" : "text-amber-500",
              )}>
                {trend.direction === "up"
                  ? <ArrowUpRight className="h-3 w-3" />
                  : <ArrowDownRight className="h-3 w-3" />}
                <span>{trend.text}</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function HorizontalBars({
  title,
  items,
  max,
}: {
  title: string
  items: { label: string; value: number; colorClass: string }[]
  max?: number
}) {
  const dataMax = max ?? Math.max(1, ...items.map((i) => i.value))
  return (
    <Card className="p-5 border-border/50">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" /> {title}
      </h3>
      <div className="space-y-3">
        {items.map((it, i) => (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">{it.label}</span>
              <span className="text-xs font-semibold tabular-nums">{it.value}</span>
            </div>
            <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full", it.colorClass)}
                initial={{ width: 0 }}
                animate={{ width: `${(it.value / dataMax) * 100}%` }}
                transition={{ delay: i * 0.05 + 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  )
}

function Sparkline({ data, accent }: { data: number[]; accent: string }) {
  if (data.length === 0) return null
  const max = Math.max(1, ...data)
  return (
    <svg viewBox="0 0 100 32" className="w-full h-12">
      <defs>
        <linearGradient id={`grad-${accent}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className={accent}
        points={data
          .map((v, i) => `${(i / Math.max(1, data.length - 1)) * 100},${32 - (v / max) * 28}`)
          .join(" ")}
      />
      <polygon
        fill={`url(#grad-${accent})`}
        className={accent}
        points={
          `0,32 ` +
          data
            .map((v, i) => `${(i / Math.max(1, data.length - 1)) * 100},${32 - (v / max) * 28}`)
            .join(" ") +
          ` 100,32`
        }
      />
    </svg>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { currentUser } = useAuthStore()
  const role = currentUser?.role?.toLowerCase() ?? ""
  const canView = role === "admin" || role === "doctor"

  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    setError(false)
    try {
      const res = await analyticsApi.get()
      setData(res)
    } catch {
      setError(true)
    }
  }, [])

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

  if (!canView) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="min-h-[60vh] flex items-center justify-center">
        <Card className="p-12 text-center max-w-md border-border/50">
          <Lock className="h-16 w-16 mx-auto mb-6 text-destructive" />
          <h2 className="text-2xl font-bold mb-3">Access Denied</h2>
          <p className="text-muted-foreground">Analytics are only available to admins and doctors.</p>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 sm:p-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 border border-border/50 relative overflow-hidden bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-purple-500/5" />
        <motion.div
          className="absolute -right-20 -top-20 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"
          animate={{ scale: [1, 1.15, 1], rotate: [0, 120, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <motion.h1 className="text-3xl font-bold mb-1.5 flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <TrendingUp className="h-7 w-7 text-rose-500" />
              Analytics
            </motion.h1>
            <motion.p className="text-muted-foreground"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              System-wide performance metrics, live from your database
            </motion.p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Top metrics row */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-16" /></Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-12 text-center border-border/50">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <p className="text-muted-foreground mb-4">Failed to load analytics</p>
          <Button variant="outline" onClick={() => void fetchData()}>Try again</Button>
        </Card>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Total Users"      value={data.overview.totalUsers}   icon={Users}    accent="bg-blue-500"   delay={0} />
            <MetricCard label="Active Teams"     value={data.overview.totalTeams}   icon={Users}    accent="bg-purple-500" delay={0.05} />
            <MetricCard label="Average Grade"    value={data.overview.averageGrade} suffix="/100" icon={Award}    accent="bg-amber-500"  delay={0.1} />
            <MetricCard label="On-time Rate"     value={data.overview.onTimeRate}   suffix="%"    icon={Activity} accent="bg-green-500"  delay={0.15} />
          </div>

          {/* Trend sparklines */}
          <div className="grid gap-4 md:grid-cols-3">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="p-5 border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" /> Submissions (12 weeks)
                  </h3>
                  <Badge variant="outline" className="text-[10px]">
                    {data.trend.submissions.reduce((s, w) => s + w.count, 0)} total
                  </Badge>
                </div>
                <div className="text-blue-500">
                  <Sparkline data={data.trend.submissions.map(w => w.count)} accent="text-blue-500" />
                </div>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Card className="p-5 border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-amber-500" /> Tasks (12 weeks)
                  </h3>
                  <Badge variant="outline" className="text-[10px]">
                    {data.trend.tasks.reduce((s, w) => s + w.count, 0)} total
                  </Badge>
                </div>
                <div className="text-amber-500">
                  <Sparkline data={data.trend.tasks.map(w => w.count)} accent="text-amber-500" />
                </div>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="p-5 border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-green-500" /> Meetings (12 weeks)
                  </h3>
                  <Badge variant="outline" className="text-[10px]">
                    {data.trend.meetings.reduce((s, w) => s + w.count, 0)} total
                  </Badge>
                </div>
                <div className="text-green-500">
                  <Sparkline data={data.trend.meetings.map(w => w.count)} accent="text-green-500" />
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Distribution charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <HorizontalBars
                title="Teams by SDLC Phase"
                items={data.overview.teamsByStage.map(t => ({
                  label: STAGE_LABEL[t.stage] ?? t.stage,
                  value: t.count,
                  colorClass: STAGE_COLOR[t.stage] ?? "bg-primary",
                }))}
              />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <HorizontalBars
                title="Tasks by Status"
                items={Object.entries(data.tasks.byStatus).map(([status, count]) => ({
                  label: status.replace("_", " "),
                  value: count,
                  colorClass:
                    status === "DONE" || status === "APPROVED" ? "bg-green-500" :
                    status === "REVIEW"                       ? "bg-purple-500" :
                    status === "IN_PROGRESS"                  ? "bg-blue-500" :
                    "bg-gray-500",
                }))}
              />
            </motion.div>
          </div>

          {/* SDLC phase grades */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <Card className="p-5 border-border/50">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" /> SDLC Phase Performance
              </h3>
              <div className="space-y-3">
                {data.submissions.byPhase.map((p, i) => (
                  <motion.div key={p.stage}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.04 }}
                    className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-3 flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", STAGE_COLOR[p.stage])} />
                      <span className="text-sm font-medium truncate">{STAGE_LABEL[p.stage]}</span>
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground">
                      {p.approved}/{p.total} approved
                    </div>
                    <div className="col-span-5">
                      <Progress value={p.total ? (p.approved / p.total) * 100 : 0} className="h-1.5" />
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-semibold tabular-nums">
                        {p.averageGrade !== null ? `${p.averageGrade}/100` : "—"}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Risk + Proposal mini-cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
              <Card className="p-5 border-border/50">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" /> Risks
                </h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Open</span><span className="font-semibold">{data.risks.byStatus.OPEN}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Monitoring</span><span className="font-semibold">{data.risks.byStatus.MONITORING}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Resolved</span><span className="font-semibold">{data.risks.byStatus.RESOLVED}</span></div>
                  <div className="flex justify-between pt-1.5 mt-1.5 border-t border-border/40">
                    <span className="text-red-500 font-medium">Critical open</span>
                    <span className="font-bold text-red-500">{data.risks.criticalOpen}</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <Card className="p-5 border-border/50">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" /> Proposals
                </h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Draft</span><span className="font-semibold">{data.proposals.byStatus.DRAFT}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Submitted</span><span className="font-semibold">{data.proposals.byStatus.SUBMITTED}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Revision</span><span className="font-semibold">{data.proposals.byStatus.REVISION_REQUESTED}</span></div>
                  <div className="flex justify-between pt-1.5 mt-1.5 border-t border-border/40">
                    <span className="text-green-500 font-medium">Approved</span>
                    <span className="font-bold text-green-500">{data.proposals.byStatus.APPROVED}</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
              <Card className="p-5 border-border/50">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Github className="h-4 w-4 text-foreground" /> GitHub Integration
                </h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total tasks</span><span className="font-semibold">{data.tasks.total}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">GitHub linked</span><span className="font-semibold">{data.tasks.githubLinked}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Overdue</span><span className="font-semibold text-red-500">{data.tasks.overdue}</span></div>
                  <div className="flex justify-between pt-1.5 mt-1.5 border-t border-border/40">
                    <span className="text-green-500 font-medium">Completion rate</span>
                    <span className="font-bold text-green-500">{data.tasks.completionRate}%</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Generated at {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      ) : null}
    </motion.div>
  )
}
