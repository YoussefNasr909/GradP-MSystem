"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  AlertCircle,
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Flag,
  Gauge,
  GitPullRequest,
  Layers3,
  ListTodo,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TriangleAlert,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"
import { TeamRequiredGuard } from "@/components/team-required-guard"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import { sprintsApi } from "@/lib/api/sprints"
import type {
  ApiSprint,
  ApiSprintBoard,
  ApiSprintEvaluation,
  ApiSprintEvaluationCriteria,
  ApiSprintEvaluationStatus,
  ApiSprintStatus,
  ApiSprintTask,
  ApiTaskStatus,
  ApiTeamSummary,
} from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

type SprintFormState = {
  name: string
  goal: string
  startDate: string
  endDate: string
  status: ApiSprintStatus
}

type SprintDialogMode = "create" | "edit"

type SprintFormErrors = Partial<Record<keyof SprintFormState | "form", string>>

type EvaluationFormState = {
  feedback: string
  earlyEvaluation: boolean
  criteria: Record<keyof ApiSprintEvaluationCriteria, string>
}

type EvaluationFormErrors = Partial<Record<keyof ApiSprintEvaluationCriteria | "feedback" | "form", string>>

const DEFAULT_SPRINT_FORM: SprintFormState = {
  name: "",
  goal: "",
  startDate: "",
  endDate: "",
  status: "PLANNED",
}

const DEFAULT_EVALUATION_FORM: EvaluationFormState = {
  feedback: "",
  earlyEvaluation: false,
  criteria: {
    planningQuality: "",
    taskCompletion: "",
    progressConsistency: "",
    teamCollaboration: "",
    deadlineCommitment: "",
  },
}

const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const
const SPRINTS_PER_PAGE = 1

const STATUS_COLUMNS: Array<{ status: ApiTaskStatus; label: string; icon: typeof ListTodo; color: string }> = [
  { status: "TODO", label: "Ready", icon: ListTodo, color: "bg-slate-500" },
  { status: "IN_PROGRESS", label: "In progress", icon: Clock3, color: "bg-blue-500" },
  { status: "REVIEW", label: "Review", icon: GitPullRequest, color: "bg-violet-500" },
  { status: "APPROVED", label: "Approved", icon: CheckCircle2, color: "bg-amber-500" },
  { status: "DONE", label: "Done", icon: CheckCircle2, color: "bg-emerald-500" },
]

const STATUS_COLORS: Record<ApiTaskStatus, string> = {
  TODO: "#64748b",
  IN_PROGRESS: "#2563eb",
  REVIEW: "#7c3aed",
  APPROVED: "#d97706",
  DONE: "#059669",
}

const EVALUATION_CRITERIA: Array<{ key: keyof ApiSprintEvaluationCriteria; label: string }> = [
  { key: "planningQuality", label: "Planning quality" },
  { key: "taskCompletion", label: "Task completion" },
  { key: "progressConsistency", label: "Progress consistency" },
  { key: "teamCollaboration", label: "Team collaboration" },
  { key: "deadlineCommitment", label: "Deadline commitment" },
]

function toInputDate(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function formatShortDate(value?: string | null) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatSprintRange(sprint: ApiSprint) {
  return `${formatShortDate(sprint.startDate)} - ${formatShortDate(sprint.endDate)}`
}

function startOfDayMs(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function endOfDayMs(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

function formatTaskRange(task: ApiSprintTask) {
  if (!task.startDate && !task.endDate) return "No schedule"
  if (!task.startDate) return `Ends ${formatShortDate(task.endDate)}`
  if (!task.endDate) return `Starts ${formatShortDate(task.startDate)}`
  return `${formatShortDate(task.startDate)} - ${formatShortDate(task.endDate)}`
}

function getTaskSprintDateConflict(task: ApiSprintTask, sprint: ApiSprint) {
  const taskStart = startOfDayMs(task.startDate)
  const taskEnd = endOfDayMs(task.endDate)
  const sprintStart = startOfDayMs(sprint.startDate)
  const sprintEnd = endOfDayMs(sprint.endDate)

  if (taskStart === null || taskEnd === null) return "Add task start and end dates first"
  if (sprintStart === null || sprintEnd === null) return "Sprint dates are not valid"
  if (taskStart < sprintStart) return `Task starts ${formatShortDate(task.startDate)}, before sprint starts ${formatShortDate(sprint.startDate)}`
  if (taskEnd > sprintEnd) return `Task ends ${formatShortDate(task.endDate)}, after sprint ends ${formatShortDate(sprint.endDate)}`
  return ""
}

function getTaskSprintBlockLabel(conflict: string) {
  if (!conflict) return ""
  if (conflict.includes("Add task start and end dates")) return "Needs task dates"
  if (conflict.includes("before sprint starts")) return "Starts before sprint"
  if (conflict.includes("after sprint ends")) return "Ends after sprint"
  return "Dates do not fit"
}

function formatStatus(status: ApiTaskStatus) {
  return STATUS_COLUMNS.find((column) => column.status === status)?.label ?? status
}

function formatSprintStatus(status: ApiSprintStatus) {
  if (status === "ACTIVE") return "Active"
  if (status === "COMPLETED") return "Completed"
  return "Planned"
}

function getSprintBadgeClass(status: ApiSprintStatus) {
  if (status === "ACTIVE") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (status === "COMPLETED") return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
  return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
}

function formatEvaluationStatus(status: ApiSprintEvaluationStatus) {
  if (status === "NEEDS_CHANGES") return "Needs changes"
  return status.toLowerCase().replace(/^\w/, (value) => value.toUpperCase())
}

function getEvaluationBadgeClass(status: ApiSprintEvaluationStatus) {
  if (status === "APPROVED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (status === "SUBMITTED") return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
  if (status === "NEEDS_CHANGES") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  if (status === "REJECTED") return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
  return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
}

function getEvaluationRoleLabel(role: ApiSprintEvaluation["evaluatorRole"]) {
  return role === "DOCTOR" ? "Historical doctor evaluation" : "TA evaluation"
}

function getEvaluationFormFromEvaluation(evaluation?: ApiSprintEvaluation | null): EvaluationFormState {
  if (!evaluation) return DEFAULT_EVALUATION_FORM
  return {
    feedback: evaluation.feedback ?? "",
    earlyEvaluation: evaluation.earlyEvaluation,
    criteria: {
      planningQuality: evaluation.criteria.planningQuality === null ? "" : String(evaluation.criteria.planningQuality),
      taskCompletion: evaluation.criteria.taskCompletion === null ? "" : String(evaluation.criteria.taskCompletion),
      progressConsistency: evaluation.criteria.progressConsistency === null ? "" : String(evaluation.criteria.progressConsistency),
      teamCollaboration: evaluation.criteria.teamCollaboration === null ? "" : String(evaluation.criteria.teamCollaboration),
      deadlineCommitment: evaluation.criteria.deadlineCommitment === null ? "" : String(evaluation.criteria.deadlineCommitment),
    },
  }
}

function parseCriterionValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 20) return undefined
  return parsed
}

function getCriterionFieldError(value: string, required: boolean) {
  const parsed = parseCriterionValue(value)
  if (parsed === null) return required ? "Enter a score from 0 to 20." : ""
  if (parsed === undefined) return "Use a whole number from 0 to 20."
  return ""
}

function getFeedbackFieldError(value: string, required: boolean) {
  const trimmed = value.trim()
  if (!required) return ""
  if (trimmed.length === 0) return "Add feedback before submitting."
  if (trimmed.length < 10) return "Feedback must be at least 10 characters."
  return ""
}

function calculateEvaluationScore(form: EvaluationFormState) {
  const values = EVALUATION_CRITERIA.map((criterion) => parseCriterionValue(form.criteria[criterion.key]))
  if (values.some((value) => value === null || value === undefined)) return null
  return values.reduce<number>((sum, value) => sum + Number(value), 0)
}

function validateEvaluationForm(form: EvaluationFormState, status: Extract<ApiSprintEvaluationStatus, "DRAFT" | "SUBMITTED">) {
  const isSubmitting = status === "SUBMITTED"
  const errors: EvaluationFormErrors = {}
  const criteriaEntries = EVALUATION_CRITERIA.map((criterion) => {
    const value = parseCriterionValue(form.criteria[criterion.key])
    const error = getCriterionFieldError(form.criteria[criterion.key], isSubmitting)
    if (error) errors[criterion.key] = error
    return [criterion.key, value] as const
  })

  const feedbackError = getFeedbackFieldError(form.feedback, isSubmitting)
  if (feedbackError) errors.feedback = feedbackError

  return {
    errors,
    criteriaEntries,
    isValid: Object.keys(errors).length === 0,
  }
}

function getPriorityClass(priority: ApiSprintTask["priority"]) {
  if (priority === "CRITICAL") return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
  if (priority === "HIGH") return "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300"
  if (priority === "MEDIUM") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
}

function getTaskPoints(task: ApiSprintTask) {
  return task.actualPoints ?? task.storyPoints
}

function buildDefaultSprintDates() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 13)
  return {
    startDate: toInputDate(start.toISOString()),
    endDate: toInputDate(end.toISOString()),
  }
}

