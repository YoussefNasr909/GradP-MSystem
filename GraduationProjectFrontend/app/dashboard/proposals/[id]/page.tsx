"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  FileText, ArrowLeft, Clock, CheckCircle2, XCircle, RotateCcw, FileEdit,
  Send, Trash2, MessageSquare, Users, Calendar, AlertCircle, Sparkles, Award,
  Pencil, Target, Wrench, ListChecks, BookOpen, Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth-store"
import { proposalsApi } from "@/lib/api/proposals"
import type { ApiProposal, ApiProposalStatus } from "@/lib/api/proposals"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

// ─── Status meta ─────────────────────────────────────────────────────────────

const STATUS_META: Record<
  ApiProposalStatus,
  { label: string; icon: React.ElementType; chip: string; bg: string }
> = {
  DRAFT:              { label: "Draft",              icon: FileEdit,    chip: "border-gray-500/30 text-gray-500",   bg: "bg-gray-500/5" },
  SUBMITTED:          { label: "Submitted",          icon: Clock,       chip: "border-blue-500/30 text-blue-500",   bg: "bg-blue-500/5" },
  UNDER_REVIEW:       { label: "Under Review",       icon: Clock,       chip: "border-purple-500/30 text-purple-500", bg: "bg-purple-500/5" },
  REVISION_REQUESTED: { label: "Revision Requested", icon: RotateCcw,   chip: "border-amber-500/30 text-amber-500", bg: "bg-amber-500/5" },
  APPROVED:           { label: "Approved",           icon: CheckCircle2, chip: "border-green-500/30 text-green-500", bg: "bg-green-500/5" },
  REJECTED:           { label: "Rejected",           icon: XCircle,     chip: "border-red-500/30 text-red-500",     bg: "bg-red-500/5" },
}

const WORKFLOW_STEPS: Array<{ status: ApiProposalStatus; label: string; description: string }> = [
  { status: "DRAFT", label: "Draft", description: "Team prepares the idea and scope." },
  { status: "SUBMITTED", label: "Submitted", description: "Leader sends it to the doctor." },
  { status: "UNDER_REVIEW", label: "Review", description: "Doctor evaluates the proposal." },
  { status: "APPROVED", label: "Approved", description: "Formal SDLC work is unlocked." },
]

const UNLOCKS_AFTER_APPROVAL = [
  "Official SDLC deliverable submissions",
  "SDLC phase advancement",
  "Formal risk approval and monitoring",
  "Graded project workflow",
]

function initials(n?: string | null) {
  if (!n) return "?"
  return n.split(" ").map(x => x[0]).join("").toUpperCase().slice(0, 2)
}

function getProposalChecklist(proposal: ApiProposal) {
  return [
    { label: "Problem statement is substantive", done: proposal.problemStatement.trim().length >= 50 },
    { label: "Objectives are listed", done: proposal.objectives.length > 0 },
    { label: "Scope is clear", done: proposal.scope.trim().length >= 20 },
    { label: "Methodology and SDLC approach are defined", done: proposal.methodology.trim().length >= 20 },
    { label: "Technology stack is listed", done: proposal.technologies.length > 0 },
    { label: "Expected deliverables are listed", done: proposal.deliverables.length > 0 },
  ]
}

function getWorkflowState(step: ApiProposalStatus, proposalStatus: ApiProposalStatus) {
  if (proposalStatus === "REJECTED") return step === "DRAFT" ? "complete" : "waiting"
  if (proposalStatus === "REVISION_REQUESTED") {
    return step === "DRAFT" || step === "SUBMITTED" || step === "UNDER_REVIEW" ? "complete" : "waiting"
  }

  const stepIndex = WORKFLOW_STEPS.findIndex((item) => item.status === step)
  const currentIndex = WORKFLOW_STEPS.findIndex((item) => item.status === proposalStatus)
  if (stepIndex < currentIndex) return "complete"
  if (stepIndex === currentIndex) return proposalStatus === "APPROVED" ? "complete" : "current"
  return "waiting"
}

// ─── Section ────────────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, children, delay = 0,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
    >
      <Card className="p-5 border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        </div>
        {children}
      </Card>
    </motion.div>
  )
}

// ─── Detail Page ────────────────────────────────────────────────────────────

