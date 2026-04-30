"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle2,
  FileText,
  Code,
  TestTube,
  Rocket,
  Wrench,
  Clock,
  Target,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Star,
  Upload,
  AlertCircle,
  ArrowRight,
  Layers,
  XCircle,
  RotateCcw,
  Eye,
  GitBranch,
  BookOpen,
  Shield,
  Lightbulb,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuthStore } from "@/lib/stores/auth-store"
import { TeamRequiredGuard } from "@/components/team-required-guard"
import {
  submissionsApi,
  type ApiSDLCSummary,
  type ApiSDLCPhase,
  type ApiSubmission,
  type ApiSubmissionStatus,
} from "@/lib/api/submissions"
import type { ApiTeamStage } from "@/lib/api/types"
import { toast } from "sonner"

const PHASE_ICONS: Record<ApiTeamStage, React.ComponentType<{ className?: string }>> = {
  REQUIREMENTS: FileText,
  DESIGN: Wrench,
  IMPLEMENTATION: Code,
  TESTING: TestTube,
  DEPLOYMENT: Rocket,
  MAINTENANCE: Wrench,
}

const PHASE_COLORS: Record<ApiTeamStage, { icon: string; badge: string; bg: string; border: string }> = {
  REQUIREMENTS: {
    icon: "text-blue-500",
    badge: "bg-blue-500/10 text-blue-600 border-blue-200",
    bg: "bg-blue-500/10",
    border: "border-blue-200",
  },
  DESIGN: {
    icon: "text-purple-500",
    badge: "bg-purple-500/10 text-purple-600 border-purple-200",
    bg: "bg-purple-500/10",
    border: "border-purple-200",
  },
  IMPLEMENTATION: {
    icon: "text-orange-500",
    badge: "bg-orange-500/10 text-orange-600 border-orange-200",
    bg: "bg-orange-500/10",
    border: "border-orange-200",
  },
  TESTING: {
    icon: "text-yellow-500",
    badge: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
    bg: "bg-yellow-500/10",
    border: "border-yellow-200",
  },
  DEPLOYMENT: {
    icon: "text-green-500",
    badge: "bg-green-500/10 text-green-600 border-green-200",
    bg: "bg-green-500/10",
    border: "border-green-200",
  },
  MAINTENANCE: {
    icon: "text-slate-500",
    badge: "bg-slate-500/10 text-slate-600 border-slate-200",
    bg: "bg-slate-500/10",
    border: "border-slate-200",
  },
}

const DELIVERABLE_LABELS: Record<string, string> = {
  SRS: "SRS Document",
  UML: "UML Diagrams",
  PROTOTYPE: "Prototype",
  CODE: "Source Code",
  TEST_PLAN: "Test Plan",
  FINAL_REPORT: "Final Report",
  PRESENTATION: "Presentation",
}

const STATUS_META: Record<ApiSubmissionStatus, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "text-amber-500" },
  UNDER_REVIEW: { label: "Under Review", color: "text-blue-500" },
  REVISION_REQUIRED: { label: "Needs Revision", color: "text-red-500" },
  APPROVED: { label: "Approved", color: "text-green-500" },
}

