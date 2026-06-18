"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BarChart3, Download, FileText, RefreshCw, Lock, AlertCircle, FileSpreadsheet,
  FileJson, Users, CheckSquare, Calendar, AlertTriangle, Award,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth-store"
import { analyticsApi, gradesOverviewApi } from "@/lib/api/admin-logs"
import type { AnalyticsResponse, GradesOverviewResponse } from "@/lib/api/admin-logs"
import { toast } from "sonner"

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ""
    const s = String(v)
    return s.includes(",") || s.includes("\"") || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n")
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { currentUser } = useAuthStore()
  const role = currentUser?.role?.toLowerCase() ?? ""
  const canView = role === "admin" || role === "doctor"

  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [grades, setGrades]       = useState<GradesOverviewResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    setError(false)
    try {
      const [a, g] = await Promise.all([
        analyticsApi.get(),
        gradesOverviewApi.get(),
      ])
      setAnalytics(a)
      setGrades(g)
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

  // ── Export actions ─────────────────────────────────────────────────────────

  function exportGradesCsv() {
    if (!grades) return
    const rows = grades.rows.map((r) => ({
      teamId: r.teamId,
      teamName: r.teamName,
      stage: r.stage,
      memberCount: r.memberCount,
      doctor: r.doctor?.fullName ?? "",
      ta: r.ta?.fullName ?? "",
      leader: r.leader?.fullName ?? "",
      averageGrade: r.averageGrade ?? "",
      weightedFinal: r.weightedFinal ?? "",
      approved: r.stats.approved,
      pendingReview: r.stats.pendingReview,
      underReview: r.stats.underReview,
      needsRevision: r.stats.needsRevision,
      totalSubmissions: r.stats.total,
    }))
    download(`grades-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), "text/csv;charset=utf-8")
    toast.success("Grades CSV downloaded")
  }

  function exportAnalyticsJson() {
    if (!analytics) return
    download(
      `analytics-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(analytics, null, 2),
      "application/json",
    )
    toast.success("Analytics JSON downloaded")
  }

  function exportPhasesCsv() {
    if (!analytics) return
    const rows = analytics.submissions.byPhase.map((p) => ({
      stage: p.stage,
      total: p.total,
      approved: p.approved,
      averageGrade: p.averageGrade ?? "",
    }))
    download(`sdlc-phases-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), "text/csv;charset=utf-8")
    toast.success("SDLC phases CSV downloaded")
  }

  if (!canView) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="min-h-[60vh] flex items-center justify-center">
        <Card className="p-12 text-center max-w-md border-border/50">
          <Lock className="h-16 w-16 mx-auto mb-6 text-destructive" />
          <h2 className="text-2xl font-bold mb-3">Access Denied</h2>
          <p className="text-muted-foreground">Reports are only available to admins and doctors.</p>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 sm:p-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 border border-border/50 relative overflow-hidden bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-emerald-500/5" />
        <motion.div
          className="absolute -right-20 -top-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"
          animate={{ scale: [1, 1.15, 1], rotate: [0, 120, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <motion.h1 className="text-3xl font-bold mb-1.5 flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <BarChart3 className="h-7 w-7 text-blue-500" />
              Reports
            </motion.h1>
            <motion.p className="text-muted-foreground"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              Generate and download program reports for grades, phases, and full analytics
            </motion.p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6"><Skeleton className="h-32" /></Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-12 text-center border-border/50">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <p className="text-muted-foreground mb-4">Failed to load report data</p>
          <Button variant="outline" onClick={() => void fetchData()}>Try again</Button>
        </Card>
      ) : analytics && grades ? (
        <>
          {/* High-level snapshot */}
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Teams",      value: analytics.overview.totalTeams,     icon: Users,        accent: "bg-blue-500" },
              { label: "Tasks",      value: analytics.tasks.total,             icon: CheckSquare,  accent: "bg-amber-500" },
              { label: "Submissions",value: analytics.submissions.total,       icon: FileText,     accent: "bg-purple-500" },
              { label: "Avg Grade",  value: `${analytics.overview.averageGrade}/100`, icon: Award, accent: "bg-green-500" },
            ].map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}>
                <Card className="p-5 border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2.5 rounded-xl text-white", s.accent)}>
                      <s.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Export cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="p-6 border-border/50 hover:border-border hover:shadow-lg transition-all flex flex-col h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10">
                    <Award className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Team Grades</h3>
                    <p className="text-xs text-muted-foreground">Per-team breakdown</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4 flex-1">
                  Final grades, weighted scores, submission counts, supervisors — one row per team.
                </p>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="text-[10px]">{grades.rows.length} teams</Badge>
                  <Badge variant="outline" className="text-[10px]">CSV</Badge>
                </div>
                <Button onClick={exportGradesCsv} className="w-full">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Card className="p-6 border-border/50 hover:border-border hover:shadow-lg transition-all flex flex-col h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10">
                    <BarChart3 className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">SDLC Phases</h3>
                    <p className="text-xs text-muted-foreground">Phase-by-phase performance</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4 flex-1">
                  Approval count and average grade per SDLC phase across all teams.
                </p>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="text-[10px]">6 phases</Badge>
                  <Badge variant="outline" className="text-[10px]">CSV</Badge>
                </div>
                <Button onClick={exportPhasesCsv} variant="outline" className="w-full">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="p-6 border-border/50 hover:border-border hover:shadow-lg transition-all flex flex-col h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10">
                    <FileJson className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Full Analytics</h3>
                    <p className="text-xs text-muted-foreground">All metrics in JSON</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4 flex-1">
                  Complete analytics snapshot — every metric, distribution, and trend.
                </p>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="text-[10px]">Snapshot</Badge>
                  <Badge variant="outline" className="text-[10px]">JSON</Badge>
                </div>
                <Button onClick={exportAnalyticsJson} variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download JSON
                </Button>
              </Card>
            </motion.div>
          </div>

          {/* Quick distribution snapshot */}
          <Card className="p-6 border-border/50">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Current Distribution
            </h3>
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Submissions</p>
                {Object.entries(analytics.submissions.byStatus).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-sm py-1">
                    <span className="text-muted-foreground">{k.replace("_", " ").toLowerCase()}</span>
                    <span className="font-semibold tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Proposals</p>
                {Object.entries(analytics.proposals.byStatus).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-sm py-1">
                    <span className="text-muted-foreground">{k.replace("_", " ").toLowerCase()}</span>
                    <span className="font-semibold tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Risks</p>
                {Object.entries(analytics.risks.byStatus).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-sm py-1">
                    <span className="text-muted-foreground">{k.toLowerCase()}</span>
                    <span className="font-semibold tabular-nums">{v}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm py-1 mt-1 pt-1 border-t border-border/40">
                  <span className="text-red-500 font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Critical</span>
                  <span className="font-bold text-red-500">{analytics.risks.criticalOpen}</span>
                </div>
              </div>
            </div>
          </Card>

          <p className="text-[10px] text-muted-foreground text-center">
            Generated at {new Date(analytics.generatedAt).toLocaleString()}
          </p>
        </>
      ) : null}
    </motion.div>
  )
}
