"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
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
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
  TrendingDown,
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

type SprintFormState = {
  name: string
  goal: string
  startDate: string
  endDate: string
  status: ApiSprintStatus
}

const DEFAULT_SPRINT_FORM: SprintFormState = {
  name: "",
  goal: "",
  startDate: "",
  endDate: "",
  status: "PLANNED",
}

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

function SprintTaskCard({
  task,
  board,
  canManage,
  onMove,
  onMetaChange,
}: {
  task: ApiSprintTask
  board: ApiSprintBoard
  canManage: boolean
  onMove: (task: ApiSprintTask, sprintId: string) => void
  onMetaChange: (task: ApiSprintTask, payload: { storyPoints?: number; actualPoints?: number | null; unplanned?: boolean }) => void
}) {
  const sprintOptions = board.sprints
    .filter((sprint) => sprint.status !== "COMPLETED" || sprint.id === task.sprintId)
    .map((sprint) => ({ sprint, conflict: getTaskSprintDateConflict(task, sprint) }))
  const currentSprint = task.sprintId ? board.sprints.find((sprint) => sprint.id === task.sprintId) : null
  const currentConflict = currentSprint ? getTaskSprintDateConflict(task, currentSprint) : ""

  return (
    <div className="rounded-lg border border-border/70 bg-background/85 p-3 shadow-sm transition-colors hover:border-primary/35">
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
        <div className="mt-3 rounded-md border border-destructive/25 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
          {currentConflict}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2">
        <Select
          value={task.sprintId ?? "backlog"}
          disabled={!canManage}
          onValueChange={(value) => onMove(task, value)}
        >
          <SelectTrigger className="h-9 w-full min-w-0 rounded-lg text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-w-[320px]">
            <SelectItem value="backlog">Backlog</SelectItem>
            {sprintOptions.map(({ sprint, conflict }) => (
              <SelectItem key={sprint.id} value={sprint.id} disabled={Boolean(conflict) && sprint.id !== task.sprintId}>
                <span className="min-w-0 truncate">{sprint.name}</span>
                {conflict && sprint.id !== task.sprintId ? <span className="text-[10px] text-muted-foreground">date mismatch</span> : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-2">
          <Input
            key={`${task.id}-${task.storyPoints}`}
            type="number"
            min={0}
            max={99}
            defaultValue={task.storyPoints}
            disabled={!canManage}
            className="h-9 rounded-lg text-xs"
            aria-label="Story points"
            onBlur={(event) => {
              const next = Number(event.currentTarget.value)
              if (Number.isFinite(next) && next !== task.storyPoints) onMetaChange(task, { storyPoints: next })
            }}
          />

          <label className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-border/70 px-2 text-xs text-muted-foreground">
            <Checkbox
              checked={task.unplanned}
              disabled={!canManage || !task.sprintId}
              onCheckedChange={(checked) => onMetaChange(task, { unplanned: checked === true })}
            />
            <span className="truncate">Unplanned</span>
          </label>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{task.taskType.toLowerCase()}</span>
        <span className="font-medium text-foreground">{getTaskPoints(task)} SP</span>
      </div>
    </div>
  )
}

function SprintGroup({
  sprint,
  board,
  canManage,
  isSelected,
  onSelect,
  onStart,
  onComplete,
  onMove,
  onMetaChange,
}: {
  sprint: ApiSprint
  board: ApiSprintBoard
  canManage: boolean
  isSelected: boolean
  onSelect: (id: string) => void
  onStart: (id: string) => void
  onComplete: (id: string) => void
  onMove: (task: ApiSprintTask, sprintId: string) => void
  onMetaChange: (task: ApiSprintTask, payload: { storyPoints?: number; actualPoints?: number | null; unplanned?: boolean }) => void
}) {
  return (
    <section className={cn("rounded-lg border bg-background/70", isSelected ? "border-primary/45" : "border-border/70")}>
      <button
        type="button"
        onClick={() => onSelect(sprint.id)}
        className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
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
        <div className="grid min-w-[260px] gap-1">
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
              {sprint.status === "PLANNED" ? (
                <Button size="sm" variant="outline" className="h-8 rounded-lg bg-transparent" onClick={() => onStart(sprint.id)}>
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  Start
                </Button>
              ) : null}
              {sprint.status === "ACTIVE" ? (
                <Button size="sm" className="h-8 rounded-lg" onClick={() => onComplete(sprint.id)}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Complete
                </Button>
              ) : null}
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
    </section>
  )
}

export default function SprintsPage() {
  const { data: myTeamState, isLoading: isTeamLoading } = useMyTeamState()
  const [board, setBoard] = useState<ApiSprintBoard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [sprintForm, setSprintForm] = useState<SprintFormState>(DEFAULT_SPRINT_FORM)
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
      setSelectedSprintId((current) => current ?? result.metrics.activeSprintId ?? result.sprints[0]?.id ?? null)
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

  const statusChartData = board?.metrics.statusDistribution.map((item) => ({
    name: formatStatus(item.status),
    value: item.count,
    storyPoints: item.storyPoints,
    status: item.status,
  })) ?? []

  function openCreateDialog() {
    const dates = buildDefaultSprintDates()
    setSprintForm({
      ...DEFAULT_SPRINT_FORM,
      name: board?.sprints.length ? `Sprint ${board.sprints.length + 1}` : "Sprint 1",
      ...dates,
    })
    setCreateDialogOpen(true)
  }

  async function handleCreateSprint() {
    if (!teamId) return
    setActionInFlight("create")
    try {
      await sprintsApi.create({
        teamId,
        name: sprintForm.name,
        goal: sprintForm.goal,
        startDate: sprintForm.startDate,
        endDate: sprintForm.endDate,
        status: sprintForm.status,
      })
      toast.success("Sprint created")
      setCreateDialogOpen(false)
      setSprintForm(DEFAULT_SPRINT_FORM)
      await loadBoard()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Couldn't create sprint")
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

  async function handleMoveTask(task: ApiSprintTask, sprintId: string) {
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
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
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
              <Button className="rounded-lg" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                New Sprint
              </Button>
            ) : null}
          </div>
        </motion.div>

        {loadError ? (
          <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {loadError}
            </div>
          </Card>
        ) : null}

        {isLoading ? (
          <Card className="flex min-h-[360px] items-center justify-center rounded-lg p-8">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading sprints
            </div>
          </Card>
        ) : board ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Active progress</p>
                    <p className="mt-2 text-3xl font-bold">{board.metrics.activeProgress}%</p>
                  </div>
                  <Gauge className="h-8 w-8 text-emerald-600" />
                </div>
                <Progress value={board.metrics.activeProgress} className="mt-4 h-2" />
              </Card>
              <Card className="rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Backlog</p>
                    <p className="mt-2 text-3xl font-bold">{board.metrics.backlogCount}</p>
                  </div>
                  <ClipboardList className="h-8 w-8 text-blue-600" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{board.metrics.backlogStoryPoints} story points waiting</p>
              </Card>
              <Card className="rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Velocity</p>
                    <p className="mt-2 text-3xl font-bold">{board.metrics.velocity.at(-1)?.completedStoryPoints ?? 0}</p>
                  </div>
                  <Sparkles className="h-8 w-8 text-violet-600" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">completed SP in the latest tracked sprint</p>
              </Card>
              <Card className="rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Needs attention</p>
                    <p className="mt-2 text-3xl font-bold">{board.metrics.overdueTasks}</p>
                  </div>
                  <Flag className="h-8 w-8 text-rose-600" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">overdue tasks outside Done</p>
              </Card>
            </div>

            <Tabs defaultValue="board" className="space-y-4">
              <TabsList className="rounded-lg">
                <TabsTrigger value="board" className="gap-2 rounded-md">
                  <Layers3 className="h-4 w-4" />
                  Sprint board
                </TabsTrigger>
                <TabsTrigger value="kanban" className="gap-2 rounded-md">
                  <ListTodo className="h-4 w-4" />
                  Active Kanban
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
                        onSelect={setSelectedSprintId}
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
                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="rounded-lg p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Burndown</h2>
                        <p className="text-sm text-muted-foreground">Active sprint remaining work against ideal pace.</p>
                      </div>
                      <TrendingDown className="h-5 w-5 text-primary" />
                    </div>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
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
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
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
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
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
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
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
                    </div>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : null}

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="mx-4 max-h-[90vh] w-[94vw] overflow-y-auto rounded-lg sm:mx-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Create sprint</DialogTitle>
              <DialogDescription>Set the sprint name, goal, and timebox.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="sprint-name">Name</Label>
                <Input id="sprint-name" value={sprintForm.name} onChange={(event) => setSprintForm((current) => ({ ...current, name: event.target.value }))} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sprint-goal">Goal</Label>
                <Textarea id="sprint-goal" value={sprintForm.goal} onChange={(event) => setSprintForm((current) => ({ ...current, goal: event.target.value }))} className="min-h-[100px] resize-none rounded-lg" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sprint-start">Start date</Label>
                  <Input id="sprint-start" type="date" value={sprintForm.startDate} onChange={(event) => setSprintForm((current) => ({ ...current, startDate: event.target.value }))} className="rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sprint-end">End date</Label>
                  <Input id="sprint-end" type="date" value={sprintForm.endDate} onChange={(event) => setSprintForm((current) => ({ ...current, endDate: event.target.value }))} className="rounded-lg" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={sprintForm.status} onValueChange={(value) => setSprintForm((current) => ({ ...current, status: value as ApiSprintStatus }))}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLANNED">Planned</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-lg bg-transparent" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-lg" onClick={() => void handleCreateSprint()} disabled={actionInFlight === "create"}>
                {actionInFlight === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Sprint
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TeamRequiredGuard>
  )
}
