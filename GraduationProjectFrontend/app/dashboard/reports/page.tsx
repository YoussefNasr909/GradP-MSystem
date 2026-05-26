"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DashboardMetricCard, DashboardPageHeader, DashboardStateCard } from "@/components/dashboard/page-shell"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BarChart3, FileText, Lock, AlertCircle, FileSpreadsheet,
  FileDown, Users, CheckSquare, AlertTriangle, Award,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth-store"
import { analyticsApi, gradesOverviewApi, reportDownloadsApi } from "@/lib/api/admin-logs"
import type { AnalyticsResponse, GradesOverviewResponse } from "@/lib/api/admin-logs"
import { toast } from "sonner"

const REPORTS_REFRESH_INTERVAL_MS = 30_000

// ─── CSV helpers ─────────────────────────────────────────────────────────────

type CsvColumn = {
  key: string
  label: string
}

function toCsv(rows: Record<string, unknown>[], columns: CsvColumn[]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ""
    const s = String(v).replace(/\r?\n/g, " ")
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
    return safe.includes(",") || safe.includes("\"") || safe.includes("\n")
      ? `"${safe.replace(/"/g, '""')}"`
      : safe
  }
  const lines = [
    columns.map((column) => esc(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => esc(row[column.key])).join(",")),
  ]
  return `\uFEFFsep=,\r\n${lines.join("\r\n")}`
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
  const isDoctor = role === "doctor"
  const reportActionButtonClass = "w-full gap-2"

  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [grades, setGrades]       = useState<GradesOverviewResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null)

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setError(false)
    try {
      const [a, g] = await Promise.all([
        analyticsApi.get(),
        gradesOverviewApi.get(),
      ])
      setAnalytics(a)
      setGrades(g)
      setError(false)
    } catch {
      if (!quiet) setError(true)
    }
  }, [])

  useEffect(() => {
    if (!canView) return
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [canView, fetchData])

  useEffect(() => {
    if (!canView) return
    const refreshReports = () => void fetchData(true)
    const intervalId = window.setInterval(refreshReports, REPORTS_REFRESH_INTERVAL_MS)
    window.addEventListener("focus", refreshReports)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", refreshReports)
    }
  }, [canView, fetchData])

  const distributionSections = analytics
    ? [
        {
          title: "Submissions",
          total: analytics.submissions.total,
          rows: [
            { label: "Pending", value: analytics.submissions.byStatus.PENDING ?? 0 },
            { label: "Under Review", value: analytics.submissions.byStatus.UNDER_REVIEW ?? 0 },
            { label: "Needs Revision", value: analytics.submissions.byStatus.REVISION_REQUIRED ?? 0 },
            { label: "Approved", value: analytics.submissions.byStatus.APPROVED ?? 0 },
            { label: "Graded", value: analytics.submissions.graded, divider: true },
            { label: "Late", value: analytics.submissions.lateSubmissions, tone: "text-red-500" },
          ],
        },
        {
          title: "Proposals",
          total: analytics.proposals.total,
          rows: [
            { label: "Draft", value: analytics.proposals.byStatus.DRAFT ?? 0 },
            { label: "Submitted", value: analytics.proposals.byStatus.SUBMITTED ?? 0 },
            { label: "Under Review", value: analytics.proposals.byStatus.UNDER_REVIEW ?? 0 },
            { label: "Needs Revision", value: analytics.proposals.byStatus.REVISION_REQUESTED ?? 0 },
            { label: "Approved", value: analytics.proposals.byStatus.APPROVED ?? 0 },
            { label: "Rejected", value: analytics.proposals.byStatus.REJECTED ?? 0 },
          ],
        },
        {
          title: "Risks",
          total: analytics.risks.total,
          rows: [
            { label: "Open", value: analytics.risks.byStatus.OPEN ?? 0 },
            { label: "Monitoring", value: analytics.risks.byStatus.MONITORING ?? 0 },
            { label: "Resolved", value: analytics.risks.byStatus.RESOLVED ?? 0 },
            { label: "Critical Active", value: analytics.risks.criticalActive ?? analytics.risks.criticalOpen, tone: "text-red-500", divider: true },
          ],
        },
      ]
    : []

  // ── Export actions ─────────────────────────────────────────────────────────

  function exportGradesCsv() {
    if (!grades) return
    const rows = grades.rows.map((r) => ({
      teamId: r.teamId,
      teamName: r.teamName,
      stage: r.stage,
      memberCount: r.memberCount,
      leader: r.leader?.fullName ?? "",
      doctor: r.doctor?.fullName ?? "",
      ta: r.ta?.fullName ?? "",
      averageGrade: r.averageGrade ?? "",
      weightedFinal: r.weightedFinal ?? "",
      finalComplete: r.isFinalComplete ? "Yes" : "No",
      approved: r.stats.approved,
      pendingReview: r.stats.pendingReview,
      underReview: r.stats.underReview,
      needsRevision: r.stats.needsRevision,
      totalSubmissions: r.stats.total,
    }))
    const columns: CsvColumn[] = [
      { key: "teamId", label: "Team ID" },
      { key: "teamName", label: "Team Name" },
      { key: "stage", label: "SDLC Phase" },
      { key: "memberCount", label: "Student Count" },
      { key: "leader", label: "Leader" },
      { key: "doctor", label: "Doctor" },
      { key: "ta", label: "TA" },
      { key: "averageGrade", label: "Average Grade" },
      { key: "weightedFinal", label: "Weighted Final" },
      { key: "finalComplete", label: "Final Complete" },
      { key: "approved", label: "Approved Submissions" },
      { key: "pendingReview", label: "Pending Review" },
      { key: "underReview", label: "Under Review" },
      { key: "needsRevision", label: "Needs Revision" },
      { key: "totalSubmissions", label: "Total Submissions" },
    ]
    download(`grades-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, columns), "text/csv;charset=utf-8")
    toast.success("Grades CSV downloaded")
  }

  function exportPhasesCsv() {
    if (!analytics) return
    const rows = analytics.submissions.byPhase.map((p) => ({
      stage: p.stage,
      total: p.total,
      approved: p.approved,
      approvalRate: p.total ? `${Math.round((p.approved / p.total) * 100)}%` : "",
      averageGrade: p.averageGrade ?? "",
    }))
    const columns: CsvColumn[] = [
      { key: "stage", label: "SDLC Phase" },
      { key: "total", label: "Total Submissions" },
      { key: "approved", label: "Approved Submissions" },
      { key: "approvalRate", label: "Approval Rate" },
      { key: "averageGrade", label: "Average Grade" },
    ]
    download(`sdlc-phases-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, columns), "text/csv;charset=utf-8")
    toast.success("SDLC phases CSV downloaded")
  }

  async function exportReportPdf(kind: "grades" | "phases" | "analytics") {
    setDownloadingPdf(kind)
    try {
      if (kind === "grades") await reportDownloadsApi.gradesPdf()
      if (kind === "phases") await reportDownloadsApi.phasesPdf()
      if (kind === "analytics") await reportDownloadsApi.analyticsPdf()
      toast.success("PDF downloaded")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download PDF")
    } finally {
      setDownloadingPdf(null)
    }
  }

  if (!canView) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center">
        <DashboardStateCard
          icon={Lock}
          title="Access denied"
          description="Reports are only available to admins and doctors."
          tone="rose"
        />
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <DashboardPageHeader
        title="Reports"
        description="Generate and download program reports for grades, SDLC phases, and full analytics."
        icon={BarChart3}
        tone="blue"
        badge={<Badge variant="outline" className="rounded-md border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300">{isDoctor ? "Doctor view" : "Admin view"}</Badge>}
      />

      <Card className="rounded-[20px] border-border/60 bg-card p-4 shadow-sm sm:p-5">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border/50 bg-background/70 p-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : analytics && grades ? (
            <div className="grid gap-4 md:grid-cols-4">
              <DashboardMetricCard label="Teams" value={analytics.overview.totalTeams} icon={Users} tone="blue" />
              <DashboardMetricCard label="Tasks" value={analytics.tasks.total} icon={CheckSquare} tone="amber" />
              <DashboardMetricCard label="Submissions" value={analytics.submissions.total} icon={FileText} tone="violet" />
              <DashboardMetricCard label="Avg grade" value={`${analytics.overview.averageGrade}/100`} icon={Award} tone="emerald" />
            </div>
          ) : null}
      </Card>

      {loading ? (
        null
      ) : error ? (
        <DashboardStateCard
          icon={AlertCircle}
          title="Failed to load report data"
          description="The report endpoints did not respond successfully. Try again after the backend settles."
          action={<Button variant="outline" onClick={() => void fetchData()}>Try again</Button>}
          tone="rose"
        />
      ) : analytics && grades ? (
        <>
          {/* Export cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="flex h-full flex-col rounded-[20px] border-border/60 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
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
                <Button onClick={exportGradesCsv} className={reportActionButtonClass}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Card className="flex h-full flex-col rounded-[20px] border-border/60 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
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
                  {isDoctor
                    ? "Approval count and average grade per SDLC phase across your supervised teams."
                    : "Approval count and average grade per SDLC phase across all teams."}
                </p>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="text-[10px]">6 phases</Badge>
                  <Badge variant="outline" className="text-[10px]">CSV</Badge>
                </div>
                <Button onClick={exportPhasesCsv} className={reportActionButtonClass}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="flex h-full flex-col rounded-[20px] border-border/60 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Full Analytics</h3>
                    <p className="text-xs text-muted-foreground">All metrics in PDF</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4 flex-1">
                  Complete analytics snapshot — every metric, distribution, and trend.
                </p>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="text-[10px]">Snapshot</Badge>
                  <Badge variant="outline" className="text-[10px]">PDF</Badge>
                </div>
                <Button onClick={() => void exportReportPdf("analytics")} className={reportActionButtonClass} disabled={downloadingPdf === "analytics"}>
                  <FileDown className="h-4 w-4" />
                  {downloadingPdf === "analytics" ? "Preparing PDF..." : "Download PDF"}
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
              {distributionSections.map((section) => (
                <div key={section.title}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{section.title}</p>
                    <Badge variant="outline" className="text-[10px]">{section.total} total</Badge>
                  </div>
                  {section.rows.map((row) => (
                    <div
                      key={row.label}
                      className={cn(
                        "flex items-center justify-between text-sm py-1",
                        row.divider && "mt-1 border-t border-border/40 pt-2",
                      )}
                    >
                      <span className={cn("text-muted-foreground", row.tone && "font-medium", row.tone)}>
                        {row.tone === "text-red-500" ? <AlertTriangle className="mr-1 inline h-3 w-3" /> : null}
                        {row.label}
                      </span>
                      <span className={cn("font-semibold tabular-nums", row.tone)}>{row.value}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Card>

          <p className="text-[10px] text-muted-foreground text-center">
            Current data refreshed at {new Date(analytics.generatedAt).toLocaleString()}
          </p>
        </>
      ) : null}
    </motion.div>
  )
}
