"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Target,
  Timer,
} from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import { tasksApi } from "@/lib/api/tasks"
import type { ApiTask } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { TeamRequiredLoadingState, TeamRequiredState } from "@/components/team-required-guard"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type FocusLogEntry = {
  id: string
  taskId: string
  taskTitle: string
  durationSeconds: number
  startedAt: string
  endedAt: string
}

type FocusTimerState = {
  taskId: string
  startedAt: number | null
  accumulatedSeconds: number
  isRunning: boolean
}

const TODAY_GOAL_SECONDS = 4 * 60 * 60
const WEEK_GOAL_SECONDS = 20 * 60 * 60
const TASKS_PER_PAGE = 4
const ACTIVE_TIMER_STORAGE_PREFIX = "gpms-focus-timer-active"
const FOCUS_LOG_STORAGE_PREFIX = "gpms-focus-timer-log"

const EMPTY_TIMER_STATE: FocusTimerState = {
  taskId: "",
  startedAt: null,
  accumulatedSeconds: 0,
  isRunning: false,
}

const STATUS_META: Record<
  ApiTask["status"],
  { label: string; badgeClassName: string; progress: number }
> = {
  TODO: {
    label: "To Do",
    badgeClassName: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    progress: 12,
  },
  IN_PROGRESS: {
    label: "In Progress",
    badgeClassName: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    progress: 52,
  },
  REVIEW: {
    label: "Review",
    badgeClassName: "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300",
    progress: 80,
  },
  APPROVED: {
    label: "Approved",
    badgeClassName: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    progress: 92,
  },
  DONE: {
    label: "Done",
    badgeClassName: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    progress: 100,
  },
}

const PRIORITY_WEIGHT: Record<ApiTask["priority"], number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

const STATUS_WEIGHT: Record<ApiTask["status"], number> = {
  TODO: 0,
  IN_PROGRESS: 1,
  REVIEW: 2,
  APPROVED: 3,
  DONE: 4,
}

function getActiveTimerStorageKey(userId: string) {
  return `${ACTIVE_TIMER_STORAGE_PREFIX}:${userId}`
}

function getFocusLogStorageKey(userId: string) {
  return `${FOCUS_LOG_STORAGE_PREFIX}:${userId}`
}

function createLocalId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function formatCompactDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)

  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function formatDateLabel(value?: string | null) {
  if (!value) return "No deadline"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No deadline"

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatDateTimeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown time"

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function isSameLocalDay(dateA: Date, dateB: Date) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  )
}

function getTaskFocusMessage(task: ApiTask) {
  if (task.permissions.canAccept) {
    return "Accept this task first, then begin your focus session."
  }

  if (task.permissions.canSubmitForReview) {
    return "The implementation looks ready. Wrap up and send it for TA review."
  }

  if (task.status === "REVIEW") {
    return "Your work is waiting for TA review, so shift your focus to the next assignment."
  }

  if (task.status === "APPROVED") {
    return "This task is approved already. Keep the momentum on the next active task."
  }

  if (task.isPastEndDate) {
    return "This task has passed its due date, so it needs immediate attention."
  }

  return "This is the strongest task to move the project forward right now."
}

function getTaskActionLabel(task: ApiTask) {
  if (task.permissions.canAccept) return "Accept and start"
  if (task.permissions.canSubmitForReview) return "Submit for review"
  if (task.status === "REVIEW") return "Waiting for review"
  if (task.status === "APPROVED") return "Approved"
  if (task.status === "DONE") return "Completed"
  return "Continue working"
}

