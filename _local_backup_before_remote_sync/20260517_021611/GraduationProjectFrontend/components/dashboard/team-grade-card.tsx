"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Award, Trophy, FileText, TrendingUp, ChevronRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { submissionsApi } from "@/lib/api/submissions"
import { proposalsApi } from "@/lib/api/proposals"
import type { ApiSubmission } from "@/lib/api/submissions"
import type { ApiProposal } from "@/lib/api/proposals"

// Same weights the backend uses
const PHASE_WEIGHTS: Record<string, number> = {
  REQUIREMENTS:   0.15,
  DESIGN:         0.20,
  IMPLEMENTATION: 0.30,
  TESTING:        0.15,
  DEPLOYMENT:     0.20,
  MAINTENANCE:    0,
}

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

function gradeColor(g: number | null) {
  if (g === null) return "text-muted-foreground"
  if (g >= 90) return "text-green-500"
  if (g >= 80) return "text-blue-500"
  if (g >= 70) return "text-amber-500"
  if (g >= 60) return "text-orange-500"
  return "text-red-500"
}

function gradeLetter(g: number | null) {
  if (g === null) return "—"
  if (g >= 90) return "A"
  if (g >= 80) return "B"
  if (g >= 70) return "C"
  if (g >= 60) return "D"
  return "F"
}

function gradeBg(g: number | null) {
  if (g === null) return "bg-muted/30 border-border/40"
  if (g >= 90) return "bg-green-500/10 border-green-500/30"
  if (g >= 80) return "bg-blue-500/10 border-blue-500/30"
  if (g >= 70) return "bg-amber-500/10 border-amber-500/30"
  if (g >= 60) return "bg-orange-500/10 border-orange-500/30"
  return "bg-red-500/10 border-red-500/30"
}

/**
 * Student-facing "where do we stand?" card.
 *
 * Pulls the team's submissions and proposal, computes the same
 * SDLC-phase-weighted final grade the backend uses for Grades Overview,
 * and shows a letter grade + phase breakdown + proposal status.
 */