function ProposalWorkflow({ status }: { status: ApiProposalStatus }) {
  return (
    <Card className="p-5 border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Approval Workflow</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {WORKFLOW_STEPS.map((step, index) => {
          const state = getWorkflowState(step.status, status)
          const isComplete = state === "complete"
          const isCurrent = state === "current"
          return (
            <div key={step.status} className="relative rounded-lg border border-border/60 p-3">
              {index < WORKFLOW_STEPS.length - 1 && (
                <div className="hidden md:block absolute left-[calc(100%-0.5rem)] top-6 h-px w-4 bg-border" />
              )}
              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                  isComplete && "border-green-500/30 bg-green-500/10 text-green-600",
                  isCurrent && "border-blue-500/30 bg-blue-500/10 text-blue-600",
                  !isComplete && !isCurrent && "border-border bg-muted text-muted-foreground",
                )}>
                  {isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </span>
                <span className="text-sm font-medium">{step.label}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{step.description}</p>
            </div>
          )
        })}
      </div>
      {(status === "REVISION_REQUESTED" || status === "REJECTED") && (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
          The team should update the proposal and submit a new version before SDLC work can be unlocked.
        </div>
      )}
    </Card>
  )
}

function ProposalReadiness({ proposal }: { proposal: ApiProposal }) {
  const checklist = getProposalChecklist(proposal)
  const completed = checklist.filter((item) => item.done).length

  return (
    <Card className="p-5 border-border/50">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Readiness Checklist</h2>
        </div>
        <Badge variant={completed === checklist.length ? "default" : "secondary"}>{completed}/{checklist.length}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {checklist.map((item) => (
          <div key={item.label} className="flex items-start gap-2 rounded-lg border border-border/50 p-3 text-sm">
            <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", item.done ? "text-green-500" : "text-muted-foreground/40")} />
            <span className={cn(!item.done && "text-muted-foreground")}>{item.label}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function ApprovalUnlocks({ approved }: { approved: boolean }) {
  return (
    <Card className={cn("p-5 border-border/50", approved ? "bg-green-500/5" : "bg-muted/30")}>
      <div className="flex items-center gap-2 mb-4">
        {approved ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Award className="h-4 w-4 text-primary" />}
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {approved ? "Unlocked" : "Unlocked After Approval"}
        </h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {UNLOCKS_AFTER_APPROVAL.map((item) => (
          <div key={item} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", approved ? "text-green-500" : "text-muted-foreground/40")} />
            <span className={cn(!approved && "text-muted-foreground")}>{item}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { currentUser } = useAuthStore()

  const [proposal, setProposal] = useState<ApiProposal | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [busy, setBusy]         = useState(false)

  // Review dialog state (doctor only)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewDecision, setReviewDecision] = useState<"APPROVED" | "REJECTED" | "REVISION_REQUESTED">("APPROVED")
  const [reviewFeedback, setReviewFeedback] = useState("")
  const [aiEvaluation, setAiEvaluation] = useState<any>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)

  const fetchData = useCallback(async () => {
    setError(false)
    try {
      const data = await proposalsApi.get(id)
      setProposal(data)
    } catch {
      setError(true)
    }
  }, [id])

  useEffect(() => {
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  // ── permissions ──
  const role         = currentUser?.role?.toLowerCase() ?? ""
  const isLeader     = role === "leader"
  const isDoctor     = role === "doctor"
  const isAdmin      = role === "admin"
  const isAuthor     = proposal?.team.leaderId === currentUser?.id
  const isMyTeamDoctor = proposal?.team.doctorId === currentUser?.id

  const canEdit       = (isAuthor || isAdmin) && proposal && proposal.status !== "APPROVED"
  const canSubmit     = (isAuthor || isAdmin) && proposal &&
                        (proposal.status === "DRAFT" || proposal.status === "REVISION_REQUESTED" || proposal.status === "REJECTED")
  const canReview     = (isMyTeamDoctor || isAdmin) && proposal &&
                        (proposal.status === "SUBMITTED" || proposal.status === "UNDER_REVIEW" || proposal.status === "REVISION_REQUESTED" || proposal.status === "REJECTED")
  const canDelete     = (isAuthor || isAdmin) && proposal?.status === "DRAFT"

  async function handleSubmit() {
    if (!proposal) return
    setBusy(true)
    try {
      const updated = await proposalsApi.submit(proposal.id)
      setProposal(updated)
      toast.success("Proposal submitted for doctor review")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit")
    } finally {
      setBusy(false)
    }
  }

  const [deleteOpen, setDeleteOpen] = useState(false)

  async function performDelete() {
    if (!proposal) return
    try {
      await proposalsApi.delete(proposal.id)
      toast.success("Draft deleted")
      router.push("/dashboard/proposals")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete")
      throw e
    }
  }

  async function handleReview() {
    if (!proposal) return
    if (reviewDecision !== "APPROVED" && reviewFeedback.trim().length < 10) {
      toast.error("Feedback is required (min 10 chars)")
      return
    }
    setBusy(true)
    try {
      const updated = await proposalsApi.review(proposal.id, {
        decision: reviewDecision,
        feedback: reviewFeedback || undefined,
      })
      setProposal(updated)
      setReviewOpen(false)
      setReviewFeedback("")
      setAiEvaluation(null)
      toast.success(`Proposal ${reviewDecision.toLowerCase().replace("_", " ")}`)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to review")
    } finally {
      setBusy(false)
    }
  }

  async function evaluateWithAI() {
    if (!proposal) return;
    setIsEvaluating(true);
    setAiEvaluation(null);
    try {
      const res = await fetch('/api/evaluate-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal })
      });
      if (!res.ok) throw new Error("Failed to evaluate proposal");
      const data = await res.json();
      
      setAiEvaluation(data);
      setReviewDecision(data.decision);
      setReviewFeedback(data.feedback);
      toast.success("AI Evaluation complete!");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to run AI evaluation");
    } finally {
      setIsEvaluating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="max-w-md mx-auto p-6">
        <Card className="p-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">Proposal not found</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            It may have been deleted or you don&apos;t have access.
          </p>
          <Link href="/dashboard/proposals">
            <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back to proposals</Button>
          </Link>
        </Card>
      </div>
    )
  }

  const meta = STATUS_META[proposal.status]
  const StatusIcon = meta.icon

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Back */}
      <Link href="/dashboard/proposals">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Proposals
        </Button>
      </Link>

      {/* Hero header */}
      <Card className={cn("p-6 border-border/50 relative overflow-hidden", meta.bg)}>
        <motion.div
          className="absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-30"
          animate={{ scale: [1, 1.15, 1], rotate: [0, 120, 0] }}
          transition={{ duration: 18, repeat: Infinity }}
          style={{ background: "currentColor" }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge variant="outline" className={cn("gap-1.5 px-2.5 py-1", meta.chip)}>
              <StatusIcon className="h-3.5 w-3.5" />
              {meta.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5">v{proposal.version}</Badge>
            {proposal.revisionCount > 0 && (
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500">
                {proposal.revisionCount} revision{proposal.revisionCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold mb-2">{proposal.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{proposal.team.name}</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Created {new Date(proposal.createdAt).toLocaleDateString()}</span>
            {proposal.submittedAt && (
              <span className="flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5" />Submitted {new Date(proposal.submittedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-5 flex-wrap">
            {canEdit && (
              <Link href={`/dashboard/proposals/${proposal.id}/edit`}>
                <Button variant="outline" size="sm">
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
              </Link>
            )}
            {canSubmit && (
              <Button size="sm" onClick={() => void handleSubmit()} disabled={busy}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {proposal.status === "REVISION_REQUESTED" ? "Resubmit" : "Submit for Review"}
              </Button>
            )}
            {canReview && (
              <Button size="sm" onClick={() => setReviewOpen(true)} className="bg-amber-600 hover:bg-amber-700">
                <Award className="h-3.5 w-3.5 mr-1.5" />
                Review Proposal
              </Button>
            )}
            {canDelete && (
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} disabled={busy} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Doctor feedback / decision banner */}
      <AnimatePresence>
        {proposal.feedback && proposal.reviewedBy && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={cn(
              "p-5 border-2",
              proposal.status === "APPROVED"           && "border-green-500/30 bg-green-500/5",
              proposal.status === "REJECTED"           && "border-red-500/30 bg-red-500/5",
              proposal.status === "REVISION_REQUESTED" && "border-amber-500/30 bg-amber-500/5",
            )}>
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={proposal.reviewedBy.avatarUrl ?? undefined} />
                  <AvatarFallback>{initials(proposal.reviewedBy.fullName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{proposal.reviewedBy.fullName}</span>
                    <span className="text-xs text-muted-foreground">
                      · {proposal.reviewedAt && new Date(proposal.reviewedAt).toLocaleString()}
                    </span>
                    <Badge variant="outline" className={cn("text-[10px]", meta.chip)}>
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{proposal.feedback}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <ProposalWorkflow status={proposal.status} />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <ProposalReadiness proposal={proposal} />
        <ApprovalUnlocks approved={proposal.status === "APPROVED"} />
      </div>

      {/* Content sections */}
      <Section icon={BookOpen} title="Abstract" delay={0.05}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{proposal.abstract}</p>
      </Section>

      <Section icon={AlertCircle} title="Problem Statement" delay={0.08}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{proposal.problemStatement}</p>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section icon={Target} title="Scope" delay={0.11}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{proposal.scope}</p>
        </Section>
        <Section icon={Wrench} title="Methodology" delay={0.14}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{proposal.methodology}</p>
        </Section>
      </div>

      <Section icon={ListChecks} title="Objectives" delay={0.17}>
        <ul className="space-y-2">
          {proposal.objectives.map((o, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.17 + i * 0.04 }}
              className="flex items-start gap-2 text-sm"
            >
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <span>{o}</span>
            </motion.li>
          ))}
        </ul>
      </Section>

      <Section icon={Sparkles} title="Technologies" delay={0.2}>
        <div className="flex flex-wrap gap-1.5">
          {proposal.technologies.map((t, i) => (
            <motion.div key={`${t}-${i}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.02 }}
            >
              <Badge variant="secondary" className="text-xs">{t}</Badge>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section icon={FileText} title="Deliverables" delay={0.23}>
        <ul className="space-y-2">
          {proposal.deliverables.map((d, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.23 + i * 0.04 }}
              className="flex items-start gap-2 text-sm"
            >
              <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{d}</span>
            </motion.li>
          ))}
        </ul>
      </Section>

      {proposal.timeline && (
        <Section icon={Calendar} title="Timeline" delay={0.26}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{proposal.timeline}</p>
        </Section>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              Review Proposal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            
            <Button 
              onClick={evaluateWithAI} 
              disabled={isEvaluating} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              {isEvaluating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing Proposal...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> ✨ AI Evaluate Proposal</>
              )}
            </Button>

            {aiEvaluation && (
              <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-xl p-4 text-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-indigo-900 dark:text-indigo-300">AI Analysis</h4>
                  <Badge variant={aiEvaluation.score >= 80 ? "default" : "secondary"}>Score: {aiEvaluation.score}/100</Badge>
                </div>
                {aiEvaluation.strengths?.length > 0 && (
                  <div>
                    <span className="font-medium text-green-700 dark:text-green-400">Strengths:</span>
                    <ul className="list-disc pl-5 mt-1 text-muted-foreground">
                      {aiEvaluation.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {aiEvaluation.weaknesses?.length > 0 && (
                  <div>
                    <span className="font-medium text-amber-700 dark:text-amber-400">Weaknesses:</span>
                    <ul className="list-disc pl-5 mt-1 text-muted-foreground">
                      {aiEvaluation.weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            <div>
              <Label>Decision</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Button
                  variant={reviewDecision === "APPROVED" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReviewDecision("APPROVED")}
                  className={cn(reviewDecision === "APPROVED" && "bg-green-600 hover:bg-green-700")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button
                  variant={reviewDecision === "REVISION_REQUESTED" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReviewDecision("REVISION_REQUESTED")}
                  className={cn(reviewDecision === "REVISION_REQUESTED" && "bg-amber-600 hover:bg-amber-700")}
                >
                  <RotateCcw className="h-4 w-4 mr-1" /> Revise
                </Button>
                <Button
                  variant={reviewDecision === "REJECTED" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReviewDecision("REJECTED")}
                  className={cn(reviewDecision === "REJECTED" && "bg-red-600 hover:bg-red-700")}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
              </div>
            </div>
            <div>
              <Label>
                Feedback {reviewDecision !== "APPROVED" && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                placeholder={
                  reviewDecision === "APPROVED"
                    ? "Optional notes for the team…"
                    : "Explain what needs to change or why this is rejected…"
                }
                className="mt-1.5 resize-none"
                rows={5}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void handleReview()} disabled={busy} className="flex-1">
                {busy ? "Submitting…" : "Submit Review"}
              </Button>
              <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this proposal draft?"
        description="The entire proposal will be permanently removed and your team will need to start over from scratch."
        confirmLabel="Delete draft"
        onConfirm={performDelete}
      />
    </motion.div>
  )
}
