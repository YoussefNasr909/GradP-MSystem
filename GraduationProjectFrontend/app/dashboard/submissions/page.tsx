"use client"

import { useCallback, useEffect, useRef, useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Upload,
  CheckCircle2,
  Clock,
  Star,
  FileUp,
  AlertTriangle,
  XCircle,
  Download,
  Trash2,
  Eye,
  RotateCcw,
  FileText,
  MessageSquare,
  Award,
  Unlock,
  Calendar,
  Send,
  BookOpen,
  ExternalLink,
  LockKeyhole,
  Info,
  ChevronDown,
} from "lucide-react"
import Link from "next/link"
import { useAuthStore } from "@/lib/stores/auth-store"
import { motion } from "framer-motion"
import { TeamRequiredGuard } from "@/components/team-required-guard"
import { RubricEditor, getDefaultRubric } from "@/components/dashboard/rubric-editor"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import {
  submissionsApi,
  type ApiSubmission,
  type ApiDeliverableType,
  type ApiSubmissionStatus,
  type RubricItem,
} from "@/lib/api/submissions"
import { proposalsApi, type ApiProposal } from "@/lib/api/proposals"
import {
  submissionCommentsApi,
  rubricTemplatesApi,
  type SubmissionComment,
} from "@/lib/api/supervisor-tools"
import { DefenseScheduler } from "@/components/dashboard/defense-scheduler"
import { teamsApi } from "@/lib/api/teams"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { ApiTeamStage } from "@/lib/api/types"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const DELIVERABLE_META: Record<
  ApiDeliverableType,
  { label: string; phase: ApiTeamStage; description: string; required: boolean; fileHint: string }
> = {
  SRS: {
    label: "SRS Document",
    phase: "REQUIREMENTS",
    description: "Software Requirements Specification with functional and non-functional requirements",
    required: true,
    fileHint: "PDF or DOCX document",
  },
  UML: {
    label: "UML Diagrams",
    phase: "DESIGN",
    description: "Class, sequence, and activity diagrams covering the system design",
    required: true,
    fileHint: "PDF, image set, or design document",
  },
  PROTOTYPE: {
    label: "Prototype",
    phase: "IMPLEMENTATION",
    description: "Working prototype demonstrating core system functionality",
    required: false,
    fileHint: "Demo link document, build archive, screenshots, or recorded demo",
  },
  CODE: {
    label: "Source Code",
    phase: "IMPLEMENTATION",
    description: "Complete source code repository or archive",
    required: true,
    fileHint: "Repository link document, ZIP archive, or GitHub release",
  },
  TEST_PLAN: {
    label: "Test Plan",
    phase: "TESTING",
    description: "Test plan, test cases, and QA results",
    required: true,
    fileHint: "PDF, DOCX, XLSX, or testing evidence archive",
  },
  FINAL_REPORT: {
    label: "Final Report",
    phase: "DEPLOYMENT",
    description: "Comprehensive final project report",
    required: true,
    fileHint: "PDF or DOCX report",
  },
  PRESENTATION: {
    label: "Presentation",
    phase: "DEPLOYMENT",
    description: "Final project presentation slides",
    required: true,
    fileHint: "PPTX or PDF slides",
  },
}