export function TeamGradeCard({ teamId }: { teamId: string }) {
  const [submissions, setSubmissions] = useState<ApiSubmission[] | null>(null)
  const [proposal,    setProposal]    = useState<ApiProposal | null>(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [subs, prop] = await Promise.all([
          submissionsApi.list({ teamId }).catch(() => []),
          proposalsApi.getMine().catch(() => null),
        ])
        if (cancelled) return
        setSubmissions(subs)
        setProposal(prop)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [teamId])

  // Same algorithm as backend admin.service.getGradesOverview()
  const summary = useMemo(() => {
    if (!submissions) return null
    const graded = submissions.filter((s) => s.status === "APPROVED" && s.grade !== null)

    // mean per phase
    const phaseGroups: Record<string, { total: number; count: number }> = {}
    for (const s of graded) {
      const p = s.sdlcPhase
      phaseGroups[p] = phaseGroups[p] ?? { total: 0, count: 0 }
      phaseGroups[p].total += s.grade ?? 0
      phaseGroups[p].count += 1
    }
    const phaseAverages: Record<string, number> = {}
    Object.entries(phaseGroups).forEach(([p, { total, count }]) => {
      phaseAverages[p] = Math.round(total / count)
    })

    // weighted final
    let weightedTotal = 0
    let usedWeights = 0
    Object.entries(phaseAverages).forEach(([p, avg]) => {
      const w = PHASE_WEIGHTS[p] ?? 0
      weightedTotal += w * avg
      usedWeights += w
    })
    const weightedFinal = usedWeights > 0 ? Math.round(weightedTotal / usedWeights) : null

    const averageGrade = graded.length
      ? Math.round(graded.reduce((s, x) => s + (x.grade ?? 0), 0) / graded.length)
      : null

    return {
      phaseAverages,
      averageGrade,
      weightedFinal,
      approved: graded.length,
      total: submissions.length,
    }
  }, [submissions])

  if (loading || !submissions || !summary) {
    return (
      <Card className="p-6 border-border/50">
        <Skeleton className="h-24 w-full" />
      </Card>
    )
  }

  const displayGrade = summary.weightedFinal ?? summary.averageGrade
  const hasAnyGrade = displayGrade !== null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={cn("p-6 border-2 relative overflow-hidden", gradeBg(displayGrade))}>
        {/* Animated glow */}
        <motion.div
          className="absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-30"
          style={{ background: "currentColor" }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 8, repeat: Infinity }}
        />

        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Your Project Standing
            </h2>
            {hasAnyGrade && (
              <Badge variant="outline" className="text-[10px] gap-1 ml-auto">
                <Sparkles className="h-3 w-3" />
                Live
              </Badge>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-[auto_1fr_auto] items-center">
            {/* Big letter grade */}
            <motion.div
              className={cn(
                "h-24 w-24 rounded-2xl flex items-center justify-center font-bold text-5xl border-2 shrink-0",
                gradeBg(displayGrade),
              )}
              whileHover={{ scale: 1.05, rotate: -5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <span className={gradeColor(displayGrade)}>{gradeLetter(displayGrade)}</span>
            </motion.div>

            {/* Number + breakdown */}
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className={cn("text-5xl font-bold tabular-nums", gradeColor(displayGrade))}>
                  {displayGrade ?? "—"}
                </span>
                {hasAnyGrade && <span className="text-lg text-muted-foreground">/100</span>}
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {hasAnyGrade
                  ? `Weighted across approved SDLC submissions (${summary.approved}/${summary.total} graded)`
                  : "No graded submissions yet — keep submitting deliverables!"}
              </p>

              {/* Phase progress strip */}
              <div className="grid grid-cols-5 gap-1.5">
                {["REQUIREMENTS", "DESIGN", "IMPLEMENTATION", "TESTING", "DEPLOYMENT"].map((p, i) => {
                  const avg = summary.phaseAverages[p]
                  const has = avg !== undefined
                  return (
                    <motion.div
                      key={p}
                      initial={{ opacity: 0, scaleY: 0.6 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="text-center"
                    >
                      <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden mb-1.5">
                        <motion.div
                          className={cn("h-full rounded-full", STAGE_COLOR[p])}
                          initial={{ width: 0 }}
                          animate={{ width: `${has ? avg : 0}%` }}
                          transition={{ delay: 0.2 + i * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground truncate">
                        {STAGE_LABEL[p].slice(0, 4)}
                      </p>
                      <p className={cn("text-[10px] font-semibold tabular-nums", gradeColor(has ? avg : null))}>
                        {has ? avg : "—"}
                      </p>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Status pill: proposal */}
            <Link href="/dashboard/proposals" className="shrink-0">
              <motion.div
                className="p-3 rounded-xl border bg-background/60 hover:bg-background transition-colors min-w-[140px] cursor-pointer group"
                whileHover={{ y: -2 }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Proposal</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {proposal ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      proposal.status === "APPROVED"           && "border-green-500/30 text-green-500",
                      proposal.status === "REJECTED"           && "border-red-500/30 text-red-500",
                      proposal.status === "REVISION_REQUESTED" && "border-amber-500/30 text-amber-500",
                      proposal.status === "DRAFT"              && "border-gray-500/30 text-gray-500",
                      (proposal.status === "SUBMITTED" || proposal.status === "UNDER_REVIEW") && "border-blue-500/30 text-blue-500",
                    )}
                  >
                    {proposal.status.replace("_", " ")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500">
                    Not Started
                  </Badge>
                )}
              </motion.div>
            </Link>
          </div>

          {/* Footer link */}
          <div className="mt-4 pt-4 border-t border-border/40">
            <Link href="/dashboard/submissions" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group">
              <TrendingUp className="h-3 w-3" />
              View all submissions
              <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
