"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent, ComponentType, FormEvent } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FileUp,
  Info,
  Layers3,
  Lock,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { TeamRequiredGuard } from "@/components/team-required-guard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth-store"
import {
  submissionsApi,
  type ApiDeliverableType,
  type ApiSubmission,
  type ApiSubmissionStatus,
} from "@/lib/api/submissions"
import type { ApiTeamStage } from "@/lib/api/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const PHASE_SEQUENCE: ApiTeamStage[] = [
  "REQUIREMENTS",
  "DESIGN",
  "IMPLEMENTATION",
  "TESTING",
  "DEPLOYMENT",
]

const PHASES_PER_PAGE = 2

type DeliverableMeta = {
  label: string
  phase: ApiTeamStage
  description: string
  required: boolean
  order: number
  guidePoints: string[]
}

type PhaseMeta = {
  label: string
  badgeClassName: string
  summary: string
  focusAreas: string[]
}

type DeliverableOption = {
  deliverableType: ApiDeliverableType
  phase: ApiTeamStage
  required: boolean
  disabled: boolean
  canResubmit: boolean
  helper: string
  reason?: string
  latestPhaseSubmission: ApiSubmission | null
}

type PhaseGateState = {
  tone: "ready" | "warning" | "locked" | "success"
  title: string
  description: string
}

const DELIVERABLE_META: Record<ApiDeliverableType, DeliverableMeta> = {
  SRS: {
    label: "SRS Document",
    phase: "REQUIREMENTS",
    description: "Software Requirements Specification with functional and non-functional requirements.",
    required: true,
    order: 0,
    guidePoints: [
      "Project scope, actors, constraints, and assumptions.",
      "Detailed functional requirements, use cases, and flows.",
      "Non-functional requirements such as performance, security, and usability.",
      "Acceptance criteria and traceability for later phases.",
    ],
  },
  UML: {
    label: "UML Diagrams",
    phase: "DESIGN",
    description: "Class, sequence, and activity diagrams covering the system design.",
    required: false,
    order: 0,
    guidePoints: [
      "Class diagrams for core entities and relationships.",
      "Sequence diagrams for critical workflows and interactions.",
      "Activity or state diagrams for process-heavy behavior.",
      "Design notes that explain architectural choices.",
    ],
  },
  CODE: {
    label: "Source Code",
    phase: "IMPLEMENTATION",
    description: "Complete source code repository or archive.",
    required: false,
    order: 0,
    guidePoints: [
      "Clean project structure matching the approved design.",
      "Documented setup instructions and runnable modules.",
      "Meaningful commits or packaged archive for review.",
      "Evidence that required features are implemented.",
    ],
  },
  PROTOTYPE: {
    label: "Prototype",
    phase: "IMPLEMENTATION",
    description: "Working prototype demonstrating core system functionality.",
    required: false,
    order: 1,
    guidePoints: [
      "Clickable or runnable preview of the main product flow.",
      "Screens or views that prove the core idea works.",
      "Early feedback artifact before the final implementation matures.",
    ],
  },
  TEST_PLAN: {
    label: "Test Plan",
    phase: "TESTING",
    description: "Test plan, test cases, and QA results.",
    required: true,
    order: 0,
    guidePoints: [
      "Testing scope, environments, and strategy overview.",
      "Functional, integration, regression, and edge-case test cases.",
      "Expected vs actual outcomes with pass/fail evidence.",
      "Defect notes, retest results, and QA summary.",
    ],
  },
  FINAL_REPORT: {
    label: "Final Report",
    phase: "DEPLOYMENT",
    description: "Comprehensive final project report.",
    required: true,
    order: 0,
    guidePoints: [
      "Project problem, solution, methodology, and implementation summary.",
      "Screenshots, architecture notes, and evaluation highlights.",
      "Challenges, lessons learned, and future improvements.",
      "Academic formatting and references ready for submission.",
    ],
  },
  PRESENTATION: {
    label: "Presentation",
    phase: "DEPLOYMENT",
    description: "Final project presentation slides.",
    required: true,
    order: 1,
    guidePoints: [
      "Problem, solution, and value proposition in a concise narrative.",
      "Core workflow demo or screenshots with key outcomes.",
      "Architecture, testing, and deployment highlights.",
      "Strong conclusion with results and next steps.",
    ],
  },
}

const PHASE_META: Record<ApiTeamStage, PhaseMeta> = {
  REQUIREMENTS: {
    label: "Requirements",
    badgeClassName: "border-blue-200 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    summary: "Define exactly what the system must do before building anything.",
    focusAreas: [
      "Clarify project scope and stakeholder expectations.",
      "Document functional and non-functional requirements.",
      "Create acceptance criteria that guide the rest of the project.",
    ],
  },
  DESIGN: {
    label: "Design",
    badgeClassName: "border-purple-200 bg-purple-500/10 text-purple-700 dark:text-purple-300",
    summary: "Translate approved requirements into architecture and technical structure.",
    focusAreas: [
      "Break the system into modules, entities, and interactions.",
      "Model workflows visually so implementation is less risky.",
      "Align UI, backend, and data design before coding at scale.",
    ],
  },
  IMPLEMENTATION: {
    label: "Implementation",
    badgeClassName: "border-orange-200 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    summary: "Build the actual system and turn the design into a working product.",
    focusAreas: [
      "Implement the agreed features in a stable codebase.",
      "Keep setup, structure, and handoff clear for reviewers.",
      "Use optional prototype iterations to validate UX early.",
    ],
  },
  TESTING: {
    label: "Testing",
    badgeClassName: "border-yellow-200 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
    summary: "Prove that the delivered system works reliably and meets expectations.",
    focusAreas: [
      "Prepare test strategy and meaningful test cases.",
      "Capture pass/fail evidence, bugs, and retest outcomes.",
      "Show quality assurance maturity before final delivery.",
    ],
  },
  DEPLOYMENT: {
    label: "Deployment",
    badgeClassName: "border-green-200 bg-green-500/10 text-green-700 dark:text-green-300",
    summary: "Package the project professionally for evaluation and final handoff.",
    focusAreas: [
      "Summarize the project clearly in the report.",
      "Prepare a polished presentation for the final review.",
      "Make sure the team can explain results, impact, and decisions.",
    ],
  },
  MAINTENANCE: {
    label: "Maintenance",
    badgeClassName: "border-slate-200 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    summary: "Support and improve the system after release.",
    focusAreas: [
      "Fix issues and improve quality from real feedback.",
      "Document changes and incremental enhancements.",
    ],
  },
}