function compareTasksForPriority(left: ApiTask, right: ApiTask) {
  const leftNeedsAcceptance = left.permissions.canAccept ? 0 : 1
  const rightNeedsAcceptance = right.permissions.canAccept ? 0 : 1
  if (leftNeedsAcceptance !== rightNeedsAcceptance) {
    return leftNeedsAcceptance - rightNeedsAcceptance
  }

  const leftOverdue = left.isPastEndDate ? 0 : 1
  const rightOverdue = right.isPastEndDate ? 0 : 1
  if (leftOverdue !== rightOverdue) {
    return leftOverdue - rightOverdue
  }

  const statusDiff = STATUS_WEIGHT[left.status] - STATUS_WEIGHT[right.status]
  if (statusDiff !== 0) {
    return statusDiff
  }

  const priorityDiff = PRIORITY_WEIGHT[left.priority] - PRIORITY_WEIGHT[right.priority]
  if (priorityDiff !== 0) {
    return priorityDiff
  }

  const leftDue = left.endDate ? new Date(left.endDate).getTime() : Number.MAX_SAFE_INTEGER
  const rightDue = right.endDate ? new Date(right.endDate).getTime() : Number.MAX_SAFE_INTEGER
  if (leftDue !== rightDue) {
    return leftDue - rightDue
  }

  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
}

function buildPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const items: Array<number | "start-ellipsis" | "end-ellipsis"> = [1]
  const startPage = Math.max(2, currentPage - 1)
  const endPage = Math.min(totalPages - 1, currentPage + 1)

  if (startPage > 2) {
    items.push("start-ellipsis")
  }

  for (let page = startPage; page <= endPage; page += 1) {
    items.push(page)
  }

  if (endPage < totalPages - 1) {
    items.push("end-ellipsis")
  }

  items.push(totalPages)

  return items
}