function todayInputDate() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return toInputDate(today.toISOString())
}

function buildNextSprintName(sprints: ApiSprint[] = []) {
  const existingNames = new Set(sprints.map((sprint) => sprint.name.trim().toLowerCase()))
  let index = sprints.length + 1

  while (existingNames.has(`sprint ${index}`)) index += 1
  return `Sprint ${index}`
}

function validateSprintForm(form: SprintFormState, sprints: ApiSprint[] = [], editingSprintId: string | null = null) {
  const errors: SprintFormErrors = {}
  const name = form.name.trim()
  const normalizedName = name.toLowerCase()
  const existingSprint = sprints.find((sprint) => sprint.id !== editingSprintId && sprint.name.trim().toLowerCase() === normalizedName)
  const originalSprint = editingSprintId ? sprints.find((sprint) => sprint.id === editingSprintId) : null

  if (name.length < 3) errors.name = "Use at least 3 characters."
  else if (name.length > 120) errors.name = "Keep the name under 120 characters."
  else if (existingSprint) errors.name = "A sprint with this name already exists."

  if (form.goal.trim().length > 2000) errors.goal = "Keep the goal under 2,000 characters."

  if (!form.startDate) errors.startDate = "Choose a start date."
  if (!form.endDate) errors.endDate = "Choose an end date."
  if (form.startDate && form.endDate && form.endDate <= form.startDate) {
    errors.endDate = "End date must be after the start date."
  } else if (!editingSprintId && form.endDate && form.endDate < todayInputDate()) {
    errors.endDate = "End date cannot be in the past."
  } else if (form.startDate && form.endDate) {
    const overlap = sprints.find((sprint) => {
      if (sprint.id === editingSprintId) return false
      const sprintStart = toInputDate(sprint.startDate)
      const sprintEnd = toInputDate(sprint.endDate)
      return form.startDate <= sprintEnd && form.endDate >= sprintStart
    })
    if (overlap) errors.endDate = `Dates overlap with ${overlap.name}. Team sprints are sequential.`
  }

  if (!editingSprintId && form.status === "COMPLETED") {
    errors.status = "Create a sprint as planned or active first."
  }

  if (originalSprint?.status === "PLANNED" && form.status === "COMPLETED") {
    errors.status = "Start the sprint before marking it completed."
  }

  if (originalSprint?.status === "COMPLETED" && form.status !== "COMPLETED") {
    errors.status = "Completed sprints cannot be reopened."
  }

  return errors
}

function getFirstSprintFormError(errors: SprintFormErrors) {
  return errors.name ?? errors.goal ?? errors.startDate ?? errors.endDate ?? errors.status ?? errors.form ?? ""
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 p-5 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: EASE_OUT_QUINT }}
          className="text-xs font-medium text-destructive"
        >
          {message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  )
}

function SprintPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(totalItems, page * pageSize)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {start}-{end} of {totalItems} sprints
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-lg bg-transparent"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
          <Button
            key={item}
            type="button"
            variant={item === page ? "default" : "outline"}
            size="sm"
            className="h-8 min-w-8 rounded-lg px-2"
            onClick={() => onPageChange(item)}
          >
            {item}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-lg bg-transparent"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

