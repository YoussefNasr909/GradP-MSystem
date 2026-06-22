"use client"

import { motion } from "framer-motion"
import { useAuthStore } from "@/lib/stores/auth-store"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  CheckSquare,
  Users,
  AlertCircle,
  Calendar,
  Trophy,
  Award,
  FileText,
  ArrowRight,
  AlertTriangle,
  MessageSquare,
  CheckCircle,
  Video,
  Sparkles,
  Clock,
  Activity,
  BarChart3,
  Crown,
  Shield,
  GraduationCap,
  BookOpen,
  Server,
  Target,
  Zap,
  GitBranch,
  Upload,
  ChevronRight,
  Plus,
  Check,
  ClipboardList,
  ClipboardCheck,
  UserPlus,
  Users2,
  Megaphone,
  MessageCircle,
} from "lucide-react"
import { usersApi } from "@/lib/api/users"
import { teamsApi } from "@/lib/api/teams"
import { supportApi } from "@/lib/api/support"
import { adminLogsApi, type ActivityEntry, type SystemLogsResponse } from "@/lib/api/admin-logs"
import { calendarApi } from "@/lib/api/calendar"
import { meetingsApi } from "@/lib/api/meetings"
import { tasksApi } from "@/lib/api/tasks"
import { sprintsApi } from "@/lib/api/sprints"
import { submissionsApi } from "@/lib/api/submissions"
import { proposalsApi } from "@/lib/api/proposals"
import { githubApi } from "@/lib/api/github"
import { chatApi } from "@/lib/api/chat"
import { teamChatApi } from "@/lib/api/team-chat"
import { getResources } from "@/lib/api/resources"
import { listDiscussions } from "@/lib/api/discussions"
import { announcementsApi } from "@/lib/api/supervisor-tools"
import { API_BASE_URL } from "@/lib/api/http"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import { getFullName, getTeamProgressFallback } from "@/lib/team-display"
import type { ApiCalendarEvent, ApiMeeting, ApiTask, ApiSupportSummary, ApiSupportTicketSummary, UsersSummary } from "@/lib/api/types"
import NextLink from "next/link"
import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { RoleActionInbox } from "@/components/dashboard/role-action-inbox"
import { useGamificationOverview } from "@/lib/hooks/use-gamification"
// ─── Real data placeholders ─────────────────────────────────────────────────
// The mock arrays from @/data/* used to drive these dashboards. They've been
// replaced with empty placeholders so derived counts are honest (0 instead of
// fake). The live counts users actually care about come from RoleActionInbox
// (proposals to review, submissions to grade, tasks awaiting PR review, etc.)
// which fetches them via real API endpoints. Per-dashboard widgets that need
// more detail wire their own hooks (e.g. useMyTeamState).
type DashboardTeamPlaceholder = {
  id: string
  name?: string
  health?: string
  leaderId?: string
  memberIds?: string[]
}
type DashboardTaskPlaceholder = {
  id: string
  title: string
  status?: string
  priority?: string
  dueDate?: string | Date
  teamId?: string
  assigneeId?: string
  assigneeIds?: string[]
}
type DashboardMeetingPlaceholder = {
  id: string
  title: string
  date: string | Date
  time?: string
  type?: string
  teamId?: string
}
type DashboardUserPlaceholder = { id: string; name?: string }

const teams: DashboardTeamPlaceholder[] = []
const users: DashboardUserPlaceholder[] = []
const proposals: unknown[] = []
const tasks: DashboardTaskPlaceholder[] = []
const meetings: DashboardMeetingPlaceholder[] = []
function getUserById(_id: string): DashboardUserPlaceholder | null { return null }
void users
void proposals

type AdminHealthStatus = "healthy" | "warning" | "error"

function getBackendHealthUrl() {
  const apiVersionSuffix = /\/api\/v\d+$/i
  if (apiVersionSuffix.test(API_BASE_URL)) {
    return API_BASE_URL.replace(apiVersionSuffix, "/health")
  }
  return `${API_BASE_URL.replace(/\/+$/, "")}/health`
}

function formatRelativeTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  const diffMs = date.getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["week", 1000 * 60 * 60 * 24 * 7],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
  ]
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  for (const [unit, unitMs] of units) {
    if (absMs >= unitMs) {
      return formatter.format(Math.round(diffMs / unitMs), unit)
    }
  }

  return "just now"
}

function getAdminActivityIcon(action: string) {
  const normalized = action.toLowerCase()
  if (normalized.includes("schedule")) return Calendar
  if (normalized.includes("join")) return Users
  if (normalized.includes("accepted") || normalized.includes("approved")) return Check
  if (normalized.includes("task")) return CheckSquare
  return Activity
}

function formatScheduleTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatDashboardDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function isTaskComplete(task: ApiTask) {
  return task.status === "DONE" || task.status === "APPROVED"
}

