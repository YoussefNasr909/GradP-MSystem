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

function ReviewForm({
  selectedTask,
  submittingReview,
  onApprove,
  onReject,
}: {
  selectedTask: ApiTask
  submittingReview: null | "approve" | "reject"
  onApprove: (task: ApiTask, comment?: string) => void
  onReject: (task: ApiTask, comment: string) => void
}) {
  const [reviewComment, setReviewComment] = useState("")

  return (
    <div className="shrink-0 h-auto max-h-[50vh] lg:max-h-none lg:h-full lg:flex lg:flex-col border-t lg:border-t-0 lg:border-l border-border/40 bg-background lg:bg-muted/[0.02] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.05)] lg:shadow-none z-20 flex flex-col transition-all">
      <div className="flex-1 overflow-y-auto p-5 lg:p-8 scrollbar-thin">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Review Feedback</h4>
              </div>
              <span className={cn(
                "text-[9px] font-semibold tabular-nums tracking-widest uppercase",
                reviewComment.trim().length >= RESUBMISSION_MIN_LENGTH ? "text-emerald-600/70" : "text-amber-600/70"
              )}>
                {reviewComment.trim().length} / {RESUBMISSION_MIN_LENGTH} MIN
              </span>
            </div>
            <div className="group relative">
              <Textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="Provide detailed feedback for the team..."
                className="min-h-[120px] sm:min-h-[220px] w-full resize-none rounded-2xl sm:rounded-3xl border-border/40 bg-background p-4 sm:p-5 text-sm font-medium leading-relaxed shadow-sm transition-all focus:ring-primary/20 group-hover:border-primary/20"
              />
              <div className="absolute bottom-5 right-5 flex h-7 w-7 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground/30">
                <FileText className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>

          {reviewComment.trim().length > 0 && reviewComment.trim().length < RESUBMISSION_MIN_LENGTH && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-amber-500/[0.03] p-4 border border-amber-500/10">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-amber-600/70 shrink-0" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700/70 leading-tight">
                  More detail required for resubmission
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/40 bg-background/50 p-5 lg:p-8 backdrop-blur-md">
        <div className="space-y-3">
          <Button
            onClick={() => void onApprove(selectedTask, reviewComment)}
            disabled={submittingReview !== null}
            className="h-12 w-full rounded-xl bg-emerald-600 text-sm font-bold tracking-tight shadow-lg shadow-emerald-600/10 transition-all hover:bg-emerald-700 hover:scale-[1.01] active:scale-[0.99]"
          >
            {submittingReview === "approve" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
            Approve Work
          </Button>
          <Button
            onClick={() => void onReject(selectedTask, reviewComment)}
            disabled={submittingReview !== null || reviewComment.trim().length < RESUBMISSION_MIN_LENGTH}
            variant="outline"
            className="h-12 w-full rounded-xl border-destructive/20 text-destructive text-sm font-bold tracking-tight transition-all hover:bg-destructive hover:text-white hover:scale-[1.01] active:scale-[0.99]"
          >
            {submittingReview === "reject" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsDown className="mr-2 h-4 w-4" />}
            Request Changes
          </Button>
          <p className="text-center text-[9px] font-medium uppercase tracking-widest text-muted-foreground/20">
            Changes are final after submission
          </p>
        </div>
      </div>
    </div>
  )
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

  async function handleApprove(task: ApiTask, comment?: string) {
    setSubmittingReview("approve")
    try {
      const updated = await tasksApi.approve(task.id, {
        reviewComment: comment?.trim() || undefined,
      })
      setTasks((current) => current.filter((item) => item.id !== updated.id))
      setSelectedTask(null)
      
      toast.success(task.github?.pullRequest.number ? "Task approved. The pull request was not merged." : "Task approved")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to approve")
    } finally {
      setSubmittingReview(null)
    }
  }

  async function handleReject(task: ApiTask, comment: string) {
    const trimmedComment = comment.trim()
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
          <p className="text-sm leading-6 text-muted-foreground">This review queue is open to team leaders, TAs, and admins. Either reviewer can approve or request resubmission on a team&apos;s task.</p>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-[1600px] mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
      {/* ── Hero Section ────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[32px] border border-border/40 bg-white dark:bg-zinc-950 shadow-sm"
      >
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-violet-500/5 blur-3xl" />
        
        <div className="relative px-8 py-8 sm:px-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">

              <div className="space-y-2">
                <h1 className="flex items-center gap-5 text-4xl font-bold tracking-tight sm:text-5xl text-foreground/90">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 shadow-sm ring-1 ring-cyan-500/20">
                    <GitPullRequest className="h-8 w-8" />
                  </div>
                  Review Tasks
                </h1>
                <p className="max-w-xl text-lg font-medium leading-relaxed text-muted-foreground/60">
                  Manage team submissions, inspect evidence, and provide quality feedback.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[500px]">
              {stats.map((stat) => (
                <motion.div 
                  key={stat.label}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                  className="group flex flex-col items-center justify-center rounded-2xl bg-muted/30 p-4 transition-all hover:bg-muted/50"
                >
                  <div className="mb-2 flex items-center justify-center transition-transform group-hover:scale-105">
                    <stat.icon className={cn("h-7 w-7", stat.tone)} />
                  </div>
                  
                  

                  <div className="text-center space-y-1">
                    <p className="text-2xl font-bold tracking-tight text-foreground/90 tabular-nums leading-none">{stat.value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none">{stat.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Main Review Interface ────────────────────────── */}
      <Card className="border-border/40 bg-card/30 shadow-sm backdrop-blur-sm overflow-hidden">
        {/* Filter Section */}
        <div className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground/50">Filter & Organize</h2>
            {hasActiveFilters ? (
              <Badge variant="secondary" className="ml-auto rounded-full bg-primary/10 px-3 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                Active Filters
              </Badge>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center">
            <div className="relative group col-span-2 sm:col-span-3 lg:flex-1 lg:min-w-[240px]">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40 transition-colors group-focus-within:text-primary" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks, teams, assignees..."
                className="h-11 rounded-xl border-border/40 bg-background/50 pl-10 focus:bg-background transition-all font-medium text-sm w-full"
              />
            </div>

            {role !== "leader" && (
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background/50 font-semibold text-sm lg:w-[130px] transition-all hover:bg-muted/50"><SelectValue placeholder="Team" /></SelectTrigger>
                <SelectContent className="rounded-2xl shadow-xl">
                  <SelectItem value="all" className="font-medium">All teams</SelectItem>
                  {teamOptions.map((team) => (
                    <SelectItem key={team.id} value={team.id} className="font-medium">{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as "all" | ApiTaskPriority)}>
              <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background/50 font-semibold text-sm lg:w-[130px] transition-all hover:bg-muted/50"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent className="rounded-2xl shadow-xl">
                <SelectItem value="all" className="font-medium">All priorities</SelectItem>
                <SelectItem value="CRITICAL" className="font-semibold text-red-600">Critical</SelectItem>
                <SelectItem value="HIGH" className="font-semibold text-orange-600">High</SelectItem>
                <SelectItem value="MEDIUM" className="font-semibold text-amber-600">Medium</SelectItem>
                <SelectItem value="LOW" className="font-semibold text-blue-600">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={modeFilter} onValueChange={(value) => setModeFilter(value as "all" | ApiTaskIntegrationMode)}>
              <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background/50 font-semibold text-sm lg:w-[130px] transition-all hover:bg-muted/50"><SelectValue placeholder="Mode" /></SelectTrigger>
              <SelectContent className="rounded-2xl shadow-xl">
                <SelectItem value="all" className="font-medium">All modes</SelectItem>
                <SelectItem value="GITHUB" className="font-medium">GitHub</SelectItem>
                <SelectItem value="MANUAL" className="font-medium">Manual</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as "all" | ApiTaskType)}>
              <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background/50 font-semibold text-sm lg:w-[130px] transition-all hover:bg-muted/50"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent className="rounded-2xl shadow-xl">
                <SelectItem value="all" className="font-medium">All types</SelectItem>
                {TASK_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="font-medium">{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as ReviewSort)}>
              <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background/50 font-semibold text-sm lg:w-[130px] transition-all hover:bg-muted/50"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent className="rounded-2xl shadow-xl">
                <SelectItem value="submitted-desc" className="font-medium">Newest first</SelectItem>
                <SelectItem value="submitted-asc" className="font-medium">Oldest first</SelectItem>
                <SelectItem value="priority" className="font-medium">Priority</SelectItem>
                <SelectItem value="team" className="font-medium">Team</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="ghost" 
              className="h-11 rounded-xl px-4 font-semibold text-xs uppercase tracking-widest text-muted-foreground hover:text-destructive hover:bg-destructive/5 col-span-2 sm:col-span-3 lg:col-span-1 lg:w-auto transition-all" 
              onClick={clearFilters} 
              disabled={!hasActiveFilters}
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Blurred Separator Line */}
        <div className="relative h-px w-full overflow-hidden">
          <div className="absolute inset-0 bg-border/40 blur-[1px]" />
          <div className="absolute inset-0 bg-border/40" />
        </div>

        {/* Content Section */}
        <div className="min-h-[400px]">
          {loading ? (
            <div className="divide-y divide-border/10">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="p-8">
                  <div className="flex gap-6">
                    <Skeleton className="h-16 w-16 rounded-3xl" />
                    <div className="flex-1 space-y-4">
                      <Skeleton className="h-6 w-1/3 rounded-lg" />
                      <Skeleton className="h-4 w-2/3 rounded-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-20 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="mb-2 text-xl font-bold">Failed to load queue</h3>
              <p className="mb-8 text-sm font-medium text-muted-foreground">There was a problem connecting to the review service.</p>
              <Button variant="outline" onClick={() => void fetchData()} className="rounded-xl px-8 font-bold">Try again</Button>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-24 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-muted/50 text-muted-foreground/40">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="mb-2 text-2xl font-bold tracking-tight text-foreground/80">Queue is empty</h3>
              <p className="text-sm font-medium text-muted-foreground/60">All team submissions have been processed.</p>
            </div>
          ) : (
            <div className="divide-y divide-blue-500/30">
              <AnimatePresence mode="popLayout">
                {pageTasks.map((task, index) => {
                  const assigneeName = fullName(task.assignee) || "Unassigned"
                  const waitTime = formatWaitTime(task)
                  const isOld = waitTime.includes("d") || (waitTime.includes("h") && parseInt(waitTime) > 12)

                  return (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.1) }}
                      className="group relative transition-all duration-300 hover:bg-muted/[0.04]"
                    >
                      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-8">
                        {/* Left side: Task Primary Info */}
                        <div className="flex min-w-0 items-start sm:items-center gap-4 sm:gap-6">
                          <div className={cn(
                            "flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 transition-all duration-300 group-hover:scale-105",
                            task.integrationMode === "GITHUB" ? "bg-violet-500/5 text-violet-500 ring-violet-500/20" : "bg-cyan-500/5 text-cyan-500 ring-cyan-500/20",
                          )}>
                            {task.integrationMode === "GITHUB" ? <Github className="h-6 w-6 sm:h-7 sm:w-7" /> : <FileCode className="h-6 w-6 sm:h-7 sm:w-7" />}
                          </div>

                          <div className="min-w-0 space-y-2 sm:space-y-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 sm:gap-3">
                              <h3 className="text-base sm:text-xl font-bold tracking-tight text-foreground/90 group-hover:text-primary transition-colors duration-300 line-clamp-2 sm:line-clamp-none sm:truncate">
                                {task.title}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={cn("rounded-md border-none px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", PRIORITY_COLOR[task.priority])}>
                                  {task.priority}
                                </Badge>
                                <Badge variant="secondary" className="rounded-md bg-muted/40 px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider truncate max-w-[140px] sm:max-w-[200px]">
                                  {task.team.name}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-7 w-7 ring-2 ring-background shadow-sm transition-transform group-hover:scale-110">
                                  <AvatarImage src={task.assignee?.avatarUrl ?? undefined} />
                                  <AvatarFallback className="text-[10px] font-bold bg-muted">{getInitials(assigneeName)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-semibold text-muted-foreground/80">{assigneeName}</span>
                              </div>
                              <div className={cn("flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest", isOld ? "text-amber-600" : "text-cyan-600")}>
                                <Clock className="h-4 w-4" /> {waitTime}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
                                <Layers3 className="h-4 w-4" /> {MODE_LABEL[task.integrationMode]}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right side: Meta & Action */}
                        <div className="flex items-center justify-between gap-8 sm:justify-end">
                          <div className="hidden flex-col items-end text-right xl:flex">
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Received On</span>
                            <span className="text-xs font-semibold text-foreground/80 tabular-nums">{formatDateTime(task.submittedForReviewAt)}</span>
                          </div>
                          
                          <Button
                            size="default"
                            className="h-10 w-full sm:w-auto rounded-xl bg-primary px-6 text-sm font-bold tracking-tight shadow-lg shadow-primary/10 transition-all hover:scale-[1.02] active:scale-[0.98] group/btn"
                            onClick={() => {
                              setSelectedTask(task)
                              
                            }}
                          >
                            Review Submission
                            <ArrowRight className="ml-2.5 h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {/* Pagination Row */}
              <div className="p-6 border-t border-border/10 bg-muted/[0.01]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-muted-foreground/70">
                    Showing <span className="font-bold text-foreground">{resultStart}</span> to <span className="font-bold text-foreground">{resultEnd}</span> of <span className="font-bold text-foreground">{filteredTasks.length}</span> results
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                      <SelectTrigger className="h-10 w-[120px] rounded-xl border-border/40 bg-background/50 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-xl">
                        {PAGE_SIZE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={String(option)} className="font-medium">{option} / page</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-border/40 bg-background/50" onClick={() => setPage(1)} disabled={page === 1}>
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-border/40 bg-background/50" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex h-10 items-center justify-center rounded-xl bg-muted/30 px-4 text-sm font-bold ring-1 ring-border/40 min-w-[80px]">
                        {page} <span className="mx-1 text-muted-foreground/40">/</span> {totalPages}
                      </div>
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-border/40 bg-background/50" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-border/40 bg-background/50" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Dialog open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null) }}>
        <DialogContent className="h-[92vh] w-[96vw] overflow-hidden rounded-[32px] border border-border/40 bg-white dark:bg-zinc-950 p-0 shadow-2xl sm:mx-auto sm:max-w-5xl flex flex-col">
          {selectedTask ? (
            <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-950">
              {/* Top Banner / Status */}
              <div className={cn(
                "h-2 w-full shrink-0",
                selectedTask.priority === "CRITICAL" ? "bg-red-500" :
                selectedTask.priority === "HIGH" ? "bg-orange-500" :
                "bg-cyan-500"
              )} />

              {/* Header Area */}
              <div className="shrink-0 border-b border-border/40 px-5 py-5 sm:px-10 sm:py-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-[24px] shadow-sm ring-1 ring-inset",
                      selectedTask.integrationMode === "GITHUB" ? "bg-violet-500/10 text-violet-600 ring-violet-500/20" : "bg-cyan-500/10 text-cyan-600 ring-cyan-500/20"
                    )}>
                      {selectedTask.integrationMode === "GITHUB" ? <Github className="h-8 w-8" /> : <FileCode className="h-8 w-8" />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <Badge variant="secondary" className="rounded-full bg-muted/50 px-3 py-0.5 text-[9px] font-semibold uppercase tracking-widest opacity-60 truncate max-w-[180px] sm:max-w-[300px]">
                          {selectedTask.team?.name}
                        </Badge>
                        <Badge variant="outline" className={cn("rounded-full border-none px-3 py-0.5 text-[9px] font-semibold uppercase tracking-widest", PRIORITY_COLOR[selectedTask.priority])}>
                          {selectedTask.priority}
                        </Badge>
                      </div>
                      <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground/90 leading-tight">{selectedTask.title}</DialogTitle>
                    </div>
                  </div>
                  <div className="flex flex-row-reverse sm:flex-row items-center gap-3 self-start sm:self-center">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">Assignee</p>
                      <p className="text-sm font-bold text-foreground/80">{fullName(selectedTask.assignee)}</p>
                    </div>
                    <Avatar className="h-10 w-10 ring-4 ring-muted/30">
                      <AvatarImage src={selectedTask.assignee?.avatarUrl ?? undefined} />
                      <AvatarFallback className="font-bold bg-muted text-xs">{getInitials(fullName(selectedTask.assignee))}</AvatarFallback>
                    </Avatar>
                  </div>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_360px] min-h-0 overflow-hidden relative">
                {/* Left side: Evidence & Info (Scrollable) */}
                <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-10 lg:py-10 space-y-8 scrollbar-thin">
                  {/* Task Overview */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Submission Overview</h4>
                    </div>
                    <div className="rounded-3xl border border-border/40 bg-muted/10 p-6">
                      <p className="text-base font-medium leading-relaxed text-foreground/80">
                        {selectedTask.description || "No description provided for this task."}
                      </p>
                      <div className="mt-8 grid grid-cols-2 gap-6 border-t border-border/40 pt-6">
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">Submitted On</p>
                          <p className="text-sm font-bold text-foreground/70">{formatDateTime(selectedTask.submittedForReviewAt)}</p>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">Integration Mode</p>
                          <Badge variant="outline" className="mt-1 rounded-full border-border/60 bg-background/50 px-3 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                            {MODE_LABEL[selectedTask.integrationMode]}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* GitHub Context */}
                  {selectedTask.integrationMode === "GITHUB" && (
                    <section className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                        <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">GitHub Evidence</h4>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Card className="rounded-3xl border-border/40 bg-violet-500/[0.03] p-6 transition-all hover:bg-violet-500/[0.05]">
                          <div className="flex items-center justify-between mb-4">
                            <GitPullRequest className="h-6 w-6 text-violet-600" />
                            <Badge className="bg-violet-500/10 text-violet-600 border-none rounded-full px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                              PR #{selectedTask.github?.pullRequest.number || "???"}
                            </Badge>
                          </div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">Pull Request</p>
                          {selectedTask.github?.pullRequest.url ? (
                            <Link href={selectedTask.github.pullRequest.url} target="_blank" className="flex items-center gap-2 text-sm font-bold text-foreground/80 hover:text-violet-600 transition-colors">
                              View on GitHub <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          ) : <p className="text-sm font-bold text-muted-foreground/40 italic">Link not found</p>}
                        </Card>
                        <Card className="rounded-3xl border-border/40 bg-zinc-500/[0.03] p-6 transition-all hover:bg-zinc-500/[0.05]">
                          <div className="flex items-center justify-between mb-4">
                            <GitBranch className="h-6 w-6 text-zinc-600" />
                            <Badge className="bg-zinc-500/10 text-zinc-600 border-none rounded-full px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                              {selectedTask.github?.commitCount || 0} Commits
                            </Badge>
                          </div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">Branch Name</p>
                          <p className="truncate font-mono text-[10px] font-bold text-foreground/60 bg-background/50 px-2 py-1 rounded-lg">
                            {selectedTask.github?.branch?.name || "???"}
                          </p>
                        </Card>
                      </div>
                    </section>
                  )}

                  {/* Manual Evidence */}
                  {selectedTask.integrationMode === "MANUAL" && (
                    <section className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                        <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Manual Evidence</h4>
                      </div>
                      {loadingEvidence ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Skeleton className="h-24 w-full rounded-3xl" />
                          <Skeleton className="h-24 w-full rounded-3xl" />
                        </div>
                      ) : taskEvidence.length === 0 ? (
                        <div className="rounded-3xl border-2 border-dashed border-border/40 p-12 text-center bg-muted/5">
                          <Paperclip className="mx-auto mb-4 h-10 w-10 text-muted-foreground/20" />
                          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/30">No evidence attached</p>
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {taskEvidence.map((item) => (
                            <Link key={item.id} href={item.url} target="_blank" className="group block">
                              <Card className="rounded-3xl border-border/40 bg-card p-5 transition-all duration-300 hover:shadow-xl hover:border-primary/20 hover:scale-[1.02]">
                                <div className="flex items-center gap-4">
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/5 text-primary shadow-inner transition-transform group-hover:rotate-6">
                                    {item.type === "LINK" ? <Link2 className="h-6 w-6" /> : <FileCode className="h-6 w-6" />}
                                  </div>
                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <p className="truncate text-sm font-bold text-foreground/80 group-hover:text-primary transition-colors">{item.title}</p>
                                    <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                                      {item.type === "FILE" ? formatFileSize(item.fileSize) : "External Link"}
                                    </p>
                                  </div>
                                </div>
                              </Card>
                            </Link>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {/* Prior Decisions */}
                  {selectedTask.reviews && selectedTask.reviews.length > 0 && (
                    <section className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Review History</h4>
                      </div>
                      <div className="space-y-4">
                        {selectedTask.reviews.map((review, i) => (
                          <div key={review.id} className="relative flex gap-6">
                            {i < selectedTask.reviews.length - 1 && (
                              <div className="absolute left-[19px] top-10 bottom-0 w-[2px] bg-border/40" />
                            )}
                            <div className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ring-white dark:ring-zinc-950 z-10",
                              review.decision === "APPROVED" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                            )}>
                              {review.decision === "APPROVED" ? <CheckCircle2 className="h-5 w-5" /> : <RefreshCw className="h-5 w-5" />}
                            </div>
                            <div className="flex-1 space-y-2 pb-6">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-foreground/80">{review.reviewer?.fullName || "Reviewer"}</span>
                                  <Badge variant="secondary" className="rounded-full px-2 py-0 text-[8px] font-semibold uppercase tracking-widest opacity-60">
                                    {review.reviewerRole}
                                  </Badge>
                                </div>
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">{formatDateTime(review.createdAt)}</span>
                              </div>
                              <Card className="rounded-2xl border-border/40 bg-muted/20 p-4">
                                <p className="text-sm font-medium leading-relaxed text-muted-foreground/80">
                                  {review.comment || "No written feedback provided."}
                                </p>
                              </Card>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                {/* Right side: Review Form (Sticky Actions) */}
                <ReviewForm
                  key={selectedTask.id}
                  selectedTask={selectedTask}
                  submittingReview={submittingReview}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
