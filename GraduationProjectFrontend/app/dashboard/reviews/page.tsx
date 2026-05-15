"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCode,
  FileText,
  Github,
  GitBranch,
  GitPullRequest,
  Layers3,
  Link2,
  Loader2,
  Lock,
  Paperclip,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { tasksApi } from "@/lib/api/tasks"
import type { ApiTask, ApiTaskIntegrationMode, ApiTaskPriority, ApiTaskSubmissionEvidence, ApiTaskType } from "@/lib/api/types"
import { useAuthStore } from "@/lib/stores/auth-store"
import { cn } from "@/lib/utils"

type ReviewSort = "submitted-desc" | "submitted-asc" | "priority" | "team"

const PRIORITY_COLOR: Record<ApiTaskPriority, string> = {
  LOW: "border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400",
  MEDIUM: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  HIGH: "border-orange-500/30 bg-orange-500/5 text-orange-700 dark:text-orange-400",
  CRITICAL: "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400",
}

const TASK_TYPE_LABEL: Record<ApiTaskType, string> = {
  CODE: "Code",
  DOCUMENTATION: "Documentation",
  DESIGN: "Design",
  RESEARCH: "Research",
  MEETING: "Meeting",
  PRESENTATION: "Presentation",
  OTHER: "Other",
}

const TASK_TYPE_OPTIONS: Array<{ value: ApiTaskType; label: string }> = [
  { value: "CODE", label: "Code" },
  { value: "DOCUMENTATION", label: "Documentation" },
  { value: "DESIGN", label: "Design" },
  { value: "RESEARCH", label: "Research" },
  { value: "MEETING", label: "Meeting" },
  { value: "PRESENTATION", label: "Presentation" },
  { value: "OTHER", label: "Other" },
]

const MODE_LABEL: Record<ApiTaskIntegrationMode, string> = {
  GITHUB: "GitHub",
  MANUAL: "Manual",
}

const PRIORITY_SORT: Record<ApiTaskPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

const PAGE_SIZE_OPTIONS = [5, 10, 20]

/** Minimum length for a "Request Resubmission" comment. Forces the reviewer
 *  to leave a meaningful, actionable reason — not just "no" or "redo." */