function ScheduleCard({ className }: { className?: string }) {
  const [events, setEvents] = useState<ApiCalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    const now = new Date()
    const rangeEnd = new Date(now)
    rangeEnd.setDate(rangeEnd.getDate() + 90)

    setIsLoading(true)
    setError("")

    calendarApi
      .listEvents({ start: now.toISOString(), end: rangeEnd.toISOString() })
      .then((result) => {
        if (cancelled) return
        setEvents(
          result
            .filter((event) => new Date(event.startAt).getTime() >= now.getTime())
            .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())
            .slice(0, 12),
        )
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setEvents([])
        setError(caught instanceof Error ? caught.message : "Couldn't load your calendar.")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card className={cn("glass-card flex min-h-0 flex-col p-6 rounded-2xl", className)}>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-purple-500" /> Schedule
        </h3>
        <Button variant="ghost" size="sm" asChild>
          <NextLink href="/dashboard/calendar">
            <Plus className="h-4 w-4" />
          </NextLink>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
              <div className="h-8 w-8 rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-muted" />
                <div className="h-3 w-24 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 p-5 text-center text-sm text-muted-foreground">
          Use the calendar to plan your schedule.
        </div>
      ) : (
        <ScrollArea className="-mr-3 min-h-0 flex-1 pr-3">
          <div className="space-y-3">
            {events.map((event) => (
              <div key={`${event.sourceType}-${event.id}`} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-purple-500/10 p-2">
                    {event.sourceType === "MEETING" ? (
                      <Video className="h-4 w-4 text-purple-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="truncate text-sm font-medium">{event.title}</h4>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {event.sourceType === "MEETING" ? "Meeting" : "Deadline"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.team.name} - {formatScheduleTime(event.startAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  )
}

function MeetingsCard({ className }: { className?: string }) {
  const [upcomingMeetings, setUpcomingMeetings] = useState<ApiMeeting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    const now = new Date()
    const rangeEnd = new Date(now)
    rangeEnd.setDate(rangeEnd.getDate() + 90)

    setIsLoading(true)
    setError("")

    meetingsApi
      .list({ start: now.toISOString(), end: rangeEnd.toISOString() })
      .then((result) => {
        if (cancelled) return
        setUpcomingMeetings(
          result
            .filter((meeting) => new Date(meeting.startAt).getTime() >= now.getTime())
            .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())
            .slice(0, 12),
        )
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setUpcomingMeetings([])
        setError(caught instanceof Error ? caught.message : "Couldn't load your meetings.")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card className={cn("glass-card flex min-h-0 flex-col p-6 rounded-2xl", className)}>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Video className="h-5 w-5 text-purple-500" /> Meetings
        </h3>
        <Button variant="ghost" size="sm" asChild>
          <NextLink href="/dashboard/meetings">
            <Plus className="h-4 w-4" />
          </NextLink>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
              <div className="h-8 w-8 rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-muted" />
                <div className="h-3 w-24 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
          {error}
        </div>
      ) : upcomingMeetings.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 p-5 text-center text-sm text-muted-foreground">
          No upcoming meetings scheduled.
        </div>
      ) : (
        <ScrollArea className="-mr-3 min-h-0 flex-1 pr-3">
          <div className="space-y-3">
            {upcomingMeetings.map((meeting) => (
              <div key={meeting.id} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-purple-500/10 p-2">
                    <Video className="h-4 w-4 text-purple-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="truncate text-sm font-medium">{meeting.title}</h4>
                      <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                        {meeting.status.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {meeting.team.name} - {formatScheduleTime(meeting.startAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  )
}

export default function DashboardPage() {
  const { currentUser } = useAuthStore()

  if (!currentUser) {
    return null
  }

  // Student (member)
  if (currentUser.role === "member") {
    return <StudentMemberDashboard />
  }

  // Team Leader
  if (currentUser.role === "leader") {
    return <TeamLeaderDashboard />
  }

  // Doctor/Professor
  if (currentUser.role === "doctor") {
    return <DoctorDashboard />
  }

  // Teaching Assistant
  if (currentUser.role === "ta") {
    return <TADashboard />
  }

  if (currentUser.role === "support") {
    return <SupportDashboard />
  }

  // Admin
  if (currentUser.role === "admin") {
    return <AdminDashboard />
  }

  return null
}

function formatSupportDashboardDate(value?: string | null) {
  if (!value) return "No activity"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No activity"
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function supportDashboardLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function SupportDashboard() {
  const { currentUser } = useAuthStore()
  const [summary, setSummary] = useState<ApiSupportSummary | null>(null)
  const [recentTickets, setRecentTickets] = useState<ApiSupportTicketSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!currentUser?.id) return

    let cancelled = false
    setIsLoading(true)
    setError("")

    Promise.all([
      supportApi.summary(),
      supportApi.listTickets({ limit: 6, assignedTo: "me" }),
    ])
      .then(([summaryResult, ticketsResult]) => {
        if (cancelled) return
        setSummary(summaryResult)
        setRecentTickets(ticketsResult.items)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : "Support dashboard could not load.")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentUser?.id])

  const activeTicketCount = (summary?.open ?? 0) + (summary?.inProgress ?? 0) + (summary?.waitingOnUser ?? 0)
  const attentionTicketCount = (summary?.urgent ?? 0) + (summary?.overdue ?? 0)
  const metrics = [
    {
      label: "Active tickets",
      value: activeTicketCount,
      helper: "Open, working, or waiting",
      icon: ClipboardList,
      href: "/dashboard/support",
    },
    {
      label: "Assigned to me",
      value: summary?.assignedToMe ?? 0,
      helper: "Your queue",
      icon: UserPlus,
      href: "/dashboard/support?view=mine",
    },
    {
      label: "Unassigned",
      value: summary?.unassigned ?? 0,
      helper: "Needs an owner",
      icon: Users,
      href: "/dashboard/support?view=unassigned",
    },
    {
      label: "Needs attention",
      value: attentionTicketCount,
      helper: "Urgent or overdue",
      icon: AlertTriangle,
      href: "/dashboard/support?view=overdue",
      danger: true,
    },
  ]

  const healthRows = [
    { label: "Overdue", value: summary?.overdue ?? 0 },
    { label: "Due soon", value: summary?.dueSoon ?? 0 },
    { label: "Resolved today", value: summary?.resolvedToday ?? 0 },
    { label: "Closed today", value: summary?.closedToday ?? 0 },
    {
      label: "Avg first response",
      value: summary?.averageFirstResponseMinutes == null ? "No data" : `${summary.averageFirstResponseMinutes}m`,
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="flex flex-col gap-6 rounded-[32px] border border-border/40 bg-background/50 p-4 sm:p-8 backdrop-blur-md shadow-2xl overflow-hidden mb-8"
    >
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Support workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight">Support dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Welcome, {currentUser?.name || "Support"}. Start with your assigned tickets, then scan the queue for anything urgent.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="gap-2">
            <NextLink href="/dashboard/support">
              Open queue
              <ArrowRight className="h-4 w-4" />
            </NextLink>
          </Button>
          <Button asChild variant="outline" className="gap-2 bg-transparent">
            <NextLink href="/dashboard/chat">
              <MessageSquare className="h-4 w-4" />
              Chat
            </NextLink>
          </Button>
        </div>
      </section>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-medium">Dashboard data could not load</p>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const MetricIcon = metric.icon
          return (
            <NextLink
              key={metric.label}
              href={metric.href}
              className="group flex flex-col justify-between rounded-xl border border-border/40 bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/20"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">{metric.label}</p>
                <MetricIcon className={cn("h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary", metric.danger && !isLoading && metric.value > 0 ? "text-red-500 group-hover:text-red-600" : "")} />
              </div>
              <div>
                <p className={cn("text-3xl sm:text-4xl font-semibold tracking-tight transition-transform duration-300 origin-left group-hover:scale-105", metric.danger && !isLoading && metric.value > 0 ? "text-red-500" : "text-foreground")}>
                  {isLoading ? "..." : metric.value}
                </p>
                <p className="mt-1.5 text-[10px] sm:text-[11px] font-medium text-muted-foreground line-clamp-1">{metric.helper}</p>
              </div>
            </NextLink>
          )
        })}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Assigned to you</h2>
              <p className="text-sm text-muted-foreground">Assigned tickets that need a next step.</p>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2 bg-transparent">
              <NextLink href="/dashboard/support">
                View queue
                <ArrowRight className="h-4 w-4" />
              </NextLink>
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 rounded-lg border border-border/60 bg-muted/20" />
              ))
            ) : recentTickets.length ? (
              recentTickets.map((ticket) => (
                <NextLink
                  key={ticket.id}
                  href={`/dashboard/support?ticket=${ticket.id}`}
                  className="group flex flex-col gap-3 rounded-xl border border-border/40 bg-card p-4 transition-all duration-300 hover:bg-muted/30 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
                      <Badge variant={ticket.priority === "URGENT" ? "destructive" : "secondary"} className="rounded-md">
                        {supportDashboardLabel(ticket.priority)}
                      </Badge>
                      <Badge variant="outline" className="rounded-md">{supportDashboardLabel(ticket.status)}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-1 text-sm font-medium">{ticket.subject}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ticket.requester?.fullName ?? "Unknown requester"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {formatSupportDashboardDate(ticket.lastActivityAt)}
                  </div>
                </NextLink>
              ))
            ) : (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground" />
                <h3 className="mt-3 font-semibold">No assigned tickets</h3>
                <p className="mt-1 text-sm text-muted-foreground">Open the queue to pick up new requester work.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 bg-card rounded-xl p-5 border border-border/40 shadow-sm">
          <h2 className="text-lg font-semibold">Queue health</h2>
          <p className="mt-1 text-sm text-muted-foreground">SLA and closure signals for today.</p>

          <div className="mt-5 divide-y divide-border/60 text-sm">
            {healthRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-semibold">{isLoading ? "..." : row.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-2">
            <Button asChild variant="outline" className="justify-start gap-2 bg-transparent">
              <NextLink href="/dashboard/support">
                <Activity className="h-4 w-4" />
                Open queue
              </NextLink>
            </Button>
            <Button asChild variant="outline" className="justify-start gap-2 bg-transparent">
              <NextLink href="/dashboard/support?view=overdue">
                <AlertCircle className="h-4 w-4" />
                Overdue
              </NextLink>
            </Button>
            <Button asChild variant="outline" className="justify-start gap-2 bg-transparent">
              <NextLink href="/dashboard/chat">
                <MessageSquare className="h-4 w-4" />
                Message anyone
              </NextLink>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// STUDENT MEMBER DASHBOARD
// ============================================
function StudentMemberDashboard() {
  const { currentUser } = useAuthStore()
  const { data: myTeamState } = useMyTeamState()
  const [greeting, setGreeting] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [availableTeamCount, setAvailableTeamCount] = useState(0)
  const [studentTasks, setStudentTasks] = useState<ApiTask[]>([])
  const [calendarEvents, setCalendarEvents] = useState<ApiCalendarEvent[]>([])
  const [isTasksLoading, setIsTasksLoading] = useState(false)
  const [isCalendarLoading, setIsCalendarLoading] = useState(true)
  const [tasksError, setTasksError] = useState("")
  const [calendarError, setCalendarError] = useState("")
  const [dashboardCounts, setDashboardCounts] = useState({
    activeSprints: 0,
    pendingSubmissions: 0,
    openPullRequests: 0,
    unreadMessages: 0,
    proposalItems: 0,
    resources: 0,
    discussions: 0,
    announcements: 0,
    focusSessionsToday: 0,
  })

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Good Morning")
    else if (hour < 17) setGreeting("Good Afternoon")
    else setGreeting("Good Evening")

    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // GamificationOverview API shape: { balance, badges, recentTransactions }.
  // The balance object holds lifetime XP + level for the progress card below.
  const { data: gamification } = useGamificationOverview()
  const xp = gamification?.balance?.lifetimeXp ?? 0
  const level = gamification?.balance?.level ?? 1

  useEffect(() => {
    if (myTeamState?.team) return

    let cancelled = false
    teamsApi
      .list({ limit: 1, availability: "open" })
      .then((result) => {
        if (!cancelled) setAvailableTeamCount(result.meta.total)
      })
      .catch(() => {
        if (!cancelled) setAvailableTeamCount(0)
      })

    return () => {
      cancelled = true
    }
  }, [myTeamState?.team])

  const liveTeam = myTeamState?.team ?? null
  const teamMembersPreview =
    liveTeam?.members.map((member) => ({
      id: member.user.id,
      name: getFullName(member.user),
      avatar: member.user.avatarUrl,
    })) ?? []
  const myTeam = liveTeam
    ? {
        id: liveTeam.id,
        name: liveTeam.name,
        description: liveTeam.bio,
        progress: getTeamProgressFallback(liveTeam),
        memberIds: liveTeam.members.map((member) => member.user.id),
        stage: liveTeam.stage.toLowerCase().replaceAll("_", "-"),
        isFull: liveTeam.isFull,
        slotsRemaining: liveTeam.slotsRemaining,
        stack: liveTeam.stack,
      }
    : null
  const hasTeam = !!myTeam

  useEffect(() => {
    if (!liveTeam?.id) {
      setStudentTasks([])
      setTasksError("")
      setIsTasksLoading(false)
      return
    }

    let cancelled = false
    setIsTasksLoading(true)
    setTasksError("")

    tasksApi
      .list({ teamId: liveTeam.id })
      .then((result) => {
        if (cancelled) return
        setStudentTasks(result)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setStudentTasks([])
        setTasksError(error instanceof Error ? error.message : "Couldn't load your tasks.")
      })
      .finally(() => {
        if (!cancelled) setIsTasksLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [liveTeam?.id])

  useEffect(() => {
    let cancelled = false
    const now = new Date()
    const rangeEnd = new Date(now)
    rangeEnd.setDate(rangeEnd.getDate() + 90)

    setIsCalendarLoading(true)
    setCalendarError("")

    calendarApi
      .listEvents({ start: now.toISOString(), end: rangeEnd.toISOString() })
      .then((result) => {
        if (cancelled) return
        setCalendarEvents(
          result
            .filter((event) => new Date(event.startAt).getTime() >= now.getTime())
            .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime()),
        )
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setCalendarEvents([])
        setCalendarError(error instanceof Error ? error.message : "Couldn't load your calendar.")
      })
      .finally(() => {
        if (!cancelled) setIsCalendarLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const teamId = liveTeam?.id

    async function loadDashboardCounts() {
      const [
        sprintBoard,
        submissionList,
        githubWorkspace,
        directUnread,
        teamChatBootstrap,
        proposalCount,
        resourceList,
        discussionFeed,
        announcementList,
      ] = await Promise.all([
        teamId ? sprintsApi.board({ teamId }).catch(() => null) : Promise.resolve(null),
        teamId ? submissionsApi.list({ teamId }).catch(() => []) : Promise.resolve([]),
        teamId ? githubApi.getWorkspace(teamId).catch(() => null) : Promise.resolve(null),
        chatApi.unreadCount().catch(() => ({ unreadCount: 0 })),
        teamId ? teamChatApi.bootstrap().catch(() => null) : Promise.resolve(null),
        teamId
          ? proposalsApi
              .getMine()
              .then((proposal) => (proposal && proposal.status !== "APPROVED" ? 1 : 0))
              .catch(() => 0)
          : proposalsApi
              .list()
              .then((proposalList) => proposalList.length)
              .catch(() => 0),
        getResources().catch(() => []),
        listDiscussions({ page: 1 }).catch(() => null),
        announcementsApi.list().catch(() => []),
      ])

      if (cancelled) return

      const groupUnread =
        teamChatBootstrap?.conversations.reduce((total, conversation) => total + conversation.unreadCount, 0) ?? 0

      setDashboardCounts((current) => ({
        activeSprints: sprintBoard?.sprints.filter((sprint) => sprint.status !== "COMPLETED").length ?? 0,
        pendingSubmissions: submissionList.filter((submission) => submission.status !== "APPROVED").length,
        openPullRequests: githubWorkspace?.stats?.openPullRequests ?? 0,
        unreadMessages: directUnread.unreadCount + groupUnread,
        proposalItems: proposalCount,
        resources: resourceList.length,
        discussions: discussionFeed?.meta.total ?? 0,
        announcements: announcementList.length,
        focusSessionsToday: current.focusSessionsToday,
      }))
    }

    void loadDashboardCounts()

    return () => {
      cancelled = true
    }
  }, [liveTeam?.id])

  useEffect(() => {
    if (!currentUser?.id) return

    try {
      const savedLog = window.localStorage.getItem(`gpms-focus-timer-log:${currentUser.id}`)
      const parsed = savedLog ? JSON.parse(savedLog) : []
      const today = new Date().toDateString()
      const focusSessionsToday = Array.isArray(parsed)
        ? parsed.filter((session) => new Date(session?.endedAt).toDateString() === today).length
        : 0

      setDashboardCounts((current) => ({ ...current, focusSessionsToday }))
    } catch {
      setDashboardCounts((current) => ({ ...current, focusSessionsToday: 0 }))
    }
  }, [currentUser?.id])

  const myTasks = studentTasks.filter((task) => !currentUser?.id || task.assignee?.id === currentUser.id)
  const activeTasks = myTasks.filter((task) => !isTaskComplete(task))
  const upcomingMeetings = calendarEvents.filter((event) => event.sourceType === "MEETING").slice(0, 3)

  const quickLinks = hasTeam
    ? [
        {
          title: "My Tasks",
          icon: CheckSquare,
          href: "/dashboard/tasks",
          count: activeTasks.length,
          color: "from-blue-600 to-indigo-600",
          description: "View and manage your tasks",
        },
        {
          title: "My Team",
          icon: Users,
          href: "/dashboard/my-team",
          count: myTeam?.memberIds.length || 0,
          color: "from-purple-600 to-pink-600",
          description: "Team collaboration",
        },
        {
          title: "Sprints",
          icon: ClipboardList,
          href: "/dashboard/sprints",
          count: dashboardCounts.activeSprints,
          color: "from-cyan-500 to-blue-600",
          description: "Sprint goals",
        },
        {
          title: "Submissions",
          icon: Upload,
          href: "/dashboard/submissions",
          count: dashboardCounts.pendingSubmissions,
          color: "from-sky-600 to-blue-600",
          description: "Submit deliverables",
        },
        {
          title: "GitHub",
          icon: GitBranch,
          href: "/dashboard/github",
          count: dashboardCounts.openPullRequests,
          color: "from-slate-600 to-slate-800",
          description: "Repository work",
        },
        {
          title: "Meetings",
          icon: Video,
          href: "/dashboard/meetings",
          count: upcomingMeetings.length,
          color: "from-violet-500 to-purple-600",
          description: "Team meetings",
        },
        {
          title: "Chat",
          icon: MessageSquare,
          href: "/dashboard/chat",
          count: dashboardCounts.unreadMessages,
          color: "from-emerald-600 to-green-600",
          description: "Team messages",
        },
        {
          title: "Time Tracker",
          icon: Clock,
          href: "/dashboard/time-tracker",
          count: dashboardCounts.focusSessionsToday,
          color: "from-amber-500 to-orange-500",
          description: "Log progress",
        },
      ]
    : [
        // Student without team - show join team options
        {
          title: "Find a Team",
          icon: UserPlus,
          href: "/dashboard/teams",
          count: availableTeamCount,
          color: "from-purple-500 to-pink-500",
          description: "Browse & join a team",
        },
        {
          title: "Proposals",
          icon: FileText,
          href: "/dashboard/proposals",
          count: dashboardCounts.proposalItems,
          color: "from-blue-600 to-indigo-600",
          description: "Project ideas",
        },
        {
          title: "Calendar",
          icon: Calendar,
          href: "/dashboard/calendar",
          count: upcomingMeetings.length,
          color: "from-orange-500 to-amber-500",
          description: "Academic calendar",
        },
        {
          title: "Announcements",
          icon: Megaphone,
          href: "/dashboard/announcements",
          count: dashboardCounts.announcements,
          color: "from-emerald-600 to-green-600",
          description: "Course updates",
        },
        {
          title: "Resources",
          icon: BookOpen,
          href: "/dashboard/resources",
          count: dashboardCounts.resources,
          color: "from-indigo-500 to-violet-500",
          description: "Learning materials",
        },
        {
          title: "Discussions",
          icon: MessageCircle,
          href: "/dashboard/discussions",
          count: dashboardCounts.discussions,
          color: "from-sky-600 to-blue-600",
          description: "Community forums",
        },
        {
          title: "Gamification",
          icon: Trophy,
          href: "/dashboard/gamification",
          count: xp,
          color: "from-yellow-500 to-orange-500",
          description: "XP & achievements",
        },
        {
          title: "Chat",
          icon: MessageSquare,
          href: "/dashboard/chat",
          count: dashboardCounts.unreadMessages,
          color: "from-gray-500 to-gray-700",
          description: "Messages",
        },
      ]

  const upcomingDeadlines = myTasks
    .filter((task) => task.endDate && new Date(task.endDate).getTime() > Date.now() && !isTaskComplete(task))
    .sort((left, right) => new Date(left.endDate!).getTime() - new Date(right.endDate!).getTime())
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl glass-card p-6 md:p-8 border border-border/50"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-purple-500/20 to-transparent rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4">
              <motion.div whileHover={{ scale: 1.05, rotate: 5 }} className="relative">
                <Avatar className="h-16 w-16 border-4 border-primary/20 shadow-xl">
                  <AvatarImage src={currentUser?.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="text-xl bg-gradient-to-br from-primary to-secondary text-white">
                    {currentUser?.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-green-500 border-2 border-background">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>
              </motion.div>

              <div className="min-w-0">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
                >
                  <Clock className="h-4 w-4" />
                  <span>
                    {currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </span>
                  <span className="font-mono text-primary">{currentTime.toLocaleTimeString()}</span>
                </motion.div>

                <h1 className="text-xl md:text-2xl font-semibold leading-tight">
                  {greeting}, <span className="text-primary">{currentUser?.name}</span>!
                </h1>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Access Grid */}
      <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Quick Access
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickLinks.map((link, index) => (
            <motion.div
              key={link.title}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15 + index * 0.05 }}
              whileHover={{ scale: 1.03, y: -5 }}
              whileTap={{ scale: 0.98 }}
            >
              <NextLink href={link.href}>
                <Card className="glass-card p-4 h-full cursor-pointer group hover:border-primary/50 transition-all overflow-hidden relative">
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${link.color} opacity-0 group-hover:opacity-5 transition-opacity`}
                  />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={`p-2.5 rounded-xl bg-gradient-to-br ${link.color} group-hover:scale-110 transition-transform`}
                      >
                        <link.icon className="h-5 w-5 text-white" />
                      </div>
                      {link.count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {link.count}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{link.title}</h3>
                    <p className="text-xs text-foreground/75 mt-1">{link.description}</p>
                  </div>
                  <ChevronRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Card>
              </NextLink>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Tasks & Progress */}
        <div className="lg:col-span-2 space-y-6">
          {/* Team Progress Card */}
          {myTeam && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Card className="glass-card p-6 rounded-2xl overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-secondary">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{myTeam.name}</h3>
                        <p className="text-sm text-muted-foreground">{myTeam.description?.slice(0, 50)}...</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild className="bg-transparent">
                      <NextLink href="/dashboard/my-team">
                        View Team <ArrowRight className="h-4 w-4 ml-1" />
                      </NextLink>
                    </Button>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 rounded-xl bg-muted/30">
                      <div className="text-2xl font-bold">{myTeam.progress}%</div>
                      <div className="text-xs text-muted-foreground">Progress</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-muted/30">
                      <div className="text-2xl font-bold">{myTeam.memberIds.length}</div>
                      <div className="text-xs text-muted-foreground">Members</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-muted/30">
                      <div className="text-2xl font-bold capitalize">{myTeam.stage}</div>
                      <div className="text-xs text-muted-foreground">Stage</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-muted/30">
                      <Badge variant={myTeam.isFull ? "secondary" : "default"} className="text-xs">
                        {myTeam.isFull ? "Full" : `${myTeam.slotsRemaining} open`}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">Availability</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Overall Progress</span>
                      <span className="font-medium">{myTeam.progress}%</span>
                    </div>
                    <Progress value={myTeam.progress} className="h-2" />
                  </div>

                  {/* Team Members Preview */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                    <div className="flex -space-x-2">
                      {teamMembersPreview.slice(0, 5).map((member) => {
                        return (
                          <TooltipProvider key={member.id}>
                            <Tooltip>
                              <TooltipTrigger>
                                <Avatar className="h-8 w-8 border-2 border-background">
                                  <AvatarImage src={member.avatar || "/placeholder.svg"} />
                                  <AvatarFallback>{member.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent>{member.name}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )
                      })}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Tech Stack:</span>
                      {myTeam.stack?.slice(0, 3).map((tech) => (
                        <Badge key={tech} variant="outline" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Upcoming Deadlines */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <Card className="glass-card p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" /> Upcoming Deadlines
                </h3>
                <Button variant="ghost" size="sm" asChild>
                  <NextLink href="/dashboard/tasks">
                    View All <ArrowRight className="h-4 w-4 ml-1" />
                  </NextLink>
                </Button>
              </div>

              <div className="space-y-3">
                {isTasksLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                      <div className="h-4 w-40 rounded bg-muted" />
                      <div className="mt-3 h-3 w-28 rounded bg-muted" />
                    </div>
                  ))
                ) : tasksError ? (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
                    {tasksError}
                  </div>
                ) : upcomingDeadlines.length > 0 ? (
                  upcomingDeadlines.map((task, index) => {
                    const daysUntilDue = Math.ceil(
                      (new Date(task.endDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
                    )
                    const isUrgent = daysUntilDue <= 2

                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + index * 0.05 }}
                        whileHover={{ x: 4 }}
                        className={cn(
                          "p-4 rounded-xl border transition-all cursor-pointer",
                          isUrgent
                            ? "bg-destructive/5 border-destructive/30 hover:border-destructive/50"
                            : "bg-muted/30 border-border/50 hover:border-primary/50",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg", isUrgent ? "bg-destructive/10" : "bg-orange-500/10")}>
                              {isUrgent ? (
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                              ) : (
                                <Clock className="h-4 w-4 text-orange-500" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-medium">{task.title}</h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <span>{formatDashboardDate(task.endDate!)}</span>
                                <span>•</span>
                                <span className={isUrgent ? "text-destructive font-medium" : ""}>
                                  {daysUntilDue === 0
                                    ? "Due Today"
                                    : daysUntilDue === 1
                                      ? "Due Tomorrow"
                                      : `${daysUntilDue} days left`}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Badge variant={isUrgent ? "destructive" : "outline"} className="capitalize">
                            {task.priority}
                          </Badge>
                        </div>
                      </motion.div>
                    )
                  })
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                    <p className="text-muted-foreground">No upcoming deadlines. Great job!</p>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Right Column - Meetings & Progress */}
        <div className="space-y-6">
          {/* Upcoming Meetings */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
            <Card className="glass-card min-h-[292px] p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Video className="h-5 w-5 text-purple-500" /> Upcoming Meetings
                </h3>
                <Button variant="ghost" size="sm" asChild>
                  <NextLink href="/dashboard/calendar">
                    <Calendar className="h-4 w-4" />
                  </NextLink>
                </Button>
              </div>

              <div className="space-y-3">
                {isCalendarLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                      <div className="h-4 w-36 rounded bg-muted" />
                      <div className="mt-3 h-3 w-24 rounded bg-muted" />
                    </div>
                  ))
                ) : calendarError ? (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
                    {calendarError}
                  </div>
                ) : upcomingMeetings.length > 0 ? (
                  upcomingMeetings.map((meeting, index) => (
                    <motion.div
                      key={`${meeting.sourceType}-${meeting.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                      className="p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-purple-500/50 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Video className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{meeting.title}</h4>
                          <p className="text-xs text-muted-foreground">
                            {meeting.team.name} - {formatScheduleTime(meeting.startAt)}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {meeting.mode?.replace("_", " ").toLowerCase() ?? "meeting"}
                        </Badge>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No upcoming meetings</p>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* XP Progress */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
            <Card className="glass-card p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" /> Level Progress
                </h3>
                <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                  Level {level}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>{xp} XP</span>
                  <span className="text-muted-foreground">Next level at {level * level * 100} XP</span>
                </div>
                <Progress 
                  value={((xp - (level - 1) * (level - 1) * 100) / (level * level * 100 - (level - 1) * (level - 1) * 100)) * 100} 
                  className="h-3" 
                />
                <p className="text-xs text-muted-foreground text-center">
                  {level * level * 100 - xp} XP until next level
                </p>
              </div>

              <Button className="w-full mt-4 gap-2 bg-transparent" variant="outline" asChild>
                <NextLink href="/dashboard/gamification">
                  <Sparkles className="h-4 w-4" /> View Achievements
                </NextLink>
              </Button>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// TEAM LEADER DASHBOARD
// ============================================
function TeamLeaderDashboard() {
  const { currentUser } = useAuthStore()
  const { data: myTeamState } = useMyTeamState()
  const [greeting, setGreeting] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Good Morning")
    else if (hour < 17) setGreeting("Good Afternoon")
    else setGreeting("Good Evening")

    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const liveTeam = myTeamState?.team ?? null
  const myTeam = liveTeam
    ? {
        id: liveTeam.id,
        name: liveTeam.name,
        description: liveTeam.bio,
        progress: getTeamProgressFallback(liveTeam),
        memberIds: liveTeam.members.map((member) => member.user.id),
        stage: liveTeam.stage.toLowerCase().replaceAll("_", "-"),
        health: liveTeam.isFull ? "at-risk" : "healthy",
        stack: liveTeam.stack,
      }
    : null
  const teamMembers =
    liveTeam?.members.map((member) => ({
      id: member.user.id,
      name: getFullName(member.user),
      email: member.user.email,
      avatar: member.user.avatarUrl,
      bio: member.user.bio,
    })) || []
  const teamTasks = myTeam ? tasks.filter((t) => t.teamId === myTeam.id) : []
  const activeTasks = teamTasks.filter((t) => t.status !== "done")
  const completedTasks = teamTasks.filter((t) => t.status === "done")
  const overdueTasks = teamTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done")
  const upcomingMeetings = meetings
    .filter((m) => myTeam && m.teamId === myTeam.id && new Date(m.date) > new Date())
    .slice(0, 3)

  const quickLinks = [
    {
      title: "Team Tasks",
      icon: CheckSquare,
      href: "/dashboard/tasks",
      count: activeTasks.length,
      color: "from-blue-500 to-cyan-500",
      description: "Manage team tasks",
      urgent: overdueTasks.length > 0,
    },
    {
      title: "My Team",
      icon: Users,
      href: "/dashboard/my-team",
      count: teamMembers.length,
      color: "from-purple-500 to-pink-500",
      description: "Team management",
    },
    {
      title: "Sprints",
      icon: ClipboardList,
      href: "/dashboard/sprints",
      count: 0,
      color: "from-cyan-500 to-blue-600",
      description: "Plan sprint work",
    },
    {
      title: "Review Tasks",
      icon: ClipboardCheck,
      href: "/dashboard/reviews",
      count: 0,
      color: "from-orange-500 to-amber-500",
      description: "Approve team work",
    },
    {
      title: "Submissions",
      icon: Upload,
      href: "/dashboard/submissions",
      count: 0,
      color: "from-teal-500 to-cyan-500",
      description: "Project deliverables",
    },
    {
      title: "GitHub",
      icon: GitBranch,
      href: "/dashboard/github",
      count: 0,
      color: "from-gray-600 to-gray-800",
      description: "Repository & PRs",
    },
    {
      title: "Proposals",
      icon: FileText,
      href: "/dashboard/proposals",
      count: 0,
      color: "from-rose-500 to-pink-500",
      description: "Proposal status",
    },
    {
      title: "Meetings",
      icon: Video,
      href: "/dashboard/meetings",
      count: upcomingMeetings.length,
      color: "from-violet-500 to-purple-600",
      description: "Supervisor syncs",
    },
  ]

  const memberPerformance = teamMembers.map((member) => {
    const memberTasks = teamTasks.filter((t) => {
      if ("assigneeId" in t) return t.assigneeId === member?.id
      if ("assigneeIds" in t && Array.isArray(t.assigneeIds)) return t.assigneeIds.includes(member?.id || "")
      return false
    })
    const completed = memberTasks.filter((t) => t.status === "done").length
    return {
      ...member,
      totalTasks: memberTasks.length,
      completedTasks: completed,
      completionRate: memberTasks.length > 0 ? Math.round((completed / memberTasks.length) * 100) : 0,
    }
  })

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl glass-card p-6 md:p-8 border border-border/50"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-orange-500/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-purple-500/20 to-transparent rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4">
              <motion.div whileHover={{ scale: 1.05, rotate: 5 }} className="relative">
                <Avatar className="h-16 w-16 border-4 border-purple-500/20 shadow-xl">
                  <AvatarImage src={currentUser?.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="text-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                    {currentUser?.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-purple-500 border-2 border-background">
                  <Crown className="w-3 h-3 text-white" />
                </div>
              </motion.div>

              <div className="min-w-0">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
                >
                  <Clock className="h-4 w-4" />
                  <span>
                    {currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </span>
                  <span className="font-mono text-primary">{currentTime.toLocaleTimeString()}</span>
                </motion.div>

                <h1 className="text-xl md:text-2xl font-semibold leading-tight">
                  {greeting}, <span className="text-primary">{currentUser?.name}</span>!
                </h1>
              </div>
            </div>
          </div>

        </div>
      </motion.div>

      {/* Quick Access Grid */}
      <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Quick Access
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickLinks.map((link, index) => (
            <motion.div
              key={link.title}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15 + index * 0.05 }}
              whileHover={{ scale: 1.03, y: -5 }}
              whileTap={{ scale: 0.98 }}
            >
              <NextLink href={link.href}>
                <Card
                  className={cn(
                    "glass-card p-4 h-full cursor-pointer group hover:border-primary/50 transition-all overflow-hidden relative",
                    link.urgent && "border-destructive/50",
                  )}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${link.color} opacity-0 group-hover:opacity-5 transition-opacity`}
                  />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={`p-2.5 rounded-xl bg-gradient-to-br ${link.color} group-hover:scale-110 transition-transform`}
                      >
                        <link.icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex items-center gap-1">
                        {link.urgent && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                          </span>
                        )}
                        {link.count > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {link.count}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{link.title}</h3>
                    <p className="text-xs text-foreground/75 mt-1">{link.description}</p>
                  </div>
                </Card>
              </NextLink>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Team Members Performance */}
        <div className="lg:col-span-2 flex min-h-[560px] flex-col space-y-6">
          <motion.div className="flex flex-1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Card className="glass-card flex min-h-0 flex-1 flex-col p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-500" /> Team Performance
                </h3>
                <Button variant="outline" size="sm" asChild className="bg-transparent">
                  <NextLink href="/dashboard/my-team">
                    Manage Team <ArrowRight className="h-4 w-4 ml-1" />
                  </NextLink>
                </Button>
              </div>

              {memberPerformance.length > 0 ? (
                <div
                  className="grid min-h-0 flex-1 gap-4"
                  style={{ gridTemplateRows: `repeat(${memberPerformance.length}, minmax(0, 1fr))` }}
                >
                  {memberPerformance.map((member, index) => (
                    <motion.div
                      key={member?.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + index * 0.05 }}
                      className="flex min-h-[112px] flex-col justify-center rounded-xl border border-border/50 bg-muted/30 p-5 transition-all hover:border-primary/50"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 border-2 border-background">
                          <AvatarImage src={member?.avatar || "/placeholder.svg"} />
                          <AvatarFallback>{member?.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium truncate">{member?.name}</h4>
                            {member?.id === currentUser?.id && (
                              <Badge variant="outline" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{member?.email}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{member?.completionRate}%</div>
                          <div className="text-xs text-muted-foreground">
                            {member?.completedTasks}/{member?.totalTasks} tasks
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Progress value={member?.completionRate} className="h-2" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
                  <p className="text-sm text-muted-foreground">Add team members to start tracking performance.</p>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Overdue Tasks Alert */}
          {overdueTasks.length > 0 && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
              <Card className="glass-card p-6 rounded-2xl bg-destructive/5 border-destructive/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" /> Overdue Tasks
                  </h3>
                  <Badge variant="destructive">{overdueTasks.length} overdue</Badge>
                </div>

                <div className="space-y-3">
                  {overdueTasks.slice(0, 3).map((task) => {
                    const assignee = "assigneeId" in task ? getUserById(task.assigneeId || "") : null
                    return (
                      <div key={task.id} className="p-3 rounded-lg bg-background/50 border border-destructive/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{task.title}</h4>
                            <p className="text-xs text-muted-foreground">
                              Due: {new Date(task.dueDate!).toLocaleDateString()} • Assigned to:{" "}
                              {assignee?.name || "Unassigned"}
                            </p>
                          </div>
                          <Button size="sm" variant="destructive">
                            Resolve
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Project Progress */}
          {myTeam && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
              <Card className="glass-card p-6 rounded-2xl">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" /> Project Progress
                </h3>

                <div className="space-y-4">
                  <div className="relative pt-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Overall</span>
                      <span className="text-sm font-bold">{myTeam.progress}%</span>
                    </div>
                    <Progress value={myTeam.progress} className="h-3" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                      <div className="text-xl font-bold text-blue-500">{activeTasks.length}</div>
                      <div className="text-xs text-muted-foreground">In Progress</div>
                    </div>
                    <div className="p-3 rounded-lg bg-green-500/10 text-center">
                      <div className="text-xl font-bold text-green-500">{completedTasks.length}</div>
                      <div className="text-xs text-muted-foreground">Completed</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Current Stage</span>
                      <Badge variant="outline" className="capitalize">
                        {myTeam.stage}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Upcoming Meetings */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <Card className="glass-card p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Video className="h-5 w-5 text-purple-500" /> Upcoming Meetings
                </h3>
                <Button variant="ghost" size="sm" asChild>
                  <NextLink href="/dashboard/meetings">
                    <Plus className="h-4 w-4" />
                  </NextLink>
                </Button>
              </div>

              <div className="space-y-3">
                {upcomingMeetings.length > 0 ? (
                  upcomingMeetings.map((meeting) => (
                    <div key={meeting.id} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Video className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{meeting.title}</h4>
                          <p className="text-xs text-muted-foreground">
                            {new Date(meeting.date).toLocaleDateString()} • {meeting.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No upcoming meetings</p>
                    <Button size="sm" className="mt-2" asChild>
                      <NextLink href="/dashboard/meetings">Schedule Meeting</NextLink>
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// DOCTOR/PROFESSOR DASHBOARD
// ============================================
function DoctorDashboard() {
  const { currentUser } = useAuthStore()
  const [greeting, setGreeting] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Good Morning")
    else if (hour < 17) setGreeting("Good Afternoon")
    else setGreeting("Good Evening")

    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const { data: myTeamState } = useMyTeamState()
  const supervisedTeams = myTeamState?.supervisedTeams || []
  
  // Calculate analytics securely from real API data
  const healthyTeams = supervisedTeams.filter((t) => !t.isFull).length // Fallback heuristic
  const atRiskTeams = supervisedTeams.filter((t) => t.isFull && t.stage === "REQUIREMENTS").length
  const criticalTeams = 0

  const pendingSupervisorRequests = (myTeamState?.supervisorRequestsReceived || []).filter(
    (r) => r.status === "PENDING"
  )
  
  // Fake meetings using empty array context
  const upcomingMeetings = meetings
    .filter((m) => supervisedTeams.some((t) => t.id === m.teamId) && new Date(m.date) > new Date())
    .slice(0, 5)

  const quickLinks = [
    {
      title: "Supervision",
      icon: ClipboardList,
      href: "/dashboard/supervisor-toolkit",
      count: supervisedTeams.length,
      color: "from-blue-500 to-cyan-500",
      description: "Team oversight",
    },
    {
      title: "Proposals",
      icon: FileText,
      href: "/dashboard/proposals",
      count: pendingSupervisorRequests.length,
      color: "from-orange-500 to-amber-500",
      description: "Review submissions",
      urgent: pendingSupervisorRequests.length > 0,
    },
    {
      title: "Submissions",
      icon: Upload,
      href: "/dashboard/submissions",
      count: 0,
      color: "from-purple-500 to-pink-500",
      description: "Grade deliverables",
    },
    {
      title: "Meetings",
      icon: Video,
      href: "/dashboard/meetings",
      count: upcomingMeetings.length,
      color: "from-green-500 to-emerald-500",
      description: "Student meetings",
    },
    {
      title: "Grades Overview",
      icon: ClipboardCheck,
      href: "/dashboard/evaluations",
      count: 0,
      color: "from-indigo-500 to-violet-500",
      description: "Final grades",
    },
    {
      title: "Analytics",
      icon: BarChart3,
      href: "/dashboard/analytics",
      count: 0,
      color: "from-rose-500 to-pink-500",
      description: "Performance metrics",
    },
    {
      title: "Reports",
      icon: FileText,
      href: "/dashboard/reports",
      count: 0,
      color: "from-gray-500 to-slate-500",
      description: "Academic reports",
    },
    {
      title: "Risk Management",
      icon: AlertTriangle,
      href: "/dashboard/risk-management",
      count: 0,
      color: "from-teal-500 to-cyan-500",
      description: "At-risk teams",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl glass-card p-6 md:p-8 border border-border/50"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4">
              <motion.div whileHover={{ scale: 1.05, rotate: 5 }} className="relative">
                <Avatar className="h-16 w-16 border-4 border-blue-500/20 shadow-xl">
                  <AvatarImage src={currentUser?.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="text-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
                    {currentUser?.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-blue-500 border-2 border-background">
                  <GraduationCap className="w-3 h-3 text-white" />
                </div>
              </motion.div>

              <div className="min-w-0">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
                >
                  <Clock className="h-4 w-4" />
                  <span>
                    {currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </span>
                  <span className="font-mono text-primary">{currentTime.toLocaleTimeString()}</span>
                </motion.div>

                <h1 className="text-xl md:text-2xl font-semibold leading-tight">
                  {greeting}, <span className="text-primary">{currentUser?.name}</span>!
                </h1>
              </div>
            </div>
          </div>

          {/* Alert Banner */}
          {(pendingSupervisorRequests.length > 0 || atRiskTeams > 0 || criticalTeams > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <h4 className="font-medium">Action Required</h4>
                  <p className="text-sm text-muted-foreground">
                    {pendingSupervisorRequests.length > 0 && `${pendingSupervisorRequests.length} team supervisor requests pending. `}
                    {(atRiskTeams > 0 || criticalTeams > 0) && `${atRiskTeams + criticalTeams} teams need attention.`}
                  </p>
                </div>
              </div>
              <Button size="sm" asChild>
                <NextLink href={pendingSupervisorRequests.length > 0 ? "/dashboard/my-team" : "/dashboard/proposals"}>Review Now</NextLink>
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Role-aware action inbox — Doctor version */}
      <RoleActionInbox />

      {/* Quick Access Grid */}
      <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Quick Access
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickLinks.map((link, index) => (
            <motion.div
              key={link.title}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15 + index * 0.05 }}
              whileHover={{ scale: 1.03, y: -5 }}
            >
              <NextLink href={link.href}>
                <Card
                  className={cn(
                    "glass-card p-4 h-full cursor-pointer group hover:border-primary/50 transition-all overflow-hidden relative",
                    link.urgent && "border-orange-500/50",
                  )}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${link.color} opacity-0 group-hover:opacity-5 transition-opacity`}
                  />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={`p-2.5 rounded-xl bg-gradient-to-br ${link.color} group-hover:scale-110 transition-transform`}
                      >
                        <link.icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex items-center gap-1">
                        {link.urgent && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                          </span>
                        )}
                        {link.count > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {link.count}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{link.title}</h3>
                    <p className="text-xs text-foreground/75 mt-1">{link.description}</p>
                  </div>
                </Card>
              </NextLink>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Teams List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card className="glass-card p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" /> Supervised Teams
              </h3>
              <Button variant="outline" size="sm" asChild className="bg-transparent">
                <NextLink href="/dashboard/teams">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </NextLink>
              </Button>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {supervisedTeams.map((team, index) => {
                  const leader = team.leader
                  const progress = getTeamProgressFallback(team)
                  return (
                    <motion.div
                      key={team.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + index * 0.05 }}
                      className="p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/50 transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={leader?.avatarUrl || "/placeholder.svg"} />
                            <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-medium">{team.name}</h4>
                            <p className="text-xs text-muted-foreground">Led by {leader?.fullName}</p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            !team.isFull
                              ? "default"
                              : team.stage === "REQUIREMENTS"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {!team.isFull ? "healthy" : "at-risk"}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                        <span>{team.memberCount} members</span>
                        <Badge variant="outline" className="capitalize">
                          {team.stage}
                        </Badge>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </ScrollArea>
          </Card>
        </motion.div>

        {/* Right Column */}
        <div className="flex h-full min-h-0 flex-col gap-6">
          {/* Team Health Overview */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
            <Card className="glass-card p-6 rounded-2xl">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" /> Team Health
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Healthy</span>
                  </div>
                  <span className="font-bold text-green-500">{healthyTeams}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span>At Risk</span>
                  </div>
                  <span className="font-bold text-yellow-500">{atRiskTeams}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span>Critical</span>
                  </div>
                  <span className="font-bold text-red-500">{criticalTeams}</span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Schedule */}
          <motion.div className="min-h-0 flex-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <ScheduleCard className="h-full" />
          </motion.div>

          {/* Upcoming Meetings */}
          <motion.div className="hidden" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <Card className="glass-card p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-500" /> Schedule
                </h3>
                <Button variant="ghost" size="sm" asChild>
                  <NextLink href="/dashboard/calendar">
                    <Plus className="h-4 w-4" />
                  </NextLink>
                </Button>
              </div>

              <div className="space-y-3">
                {upcomingMeetings.slice(0, 4).map((meeting) => {
                  const team = teams.find((t) => t.id === meeting.teamId)
                  return (
                    <div key={meeting.id} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Video className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{meeting.title}</h4>
                          <p className="text-xs text-muted-foreground">
                            {team?.name} • {new Date(meeting.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// TEACHING ASSISTANT DASHBOARD
// ============================================
function TADashboard() {
  const { currentUser } = useAuthStore()
  const [greeting, setGreeting] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Good Morning")
    else if (hour < 17) setGreeting("Good Afternoon")
    else setGreeting("Good Evening")

    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const { data: myTeamState } = useMyTeamState()
  const supervisedTeams = myTeamState?.supervisedTeams || []
  
  // Fake meetings using empty array context
  const upcomingMeetings = meetings
    .filter((m) => supervisedTeams.some((t) => t.id === m.teamId) && new Date(m.date) > new Date())
    .slice(0, 5)

  const quickLinks = [
    {
      title: "Review Tasks",
      icon: ClipboardCheck,
      href: "/dashboard/reviews",
      count: 0,
      color: "from-blue-500 to-cyan-500",
      description: "TA task queue",
    },
    {
      title: "Supervision",
      icon: ClipboardList,
      href: "/dashboard/supervisor-toolkit",
      count: supervisedTeams.length,
      color: "from-orange-500 to-amber-500",
      description: "Assist teams",
    },
    {
      title: "Submissions",
      icon: Upload,
      href: "/dashboard/submissions",
      count: 0,
      color: "from-purple-500 to-pink-500",
      description: "First-pass grading",
    },
    {
      title: "My Teams",
      icon: Users,
      href: "/dashboard/teams",
      count: 0,
      color: "from-green-500 to-emerald-500",
      description: "Assigned teams",
    },
    {
      title: "Risk Management",
      icon: AlertTriangle,
      href: "/dashboard/risk-management",
      count: 0,
      color: "from-indigo-500 to-violet-500",
      description: "Team blockers",
    },
    {
      title: "Meetings",
      icon: Video,
      href: "/dashboard/meetings",
      count: upcomingMeetings.length,
      color: "from-rose-500 to-pink-500",
      description: "Review sessions",
    },
    {
      title: "GitHub",
      icon: GitBranch,
      href: "/dashboard/github",
      count: 0,
      color: "from-gray-500 to-slate-500",
      description: "Code activity",
    },
    {
      title: "Chat",
      icon: MessageSquare,
      href: "/dashboard/chat",
      count: 0,
      color: "from-teal-500 to-cyan-500",
      description: "Direct messages",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl glass-card p-6 md:p-8 border border-border/50"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-cyan-500/5 to-blue-500/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-teal-500/20 to-transparent rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4">
              <motion.div whileHover={{ scale: 1.05, rotate: 5 }} className="relative">
                <Avatar className="h-16 w-16 border-4 border-teal-500/20 shadow-xl">
                  <AvatarImage src={currentUser?.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="text-xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white">
                    {currentUser?.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-teal-500 border-2 border-background">
                  <BookOpen className="w-3 h-3 text-white" />
                </div>
              </motion.div>

              <div className="min-w-0">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
                >
                  <Clock className="h-4 w-4" />
                  <span>
                    {currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </span>
                  <span className="font-mono text-primary">{currentTime.toLocaleTimeString()}</span>
                </motion.div>

                <h1 className="text-xl md:text-2xl font-semibold leading-tight">
                  {greeting}, <span className="text-primary">{currentUser?.name}</span>!
                </h1>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Role-aware action inbox — TA version */}
      <RoleActionInbox />

      {/* Quick Access Grid */}
      <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Quick Access
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickLinks.map((link, index) => (
            <motion.div
              key={link.title}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15 + index * 0.05 }}
              whileHover={{ scale: 1.03, y: -5 }}
            >
              <NextLink href={link.href}>
                <Card className="glass-card p-4 h-full cursor-pointer group hover:border-primary/50 transition-all overflow-hidden relative">
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${link.color} opacity-0 group-hover:opacity-5 transition-opacity`}
                  />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={`p-2.5 rounded-xl bg-gradient-to-br ${link.color} group-hover:scale-110 transition-transform`}
                      >
                        <link.icon className="h-5 w-5 text-white" />
                      </div>
                      {link.count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {link.count}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{link.title}</h3>
                    <p className="text-xs text-foreground/75 mt-1">{link.description}</p>
                  </div>
                </Card>
              </NextLink>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Teams List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card className="glass-card p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" /> Supervised Teams
              </h3>
              <Button variant="outline" size="sm" asChild className="bg-transparent">
                <NextLink href="/dashboard/teams">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </NextLink>
              </Button>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {supervisedTeams.map((team, index) => {
                  const leader = team.leader
                  const progress = getTeamProgressFallback(team)
                  return (
                    <motion.div
                      key={team.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + index * 0.05 }}
                      className="p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/50 transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={leader?.avatarUrl || "/placeholder.svg"} />
                            <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-medium">{team.name}</h4>
                            <p className="text-xs text-muted-foreground">Led by {leader?.fullName}</p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            !team.isFull
                              ? "default"
                              : team.stage === "REQUIREMENTS"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {!team.isFull ? "healthy" : "at-risk"}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                        <span>{team.memberCount} members</span>
                        <Badge variant="outline" className="capitalize">
                          {team.stage}
                        </Badge>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </ScrollArea>
          </Card>
        </motion.div>

        {/* Right Column */}
        <div className="flex h-full min-h-0 flex-col gap-6">
          {/* Schedule */}
          <motion.div className="min-h-0 flex-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
            <ScheduleCard className="h-full" />
          </motion.div>

          {/* Meetings */}
          <motion.div className="min-h-0 flex-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <MeetingsCard className="h-full" />
          </motion.div>

          {/* Upcoming Meetings */}
          <motion.div className="hidden" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <Card className="glass-card p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Video className="h-5 w-5 text-purple-500" /> Meetings
                </h3>
                <Button variant="ghost" size="sm" asChild>
                  <NextLink href="/dashboard/calendar">
                    <Plus className="h-4 w-4" />
                  </NextLink>
                </Button>
              </div>

              <div className="space-y-3">
                {upcomingMeetings.slice(0, 4).map((meeting) => {
                  const team = teams.find((t) => t.id === meeting.teamId)
                  return (
                    <div key={meeting.id} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Video className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{meeting.title}</h4>
                          <p className="text-xs text-muted-foreground">
                            {team?.name} • {new Date(meeting.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// ADMIN DASHBOARD
// ============================================
function AdminDashboard() {
  const { currentUser, hasHydrated } = useAuthStore()
  const systemHealthCardRef = useRef<HTMLDivElement | null>(null)
  const [greeting, setGreeting] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [usersSummary, setUsersSummary] = useState<UsersSummary | null>(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState("")
  const [backendHealth, setBackendHealth] = useState<{ ok: boolean; latencyMs: number | null; error: string }>({
    ok: false,
    latencyMs: null,
    error: "",
  })
  const [systemLogs, setSystemLogs] = useState<SystemLogsResponse | null>(null)
  const [recentActivities, setRecentActivities] = useState<ActivityEntry[]>([])
  const [isAdminMetricsLoading, setIsAdminMetricsLoading] = useState(true)
  const [adminMetricsError, setAdminMetricsError] = useState("")
  const [recentActivityHeight, setRecentActivityHeight] = useState<number | null>(null)

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Good Morning")
    else if (hour < 17) setGreeting("Good Afternoon")
    else setGreeting("Good Evening")

    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!hasHydrated || currentUser?.role !== "admin") return

    let cancelled = false
    setIsSummaryLoading(true)
    setSummaryError("")

    usersApi
      .summary()
      .then((result) => {
        if (cancelled) return
        setUsersSummary(result)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setSummaryError(error instanceof Error ? error.message : "Couldn't load real user counters.")
      })
      .finally(() => {
        if (!cancelled) setIsSummaryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentUser?.role, hasHydrated])

  useEffect(() => {
    if (!hasHydrated || currentUser?.role !== "admin") return

    const card = systemHealthCardRef.current
    if (!card) return

    const updateHeight = () => {
      if (window.innerWidth < 1024) {
        setRecentActivityHeight(null)
        return
      }
      setRecentActivityHeight(Math.ceil(card.getBoundingClientRect().height))
    }

    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(card)
    window.addEventListener("resize", updateHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", updateHeight)
    }
  }, [currentUser?.role, hasHydrated, isSummaryLoading, summaryError, isAdminMetricsLoading, adminMetricsError])

  useEffect(() => {
    if (!hasHydrated || currentUser?.role !== "admin") return

    let cancelled = false

    async function loadAdminMetrics() {
      setIsAdminMetricsLoading(true)
      setAdminMetricsError("")

      const startedAt = performance.now()
      const healthPromise = fetch(getBackendHealthUrl(), { cache: "no-store" })
        .then(async (response) => {
          const body = await response.json().catch(() => null)
          return {
            ok: response.ok && body?.ok === true,
            latencyMs: Math.round(performance.now() - startedAt),
            error: response.ok ? "" : `Health check failed (${response.status})`,
          }
        })
        .catch((error: unknown) => ({
          ok: false,
          latencyMs: Math.round(performance.now() - startedAt),
          error: error instanceof Error ? error.message : "Health check failed.",
        }))

      try {
        const [health, logsResult, activityResult] = await Promise.all([
          healthPromise,
          adminLogsApi.getSystemLogs({ page: 1, limit: 5 }),
          adminLogsApi.getUserActivity({ page: 1, limit: 12 }),
        ])

        if (cancelled) return
        setBackendHealth(health)
        setSystemLogs(logsResult)
        setRecentActivities(activityResult.activities)
      } catch (error: unknown) {
        if (cancelled) return
        setBackendHealth(await healthPromise)
        setSystemLogs(null)
        setRecentActivities([])
        setAdminMetricsError(error instanceof Error ? error.message : "Couldn't load admin dashboard activity.")
      } finally {
        if (!cancelled) setIsAdminMetricsLoading(false)
      }
    }

    void loadAdminMetrics()

    return () => {
      cancelled = true
    }
  }, [currentUser?.role, hasHydrated])

  const totalUsers = usersSummary?.totalUsers
  const totalTeams = teams.length
  const totalDoctors = usersSummary?.byRole.doctors
  const totalTAs = usersSummary?.byRole.tas
  const totalStudents = usersSummary?.byRole.students
  const totalLeaders = usersSummary?.byRole.leaders
  const totalAdmins = usersSummary?.byRole.admins

  const formatSummaryValue = (value?: number) => {
    if (isSummaryLoading) return "..."
    if (summaryError) return "--"
    return value ?? 0
  }

  const quickLinks = [
    {
      title: "User Management",
      icon: Users,
      href: "/dashboard/admin",
      count: isSummaryLoading || summaryError ? undefined : (totalUsers ?? 0),
      color: "from-blue-500 to-cyan-500",
      description: "Manage all users",
    },
    {
      title: "All Teams",
      icon: Users2,
      href: "/dashboard/teams",
      count: totalTeams,
      color: "from-purple-500 to-pink-500",
      description: "Team directory",
    },
    {
      title: "Audit Logs",
      icon: ClipboardList,
      href: "/dashboard/admin/logs",
      count: 0,
      color: "from-green-500 to-emerald-500",
      description: "Activity history",
    },
    {
      title: "Analytics",
      icon: BarChart3,
      href: "/dashboard/analytics",
      count: 0,
      color: "from-orange-500 to-amber-500",
      description: "System analytics",
    },
    {
      title: "Reports",
      icon: FileText,
      href: "/dashboard/reports",
      count: 0,
      color: "from-indigo-500 to-violet-500",
      description: "Platform reports",
    },
    {
      title: "Grades Overview",
      icon: Award,
      href: "/dashboard/evaluations",
      count: 0,
      color: "from-rose-500 to-pink-500",
      description: "Academic outcomes",
    },
    {
      title: "Announcements",
      icon: Megaphone,
      href: "/dashboard/announcements",
      count: 0,
      color: "from-teal-500 to-cyan-500",
      description: "Broadcast updates",
    },
    {
      title: "Chat",
      icon: MessageSquare,
      href: "/dashboard/chat",
      count: 0,
      color: "from-gray-500 to-slate-500",
      description: "Operational messages",
    },
  ]

  const apiLatencyStatus: AdminHealthStatus =
    backendHealth.latencyMs === null ? "warning" : backendHealth.latencyMs <= 750 ? "healthy" : backendHealth.latencyMs <= 1500 ? "warning" : "error"
  const adminDataStatus: AdminHealthStatus =
    isSummaryLoading || isAdminMetricsLoading ? "warning" : summaryError || adminMetricsError ? "error" : "healthy"
  const errorLogCount = systemLogs?.counts.error ?? 0
  const systemHealth: Array<{
    label: string
    value: string
    status: AdminHealthStatus
    icon: typeof Activity
    detail: string
  }> = [
    {
      label: "Backend API",
      value: isAdminMetricsLoading ? "Checking..." : backendHealth.ok ? "Online" : "Unavailable",
      status: isAdminMetricsLoading ? "warning" : backendHealth.ok ? "healthy" : "error",
      icon: Server,
      detail: backendHealth.error || "Verified through the backend health endpoint.",
    },
    {
      label: "Response Time",
      value: backendHealth.latencyMs === null ? "..." : `${backendHealth.latencyMs}ms`,
      status: backendHealth.ok ? apiLatencyStatus : "error",
      icon: Zap,
      detail: "Measured from this dashboard to the backend health endpoint.",
    },
    {
      label: "Admin Data API",
      value: adminDataStatus === "healthy" ? "Available" : isSummaryLoading || isAdminMetricsLoading ? "Checking..." : "Issue",
      status: adminDataStatus,
      icon: Shield,
      detail: summaryError || adminMetricsError || "Users, logs, and activity endpoints responded successfully.",
    },
    {
      label: "Error Logs",
      value: isAdminMetricsLoading ? "Checking..." : `${errorLogCount} open`,
      status: isAdminMetricsLoading ? "warning" : errorLogCount > 0 ? "warning" : "healthy",
      icon: AlertTriangle,
      detail: "Live count from the admin system logs endpoint.",
    },
  ]
  const visibleRecentActivities = recentActivities.slice(0, 6)

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl glass-card p-6 md:p-8 border border-border/50"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 via-orange-500/5 to-amber-500/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-rose-500/20 to-transparent rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4">
              <motion.div whileHover={{ scale: 1.05, rotate: 5 }} className="relative">
                <Avatar className="h-16 w-16 border-4 border-rose-500/20 shadow-xl">
                  <AvatarImage src={currentUser?.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="text-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white">
                    {currentUser?.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-rose-500 border-2 border-background">
                  <Shield className="w-3 h-3 text-white" />
                </div>
              </motion.div>

              <div className="min-w-0">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
                >
                  <Clock className="h-4 w-4" />
                  <span>
                    {currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </span>
                  <span className="font-mono text-primary">{currentTime.toLocaleTimeString()}</span>
                </motion.div>

                <h1 className="text-xl md:text-2xl font-semibold leading-tight">
                  {greeting}, <span className="text-primary">{currentUser?.name}</span>!
                </h1>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Access Grid */}
      <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Quick Access
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickLinks.map((link, index) => (
            <motion.div
              key={link.title}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15 + index * 0.05 }}
              whileHover={{ scale: 1.03, y: -5 }}
            >
              <NextLink href={link.href}>
                <Card className="glass-card p-4 h-full cursor-pointer group hover:border-primary/50 transition-all overflow-hidden relative">
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${link.color} opacity-0 group-hover:opacity-5 transition-opacity`}
                  />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={`p-2.5 rounded-xl bg-gradient-to-br ${link.color} group-hover:scale-110 transition-transform`}
                      >
                        <link.icon className="h-5 w-5 text-white" />
                      </div>
                      {typeof link.count === "number" && link.count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {link.count}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{link.title}</h3>
                    <p className="text-xs text-foreground/75 mt-1">{link.description}</p>
                  </div>
                </Card>
              </NextLink>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* System Health */}
        <motion.div
          initial={{ x: -20 }}
          animate={{ x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 lg:row-start-1"
        >
          <Card ref={systemHealthCardRef} className="glass-card p-6 pb-5 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" /> System Health
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {systemHealth.map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  className={cn(
                    "p-4 rounded-xl border",
                    item.status === "healthy"
                      ? "bg-green-500/10 border-green-500/30"
                      : item.status === "warning"
                        ? "bg-yellow-500/10 border-yellow-500/30"
                        : "bg-red-500/10 border-red-500/30",
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <item.icon
                      className={cn(
                        "h-4 w-4",
                        item.status === "healthy"
                          ? "text-green-500"
                          : item.status === "warning"
                            ? "text-yellow-500"
                            : "text-red-500",
                      )}
                    />
                    <span className="text-sm font-semibold text-foreground">{item.label}</span>
                  </div>
                  <div className="text-lg font-bold">{item.value}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p>
                </motion.div>
              ))}
            </div>

            {/* User Distribution */}
            <div className="space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground">User Distribution</h4>
                <p className={cn("text-xs", summaryError ? "text-red-500" : "text-muted-foreground")}>
                  {summaryError || "Live role counts from the backend database"}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-3 rounded-xl bg-muted/30 text-center">
                  <div className="text-2xl font-bold text-blue-500">{formatSummaryValue(totalDoctors)}</div>
                  <div className="text-xs text-muted-foreground">Doctors</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 text-center">
                  <div className="text-2xl font-bold text-teal-500">{formatSummaryValue(totalTAs)}</div>
                  <div className="text-xs text-muted-foreground">TAs</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 text-center">
                  <div className="text-2xl font-bold text-purple-500">{formatSummaryValue(totalStudents)}</div>
                  <div className="text-xs text-muted-foreground">Students</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 text-center">
                  <div className="text-2xl font-bold text-amber-500">{formatSummaryValue(totalLeaders)}</div>
                  <div className="text-xs text-muted-foreground">Team Leaders</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 text-center">
                  <div className="text-2xl font-bold text-rose-500">{formatSummaryValue(totalAdmins)}</div>
                  <div className="text-xs text-muted-foreground">Admins</div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Right Column */}
        <div className="min-h-0 lg:row-start-1 lg:self-start" style={recentActivityHeight ? { height: recentActivityHeight } : undefined}>
          {/* Recent Activity */}
          <motion.div className="h-full max-h-full min-h-0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
            <Card className="glass-card flex h-full min-h-0 flex-col overflow-hidden p-6 rounded-2xl">
              <div className="mb-4 flex shrink-0 items-center justify-between">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" /> Recent Activity
                </h3>
              </div>

              <ScrollArea className="-mr-3 min-h-0 flex-1 pr-3">
                <div className="space-y-3">
                  {isAdminMetricsLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                        <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-28 rounded bg-muted" />
                          <div className="h-3 w-full rounded bg-muted" />
                        </div>
                      </div>
                    ))
                  ) : adminMetricsError ? (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
                      {adminMetricsError}
                    </div>
                  ) : recentActivities.length === 0 ? (
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                      No recent activity is available yet.
                    </div>
                  ) : (
                    visibleRecentActivities.map((activity, index) => {
                      const ActivityIcon = getAdminActivityIcon(activity.action)
                      return (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + index * 0.05 }}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-all"
                        >
                          <Avatar className="h-9 w-9 shrink-0 border border-border/60">
                            <AvatarImage src={activity.user.avatarUrl || "/placeholder.svg"} />
                            <AvatarFallback className="text-xs">
                              {activity.user.name
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <ActivityIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                              <p className="truncate text-sm font-medium">{activity.user.name}</p>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {activity.action} {activity.target}
                            </p>
                            {activity.teamName && (
                              <Badge variant="outline" className="mt-2 text-[10px]">
                                {activity.teamName}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatRelativeTime(activity.timestamp)}
                          </span>
                        </motion.div>
                      )
                    })
                  )}
                </div>
              </ScrollArea>

              <Button variant="outline" className="mt-4 w-full shrink-0 bg-transparent" asChild>
                <NextLink href="/dashboard/admin/logs">View All Logs</NextLink>
              </Button>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