export default function TimeTrackerPage() {
  const router = useRouter()
  const { currentUser, hasHydrated } = useAuthStore()
  const isStudent = currentUser?.role === "leader" || currentUser?.role === "member"
  const {
    data: myTeamState,
    isLoading: isTeamLoading,
    error: teamError,
    refresh: refreshTeamState,
  } = useMyTeamState(isStudent)

  const [tasks, setTasks] = useState<ApiTask[]>([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [taskActionInFlight, setTaskActionInFlight] = useState("")
  const [focusTimer, setFocusTimer] = useState<FocusTimerState>(EMPTY_TIMER_STATE)
  const [focusLog, setFocusLog] = useState<FocusLogEntry[]>([])
  const [tasksPage, setTasksPage] = useState(1)
  const [now, setNow] = useState(() => Date.now())

  const team = myTeamState?.team ?? null

  useEffect(() => {
    if (!hasHydrated || !currentUser || isStudent) return
    router.replace("/dashboard")
  }, [currentUser, hasHydrated, isStudent, router])

  useEffect(() => {
    if (!focusTimer.isRunning) return

    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [focusTimer.isRunning])

  useEffect(() => {
    if (!currentUser?.id) {
      setFocusTimer(EMPTY_TIMER_STATE)
      setFocusLog([])
      return
    }

    try {
      const savedTimer = window.localStorage.getItem(getActiveTimerStorageKey(currentUser.id))
      const savedLog = window.localStorage.getItem(getFocusLogStorageKey(currentUser.id))

      if (savedTimer) {
        const parsedTimer = JSON.parse(savedTimer) as FocusTimerState
        setFocusTimer({
          taskId: parsedTimer.taskId ?? "",
          startedAt: parsedTimer.startedAt ?? null,
          accumulatedSeconds: Number(parsedTimer.accumulatedSeconds ?? 0),
          isRunning: Boolean(parsedTimer.isRunning),
        })
      } else {
        setFocusTimer(EMPTY_TIMER_STATE)
      }

      if (savedLog) {
        const parsedLog = JSON.parse(savedLog) as FocusLogEntry[]
        setFocusLog(Array.isArray(parsedLog) ? parsedLog : [])
      } else {
        setFocusLog([])
      }
    } catch {
      setFocusTimer(EMPTY_TIMER_STATE)
      setFocusLog([])
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (!currentUser?.id) return

    window.localStorage.setItem(
      getActiveTimerStorageKey(currentUser.id),
      JSON.stringify(focusTimer),
    )
  }, [currentUser?.id, focusTimer])

  useEffect(() => {
    if (!currentUser?.id) return

    window.localStorage.setItem(
      getFocusLogStorageKey(currentUser.id),
      JSON.stringify(focusLog),
    )
  }, [currentUser?.id, focusLog])

  useEffect(() => {
    if (!team?.id || !currentUser?.id) {
      if (!isTeamLoading) {
        setTasks([])
        setIsLoadingTasks(false)
      }
      return
    }

    let cancelled = false

    const loadTasks = async () => {
      setIsLoadingTasks(true)
      setLoadError("")

      try {
        const allTasks = await tasksApi.list({ teamId: team.id })
        const assignedToCurrentUser = allTasks
          .filter((task) => task.assignee?.id === currentUser.id)
          .sort(compareTasksForPriority)

        if (!cancelled) {
          setTasks(assignedToCurrentUser)
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Could not load your tasks right now.")
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTasks(false)
        }
      }
    }

    void loadTasks()

    return () => {
      cancelled = true
    }
  }, [currentUser?.id, isTeamLoading, team?.id])

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status !== "DONE").sort(compareTasksForPriority),
    [tasks],
  )

  const recommendedTask = useMemo(() => activeTasks[0] ?? null, [activeTasks])

  useEffect(() => {
    if (!activeTasks.length) {
      if (!focusTimer.isRunning) {
        setFocusTimer((current) => ({ ...current, taskId: "" }))
      }
      return
    }

    if (focusTimer.taskId && activeTasks.some((task) => task.id === focusTimer.taskId)) {
      return
    }

    setFocusTimer((current) => ({
      ...current,
      taskId: recommendedTask?.id ?? activeTasks[0]?.id ?? "",
    }))
  }, [activeTasks, focusTimer.isRunning, focusTimer.taskId, recommendedTask?.id])

  const selectedTask =
    activeTasks.find((task) => task.id === focusTimer.taskId) ??
    recommendedTask ??
    null

  const liveSessionSeconds =
    focusTimer.accumulatedSeconds +
    (focusTimer.isRunning && focusTimer.startedAt
      ? Math.max(0, Math.floor((now - focusTimer.startedAt) / 1000))
      : 0)

  const recentSessions = useMemo(() => focusLog.slice(0, 5), [focusLog])
  const totalTaskPages = Math.max(1, Math.ceil(tasks.length / TASKS_PER_PAGE))
  const paginatedTasks = useMemo(() => {
    const startIndex = (tasksPage - 1) * TASKS_PER_PAGE
    return tasks.slice(startIndex, startIndex + TASKS_PER_PAGE)
  }, [tasks, tasksPage])
  const paginationItems = useMemo(
    () => buildPaginationItems(tasksPage, totalTaskPages),
    [tasksPage, totalTaskPages],
  )
  const taskRangeStart = tasks.length === 0 ? 0 : (tasksPage - 1) * TASKS_PER_PAGE + 1
  const taskRangeEnd = Math.min(tasksPage * TASKS_PER_PAGE, tasks.length)

  const todaySeconds = useMemo(() => {
    const today = new Date()
    return focusLog.reduce((sum, session) => {
      const endedAt = new Date(session.endedAt)
      return isSameLocalDay(today, endedAt) ? sum + session.durationSeconds : sum
    }, 0)
  }, [focusLog])

  const weekSeconds = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return focusLog.reduce((sum, session) => {
      const endedAt = new Date(session.endedAt).getTime()
      return endedAt >= weekAgo ? sum + session.durationSeconds : sum
    }, 0)
  }, [focusLog])

  const stats = useMemo(
    () => ({
      needsAction: tasks.filter((task) => task.permissions.canAccept).length,
      inProgress: tasks.filter((task) => task.status === "IN_PROGRESS").length,
      inReview: tasks.filter((task) => task.status === "REVIEW").length,
      completed: tasks.filter((task) => task.status === "DONE").length,
    }),
    [tasks],
  )

  useEffect(() => {
    setTasksPage((currentPage) => Math.min(currentPage, totalTaskPages))
  }, [totalTaskPages])

  async function refreshAssignedTasks() {
    if (!team?.id || !currentUser?.id) return

    const refreshed = await tasksApi.list({ teamId: team.id })
    setTasks(
      refreshed
        .filter((task) => task.assignee?.id === currentUser.id)
        .sort(compareTasksForPriority),
    )
  }

  async function handleTaskAction(task: ApiTask, action: "accept" | "submit") {
    const pendingKey = `${task.id}:${action}`
    setTaskActionInFlight(pendingKey)

    try {
      if (action === "accept") {
        await tasksApi.accept(task.id)
        toast.success(`"${task.title}" is now in progress.`)
      } else {
        await tasksApi.submitForReview(task.id)
        toast.success(`"${task.title}" was submitted for review.`)
      }

      await refreshAssignedTasks()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Action failed. Please try again.")
    } finally {
      setTaskActionInFlight("")
    }
  }

  function selectFocusTask(taskId: string) {
    setFocusTimer((current) => ({
      ...current,
      taskId,
    }))

    const taskIndex = tasks.findIndex((task) => task.id === taskId)
    if (taskIndex >= 0) {
      setTasksPage(Math.floor(taskIndex / TASKS_PER_PAGE) + 1)
    }
  }

  function handleStartTimer() {
    if (!selectedTask) {
      toast.error("Choose a task before starting the focus timer.")
      return
    }

    setNow(Date.now())
    setFocusTimer((current) => ({
      ...current,
      taskId: selectedTask.id,
      startedAt: Date.now(),
      isRunning: true,
    }))
  }

  function handlePauseTimer() {
    setFocusTimer((current) => {
      if (!current.isRunning || !current.startedAt) return current

      const elapsedSinceStart = Math.max(0, Math.floor((Date.now() - current.startedAt) / 1000))

      return {
        ...current,
        accumulatedSeconds: current.accumulatedSeconds + elapsedSinceStart,
        startedAt: null,
        isRunning: false,
      }
    })
  }

  function handleResetTimer() {
    setFocusTimer((current) => ({
      ...current,
      startedAt: null,
      accumulatedSeconds: 0,
      isRunning: false,
    }))
  }

  function handleStopTimer() {
    const taskForSession = selectedTask ?? tasks.find((task) => task.id === focusTimer.taskId) ?? null
    const totalSeconds =
      focusTimer.accumulatedSeconds +
      (focusTimer.isRunning && focusTimer.startedAt
        ? Math.max(0, Math.floor((Date.now() - focusTimer.startedAt) / 1000))
        : 0)

    if (taskForSession && totalSeconds > 0) {
      const endedAt = new Date().toISOString()
      const startedAt = new Date(Date.now() - totalSeconds * 1000).toISOString()

      setFocusLog((current) =>
        [
          {
            id: createLocalId(),
            taskId: taskForSession.id,
            taskTitle: taskForSession.title,
            durationSeconds: totalSeconds,
            startedAt,
            endedAt,
          },
          ...current,
        ].slice(0, 20),
      )

      toast.success(`Saved ${formatCompactDuration(totalSeconds)} for "${taskForSession.title}".`)
    }

    setFocusTimer((current) => ({
      ...current,
      startedAt: null,
      accumulatedSeconds: 0,
      isRunning: false,
    }))
  }

  if (!hasHydrated) {
    return null
  }

  if (!currentUser) {
    return null
  }

  if (!isStudent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="w-full max-w-lg border-dashed p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Timer className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-semibold">Redirecting to the dashboard</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Time Tracker is available for students only.
          </p>
        </Card>
      </div>
    )
  }

  if (isTeamLoading) {
    return <TeamRequiredLoadingState />
  }

  if (teamError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-destructive/25 bg-destructive/[0.04] p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold">Could not verify your team access</h2>
          <p className="mt-2 text-sm text-muted-foreground">{teamError}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => void refreshTeamState()}>Try Again</Button>
            <Link href="/dashboard/my-team">
              <Button variant="outline" className="bg-transparent">
                Open My Team
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  if (!team) {
    return (
      <TeamRequiredState
        pageName="Time Tracker"
        pageDescription="Track focused work sessions and see the next task your graduation project needs from you."
        icon={<Timer className="h-10 w-10" />}
      />
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Time Tracker
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track your focus sessions for <span className="font-semibold text-foreground">{team.name}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() => void refreshAssignedTasks()}
              disabled={isLoadingTasks}
            >
              {isLoadingTasks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            </Button>
            <Link href="/dashboard/tasks">
              <Button size="sm" className="rounded-xl gap-1.5">
                Tasks Board <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Focused Today",
              value: formatCompactDuration(todaySeconds),
              helper: `Goal ${formatCompactDuration(TODAY_GOAL_SECONDS)}`,
            },
            {
              label: "Live Session",
              value: formatCompactDuration(liveSessionSeconds),
              helper: focusTimer.isRunning ? "Running" : "Ready",
            },
            {
              label: "Open Tasks",
              value: String(activeTasks.length),
              helper: recommendedTask ? "Priority set" : "Clear",
            },
            {
              label: "Completed",
              value: String(stats.completed),
              helper: `of ${tasks.length} assigned`,
            },
          ].map((item) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="flex flex-col gap-2 border-border/60 bg-background/70 p-3 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
                <p className="text-lg font-bold text-foreground">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.helper}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "To Accept",
            value: stats.needsAction,
            color: "text-amber-500",
          },
          {
            label: "In Progress",
            value: stats.inProgress,
            color: "text-blue-500",
          },
          {
            label: "In Review",
            value: stats.inReview,
            color: "text-purple-500",
          },
          {
            label: "Completed",
            value: stats.completed,
            color: "text-emerald-500",
          },
        ].map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="flex items-center gap-3 border-border/60 bg-background/70 px-4 py-3 shadow-sm">
              <p className={cn("text-2xl font-bold tabular-nums", item.color)}>{item.value}</p>
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.28fr)_350px] 2xl:grid-cols-[minmax(0,1.3fr)_370px]">
        <div className="space-y-6">
          <Card className="overflow-hidden border-border/60 bg-background/90 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Best Next Move</p>
                <h2 className="mt-1.5 text-base font-semibold">
                  {recommendedTask ? recommendedTask.title : "No active tasks"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {recommendedTask
                    ? getTaskFocusMessage(recommendedTask)
                    : "Awaiting assignment"}
                </p>
              </div>

              {recommendedTask && (
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap flex-shrink-0",
                    STATUS_META[recommendedTask.status].badgeClassName,
                  )}
                >
                  {STATUS_META[recommendedTask.status].label}
                </Badge>
              )}
            </div>

            {recommendedTask && (
              <div className="grid gap-2 p-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-background/50 p-2.5">
                  <p className="text-xs font-medium text-muted-foreground">Action</p>
                  <p className="mt-1 text-xs font-semibold text-foreground">{getTaskActionLabel(recommendedTask)}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/50 p-2.5">
                  <p className="text-xs font-medium text-muted-foreground">Deadline</p>
                  <p className={cn("mt-1 text-xs font-semibold", recommendedTask.isPastEndDate && "text-destructive")}>
                    {recommendedTask.isPastEndDate ? "Overdue" : formatDateLabel(recommendedTask.endDate)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/50 p-2.5">
                  <p className="text-xs font-medium text-muted-foreground">Progress</p>
                  <Progress value={STATUS_META[recommendedTask.status].progress} className="mt-1.5 h-1" />
                </div>
              </div>
            )}

            {recommendedTask && (
              <div className="flex flex-wrap gap-2 border-t border-border/60 p-4">
                <Button size="sm" variant="outline" className="rounded-lg h-8" onClick={() => selectFocusTask(recommendedTask.id)}>
                  Focus
                </Button>
                {recommendedTask.permissions.canAccept && (
                  <Button size="sm" className="rounded-lg h-8 gap-1" onClick={() => void handleTaskAction(recommendedTask, "accept")}
                    disabled={taskActionInFlight === `${recommendedTask.id}:accept`}>
                    {taskActionInFlight === `${recommendedTask.id}:accept` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    Accept
                  </Button>
                )}
                {recommendedTask.permissions.canSubmitForReview && (
                  <Button size="sm" variant="secondary" className="rounded-lg h-8 gap-1" onClick={() => void handleTaskAction(recommendedTask, "submit")}
                    disabled={taskActionInFlight === `${recommendedTask.id}:submit`}>
                    {taskActionInFlight === `${recommendedTask.id}:submit` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Submit
                  </Button>
                )}
                <Link href={`/dashboard/tasks?taskId=${recommendedTask.id}`} className="ml-auto">
                  <Button size="sm" variant="ghost" className="rounded-lg h-8">Details</Button>
                </Link>
              </div>
            )}
          </Card>

          <Card id="task-queue" className="border-border/60 bg-background/90 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">My Task Queue</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Click to set focus target</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs">{tasks.length}</Badge>
                {tasks.length > 0 ? (
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-xs text-muted-foreground">
                    {taskRangeStart}–{taskRangeEnd}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="p-4">

            {isLoadingTasks ? (
              <div className="flex min-h-52 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading your assigned tasks...
              </div>
            ) : loadError ? (
              <div className="mt-6 rounded-2xl border border-destructive/25 bg-destructive/[0.05] p-4">
                <p className="font-medium text-destructive">Could not load your task queue</p>
                <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
                <Button className="mt-4 rounded-xl" onClick={() => void refreshAssignedTasks()}>
                  Try Again
                </Button>
              </div>
            ) : tasks.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-border/60 p-8 text-center">
                <Target className="mx-auto h-10 w-10 text-primary/70" />
                <h3 className="mt-4 text-lg font-semibold">No tasks assigned to you yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  When your leader assigns work from the tasks board, it will appear here with the exact next action.
                </p>
                <Link href="/dashboard/tasks" className="inline-block">
                  <Button className="mt-5 rounded-xl">Open Tasks Board</Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {paginatedTasks.map((task, index) => {
                    const pendingAccept = taskActionInFlight === `${task.id}:accept`
                    const pendingSubmit = taskActionInFlight === `${task.id}:submit`
                    const isSelectedTask = selectedTask?.id === task.id

                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        role="button"
                        onClick={(e) => {
                          const target = e.target as HTMLElement
                          if (target.closest("button, a")) return
                          selectFocusTask(task.id)
                        }}
                        className={cn(
                          "group overflow-hidden rounded-lg border p-3 transition-all cursor-pointer",
                          isSelectedTask
                            ? "border-primary/35 bg-primary/[0.05] shadow-sm"
                            : "border-border/60 bg-background/70 hover:border-primary/20 hover:bg-background",
                        )}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              <span className="text-xs text-muted-foreground flex-shrink-0">#{(tasksPage - 1) * TASKS_PER_PAGE + index + 1}</span>
                              <h3 className="text-sm font-semibold truncate">{task.title}</h3>
                              {isSelectedTask && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary flex-shrink-0">
                                  <span className="h-1 w-1 rounded-full bg-primary" />focused
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs" >
                                {STATUS_META[task.status].label}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3 w-3" />
                              {task.permissions.canAccept ? "Ready" : STATUS_META[task.status].label}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {task.isPastEndDate ? <span className="text-destructive font-medium">Overdue</span> : formatDateLabel(task.endDate)}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            {task.permissions.canAccept && (
                              <Button size="sm" className="rounded-lg h-7 gap-1" onClick={() => void handleTaskAction(task, "accept")} disabled={pendingAccept}>
                                {pendingAccept ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                                Accept
                              </Button>
                            )}
                            {task.permissions.canSubmitForReview && (
                              <Button size="sm" variant="secondary" className="rounded-lg h-7 gap-1" onClick={() => void handleTaskAction(task, "submit")} disabled={pendingSubmit}>
                                {pendingSubmit ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                Submit
                              </Button>
                            )}
                            <Link href={`/dashboard/tasks?taskId=${task.id}`}>
                              <Button size="sm" variant="ghost" className="rounded-lg h-7">Open</Button>
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                {totalTaskPages > 1 ? (
                  <div className="mt-6 flex flex-col gap-4 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Page <span className="font-semibold text-foreground">{tasksPage}</span> of{" "}
                      <span className="font-semibold text-foreground">{totalTaskPages}</span>
                    </p>

                    <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#task-queue"
                            className={cn(
                              tasksPage === 1 && "pointer-events-none opacity-50",
                            )}
                            onClick={(event) => {
                              event.preventDefault()
                              if (tasksPage > 1) {
                                setTasksPage((currentPage) => currentPage - 1)
                              }
                            }}
                          />
                        </PaginationItem>

                        {paginationItems.map((item) => (
                          <PaginationItem key={item}>
                            {typeof item === "number" ? (
                              <PaginationLink
                                href="#task-queue"
                                isActive={tasksPage === item}
                                onClick={(event) => {
                                  event.preventDefault()
                                  setTasksPage(item)
                                }}
                              >
                                {item}
                              </PaginationLink>
                            ) : (
                              <PaginationEllipsis />
                            )}
                          </PaginationItem>
                        ))}

                        <PaginationItem>
                          <PaginationNext
                            href="#task-queue"
                            className={cn(
                              tasksPage === totalTaskPages && "pointer-events-none opacity-50",
                            )}
                            onClick={(event) => {
                              event.preventDefault()
                              if (tasksPage < totalTaskPages) {
                                setTasksPage((currentPage) => currentPage + 1)
                              }
                            }}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                ) : null}
              </>
            )}
            </div>
          </Card>
        </div>

        <div className="self-start xl:sticky xl:top-6">
          <div className="space-y-4">
            <Card className="overflow-hidden border-border/60 bg-background/95 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        focusTimer.isRunning ? "animate-pulse bg-emerald-500" : "bg-primary/50",
                      )}
                    />
                    {focusTimer.isRunning ? "Running" : "Ready"}
                  </div>
                  <h2 className="mt-3 text-base font-semibold">Focus Session</h2>
                </div>
                <div className="rounded-lg border border-primary/10 bg-primary/10 p-2 text-primary">
                  <Timer className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Focus Task
                  </p>
                  <p className="text-sm font-semibold">{selectedTask?.title ?? "No task selected"}</p>
                </div>

                <div className="rounded-lg border border-primary/15 bg-gradient-to-br from-primary/10 to-background p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Current Session
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold text-foreground sm:text-3xl">
                    {formatDuration(liveSessionSeconds)}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {!focusTimer.isRunning ? (
                    <Button
                      size="sm"
                      className="rounded-lg h-8 gap-1"
                      onClick={handleStartTimer}
                      disabled={!selectedTask}
                    >
                      <Play className="h-3.5 w-3.5" />
                      {liveSessionSeconds > 0 ? "Resume" : "Start"}
                    </Button>
                  ) : (
                    <Button
                      className="h-11 rounded-2xl sm:col-span-2"
                      variant="secondary"
                      onClick={handlePauseTimer}
                    >
                      <Pause className="mr-2 h-4 w-4" />
                      Pause Session
                    </Button>
                  )}

                  <Button
                    className="h-11 rounded-2xl bg-transparent"
                    variant="outline"
                    onClick={handleResetTimer}
                    disabled={liveSessionSeconds === 0}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </div>

                <Button
                  className="h-11 w-full rounded-2xl"
                  variant="destructive"
                  onClick={handleStopTimer}
                  disabled={liveSessionSeconds === 0}
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop and Save Session
                </Button>
              </div>
            </Card>

            <Card className="border-border/60 bg-background/95 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Momentum</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your recent focused effort on project delivery.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Today</span>
                    <span className="font-semibold">{formatCompactDuration(todaySeconds)}</span>
                  </div>
                  <Progress
                    value={Math.min(100, (todaySeconds / TODAY_GOAL_SECONDS) * 100)}
                    className="h-2"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Goal: {formatCompactDuration(TODAY_GOAL_SECONDS)}
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last 7 Days</span>
                    <span className="font-semibold">{formatCompactDuration(weekSeconds)}</span>
                  </div>
                  <Progress
                    value={Math.min(100, (weekSeconds / WEEK_GOAL_SECONDS) * 100)}
                    className="h-2"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Goal: {formatCompactDuration(WEEK_GOAL_SECONDS)}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="border-border/60 bg-background/95 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Recent Focus Log</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sessions saved from this browser for your current account.
                  </p>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {recentSessions.length} saved
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                {recentSessions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
                    Your saved focus sessions will appear here after the first timer stop.
                  </div>
                ) : (
                  recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-2xl border border-border/60 bg-muted/20 p-3.5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium">{session.taskTitle}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {formatDateTimeLabel(session.startedAt)} to{" "}
                            {formatDateTimeLabel(session.endedAt)}
                          </p>
                        </div>
                        <Badge variant="secondary" className="rounded-full">
                          {formatCompactDuration(session.durationSeconds)}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
