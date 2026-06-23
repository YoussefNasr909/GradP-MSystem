"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  AlertCircle,
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
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import { sprintsApi } from "@/lib/api/sprints"
import type { ApiSprint, ApiSprintBoard, ApiSprintStatus, ApiSprintTask, ApiTaskStatus } from "@/lib/api/types"
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

const DEFAULT_SPRINT_FORM: SprintFormState = {
  name: "",
  goal: "",
  startDate: "",
  endDate: "",
  status: "PLANNED",
}

const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const

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
  if (form.startDate && form.endDate && form.endDate < form.startDate) {
    errors.endDate = "End date must be on or after the start date."
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

function readPointsInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const points = Number(trimmed)
  if (!Number.isInteger(points) || points < 0 || points > 99) return undefined
  return points
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

function SprintTaskCard({
  task,
  board,
  canManage,
  isBusy,
  reduceMotion,
  onMove,
  onMetaChange,
}: {
  task: ApiSprintTask
  board: ApiSprintBoard
  canManage: boolean
  isBusy: boolean
  reduceMotion: boolean
  onMove: (task: ApiSprintTask, sprintId: string) => void
  onMetaChange: (task: ApiSprintTask, payload: { storyPoints?: number; actualPoints?: number | null; unplanned?: boolean }) => void
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

        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 transition-colors hover:bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground">Sprint planning</span>
            <Badge variant="outline" className="rounded-md px-2 text-[10px]">
              {task.actualPoints === null ? `Estimate ${task.storyPoints} SP` : `Actual ${task.actualPoints} SP`}
            </Badge>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-foreground">Estimate</span>
              <div className="relative">
                <Input
                  key={`story-${task.id}-${task.storyPoints}`}
                  type="number"
                  min={0}
                  max={99}
                  defaultValue={task.storyPoints}
                  disabled={!canManage || isBusy}
                  className="h-10 rounded-lg pr-10 text-sm transition-[border-color,box-shadow] hover:border-primary/35 focus-visible:ring-primary/20"
                  aria-label="Estimated story points"
                  title="Estimated story points"
                  onBlur={(event) => {
                    const next = readPointsInput(event.currentTarget.value)
                    if (next === null) {
                      event.currentTarget.value = String(task.storyPoints)
                      return
                    }
                    if (next === undefined) {
                      event.currentTarget.value = String(task.storyPoints)
                      toast.error("Estimate must be a whole number between 0 and 99.")
                      return
                    }
                    if (next !== task.storyPoints) onMetaChange(task, { storyPoints: next })
                  }}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-muted-foreground">SP</span>
              </div>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-foreground">Completed effort</span>
              <div className="relative">
                <Input
                  key={`actual-${task.id}-${task.actualPoints ?? "actual-empty"}`}
                  type="number"
                  min={0}
                  max={99}
                  defaultValue={task.actualPoints ?? ""}
                  disabled={!canManage || isBusy}
                  className="h-10 rounded-lg pr-10 text-sm transition-[border-color,box-shadow] hover:border-primary/35 focus-visible:ring-primary/20"
                  aria-label="Actual completed story points"
                  title="Actual completed story points"
                  placeholder="Optional"
                  onBlur={(event) => {
                    const next = readPointsInput(event.currentTarget.value)
                    if (next === undefined) {
                      event.currentTarget.value = task.actualPoints === null ? "" : String(task.actualPoints)
                      toast.error("Completed effort must be a whole number between 0 and 99.")
                      return
                    }
                    if (next === null) {
                      if (task.actualPoints !== null) onMetaChange(task, { actualPoints: null })
                      return
                    }
                    if (next !== task.actualPoints) onMetaChange(task, { actualPoints: next })
                  }}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-muted-foreground">SP</span>
              </div>
            </label>
          </div>

          <label className="mt-3 flex min-w-0 items-start gap-3 rounded-lg border border-border/70 bg-background/70 p-3 text-sm transition-[border-color,background-color] hover:border-primary/30 hover:bg-background">
            <Checkbox
              checked={task.unplanned}
              disabled={!canManage || !task.sprintId || isBusy}
              onCheckedChange={(checked) => onMetaChange(task, { unplanned: checked === true })}
              className="mt-0.5"
            />
            <span className="grid min-w-0 gap-0.5">
              <span className="font-medium text-foreground">Unplanned work</span>
              <span className="text-xs text-muted-foreground">Mark this only if the task was added after the sprint started.</span>
            </span>
          </label>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <Badge variant="outline" className="rounded-md px-2 text-[10px] capitalize">
          {task.taskType.toLowerCase()}
        </Badge>
        <span className="font-medium text-foreground">{task.actualPoints === null ? "Using estimate" : "Using completed effort"}</span>
      </div>
    </motion.article>
  )
}

function SprintGroup({
  sprint,
  board,
  canManage,
  isSelected,
  actionInFlight,
  reduceMotion,
  onSelect,
  onEdit,
  onDeleteRequest,
  onStart,
  onComplete,
  onMove,
  onMetaChange,
}: {
  sprint: ApiSprint
  board: ApiSprintBoard
  canManage: boolean
  isSelected: boolean
  actionInFlight: string
  reduceMotion: boolean
  onSelect: (id: string) => void
  onEdit: (sprint: ApiSprint) => void
  onDeleteRequest: (sprint: ApiSprint) => void
  onStart: (id: string) => void
  onComplete: (id: string) => void
  onMove: (task: ApiSprintTask, sprintId: string) => void
  onMetaChange: (task: ApiSprintTask, payload: { storyPoints?: number; actualPoints?: number | null; unplanned?: boolean }) => void
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
                onMetaChange={onMetaChange}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border/80 p-5 text-sm text-muted-foreground">
              No tasks in this sprint yet.
            </div>
          )}
        </div>
      </div>
    </motion.section>
  )
}