function SprintTaskCard({
  task,
  board,
  canManage,
  isBusy,
  reduceMotion,
  onMove,
}: {
  task: ApiSprintTask
  board: ApiSprintBoard
  canManage: boolean
  isBusy: boolean
  reduceMotion: boolean
  onMove: (task: ApiSprintTask, sprintId: string) => void
}) {
  const sprintOptions = board.sprints
    .filter((sprint) => sprint.status !== "COMPLETED" || sprint.id === task.sprintId)
    .map((sprint) => ({ sprint, conflict: getTaskSprintDateConflict(task, sprint) }))
  const currentSprint = task.sprintId ? board.sprints.find((sprint) => sprint.id === task.sprintId) : null
  const currentConflict = currentSprint ? getTaskSprintDateConflict(task, currentSprint) : ""

  return (
    <motion.article
      layout
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: EASE_OUT_QUINT }}
      className={cn(
        "rounded-lg border border-border/70 bg-background/85 p-3 shadow-sm transition-[border-color,box-shadow,transform] duration-200 motion-safe:hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md",
        isBusy && "pointer-events-none opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="min-w-0 max-w-full truncate text-sm font-semibold text-foreground">{task.title}</h4>
            {task.unplanned ? (
              <Badge variant="outline" className="h-5 border-rose-500/30 bg-rose-500/10 px-1.5 text-[10px] text-rose-700 dark:text-rose-300">
                Unplanned
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{task.description || "No description"}</p>
        </div>
        <Badge variant="outline" className={cn("shrink-0 px-2 text-[10px]", getPriorityClass(task.priority))}>
          {task.priority.toLowerCase()}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className={cn("h-2 w-2 rounded-full", STATUS_COLUMNS.find((column) => column.status === task.status)?.color)} />
          {formatStatus(task.status)}
        </span>
        <span className="truncate">{task.assignee?.fullName ?? "Unassigned"}</span>
        <span>{formatTaskRange(task)}</span>
        <span>{task.storyPoints} SP estimate</span>
        {task.actualPoints !== null ? <span>{task.actualPoints} SP completed</span> : null}
        {task.githubIssueNumber ? <span>#{task.githubIssueNumber}</span> : null}
      </div>

      {currentConflict ? (
        <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <span className="font-semibold">This task cannot move here yet.</span> {currentConflict}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase text-muted-foreground">Move task to</span>
          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
        </div>
        <Select
          value={task.sprintId ?? "backlog"}
          disabled={!canManage || isBusy}
          onValueChange={(value) => onMove(task, value)}
        >
          <SelectTrigger className="h-10 w-full min-w-0 rounded-lg bg-background text-sm transition-[border-color,box-shadow] hover:border-primary/35 focus-visible:ring-primary/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-w-[320px]">
            <SelectItem value="backlog">Backlog</SelectItem>
            {sprintOptions.map(({ sprint, conflict }) => (
              <SelectItem key={sprint.id} value={sprint.id} disabled={Boolean(conflict) && sprint.id !== task.sprintId}>
                <span className="min-w-0 truncate">{sprint.name}</span>
                {conflict && sprint.id !== task.sprintId ? <span className="text-[10px] text-muted-foreground">{getTaskSprintBlockLabel(conflict)}</span> : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <Badge variant="outline" className="rounded-md px-2 text-[10px] capitalize">
          {task.taskType.toLowerCase()}
        </Badge>
        <span className="font-medium text-foreground">{task.actualPoints === null ? `${task.storyPoints} planned SP` : `${task.actualPoints}/${task.storyPoints} SP`}</span>
      </div>
    </motion.article>
  )
}

function SprintEvaluationPanel({
  sprint,
  currentUserId,
  currentUserRole,
  canEvaluate,
  canReviewEvaluations,
  actionInFlight,
  evaluationDrafts,
  evaluationErrors,
  reviewComments,
  onDraftChange,
  onReviewCommentChange,
  onSaveEvaluation,
  onReviewEvaluation,
}: {
  sprint: ApiSprint
  currentUserId?: string
  currentUserRole?: string
  canEvaluate: boolean
  canReviewEvaluations: boolean
  actionInFlight: string
  evaluationDrafts: Record<string, EvaluationFormState>
  evaluationErrors: Record<string, EvaluationFormErrors>
  reviewComments: Record<string, string>
  onDraftChange: (sprintId: string, updater: (current: EvaluationFormState) => EvaluationFormState) => void
  onReviewCommentChange: (evaluationId: string, value: string) => void
  onSaveEvaluation: (sprint: ApiSprint, status: Extract<ApiSprintEvaluationStatus, "DRAFT" | "SUBMITTED">) => void
  onReviewEvaluation: (sprint: ApiSprint, evaluation: ApiSprintEvaluation, status: Extract<ApiSprintEvaluationStatus, "APPROVED" | "REJECTED" | "NEEDS_CHANGES">) => void
}) {
  const ownEvaluationRole = currentUserRole === "ta" ? "TA" : null
  const ownEvaluation = ownEvaluationRole
    ? sprint.evaluations.find((evaluation) => evaluation.evaluatorRole === ownEvaluationRole && evaluation.evaluator?.id === currentUserId) ?? null
    : null
  const canEditOwnEvaluation = Boolean(canEvaluate && ownEvaluationRole && (!ownEvaluation || ownEvaluation.permissions.canEdit))
  const draft = evaluationDrafts[sprint.id] ?? getEvaluationFormFromEvaluation(ownEvaluation)
  const formErrors = evaluationErrors[sprint.id] ?? {}
  const calculatedScore = calculateEvaluationScore(draft)
  const isSaving = actionInFlight === `evaluation-${sprint.id}`
  const isEarlyFinal = sprint.status !== "COMPLETED"
  const isDoctorReadOnly = currentUserRole === "doctor"

  return (
    <div className={cn("mt-4 rounded-lg border p-4", isDoctorReadOnly ? "border-blue-500/20 bg-blue-500/[0.04]" : "border-border/70 bg-muted/15")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <h4 className="font-semibold">Sprint evaluation</h4>
            {isDoctorReadOnly ? (
              <Badge variant="outline" className="rounded-md border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                Read-only doctor view
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isDoctorReadOnly
              ? "Doctors can inspect TA evaluation records for their assigned teams without changing them."
              : "Assigned TAs can save drafts and submit structured sprint evaluations."}
          </p>
        </div>
        {sprint.evaluations.length > 0 ? (
          <Badge variant="outline" className="w-fit rounded-md">
            {sprint.evaluations.length} record{sprint.evaluations.length === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {sprint.evaluations.length > 0 ? (
          sprint.evaluations.map((evaluation) => (
            <div key={evaluation.id} className="rounded-lg border border-border/70 bg-background/85 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{getEvaluationRoleLabel(evaluation.evaluatorRole)}</p>
                    <Badge variant="outline" className={cn("rounded-md", getEvaluationBadgeClass(evaluation.status))}>
                      {formatEvaluationStatus(evaluation.status)}
                    </Badge>
                    {evaluation.earlyEvaluation ? (
                      <Badge variant="outline" className="rounded-md border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        Early
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {evaluation.evaluator?.fullName ?? "Unknown evaluator"}
                    {evaluation.evaluatedAt ? ` - ${formatShortDate(evaluation.evaluatedAt)}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{evaluation.score ?? "-"}</p>
                  <p className="text-[11px] uppercase text-muted-foreground">Score</p>
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {evaluation.feedback || "No written feedback yet."}
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {EVALUATION_CRITERIA.map((criterion) => (
                  <div key={criterion.key} className="rounded-lg bg-muted/35 px-3 py-2 text-sm">
                    <span className="block text-[11px] font-medium uppercase text-muted-foreground">{criterion.label}</span>
                    <span className="font-semibold">{evaluation.criteria[criterion.key] ?? "-"}/20</span>
                  </div>
                ))}
              </div>

              {evaluation.reviewedBy || evaluation.reviewComment ? (
                <div className="mt-3 rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm">
                  <p className="font-medium">Review note</p>
                  <p className="mt-1 text-muted-foreground">
                    {evaluation.reviewComment || "No review note."}
                    {evaluation.reviewedBy ? ` - ${evaluation.reviewedBy.fullName}` : ""}
                  </p>
                </div>
              ) : null}

              {canReviewEvaluations && evaluation.permissions.canReview ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={reviewComments[evaluation.id] ?? ""}
                    onChange={(event) => onReviewCommentChange(evaluation.id, event.target.value)}
                    placeholder="Optional review note"
                    className="min-h-[76px] resize-none rounded-lg"
                    disabled={Boolean(actionInFlight)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="rounded-lg"
                      disabled={Boolean(actionInFlight)}
                      onClick={() => onReviewEvaluation(sprint, evaluation, "APPROVED")}
                    >
                      {actionInFlight === `review-${evaluation.id}-APPROVED` ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                      {sprint.status === "COMPLETED" ? "Approve" : "Approve early"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg bg-transparent"
                      disabled={Boolean(actionInFlight)}
                      onClick={() => onReviewEvaluation(sprint, evaluation, "NEEDS_CHANGES")}
                    >
                      Needs changes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg border-destructive/30 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={Boolean(actionInFlight)}
                      onClick={() => onReviewEvaluation(sprint, evaluation, "REJECTED")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-border/80 p-5 text-sm text-muted-foreground lg:col-span-2">
            No evaluations recorded for this sprint yet.
          </div>
        )}
      </div>

      {canEvaluate && ownEvaluationRole ? (
        <div className="mt-4 rounded-lg border border-border/70 bg-background/90 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h5 className="font-semibold">Your TA evaluation</h5>
              <p className="text-sm text-muted-foreground">
                {canEditOwnEvaluation ? "Save a draft or submit the evaluation when it is ready." : "This evaluation has been finalized and cannot be edited here."}
              </p>
            </div>
            {ownEvaluation ? (
              <Badge variant="outline" className={cn("w-fit rounded-md", getEvaluationBadgeClass(ownEvaluation.status))}>
                {formatEvaluationStatus(ownEvaluation.status)}
              </Badge>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
            <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Total score</p>
              <p className="mt-1 text-3xl font-bold">{calculatedScore ?? "-"}/100</p>
              <p className="mt-1 text-xs text-muted-foreground">Calculated from the five criteria.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`evaluation-feedback-${sprint.id}`}>Feedback</Label>
              <Textarea
                id={`evaluation-feedback-${sprint.id}`}
                value={draft.feedback}
                disabled={!canEditOwnEvaluation || isSaving}
                onChange={(event) =>
                  onDraftChange(sprint.id, (current) => ({ ...current, feedback: event.target.value }))
                }
                className="min-h-[92px] resize-none rounded-lg"
                placeholder="Comment on execution quality, blockers, and next sprint focus."
              />
              <FieldError message={formErrors.feedback} />
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {EVALUATION_CRITERIA.map((criterion) => {
              const liveError = getCriterionFieldError(draft.criteria[criterion.key], false)
              const message = liveError || (draft.criteria[criterion.key].trim() === "" ? formErrors[criterion.key] : "")

              return (
                <label key={criterion.key} className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">{criterion.label}</span>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={draft.criteria[criterion.key]}
                    disabled={!canEditOwnEvaluation || isSaving}
                    onChange={(event) =>
                      onDraftChange(sprint.id, (current) => ({
                        ...current,
                        criteria: { ...current.criteria, [criterion.key]: event.target.value },
                      }))
                    }
                    className={cn("h-10 rounded-lg", message && "border-destructive focus-visible:ring-destructive/20")}
                    placeholder="/20"
                  />
                  <FieldError message={message} />
                </label>
              )
            })}
          </div>

          {isEarlyFinal ? (
            <label className="mt-3 flex min-w-0 items-start gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm">
              <Checkbox
                checked={draft.earlyEvaluation}
                disabled={!canEditOwnEvaluation || isSaving}
                onCheckedChange={(checked) =>
                  onDraftChange(sprint.id, (current) => ({ ...current, earlyEvaluation: checked === true }))
                }
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium text-amber-800 dark:text-amber-200">Mark as early evaluation</span>
                <span className="text-xs text-amber-800/80 dark:text-amber-200/80">
                  Use this when the evaluation is prepared before the sprint is completed.
                </span>
              </span>
            </label>
          ) : null}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <FieldError message={formErrors.form} />
            <Button
              variant="outline"
              className="rounded-lg bg-transparent"
              disabled={!canEditOwnEvaluation || isSaving}
              onClick={() => onSaveEvaluation(sprint, "DRAFT")}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save draft
            </Button>
            <Button
              variant="default"
              className="rounded-lg"
              disabled={!canEditOwnEvaluation || isSaving}
              onClick={() => onSaveEvaluation(sprint, "SUBMITTED")}
            >
              Submit
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SprintGroup({
  sprint,
  board,
  canManage,
  currentUserId,
  currentUserRole,
  canEvaluate,
  canReviewEvaluations,
  isSelected,
  actionInFlight,
  evaluationDrafts,
  evaluationErrors,
  reviewComments,
  reduceMotion,
  onSelect,
  onEdit,
  onDeleteRequest,
  onStart,
  onComplete,
  onMove,
  onEvaluationDraftChange,
  onReviewCommentChange,
  onSaveEvaluation,
  onReviewEvaluation,
}: {
  sprint: ApiSprint
  board: ApiSprintBoard
  canManage: boolean
  currentUserId?: string
  currentUserRole?: string
  canEvaluate: boolean
  canReviewEvaluations: boolean
  isSelected: boolean
  actionInFlight: string
  evaluationDrafts: Record<string, EvaluationFormState>
  evaluationErrors: Record<string, EvaluationFormErrors>
  reviewComments: Record<string, string>
  reduceMotion: boolean
  onSelect: (id: string) => void
  onEdit: (sprint: ApiSprint) => void
  onDeleteRequest: (sprint: ApiSprint) => void
  onStart: (id: string) => void
  onComplete: (id: string) => void
  onMove: (task: ApiSprintTask, sprintId: string) => void
  onEvaluationDraftChange: (sprintId: string, updater: (current: EvaluationFormState) => EvaluationFormState) => void
  onReviewCommentChange: (evaluationId: string, value: string) => void
  onSaveEvaluation: (sprint: ApiSprint, status: Extract<ApiSprintEvaluationStatus, "DRAFT" | "SUBMITTED">) => void
  onReviewEvaluation: (sprint: ApiSprint, evaluation: ApiSprintEvaluation, status: Extract<ApiSprintEvaluationStatus, "APPROVED" | "REJECTED" | "NEEDS_CHANGES">) => void
}) {
  const isStarting = actionInFlight === `start-${sprint.id}`
  const isCompleting = actionInFlight === `complete-${sprint.id}`
  const isEditing = actionInFlight === `edit-${sprint.id}`
  const isDeleting = actionInFlight === `delete-${sprint.id}`

  return (
    <motion.section
      layout
      transition={{ duration: reduceMotion ? 0 : 0.25, ease: EASE_OUT_QUINT }}
      className={cn(
        "rounded-lg border bg-background/70 transition-[border-color,box-shadow] duration-200 hover:shadow-sm",
        isSelected ? "border-primary/45 shadow-sm ring-1 ring-primary/10" : "border-border/70"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(sprint.id)}
        className="flex w-full flex-col gap-3 rounded-t-lg p-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 sm:flex-row sm:items-center sm:justify-between"
        aria-pressed={isSelected}
        aria-label={`Select ${sprint.name}`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{sprint.name}</h3>
            <Badge variant="outline" className={cn("rounded-md", getSprintBadgeClass(sprint.status))}>
              {formatSprintStatus(sprint.status)}
            </Badge>
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{sprint.goal || "No sprint goal yet"}</p>
        </div>
        <div className="grid w-full min-w-0 gap-1 sm:w-auto sm:min-w-[260px]">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatSprintRange(sprint)}</span>
            <span>{sprint.stats.completedStoryPoints}/{sprint.stats.totalStoryPoints} SP</span>
          </div>
          <Progress value={sprint.stats.progress} className="h-2" />
        </div>
      </button>

      <div className="border-t border-border/70 px-4 py-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{sprint.stats.totalTasks} tasks</span>
            <span>{sprint.stats.unplannedTasks} unplanned</span>
            <span>{sprint.stats.progress}% complete</span>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg bg-transparent"
                onClick={() => onEdit(sprint)}
                disabled={Boolean(actionInFlight)}
              >
                {isEditing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Pencil className="mr-1.5 h-3.5 w-3.5" />}
                Edit
              </Button>
              {sprint.status === "PLANNED" ? (
                <Button size="sm" variant="outline" className="h-8 rounded-lg bg-transparent" onClick={() => onStart(sprint.id)} disabled={Boolean(actionInFlight)}>
                  {isStarting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                  Start
                </Button>
              ) : null}
              {sprint.status === "ACTIVE" ? (
                <Button size="sm" className="h-8 rounded-lg" onClick={() => onComplete(sprint.id)} disabled={Boolean(actionInFlight)}>
                  {isCompleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                  Complete
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg border-destructive/30 bg-transparent text-destructive transition-[background-color,border-color,transform] hover:border-destructive/45 hover:bg-destructive/10 hover:text-destructive motion-safe:hover:-translate-y-0.5"
                onClick={() => onDeleteRequest(sprint)}
                disabled={Boolean(actionInFlight)}
              >
                {isDeleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                Delete
              </Button>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {sprint.tasks.length > 0 ? (
            sprint.tasks.map((task) => (
              <SprintTaskCard
                key={task.id}
                task={task}
                board={board}
                canManage={canManage}
                isBusy={actionInFlight === `move-${task.id}` || actionInFlight === `meta-${task.id}`}
                reduceMotion={reduceMotion}
                onMove={onMove}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border/80 p-5 text-sm text-muted-foreground">
              No tasks in this sprint yet.
            </div>
          )}
        </div>

        <SprintEvaluationPanel
          sprint={sprint}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          canEvaluate={canEvaluate}
          canReviewEvaluations={canReviewEvaluations}
          actionInFlight={actionInFlight}
          evaluationDrafts={evaluationDrafts}
          evaluationErrors={evaluationErrors}
          reviewComments={reviewComments}
          onDraftChange={onEvaluationDraftChange}
          onReviewCommentChange={onReviewCommentChange}
          onSaveEvaluation={onSaveEvaluation}
          onReviewEvaluation={onReviewEvaluation}
        />
      </div>
    </motion.section>
  )
}

export default function SprintsPage() {
  const shouldReduceMotion = useReducedMotion()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentUser } = useAuthStore()
  const { data: myTeamState, isLoading: isTeamLoading } = useMyTeamState()
  const isSupportView = currentUser?.role === "doctor" || currentUser?.role === "ta" || currentUser?.role === "admin"
  const isSupervisorView = currentUser?.role === "doctor" || currentUser?.role === "ta"
  const requestedTeamId = searchParams.get("teamId")
  const [assignedTeams, setAssignedTeams] = useState<ApiTeamSummary[]>([])
  const [isAssignedTeamsLoading, setIsAssignedTeamsLoading] = useState(false)
  const [assignedTeamsError, setAssignedTeamsError] = useState("")
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [board, setBoard] = useState<ApiSprintBoard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null)
  const [sprintPage, setSprintPage] = useState(1)
  const [activeTab, setActiveTab] = useState("board")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [sprintDialogMode, setSprintDialogMode] = useState<SprintDialogMode>("create")
  const [editingSprintId, setEditingSprintId] = useState<string | null>(null)
  const [sprintPendingDelete, setSprintPendingDelete] = useState<ApiSprint | null>(null)
  const [sprintForm, setSprintForm] = useState<SprintFormState>(DEFAULT_SPRINT_FORM)
  const [hasSubmittedSprintForm, setHasSubmittedSprintForm] = useState(false)
  const [evaluationDrafts, setEvaluationDrafts] = useState<Record<string, EvaluationFormState>>({})
  const [evaluationErrors, setEvaluationErrors] = useState<Record<string, EvaluationFormErrors>>({})
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({})
  const [actionInFlight, setActionInFlight] = useState("")

  const activeTeamId = isSupportView ? selectedTeamId : myTeamState?.team?.id
  const selectedTeam = useMemo(() => {
    if (!isSupportView || !selectedTeamId) return null
    return assignedTeams.find((team) => team.id === selectedTeamId) ?? null
  }, [assignedTeams, isSupportView, selectedTeamId])

  useEffect(() => {
    if (!isSupportView) {
      setAssignedTeams([])
      setSelectedTeamId(null)
      return
    }

    let cancelled = false
    setIsAssignedTeamsLoading(true)
    setAssignedTeamsError("")

    sprintsApi
      .assignedTeams()
      .then((teams) => {
        if (cancelled) return
        setAssignedTeams(teams)
        setSelectedTeamId((current) => {
          if (requestedTeamId && teams.some((team) => team.id === requestedTeamId)) return requestedTeamId
          if (current && teams.some((team) => team.id === current)) return current
          return teams[0]?.id ?? null
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setAssignedTeams([])
        setSelectedTeamId(null)
        setAssignedTeamsError(error instanceof Error ? error.message : "Couldn't load assigned teams.")
      })
      .finally(() => {
        if (!cancelled) setIsAssignedTeamsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isSupportView, requestedTeamId])

  const loadBoard = useCallback(async () => {
    if (!activeTeamId) {
      if (!isTeamLoading && !isAssignedTeamsLoading) {
        setBoard(null)
        setIsLoading(false)
      }
      return
    }

    setIsLoading(true)
    setLoadError("")
    try {
      const result = await sprintsApi.board({ teamId: activeTeamId })
      setBoard(result)
      setSelectedSprintId((current) => {
        if (current && result.sprints.some((sprint) => sprint.id === current)) return current
        return result.metrics.activeSprintId ?? result.sprints[0]?.id ?? null
      })
      setEvaluationDrafts({})
      setEvaluationErrors({})
      setReviewComments({})
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : "Couldn't load sprints right now.")
    } finally {
      setIsLoading(false)
    }
  }, [activeTeamId, isAssignedTeamsLoading, isTeamLoading])

  useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  const selectedSprint = useMemo(() => {
    if (!board) return null
    return board.sprints.find((sprint) => sprint.id === selectedSprintId) ?? board.sprints.find((sprint) => sprint.status === "ACTIVE") ?? board.sprints[0] ?? null
  }, [board, selectedSprintId])

  const canManage = Boolean(board?.permissions.canManage)
  const canEvaluate = Boolean(board?.permissions.canEvaluate)
  const canReviewEvaluations = Boolean(board?.permissions.canReviewEvaluations)
  const sprintTotalPages = Math.max(1, Math.ceil((board?.sprints.length ?? 0) / SPRINTS_PER_PAGE))
  const paginatedSprints = useMemo(() => {
    const sprints = board?.sprints ?? []
    return sprints.slice((sprintPage - 1) * SPRINTS_PER_PAGE, sprintPage * SPRINTS_PER_PAGE)
  }, [board?.sprints, sprintPage])

  useEffect(() => {
    setSprintPage(1)
  }, [activeTeamId])

  useEffect(() => {
    setSprintPage((current) => Math.min(current, sprintTotalPages))
  }, [sprintTotalPages])

  const kanbanTasksByStatus = useMemo(() => {
    const tasks = selectedSprint?.tasks ?? []
    return STATUS_COLUMNS.map((column) => ({
      ...column,
      tasks: tasks.filter((task) => task.status === column.status),
    }))
  }, [selectedSprint?.tasks])

  const editingSprint = useMemo(() => {
    if (!board || !editingSprintId) return null
    return board.sprints.find((sprint) => sprint.id === editingSprintId) ?? null
  }, [board, editingSprintId])

  const sprintFormErrors = useMemo(
    () => validateSprintForm(sprintForm, board?.sprints ?? [], editingSprintId),
    [board?.sprints, editingSprintId, sprintForm],
  )
  const sprintFormError = getFirstSprintFormError(sprintFormErrors)
  const shouldShowSprintErrors = hasSubmittedSprintForm || Boolean(sprintFormError && sprintForm.name.trim())
  const shownSprintErrors = shouldShowSprintErrors ? sprintFormErrors : {}
  const isSprintFormValid = !sprintFormError

  const statusChartData = board?.metrics.statusDistribution.map((item) => ({
    name: formatStatus(item.status),
    value: item.count,
    storyPoints: item.storyPoints,
    status: item.status,
  })) ?? []
  const hasStatusChartData = statusChartData.some((item) => item.value > 0)

  function selectSprintAndPage(sprintId: string) {
    setSelectedSprintId(sprintId)
    const index = board?.sprints.findIndex((sprint) => sprint.id === sprintId) ?? -1
    if (index >= 0) setSprintPage(Math.floor(index / SPRINTS_PER_PAGE) + 1)
  }

  function handleSprintPageChange(page: number) {
    setSprintPage(page)
    const sprint = board?.sprints[(page - 1) * SPRINTS_PER_PAGE]
    if (sprint) setSelectedSprintId(sprint.id)
  }

  const isSavingSprint = actionInFlight === "create" || (editingSprintId ? actionInFlight === `edit-${editingSprintId}` : false)
  const isDeletingSprint = sprintPendingDelete ? actionInFlight === `delete-${sprintPendingDelete.id}` : false
  const sprintStatusOptions = useMemo(() => {
    if (sprintDialogMode === "create") {
      return [
        { value: "PLANNED" as ApiSprintStatus, label: "Planned" },
        { value: "ACTIVE" as ApiSprintStatus, label: "Active" },
      ]
    }

    if (editingSprint?.status === "COMPLETED") {
      return [{ value: "COMPLETED" as ApiSprintStatus, label: "Completed" }]
    }

    if (editingSprint?.status === "ACTIVE") {
      return [
        { value: "ACTIVE" as ApiSprintStatus, label: "Active" },
        { value: "COMPLETED" as ApiSprintStatus, label: "Completed" },
      ]
    }

    return [
      { value: "PLANNED" as ApiSprintStatus, label: "Planned" },
      { value: "ACTIVE" as ApiSprintStatus, label: "Active" },
    ]
  }, [editingSprint?.status, sprintDialogMode])

  function openCreateDialog() {
    const dates = buildDefaultSprintDates()
    setSprintDialogMode("create")
    setEditingSprintId(null)
    setHasSubmittedSprintForm(false)
    setSprintForm({
      ...DEFAULT_SPRINT_FORM,
      name: buildNextSprintName(board?.sprints ?? []),
      ...dates,
    })
    setCreateDialogOpen(true)
  }

  function openEditDialog(sprint: ApiSprint) {
    setSprintDialogMode("edit")
    setEditingSprintId(sprint.id)
    setHasSubmittedSprintForm(false)
    setSprintForm({
      name: sprint.name,
      goal: sprint.goal,
      startDate: toInputDate(sprint.startDate),
      endDate: toInputDate(sprint.endDate),
      status: sprint.status,
    })
    setCreateDialogOpen(true)
  }

  function closeSprintDialog() {
    setCreateDialogOpen(false)
    setEditingSprintId(null)
    setSprintDialogMode("create")
    setHasSubmittedSprintForm(false)
    setSprintForm(DEFAULT_SPRINT_FORM)
  }

  async function handleSaveSprint() {
    if (actionInFlight) return
    if (!activeTeamId) return
    setHasSubmittedSprintForm(true)
    const nextErrors = validateSprintForm(sprintForm, board?.sprints ?? [], editingSprintId)
    const validationError = getFirstSprintFormError(nextErrors)
    if (validationError) {
      return
    }

    toast.dismiss()
    const actionKey = sprintDialogMode === "edit" && editingSprintId ? `edit-${editingSprintId}` : "create"
    setActionInFlight(actionKey)
    try {
      if (sprintDialogMode === "edit" && editingSprintId) {
        const updated = await sprintsApi.update(editingSprintId, {
          name: sprintForm.name.trim(),
          goal: sprintForm.goal.trim(),
          startDate: sprintForm.startDate,
          endDate: sprintForm.endDate,
          status: sprintForm.status,
        })
        setSelectedSprintId(updated.id)
        toast.success("Sprint updated")
      } else {
        const created = await sprintsApi.create({
          teamId: activeTeamId,
          name: sprintForm.name.trim(),
          goal: sprintForm.goal.trim(),
          startDate: sprintForm.startDate,
          endDate: sprintForm.endDate,
          status: sprintForm.status,
        })
        setSelectedSprintId(created.id)
        toast.success("Sprint created")
      }
      closeSprintDialog()
      await loadBoard()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : sprintDialogMode === "edit" ? "Couldn't update sprint" : "Couldn't create sprint")
    } finally {
      setActionInFlight("")
    }
  }

  async function handleStartSprint(id: string) {
    setActionInFlight(`start-${id}`)
    try {
      await sprintsApi.start(id)
      toast.success("Sprint started")
      await loadBoard()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Couldn't start sprint")
    } finally {
      setActionInFlight("")
    }
  }

  async function handleCompleteSprint(id: string) {
    setActionInFlight(`complete-${id}`)
    try {
      await sprintsApi.complete(id)
      toast.success("Sprint completed")
      await loadBoard()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Couldn't complete sprint")
    } finally {
      setActionInFlight("")
    }
  }

  async function handleDeleteSprint() {
    if (!sprintPendingDelete || actionInFlight) return

    const sprint = sprintPendingDelete
    setActionInFlight(`delete-${sprint.id}`)
    try {
      const result = await sprintsApi.delete(sprint.id)
      setSelectedSprintId((current) => (current === sprint.id ? null : current))
      setSprintPendingDelete(null)
      toast.success(result.releasedTasks > 0 ? `Sprint deleted. ${result.releasedTasks} tasks returned to backlog.` : "Sprint deleted")
      await loadBoard()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete sprint")
    } finally {
      setActionInFlight("")
    }
  }

  async function handleMoveTask(task: ApiSprintTask, sprintId: string) {
    if ((sprintId === "backlog" && !task.sprintId) || sprintId === task.sprintId) return

    setActionInFlight(`move-${task.id}`)
    try {
      if (sprintId === "backlog") {
        await sprintsApi.moveTaskToBacklog(task.id)
        toast.success("Task moved to backlog")
      } else {
        const sprint = board?.sprints.find((item) => item.id === sprintId)
        const conflict = sprint ? getTaskSprintDateConflict(task, sprint) : ""
        if (conflict) {
          toast.error(conflict)
          return
        }

        await sprintsApi.assignTask(sprintId, task.id, {
          storyPoints: task.storyPoints,
          actualPoints: task.actualPoints,
          unplanned: task.sprintId ? task.unplanned : true,
        })
        toast.success("Task added to sprint")
      }
      await loadBoard()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Couldn't move task")
    } finally {
      setActionInFlight("")
    }
  }

  function handleEvaluationDraftChange(sprintId: string, updater: (current: EvaluationFormState) => EvaluationFormState) {
    setEvaluationErrors((current) => {
      if (!current[sprintId]) return current
      const next = { ...current }
      delete next[sprintId]
      return next
    })
    setEvaluationDrafts((current) => {
      const sprint = board?.sprints.find((item) => item.id === sprintId)
      const ownRole = currentUser?.role === "ta" ? "TA" : null
      const ownEvaluation = ownRole
        ? sprint?.evaluations.find((evaluation) => evaluation.evaluatorRole === ownRole && evaluation.evaluator?.id === currentUser?.id)
        : null
      const base = current[sprintId] ?? getEvaluationFormFromEvaluation(ownEvaluation)
      return { ...current, [sprintId]: updater(base) }
    })
  }

  function handleReviewCommentChange(evaluationId: string, value: string) {
    setReviewComments((current) => ({ ...current, [evaluationId]: value }))
  }

  async function handleSaveEvaluation(
    sprint: ApiSprint,
    status: Extract<ApiSprintEvaluationStatus, "DRAFT" | "SUBMITTED">,
  ) {
    if (actionInFlight) return
    if (currentUser?.role !== "ta") {
      toast.error("Only assigned TAs can edit sprint evaluations.")
      return
    }

    const ownRole = currentUser?.role === "ta" ? "TA" : null
    const ownEvaluation = ownRole
      ? sprint.evaluations.find((evaluation) => evaluation.evaluatorRole === ownRole && evaluation.evaluator?.id === currentUser?.id)
      : null
    const draft = evaluationDrafts[sprint.id] ?? getEvaluationFormFromEvaluation(ownEvaluation)
    const validation = validateEvaluationForm(draft, status)
    if (!validation.isValid) {
      setEvaluationErrors((current) => ({ ...current, [sprint.id]: validation.errors }))
      toast.error(status === "SUBMITTED" ? "Complete the highlighted evaluation fields before submitting." : "Fix the highlighted criteria scores before saving.")
      return
    }

    setActionInFlight(`evaluation-${sprint.id}`)
    try {
      await sprintsApi.saveEvaluation(sprint.id, {
        status,
        feedback: draft.feedback.trim(),
        earlyEvaluation: draft.earlyEvaluation,
        criteria: Object.fromEntries(validation.criteriaEntries) as Partial<ApiSprintEvaluationCriteria>,
      })
      setEvaluationErrors((current) => {
        const next = { ...current }
        delete next[sprint.id]
        return next
      })
      toast.success(status === "DRAFT" ? "Evaluation draft saved" : "Evaluation submitted")
      await loadBoard()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Couldn't save sprint evaluation"
      setEvaluationErrors((current) => ({ ...current, [sprint.id]: { ...(current[sprint.id] ?? {}), form: message } }))
      toast.error(message)
    } finally {
      setActionInFlight("")
    }
  }

  async function handleReviewEvaluation(
    sprint: ApiSprint,
    evaluation: ApiSprintEvaluation,
    status: Extract<ApiSprintEvaluationStatus, "APPROVED" | "REJECTED" | "NEEDS_CHANGES">,
  ) {
    if (actionInFlight) return
    setActionInFlight(`review-${evaluation.id}-${status}`)
    try {
      await sprintsApi.reviewEvaluation(sprint.id, evaluation.id, {
        status,
        reviewComment: reviewComments[evaluation.id]?.trim() || undefined,
        earlyEvaluation: status === "APPROVED" && sprint.status !== "COMPLETED" ? true : undefined,
      })
      toast.success(status === "APPROVED" ? "Evaluation approved" : status === "NEEDS_CHANGES" ? "Changes requested" : "Evaluation rejected")
      await loadBoard()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Couldn't review sprint evaluation")
    } finally {
      setActionInFlight("")
    }
  }

  return (
    <TeamRequiredGuard
      pageName="Sprints"
      pageDescription="Plan, track, and visualize sprint work for your team."
      icon={<Layers3 className="h-10 w-10 text-primary" />}
    >
      <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.35, ease: EASE_OUT_QUINT }}
          className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-md border-primary/25 bg-primary/10 text-primary">
                Sprint workspace
              </Badge>
              {board?.metrics.activeSprintName ? (
                <Badge variant="outline" className="rounded-md border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  Active: {board.metrics.activeSprintName}
                </Badge>
              ) : null}
              {isSupportView && selectedTeam ? (
                <Badge variant="outline" className="rounded-md border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                  Viewing: {selectedTeam.name}
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Sprints</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              {isSupervisorView
                ? "Review assigned team sprints, inspect progress, and evaluate sprint outcomes without changing student planning work."
                : "Plan sprint goals, pull tasks from your team backlog, and watch progress through burndown, velocity, and workload charts."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-lg bg-transparent" onClick={() => void loadBoard()} disabled={isLoading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
            {canManage ? (
              <Button className="rounded-lg shadow-sm transition-transform motion-safe:hover:-translate-y-0.5" onClick={openCreateDialog} disabled={Boolean(actionInFlight)}>
                <Plus className="mr-2 h-4 w-4" />
                New Sprint
              </Button>
            ) : null}
          </div>
        </motion.div>

        {isSupportView ? (
          <Card className="rounded-lg border-border/70 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Team supervision filter</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select one assigned team to load its sprints, tasks, progress, and evaluation records.
                </p>
              </div>
              <div className="w-full lg:max-w-sm">
                <Label htmlFor="sprint-team-filter" className="mb-2 block">
                  Current team
                </Label>
                <Select
                  value={selectedTeamId ?? ""}
                  onValueChange={(value) => {
                    setSelectedTeamId(value)
                    setSelectedSprintId(null)
                    setSprintPage(1)
                    setBoard(null)
                    router.replace(`/dashboard/sprints?teamId=${value}`, { scroll: false })
                  }}
                  disabled={isAssignedTeamsLoading || assignedTeams.length === 0}
                >
                  <SelectTrigger id="sprint-team-filter" className="h-11 rounded-lg">
                    <SelectValue placeholder={isAssignedTeamsLoading ? "Loading teams..." : "Select a team"} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignedTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selectedTeam ? (
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-lg bg-muted/35 px-3 py-2">
                  <span className="block text-xs font-medium uppercase text-muted-foreground">Leader</span>
                  <span className="font-semibold">{selectedTeam.leader.fullName}</span>
                </div>
                <div className="rounded-lg bg-muted/35 px-3 py-2">
                  <span className="block text-xs font-medium uppercase text-muted-foreground">Doctor</span>
                  <span className="font-semibold">{selectedTeam.doctor?.fullName ?? "Not assigned"}</span>
                </div>
                <div className="rounded-lg bg-muted/35 px-3 py-2">
                  <span className="block text-xs font-medium uppercase text-muted-foreground">TA</span>
                  <span className="font-semibold">{selectedTeam.ta?.fullName ?? "Not assigned"}</span>
                </div>
              </div>
            ) : null}
          </Card>
        ) : null}

        <AnimatePresence>
          {loadError || assignedTeamsError ? (
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: EASE_OUT_QUINT }}
            >
              <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {loadError || assignedTeamsError}
                </div>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {isLoading || isAssignedTeamsLoading ? (
          <Card className="flex min-h-[360px] items-center justify-center rounded-lg p-8">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {isAssignedTeamsLoading ? "Loading assigned teams" : "Loading sprints"}
            </div>
          </Card>
        ) : isSupportView && assignedTeams.length === 0 ? (
          <Card className="flex min-h-[360px] items-center justify-center rounded-lg border-dashed p-8 text-center">
            <div className="max-w-md">
              <Award className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">No assigned teams</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You will see sprint boards here after a team assigns you as its {currentUser?.role === "doctor" ? "doctor" : "TA"}.
              </p>
            </div>
          </Card>
        ) : board ? (
          <>
            <motion.div
              initial={shouldReduceMotion ? false : "hidden"}
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { staggerChildren: 0.06 } },
              }}
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
            >
              <motion.div
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.28, ease: EASE_OUT_QUINT }}
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              >
              <Card className="h-full rounded-lg p-4 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Active progress</p>
                    <p className="mt-2 text-3xl font-bold">{board.metrics.activeProgress}%</p>
                  </div>
                  <Gauge className="h-8 w-8 text-emerald-600" />
                </div>
                <Progress value={board.metrics.activeProgress} className="mt-4 h-2" />
              </Card>
              </motion.div>
              <motion.div
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.28, ease: EASE_OUT_QUINT }}
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              >
              <Card className="h-full rounded-lg p-4 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Evaluations</p>
                    <p className="mt-2 text-3xl font-bold">{board.metrics.evaluations.averageScore ?? "-"}</p>
                  </div>
                  <Award className="h-8 w-8 text-amber-600" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {currentUser?.role === "doctor"
                    ? `${board.metrics.evaluations.submitted} submitted, ${board.metrics.evaluations.approved} approved`
                    : `${board.metrics.evaluations.approved} approved, ${board.metrics.evaluations.submitted} pending review`}
                </p>
              </Card>
              </motion.div>
              <motion.div
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.28, ease: EASE_OUT_QUINT }}
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              >
              <Card className="h-full rounded-lg p-4 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Backlog</p>
                    <p className="mt-2 text-3xl font-bold">{board.metrics.backlogCount}</p>
                  </div>
                  <ClipboardList className="h-8 w-8 text-blue-600" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{board.metrics.backlogStoryPoints} story points waiting</p>
              </Card>
              </motion.div>
              <motion.div
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.28, ease: EASE_OUT_QUINT }}
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              >
              <Card className="h-full rounded-lg p-4 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Velocity</p>
                    <p className="mt-2 text-3xl font-bold">{board.metrics.velocity.at(-1)?.completedStoryPoints ?? 0}</p>
                  </div>
                  <Sparkles className="h-8 w-8 text-violet-600" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">completed SP in the latest tracked sprint</p>
              </Card>
              </motion.div>
              <motion.div
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.28, ease: EASE_OUT_QUINT }}
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              >
              <Card className="h-full rounded-lg p-4 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Needs attention</p>
                    <p className="mt-2 text-3xl font-bold">{board.metrics.overdueTasks}</p>
                  </div>
                  <Flag className="h-8 w-8 text-rose-600" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">overdue tasks outside Done</p>
              </Card>
              </motion.div>
            </motion.div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="max-w-full justify-start overflow-x-auto rounded-lg">
                <TabsTrigger value="board" className="gap-2 rounded-md">
                  <Layers3 className="h-4 w-4" />
                  Sprint board
                </TabsTrigger>
                <TabsTrigger value="kanban" className="gap-2 rounded-md">
                  <ListTodo className="h-4 w-4" />
                  Sprint Kanban
                </TabsTrigger>
                <TabsTrigger value="evaluations" className="gap-2 rounded-md">
                  <Award className="h-4 w-4" />
                  Evaluations
                </TabsTrigger>
                <TabsTrigger value="insights" className="gap-2 rounded-md">
                  <BarChart3 className="h-4 w-4" />
                  Insights
                </TabsTrigger>
              </TabsList>

              <TabsContent value="board" className="space-y-4">
                <section className="rounded-lg border border-border/70 bg-background/70">
                  <div className="flex flex-col gap-2 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Backlog</h2>
                      <p className="text-sm text-muted-foreground">All newly created website tasks appear here until they are placed into a sprint.</p>
                    </div>
                    <Badge variant="outline" className="w-fit rounded-md">
                      {board.backlogTasks.length} tasks
                    </Badge>
                  </div>
                  <div className="grid gap-3 p-4 lg:grid-cols-2 xl:grid-cols-3">
                    {board.backlogTasks.length > 0 ? (
                      board.backlogTasks.map((task) => (
                        <SprintTaskCard
                          key={task.id}
                          task={task}
                          board={board}
                          canManage={canManage}
                          isBusy={actionInFlight === `move-${task.id}` || actionInFlight === `meta-${task.id}`}
                          reduceMotion={Boolean(shouldReduceMotion)}
                          onMove={handleMoveTask}
                        />
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/80 p-5 text-sm text-muted-foreground">
                        The backlog is clear.
                      </div>
                    )}
                  </div>
                </section>

                <div className="space-y-4">
                  {board.sprints.length > 0 ? (
                    <>
                      {paginatedSprints.map((sprint) => (
                        <SprintGroup
                          key={sprint.id}
                          sprint={sprint}
                          board={board}
                          canManage={canManage}
                          currentUserId={currentUser?.id}
                          currentUserRole={currentUser?.role}
                          canEvaluate={canEvaluate}
                          canReviewEvaluations={canReviewEvaluations}
                          isSelected={selectedSprint?.id === sprint.id}
                          actionInFlight={actionInFlight}
                          evaluationDrafts={evaluationDrafts}
                          evaluationErrors={evaluationErrors}
                          reviewComments={reviewComments}
                          reduceMotion={Boolean(shouldReduceMotion)}
                          onSelect={selectSprintAndPage}
                          onEdit={openEditDialog}
                          onDeleteRequest={setSprintPendingDelete}
                          onStart={handleStartSprint}
                          onComplete={handleCompleteSprint}
                          onMove={handleMoveTask}
                          onEvaluationDraftChange={handleEvaluationDraftChange}
                          onReviewCommentChange={handleReviewCommentChange}
                          onSaveEvaluation={handleSaveEvaluation}
                          onReviewEvaluation={handleReviewEvaluation}
                        />
                      ))}
                      <SprintPagination
                        page={sprintPage}
                        totalPages={sprintTotalPages}
                        totalItems={board.sprints.length}
                        pageSize={SPRINTS_PER_PAGE}
                        onPageChange={handleSprintPageChange}
                      />
                    </>
                  ) : (
                    <Card className="rounded-lg p-8 text-center">
                      <Target className="mx-auto h-10 w-10 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-semibold">{isSupportView ? "No sprints found for this team" : "No sprints yet"}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {isSupportView ? "When students create sprints, they will appear here for supervision." : "Create your first sprint to group backlog tasks into an iteration."}
                      </p>
                      {canManage ? (
                        <Button className="mx-auto mt-5 rounded-lg" onClick={openCreateDialog} disabled={Boolean(actionInFlight)}>
                          <Plus className="mr-2 h-4 w-4" />
                          New Sprint
                        </Button>
                      ) : null}
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="kanban" className="space-y-4">
                <Card className="rounded-lg p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{selectedSprint?.name ?? "No sprint selected"}</h2>
                      <p className="text-sm text-muted-foreground">{selectedSprint ? formatSprintRange(selectedSprint) : "Create or select a sprint first."}</p>
                    </div>
                    {selectedSprint ? (
                      <Select value={selectedSprint.id} onValueChange={selectSprintAndPage}>
                        <SelectTrigger className="w-full rounded-lg sm:w-[260px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {board.sprints.map((sprint) => (
                            <SelectItem key={sprint.id} value={sprint.id}>
                              {sprint.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                </Card>

                <div className="grid gap-3 xl:grid-cols-5">
                  {kanbanTasksByStatus.map((column) => {
                    const Icon = column.icon
                    return (
                      <section key={column.status} className="rounded-lg border border-border/70 bg-background/70">
                        <div className="flex items-center justify-between border-b border-border/70 p-3">
                          <div className="flex items-center gap-2">
                            <span className={cn("flex h-7 w-7 items-center justify-center rounded-md text-white", column.color)}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <div>
                              <h3 className="text-sm font-semibold">{column.label}</h3>
                              <p className="text-[11px] text-muted-foreground">{column.tasks.length} tasks</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3 p-3">
                          {column.tasks.length > 0 ? (
                            column.tasks.map((task) => (
                              <SprintTaskCard
                                key={task.id}
                                task={task}
                                board={board}
                                canManage={canManage}
                                isBusy={actionInFlight === `move-${task.id}` || actionInFlight === `meta-${task.id}`}
                                reduceMotion={Boolean(shouldReduceMotion)}
                                onMove={handleMoveTask}
                              />
                            ))
                          ) : (
                            <div className="rounded-lg border border-dashed border-border/70 p-4 text-xs text-muted-foreground">No cards</div>
                          )}
                        </div>
                      </section>
                    )
                  })}
                </div>
              </TabsContent>

              <TabsContent value="evaluations" className="space-y-4">
                {board.sprints.length > 0 ? (
                  <>
                    {paginatedSprints.map((sprint) => (
                      <Card key={sprint.id} className="rounded-lg border-border/70 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-lg font-semibold">{sprint.name}</h2>
                              <Badge variant="outline" className={cn("rounded-md", getSprintBadgeClass(sprint.status))}>
                                {formatSprintStatus(sprint.status)}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {formatSprintRange(sprint)} - {sprint.stats.progress}% complete - {sprint.stats.completedTasks}/{sprint.stats.totalTasks} tasks done
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            className="w-fit rounded-lg bg-transparent"
                            onClick={() => {
                              selectSprintAndPage(sprint.id)
                              setActiveTab("board")
                            }}
                          >
                            View on board
                          </Button>
                        </div>
                        <SprintEvaluationPanel
                          sprint={sprint}
                          currentUserId={currentUser?.id}
                          currentUserRole={currentUser?.role}
                          canEvaluate={canEvaluate}
                          canReviewEvaluations={canReviewEvaluations}
                          actionInFlight={actionInFlight}
                          evaluationDrafts={evaluationDrafts}
                          evaluationErrors={evaluationErrors}
                          reviewComments={reviewComments}
                          onDraftChange={handleEvaluationDraftChange}
                          onReviewCommentChange={handleReviewCommentChange}
                          onSaveEvaluation={handleSaveEvaluation}
                          onReviewEvaluation={handleReviewEvaluation}
                        />
                      </Card>
                    ))}
                    <SprintPagination
                      page={sprintPage}
                      totalPages={sprintTotalPages}
                      totalItems={board.sprints.length}
                      pageSize={SPRINTS_PER_PAGE}
                      onPageChange={handleSprintPageChange}
                    />
                  </>
                ) : (
                  <Card className="rounded-lg p-8 text-center">
                    <Award className="mx-auto h-10 w-10 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No sprints found for this team</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Evaluation records appear after the team creates sprints.</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="insights" className="space-y-4">
                {activeTab === "insights" ? (
                <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                  <Card className="min-w-0 rounded-lg p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Burndown</h2>
                        <p className="text-sm text-muted-foreground">Active sprint remaining work against ideal pace.</p>
                      </div>
                      <TrendingDown className="h-5 w-5 text-primary" />
                    </div>
                    <div className="relative h-[280px] min-h-[280px] min-w-0 overflow-hidden">
                      {board.metrics.burndown.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280} minWidth={1} minHeight={1}>
                          <LineChart data={board.metrics.burndown}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#64748b" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="remaining" name="Remaining" stroke="#0f766e" strokeWidth={3} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <ChartEmptyState message="Start a sprint to see the burndown trend." />
                      )}
                    </div>
                  </Card>

                  <Card className="min-w-0 rounded-lg p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Velocity</h2>
                        <p className="text-sm text-muted-foreground">Completed story points by sprint.</p>
                      </div>
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="relative h-[280px] min-h-[280px] min-w-0 overflow-hidden">
                      {board.metrics.velocity.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280} minWidth={1} minHeight={1}>
                          <BarChart data={board.metrics.velocity}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={60} />
                            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="completedStoryPoints" name="Completed SP" fill="#2563eb" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="totalStoryPoints" name="Planned SP" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <ChartEmptyState message="Complete or start a sprint to build velocity history." />
                      )}
                    </div>
                  </Card>

                  <Card className="min-w-0 rounded-lg p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Planned vs unplanned</h2>
                        <p className="text-sm text-muted-foreground">Scope changes across sprint groups.</p>
                      </div>
                      <RotateCcw className="h-5 w-5 text-primary" />
                    </div>
                    <div className="relative h-[280px] min-h-[280px] min-w-0 overflow-hidden">
                      {board.metrics.plannedVsUnplanned.some((item) => item.planned > 0 || item.unplanned > 0) ? (
                        <ResponsiveContainer width="100%" height={280} minWidth={1} minHeight={1}>
                          <BarChart data={board.metrics.plannedVsUnplanned}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={60} />
                            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="planned" name="Planned" stackId="scope" fill="#059669" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="unplanned" name="Unplanned" stackId="scope" fill="#e11d48" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <ChartEmptyState message="Add tasks to a sprint to compare planned and unplanned work." />
                      )}
                    </div>
                  </Card>

                  <Card className="min-w-0 rounded-lg p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Task status mix</h2>
                        <p className="text-sm text-muted-foreground">All sprint and backlog tasks by workflow state.</p>
                      </div>
                      <CalendarDays className="h-5 w-5 text-primary" />
                    </div>
                    <div className="relative h-[280px] min-h-[280px] min-w-0 overflow-hidden">
                      {hasStatusChartData ? (
                        <ResponsiveContainer width="100%" height={280} minWidth={1} minHeight={1}>
                          <PieChart>
                            <Pie data={statusChartData} dataKey="value" nameKey="name" innerRadius={68} outerRadius={105} paddingAngle={3}>
                              {statusChartData.map((entry) => (
                                <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <ChartEmptyState message="Create tasks to see the workflow status mix." />
                      )}
                    </div>
                  </Card>
                </div>
                ) : null}
              </TabsContent>
            </Tabs>
          </>
        ) : null}

        <Dialog open={createDialogOpen} onOpenChange={(open) => (open ? setCreateDialogOpen(true) : closeSprintDialog())}>
          <DialogContent className="mx-4 max-h-[90vh] w-[94vw] overflow-hidden rounded-lg border-border/70 p-0 shadow-2xl sm:mx-auto sm:max-w-2xl">
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                void handleSaveSprint()
              }}
            >
              <DialogHeader className="border-b border-border/70 bg-muted/25 px-6 py-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
                    <Layers3 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-xl">{sprintDialogMode === "edit" ? "Edit sprint" : "Create sprint"}</DialogTitle>
                    <DialogDescription className="mt-1">
                      {sprintDialogMode === "edit" ? "Update the sprint name, goal, dates, or lifecycle state." : "Set the sprint name, goal, and timebox."}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="max-h-[62vh] space-y-5 overflow-y-auto px-6 py-5">
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: EASE_OUT_QUINT }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="sprint-name">Name</Label>
                    <span className="text-xs text-muted-foreground">{sprintForm.name.trim().length}/120</span>
                  </div>
                  <Input
                    id="sprint-name"
                    value={sprintForm.name}
                    onChange={(event) => setSprintForm((current) => ({ ...current, name: event.target.value }))}
                    className="h-11 rounded-lg transition-[border-color,box-shadow] focus-visible:ring-primary/20"
                    aria-invalid={Boolean(shownSprintErrors.name)}
                    aria-describedby={shownSprintErrors.name ? "sprint-name-error" : undefined}
                    placeholder="Sprint 5"
                    autoFocus
                  />
                  <div id="sprint-name-error">
                    <FieldError message={shownSprintErrors.name} />
                  </div>
                </motion.div>

                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.24, delay: shouldReduceMotion ? 0 : 0.03, ease: EASE_OUT_QUINT }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="sprint-goal">Goal</Label>
                    <span className="text-xs text-muted-foreground">{sprintForm.goal.trim().length}/2000</span>
                  </div>
                  <Textarea
                    id="sprint-goal"
                    value={sprintForm.goal}
                    onChange={(event) => setSprintForm((current) => ({ ...current, goal: event.target.value }))}
                    className="min-h-[112px] resize-none rounded-lg transition-[border-color,box-shadow] focus-visible:ring-primary/20"
                    aria-invalid={Boolean(shownSprintErrors.goal)}
                    aria-describedby={shownSprintErrors.goal ? "sprint-goal-error" : undefined}
                    placeholder="What should the team finish by the end of this sprint?"
                  />
                  <div id="sprint-goal-error">
                    <FieldError message={shownSprintErrors.goal} />
                  </div>
                </motion.div>

                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.24, delay: shouldReduceMotion ? 0 : 0.06, ease: EASE_OUT_QUINT }}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <div className="space-y-2">
                    <Label htmlFor="sprint-start">Start date</Label>
                    <Input
                      id="sprint-start"
                      type="date"
                      value={sprintForm.startDate}
                      onChange={(event) => setSprintForm((current) => ({ ...current, startDate: event.target.value }))}
                      className="h-11 rounded-lg transition-[border-color,box-shadow] focus-visible:ring-primary/20"
                      aria-invalid={Boolean(shownSprintErrors.startDate)}
                      aria-describedby={shownSprintErrors.startDate ? "sprint-start-error" : undefined}
                    />
                    <div id="sprint-start-error">
                      <FieldError message={shownSprintErrors.startDate} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sprint-end">End date</Label>
                    <Input
                      id="sprint-end"
                      type="date"
                      value={sprintForm.endDate}
                      onChange={(event) => setSprintForm((current) => ({ ...current, endDate: event.target.value }))}
                      className="h-11 rounded-lg transition-[border-color,box-shadow] focus-visible:ring-primary/20"
                      aria-invalid={Boolean(shownSprintErrors.endDate)}
                      aria-describedby={shownSprintErrors.endDate ? "sprint-end-error" : undefined}
                    />
                    <div id="sprint-end-error">
                      <FieldError message={shownSprintErrors.endDate} />
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.24, delay: shouldReduceMotion ? 0 : 0.09, ease: EASE_OUT_QUINT }}
                  className="space-y-2"
                >
                  <Label>Status</Label>
                  <Select value={sprintForm.status} onValueChange={(value) => setSprintForm((current) => ({ ...current, status: value as ApiSprintStatus }))}>
                    <SelectTrigger
                      className="h-11 rounded-lg transition-[border-color,box-shadow] focus-visible:ring-primary/20"
                      aria-invalid={Boolean(shownSprintErrors.status)}
                      aria-describedby={shownSprintErrors.status ? "sprint-status-error" : undefined}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sprintStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div id="sprint-status-error">
                    <FieldError message={shownSprintErrors.status} />
                  </div>
                </motion.div>

                <AnimatePresence initial={false}>
                  {hasSubmittedSprintForm && sprintFormError ? (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: EASE_OUT_QUINT }}
                      className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{sprintFormError}</span>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <DialogFooter className="border-t border-border/70 bg-background/95 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg bg-transparent transition-transform motion-safe:hover:-translate-y-0.5"
                  onClick={closeSprintDialog}
                  disabled={isSavingSprint}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="rounded-lg shadow-sm transition-transform motion-safe:hover:-translate-y-0.5"
                  disabled={isSavingSprint || !isSprintFormValid}
                >
                  {isSavingSprint ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {sprintDialogMode === "edit" ? "Save Sprint" : "Create Sprint"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={Boolean(sprintPendingDelete)}
          onOpenChange={(open) => {
            if (!open && !isDeletingSprint) setSprintPendingDelete(null)
          }}
        >
          <AlertDialogContent className="overflow-hidden rounded-lg border-destructive/20 p-0 shadow-2xl sm:max-w-lg">
            <AlertDialogHeader className="border-b border-destructive/15 bg-destructive/5 px-6 py-5 text-left">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/10 text-destructive">
                  <TriangleAlert className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <AlertDialogTitle>Delete sprint?</AlertDialogTitle>
                  <AlertDialogDescription className="mt-1">
                    This removes the sprint group only. Its tasks stay in the project and return to Backlog.
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>

            <div className="space-y-3 px-6 py-5">
              <div className="rounded-lg border border-border/70 bg-background/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{sprintPendingDelete?.name ?? "Selected sprint"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {sprintPendingDelete ? formatSprintRange(sprintPendingDelete) : "Sprint dates"}
                    </p>
                  </div>
                  {sprintPendingDelete ? (
                    <Badge variant="outline" className={cn("rounded-md", getSprintBadgeClass(sprintPendingDelete.status))}>
                      {formatSprintStatus(sprintPendingDelete.status)}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-muted/35 px-3 py-2">
                    <span className="block text-xs text-muted-foreground">Tasks kept</span>
                    <span className="font-semibold">{sprintPendingDelete?.stats.totalTasks ?? 0}</span>
                  </div>
                  <div className="rounded-lg bg-muted/35 px-3 py-2">
                    <span className="block text-xs text-muted-foreground">Destination</span>
                    <span className="font-semibold">Backlog</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">You can assign those tasks to another sprint later.</p>
            </div>

            <AlertDialogFooter className="border-t border-border/70 bg-background/95 px-6 py-4">
              <AlertDialogCancel
                className="rounded-lg bg-transparent transition-transform motion-safe:hover:-translate-y-0.5"
                disabled={isDeletingSprint}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-lg bg-destructive text-destructive-foreground shadow-sm transition-transform hover:bg-destructive/90 motion-safe:hover:-translate-y-0.5"
                disabled={isDeletingSprint}
                onClick={(event) => {
                  event.preventDefault()
                  void handleDeleteSprint()
                }}
              >
                {isDeletingSprint ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete Sprint
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TeamRequiredGuard>
  )
}