// ─── Phase Card ──────────────────────────────────────────────────────────────
function PhaseCard({
  phase,
  isCurrentPhase,
  isExpanded,
  onToggle,
}: {
  phase: ApiSDLCPhase
  isCurrentPhase: boolean
  isExpanded: boolean
  onToggle: () => void
}) {
  const PhaseIcon = PHASE_ICONS[phase.phase]
  const colors = PHASE_COLORS[phase.phase]

  const statusLabel =
    phase.status === "completed"
      ? "Completed"
      : phase.status === "in-progress"
      ? "In Progress"
      : "Upcoming"

  const statusColor =
    phase.status === "completed"
      ? "bg-emerald-500 text-white"
      : phase.status === "in-progress"
      ? "bg-blue-500 text-white"
      : ""

  return (
    <Card
      className={`overflow-hidden transition-all cursor-pointer ${
        isCurrentPhase ? "ring-2 ring-primary" : ""
      }`}
      onClick={onToggle}
    >
      <div className="p-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${colors.bg}`}>
            <PhaseIcon className={`h-6 w-6 ${colors.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{phase.label}</h3>
                {isCurrentPhase && (
                  <Badge variant="outline" className="text-xs text-primary border-primary">
                    Current
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-xs ${statusColor}`} variant={phase.status === "upcoming" ? "outline" : "default"}>
                  {statusLabel}
                </Badge>
                <span className="text-sm text-muted-foreground">{phase.progress}%</span>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
            <Progress value={phase.progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1.5">{phase.description}</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-t p-4 space-y-4">
              {/* Required Deliverables */}
              {phase.requiredDeliverables.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Required Deliverables</h4>
                  <div className="space-y-2">
                    {phase.requiredDeliverables.map((dt) => {
                      const latestSub = phase.submissions
                        .filter((s) => s.deliverableType === dt)
                        .sort((a, b) => b.version - a.version)[0]
                      const approved = latestSub?.status === "APPROVED"

                      return (
                        <div
                          key={dt}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            approved ? "border-green-200 bg-green-50/40 dark:bg-green-950/10" : "border-border bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {approved ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm font-medium">{DELIVERABLE_LABELS[dt]}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {latestSub ? (
                              <>
                                <span className={`text-xs ${STATUS_META[latestSub.status].color}`}>
                                  {STATUS_META[latestSub.status].label}
                                </span>
                                {latestSub.grade !== null && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <Star className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
                                    {latestSub.grade}%
                                  </Badge>
                                )}
                                {latestSub.fileUrl && (
                                  <a
                                    href={latestSub.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </a>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not submitted</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Optional Deliverables */}
              {phase.optionalDeliverables.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    Optional Deliverables
                    <span className="text-xs text-muted-foreground font-normal">(don&apos;t block phase advancement)</span>
                  </h4>
                  <div className="space-y-2">
                    {phase.optionalDeliverables.map((dt) => {
                      const latestSub = phase.submissions
                        .filter((s) => s.deliverableType === dt)
                        .sort((a, b) => b.version - a.version)[0]
                      const approved = latestSub?.status === "APPROVED"

                      return (
                        <div
                          key={dt}
                          className="flex items-center justify-between p-3 rounded-lg border border-dashed border-border bg-muted/20"
                        >
                          <div className="flex items-center gap-2">
                            {approved ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                            )}
                            <span className="text-sm">{DELIVERABLE_LABELS[dt]}</span>
                            <Badge variant="outline" className="text-xs">Optional</Badge>
                          </div>
                          {latestSub ? (
                            <span className={`text-xs ${STATUS_META[latestSub.status].color}`}>
                              {STATUS_META[latestSub.status].label}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not submitted</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Feedback on submissions in this phase */}
              {phase.submissions.filter((s) => s.feedback).map((s) => (
                <div key={s.id} className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                    Feedback on {DELIVERABLE_LABELS[s.deliverableType]}
                  </p>
                  <p className="text-sm">{s.feedback}</p>
                  {s.reviewedBy && (
                    <p className="text-xs text-muted-foreground mt-1">— {s.reviewedBy.fullName}</p>
                  )}
                </div>
              ))}

              {/* MAINTENANCE has no deliverables */}
              {phase.phase === "MAINTENANCE" && phase.requiredDeliverables.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  No specific deliverables required — focus on monitoring, bug fixes, and improvements.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function SDLCPage() {
  const { currentUser } = useAuthStore()
  const [summary, setSummary] = useState<ApiSDLCSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedPhase, setExpandedPhase] = useState<ApiTeamStage | null>(null)
  const [advancing, setAdvancing] = useState(false)

  const isLeader = currentUser?.role === "leader"
  const isSupervisor = currentUser?.role === "doctor" || currentUser?.role === "ta"

  useEffect(() => {
    loadSummary()
  }, [])

  async function loadSummary() {
    setLoading(true)
    setError(null)
    try {
      const data = await submissionsApi.getSDLCSummary()
      setSummary(data)
      // Auto-expand current phase
      if (data.currentPhase) setExpandedPhase(data.currentPhase.phase)
    } catch (e: any) {
      setError(e.message || "Failed to load SDLC data")
    } finally {
      setLoading(false)
    }
  }

  async function handleAdvanceStage() {
    if (!summary?.canAdvanceStage) return
    if (
      !confirm(
        `Advance from "${summary.currentPhase?.label}" to "${summary.nextStage}"? This cannot be undone.`,
      )
    )
      return

    setAdvancing(true)
    try {
      const result = await submissionsApi.advanceStage()
      toast.success(result.message)
      await loadSummary()
    } catch (e: any) {
      toast.error(e.message || "Failed to advance stage")
    } finally {
      setAdvancing(false)
    }
  }

  function togglePhase(phase: ApiTeamStage) {
    setExpandedPhase((prev) => (prev === phase ? null : phase))
  }

  if (loading) {
    return (
      <TeamRequiredGuard
        pageName="SDLC Phases"
        pageDescription="Track your project through all software development lifecycle phases."
        icon={<Layers className="h-10 w-10 text-primary" />}
      >
        <div className="space-y-4 p-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </TeamRequiredGuard>
    )
  }

  if (error) {
    return (
      <TeamRequiredGuard
        pageName="SDLC Phases"
        pageDescription="Track your project through all software development lifecycle phases."
        icon={<Layers className="h-10 w-10 text-primary" />}
      >
        <div className="p-4">
          <Card className="p-6 border-destructive bg-destructive/10">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive">{error}</p>
              <Button variant="ghost" onClick={loadSummary} className="ml-auto">
                Retry
              </Button>
            </div>
          </Card>
        </div>
      </TeamRequiredGuard>
    )
  }

  if (!summary) return null

  const completedPhases = summary.phases.filter((p) => p.status === "completed").length
  const inProgressPhases = summary.phases.filter((p) => p.status === "in-progress").length
  const upcomingPhases = summary.phases.filter((p) => p.status === "upcoming").length
  const totalDeliverables = summary.phases.flatMap((p) => [
    ...p.requiredDeliverables,
    ...p.optionalDeliverables,
  ]).length
  const approvedDeliverables = summary.phases
    .flatMap((p) => p.submissions)
    .filter((s) => s.status === "APPROVED").length

  return (
    <TeamRequiredGuard
      pageName="SDLC Phases"
      pageDescription="Track your project through all software development lifecycle phases."
      icon={<Layers className="h-10 w-10 text-primary" />}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 p-4 sm:p-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
              SDLC Hub
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your project through all development phases
            </p>
            {summary.team && (
              <Badge variant="outline" className="mt-2">
                {summary.team.name} · {summary.currentPhase?.label ?? summary.team.stage}
              </Badge>
            )}
          </div>

          {/* Advance Stage Button */}
          {isLeader && summary.canAdvanceStage && summary.nextStage && (
            <Button onClick={handleAdvanceStage} disabled={advancing} className="gap-2">
              {advancing ? (
                "Advancing..."
              ) : (
                <>
                  Advance to {summary.nextStage}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>

        {/* Advance hint for supervisor */}
        {(isSupervisor) && summary.canAdvanceStage && (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <p className="text-sm">
                All required deliverables for <strong>{summary.currentPhase?.label}</strong> are approved.
                The team leader can advance to the next phase.
              </p>
            </div>
          </Card>
        )}

        {/* Progress Overview */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedPhases}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inProgressPhases}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Target className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingPhases}</p>
                <p className="text-xs text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.overallProgress}%</p>
                <p className="text-xs text-muted-foreground">Overall</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Overall Progress Bar */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall SDLC Progress</span>
            <span className="text-sm text-muted-foreground">
              {approvedDeliverables}/{totalDeliverables} deliverables approved
            </span>
          </div>
          <Progress value={summary.overallProgress} className="h-3" />
          <div className="flex justify-between mt-2">
            {summary.phases.map((p) => {
              const colors = PHASE_COLORS[p.phase]
              return (
                <div key={p.phase} className="flex flex-col items-center gap-1">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      p.status === "completed"
                        ? "bg-emerald-500"
                        : p.status === "in-progress"
                        ? "bg-blue-500"
                        : "bg-muted-foreground/30"
                    }`}
                  />
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {p.phase.charAt(0)}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Phase Cards */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Development Phases</h2>
          {summary.phases.map((phase, index) => (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <PhaseCard
                phase={phase}
                isCurrentPhase={phase.phase === summary.team.stage}
                isExpanded={expandedPhase === phase.phase}
                onToggle={() => togglePhase(phase.phase)}
              />
            </motion.div>
          ))}
        </div>

        {/* No-submissions hint */}
        {summary.phases.every((p) => p.submissions.length === 0) && (
          <Card className="p-6 text-center border-dashed">
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium mb-1">No submissions yet</p>
            <p className="text-sm text-muted-foreground">
              Go to{" "}
              <a href="/dashboard/submissions" className="text-primary underline underline-offset-2">
                Submissions
              </a>{" "}
              to upload the first deliverable for your current phase.
            </p>
          </Card>
        )}

        {/* Resources */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Resources & Best Practices</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Version Control", icon: GitBranch, color: "text-orange-500", bg: "bg-orange-500/10" },
              { title: "Code Quality", icon: Code, color: "text-blue-500", bg: "bg-blue-500/10" },
              { title: "Testing Guide", icon: TestTube, color: "text-purple-500", bg: "bg-purple-500/10" },
              { title: "Documentation", icon: BookOpen, color: "text-emerald-500", bg: "bg-emerald-500/10" },
              { title: "Security", icon: Shield, color: "text-red-500", bg: "bg-red-500/10" },
              { title: "Best Practices", icon: Lightbulb, color: "text-amber-500", bg: "bg-amber-500/10" },
            ].map((r) => (
              <Card key={r.title} className="p-4 hover:border-primary/50 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${r.bg}`}>
                    <r.icon className={`h-5 w-5 ${r.color}`} />
                  </div>
                  <span className="font-medium group-hover:text-primary transition-colors">
                    {r.title}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </motion.div>
    </TeamRequiredGuard>
  )
}