export default function SprintsPage() {
  const shouldReduceMotion = useReducedMotion()
  const { data: myTeamState, isLoading: isTeamLoading } = useMyTeamState()
  const [board, setBoard] = useState<ApiSprintBoard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("board")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [sprintDialogMode, setSprintDialogMode] = useState<SprintDialogMode>("create")
  const [editingSprintId, setEditingSprintId] = useState<string | null>(null)
  const [sprintPendingDelete, setSprintPendingDelete] = useState<ApiSprint | null>(null)
  const [sprintForm, setSprintForm] = useState<SprintFormState>(DEFAULT_SPRINT_FORM)
  const [hasSubmittedSprintForm, setHasSubmittedSprintForm] = useState(false)
  const [actionInFlight, setActionInFlight] = useState("")

  const teamId = myTeamState?.team?.id

  const loadBoard = useCallback(async () => {
    if (!teamId) {
      if (!isTeamLoading) {
        setBoard(null)
        setIsLoading(false)
      }
      return
    }

    setIsLoading(true)
    setLoadError("")
    try {
      const result = await sprintsApi.board({ teamId })
      setBoard(result)
      setSelectedSprintId((current) => {
        if (current && result.sprints.some((sprint) => sprint.id === current)) return current
        return result.metrics.activeSprintId ?? result.sprints[0]?.id ?? null
      })
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : "Couldn't load sprints right now.")
    } finally {
      setIsLoading(false)
    }
  }, [isTeamLoading, teamId])

  useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  const selectedSprint = useMemo(() => {
    if (!board) return null
    return board.sprints.find((sprint) => sprint.id === selectedSprintId) ?? board.sprints.find((sprint) => sprint.status === "ACTIVE") ?? board.sprints[0] ?? null
  }, [board, selectedSprintId])

  const canManage = Boolean(board?.permissions.canManage)

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
    if (!teamId) return
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
          teamId,
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

  async function handleTaskMetaChange(task: ApiSprintTask, payload: { storyPoints?: number; actualPoints?: number | null; unplanned?: boolean }) {
    setActionInFlight(`meta-${task.id}`)
    try {
      await sprintsApi.updateTask(task.id, payload)
      await loadBoard()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Couldn't update task")
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
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Sprints</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Plan sprint goals, pull tasks from your team backlog, and watch progress through burndown, velocity, and workload charts.
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

        <AnimatePresence>
          {loadError ? (
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: EASE_OUT_QUINT }}
            >
              <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {loadError}
                </div>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {isLoading ? (
          <Card className="flex min-h-[360px] items-center justify-center rounded-lg p-8">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading sprints
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
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
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
                          onMetaChange={handleTaskMetaChange}
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
                    board.sprints.map((sprint) => (
                      <SprintGroup
                        key={sprint.id}
                        sprint={sprint}
                        board={board}
                        canManage={canManage}
                        isSelected={selectedSprint?.id === sprint.id}
                        actionInFlight={actionInFlight}
                        reduceMotion={Boolean(shouldReduceMotion)}
                        onSelect={setSelectedSprintId}
                        onEdit={openEditDialog}
                        onDeleteRequest={setSprintPendingDelete}
                        onStart={handleStartSprint}
                        onComplete={handleCompleteSprint}
                        onMove={handleMoveTask}
                        onMetaChange={handleTaskMetaChange}
                      />
                    ))
                  ) : (
                    <Card className="rounded-lg p-8 text-center">
                      <Target className="mx-auto h-10 w-10 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-semibold">No sprints yet</h3>
                      <p className="mt-2 text-sm text-muted-foreground">Create your first sprint to group backlog tasks into an iteration.</p>
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
                      <Select value={selectedSprint.id} onValueChange={setSelectedSprintId}>
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
                                onMetaChange={handleTaskMetaChange}
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

              <TabsContent value="insights" className="space-y-4">
                {activeTab === "insights" ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="rounded-lg p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Burndown</h2>
                        <p className="text-sm text-muted-foreground">Active sprint remaining work against ideal pace.</p>
                      </div>
                      <TrendingDown className="h-5 w-5 text-primary" />
                    </div>
                    <div className="h-[280px] min-h-[280px] min-w-0">
                      {board.metrics.burndown.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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

                  <Card className="rounded-lg p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Velocity</h2>
                        <p className="text-sm text-muted-foreground">Completed story points by sprint.</p>
                      </div>
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="h-[280px] min-h-[280px] min-w-0">
                      {board.metrics.velocity.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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

                  <Card className="rounded-lg p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Planned vs unplanned</h2>
                        <p className="text-sm text-muted-foreground">Scope changes across sprint groups.</p>
                      </div>
                      <RotateCcw className="h-5 w-5 text-primary" />
                    </div>
                    <div className="h-[280px] min-h-[280px] min-w-0">
                      {board.metrics.plannedVsUnplanned.some((item) => item.planned > 0 || item.unplanned > 0) ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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

                  <Card className="rounded-lg p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Task status mix</h2>
                        <p className="text-sm text-muted-foreground">All sprint and backlog tasks by workflow state.</p>
                      </div>
                      <CalendarDays className="h-5 w-5 text-primary" />
                    </div>
                    <div className="h-[280px] min-h-[280px] min-w-0">
                      {hasStatusChartData ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