const PHASE_META: Record<ApiTeamStage, { label: string; color: string }> = {
  REQUIREMENTS: { label: "Requirements", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  DESIGN: { label: "Design", color: "bg-purple-500/10 text-purple-600 border-purple-200" },
  IMPLEMENTATION: { label: "Implementation", color: "bg-orange-500/10 text-orange-600 border-orange-200" },
  TESTING: { label: "Testing", color: "bg-yellow-500/10 text-yellow-600 border-yellow-200" },
  DEPLOYMENT: { label: "Deployment", color: "bg-green-500/10 text-green-600 border-green-200" },
  MAINTENANCE: { label: "Maintenance", color: "bg-slate-500/10 text-slate-600 border-slate-200" },
}

const PHASE_HEADER_META: Record<ApiTeamStage, { title: string; subtitle: string }> = {
  REQUIREMENTS: {
    title: "Requirements Analysis",
    subtitle: "Define scope, users, requirements, and acceptance expectations.",
  },
  DESIGN: {
    title: "System Design",
    subtitle: "Turn approved requirements into diagrams, architecture, and data design.",
  },
  IMPLEMENTATION: {
    title: "Implementation & Development",
    subtitle: "Submit working code, prototypes, releases, and supporting build evidence.",
  },
  TESTING: {
    title: "Testing & Quality Assurance",
    subtitle: "Document test cases, QA evidence, defects, and verification results.",
  },
  DEPLOYMENT: {
    title: "Deployment & Final Review",
    subtitle: "Package the final report, presentation, demo, and release evidence.",
  },
  MAINTENANCE: {
    title: "Maintenance & Revisions",
    subtitle: "Track post-review fixes, updates, and requested changes.",
  },
}

const PHASE_ORDER: ApiTeamStage[] = ["REQUIREMENTS", "DESIGN", "IMPLEMENTATION", "TESTING", "DEPLOYMENT"]

type OptionalEvidence = {
  id: string
  label: string
  description: string
  fileHint: string
}

const PHASE_GUIDE: Record<
  ApiTeamStage,
  {
    meaning: string
    howToUnderstand: string
    optionalEvidence: OptionalEvidence[]
    reference: { label: string; href: string }
  }
> = {
  REQUIREMENTS: {
    meaning:
      "Define what problem the project solves, who will use it, and what the system must and must not do.",
    howToUnderstand:
      "Think of this phase as the contract for the project. If a feature is important, it should be written clearly enough that the team and supervisor can agree whether it was completed.",
    optionalEvidence: [
      {
        id: "user-interviews",
        label: "User interview notes",
        description: "Notes or summaries from conversations with expected users or stakeholders.",
        fileHint: "PDF, DOCX, TXT, or ZIP",
      },
      {
        id: "survey-results",
        label: "Survey results",
        description: "Survey questions, response summary, and insights used to shape requirements.",
        fileHint: "PDF, DOCX, XLSX, or CSV",
      },
      {
        id: "competitor-analysis",
        label: "Competitor or similar-system analysis",
        description: "Short comparison of existing systems and what your project will improve.",
        fileHint: "PDF or DOCX",
      },
      {
        id: "screen-sketches",
        label: "Early screen sketches",
        description: "Low-fidelity sketches that clarify the expected user flows.",
        fileHint: "PDF, PNG, JPG, or ZIP",
      },
    ],
    reference: {
      label: "IBM: SDLC overview",
      href: "https://www.ibm.com/think/topics/sdlc",
    },
  },
  DESIGN: {
    meaning:
      "Transform the approved requirements into a technical plan for screens, data, modules, and interactions.",
    howToUnderstand:
      "This is where the team explains how the solution will be built before committing to code. Diagrams should connect back to the SRS and use consistent names.",
    optionalEvidence: [
      {
        id: "wireframes",
        label: "Wireframes",
        description: "Screen layouts showing the main pages and interactions before implementation.",
        fileHint: "PDF, PNG, JPG, Figma export, or ZIP",
      },
      {
        id: "database-schema-notes",
        label: "Database schema notes",
        description: "Tables, fields, relationships, and important data constraints.",
        fileHint: "PDF, DOCX, SQL, or diagram image",
      },
      {
        id: "architecture-decisions",
        label: "Architecture decision notes",
        description: "Brief notes explaining major technology, architecture, or integration choices.",
        fileHint: "PDF, DOCX, or TXT",
      },
      {
        id: "api-contract",
        label: "API contract draft",
        description: "Endpoint list, request and response examples, or service interface notes.",
        fileHint: "PDF, DOCX, JSON, TXT, or ZIP",
      },
    ],
    reference: {
      label: "Visual Paradigm: UML guide",
      href: "https://www.visual-paradigm.com/guide/uml-unified-modeling-language/uml-practical-guide/",
    },
  },
  IMPLEMENTATION: {
    meaning:
      "Build the working system according to the approved requirements and design.",
    howToUnderstand:
      "This phase should prove that the core flows actually run. The supervisor should be able to inspect the source code and try the main prototype behavior.",
    optionalEvidence: [
      {
        id: "setup-video",
        label: "Setup video",
        description: "Short walkthrough showing how to run or use the prototype.",
        fileHint: "MP4 link document, PDF, or TXT",
      },
      {
        id: "readme",
        label: "README file",
        description: "Installation, environment variables, seed data, and run commands.",
        fileHint: "MD, TXT, PDF, or repository archive",
      },
      {
        id: "release-notes",
        label: "Release notes",
        description: "Implemented features, known gaps, and changes since the previous submission.",
        fileHint: "PDF, DOCX, MD, or TXT",
      },
      {
        id: "feature-screenshots",
        label: "Feature screenshots",
        description: "Screenshots proving the main implemented user flows.",
        fileHint: "PDF, PNG, JPG, or ZIP",
      },
    ],
    reference: {
      label: "Atlassian: SDLC guide",
      href: "https://www.atlassian.com/en/agile/software-development/sdlc",
    },
  },
  TESTING: {
    meaning:
      "Check that the system works as expected and document defects, fixes, and evidence.",
    howToUnderstand:
      "Every important requirement should have a matching test case. Failed tests are useful when they explain the issue and whether it was fixed.",
    optionalEvidence: [
      {
        id: "automated-test-report",
        label: "Automated test report",
        description: "Output from automated unit, integration, or end-to-end tests.",
        fileHint: "PDF, HTML, TXT, JSON, or ZIP",
      },
      {
        id: "bug-list",
        label: "Bug list",
        description: "Defects found, severity, owner, and fix status.",
        fileHint: "PDF, DOCX, XLSX, or CSV",
      },
      {
        id: "uat-notes",
        label: "User acceptance testing notes",
        description: "Feedback and sign-off notes from sample users or stakeholders.",
        fileHint: "PDF or DOCX",
      },
      {
        id: "performance-security-checks",
        label: "Performance or security check notes",
        description: "Evidence of basic load, performance, vulnerability, or access checks.",
        fileHint: "PDF, DOCX, TXT, or ZIP",
      },
    ],
    reference: {
      label: "Atlassian: test plan guide",
      href: "https://www.atlassian.com/software/confluence/resources/guides/how-to/test-plan",
    },
  },
  DEPLOYMENT: {
    meaning:
      "Package the final version, report, and presentation so the project can be evaluated and demonstrated.",
    howToUnderstand:
      "This is the final review package. The report, slides, demo, and source code should tell the same story and reflect the latest approved version.",
    optionalEvidence: [
      {
        id: "demo-video",
        label: "Demo video",
        description: "Final recorded walkthrough of the deployed or runnable project.",
        fileHint: "MP4 link document, PDF, or TXT",
      },
      {
        id: "deployment-link",
        label: "Deployment link",
        description: "Hosted URL, credentials if needed, and basic access instructions.",
        fileHint: "PDF, DOCX, or TXT",
      },
      {
        id: "installation-guide",
        label: "Installation guide",
        description: "Clean-machine setup steps for reviewers who run the project locally.",
        fileHint: "PDF, DOCX, MD, or TXT",
      },
      {
        id: "known-issues-future-work",
        label: "Known issues and future work notes",
        description: "Honest list of limitations, unresolved issues, and possible improvements.",
        fileHint: "PDF or DOCX",
      },
    ],
    reference: {
      label: "Atlassian: software deployment",
      href: "https://www.atlassian.com/agile/software-development/software-deployment",
    },
  },
  MAINTENANCE: {
    meaning:
      "Handle fixes, improvements, and documentation updates after review or release.",
    howToUnderstand:
      "Maintenance is usually driven by supervisor feedback or discovered bugs. Submit revision evidence only when requested.",
    optionalEvidence: [
      {
        id: "bug-fix-notes",
        label: "Bug-fix notes",
        description: "Defects fixed after review and how each fix was verified.",
        fileHint: "PDF, DOCX, or TXT",
      },
      {
        id: "updated-source-archive",
        label: "Updated source archive",
        description: "Updated code package or release after requested fixes.",
        fileHint: "ZIP or repository link document",
      },
      {
        id: "revision-report",
        label: "Revision report",
        description: "Summary of supervisor feedback and the changes made in response.",
        fileHint: "PDF or DOCX",
      },
      {
        id: "change-log",
        label: "Change log",
        description: "Versioned list of updates after deployment or final review.",
        fileHint: "PDF, DOCX, MD, or TXT",
      },
    ],
    reference: {
      label: "NIST: SDLC reference",
      href: "https://www.nist.gov/publications/system-development-life-cycle-sdlc",
    },
  },
}

const STATUS_META: Record<ApiSubmissionStatus, { label: string; icon: React.ComponentType<{ className?: string }>; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pending Review", icon: Clock, variant: "secondary" },
  UNDER_REVIEW: { label: "Under Review", icon: Eye, variant: "secondary" },
  REVISION_REQUIRED: { label: "Needs Revision", icon: RotateCcw, variant: "destructive" },
  APPROVED: { label: "Approved", icon: CheckCircle2, variant: "default" },
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function commentInitials(n: string) {
  return n.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2)
}

// ─── Submission Comments Thread ──────────────────────────────────────────────
function SubmissionCommentsThread({ submissionId }: { submissionId: string }) {
  const { currentUser } = useAuthStore()
  const [comments, setComments] = useState<SubmissionComment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [input,    setInput]    = useState("")
  const [posting,  setPosting]  = useState(false)

  useEffect(() => {
    let cancelled = false
    submissionCommentsApi.list(submissionId)
      .then((c) => { if (!cancelled) setComments(c) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [submissionId])

  async function handlePost() {
    if (input.trim().length === 0) return
    setPosting(true)
    try {
      const c = await submissionCommentsApi.create(submissionId, input.trim())
      setComments((prev) => [...prev, c])
      setInput("")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to post comment")
    } finally {
      setPosting(false)
    }
  }

  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function performDelete(id: string) {
    try {
      await submissionCommentsApi.delete(id)
      setComments((prev) => prev.filter((c) => c.id !== id))
      toast.success("Comment deleted")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete")
      throw e
    }
  }

  return (
    <div className="rounded-xl border border-border/40 p-4">
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => { if (!o) setDeleteId(null) }}
        title="Delete this comment?"
        description="The comment will be removed from this discussion. Other participants will no longer see it."
        onConfirm={async () => { if (deleteId) await performDelete(deleteId) }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5" /> Discussion
        {comments.length > 0 && <Badge variant="secondary" className="text-[10px]">{comments.length}</Badge>}
      </p>

      {loading ? (
        <div className="space-y-2">
          <div className="h-12 bg-muted/40 rounded animate-pulse" />
          <div className="h-12 bg-muted/40 rounded animate-pulse" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground italic mb-3">No comments yet. Start the conversation.</p>
      ) : (
        <div className="space-y-2 mb-3 max-h-72 overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={c.author?.avatarUrl ?? undefined} />
                <AvatarFallback className="text-[9px]">{commentInitials(c.author?.fullName ?? "?")}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-semibold">{c.author?.fullName ?? "Unknown"}</span>
                  <Badge variant="outline" className="text-[9px] capitalize">{c.authorRole.toLowerCase()}</Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
                  {c.authorUserId === currentUser?.id && (
                    <button
                      onClick={() => setDeleteId(c.id)}
                      className="ml-auto text-[10px] text-muted-foreground hover:text-destructive"
                    >
                      delete
                    </button>
                  )}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Write a comment..."
          className="resize-none text-sm"
          rows={2}
          maxLength={2000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void handlePost()
            }
          }}
        />
        <Button size="sm" onClick={handlePost} disabled={posting || input.trim().length === 0}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">⌘/Ctrl + Enter to post</p>
    </div>
  )
}

function isOptionalEvidenceSubmission(submission?: Pick<ApiSubmission, "title"> | null) {
  return submission?.title?.trim().toLowerCase().startsWith("optional:") ?? false
}

function cloneRubric(rubric?: RubricItem[] | null): RubricItem[] {
  return rubric ? rubric.map((item) => ({ ...item })) : []
}

function getTaRubricForSubmission(submission: ApiSubmission) {
  const taHistoryRubric = submission.gradeHistory
    ?.slice()
    .reverse()
    .find((entry) => entry.event === "ta_reviewed" && entry.rubric && entry.rubric.length > 0)
    ?.rubric

  if (taHistoryRubric?.length) return cloneRubric(taHistoryRubric)
  if (submission.taReviewedAt && submission.rubric?.length) return cloneRubric(submission.rubric)
  return []
}

function getRubricScaledTotal(rubric: RubricItem[]) {
  const total = rubric.reduce((sum, item) => sum + (Number(item.score) || 0), 0)
  const possible = rubric.reduce((sum, item) => sum + (Number(item.maxScore) || 0), 0)
  return possible > 0 ? Math.round((total / possible) * 100) : null
}

function getRubricValidationError(rubric: RubricItem[]) {
  const missingNameIndex = rubric.findIndex((item) => !item.name?.trim())
  if (missingNameIndex !== -1) {
    return `Criterion ${missingNameIndex + 1} needs a name.`
  }
  return null
}

// ─── Submission Detail Dialog ────────────────────────────────────────────────
function SubmissionDetailDialog({
  submissions,
  initialVersionId,
  canGrade,
  canSubmit,
  userRole,
  onGraded,
  onDeleted,
  customTrigger,
}: {
  submissions: ApiSubmission[]
  initialVersionId?: string
  canGrade: boolean
  canSubmit?: boolean
  /** Uppercase role string. Drives whether TA-review or Doctor-grade flow is offered. */
  userRole?: string
  onGraded: (updated: ApiSubmission) => void
  onDeleted?: (id: string) => void
  customTrigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(initialVersionId || null)

  useEffect(() => {
    if (open) {
      setSelectedVersionId(initialVersionId || submissions[0]?.id || null)
    }
  }, [open, initialVersionId, submissions])

  const isTa     = userRole === "TA"
  const isDoctor = userRole === "DOCTOR" || userRole === "ADMIN"

  /**
   * Resolve which rubric to preload for grading:
   *   1. If the submission already has a saved rubric, use it (re-grade path).
   *   2. Else, check for a team-specific custom rubric template.
   *   3. Else, fall back to the global default template for this deliverable type.
   */
  async function resolveInitialRubric(sub: ApiSubmission): Promise<RubricItem[]> {
    if (sub.rubric && sub.rubric.length > 0) return sub.rubric
    try {
      const templates = await rubricTemplatesApi.list(sub.teamId)
      const match = templates.find((t) => t.deliverableType === sub.deliverableType)
      if (match && match.rubric.length > 0) {
        // Custom template — initialise with zero scores (criteria structure only)
        return match.rubric.map((c) => ({ name: c.name, score: 0, maxScore: c.maxScore }))
      }
    } catch { /* fall through to default */ }
    return getDefaultRubric(sub.deliverableType)
  }

  const [gradeDialogOpen,    setGradeDialogOpen]    = useState(false)
  const [taReviewDialogOpen, setTaReviewDialogOpen] = useState(false)
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false)
  const [defenseOpen, setDefenseOpen] = useState(false)
  const [defenseParticipantIds, setDefenseParticipantIds] = useState<string[]>([])
  const [grade, setGrade] = useState("")
  const [recommendedGrade, setRecommendedGrade] = useState("")
  const [gradeFeedback, setGradeFeedback] = useState("")
  const [taFeedback, setTaFeedback] = useState("")
  const [revisionFeedback, setRevisionFeedback] = useState("")
  const [doctorRubric, setDoctorRubric] = useState<RubricItem[]>([])
  const [taRubric,     setTaRubric]     = useState<RubricItem[]>([])
  const [doctorRubricScore, setDoctorRubricScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const doctorRubricScoreRef = useRef<number | null>(null)
  const taRubricScoreRef = useRef<number | null>(null)

  // Unlock dialog state
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [unlockReason, setUnlockReason] = useState("")
  const [historyOpen, setHistoryOpen] = useState(false)

  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDoctorRubricChange = useCallback((next: RubricItem[]) => {
    setDoctorRubric(next)
  }, [])

  const handleDoctorRubricTotalChange = useCallback((total: number) => {
    doctorRubricScoreRef.current = total
    setDoctorRubricScore(total)
    setGrade(String(total))
  }, [])

  const handleTaRubricChange = useCallback((next: RubricItem[]) => {
    setTaRubric(next)
  }, [])

  const handleTaRubricTotalChange = useCallback((total: number) => {
    taRubricScoreRef.current = total
    setRecommendedGrade(String(total))
  }, [])

  const submission = submissions.find(s => s.id === selectedVersionId) || submissions[0]

  if (!submission) return null

  const meta = DELIVERABLE_META[submission.deliverableType]
  const statusInfo = STATUS_META[submission.status]
  const StatusIcon = statusInfo.icon

  const isLatest = submission.id === submissions[0]?.id
  const hasMultipleVersions = submissions.length > 1;
  const shouldSubmitDoctorRubric = doctorRubric.length > 0
  const shouldSubmitTaRubric = taRubric.length > 0
  const deploymentDefenseBlocked =
    submission.sdlcPhase === "DEPLOYMENT" &&
    (!submission.defenseMeeting || submission.defenseMeeting.status !== "COMPLETED")

  function openDoctorGradeDialog() {
    doctorRubricScoreRef.current = null
    setDoctorRubricScore(null)
    setGrade(
      submission.taRecommendedGrade !== null && submission.taRecommendedGrade !== undefined
        ? String(submission.taRecommendedGrade)
        : submission.grade !== null && submission.grade !== undefined
          ? String(submission.grade)
          : "",
    )
    setGradeFeedback(submission.taFeedback || submission.feedback || "")
    setGradeDialogOpen(true)
  }

  function openTaReviewDialog() {
    taRubricScoreRef.current = null
    setRecommendedGrade(
      submission.taRecommendedGrade !== null && submission.taRecommendedGrade !== undefined
        ? String(submission.taRecommendedGrade)
        : "",
    )
    setTaFeedback(submission.taFeedback || "")
    setTaReviewDialogOpen(true)
  }

  async function handleDeleteSingle() {
    setIsDeleting(true)
    try {
      await submissionsApi.delete(submission.id)
      if (onDeleted) onDeleted(submission.id)
      setDeleteAlertOpen(false)
      toast.success("Version deleted successfully")
      if (submissions.length <= 1) {
        setOpen(false)
      } else {
        const remaining = submissions.filter(s => s.id !== submission.id)
        setSelectedVersionId(remaining[0]?.id || null)
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to delete submission")
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleGrade() {
    const rubricGrade = getRubricScaledTotal(doctorRubric)
    const g = rubricGrade ?? doctorRubricScore ?? parseInt(grade)
    if (isNaN(g) || g < 0 || g > 100) {
      toast.error("Grade must be between 0 and 100")
      return
    }
    const feedback = gradeFeedback.trim()
    if (feedback.length > 0 && feedback.length < 3) {
      toast.error("Final feedback must be at least 3 characters, or leave it empty.")
      return
    }
    if (deploymentDefenseBlocked) {
      toast.error("Complete and link the defense meeting before finalizing deployment deliverables.")
      return
    }
    const rubricForPayload = shouldSubmitDoctorRubric ? doctorRubric : undefined
    if (rubricForPayload) {
      const rubricError = getRubricValidationError(rubricForPayload)
      if (rubricError) {
        toast.error(rubricError)
        return
      }
    }
    setLoading(true)
    try {
      const updated = await submissionsApi.grade(submission.id, {
        grade: g,
        feedback: feedback || undefined,
        rubric: rubricForPayload,
      })
      onGraded(updated)
      setGradeDialogOpen(false)
      setOpen(false)
      toast.success("Final grade saved")
    } catch (e: any) {
      toast.error(e.message || "Failed to grade submission")
    } finally {
      setLoading(false)
    }
  }

  async function handleTaReview() {
    const rubricGrade = getRubricScaledTotal(taRubric)
    const g = rubricGrade ?? taRubricScoreRef.current ?? parseInt(recommendedGrade)
    if (isNaN(g) || g < 0 || g > 100) {
      toast.error("Recommended grade must be between 0 and 100")
      return
    }
    const feedback = taFeedback.trim()
    if (feedback.length > 0 && feedback.length < 3) {
      toast.error("TA feedback must be at least 3 characters, or leave it empty.")
      return
    }
    if (shouldSubmitTaRubric) {
      const rubricError = getRubricValidationError(taRubric)
      if (rubricError) {
        toast.error(rubricError)
        return
      }
    }
    setLoading(true)
    try {
      const updated = await submissionsApi.taReview(submission.id, {
        recommendedGrade: g,
        feedback: feedback || undefined,
        rubric: shouldSubmitTaRubric ? taRubric : undefined,
      })
      onGraded(updated)
      setTaReviewDialogOpen(false)
      setOpen(false)
      toast.success("First-pass review sent to doctor")
    } catch (e: any) {
      toast.error(e.message || "Failed to submit review")
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
    } catch (e: any) {
      toast.error(e.message || "Failed to request revision")
    } finally {
      setLoading(false)
    }
  }

  async function initializeDoctorGradeDialog() {
    const taRubric = getTaRubricForSubmission(submission)
    const existingDoctorRubric = submission.grade !== null ? cloneRubric(submission.rubric) : []
    const initialRubric =
      taRubric.length > 0
        ? taRubric
        : existingDoctorRubric.length > 0
          ? existingDoctorRubric
          : await resolveInitialRubric(submission)
    const initialRubricScore = getRubricScaledTotal(initialRubric)

    setDoctorRubric(initialRubric)
    setDoctorRubricScore(initialRubricScore)
    setGrade(
      String(
        submission.grade ??
          submission.taRecommendedGrade ??
          initialRubricScore ??
          "",
      ),
    )
    setGradeFeedback(submission.feedback || submission.taFeedback || "")
  }

  async function prepareDoctorGradeDialog() {
    await initializeDoctorGradeDialog()
    setOpen(false)
    setGradeDialogOpen(true)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {customTrigger ? customTrigger : (
            <Button variant="outline" size="sm">
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              View Details
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className={hasMultipleVersions ? "sm:max-w-[1000px] w-[95vw] sm:w-[90vw] p-0 gap-0 overflow-hidden" : "sm:max-w-[700px] w-[95vw] sm:w-[90vw] p-0 gap-0 overflow-hidden"}>
          <div className="flex h-full max-h-[85vh] bg-background">
            {/* Version Sidebar */}
            {hasMultipleVersions && (
              <div className="w-[240px] md:w-[300px] shrink-0 border-r bg-muted/10 flex flex-col hidden md:flex">
                <div className="p-5 border-b bg-muted/30 font-semibold text-sm flex items-center justify-between">
                  <span>Version History</span>
                  <Badge variant="outline" className="text-[10px] font-medium">{submissions.length} versions</Badge>
                </div>
                <div className="overflow-y-auto p-4 space-y-3 flex-1">
                  {submissions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedVersionId(s.id)}
                      className={`p-4 rounded-xl border text-sm cursor-pointer transition-all ${
                        selectedVersionId === s.id
                          ? "bg-primary/5 border-primary/50 shadow-sm ring-1 ring-primary/20"
                          : "bg-background hover:bg-muted/50 border-border hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`font-semibold text-base ${selectedVersionId === s.id ? "text-primary" : ""}`}>v{s.version}</span>
                        <Badge variant={STATUS_META[s.status].variant} className="text-[10px] px-1.5 py-0 font-medium">
                          {STATUS_META[s.status].label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 opacity-70" />
                          {new Date(s.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main Content */}
             <div className="flex-1 flex flex-col overflow-y-auto min-w-0 p-6 md:p-8">
              <DialogHeader className="pb-6 border-b flex flex-row flex-wrap items-start justify-between gap-4 mb-4">
                <div className="space-y-2">
                  <Badge variant="secondary" className="font-medium bg-secondary/50 text-secondary-foreground mb-1">Version {submission.version}</Badge>
                  <DialogTitle className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{meta.label}</DialogTitle>
                </div>
                
                {canSubmit && submission.status !== "APPROVED" && (
                  <div>
                    <Button
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2"
                      onClick={() => setDeleteAlertOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
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
                            onClick={(e) => { e.preventDefault(); handleDeleteSingle() }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isDeleting}
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </DialogHeader>

              <div className="space-y-8">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={statusInfo.variant} className="gap-1.5 py-1.5 px-3 text-sm font-medium">
                    <StatusIcon className="h-4 w-4" />
                    {statusInfo.label}
                  </Badge>
                  {submission.late && <Badge variant="destructive" className="py-1.5 px-3 text-sm font-medium">Late Submission</Badge>}
                  {submission.grade !== null && (
                    <Badge variant="outline" className="gap-1.5 py-1.5 px-3 text-sm font-medium border-yellow-200 bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-500">
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      Score: {submission.grade}%
                    </Badge>
                  )}
                </div>

                <div className="grid gap-6 sm:grid-cols-2 bg-muted/20 p-5 rounded-2xl border">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Submitted By</p>
                    <p className="text-sm font-medium">{submission.submittedBy?.fullName || "System"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Submitted On</p>
                    <p className="text-sm font-medium">{new Date(submission.submittedAt).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(submission.submittedAt).toLocaleTimeString()}</p>
                  </div>
                  {submission.deadline && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Deadline</p>
                      <p className="text-sm font-medium">{new Date(submission.deadline).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(submission.deadline).toLocaleTimeString()}</p>
                    </div>
                  )}
                  {submission.reviewedBy && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Reviewed By</p>
                      <p className="text-sm font-medium">{submission.reviewedBy.fullName}</p>
                    </div>
                  )}
                </div>

                {submission.title && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Title</h4>
                    <p className="text-sm">{submission.title}</p>
                  </div>
                )}

                {submission.notes && (
                  <div>
                    <h4 className="text-base font-semibold mb-3">Submission Notes</h4>
                    <p className="text-sm text-foreground bg-muted/30 p-4 rounded-xl italic leading-relaxed border">
                      &quot;{submission.notes}&quot;
                    </p>
                  </div>
               )}

                {submission.fileName && (
                  <div>
                    <h4 className="text-base font-semibold mb-3 flex items-center gap-2">
                       <FileUp className="h-4 w-4 text-muted-foreground" /> Deliverable File
                    </h4>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-xl bg-card shadow-sm hover:border-primary/50 transition-all gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-3 bg-primary/10 rounded-lg shrink-0">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{submission.fileName}</p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <span className="uppercase font-medium tracking-wider">{submission.fileType?.split('/')[1] || submission.fileType || "file"}</span>
                            <span>•</span>
                            <span>{formatFileSize(submission.fileSize)}</span>
                          </p>
                        </div>
                      </div>
                      {submission.fileUrl && (
                        <Button size="sm" className="w-full sm:w-auto shrink-0 shadow-sm" variant="secondary" asChild>
                          <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── TA First-Pass Review (recommendation) ── */}
                {submission.taReviewedAt && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900 rounded-xl"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
                        <Star className="h-4 w-4 fill-cyan-500 text-cyan-500" />
                        <h4 className="text-sm font-semibold">TA First-Pass Review</h4>
                      </div>
                      {submission.taRecommendedGrade !== null && (
                        <Badge variant="outline" className="border-cyan-500/40 text-cyan-700 dark:text-cyan-400 font-semibold">
                          Recommended: {submission.taRecommendedGrade}/100
                        </Badge>
                      )}
                    </div>
                    {submission.taFeedback && (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed mb-2">{submission.taFeedback}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Reviewed by {submission.taReviewedBy?.fullName || "TA"} · {new Date(submission.taReviewedAt).toLocaleString()}
                    </p>
                  </motion.div>
                )}

                {/* ── Doctor Final Grade (authoritative) ── */}
                {(submission.feedback || submission.grade !== null) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
                        <Award className="h-4 w-4" />
                        <h4 className="text-sm font-semibold">{submission.grade !== null ? "Doctor Final Grade" : "Doctor Feedback"}</h4>
                      </div>
                      {submission.grade !== null && (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-500 font-semibold">
                          Final: {submission.grade}/100
                        </Badge>
                      )}
                    </div>
                    {submission.feedback && (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed mb-2">{submission.feedback}</p>
                    )}

                    {/* Rubric breakdown (read-only) */}
                    {submission.rubric && submission.rubric.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-900/50 space-y-1.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Rubric Breakdown</p>
                        {submission.rubric.map((r, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground truncate">{r.name}</span>
                            <span className="font-mono tabular-nums font-semibold">
                              {r.score}<span className="text-muted-foreground">/{r.maxScore}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {submission.reviewedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Reviewed by {submission.reviewedBy?.fullName || "Doctor"} · {new Date(submission.reviewedAt).toLocaleString()}
                      </p>
                    )}
                  </motion.div>
                )}

                {/* ── Grade history (audit trail) ── */}
                {submission.gradeHistory && submission.gradeHistory.length > 0 && (
                  <div className="rounded-xl border border-border/40 p-3">
                    <button
                      onClick={() => setHistoryOpen((v) => !v)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                    >
                      <Clock className="h-3 w-3" />
                      {historyOpen ? "Hide" : "Show"} grade history ({submission.gradeHistory.length} entr{submission.gradeHistory.length === 1 ? "y" : "ies"})
                    </button>
                    {historyOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-3 space-y-2"
                      >
                        {submission.gradeHistory.map((h, i) => (
                          <div key={i} className="text-xs p-2 rounded-lg bg-muted/40">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[10px] capitalize">{h.event.replaceAll("_", " ")}</Badge>
                              <span className="text-muted-foreground">{new Date(h.at).toLocaleString()}</span>
                              <span className="text-muted-foreground">· by {h.byName}</span>
                            </div>
                            {h.event === "unlocked" && (
                              <>
                                <p>Reverted from grade <b>{h.snapshotGrade}/100</b></p>
                                {h.reason && <p className="text-muted-foreground italic mt-1">Reason: {h.reason}</p>}
                              </>
                            )}
                            {h.event === "regraded" && (
                              <>
                                <p>Changed from <b>{h.previousGrade}/100</b> → <b>{h.newGrade}/100</b></p>
                                {(h.overrideReason || h.reason) && <p className="text-muted-foreground italic mt-1">Reason: {h.overrideReason || h.reason}</p>}
                              </>
                            )}
                            {h.event === "ta_reviewed" && (
                              <p>TA recommended <b>{h.recommendedGrade}/100</b></p>
                            )}
                            {h.event === "revision_requested" && (
                              <p>Revision requested: <span className="text-muted-foreground">{h.feedback}</span></p>
                            )}
                            {(h.event === "finalized" || h.event === "bulk_finalized") && (
                              <>
                                <p>
                                  Finalized at <b>{h.newGrade}/100</b>
                                  {h.taRecommendedGrade !== null && h.taRecommendedGrade !== undefined
                                    ? ` from TA recommendation ${h.taRecommendedGrade}/100`
                                    : ""}
                                </p>
                                {h.noTaAssigned && <p className="text-muted-foreground italic mt-1">No TA was assigned to this team.</p>}
                                {h.overrideReason && <p className="text-muted-foreground italic mt-1">Override: {h.overrideReason}</p>}
                              </>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                )}

                {/* ── Defense meeting (DEPLOYMENT phase only) ── */}
                {submission.sdlcPhase === "DEPLOYMENT" && (
                  <div className="rounded-xl border border-border/40 p-3 bg-purple-50/30 dark:bg-purple-950/10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> Defense Meeting
                      </p>
                    </div>
                    {submission.defenseMeeting ? (
                      <div className="text-sm space-y-1">
                        <p className="font-semibold">{submission.defenseMeeting.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(submission.defenseMeeting.startAt).toLocaleString()} · {submission.defenseMeeting.mode} · status: <b>{submission.defenseMeeting.status}</b>
                        </p>
                        {submission.defenseMeeting.joinUrl && (
                          <a
                            href={submission.defenseMeeting.joinUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Open meeting link <Eye className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        No defense meeting linked yet.
                        {(isDoctor || userRole === "TA") && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 h-7 text-xs border-purple-500/30 text-purple-700 dark:text-purple-400 hover:bg-purple-500/10"
                            onClick={async () => {
                              // Pre-fetch participant IDs (leader + doctor + ta + members) for conflict check
                              try {
                                const team = await teamsApi.getById(submission.teamId)
                                const ids = [
                                  team.leader?.id,
                                  team.doctor?.id,
                                  team.ta?.id,
                                  ...team.members.map((m) => m.user.id),
                                ].filter((v): v is string => Boolean(v))
                                setDefenseParticipantIds(ids)
                              } catch {
                                // Best-effort — empty array means no conflict check
                                setDefenseParticipantIds([])
                              }
                              setOpen(false)
                              setDefenseOpen(true)
                            }}
                          >
                            <Calendar className="h-3 w-3 mr-1.5" />
                            Schedule defense meeting
                          </Button>
                        )}
                      </div>
                    )}
                    {submission.sdlcPhase === "DEPLOYMENT" && submission.defenseMeeting && submission.defenseMeeting.status !== "COMPLETED" && submission.status !== "APPROVED" && (
                      <p className="text-[10px] text-amber-700 dark:text-amber-500 mt-2">
                        ⚠ Grade can&apos;t be finalized until the defense meeting is marked COMPLETED.
                      </p>
                    )}
                  </div>
                )}

                {/* ── Comments thread ── */}
                <SubmissionCommentsThread submissionId={submission.id} />

                {/* ── Unlock approved grade (doctor only) ── */}
                {canGrade && isDoctor && submission.status === "APPROVED" && isLatest && (
                  <div className="pt-6 border-t mt-8">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full border-amber-500/30 text-amber-700 dark:text-amber-500 hover:bg-amber-500/10"
                      onClick={() => { setOpen(false); setUnlockOpen(true) }}
                    >
                      <Unlock className="h-5 w-5 mr-2" />
                      Unlock to revise grade
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center mt-2">
                      Use this if the grade needs to be revised after the fact. The current grade will be archived.
                    </p>
                  </div>
                )}

                {/* ── Actions (branch by role) ── */}
                {canGrade && submission.status !== "APPROVED" && isLatest && (
                  <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t mt-8">
                    {isTa && (submission.status === "PENDING" || submission.status === "REVISION_REQUIRED") && (
                      <Button
                        size="lg"
                        className="flex-1 shadow-sm font-semibold bg-cyan-600 hover:bg-cyan-700"
                        onClick={openTaReviewDialog}
                      >
                        <Star className="h-5 w-5 mr-2" />
                        {submission.taReviewedAt ? "Update Recommendation" : "Submit First-Pass Review"}
                      </Button>
                    )}
                    {isDoctor && (
                      <Button
                        size="lg"
                        className="flex-1 shadow-sm font-semibold bg-amber-600 hover:bg-amber-700"
                        onClick={() => void prepareDoctorGradeDialog()}
                      >
                        <Award className="h-5 w-5 mr-2" />
                        Finalize Grade
                      </Button>
                    )}
                    <Button
                      size="lg"
                      variant="outline"
                      className="flex-1 font-semibold border-destructive/20 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                      onClick={() => setRevisionDialogOpen(true)}
                    >
                      <RotateCcw className="h-5 w-5 mr-2" />
                      Request Revision
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grade Dialog (DOCTOR only — sets final grade) */}
      <Dialog
        open={gradeDialogOpen}
        onOpenChange={(open) => {
          setGradeDialogOpen(open)
          if (open) {
            void initializeDoctorGradeDialog()
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              Finalize Grade
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {submission.taRecommendedGrade !== null && (
              <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900">
                <p className="text-[11px] uppercase tracking-wider text-cyan-700 dark:text-cyan-400 font-semibold mb-1">
                  TA Recommendation
                </p>
                <p className="text-sm">
                  <span className="font-semibold">{submission.taRecommendedGrade}/100</span>
                  {submission.taReviewedBy && (
                    <span className="text-muted-foreground"> · {submission.taReviewedBy.fullName}</span>
                  )}
                </p>
                {getTaRubricForSubmission(submission).length > 0 && (
                  <p className="mt-1 text-xs text-cyan-800/80 dark:text-cyan-300/80">
                    The editable rubric below starts with the TA&apos;s criteria and point values.
                  </p>
                )}
              </div>
            )}

            {deploymentDefenseBlocked && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Defense meeting required
                </div>
                <p className="mt-1 text-xs opacity-90">
                  Deployment deliverables can only be finalized after a linked defense meeting is marked completed.
                </p>
              </div>
            )}

            {submission.status === "PENDING" && submission.taRecommendedGrade === null && (
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-200">
                If this team has an assigned TA, the TA must submit a first-pass recommendation before the doctor can finalize.
              </div>
            )}

            <RubricEditor
              value={doctorRubric}
              onChange={handleDoctorRubricChange}
              onTotalChange={handleDoctorRubricTotalChange}
              defaultRubricType={submission.deliverableType}
            />

            <div>
              <Label>Final Feedback (optional)</Label>
              <Textarea
                value={gradeFeedback}
                onChange={(e) => setGradeFeedback(e.target.value)}
                placeholder="Final feedback for the team..."
                className="mt-1.5 resize-none"
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGrade} disabled={loading || deploymentDefenseBlocked} className="flex-1 bg-amber-600 hover:bg-amber-700">
                {loading ? "Saving..." : "Finalize Grade"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setGradeDialogOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* TA Review Dialog (TA only — first-pass recommendation) */}
      <Dialog
        open={taReviewDialogOpen}
        onOpenChange={(open) => {
          setTaReviewDialogOpen(open)
          if (open) {
            void resolveInitialRubric(submission).then(setTaRubric)
            taRubricScoreRef.current = null
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-cyan-500 fill-cyan-500" />
              First-Pass Review
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900 text-xs leading-relaxed text-cyan-900 dark:text-cyan-300">
              You&apos;re submitting a <span className="font-semibold">recommendation</span> for the doctor to finalise.
              They&apos;ll see your grade, feedback, and rubric breakdown before assigning the official mark.
            </div>

            <RubricEditor
              value={taRubric}
              onChange={handleTaRubricChange}
              onTotalChange={handleTaRubricTotalChange}
              defaultRubricType={submission.deliverableType}
            />

            <div>
              <Label>Feedback to the Doctor & Team (optional)</Label>
              <Textarea
                value={taFeedback}
                onChange={(e) => setTaFeedback(e.target.value)}
                placeholder="What's strong, what's weak, what to look at..."
                className="mt-1.5 resize-none"
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleTaReview} disabled={loading} className="flex-1 bg-cyan-600 hover:bg-cyan-700">
                {loading ? "Submitting..." : "Send to Doctor"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setTaReviewDialogOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unlock Dialog */}
      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-amber-500" />
              Unlock Grade
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              The current grade of <b>{submission.grade}/100</b> will be archived. You can then assign a new grade.
            </p>
            <div>
              <Label>Reason (min 5 chars)</Label>
              <Textarea
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="e.g. Student appealed the grade — found a calculation error in rubric."
                className="mt-1.5 resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  if (unlockReason.trim().length < 5) {
                    toast.error("Reason must be at least 5 characters")
                    return
                  }
                  setLoading(true)
                  try {
                    const updated = await submissionsApi.unlock(submission.id, { reason: unlockReason.trim() })
                    onGraded(updated)
                    setUnlockOpen(false)
                    setUnlockReason("")
                    toast.success("Submission unlocked for revision")
                  } catch (e: any) {
                    toast.error(e?.message ?? "Failed to unlock")
                  } finally {
                    setLoading(false)
                  }
                }}
                disabled={loading}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                {loading ? "Unlocking..." : "Unlock"}
              </Button>
              <Button variant="outline" onClick={() => setUnlockOpen(false)} disabled={loading}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revision Dialog */}
      <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Feedback</Label>
              <Textarea
                value={revisionFeedback}
                onChange={(e) => setRevisionFeedback(e.target.value)}
                placeholder="Describe what needs to be revised..."
                className="mt-1.5 resize-none"
                rows={5}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleRequestRevision}
                disabled={loading}
                className="flex-1"
              >
                {loading ? "Requesting..." : "Request Revision"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setRevisionDialogOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Defense scheduler (DEPLOYMENT phase only, supervisor only) */}
      <DefenseScheduler
        open={defenseOpen}
        onOpenChange={setDefenseOpen}
        submissionId={submission.id}
        teamId={submission.teamId}
        participantUserIds={defenseParticipantIds}
        onScheduled={async () => {
          // Re-fetch this submission so the dialog shows the new linked meeting
          try {
            const refreshed = await submissionsApi.get(submission.id)
            onGraded(refreshed)
          } catch { /* ignore */ }
        }}
      />
    </>
  )
}

// ─── New Submission Dialog ───────────────────────────────────────────────────
function NewSubmissionDialog({
  onCreated,
  currentStage,
  targetPhase,
  stageLoading,
  initialDeliverableType,
  initialTitle = "",
  initialNotes = "",
  triggerLabel = "New Submission",
  triggerVariant = "default",
  triggerSize = "default",
  triggerClassName = "",
  disabled = false,
  disabledReason,
}: {
  onCreated: (s: ApiSubmission) => void
  currentStage: ApiTeamStage
  targetPhase?: ApiTeamStage
  stageLoading?: boolean
  initialDeliverableType?: ApiDeliverableType
  initialTitle?: string
  initialNotes?: string
  triggerLabel?: string
  triggerVariant?: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive"
  triggerSize?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg"
  triggerClassName?: string
  disabled?: boolean
  disabledReason?: string
}) {
  const [open, setOpen] = useState(false)
  const [deliverableType, setDeliverableType] = useState<ApiDeliverableType | "">("")
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [formErrors, setFormErrors] = useState<{ type?: string; file?: string }>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const submissionPhase = targetPhase ?? currentStage

  const selectedPhase = deliverableType
    ? DELIVERABLE_META[deliverableType as ApiDeliverableType].phase
    : null
  const availableDeliverables = Object.entries(DELIVERABLE_META).filter(
    ([, meta]) => meta.phase === submissionPhase,
  ) as Array<[ApiDeliverableType, (typeof DELIVERABLE_META)[ApiDeliverableType]]>
  const submissionPhaseMeta = PHASE_META[submissionPhase]
  const canSubmitInCurrentStage = !stageLoading && !disabled && availableDeliverables.length > 0
  const unavailableReason = stageLoading
    ? "Loading phase details..."
    : disabledReason ?? `There are no configured submissions for the ${submissionPhaseMeta.label} phase.`
  const initialTypeIsAvailable =
    initialDeliverableType && DELIVERABLE_META[initialDeliverableType].phase === submissionPhase

  function resetForm() {
    setDeliverableType("")
    setTitle("")
    setNotes("")
    setFile(null)
    setFormErrors({})
    if (fileRef.current) fileRef.current.value = ""
  }

  function prepareForm() {
    setDeliverableType(initialTypeIsAvailable ? initialDeliverableType : "")
    setTitle(initialTitle)
    setNotes(initialNotes)
    setFile(null)
    setFormErrors({})
    if (fileRef.current) fileRef.current.value = ""
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    const errors: { type?: string; file?: string } = {}
    if (!deliverableType) errors.type = "Please select a deliverable type."
    if (deliverableType && DELIVERABLE_META[deliverableType].phase !== submissionPhase) {
      errors.type = `Only ${submissionPhaseMeta.label} deliverables can be submitted from this row.`
    }
    if (!file) errors.file = "Please upload a file."
    
    if (Object.keys(errors).length > 0 || !deliverableType || !file) {
      setFormErrors(errors)
      return
    }
    const selectedDeliverableType = deliverableType
    const selectedFile = file

    setLoading(true)
    try {
      const created = await submissionsApi.create(
        {
          deliverableType: selectedDeliverableType,
          sdlcPhase: submissionPhase,
          title: title || undefined,
          notes: notes || undefined,
        },
        selectedFile,
      )
      onCreated(created)
      resetForm()
      setOpen(false)
      toast.success("Deliverable submitted successfully")
    } catch (e: any) {
      toast.error(e.message || "Submission failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) prepareForm()
        if (!v) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button
          disabled={!canSubmitInCurrentStage}
          variant={triggerVariant}
          size={triggerSize}
          className={`shadow-sm ${triggerClassName}`}
          title={disabledReason}
        >
          <Upload className="h-4 w-4 mr-2" />
          {stageLoading ? "Loading Phase..." : triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] max-w-xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0">
          <div className="border-b bg-muted/30 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>Submit Deliverable</DialogTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Submission phase: <span className="font-medium text-foreground">{stageLoading ? "Loading..." : submissionPhaseMeta.label}</span>
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex gap-2">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm leading-5 text-muted-foreground">
                  Unlocked phases stay open for new versions. Future phases remain locked until earlier required items are approved.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className={formErrors.type ? "text-destructive" : ""}>Deliverable Type *</Label>
                <Select
                  value={deliverableType}
                  disabled={!canSubmitInCurrentStage}
                  onValueChange={(v) => {
                    setDeliverableType(v as ApiDeliverableType)
                    if (formErrors.type) setFormErrors((prev) => ({ ...prev, type: undefined }))
                  }}
                >
                  <SelectTrigger className={`mt-1.5 h-10 ${formErrors.type ? "border-destructive focus:ring-destructive" : ""}`}>
                    <SelectValue placeholder="Select deliverable..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDeliverables.map(([key, meta]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span>{meta.label}</span>
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {meta.required ? "Required" : "Optional"}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPhase && deliverableType && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Expected file: <strong>{DELIVERABLE_META[deliverableType].fileHint}</strong>
                  </p>
                )}
                {!canSubmitInCurrentStage && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {unavailableReason}
                  </p>
                )}
                {formErrors.type && <p className="text-[10px] font-medium text-destructive mt-1">{formErrors.type}</p>}
              </div>

              <div>
                <Label>Title (optional)</Label>
                <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. SRS v2 – Final"
                  className="mt-1.5 h-10"
                />
              </div>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes for your supervisor..."
              rows={2}
              className="mt-1.5 min-h-20 resize-none"
            />
          </div>
          <div>
            <Label className={formErrors.file ? "text-destructive" : ""}>File *</Label>
            <div
              className={`mt-1.5 border-2 border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer ${
                formErrors.file ? "border-destructive bg-destructive/5 hover:border-destructive" : "border-border hover:border-primary"
              }`}
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOCX, PPT, ZIP, etc. (max 50 MB)
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,.png,.jpg,.jpeg"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                if (formErrors.file) setFormErrors((prev) => ({ ...prev, file: undefined }))
              }}
            />
            {formErrors.file && <p className="text-[10px] font-medium text-destructive mt-1">{formErrors.file}</p>}
          </div>

          </div>

          <div className="flex flex-col-reverse gap-2 border-t bg-background px-6 py-4 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => { resetForm(); setOpen(false) }}
              disabled={loading}
              className="sm:w-28"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !canSubmitInCurrentStage} className="flex-1">
              {loading ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PhaseGuideCard({
  phase,
  deliverables,
  approvedCount,
}: {
  phase: ApiTeamStage
  deliverables: ApiDeliverableType[]
  approvedCount: number
}) {
  const guide = PHASE_GUIDE[phase]
  const meta = PHASE_META[phase]
  const requiredDeliverables = deliverables.filter((dt) => DELIVERABLE_META[dt].required)
  const optionalDeliverables = deliverables.filter((dt) => !DELIVERABLE_META[dt].required)
  const requiredApproved = approvedCount >= requiredDeliverables.length

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">What this phase means</h3>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{guide.meaning}</p>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">How to understand it</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{guide.howToUnderstand}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Phase gate</h3>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`${meta.color} border`}>{approvedCount}/{requiredDeliverables.length} approved</Badge>
              <Badge variant={requiredApproved ? "default" : "secondary"}>
                {requiredApproved ? "Ready for next phase" : "Next phase locked"}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              You can move to the next phase only after every required submission in this phase is reviewed and approved by the doctor or supervisor.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="w-full justify-between bg-transparent">
            <a href={guide.reference.href} target="_blank" rel="noopener noreferrer">
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {guide.reference.label}
              </span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>

      {(optionalDeliverables.length > 0 || guide.optionalEvidence.length > 0) && (
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Optional evidence appears below the required submission rows</p>
        </div>
      )}
    </div>
  )
}

// ─── Deliverable Row ─────────────────────────────────────────────────────────
function DeliverableRow({
  deliverableType,
  submissions,
  canSubmit,
  canSubmitInPhase,
  submitDisabledReason,
  currentStage,
  canGrade,
  userRole,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  deliverableType: ApiDeliverableType
  submissions: ApiSubmission[]
  canSubmit: boolean
  canSubmitInPhase: boolean
  submitDisabledReason: string
  currentStage: ApiTeamStage
  canGrade: boolean
  userRole?: string
  onCreated: (s: ApiSubmission) => void
  onUpdated: (s: ApiSubmission) => void
  onDeleted: (id: string) => void
}) {
  const meta = DELIVERABLE_META[deliverableType]
  const latest = submissions[0] ?? null
  const hasSubmission = !!latest
  const isApproved = latest?.status === "APPROVED"
  const needsRevision = latest?.status === "REVISION_REQUIRED"
  const isPendingReview = latest?.status === "PENDING" || latest?.status === "UNDER_REVIEW"
  const submitLabel = !latest ? "Submit" : needsRevision ? "Resubmit" : isApproved ? "New Version" : "Submit"

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete(id: string) {
    setIsDeleting(true)
    try {
      await submissionsApi.delete(id)
      onDeleted(id)
      setIsDeleteDialogOpen(false)
      toast.success("Submission deleted")
    } catch (e: any) {
      toast.error(e.message || "Failed to delete")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <motion.div
      className={`border rounded-lg p-4 transition-colors ${
        isApproved
          ? "border-green-200 bg-green-50/30 dark:bg-green-950/10"
          : needsRevision
          ? "border-red-200 bg-red-50/30 dark:bg-red-950/10"
          : "border-border"
      }`}
      whileHover={{ scale: 1.005 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-medium">{meta.label}</h3>
            <Badge variant={meta.required ? "default" : "outline"} className="text-xs">
              {meta.required ? "Required" : "Optional"}
            </Badge>
            <Badge variant="outline" className={`text-xs ${PHASE_META[meta.phase].color}`}>
              {PHASE_META[meta.phase].label}
            </Badge>
            {latest && (
              <Badge
                variant={STATUS_META[latest.status].variant}
                className="gap-1 text-xs"
              >
                {(() => {
                  const S = STATUS_META[latest.status].icon
                  return <S className="h-3 w-3" />
                })()}
                {STATUS_META[latest.status].label}
              </Badge>
            )}
            {latest?.late && <Badge variant="destructive" className="text-xs">Late</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">Expected file: {meta.fileHint}</p>
          {latest && (
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span>v{latest.version}</span>
              <span>·</span>
              <span>
                {new Date(latest.submittedAt).toLocaleDateString()}
              </span>
              {latest.grade !== null && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-0.5 font-medium text-foreground">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    {latest.grade}%
                  </span>
                </>
              )}
              {latest.submittedBy && (
                <>
                  <span>·</span>
                  <span>{latest.submittedBy.fullName}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canSubmit && (
            <NewSubmissionDialog
              onCreated={onCreated}
              currentStage={currentStage}
              targetPhase={meta.phase}
              initialDeliverableType={deliverableType}
              initialTitle={latest ? `${meta.label} v${latest.version + 1}` : meta.label}
              triggerLabel={submitLabel}
              triggerVariant={needsRevision ? "default" : "outline"}
              triggerSize="sm"
              disabled={!canSubmitInPhase || isPendingReview}
              disabledReason={isPendingReview ? "This item is waiting for supervisor review." : submitDisabledReason}
              triggerClassName={!canSubmitInPhase ? "opacity-45 blur-[1px]" : ""}
            />
          )}
          {latest && (
            <SubmissionDetailDialog
              submissions={submissions}
              canGrade={canGrade}
              canSubmit={canSubmit}
              userRole={userRole}
              onGraded={onUpdated}
              onDeleted={onDeleted}
            />
          )}
          {latest && (canSubmit || canGrade) && !isApproved && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      Delete Submission
                    </DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground mt-2">
                    Are you sure you want to delete this submission? This action cannot be undone.
                  </p>
                  <div className="flex gap-2 justify-end mt-4">
                    <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={() => handleDelete(latest.id)} disabled={isDeleting}>
                      {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {latest?.feedback && (
        <div className="mt-3 p-3 bg-muted rounded-lg">
          <p className="text-xs font-medium mb-1 text-muted-foreground">Supervisor Feedback</p>
          <p className="text-sm">{latest.feedback}</p>
        </div>
      )}

      {!hasSubmission && (
        <div className="mt-3">
          <Progress value={0} className="h-1.5" />
          <p className="text-xs text-muted-foreground mt-1">Not submitted yet</p>
        </div>
      )}

      {submissions.length > 1 && (
        <p className="text-xs text-muted-foreground mt-2">
          {submissions.length} versions submitted
        </p>
      )}
    </motion.div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
function OptionalSubmissionRow({
  label,
  description,
  fileHint,
  phase,
  submitAsDeliverable,
  latest,
  canSubmit,
  canSubmitInPhase,
  submitDisabledReason,
  currentStage,
  canGrade,
  userRole,
  onCreated,
  onUpdated,
}: {
  label: string
  description: string
  fileHint: string
  phase: ApiTeamStage
  submitAsDeliverable: ApiDeliverableType
  latest: ApiSubmission | null
  canSubmit: boolean
  canSubmitInPhase: boolean
  submitDisabledReason: string
  currentStage: ApiTeamStage
  canGrade: boolean
  userRole?: string
  onCreated: (s: ApiSubmission) => void
  onUpdated: (s: ApiSubmission) => void
}) {
  const isPendingReview = latest?.status === "PENDING" || latest?.status === "UNDER_REVIEW"
  const isApproved = latest?.status === "APPROVED"
  const needsRevision = latest?.status === "REVISION_REQUIRED"
  const submitLabel = !latest ? "Submit" : needsRevision ? "Resubmit" : isApproved ? "New Version" : "Submit"
  const statusInfo = latest ? STATUS_META[latest.status] : null
  const StatusIcon = statusInfo?.icon

  return (
    <div
      className={`rounded-lg border border-dashed p-4 transition-colors ${
        isApproved
          ? "border-green-200 bg-green-50/20 dark:bg-green-950/10"
          : needsRevision
            ? "border-red-200 bg-red-50/20 dark:bg-red-950/10"
            : "border-border bg-muted/10"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h4 className="font-medium">{label}</h4>
            <Badge variant="outline" className="text-xs">Optional</Badge>
            <Badge variant="outline" className={`text-xs ${PHASE_META[phase].color}`}>
              {PHASE_META[phase].label}
            </Badge>
            {statusInfo && StatusIcon && (
              <Badge variant={statusInfo.variant} className="gap-1 text-xs">
                <StatusIcon className="h-3 w-3" />
                {statusInfo.label}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
          <p className="mt-1 text-xs text-muted-foreground">Expected file: {fileHint}</p>
          {latest && (
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>v{latest.version}</span>
              <span>{new Date(latest.submittedAt).toLocaleDateString()}</span>
              {latest.grade !== null && (
                <span className="flex items-center gap-0.5 font-medium text-foreground">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  {latest.grade}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canSubmit && (
            <NewSubmissionDialog
              onCreated={onCreated}
              currentStage={currentStage}
              targetPhase={phase}
              initialDeliverableType={submitAsDeliverable}
              initialTitle={`Optional: ${label}`}
              initialNotes={`Optional supporting evidence: ${label}\n\n${description}`}
              triggerLabel={submitLabel}
              triggerVariant={needsRevision ? "default" : "outline"}
              triggerSize="sm"
              disabled={!canSubmitInPhase || isPendingReview}
              disabledReason={isPendingReview ? "This optional evidence is waiting for supervisor review." : submitDisabledReason}
              triggerClassName={!canSubmitInPhase ? "opacity-45 blur-[1px]" : ""}
            />
          )}
          {latest && (
            <SubmissionDetailDialog
              submissions={[latest]}
              canGrade={canGrade}
              canSubmit={canSubmit}
              userRole={userRole}
              onGraded={onUpdated}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Submission Card ────────────────────────────────────────────────────────
function SubmissionCard({ submission, index }: { submission: ApiSubmission; index: number }) {
  const meta = DELIVERABLE_META[submission.deliverableType]
  const statusInfo = STATUS_META[submission.status]
  const StatusIcon = statusInfo.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.3 }}
      className="w-full h-full cursor-pointer"
    >
      <Card className="p-5 h-full flex flex-col border-border/50 hover:border-border/80 hover:shadow-lg transition-all group relative overflow-hidden">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant={statusInfo.variant} className="text-[10px] gap-1 px-1.5 py-0 capitalize">
                <StatusIcon className="h-3 w-3" />
                {statusInfo.label}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", PHASE_META[submission.sdlcPhase].color)}>
                {PHASE_META[submission.sdlcPhase].label}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">v{submission.version}</Badge>
              {submission.late && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Late</Badge>}
            </div>
            <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
              {meta.label}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Team: <span className="text-foreground font-medium">{submission.team?.name || "Unknown Team"}</span>
            </p>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 mb-auto pb-4">
          {submission.title}
        </p>

        <div className="flex items-center justify-between flex-wrap gap-2 mt-4 pt-4 border-t">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground">
              Submitted: {new Date(submission.submittedAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {submission.submittedBy && (
              <Avatar className="h-6 w-6 ring-2 ring-background">
                <AvatarImage src={submission.submittedBy.avatarUrl ?? undefined} />
                <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                  {commentInitials(submission.submittedBy.fullName)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

export default function SubmissionsPage() {
  const { currentUser } = useAuthStore()
  const [submissions, setSubmissions] = useState<ApiSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string>("")
  const [reviewTeamFilter, setReviewTeamFilter] = useState("all")
  const [myProposal, setMyProposal] = useState<ApiProposal | null>(null)
  const [proposalLoading, setProposalLoading] = useState(false)
  const [phaseFilter, setPhaseFilter] = useState<string>("all")

  const userRole = currentUser?.role?.toUpperCase() || ""
  const isLeader = userRole === "LEADER"
  const isMember = userRole === "MEMBER"
  const isSupervisor = userRole === "DOCTOR" || userRole === "TA"
  const isAdmin = userRole === "ADMIN"
  const isReviewInboxOnly = isSupervisor && !isAdmin
  const { data: myTeamState, isLoading: myTeamLoading } = useMyTeamState(isLeader || isMember || isSupervisor)

  useEffect(() => {
    loadSubmissions()
  }, [])

  useEffect(() => {
    if (!isLeader && !isMember) return
    setProposalLoading(true)
    proposalsApi.getMine()
      .then(setMyProposal)
      .catch(() => setMyProposal(null))
      .finally(() => setProposalLoading(false))
  }, [isLeader, isMember])

  async function loadSubmissions() {
    setLoading(true)
    setError(null)
    try {
      const data = await submissionsApi.list()
      setSubmissions(data)
    } catch (e: any) {
      setError(e.message || "Failed to load submissions")
    } finally {
      setLoading(false)
    }
  }

  function handleCreated(s: ApiSubmission) {
    setSubmissions((prev) => [s, ...prev])
  }

  function handleUpdated(s: ApiSubmission) {
    setSubmissions((prev) => prev.map((x) => (x.id === s.id ? s : x)))
  }

  function handleDeleted(id: string) {
    setSubmissions((prev) => prev.filter((x) => x.id !== id))
  }

  const uniqueTeams = useMemo(() => {
    const teams = new Map<string, {id: string, name: string}>()
    submissions.forEach(s => {
      if (s.team) teams.set(s.teamId, s.team)
    })
    return Array.from(teams.values())
  }, [submissions])

  const reviewTeamOptions = useMemo(() => {
    const teams = new Map<string, { id: string; name: string }>()
    ;(myTeamState?.supervisedTeams ?? []).forEach((team) => {
      teams.set(team.id, { id: team.id, name: team.name })
    })
    uniqueTeams.forEach((team) => teams.set(team.id, { id: team.id, name: team.name }))
    return Array.from(teams.values())
  }, [myTeamState?.supervisedTeams, uniqueTeams])

  const supervisedTeamsById = useMemo(() => {
    return new Map((myTeamState?.supervisedTeams ?? []).map((team) => [team.id, team]))
  }, [myTeamState?.supervisedTeams])

  useEffect(() => {
    if ((isSupervisor || isAdmin) && uniqueTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(uniqueTeams[0].id)
    }
  }, [uniqueTeams, selectedTeamId, isSupervisor, isAdmin])

  const displaySubmissions = (isSupervisor || isAdmin) && selectedTeamId
    ? submissions.filter(s => s.teamId === selectedTeamId)
    : submissions

  const officialSubmissions = displaySubmissions.filter((s) => !isOptionalEvidenceSubmission(s))
  const hasApprovedRequiredSubmission = (phase: ApiTeamStage, deliverableType: ApiDeliverableType) =>
    officialSubmissions.some(
      (s) =>
        s.sdlcPhase === phase &&
        s.deliverableType === deliverableType &&
        s.status === "APPROVED",
    )

  // Group by official deliverable type (keep latest first within each type)
  const byDeliverable = Object.keys(DELIVERABLE_META).reduce(
    (acc, key) => {
      const dt = key as ApiDeliverableType
      acc[dt] = officialSubmissions
        .filter((s) => s.deliverableType === dt)
        .sort((a, b) => b.version - a.version)
      return acc
    },
    {} as Record<ApiDeliverableType, ApiSubmission[]>,
  )
  const savedTeamStage = myTeamState?.team?.stage ?? displaySubmissions[0]?.team?.stage ?? "REQUIREMENTS"
  const effectiveCurrentStage =
    PHASE_ORDER.find((phase) => {
      const required = Object.entries(DELIVERABLE_META)
        .filter(([, meta]) => meta.phase === phase && meta.required)
        .map(([key]) => key as ApiDeliverableType)

      return required.some((dt) => !hasApprovedRequiredSubmission(phase, dt))
    }) ?? savedTeamStage
  const currentStage = effectiveCurrentStage
  const proposalApproved = myProposal?.status === "APPROVED"
  const proposalGateApplies = isLeader || isMember
  const proposalLockReason = proposalLoading
    ? "Checking proposal approval..."
    : myProposal
      ? `Your proposal is ${myProposal.status.replace("_", " ").toLowerCase()}. SDLC submissions unlock after doctor approval.`
      : "Create and submit a project proposal before starting official SDLC submissions."
  const canLeaderSubmitSdlc = isLeader && (!proposalGateApplies || proposalApproved)

  const totalCount = submissions.length
  const gradedCount = submissions.filter((s) => s.grade !== null).length
  const approvedCount = submissions.filter((s) => s.status === "APPROVED").length
  const lateCount = submissions.filter((s) => s.late).length
  const avgGrade =
    gradedCount > 0
      ? Math.round(
          submissions.filter((s) => s.grade !== null).reduce((acc, s) => acc + (s.grade ?? 0), 0) /
            gradedCount,
        )
      : 0

  // Role-aware queue:
  //   TA     -> fresh submissions (PENDING) that need first-pass review
  //   Doctor -> TA-reviewed submissions, plus pending submissions for teams without a TA
  //   Admin  -> everything that's not finalized
  const isTaRole     = userRole === "TA"
  const isDoctorRole = userRole === "DOCTOR"
  const pendingReviewSource =
    reviewTeamFilter === "all"
      ? submissions
      : submissions.filter((s) => s.teamId === reviewTeamFilter)
  const pendingReviews = pendingReviewSource.filter((s) => {
    if (isTaRole)     return s.status === "PENDING"
    if (isDoctorRole) {
      const supervisedTeam = supervisedTeamsById.get(s.teamId)
      return s.status === "UNDER_REVIEW" || (s.status === "PENDING" && supervisedTeam !== undefined && !supervisedTeam.ta)
    }
    return s.status === "PENDING" || s.status === "UNDER_REVIEW"
  })

  const filteredPendingReviews = useMemo(() => {
    if (phaseFilter === "all") return pendingReviews
    return pendingReviews.filter(s => s.sdlcPhase === phaseFilter)
  }, [pendingReviews, phaseFilter])

  const phaseStats = useMemo(() => ({
    total: pendingReviews.length,
    REQUIREMENTS: pendingReviews.filter(s => s.sdlcPhase === "REQUIREMENTS").length,
    DESIGN: pendingReviews.filter(s => s.sdlcPhase === "DESIGN").length,
    IMPLEMENTATION: pendingReviews.filter(s => s.sdlcPhase === "IMPLEMENTATION").length,
    TESTING: pendingReviews.filter(s => s.sdlcPhase === "TESTING").length,
    DEPLOYMENT: pendingReviews.filter(s => s.sdlcPhase === "DEPLOYMENT").length,
  }), [pendingReviews])
  const pendingReviewsTitle = isTaRole
    ? "Awaiting Your First-Pass Review"
    : isDoctorRole
    ? "Awaiting Doctor Review"
    : "Pending Reviews"

  return (
    <TeamRequiredGuard
      pageName="Submissions"
      pageDescription="Submit and track your project deliverables."
      icon={<FileUp className="h-10 w-10 text-primary" />}
    >
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between flex-wrap gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-green-600 bg-clip-text text-transparent">
              Submissions
            </h1>
            <p className="text-muted-foreground mt-1">
              {isReviewInboxOnly
                ? "Review deliverable requests from your assigned teams"
                : "Understand each SDLC phase and submit the required project files for supervisor approval"}
            </p>
          </div>
          {isLeader && (
            <NewSubmissionDialog
              onCreated={handleCreated}
              currentStage={currentStage}
              stageLoading={myTeamLoading && !myTeamState?.team}
              disabled={proposalGateApplies && !proposalApproved}
              disabledReason={proposalLockReason}
            />
          )}
        </motion.div>

        {proposalGateApplies && !proposalApproved && (
          <Card className="border-amber-500/25 bg-amber-500/5 p-5">
            <div className="flex gap-3">
              <div className="mt-0.5 rounded-lg bg-amber-500/10 p-2">
                <LockKeyhole className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold">SDLC submissions are locked</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{proposalLockReason}</p>
                <Link href={myProposal ? `/dashboard/proposals/${myProposal.id}` : "/dashboard/proposals/new"}>
                  <Button variant="outline" size="sm" className="mt-3">
                    {myProposal ? "Open Proposal" : "Create Proposal"}
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        )}

        {!isReviewInboxOnly && (
        <Card className="border-primary/25 bg-primary/5 p-5">
          <div className="flex gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
              <LockKeyhole className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">How phase advancement works</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Each phase has required submissions. Your team cannot move to the next SDLC phase until every required item in the current phase is submitted, reviewed, and approved by the doctor or supervisor. Optional evidence can support your work, but it does not unlock the next phase by itself.
            </p>
            {savedTeamStage !== currentStage && (
              <p className="mt-2 text-sm font-medium text-amber-600">
                The saved team stage is {PHASE_META[savedTeamStage].label}, but submissions are locked to {PHASE_META[currentStage].label} because an earlier required approval is still missing.
              </p>
            )}
          </div>
        </div>
      </Card>
        )}

        {/* Stats */}
        {!isReviewInboxOnly && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5 border-l-4 border-l-primary">
            <div className="flex items-center gap-3 mb-1">
              <Upload className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Total Submissions</span>
            </div>
            <p className="text-3xl font-bold">{totalCount}</p>
          </Card>
          <Card className="p-5 border-l-4 border-l-green-500">
            <div className="flex items-center gap-3 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Approved</span>
            </div>
            <p className="text-3xl font-bold">{approvedCount}</p>
          </Card>
          <Card className="p-5 border-l-4 border-l-yellow-500">
            <div className="flex items-center gap-3 mb-1">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Average Grade</span>
            </div>
            <p className="text-3xl font-bold">{gradedCount > 0 ? `${avgGrade}%` : "—"}</p>
          </Card>
          <Card className="p-5 border-l-4 border-l-red-500">
            <div className="flex items-center gap-3 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Late Submissions</span>
            </div>
            <p className="text-3xl font-bold">{lateCount}</p>
          </Card>
        </div>
        )}

        {/* Error / Loading */}
        {error && (
          <Card className="p-4 border-destructive bg-destructive/10">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="ghost" size="sm" onClick={loadSubmissions} className="ml-auto">
                Retry
              </Button>
            </div>
          </Card>
        )}

        {isReviewInboxOnly && loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {/* Pending reviews — role-aware: TA sees PENDING, Doctor sees UNDER_REVIEW */}
        {isAdmin && pendingReviews.length > 0 && (
          <Card className="p-6">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Clock className={`h-5 w-5 ${isTaRole ? "text-cyan-500" : "text-amber-500"}`} />
              {pendingReviewsTitle}
              <Badge variant="secondary">{pendingReviews.length}</Badge>
            </h2>
            <div className="space-y-3">
              {pendingReviews.map((s) => {
                const meta = DELIVERABLE_META[s.deliverableType]
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {s.team?.name} — {meta.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        v{s.version} · Submitted {new Date(s.submittedAt).toLocaleDateString()}
                        {s.late && " · "}
                        {s.late && <span className="text-destructive">Late</span>}
                      </p>
                    </div>
                    <SubmissionDetailDialog
                      submissions={submissions.filter(x => x.deliverableType === s.deliverableType && x.teamId === s.teamId).sort((a,b)=>b.version - a.version)}
                      initialVersionId={s.id}
                      canGrade={true}
                      userRole={userRole}
                      onGraded={handleUpdated}
                    />
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {isReviewInboxOnly && !loading && !error && (
          <div className="space-y-6">
            <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-6">
              {[
                { label: "Total", value: phaseStats.total, color: "from-blue-500/10", icon: Clock },
                { label: "Requirements", value: phaseStats.REQUIREMENTS, color: "from-blue-500/10", icon: FileText },
                { label: "Design", value: phaseStats.DESIGN, color: "from-purple-500/10", icon: Eye },
                { label: "Implementation", value: phaseStats.IMPLEMENTATION, color: "from-orange-500/10", icon: FileUp },
                { label: "Testing", value: phaseStats.TESTING, color: "from-yellow-500/10", icon: AlertTriangle },
                { label: "Deployment", value: phaseStats.DEPLOYMENT, color: "from-green-500/10", icon: CheckCircle2 },
              ].map((s, i) => (
                <motion.div key={s.label}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
                  <Card className="p-3 sm:p-4 relative overflow-hidden h-full flex flex-col justify-center">
                    <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent", s.color)} />
                    <div className="relative flex flex-col items-center gap-2 text-center">
                      <div className="p-1.5 sm:p-2 rounded-xl bg-background/80 border border-border/60">
                        <s.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground" />
                      </div>
                      <div>
                        <p className="text-lg sm:text-xl font-bold tabular-nums leading-none">{s.value}</p>
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{s.label}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            <Card className="p-4 border-border/50">
              <div className="flex flex-col md:flex-row gap-3 items-center">
                <span className="text-sm font-semibold whitespace-nowrap px-2 flex items-center gap-2">
                  <Clock className={`h-4 w-4 ${isTaRole ? "text-cyan-500" : "text-amber-500"}`} />
                  {pendingReviewsTitle}
                </span>
                <div className="grid w-full gap-3 md:ml-auto md:w-auto md:grid-cols-2">
                  <Select value={reviewTeamFilter} onValueChange={setReviewTeamFilter}>
                    <SelectTrigger className="w-full md:w-[220px]">
                      <SelectValue placeholder="Filter by Team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Teams</SelectItem>
                      {reviewTeamOptions.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                    <SelectTrigger className="w-full md:w-[220px]">
                      <SelectValue placeholder="Filter by Phase" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Phases</SelectItem>
                      <SelectItem value="REQUIREMENTS">Requirements</SelectItem>
                      <SelectItem value="DESIGN">Design</SelectItem>
                      <SelectItem value="IMPLEMENTATION">Implementation</SelectItem>
                      <SelectItem value="TESTING">Testing</SelectItem>
                      <SelectItem value="DEPLOYMENT">Deployment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {filteredPendingReviews.length === 0 ? (
              <Card className="p-12 text-center border-dashed">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
                  <Clock className="h-7 w-7 text-muted-foreground" />
                </div>
                <h2 className="font-semibold text-lg">No review requests</h2>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                  {phaseFilter === "all"
                    ? "New submissions from your assigned teams will appear here when they need your review."
                    : `No pending submissions for the ${phaseFilter.toLowerCase()} phase.`}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPendingReviews.map((s, i) => (
                  <SubmissionDetailDialog
                    key={s.id}
                    submissions={submissions.filter(x => x.deliverableType === s.deliverableType && x.teamId === s.teamId).sort((a,b)=>b.version - a.version)}
                    initialVersionId={s.id}
                    canGrade={true}
                    userRole={userRole}
                    onGraded={handleUpdated}
                    customTrigger={
                      <div className="h-full">
                        <SubmissionCard submission={s} index={i} />
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Deliverables by phase */}
        {!isReviewInboxOnly && (
          <>
        <div className="flex items-center justify-between mt-8 mb-4 border-t pt-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">SDLC Phase Submissions</h2>
              <p className="text-sm text-muted-foreground mt-0.5">What each phase means and what your team must submit</p>
            </div>
          </div>
          {(isSupervisor || isAdmin) && uniqueTeams.length > 0 && (
            <div className="flex items-center gap-3 bg-muted/40 p-2 rounded-lg border">
               <span className="text-sm font-medium text-muted-foreground whitespace-nowrap px-2">View Team:</span>
               <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                 <SelectTrigger className="w-[240px] bg-background">
                   <SelectValue placeholder="Select team..." />
                 </SelectTrigger>
                 <SelectContent>
                   {uniqueTeams.map(t => (
                     <SelectItem key={t.id} value={t.id} className="font-medium">{t.name}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {PHASE_ORDER.map(
              (phase) => {
                const phaseDeliverables = Object.entries(DELIVERABLE_META)
                  .filter(([, m]) => m.phase === phase)
                  .map(([key]) => key as ApiDeliverableType)
                  .sort((a, b) => Number(DELIVERABLE_META[b].required) - Number(DELIVERABLE_META[a].required))
                const requiredDeliverables = phaseDeliverables.filter((dt) => DELIVERABLE_META[dt].required)
                const optionalDeliverables = phaseDeliverables.filter((dt) => !DELIVERABLE_META[dt].required)
                const approvedRequiredCount = requiredDeliverables.filter((dt) => hasApprovedRequiredSubmission(phase, dt)).length
                const phaseIndex = PHASE_ORDER.indexOf(phase)
                const currentIndex = PHASE_ORDER.indexOf(currentStage)
                const isCurrentPhase = phase === currentStage
                const isFuturePhase = currentIndex >= 0 && phaseIndex > currentIndex
                const isPreviousPhase = currentIndex >= 0 && phaseIndex < currentIndex
                const isUnlockedPhase = currentIndex >= 0 && phaseIndex <= currentIndex
                const phaseHeader = PHASE_HEADER_META[phase]
                const phaseSubmissions = displaySubmissions
                  .filter((s) => s.sdlcPhase === phase)
                  .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
                const requiredPhaseSubmissions = phaseSubmissions.filter(
                  (s) => requiredDeliverables.includes(s.deliverableType) && !isOptionalEvidenceSubmission(s),
                )
                const latestPhaseSubmission = requiredPhaseSubmissions[0] ?? null
                const phaseReviewPending =
                  latestPhaseSubmission?.status === "PENDING" || latestPhaseSubmission?.status === "UNDER_REVIEW"
                const phaseRevisionRequired = latestPhaseSubmission?.status === "REVISION_REQUIRED"
                const submitAsEvidenceType = requiredDeliverables[0] ?? optionalDeliverables[0]
                const baseDisabledReason = isFuturePhase
                  ? "This phase is locked until earlier required submissions are approved and the project stage advances."
                  : phaseReviewPending
                    ? "A required submission in this phase is waiting for supervisor review."
                    : "This phase is unlocked."
                const canSubmitRequiredDeliverable = (dt: ApiDeliverableType) =>
                  isUnlockedPhase &&
                  !phaseReviewPending &&
                  (!phaseRevisionRequired || latestPhaseSubmission?.deliverableType === dt)
                const canSubmitOptionalItem = isUnlockedPhase
                const optionalDisabledReason =
                  isFuturePhase ? baseDisabledReason : "This phase is unlocked."
                const submitDisabledReason = !proposalApproved && proposalGateApplies ? proposalLockReason : baseDisabledReason
                const optionalSubmitDisabledReason = !proposalApproved && proposalGateApplies ? proposalLockReason : optionalDisabledReason
                const phaseProgress =
                  requiredDeliverables.length > 0
                    ? Math.round((approvedRequiredCount / requiredDeliverables.length) * 100)
                    : 100
                const latestOptionalEvidence = (label: string, submitAs: ApiDeliverableType) =>
                  phaseSubmissions.find(
                    (s) => s.deliverableType === submitAs && s.title === `Optional: ${label}`,
                  ) ?? null

                return (
                  <Collapsible key={phase} defaultOpen={isCurrentPhase}>
                    <Card
                      className={`overflow-hidden border-l-4 p-0 ${
                        isCurrentPhase
                          ? "border-l-primary shadow-sm ring-1 ring-primary/20"
                          : isFuturePhase
                            ? "border-l-muted-foreground/30 bg-muted/10 opacity-80"
                            : "border-l-green-500"
                      }`}
                    >
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="group flex w-full flex-col gap-4 bg-muted/20 p-5 text-left transition-colors hover:bg-muted/35 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="flex min-w-0 gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-background text-sm font-semibold text-muted-foreground">
                              {phaseIndex + 1}
                            </div>
                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={`${PHASE_META[phase].color} border`}>
                                  {PHASE_META[phase].label}
                                </Badge>
                                {isCurrentPhase && <Badge variant="default">Current phase</Badge>}
                                {isFuturePhase && (
                                  <Badge variant="secondary" className="gap-1">
                                    <LockKeyhole className="h-3 w-3" />
                                    Locked
                                  </Badge>
                                )}
                                {isPreviousPhase && <Badge variant="outline">Unlocked previous phase</Badge>}
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                  {phaseHeader.title}
                                </h3>
                                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                                  {phaseHeader.subtitle}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[260px]">
                            <div className="flex items-center justify-between gap-3">
                              <Badge variant={approvedRequiredCount === requiredDeliverables.length ? "default" : "secondary"}>
                                {approvedRequiredCount}/{requiredDeliverables.length} required approved
                              </Badge>
                              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                            </div>
                            <div className="space-y-1.5">
                              <Progress value={phaseProgress} className="h-1.5" />
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>{phaseSubmissions.length} submission{phaseSubmissions.length === 1 ? "" : "s"}</span>
                                <span>{phaseProgress}% complete</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-4 border-t p-5">
                          <PhaseGuideCard
                            phase={phase}
                            deliverables={phaseDeliverables}
                            approvedCount={approvedRequiredCount}
                          />

                          <div className="space-y-3">
                            {requiredDeliverables.map((dt) => (
                              <DeliverableRow
                                key={dt}
                                deliverableType={dt}
                                submissions={byDeliverable[dt]}
                                canSubmit={canLeaderSubmitSdlc}
                                canSubmitInPhase={canSubmitRequiredDeliverable(dt)}
                                submitDisabledReason={submitDisabledReason}
                                currentStage={currentStage}
                                canGrade={isSupervisor || isAdmin}
                                userRole={userRole}
                                onCreated={handleCreated}
                                onUpdated={handleUpdated}
                                onDeleted={handleDeleted}
                              />
                            ))}
                            {(optionalDeliverables.length > 0 || PHASE_GUIDE[phase].optionalEvidence.length > 0) && (
                              <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <h3 className="text-sm font-semibold">Optional supporting evidence</h3>
                                  <Badge variant="outline">Does not unlock phase</Badge>
                                </div>
                                <div className="space-y-2">
                                  {optionalDeliverables.map((dt) => (
                                    <OptionalSubmissionRow
                                      key={dt}
                                      label={DELIVERABLE_META[dt].label}
                                      description={DELIVERABLE_META[dt].description}
                                      fileHint={DELIVERABLE_META[dt].fileHint}
                                      phase={phase}
                                      submitAsDeliverable={dt}
                                      latest={byDeliverable[dt]?.[0] ?? null}
                                      canSubmit={canLeaderSubmitSdlc}
                                      canSubmitInPhase={canSubmitOptionalItem}
                                      submitDisabledReason={optionalSubmitDisabledReason}
                                      currentStage={currentStage}
                                      canGrade={isSupervisor || isAdmin}
                                      userRole={userRole}
                                      onCreated={handleCreated}
                                      onUpdated={handleUpdated}
                                    />
                                  ))}
                                  {submitAsEvidenceType &&
                                    PHASE_GUIDE[phase].optionalEvidence.map((evidence) => (
                                      <OptionalSubmissionRow
                                        key={evidence.id}
                                        label={evidence.label}
                                        description={evidence.description}
                                        fileHint={evidence.fileHint}
                                        phase={phase}
                                        submitAsDeliverable={submitAsEvidenceType}
                                        latest={latestOptionalEvidence(evidence.label, submitAsEvidenceType)}
                                        canSubmit={canLeaderSubmitSdlc}
                                        canSubmitInPhase={canSubmitOptionalItem}
                                        submitDisabledReason={optionalSubmitDisabledReason}
                                        currentStage={currentStage}
                                        canGrade={isSupervisor || isAdmin}
                                        userRole={userRole}
                                        onCreated={handleCreated}
                                        onUpdated={handleUpdated}
                                      />
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )
              },
            )}
          </>
        )}
          </>
        )}
      </div>
    </TeamRequiredGuard>
  )
}