const RESUBMISSION_MIN_LENGTH = 10

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function fullName(user?: { firstName?: string; lastName?: string; fullName?: string } | null) {
  if (!user) return ""
  return user.fullName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not submitted"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not submitted"
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function formatFileSize(value?: number | null) {
  if (!value || value <= 0) return "Unknown size"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function getSubmittedTime(task: ApiTask) {
  const time = task.submittedForReviewAt ? new Date(task.submittedForReviewAt).getTime() : 0
  return Number.isNaN(time) ? 0 : time
}

function formatWaitTime(task: ApiTask) {
  const submittedAt = getSubmittedTime(task)
  if (!submittedAt) return "No timestamp"

  const minutes = Math.max(0, Math.floor((Date.now() - submittedAt) / 60000))
  if (minutes < 60) return `${Math.max(1, minutes)}m waiting`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h waiting`

  const days = Math.floor(hours / 24)
  return `${days}d waiting`
}

function matchesSearch(task: ApiTask, query: string) {
  if (!query) return true
  const assigneeName = fullName(task.assignee)
  const pullRequestNumber = task.github?.pullRequest.number ? `pr ${task.github.pullRequest.number}` : ""
  const haystack = [
    task.title,
    task.description,
    task.team?.name,
    assigneeName,
    TASK_TYPE_LABEL[task.taskType],
    MODE_LABEL[task.integrationMode],
    pullRequestNumber,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes(query)
}

function sortTasks(tasks: ApiTask[], sortBy: ReviewSort) {
  return [...tasks].sort((a, b) => {
    if (sortBy === "submitted-asc") return getSubmittedTime(a) - getSubmittedTime(b)
    if (sortBy === "priority") {
      const priorityDelta = PRIORITY_SORT[a.priority] - PRIORITY_SORT[b.priority]
      if (priorityDelta !== 0) return priorityDelta
      return getSubmittedTime(a) - getSubmittedTime(b)
    }
    if (sortBy === "team") {
      const teamDelta = (a.team?.name ?? "").localeCompare(b.team?.name ?? "")
      if (teamDelta !== 0) return teamDelta
      return getSubmittedTime(a) - getSubmittedTime(b)
    }
    return getSubmittedTime(b) - getSubmittedTime(a)
  })
}

export default function ReviewTasksPage() {
  const { currentUser } = useAuthStore()
  const role = currentUser?.role?.toLowerCase() ?? ""
  const canView = role === "ta" || role === "admin" || role === "leader"
  const reviewerRoleLabel = role === "leader" ? "Team Leader" : role === "admin" ? "Admin" : "TA"

  const [tasks, setTasks] = useState<ApiTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [search, setSearch] = useState("")
  const [teamFilter, setTeamFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState<"all" | ApiTaskPriority>("all")
  const [modeFilter, setModeFilter] = useState<"all" | ApiTaskIntegrationMode>("all")
  const [typeFilter, setTypeFilter] = useState<"all" | ApiTaskType>("all")
  const [sortBy, setSortBy] = useState<ReviewSort>("submitted-desc")
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  const [selectedTask, setSelectedTask] = useState<ApiTask | null>(null)
  const [reviewComment, setReviewComment] = useState("")
  const [submittingReview, setSubmittingReview] = useState<null | "approve" | "reject">(null)
  const [taskEvidence, setTaskEvidence] = useState<ApiTaskSubmissionEvidence[]>([])
  const [loadingEvidence, setLoadingEvidence] = useState(false)
  const selectedManualTaskId = selectedTask?.integrationMode === "MANUAL" ? selectedTask.id : null

  const fetchData = useCallback(async () => {
    setError(false)
    try {
      setTasks(await tasksApi.list({ status: "REVIEW" }))
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    if (!canView) {
      setLoading(false)
      return
    }

    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [canView, fetchData])

  useEffect(() => {
    setPage(1)
  }, [search, teamFilter, priorityFilter, modeFilter, typeFilter, sortBy, pageSize])

  useEffect(() => {
    if (!selectedManualTaskId) {
      setTaskEvidence([])
      setLoadingEvidence(false)
      return
    }

    let cancelled = false
    setLoadingEvidence(true)
    tasksApi
      .listEvidence(selectedManualTaskId)
      .then((items) => {
        if (!cancelled) setTaskEvidence(items)
      })
      .catch(() => {
        if (!cancelled) setTaskEvidence([])
      })
      .finally(() => {
        if (!cancelled) setLoadingEvidence(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedManualTaskId])

  const teamOptions = useMemo(() => {
    const unique = new Map<string, string>()
    tasks.forEach((task) => {
      if (task.team?.id) unique.set(task.team.id, task.team.name)
    })
    return Array.from(unique, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [tasks])

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase()
    return sortTasks(
      tasks.filter((task) => {
        if (teamFilter !== "all" && task.team.id !== teamFilter) return false
        if (priorityFilter !== "all" && task.priority !== priorityFilter) return false
        if (modeFilter !== "all" && task.integrationMode !== modeFilter) return false
        if (typeFilter !== "all" && task.taskType !== typeFilter) return false
        return matchesSearch(task, query)
      }),
      sortBy,
    )
  }, [modeFilter, priorityFilter, search, sortBy, tasks, teamFilter, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize))

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const pageTasks = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredTasks.slice(start, start + pageSize)
  }, [filteredTasks, page, pageSize])

  const stats = useMemo(() => {
    const oldest = sortTasks(tasks, "submitted-asc")[0]
    return [
      { label: "Waiting", value: tasks.length, icon: Clock, tone: "text-cyan-600", bg: "bg-cyan-500/10" },
      { label: "Teams", value: teamOptions.length, icon: Users, tone: "text-blue-600", bg: "bg-blue-500/10" },
      { label: "GitHub", value: tasks.filter((task) => task.integrationMode === "GITHUB").length, icon: Github, tone: "text-violet-600", bg: "bg-violet-500/10" },
      { label: "Oldest", value: oldest ? formatWaitTime(oldest) : "None", icon: AlertCircle, tone: "text-amber-600", bg: "bg-amber-500/10" },
    ]
  }, [tasks, teamOptions.length])

  const hasActiveFilters =
    Boolean(search.trim()) ||
    teamFilter !== "all" ||
    priorityFilter !== "all" ||
    modeFilter !== "all" ||
    typeFilter !== "all" ||
    sortBy !== "submitted-desc" ||
    pageSize !== 10

  const resultStart = filteredTasks.length === 0 ? 0 : (page - 1) * pageSize + 1
  const resultEnd = Math.min(page * pageSize, filteredTasks.length)

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  function clearFilters() {
    setSearch("")
    setTeamFilter("all")
    setPriorityFilter("all")
    setModeFilter("all")
    setTypeFilter("all")
    setSortBy("submitted-desc")
    setPageSize(10)
  }

  async function handleApprove(task: ApiTask) {
    setSubmittingReview("approve")
    try {
      const updated = await tasksApi.approve(task.id, {
        reviewComment: reviewComment.trim() || undefined,
      })
      setTasks((current) => current.filter((item) => item.id !== updated.id))
      setSelectedTask(null)
      setReviewComment("")
      toast.success(task.github?.pullRequest.number ? "Task approved. The pull request was not merged." : "Task approved")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to approve")
    } finally {
      setSubmittingReview(null)
    }
  }

  async function handleReject(task: ApiTask) {
    const trimmedComment = reviewComment.trim()
    if (trimmedComment.length < RESUBMISSION_MIN_LENGTH) {
      toast.error(
        `Add at least ${RESUBMISSION_MIN_LENGTH} characters explaining what needs to change before requesting resubmission.`,
      )
      return
    }

    setSubmittingReview("reject")
    try {
      const updated = await tasksApi.reject(task.id, { reviewComment: trimmedComment })
      setTasks((current) => current.filter((item) => item.id !== updated.id))
      setSelectedTask(null)
      setReviewComment("")
      toast.success("Resubmission requested")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to request resubmission")
    } finally {
      setSubmittingReview(null)
    }
  }

  if (!canView) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="max-w-md border-border/60 p-10 text-center">
          <Lock className="mx-auto mb-5 h-12 w-12 text-destructive" />
          <h2 className="mb-2 text-2xl font-bold">Reviewer Access Only</h2>
          <p className="text-sm leading-6 text-muted-foreground">This review queue is open to team leaders, TAs, and admins. Either reviewer can approve or request resubmission on a team's task.</p>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-border/60 bg-card"
      >
        <div className="border-t-4 border-cyan-500 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                  {reviewerRoleLabel} queue
                </Badge>
                <Badge variant="secondary">{filteredTasks.length} visible</Badge>
              </div>
              <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
                <GitPullRequest className="h-7 w-7 text-cyan-500" />
                Review Tasks
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Review submitted team tasks, inspect GitHub evidence, approve completed work, or request a focused resubmission.
              </p>
            </div>
            <Button variant="outline" className="h-10 gap-2 rounded-xl bg-transparent" onClick={() => void handleRefresh()} disabled={refreshing}>
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <Card className="border-border/60 p-4">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", stat.bg)}>
                  <stat.icon className={cn("h-5 w-5", stat.tone)} />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="border-border/60 p-4">
        <div className="mb-3 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Filters</p>
          {hasActiveFilters ? <Badge variant="secondary" className="ml-auto text-[10px]">Active</Badge> : null}
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(140px,1fr))_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search task, assignee, team, PR..."
              className="h-10 rounded-xl pl-9"
            />
          </div>

          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Team" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {teamOptions.map((team) => (
                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as "all" | ApiTaskPriority)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={modeFilter} onValueChange={(value) => setModeFilter(value as "all" | ApiTaskIntegrationMode)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Mode" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modes</SelectItem>
              <SelectItem value="GITHUB">GitHub</SelectItem>
              <SelectItem value="MANUAL">Manual</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as "all" | ApiTaskType)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TASK_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as ReviewSort)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted-desc">Newest first</SelectItem>
              <SelectItem value="submitted-asc">Oldest first</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="team">Team</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" className="h-10 rounded-xl" onClick={clearFilters} disabled={!hasActiveFilters}>
            Clear
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={index} className="border-border/60 p-5">
              <Skeleton className="mb-3 h-5 w-1/3" />
              <Skeleton className="mb-4 h-4 w-2/3" />
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-border/60 p-10 text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <p className="mb-4 text-sm text-muted-foreground">Failed to load review tasks.</p>
          <Button variant="outline" onClick={() => void fetchData()}>Try again</Button>
        </Card>
      ) : filteredTasks.length === 0 ? (
        <Card className="border-dashed border-border/70 p-10 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-11 w-11 text-emerald-500" />
          <p className="mb-1 font-semibold">No matching review tasks</p>
          <p className="text-sm text-muted-foreground">
            {tasks.length === 0 ? "No tasks are awaiting review right now." : "Try clearing filters or changing the team scope."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {pageTasks.map((task, index) => {
              const assigneeName = fullName(task.assignee) || "Unassigned"
              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: Math.min(index * 0.025, 0.18) }}
                >
                  <Card className="overflow-hidden border-border/60 transition-all hover:border-cyan-500/30 hover:shadow-md">
                    <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                      <div className="flex min-w-0 gap-4">
                        <div className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                          task.integrationMode === "GITHUB" ? "bg-violet-500/10 text-violet-600" : "bg-cyan-500/10 text-cyan-600",
                        )}>
                          {task.integrationMode === "GITHUB" ? <Github className="h-5 w-5" /> : <FileCode className="h-5 w-5" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold">{task.title}</h3>
                            <Badge variant="outline" className={cn("text-[10px]", PRIORITY_COLOR[task.priority])}>{task.priority}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{task.team.name}</Badge>
                            <Badge variant="outline" className="text-[10px]">{TASK_TYPE_LABEL[task.taskType]}</Badge>
                          </div>
                          {task.description ? (
                            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{task.description}</p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={task.assignee?.avatarUrl ?? undefined} />
                                <AvatarFallback className="text-[8px]">{getInitials(assigneeName)}</AvatarFallback>
                              </Avatar>
                              {assigneeName}
                            </span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatWaitTime(task)}</span>
                            <span className="flex items-center gap-1"><Layers3 className="h-3 w-3" /> {MODE_LABEL[task.integrationMode]}</span>
                            {task.github?.commitCount ? <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> {task.github.commitCount} commits</span> : null}
                            {task.github?.pullRequest.url ? (
                              <Link href={task.github.pullRequest.url} target="_blank" className="flex items-center gap-1 text-primary hover:underline">
                                PR #{task.github.pullRequest.number}<ExternalLink className="h-3 w-3" />
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Badge variant="outline" className="h-8 rounded-xl px-3 text-[10px]">
                          Submitted {formatDateTime(task.submittedForReviewAt)}
                        </Badge>
                        <Button
                          size="sm"
                          className="h-9 rounded-xl"
                          onClick={() => {
                            setSelectedTask(task)
                            setReviewComment("")
                          }}
                        >
                          Review
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>

          <Card className="border-border/60 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{resultStart}</span>-<span className="font-medium text-foreground">{resultEnd}</span> of <span className="font-medium text-foreground">{filteredTasks.length}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                  <SelectTrigger className="h-9 w-[112px] rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>{option} / page</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-9 rounded-xl bg-transparent" onClick={() => setPage(1)} disabled={page === 1}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-9 rounded-xl bg-transparent" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="min-w-[76px] text-center text-sm font-medium">
                  {page} / {totalPages}
                </span>
                <Button variant="outline" size="sm" className="h-9 rounded-xl bg-transparent" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-9 rounded-xl bg-transparent" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Dialog open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitPullRequest className="h-5 w-5 text-cyan-500" />
              {reviewerRoleLabel} Review
            </DialogTitle>
            <DialogDescription>
              {selectedTask && selectedTask.status !== "REVIEW"
                ? "This task was already closed by another reviewer. Your review will be recorded as a follow-up — it won't change the task status."
                : "Approve the task when the work is acceptable, or request a resubmission with a clear reason for the student."}
            </DialogDescription>
          </DialogHeader>

          {selectedTask ? (
            <div className="mt-2 space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{selectedTask.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{selectedTask.description || "No description provided."}</p>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px]", PRIORITY_COLOR[selectedTask.priority])}>{selectedTask.priority}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {selectedTask.team?.name}
                  {selectedTask.assignee ? <> - assigned to <b>{fullName(selectedTask.assignee)}</b></> : null}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Submitted</p>
                  <p className="mt-1 text-sm font-medium">{formatDateTime(selectedTask.submittedForReviewAt)}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Commits</p>
                  <p className="mt-1 text-sm font-medium">{selectedTask.github?.commitCount ?? 0}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pull Request</p>
                  {selectedTask.github?.pullRequest.url ? (
                    <Link href={selectedTask.github.pullRequest.url} target="_blank" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                      PR #{selectedTask.github.pullRequest.number}<ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">None</p>
                  )}
                </div>
              </div>

              {selectedTask.integrationMode === "MANUAL" ? (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">Manual evidence</p>
                    </div>
                    <Badge variant="secondary">{taskEvidence.length} item{taskEvidence.length === 1 ? "" : "s"}</Badge>
                  </div>

                  {loadingEvidence ? (
                    <p className="text-sm text-muted-foreground">Loading evidence...</p>
                  ) : taskEvidence.length === 0 ? (
                    <p className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200">
                      No evidence was found for this manual submission.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {taskEvidence.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            {item.type === "LINK" ? <Link2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link href={item.url} target="_blank" className="block truncate text-sm font-medium hover:text-primary hover:underline">
                              {item.title}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.type === "FILE" ? `${item.fileName || "File"} - ${formatFileSize(item.fileSize)}` : item.url}
                            </p>
                          </div>
                          {item.submittedAt ? <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">Submitted</Badge> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label>
                    {reviewerRoleLabel} review note
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      (required for Request Resubmission)
                    </span>
                  </Label>
                  {/* Live counter — turns muted once the minimum is met */}
                  <span
                    className={cn(
                      "text-[10px] tabular-nums",
                      reviewComment.trim().length >= RESUBMISSION_MIN_LENGTH
                        ? "text-muted-foreground/70"
                        : "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {reviewComment.trim().length} / {RESUBMISSION_MIN_LENGTH} min for resubmission
                  </span>
                </div>
                <Textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  placeholder="Approval note (optional), or the exact reason the student must resubmit (required)..."
                  className={cn(
                    "mt-1.5 resize-none rounded-xl transition-colors",
                    // When the textarea is non-empty but below minimum, hint with an amber border
                    reviewComment.trim().length > 0 && reviewComment.trim().length < RESUBMISSION_MIN_LENGTH
                      ? "border-amber-500/50 focus-visible:ring-amber-500/30"
                      : "",
                  )}
                  rows={5}
                />
                {reviewComment.trim().length > 0 && reviewComment.trim().length < RESUBMISSION_MIN_LENGTH ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] leading-4 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-3 w-3" />
                    Resubmission needs at least {RESUBMISSION_MIN_LENGTH} characters so the student knows what to fix.
                  </p>
                ) : null}
              </div>

              {selectedTask.reviews && selectedTask.reviews.length > 0 ? (
                <div>
                  <Label>Prior reviews on this task</Label>
                  <div className="mt-1.5 space-y-2">
                    {selectedTask.reviews.map((review) => (
                      <div
                        key={review.id}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-xs",
                          review.decision === "APPROVED"
                            ? "border-emerald-500/25 bg-emerald-500/[0.05]"
                            : "border-amber-500/25 bg-amber-500/[0.05]",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">
                            {review.reviewer?.fullName ?? "Reviewer"}
                            <span className="ml-1.5 text-muted-foreground">
                              ({review.reviewerRole === "LEADER" ? "Team Leader" : review.reviewerRole === "TA" ? "TA" : "Admin"})
                            </span>
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "border-0 text-[10px]",
                              review.decision === "APPROVED"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                            )}
                          >
                            {review.decision === "APPROVED" ? "Approved" : "Resubmission requested"}
                          </Badge>
                        </div>
                        {review.comment ? (
                          <p className="mt-1 leading-5 text-muted-foreground">{review.comment}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedTask.github?.pullRequest.number ? (
                <div>
                  <Label>Pull request note</Label>
                  <p className="mt-1.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
                    Approving records your decision in GPMS and on the pull request. It does not merge the PR.
                  </p>
                </div>
              ) : null}

              <DialogFooter className="flex-col gap-2 sm:gap-2">
                {/* Inline reminder when reject is gated — explains why the button is disabled */}
                {reviewComment.trim().length < RESUBMISSION_MIN_LENGTH && submittingReview === null ? (
                  <p className="w-full text-center text-[11px] text-muted-foreground sm:text-left">
                    Add a {RESUBMISSION_MIN_LENGTH}+ character review note to enable <b>Request Resubmission</b>.
                  </p>
                ) : null}
                <div className="flex w-full gap-2">
                  <Button
                    onClick={() => void handleApprove(selectedTask)}
                    disabled={submittingReview !== null}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {submittingReview === "approve" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ThumbsUp className="mr-2 h-4 w-4" />
                    )}
                    {submittingReview === "approve" ? "Approving…" : "Approve Task"}
                  </Button>
                  <Button
                    onClick={() => void handleReject(selectedTask)}
                    disabled={
                      submittingReview !== null ||
                      reviewComment.trim().length < RESUBMISSION_MIN_LENGTH
                    }
                    variant="outline"
                    className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {submittingReview === "reject" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ThumbsDown className="mr-2 h-4 w-4" />
                    )}
                    {submittingReview === "reject" ? "Sending back…" : "Request Resubmission"}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
