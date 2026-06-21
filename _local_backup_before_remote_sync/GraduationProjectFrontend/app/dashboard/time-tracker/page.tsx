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
    return "The implementation looks ready. Wrap up and send it for leader review."
  }

  if (task.status === "REVIEW") {
    return "Your work is waiting for the team leader review, so shift your focus to the next assignment."
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
        className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-primary/[0.10] via-background to-background shadow-sm"
      >
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.16),_transparent_65%)] lg:block" />
        <div className="relative grid gap-8 p-6 sm:p-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Built around your real team tasks
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Time Tracker
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Keep your graduation project moving with a clear next step, a visible focus
              session, and a calmer layout for the work assigned to you in{" "}
              <span className="font-semibold text-foreground">{team.name}</span>.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/dashboard/tasks">
                <Button className="rounded-xl">
                  Open Tasks Board
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button
                className="rounded-xl bg-transparent"
                variant="outline"
                onClick={() => void refreshAssignedTasks()}
                disabled={isLoadingTasks}
              >
                {isLoadingTasks ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Refresh Queue
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              {
                label: "Focused Today",
                value: formatCompactDuration(todaySeconds),
                helper: `Goal ${formatCompactDuration(TODAY_GOAL_SECONDS)}`,
              },
              {
                label: "Live Session",
                value: formatCompactDuration(liveSessionSeconds),
                helper: focusTimer.isRunning ? "Timer is running now" : "Ready for the next sprint",
              },
              {
                label: "Open Tasks",
                value: String(activeTasks.length),
                helper: recommendedTask ? "Top priority already suggested" : "Queue is currently clear",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border/60 bg-background/80 p-4 backdrop-blur"
              >
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Needs Acceptance",
            value: stats.needsAction,
            helper: "Tasks waiting for you to claim",
          },
          {
            label: "In Progress",
            value: stats.inProgress,
            helper: "Tasks you are actively working on",
          },
          {
            label: "In Review",
            value: stats.inReview,
            helper: "Waiting for leader feedback",
          },
          {
            label: "Completed",
            value: stats.completed,
            helper: "Finished tasks assigned to you",
          },
        ].map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="gap-3 border-border/60 bg-background/80 p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="text-3xl font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.helper}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.28fr)_350px] 2xl:grid-cols-[minmax(0,1.3fr)_370px]">
        <div className="space-y-6">
          <Card className="overflow-hidden border-border/60 bg-background/90 shadow-sm">
            <div className="border-b border-border/60 bg-gradient-to-r from-primary/12 via-primary/[0.05] to-transparent p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    Your Best Next Move
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {recommendedTask ? recommendedTask.title : "No active tasks right now"}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {recommendedTask
                      ? getTaskFocusMessage(recommendedTask)
                      : "Once your leader assigns a new task, it will show up here automatically."}
                  </p>
                </div>

                {recommendedTask ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      STATUS_META[recommendedTask.status].badgeClassName,
                    )}
                  >
                    {STATUS_META[recommendedTask.status].label}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Suggested Action
                </p>
                <p className="mt-2 text-base font-semibold">
                  {recommendedTask ? getTaskActionLabel(recommendedTask) : "Wait for assignment"}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {recommendedTask
                    ? recommendedTask.description || "Open the board for the full brief."
                    : "Your queue is clear."}
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Deadline
                </p>
                <p className="mt-2 text-base font-semibold">
                  {recommendedTask ? formatDateLabel(recommendedTask.endDate) : "No deadline"}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {recommendedTask?.isPastEndDate
                    ? "This task is overdue and deserves immediate attention."
                    : "Stay aligned with your project milestones and keep moving steadily."}
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Workflow Progress
                </p>
                <p className="mt-2 text-base font-semibold">
                  {recommendedTask ? STATUS_META[recommendedTask.status].label : "No workflow yet"}
                </p>
                <Progress
                  value={recommendedTask ? STATUS_META[recommendedTask.status].progress : 0}
                  className="mt-4 h-2"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {recommendedTask
                    ? `${STATUS_META[recommendedTask.status].progress}% across the workflow`
                    : "Waiting for the next assignment to enter your workflow"}
                </p>
              </div>
            </div>

            {recommendedTask ? (
              <div className="flex flex-wrap gap-3 border-t border-border/60 p-6">
                <Button
                  variant="outline"
                  className="rounded-xl bg-transparent"
                  onClick={() => selectFocusTask(recommendedTask.id)}
                >
                  Focus on Recommended Task
                </Button>

                {recommendedTask.permissions.canAccept ? (
                  <Button
                    className="rounded-xl"
                    onClick={() => void handleTaskAction(recommendedTask, "accept")}
                    disabled={taskActionInFlight === `${recommendedTask.id}:accept`}
                  >
                    {taskActionInFlight === `${recommendedTask.id}:accept` ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    Accept Task
                  </Button>
                ) : null}

                {recommendedTask.permissions.canSubmitForReview ? (
                  <Button
                    variant="secondary"
                    className="rounded-xl"
                    onClick={() => void handleTaskAction(recommendedTask, "submit")}
                    disabled={taskActionInFlight === `${recommendedTask.id}:submit`}
                  >
                    {taskActionInFlight === `${recommendedTask.id}:submit` ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Submit for Review
                  </Button>
                ) : null}

                <Link href={`/dashboard/tasks?taskId=${recommendedTask.id}`}>
                  <Button variant="ghost" className="rounded-xl">
                    Task Details
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : null}
          </Card>

          <Card id="task-queue" className="border-border/60 bg-background/90 p-6 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-border/60 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold">My Task Queue</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ordered by what deserves your attention first, with cleaner paging for longer queues.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {tasks.length} tasks
                </Badge>
                {tasks.length > 0 ? (
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-muted-foreground">
                    Showing {taskRangeStart}-{taskRangeEnd}
                  </Badge>
                ) : null}
              </div>
            </div>

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
                <div className="mt-6 space-y-4">
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
                        className={cn(
                          "rounded-[24px] border p-5 transition-all",
                          isSelectedTask
                            ? "border-primary/35 bg-primary/[0.05] shadow-sm"
                            : "border-border/60 bg-background/70 hover:border-primary/20 hover:bg-background",
                        )}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-xs">
                                #{(tasksPage - 1) * TASKS_PER_PAGE + index + 1}
                              </Badge>
                              <h3 className="text-lg font-semibold">{task.title}</h3>
                              <Badge
                                variant="outline"
                                className={cn("rounded-full", STATUS_META[task.status].badgeClassName)}
                              >
                                {STATUS_META[task.status].label}
                              </Badge>
                              <Badge variant="secondary" className="rounded-full capitalize">
                                {task.priority.toLowerCase()}
                              </Badge>
                            </div>

                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                              {task.description || "Open the task details to read the full assignment brief."}
                            </p>

                            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1">
                                <Clock3 className="h-3.5 w-3.5" />
                                {task.permissions.canAccept
                                  ? "Ready to start"
                                  : STATUS_META[task.status].label}
                              </span>
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1">
                                <Timer className="h-3.5 w-3.5" />
                                {task.taskType.toLowerCase()}
                              </span>
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1">
                                <Target className="h-3.5 w-3.5" />
                                Due {formatDateLabel(task.endDate)}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 lg:max-w-[240px] lg:justify-end">
                            <Button
                              variant={isSelectedTask ? "default" : "outline"}
                              className={cn("rounded-xl", !isSelectedTask && "bg-transparent")}
                              onClick={() => selectFocusTask(task.id)}
                            >
                              Focus on This
                            </Button>

                            {task.permissions.canAccept ? (
                              <Button
                                className="rounded-xl"
                                onClick={() => void handleTaskAction(task, "accept")}
                                disabled={pendingAccept}
                              >
                                {pendingAccept ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="mr-2 h-4 w-4" />
                                )}
                                Accept
                              </Button>
                            ) : null}

                            {task.permissions.canSubmitForReview ? (
                              <Button
                                variant="secondary"
                                className="rounded-xl"
                                onClick={() => void handleTaskAction(task, "submit")}
                                disabled={pendingSubmit}
                              >
                                {pendingSubmit ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                )}
                                Submit
                              </Button>
                            ) : null}

                            <Link href={`/dashboard/tasks?taskId=${task.id}`}>
                              <Button variant="ghost" className="rounded-xl">
                                Open
                              </Button>
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
          </Card>
        </div>

        <div className="self-start xl:sticky xl:top-6">
          <div className="space-y-4">
            <Card className="overflow-hidden border-border/60 bg-background/95 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        focusTimer.isRunning ? "animate-pulse bg-emerald-500" : "bg-primary/50",
                      )}
                    />
                    {focusTimer.isRunning
                      ? "Live focus session"
                      : liveSessionSeconds > 0
                        ? "Paused focus session"
                        : "Ready to focus"}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold">Focus Session</h2>
                  <p className="mt-1 max-w-[22rem] text-sm leading-6 text-muted-foreground">
                    A calmer timer panel that keeps the current task and session controls within easy reach.
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-primary/10 p-2.5 text-primary">
                  <Timer className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-5 space-y-3.5">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Focus Task
                  </p>
                  <Select
                    value={selectedTask?.id ?? ""}
                    onValueChange={selectFocusTask}
                    disabled={!activeTasks.length}
                  >
                    <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-background/80">
                      <SelectValue placeholder="Select a task to focus on" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTasks.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-[24px] border border-primary/15 bg-gradient-to-br from-primary/12 via-background to-primary/[0.03] p-5 text-center shadow-[inset_0_1px_0_hsl(var(--background)/0.7)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Current Session
                  </p>
                  <p className="mt-3 font-mono text-[2.6rem] font-bold tracking-tight text-foreground sm:text-[3rem]">
                    {formatDuration(liveSessionSeconds)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {selectedTask
                      ? `Tracking work on "${selectedTask.title}"`
                      : "Choose a task to start your first focus session."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Selected Task
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-foreground">
                      {selectedTask?.title ?? "No task selected"}
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                      {selectedTask
                        ? getTaskFocusMessage(selectedTask)
                        : "Pick a task from your queue to begin a focused session."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Session Status
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-foreground">
                      {focusTimer.isRunning
                        ? "Deep work in progress"
                        : liveSessionSeconds > 0
                          ? "Paused and ready to resume"
                          : "No session started yet"}
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                      {liveSessionSeconds > 0
                        ? `${formatCompactDuration(liveSessionSeconds)} already captured in this session.`
                        : "Your first saved session will appear in the log below."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-3">
                  {!focusTimer.isRunning ? (
                    <Button
                      className="h-11 rounded-2xl sm:col-span-2"
                      onClick={handleStartTimer}
                      disabled={!selectedTask}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {liveSessionSeconds > 0 ? "Resume Session" : "Start Focus"}
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