const STATUS_META: Record<
  ApiSubmissionStatus,
  {
    label: string
    icon: ComponentType<{ className?: string }>
    variant: "default" | "secondary" | "destructive" | "outline"
    progress: number
  }
> = {
  PENDING: { label: "Pending Review", icon: Clock, variant: "secondary", progress: 68 },
  UNDER_REVIEW: { label: "Under Review", icon: Eye, variant: "secondary", progress: 82 },
  REVISION_REQUIRED: { label: "Needs Revision", icon: RotateCcw, variant: "destructive", progress: 48 },
  APPROVED: { label: "Approved", icon: CheckCircle2, variant: "default", progress: 100 },
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatFileTypeLabel(fileType: string | null, fileName: string | null) {
  if (fileType && fileType.includes("/")) {
    return fileType.split("/")[1].toUpperCase()
  }

  if (fileType) {
    return fileType.toUpperCase()
  }

  const extension = fileName?.split(".").pop()
  return extension ? extension.toUpperCase() : "FILE"
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getDeliverablesForPhase(phase: ApiTeamStage) {
  return (Object.entries(DELIVERABLE_META) as [ApiDeliverableType, DeliverableMeta][])
    .filter(([, meta]) => meta.phase === phase)
    .sort(([, leftMeta], [, rightMeta]) => leftMeta.order - rightMeta.order)
    .map(([deliverableType]) => deliverableType)
}

function getLatestSubmissionForPhase(submissions: ApiSubmission[], phase: ApiTeamStage) {
  return submissions
    .filter((submission) => submission.sdlcPhase === phase)
    .sort((left, right) => {
      if (right.version !== left.version) {
        return right.version - left.version
      }

      return new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()
    })[0] ?? null
}

function getLatestSubmissionForDeliverable(
  submissions: ApiSubmission[],
  deliverableType: ApiDeliverableType,
) {
  return submissions
    .filter((submission) => submission.deliverableType === deliverableType)
    .sort((left, right) => right.version - left.version)[0] ?? null
}

function getDeliverableAvailability(
  submissions: ApiSubmission[],
  deliverableType: ApiDeliverableType,
): DeliverableOption {
  const deliverableMeta = DELIVERABLE_META[deliverableType]
  const latestPhaseSubmission = getLatestSubmissionForPhase(submissions, deliverableMeta.phase)
  const latestDeliverableSubmission = getLatestSubmissionForDeliverable(submissions, deliverableType)

  if (!latestPhaseSubmission) {
    return {
      deliverableType,
      phase: deliverableMeta.phase,
      required: deliverableMeta.required,
      disabled: false,
      canResubmit: false,
      helper: deliverableMeta.required
        ? "Required deliverable and ready for its first submission."
        : "Optional deliverable and ready whenever the phase opens.",
      latestPhaseSubmission: null,
    }
  }

  if (latestPhaseSubmission.status === "PENDING" || latestPhaseSubmission.status === "UNDER_REVIEW") {
    return {
      deliverableType,
      phase: deliverableMeta.phase,
      required: deliverableMeta.required,
      disabled: true,
      canResubmit: false,
      helper: "This phase is waiting for a review result.",
      reason: `Wait until "${DELIVERABLE_META[latestPhaseSubmission.deliverableType].label}" is reviewed before submitting another item in ${PHASE_META[deliverableMeta.phase].label}.`,
      latestPhaseSubmission,
    }
  }

  if (latestPhaseSubmission.status === "REVISION_REQUIRED") {
    if (latestPhaseSubmission.deliverableType === deliverableType) {
      return {
        deliverableType,
        phase: deliverableMeta.phase,
        required: deliverableMeta.required,
        disabled: false,
        canResubmit: true,
        helper: "Revision requested. Upload an updated version for this same deliverable.",
        latestPhaseSubmission,
      }
    }

    return {
      deliverableType,
      phase: deliverableMeta.phase,
      required: deliverableMeta.required,
      disabled: true,
      canResubmit: false,
      helper: "The current deliverable must be fixed first.",
      reason: `Finish the requested revision for "${DELIVERABLE_META[latestPhaseSubmission.deliverableType].label}" before starting another submission in this phase.`,
      latestPhaseSubmission,
    }
  }

  return {
    deliverableType,
    phase: deliverableMeta.phase,
    required: deliverableMeta.required,
    disabled: false,
    canResubmit: false,
    helper:
      latestDeliverableSubmission?.status === "APPROVED"
        ? "Approved already. You can upload an updated version if your supervisor asks for one."
        : deliverableMeta.required
          ? "Required deliverable and currently open for submission."
          : "Optional deliverable and currently open for submission.",
    latestPhaseSubmission,
  }
}

function getPhaseGateState(submissions: ApiSubmission[], phase: ApiTeamStage): PhaseGateState {
  const latestPhaseSubmission = getLatestSubmissionForPhase(submissions, phase)

  if (!latestPhaseSubmission) {
    return {
      tone: "ready",
      title: "Ready for the first submission",
      description: "No deliverables have been uploaded in this phase yet.",
    }
  }

  if (latestPhaseSubmission.status === "PENDING" || latestPhaseSubmission.status === "UNDER_REVIEW") {
    return {
      tone: "locked",
      title: "Phase queue is temporarily locked",
      description: `The latest submission in this phase is "${DELIVERABLE_META[latestPhaseSubmission.deliverableType].label}" and it must finish review before another item can be uploaded here.`,
    }
  }

  if (latestPhaseSubmission.status === "REVISION_REQUIRED") {
    return {
      tone: "warning",
      title: "Revision must be resolved first",
      description: `A reviewer asked for changes on "${DELIVERABLE_META[latestPhaseSubmission.deliverableType].label}". Re-submit that same deliverable before moving to another one in this phase.`,
    }
  }

  return {
    tone: "success",
    title: "Phase is open for the next deliverable",
    description: "The latest item in this phase is approved, so the next deliverable can move forward.",
  }
}

function buildPaginationItems(currentPage: number, totalPages: number) {
  return Array.from({ length: totalPages }, (_, index) => index + 1)
}

function getAlertClassName(tone: PhaseGateState["tone"]) {
  if (tone === "success") return "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300"
  if (tone === "warning") return "border-amber-500/20 bg-amber-500/[0.10] text-amber-700 dark:text-amber-300"
  if (tone === "locked") return "border-destructive/20 bg-destructive/[0.07] text-destructive"
  return "border-primary/20 bg-primary/[0.06] text-primary"
}

function PhaseGuideDialog({ phase }: { phase: ApiTeamStage }) {
  const phaseMeta = PHASE_META[phase]
  const phaseDeliverables = getDeliverablesForPhase(phase)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl bg-transparent">
          <BookOpenText className="mr-2 h-4 w-4" />
          Phase Guide
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="border-b border-border/60 bg-gradient-to-r from-primary/10 via-primary/[0.04] to-transparent p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <Badge variant="outline" className={cn("rounded-full px-3 py-1", phaseMeta.badgeClassName)}>
                {phaseMeta.label}
              </Badge>
              <DialogHeader className="text-left">
                <DialogTitle className="text-2xl font-semibold">
                  {phaseMeta.label} Phase
                </DialogTitle>
                <DialogDescription className="max-w-2xl leading-6">
                  {phaseMeta.summary}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{phaseDeliverables.length} deliverable(s)</p>
              <p className="mt-1">
                {phaseDeliverables.filter((deliverableType) => DELIVERABLE_META[deliverableType].required).length} required
              </p>
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 p-6">
            <section className="rounded-2xl border border-border/60 bg-muted/25 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                What This Phase Covers
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {phaseMeta.focusAreas.map((item) => (
                  <div key={item} className="rounded-2xl border border-border/60 bg-background/80 p-4 text-sm leading-6">
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Deliverables In This Phase
              </h3>
              {phaseDeliverables.map((deliverableType) => {
                const meta = DELIVERABLE_META[deliverableType]

                return (
                  <div
                    key={deliverableType}
                    className="rounded-[24px] border border-border/60 bg-background/90 p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-semibold">{meta.label}</h4>
                          <Badge variant={meta.required ? "default" : "secondary"} className="rounded-full">
                            {meta.required ? "Required" : "Optional"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {meta.description}
                        </p>
                      </div>
                      <div className="rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                        {phaseMeta.label}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {meta.guidePoints.map((point) => (
                        <div
                          key={point}
                          className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm leading-6"
                        >
                          {point}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t border-border/60 bg-background/90 px-6 py-4">
          <p className="mr-auto text-sm text-muted-foreground">
            Required deliverables must be approved before the team can close this phase cleanly.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SubmissionDetailDialog({
  submissions,
  initialVersionId,
  canGrade,
  canDelete,
  onGraded,
  onDeleted,
}: {
  submissions: ApiSubmission[]
  initialVersionId?: string
  canGrade: boolean
  canDelete: boolean
  onGraded: (updated: ApiSubmission) => void
  onDeleted?: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(initialVersionId || null)
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false)
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false)
  const [grade, setGrade] = useState("")
  const [gradeFeedback, setGradeFeedback] = useState("")
  const [revisionFeedback, setRevisionFeedback] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedVersionId(initialVersionId || submissions[0]?.id || null)
    }
  }, [initialVersionId, open, submissions])

  const submission = submissions.find((item) => item.id === selectedVersionId) || submissions[0]
  if (!submission) return null

  const meta = DELIVERABLE_META[submission.deliverableType]
  const phaseMeta = PHASE_META[submission.sdlcPhase]
  const statusInfo = STATUS_META[submission.status]
  const StatusIcon = statusInfo.icon
  const isLatest = submission.id === submissions[0]?.id
  const hasMultipleVersions = submissions.length > 1

  async function handleDeleteSingle() {
    setIsDeleting(true)
    try {
      await submissionsApi.delete(submission.id)
      onDeleted?.(submission.id)
      setDeleteAlertOpen(false)
      toast.success("Version deleted successfully")

      if (submissions.length <= 1) {
        setOpen(false)
      } else {
        const remaining = submissions.filter((item) => item.id !== submission.id)
        setSelectedVersionId(remaining[0]?.id || null)
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete submission")
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleGrade() {
    const parsedGrade = Number.parseInt(grade, 10)
    if (Number.isNaN(parsedGrade) || parsedGrade < 0 || parsedGrade > 100) {
      toast.error("Grade must be between 0 and 100")
      return
    }

    setLoading(true)
    try {
      const updated = await submissionsApi.grade(submission.id, {
        grade: parsedGrade,
        feedback: gradeFeedback || undefined,
      })
      onGraded(updated)
      setGradeDialogOpen(false)
      setOpen(false)
      toast.success("Submission graded successfully")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to grade submission")
    } finally {
      setLoading(false)
    }
  }

  async function handleRequestRevision() {
    if (revisionFeedback.trim().length < 10) {
      toast.error("Please provide at least 10 characters of feedback")
      return
    }

    setLoading(true)
    try {
      const updated = await submissionsApi.requestRevision(submission.id, {
        feedback: revisionFeedback,
      })
      onGraded(updated)
      setRevisionDialogOpen(false)
      setOpen(false)
      toast.success("Revision requested")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to request revision")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="rounded-xl bg-transparent">
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            View Details
          </Button>
        </DialogTrigger>
        <DialogContent
          className={cn(
            "w-[95vw] sm:w-[90vw] p-0 gap-0 overflow-hidden",
            hasMultipleVersions ? "sm:max-w-[1040px]" : "sm:max-w-[760px]",
          )}
        >
          <div className="flex max-h-[85vh] bg-background">
            {hasMultipleVersions ? (
              <div className="hidden w-[290px] shrink-0 border-r border-border/60 bg-muted/10 md:flex md:flex-col">
                <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold">Version History</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {submissions.length} saved versions
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[10px] font-medium">
                    {submissions.length}
                  </Badge>
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-3 p-4">
                    {submissions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedVersionId(item.id)}
                        className={cn(
                          "w-full rounded-2xl border p-4 text-left transition-all",
                          selectedVersionId === item.id
                            ? "border-primary/40 bg-primary/[0.06] shadow-sm"
                            : "border-border/60 bg-background/90 hover:border-primary/25 hover:bg-background",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn("text-base font-semibold", selectedVersionId === item.id && "text-primary")}>
                            v{item.version}
                          </span>
                          <Badge variant={STATUS_META[item.status].variant} className="rounded-full px-2 py-0 text-[10px]">
                            {STATUS_META[item.status].label}
                          </Badge>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {formatDateLabel(item.submittedAt)}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : null}

            <ScrollArea className="min-w-0 flex-1">
              <div className="space-y-8 p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        Version {submission.version}
                      </Badge>
                      <Badge variant="outline" className={cn("rounded-full px-3 py-1", phaseMeta.badgeClassName)}>
                        {phaseMeta.label}
                      </Badge>
                      <Badge variant={meta.required ? "default" : "secondary"} className="rounded-full px-3 py-1">
                        {meta.required ? "Required" : "Optional"}
                      </Badge>
                    </div>
                    <DialogHeader className="text-left">
                      <DialogTitle className="text-2xl font-semibold md:text-3xl">
                        {meta.label}
                      </DialogTitle>
                      <DialogDescription className="max-w-2xl leading-6">
                        {meta.description}
                      </DialogDescription>
                    </DialogHeader>
                  </div>

                  {canDelete && submission.status !== "APPROVED" ? (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteAlertOpen(true)}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Delete Version
                      </Button>

                      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                              <AlertTriangle className="h-5 w-5" />
                              Delete Version
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete v{submission.version} of this submission? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(event) => {
                                event.preventDefault()
                                void handleDeleteSingle()
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              disabled={isDeleting}
                            >
                              {isDeleting ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={statusInfo.variant} className="gap-1.5 rounded-full px-3 py-1.5 text-sm">
                    <StatusIcon className="h-4 w-4" />
                    {statusInfo.label}
                  </Badge>
                  {submission.late ? (
                    <Badge variant="destructive" className="rounded-full px-3 py-1.5 text-sm">
                      Late Submission
                    </Badge>
                  ) : null}
                  {submission.grade !== null ? (
                    <Badge
                      variant="outline"
                      className="gap-1.5 rounded-full border-yellow-200 bg-yellow-50 px-3 py-1.5 text-sm text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400"
                    >
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      Score: {submission.grade}%
                    </Badge>
                  ) : null}
                  {isLatest ? (
                    <Badge variant="outline" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground">
                      Latest version
                    </Badge>
                  ) : null}
                </div>

                <div className="grid gap-4 rounded-[24px] border border-border/60 bg-muted/20 p-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Submitted By
                    </p>
                    <p className="mt-2 text-sm font-medium">{submission.submittedBy?.fullName || "System"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Submitted On
                    </p>
                    <p className="mt-2 text-sm font-medium">{formatDateLabel(submission.submittedAt)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(submission.submittedAt).toLocaleTimeString()}
                    </p>
                  </div>
                  {submission.deadline ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Deadline
                      </p>
                      <p className="mt-2 text-sm font-medium">{formatDateLabel(submission.deadline)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(submission.deadline).toLocaleTimeString()}
                      </p>
                    </div>
                  ) : null}
                  {submission.reviewedBy ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Reviewed By
                      </p>
                      <p className="mt-2 text-sm font-medium">{submission.reviewedBy.fullName}</p>
                    </div>
                  ) : null}
                </div>

                {submission.title ? (
                  <section>
                    <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Submission Title
                    </h4>
                    <p className="mt-3 text-sm leading-6">{submission.title}</p>
                  </section>
                ) : null}

                {submission.notes ? (
                  <section>
                    <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Submission Notes
                    </h4>
                    <p className="mt-3 rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm italic leading-6">
                      &quot;{submission.notes}&quot;
                    </p>
                  </section>
                ) : null}

                {submission.fileName ? (
                  <section>
                    <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      <FileUp className="h-4 w-4" />
                      Deliverable File
                    </h4>
                    <div className="mt-3 flex flex-col gap-4 rounded-[24px] border border-border/60 bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{submission.fileName}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium tracking-[0.16em]">
                              {formatFileTypeLabel(submission.fileType, submission.fileName)}
                            </span>
                            <span>•</span>
                            <span>{formatFileSize(submission.fileSize)}</span>
                          </p>
                        </div>
                      </div>

                      {submission.fileUrl ? (
                        <Button size="sm" className="rounded-xl shadow-sm sm:w-auto" variant="secondary" asChild>
                          <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                {submission.feedback ? (
                  <section className="rounded-[24px] border border-blue-100 bg-blue-50/60 p-5 dark:border-blue-900 dark:bg-blue-950/20">
                    <div className="mb-3 flex items-center gap-2 text-blue-700 dark:text-blue-400">
                      <MessageSquare className="h-4 w-4" />
                      <h4 className="text-sm font-semibold uppercase tracking-[0.16em]">
                        Supervisor Feedback
                      </h4>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6">{submission.feedback}</p>
                  </section>
                ) : null}

                {canGrade && submission.status !== "APPROVED" && isLatest ? (
                  <div className="flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row">
                    <Button
                      size="lg"
                      className="flex-1 rounded-xl shadow-sm"
                      onClick={() => {
                        setOpen(false)
                        setGradeDialogOpen(true)
                      }}
                    >
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                      Grade Submission
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="flex-1 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        setOpen(false)
                        setRevisionDialogOpen(true)
                      }}
                    >
                      <RotateCcw className="mr-2 h-5 w-5" />
                      Request Revision
                    </Button>
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={gradeDialogOpen} onOpenChange={setGradeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Grade Submission</DialogTitle>
            <DialogDescription>
              Approving this version unlocks the phase for the next deliverable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Grade (0-100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
                placeholder="e.g. 85"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Feedback (optional)</Label>
              <Textarea
                value={gradeFeedback}
                onChange={(event) => setGradeFeedback(event.target.value)}
                placeholder="Add feedback for the team..."
                className="mt-1.5 resize-none"
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void handleGrade()} disabled={loading} className="flex-1">
                {loading ? "Grading..." : "Submit Grade"}
              </Button>
              <Button variant="outline" onClick={() => setGradeDialogOpen(false)} disabled={loading}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
            <DialogDescription>
              The team will only be able to re-submit this same deliverable until the revision is resolved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Feedback</Label>
              <Textarea
                value={revisionFeedback}
                onChange={(event) => setRevisionFeedback(event.target.value)}
                placeholder="Describe what needs to be revised..."
                className="mt-1.5 resize-none"
                rows={5}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => void handleRequestRevision()}
                disabled={loading}
                className="flex-1"
              >
                {loading ? "Requesting..." : "Request Revision"}
              </Button>
              <Button variant="outline" onClick={() => setRevisionDialogOpen(false)} disabled={loading}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function NewSubmissionDialog({
  onCreated,
  deliverableOptions,
}: {
  onCreated: (submission: ApiSubmission) => void
  deliverableOptions: DeliverableOption[]
}) {
  const [open, setOpen] = useState(false)
  const [deliverableType, setDeliverableType] = useState<ApiDeliverableType | "">("")
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [formErrors, setFormErrors] = useState<{ type?: string; file?: string; general?: string }>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const availableOptions = useMemo(
    () => deliverableOptions.filter((option) => !option.disabled),
    [deliverableOptions],
  )

  const firstEnabledDeliverable = availableOptions[0]?.deliverableType ?? ""
  const selectedOption = deliverableOptions.find((option) => option.deliverableType === deliverableType) ?? null
  const isQueueLocked = availableOptions.length === 0

  useEffect(() => {
    if (open && !deliverableType && firstEnabledDeliverable) {
      setDeliverableType(firstEnabledDeliverable)
    }
  }, [deliverableType, firstEnabledDeliverable, open])

  function resetForm() {
    setDeliverableType(firstEnabledDeliverable)
    setTitle("")
    setNotes("")
    setFile(null)
    setFormErrors({})
    if (fileRef.current) {
      fileRef.current.value = ""
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const selectedFile = file
    const selectedDeliverable = deliverableOptions.find(
      (option) => option.deliverableType === deliverableType,
    )

    const errors: { type?: string; file?: string; general?: string } = {}
    if (!deliverableType || !selectedDeliverable) {
      errors.type = "Please select a deliverable type."
    }
    if (!selectedFile) {
      errors.file = "Please upload a file."
    }
    if (selectedDeliverable?.disabled) {
      errors.general = selectedDeliverable.reason || "This deliverable is currently locked."
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    if (!selectedDeliverable || !selectedFile) {
      return
    }

    const deliverableKey = selectedDeliverable.deliverableType

    setLoading(true)
    try {
      const created = await submissionsApi.create(
        {
          deliverableType: deliverableKey,
          sdlcPhase: DELIVERABLE_META[deliverableKey].phase,
          title: title || undefined,
          notes: notes || undefined,
        },
        selectedFile,
      )
      onCreated(created)
      resetForm()
      setOpen(false)
      toast.success("Deliverable submitted successfully")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Submission failed")
    } finally {
      setLoading(false)
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null)
    if (formErrors.file) {
      setFormErrors((current) => ({ ...current, file: undefined }))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) {
          resetForm()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="rounded-xl shadow-sm">
          <Upload className="mr-2 h-4 w-4" />
          New Submission
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[92vw] max-w-xl overflow-hidden p-0 sm:max-w-[680px]">
        <div className="max-h-[82vh] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <DialogHeader>
            <DialogTitle>Submit Deliverable</DialogTitle>
            <DialogDescription>
              Required items are highlighted, and each phase accepts one active review flow at a time.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/[0.05] p-3.5 text-sm leading-6 text-muted-foreground">
            <p className="font-medium text-foreground">Submission rule</p>
            <p className="mt-1">
              A phase stays locked while its latest submission is waiting for review. If revisions are requested, only the same deliverable can be re-submitted until it is accepted.
            </p>
          </div>

          {isQueueLocked ? (
            <div className="mt-4 rounded-2xl border border-destructive/25 bg-destructive/[0.07] p-3.5 text-sm text-destructive">
              No deliverable is open right now. Finish the current phase review or revision flow first, then come back to upload the next item.
            </div>
          ) : null}

          {formErrors.general ? (
            <div className="mt-4 rounded-2xl border border-destructive/25 bg-destructive/[0.07] p-3.5 text-sm text-destructive">
              {formErrors.general}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <Label className={formErrors.type ? "text-destructive" : ""}>Deliverable Type *</Label>
            <Select
              value={deliverableType}
              onValueChange={(value) => {
                setDeliverableType(value as ApiDeliverableType)
                setFormErrors((current) => ({ ...current, type: undefined, general: undefined }))
              }}
            >
              <SelectTrigger
                className={cn(
                  "mt-1.5 rounded-xl",
                  formErrors.type && "border-destructive focus:ring-destructive",
                )}
              >
                <SelectValue placeholder="Select deliverable..." />
              </SelectTrigger>
              <SelectContent>
                {deliverableOptions.map((option) => {
                  const meta = DELIVERABLE_META[option.deliverableType]

                  return (
                    <SelectItem
                      key={option.deliverableType}
                      value={option.deliverableType}
                      disabled={option.disabled}
                    >
                      <div className="flex items-center gap-2">
                        <span>{meta.label}</span>
                        <span className="text-xs text-muted-foreground">({PHASE_META[meta.phase].label})</span>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {meta.required ? "Required" : "Optional"}
                        </span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {formErrors.type ? (
              <p className="mt-1 text-[10px] font-medium text-destructive">{formErrors.type}</p>
            ) : null}
          </div>

          {selectedOption ? (
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("rounded-full", PHASE_META[selectedOption.phase].badgeClassName)}>
                  {PHASE_META[selectedOption.phase].label}
                </Badge>
                <Badge variant={selectedOption.required ? "default" : "secondary"} className="rounded-full">
                  {selectedOption.required ? "Required" : "Optional"}
                </Badge>
                {selectedOption.canResubmit ? (
                  <Badge variant="secondary" className="rounded-full">
                    Revision re-submit
                  </Badge>
                ) : null}
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                {DELIVERABLE_META[selectedOption.deliverableType].label}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{selectedOption.helper}</p>
              {selectedOption.reason ? (
                <p className="mt-2 text-sm text-destructive">{selectedOption.reason}</p>
              ) : null}
            </div>
          ) : null}

          <div>
            <Label>Title (optional)</Label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. SRS v2 - Final Review"
              className="mt-1.5 rounded-xl"
            />
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add notes for your supervisor..."
              rows={2}
              className="mt-1.5 resize-none rounded-xl"
            />
          </div>

          <div>
            <Label className={formErrors.file ? "text-destructive" : ""}>File *</Label>
            <div
              className={cn(
                "mt-1.5 cursor-pointer rounded-[22px] border-2 border-dashed p-5 text-center transition-colors",
                formErrors.file
                  ? "border-destructive bg-destructive/5 hover:border-destructive"
                  : "border-border hover:border-primary/50",
              )}
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to upload</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF, DOCX, PPT, ZIP, TXT, PNG, JPG and similar files up to 50 MB
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,.png,.jpg,.jpeg"
              onChange={handleFileChange}
            />
            {formErrors.file ? (
              <p className="mt-1 text-[10px] font-medium text-destructive">{formErrors.file}</p>
            ) : null}
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={loading || isQueueLocked} className="flex-1 rounded-xl">
              {loading ? "Submitting..." : "Submit"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm()
                setOpen(false)
              }}
              disabled={loading}
              className="rounded-xl"
            >
              Cancel
            </Button>
          </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DeliverableRow({
  deliverableType,
  submissions,
  availability,
  canGrade,
  canDelete,
  onUpdated,
  onDeleted,
}: {
  deliverableType: ApiDeliverableType
  submissions: ApiSubmission[]
  availability: DeliverableOption
  canGrade: boolean
  canDelete: boolean
  onUpdated: (submission: ApiSubmission) => void
  onDeleted: (id: string) => void
}) {
  const meta = DELIVERABLE_META[deliverableType]
  const latest = submissions[0] ?? null
  const latestStatusInfo = latest ? STATUS_META[latest.status] : null
  const phaseLockedByDifferentDeliverable =
    availability.disabled &&
    availability.latestPhaseSubmission &&
    availability.latestPhaseSubmission.deliverableType !== deliverableType

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete(id: string) {
    setIsDeleting(true)
    try {
      await submissionsApi.delete(id)
      onDeleted(id)
      setIsDeleteDialogOpen(false)
      toast.success("Submission deleted")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300 }}
      className={cn(
        "rounded-[24px] border p-5 transition-all",
        latest?.status === "APPROVED"
          ? "border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10"
          : latest?.status === "REVISION_REQUIRED"
            ? "border-amber-200 bg-amber-50/30 dark:bg-amber-950/10"
            : "border-border/60 bg-background/90 hover:border-primary/20",
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{meta.label}</h3>
            <Badge variant="outline" className={cn("rounded-full px-3 py-1", PHASE_META[meta.phase].badgeClassName)}>
              {PHASE_META[meta.phase].label}
            </Badge>
            <Badge variant={meta.required ? "default" : "secondary"} className="rounded-full">
              {meta.required ? "Required" : "Optional"}
            </Badge>
            {latest ? (
              <Badge variant={STATUS_META[latest.status].variant} className="gap-1 rounded-full px-3 py-1">
                {(() => {
                  const StatusIcon = STATUS_META[latest.status].icon
                  return <StatusIcon className="h-3.5 w-3.5" />
                })()}
                {STATUS_META[latest.status].label}
              </Badge>
            ) : null}
            {latest?.late ? (
              <Badge variant="destructive" className="rounded-full">
                Late
              </Badge>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">{meta.description}</p>

          {latest ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>v{latest.version}</span>
              <span>•</span>
              <span>{formatDateLabel(latest.submittedAt)}</span>
              {latest.grade !== null ? (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                    {latest.grade}%
                  </span>
                </>
              ) : null}
              {latest.submittedBy ? (
                <>
                  <span>•</span>
                  <span>{latest.submittedBy.fullName}</span>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4">
            <Progress value={latestStatusInfo?.progress ?? 0} className="h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              {latest
                ? latest.status === "APPROVED"
                  ? "Approved and closed."
                  : latest.status === "REVISION_REQUIRED"
                    ? "Waiting for an updated version of this same deliverable."
                    : "Currently in the review queue."
                : "Not submitted yet."}
            </p>
          </div>

          {availability.canResubmit ? (
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] p-4 text-sm text-amber-700 dark:text-amber-300">
              <p className="font-medium">Revision path is open</p>
              <p className="mt-1 leading-6">
                This is the only deliverable currently allowed in this phase until the revision gets approved.
              </p>
            </div>
          ) : null}

          {phaseLockedByDifferentDeliverable ? (
            <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/[0.06] p-4 text-sm text-destructive">
              <p className="font-medium">Phase is locked for now</p>
              <p className="mt-1 leading-6">{availability.reason}</p>
            </div>
          ) : null}

          {latest?.feedback ? (
            <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Supervisor Feedback
              </p>
              <p className="mt-2 text-sm leading-6">{latest.feedback}</p>
            </div>
          ) : null}

          {submissions.length > 1 ? (
            <p className="mt-4 text-xs text-muted-foreground">{submissions.length} versions submitted</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {latest ? (
            <SubmissionDetailDialog
              submissions={submissions}
              canGrade={canGrade}
              canDelete={canDelete}
              onGraded={onUpdated}
              onDeleted={onDeleted}
            />
          ) : null}

          {latest && canDelete && latest.status !== "APPROVED" ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      Delete Submission
                    </DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete this submission? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => void handleDelete(latest.id)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}

export default function SubmissionsPage() {
  const { currentUser } = useAuthStore()
  const [submissions, setSubmissions] = useState<ApiSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState("")
  const [phasePage, setPhasePage] = useState(1)

  const normalizedRole = String(currentUser?.role ?? "").toUpperCase()
  const isLeader = normalizedRole === "LEADER"
  const isSupervisor = normalizedRole === "DOCTOR" || normalizedRole === "TA"
  const isAdmin = normalizedRole === "ADMIN"
  const canCreateSubmission = isLeader
  const canGradeSubmission = isSupervisor || isAdmin
  const canDeleteSubmission = isLeader || isAdmin

  useEffect(() => {
    void loadSubmissions()
  }, [])

  async function loadSubmissions() {
    setLoading(true)
    setError(null)
    try {
      const data = await submissionsApi.list()
      setSubmissions(data)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to load submissions")
    } finally {
      setLoading(false)
    }
  }

  function handleCreated(submission: ApiSubmission) {
    setSubmissions((current) => [submission, ...current])
  }

  function handleUpdated(submission: ApiSubmission) {
    setSubmissions((current) => current.map((item) => (item.id === submission.id ? submission : item)))
  }

  function handleDeleted(id: string) {
    setSubmissions((current) => current.filter((item) => item.id !== id))
  }

  const uniqueTeams = useMemo(() => {
    const teams = new Map<string, { id: string; name: string }>()

    submissions.forEach((submission) => {
      if (submission.team) {
        teams.set(submission.teamId, submission.team)
      }
    })

    return Array.from(teams.values())
  }, [submissions])

  useEffect(() => {
    if ((isSupervisor || isAdmin) && uniqueTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(uniqueTeams[0].id)
    }
  }, [isAdmin, isSupervisor, selectedTeamId, uniqueTeams])

  const displaySubmissions =
    (isSupervisor || isAdmin) && selectedTeamId
      ? submissions.filter((submission) => submission.teamId === selectedTeamId)
      : submissions

  const byDeliverable = useMemo(
    () =>
      (Object.keys(DELIVERABLE_META) as ApiDeliverableType[]).reduce(
        (accumulator, deliverableType) => {
          accumulator[deliverableType] = displaySubmissions
            .filter((submission) => submission.deliverableType === deliverableType)
            .sort((left, right) => right.version - left.version)
          return accumulator
        },
        {} as Record<ApiDeliverableType, ApiSubmission[]>,
      ),
    [displaySubmissions],
  )

  const statsSource = displaySubmissions
  const totalCount = statsSource.length
  const gradedCount = statsSource.filter((submission) => submission.grade !== null).length
  const approvedCount = statsSource.filter((submission) => submission.status === "APPROVED").length
  const lateCount = statsSource.filter((submission) => submission.late).length
  const avgGrade =
    gradedCount > 0
      ? Math.round(
          statsSource
            .filter((submission) => submission.grade !== null)
            .reduce((total, submission) => total + (submission.grade ?? 0), 0) / gradedCount,
        )
      : 0

  const pendingReviews = displaySubmissions.filter(
    (submission) => submission.status === "PENDING" || submission.status === "UNDER_REVIEW",
  )

  const deliverableOptions = useMemo(
    () =>
      (Object.keys(DELIVERABLE_META) as ApiDeliverableType[])
        .sort((left, right) => {
          const leftMeta = DELIVERABLE_META[left]
          const rightMeta = DELIVERABLE_META[right]

          if (leftMeta.phase !== rightMeta.phase) {
            return PHASE_SEQUENCE.indexOf(leftMeta.phase) - PHASE_SEQUENCE.indexOf(rightMeta.phase)
          }

          return leftMeta.order - rightMeta.order
        })
        .map((deliverableType) => getDeliverableAvailability(displaySubmissions, deliverableType)),
    [displaySubmissions],
  )

  const totalPhasePages = Math.max(1, Math.ceil(PHASE_SEQUENCE.length / PHASES_PER_PAGE))
  const visiblePhases = useMemo(() => {
    const startIndex = (phasePage - 1) * PHASES_PER_PAGE
    return PHASE_SEQUENCE.slice(startIndex, startIndex + PHASES_PER_PAGE)
  }, [phasePage])
  const phasePaginationItems = useMemo(
    () => buildPaginationItems(phasePage, totalPhasePages),
    [phasePage, totalPhasePages],
  )

  useEffect(() => {
    setPhasePage((currentPage) => Math.min(currentPage, totalPhasePages))
  }, [totalPhasePages])

  return (
    <TeamRequiredGuard
      pageName="Submissions"
      pageDescription="Submit and track your project deliverables."
      icon={<FileUp className="h-10 w-10 text-primary" />}
    >
      <div className="space-y-6 p-4 sm:p-6">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-primary/[0.10] via-background to-background shadow-sm"
        >
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.16),_transparent_68%)] lg:block" />
          <div className="relative grid gap-8 p-6 sm:p-8 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Structured around SDLC milestones
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Submissions</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Track deliverables phase by phase, keep supervisors in the loop, and use a cleaner review flow that only allows one active submission path per phase at a time.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {canCreateSubmission ? (
                  <NewSubmissionDialog
                    onCreated={handleCreated}
                    deliverableOptions={deliverableOptions}
                  />
                ) : null}
                <Button
                  variant="outline"
                  className="rounded-xl bg-transparent"
                  onClick={() => void loadSubmissions()}
                >
                  Refresh List
                </Button>
              </div>

              <div className="mt-6 rounded-2xl border border-border/60 bg-background/80 p-4 text-sm leading-6 text-muted-foreground">
                <p className="font-medium text-foreground">Workflow rule now applied</p>
                <p className="mt-1">
                  A phase cannot receive another new submission while its latest upload is waiting for review. If the reviewer requests changes, only the same deliverable can be re-submitted until it gets approved.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {[
                {
                  label: "Required First",
                  value: "SRS",
                  helper: "Requirements start with the SRS document.",
                },
                {
                  label: "Review Queue",
                  value: String(pendingReviews.length),
                  helper: "Items waiting for a supervisor response.",
                },
                {
                  label: "Current View",
                  value:
                    (isSupervisor || isAdmin) && selectedTeamId
                      ? uniqueTeams.find((team) => team.id === selectedTeamId)?.name ?? "Selected team"
                      : "My team",
                  helper: "Stats and cards below follow this current scope.",
                },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border/60 bg-background/80 p-4 backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-3 text-2xl font-bold text-foreground">{item.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.helper}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total Submissions",
              value: totalCount,
              icon: Upload,
              accent: "border-l-primary",
              iconColor: "text-primary",
            },
            {
              label: "Approved",
              value: approvedCount,
              icon: CheckCircle2,
              accent: "border-l-emerald-500",
              iconColor: "text-emerald-500",
            },
            {
              label: "Average Grade",
              value: gradedCount > 0 ? `${avgGrade}%` : "-",
              icon: Star,
              accent: "border-l-yellow-500",
              iconColor: "text-yellow-500",
            },
            {
              label: "Late Submissions",
              value: lateCount,
              icon: AlertTriangle,
              accent: "border-l-red-500",
              iconColor: "text-red-500",
            },
          ].map((item) => {
            const Icon = item.icon
            return (
              <Card
                key={item.label}
                className={cn("gap-3 border-border/60 border-l-4 bg-background/90 p-5 shadow-sm", item.accent)}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("h-4 w-4", item.iconColor)} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <p className="text-3xl font-bold">{item.value}</p>
              </Card>
            )
          })}
        </div>

        {error ? (
          <Card className="border-destructive/25 bg-destructive/[0.08] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <XCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="ghost" size="sm" onClick={() => void loadSubmissions()} className="ml-auto rounded-xl">
                Retry
              </Button>
            </div>
          </Card>
        ) : null}

        {(isSupervisor || isAdmin) && uniqueTeams.length > 0 ? (
          <Card className="border-border/60 bg-background/90 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Supervisor Team View</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Switch between teams to review their deliverables and phase progress.
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-2">
                <span className="px-2 text-sm font-medium text-muted-foreground">View Team</span>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger className="w-[240px] rounded-xl bg-background">
                    <SelectValue placeholder="Select team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        ) : null}

        {(isSupervisor || isAdmin) && pendingReviews.length > 0 ? (
          <Card className="border-border/60 bg-background/90 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Pending Reviews
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The current selected scope still has submissions waiting for review.
                </p>
              </div>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {pendingReviews.length}
              </Badge>
            </div>

            <div className="mt-5 space-y-3">
              {pendingReviews.map((submission) => {
                const meta = DELIVERABLE_META[submission.deliverableType]

                return (
                  <div
                    key={submission.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/80 p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {submission.team?.name} - {meta.label}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        v{submission.version} • Submitted {formatDateLabel(submission.submittedAt)}
                        {submission.late ? " • Late" : ""}
                      </p>
                    </div>

                    <SubmissionDetailDialog
                      submissions={displaySubmissions
                        .filter(
                          (item) =>
                            item.deliverableType === submission.deliverableType &&
                            item.teamId === submission.teamId,
                        )
                        .sort((left, right) => right.version - left.version)}
                      initialVersionId={submission.id}
                      canGrade={true}
                      canDelete={canDeleteSubmission}
                      onGraded={handleUpdated}
                      onDeleted={handleDeleted}
                    />
                  </div>
                )
              })}
            </div>
          </Card>
        ) : null}

        <div className="flex flex-col gap-4 border-t border-border/60 pt-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Team SDLC Progress</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Each phase now has a guide popup, cleaner status messaging, and lighter pagination.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Showing phases {(phasePage - 1) * PHASES_PER_PAGE + 1}-
            {Math.min(phasePage * PHASES_PER_PAGE, PHASE_SEQUENCE.length)} of {PHASE_SEQUENCE.length}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, index) => (
              <div key={index} className="h-56 animate-pulse rounded-[28px] bg-muted" />
            ))}
          </div>
        ) : (
          <div id="phase-list" className="space-y-6">
            {visiblePhases.map((phase, phaseIndex) => {
              const phaseDeliverables = getDeliverablesForPhase(phase)
              const phaseGateState = getPhaseGateState(displaySubmissions, phase)
              const approvedCountForPhase = phaseDeliverables.filter(
                (deliverableType) => byDeliverable[deliverableType]?.[0]?.status === "APPROVED",
              ).length
              const phaseProgress = Math.round((approvedCountForPhase / phaseDeliverables.length) * 100)

              return (
                <motion.div
                  key={phase}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: phaseIndex * 0.06 }}
                >
                  <Card className="border-border/60 bg-background/92 p-6 shadow-sm">
                    <div className="flex flex-col gap-5 border-b border-border/60 pb-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={cn("rounded-full px-3 py-1", PHASE_META[phase].badgeClassName)}>
                            {PHASE_META[phase].label}
                          </Badge>
                          <Badge variant="secondary" className="rounded-full px-3 py-1">
                            {approvedCountForPhase}/{phaseDeliverables.length} approved
                          </Badge>
                        </div>
                        <h3 className="mt-3 text-xl font-semibold">{PHASE_META[phase].label} Phase</h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                          {PHASE_META[phase].summary}
                        </p>
                        <div className="mt-4">
                          <Progress value={phaseProgress} className="h-2.5" />
                          <p className="mt-2 text-xs text-muted-foreground">
                            {phaseProgress}% of this phase deliverables are currently approved.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <PhaseGuideDialog phase={phase} />
                      </div>
                    </div>

                    <div className={cn("mt-5 rounded-[24px] border p-4", getAlertClassName(phaseGateState.tone))}>
                      <div className="flex items-start gap-3">
                        {phaseGateState.tone === "success" ? (
                          <ShieldCheck className="mt-0.5 h-4 w-4" />
                        ) : phaseGateState.tone === "locked" ? (
                          <Lock className="mt-0.5 h-4 w-4" />
                        ) : phaseGateState.tone === "warning" ? (
                          <AlertTriangle className="mt-0.5 h-4 w-4" />
                        ) : (
                          <Info className="mt-0.5 h-4 w-4" />
                        )}
                        <div>
                          <p className="font-medium">{phaseGateState.title}</p>
                          <p className="mt-1 text-sm leading-6">{phaseGateState.description}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 space-y-4">
                      {phaseDeliverables.map((deliverableType) => (
                        <DeliverableRow
                          key={deliverableType}
                          deliverableType={deliverableType}
                          submissions={byDeliverable[deliverableType]}
                          availability={deliverableOptions.find(
                            (option) => option.deliverableType === deliverableType,
                          )!}
                          canGrade={canGradeSubmission}
                          canDelete={canDeleteSubmission}
                          onUpdated={handleUpdated}
                          onDeleted={handleDeleted}
                        />
                      ))}
                    </div>
                  </Card>
                </motion.div>
              )
            })}

            {totalPhasePages > 1 ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page <span className="font-semibold text-foreground">{phasePage}</span> of{" "}
                  <span className="font-semibold text-foreground">{totalPhasePages}</span>
                </p>

                <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#phase-list"
                        className={cn(phasePage === 1 && "pointer-events-none opacity-50")}
                        onClick={(event) => {
                          event.preventDefault()
                          if (phasePage > 1) {
                            setPhasePage((currentPage) => currentPage - 1)
                          }
                        }}
                      />
                    </PaginationItem>

                    {phasePaginationItems.map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#phase-list"
                          isActive={phasePage === page}
                          onClick={(event) => {
                            event.preventDefault()
                            setPhasePage(page)
                          }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext
                        href="#phase-list"
                        className={cn(phasePage === totalPhasePages && "pointer-events-none opacity-50")}
                        onClick={(event) => {
                          event.preventDefault()
                          if (phasePage < totalPhasePages) {
                            setPhasePage((currentPage) => currentPage + 1)
                          }
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            ) : null}
          </div>
        )}

        {!loading && totalCount === 0 ? (
          <Card className="border-dashed border-border/60 bg-background/90 p-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileCheck2 className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-xl font-semibold">No submissions yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Start with the required deliverable for the current phase and the page will organize the rest of the review flow automatically.
            </p>
            {canCreateSubmission ? (
              <div className="mt-5 flex justify-center">
                <NewSubmissionDialog onCreated={handleCreated} deliverableOptions={deliverableOptions} />
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </TeamRequiredGuard>
  )
}
