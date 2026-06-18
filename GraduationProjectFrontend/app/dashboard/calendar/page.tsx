"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type React from "react"
import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Clock3,
  ExternalLink,
  Filter,
  Link2,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  Trash2,
  Users,
  Video,
} from "lucide-react"
import { motion, useReducedMotion, type Variants } from "framer-motion"
import { useSearchParams } from "next/navigation"
import { TeamRequiredGuard } from "@/components/team-required-guard"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { calendarApi } from "@/lib/api/calendar"
import { meetingsApi } from "@/lib/api/meetings"
import type { ApiCalendarEvent, ApiCalendarIntegration, ApiCalendarProvider } from "@/lib/api/types"
import { getSocket } from "@/lib/socket"
import { useAuthStore } from "@/lib/stores/auth-store"
import { cn } from "@/lib/utils"

type CalendarView = "month" | "week" | "day" | "agenda"
type SourceFilter = "ALL" | "MEETING" | "TASK_DEADLINE"
type ProviderAction = "connect" | "sync" | "disconnect"

type PendingAction = {
  title: string
  description: string
  confirmLabel: string
  confirmVariant?: "default" | "destructive"
  details?: Array<{ label: string; value: string }>
  action: () => Promise<void>
}

const weekStartsOn = 6 as const
const viewLabels: Record<CalendarView, string> = {
  month: "Month",
  week: "Week",
  day: "Day",
  agenda: "Agenda",
}

const sourceLabel: Record<ApiCalendarEvent["sourceType"], string> = {
  MEETING: "Meeting",
  TASK_DEADLINE: "Task deadline",
}

const sourceBadgeClass: Record<ApiCalendarEvent["sourceType"], string> = {
  MEETING: "border-primary/30 bg-primary/10 text-primary",
  TASK_DEADLINE: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
}

const sourceBorderColor: Record<ApiCalendarEvent["sourceType"], string> = {
  MEETING: "border-l-primary",
  TASK_DEADLINE: "border-l-amber-400",
}

const statusClass: Record<string, string> = {
  PENDING_APPROVAL: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
  CONFIRMED: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
  COMPLETED: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
  CANCELLED: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  DECLINED: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200",
  NOT_STARTED: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  IN_PROGRESS: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
  DONE: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
  BLOCKED: "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200",
}

const labelOverrides: Record<string, string> = {
  TA: "TA",
  GOOGLE: "Google",
  OUTLOOK: "Outlook",
  GOOGLE_MEET: "Google Meet",
  MICROSOFT_TEAMS: "Microsoft Teams",
  PENDING_APPROVAL: "Pending approval",
  PROPOSED_NEW_TIME: "Proposed new time",
  IN_PERSON: "In person",
  TASK_DEADLINE: "Task deadline",
  NOT_CONNECTED: "Not connected",
  IN_PROGRESS: "In progress",
}

function formatLabel(value?: string | null) {
  if (!value) return "Not set"
  if (labelOverrides[value]) return labelOverrides[value]
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getCalendarDays(date: Date) {
  const gridStart = startOfWeek(startOfMonth(date), { weekStartsOn })
  const gridEnd = endOfWeek(endOfMonth(date), { weekStartsOn })
  const days: Date[] = []
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    days.push(cursor)
  }
  return days
}

function getWeekDays(date: Date) {
  const weekStart = startOfWeek(date, { weekStartsOn })
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

function getLoadRange(view: CalendarView, month: Date, selectedDay: Date) {
  if (view === "day") return { start: startOfDay(selectedDay), end: endOfDay(selectedDay) }
  if (view === "week") {
    return {
      start: startOfWeek(selectedDay, { weekStartsOn }),
      end: endOfWeek(selectedDay, { weekStartsOn }),
    }
  }
  return {
    start: startOfWeek(startOfMonth(month), { weekStartsOn }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn }),
  }
}

function sortEvents(events: ApiCalendarEvent[]) {
  return [...events].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
}

function isEventOnDay(event: ApiCalendarEvent, day: Date) {
  const start = new Date(event.startAt)
  const end = new Date(event.endAt)
  return startOfDay(start) <= endOfDay(day) && endOfDay(end) >= startOfDay(day)
}

function formatEventTime(event: ApiCalendarEvent) {
  const start = new Date(event.startAt)
  const end = new Date(event.endAt)
  if (event.allDay) return "All day"
  if (isSameDay(start, end)) return `${format(start, "p")} – ${format(end, "p")}`
  return `${format(start, "MMM d, p")} – ${format(end, "MMM d, p")}`
}

function compactParticipants(event: ApiCalendarEvent) {
  const people = event.participants || []
  if (people.length === 0) return "No participants listed"
  const names = people.slice(0, 3).map((p) => p.displayName || p.email || formatLabel(p.participantRole))
  const remaining = people.length - names.length
  return remaining > 0 ? `${names.join(", ")} +${remaining} more` : names.join(", ")
}

function providerLabel(provider: ApiCalendarProvider) {
  return provider === "GOOGLE" ? "Google Calendar" : "Outlook Calendar"
}

export default function CalendarPage() {
  const searchParams = useSearchParams()
  const { accessToken, currentUser } = useAuthStore()
  const prefersReducedMotion = useReducedMotion()
  const [view, setView] = useState<CalendarView>("month")
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [teamFilter, setTeamFilter] = useState("ALL")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<ApiCalendarEvent[]>([])
  const [integrations, setIntegrations] = useState<ApiCalendarIntegration[]>([])
  const [selectedEvent, setSelectedEvent] = useState<ApiCalendarEvent | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [runningAction, setRunningAction] = useState(false)

  const loadPage = useCallback(async (quiet = false) => {
    try {
      if (quiet) setRefreshing(true)
      else setLoading(true)
      setError(null)
      const range = getLoadRange(view, month, selectedDay)
      const [nextEvents, nextIntegrations] = await Promise.all([
        calendarApi.listEvents({ start: range.start.toISOString(), end: range.end.toISOString() }),
        calendarApi.listIntegrations(),
      ])
      setEvents(sortEvents(nextEvents))
      setIntegrations(nextIntegrations)
    } catch (err: any) {
      const message = err?.message || "Failed to load calendar."
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [month, selectedDay, view])

  useEffect(() => { void loadPage(false) }, [loadPage])

  useEffect(() => {
    const provider = searchParams.get("provider")
    const status = searchParams.get("status")
    const message = searchParams.get("message")
    if (!provider || !status || !message) return
    if (status === "connected") toast.success(message)
    else toast.error(message)
  }, [searchParams])

  useEffect(() => {
    if (!accessToken) return
    const socket = getSocket(accessToken)
    if (!socket) return
    const handler = () => void loadPage(true)
    const evNames = [
      "meeting.created", "meeting.pending", "meeting.approved", "meeting.declined",
      "meeting.updated", "meeting.cancelled", "meeting.completed", "meeting.deleted",
      "calendar.event.updated", "task.deadline.updated",
    ]
    evNames.forEach((n) => socket.on(n, handler))
    return () => { evNames.forEach((n) => socket.off(n, handler)) }
  }, [accessToken, loadPage])

  const isSupervisor = currentUser?.role === "doctor" || currentUser?.role === "ta"

  const teamOptions = useMemo(() => {
    const seen = new Map<string, string>()
    events.forEach((e) => { if (e.team?.id && e.team?.name) seen.set(e.team.id, e.team.name) })
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [events])

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase()
    return events.filter((event) => {
      if (sourceFilter !== "ALL" && event.sourceType !== sourceFilter) return false
      if (statusFilter !== "ALL" && event.status !== statusFilter) return false
      if (isSupervisor && teamFilter !== "ALL" && event.team?.id !== teamFilter) return false
      if (!query) return true
      return [event.title, event.description, event.team?.name, event.organizer?.fullName, event.assignee?.fullName, event.location, event.provider, event.externalProvider]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(query))
    })
  }, [events, search, sourceFilter, statusFilter, teamFilter, isSupervisor])

  const statusOptions = useMemo(() => {
    const values = Array.from(new Set(events.map((e) => e.status).filter(Boolean)))
    return ["ALL", ...values]
  }, [events])

  const eventsByDay = useMemo(() => {
    return filteredEvents.reduce<Record<string, ApiCalendarEvent[]>>((groups, event) => {
      const start = startOfDay(new Date(event.startAt))
      const end = startOfDay(new Date(event.endAt))
      for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
        const key = format(cursor, "yyyy-MM-dd")
        groups[key] = groups[key] || []
        groups[key].push(event)
      }
      return groups
    }, {})
  }, [filteredEvents])

  const calendarDays = useMemo(() => getCalendarDays(month), [month])
  const weekDays = useMemo(() => getWeekDays(selectedDay), [selectedDay])
  const selectedEvents = useMemo(
    () => sortEvents(filteredEvents.filter((e) => isEventOnDay(e, selectedDay))),
    [filteredEvents, selectedDay]
  )
  const agendaEvents = useMemo(() => sortEvents(filteredEvents), [filteredEvents])
  const todayEvents = useMemo(() => filteredEvents.filter((e) => isEventOnDay(e, new Date())), [filteredEvents])
  const meetingEvents = filteredEvents.filter((e) => e.sourceType === "MEETING")
  const taskEvents = filteredEvents.filter((e) => e.sourceType === "TASK_DEADLINE")
  const actionNeededEvents = filteredEvents.filter(
    (e) => e.status === "PENDING_APPROVAL" || e.status === "DECLINED" || e.externalSyncStatus === "ERROR"
  )
  const googleIntegration = integrations.find((i) => i.provider === "GOOGLE")
  const outlookIntegration = integrations.find((i) => i.provider === "OUTLOOK")
  const connectedCount = integrations.filter((i) => i.syncEnabled).length
  const visibleRange = getLoadRange(view, month, selectedDay)

  function selectDay(day: Date, nextView: CalendarView = "day") {
    setSelectedDay(day)
    setMonth(day)
    setView(nextView)
  }

  function goToday() {
    const now = new Date()
    setMonth(now)
    setSelectedDay(now)
  }

  function moveCursor(direction: -1 | 1) {
    if (view === "month" || view === "agenda") {
      const nextMonth = addMonths(month, direction)
      setMonth(nextMonth)
      if (!isSameMonth(selectedDay, nextMonth)) setSelectedDay(startOfMonth(nextMonth))
      return
    }
    if (view === "week") {
      const nextDay = addWeeks(selectedDay, direction)
      setSelectedDay(nextDay)
      setMonth(nextDay)
      return
    }
    const nextDay = addDays(selectedDay, direction)
    setSelectedDay(nextDay)
    setMonth(nextDay)
  }

  async function connect(provider: ApiCalendarProvider) {
    try {
      setRunningAction(true)
      const data = provider === "GOOGLE" ? await calendarApi.connectGoogle() : await calendarApi.connectOutlook()
      window.location.href = data.url
    } catch (err: any) {
      toast.error(err?.message || `Failed to start ${providerLabel(provider)} connection.`)
    } finally {
      setRunningAction(false)
    }
  }

  async function syncProvider(provider: ApiCalendarProvider, meetingId?: string) {
    try {
      setRunningAction(true)
      await calendarApi.syncProvider(provider, meetingId)
      toast.success(`${providerLabel(provider)} sync started`)
      await loadPage(true)
    } catch (err: any) {
      toast.error(err?.message || `Failed to sync ${providerLabel(provider)}.`)
    } finally {
      setRunningAction(false)
    }
  }

  async function disconnect(provider: ApiCalendarProvider) {
    try {
      setRunningAction(true)
      await calendarApi.disconnect(provider)
      toast.success(`${providerLabel(provider)} disconnected`)
      await loadPage(true)
    } catch (err: any) {
      toast.error(err?.message || `Failed to disconnect ${providerLabel(provider)}.`)
    } finally {
      setRunningAction(false)
    }
  }

  function requestProviderAction(provider: ApiCalendarProvider, action: ProviderAction) {
    if (action === "connect") { void connect(provider); return }
    if (action === "sync") { void syncProvider(provider); return }
    setPendingAction({
      title: `Disconnect ${providerLabel(provider)}?`,
      description: "Calendar events stay in the project, but automatic sync stops until reconnected.",
      confirmLabel: "Disconnect",
      confirmVariant: "destructive",
      details: [{ label: "Provider", value: providerLabel(provider) }],
      action: async () => disconnect(provider),
    })
  }

  async function copyEventLink(event: ApiCalendarEvent) {
    if (!event.joinUrl) return
    try {
      await navigator.clipboard.writeText(event.joinUrl)
      toast.success("Meeting link copied")
    } catch {
      toast.error("Could not copy the meeting link")
    }
  }

  function requestMeetingAction(event: ApiCalendarEvent, kind: "cancel" | "complete" | "delete" | "sync") {
    if (event.sourceType !== "MEETING") return
    if (kind === "sync") {
      if (!event.externalProvider) { toast.error("This meeting is not connected to Google or Outlook."); return }
      void syncProvider(event.externalProvider, event.sourceId)
      return
    }
    const isDelete = kind === "delete"
    const isComplete = kind === "complete"
    setPendingAction({
      title: isDelete ? "Delete this meeting?" : isComplete ? "Mark meeting as completed?" : "Cancel this meeting?",
      description: isDelete
        ? "This removes the meeting from the project calendar. Cannot be undone."
        : isComplete
          ? "Completed meetings stay visible for history and reporting."
          : "Participants will see this meeting as cancelled.",
      confirmLabel: isDelete ? "Delete meeting" : isComplete ? "Mark completed" : "Cancel meeting",
      confirmVariant: isDelete || kind === "cancel" ? "destructive" : "default",
      details: [
        { label: "Meeting", value: event.title },
        { label: "Time", value: `${format(new Date(event.startAt), "PPP p")} – ${format(new Date(event.endAt), "p")}` },
      ],
      action: async () => {
        if (kind === "delete") await meetingsApi.delete(event.sourceId)
        if (kind === "complete") await meetingsApi.complete(event.sourceId)
        if (kind === "cancel") await meetingsApi.cancel(event.sourceId)
        toast.success(kind === "delete" ? "Meeting deleted" : kind === "complete" ? "Meeting marked completed" : "Meeting cancelled")
        setSelectedEvent(null)
        await loadPage(true)
      },
    })
  }

  async function runPendingAction() {
    if (!pendingAction) return
    try {
      setRunningAction(true)
      await pendingAction.action()
      setPendingAction(null)
    } catch (err: any) {
      toast.error(err?.message || "Action failed. Please try again.")
    } finally {
      setRunningAction(false)
    }
  }

  return (
    <TeamRequiredGuard
      pageName="Calendar"
      pageDescription="See meetings and task deadlines together, with Google and Outlook sync from one place."
      icon={<CalendarDays className="h-8 w-8 text-primary" />}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-5"
      >
        {/* ── PAGE HEADER ────────────────────────────────────────── */}
        <motion.div 
          variants={{
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 }
          }}
          className="group/header relative overflow-hidden rounded-[40px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl transition-all duration-700 hover:border-primary/20"
        >
          {/* Animated Background Elements */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-transparent to-indigo-500/[0.05]" />
          <motion.div
            className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl pointer-events-none transition-all duration-1000 group-hover/header:bg-primary/20 group-hover/header:scale-125"
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
              x: [0, 40, 0],
              y: [0, -20, 0]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none"
            animate={{ 
              scale: [1, 1.3, 1],
              x: [0, -30, 0],
              y: [0, 30, 0]
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <motion.div 
                className="flex items-center gap-5"
                initial={{ opacity: 0, x: -30 }} 
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-primary/20 text-primary shadow-2xl ring-1 ring-primary/30 transition-all duration-700 group-hover/header:scale-110 group-hover/header:rotate-6 group-hover/header:shadow-primary/20">
                  <CalendarDays className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-4xl font-black tracking-tighter text-foreground/90 sm:text-5xl">
                    Calendar
                  </h1>
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary/60">
                    {format(new Date(), "EEEE, MMMM do")}
                  </p>
                </div>
              </motion.div>
              <motion.p 
                className="max-w-xl text-sm font-medium leading-relaxed text-muted-foreground/60"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 0.2, duration: 0.8 }}
              >
                Experience a unified schedule where meetings and deadlines converge. 
                Navigate your project's timeline with precision and clarity.
              </motion.p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-4">
              <Button 
                variant="outline" 
                className="h-12 rounded-2xl border-white/10 bg-white/5 px-6 text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:bg-white/10 hover:text-primary hover:scale-[1.05] active:scale-[0.95] shadow-sm hover:shadow-md"
                onClick={() => void loadPage(true)} 
                disabled={refreshing}
              >
                <RefreshCcw className={cn("mr-3 h-4 w-4", refreshing && "animate-spin")} />
                Refresh
              </Button>
              <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 overflow-hidden shadow-sm transition-all hover:shadow-xl hover:border-primary/20">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-12 rounded-none px-4 hover:bg-primary/10 hover:text-primary transition-colors" 
                  onClick={() => moveCursor(-1)} 
                  aria-label={`Previous ${viewLabels[view]}`}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Separator orientation="vertical" className="h-8 bg-white/10" />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-12 rounded-none px-6 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-primary/10 hover:text-primary transition-colors" 
                  onClick={goToday}
                >
                  Today
                </Button>
                <Separator orientation="vertical" className="h-8 bg-white/10" />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-12 rounded-none px-4 hover:bg-primary/10 hover:text-primary transition-colors" 
                  onClick={goToday}
                  aria-label={`Next ${viewLabels[view]}`}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <QuickStat label="Today" value={todayEvents.length} icon={CalendarClock} />
            <QuickStat label="Meetings" value={meetingEvents.length} icon={Users} />
            <QuickStat label="Deadlines" value={taskEvents.length} icon={AlertCircle} />
            <QuickStat label="Attention" value={actionNeededEvents.length} tone="warning" icon={CalendarDays} />
          </div>
        </motion.div>

        {/* ── WORKSPACE CARD ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col gap-6 rounded-[32px] border border-border/40 bg-background/50 p-2 sm:p-4 backdrop-blur-md shadow-2xl"
        >
          {/* ── FILTER BAR ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 p-2 sm:p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 w-full rounded-2xl border-white/5 bg-white/5 pl-11 text-sm font-bold transition-all focus:bg-white/10 focus:ring-primary/20 placeholder:text-muted-foreground/40"
              placeholder="Search events, teams, or locations..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:flex sm:items-center">
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
              <SelectTrigger className="h-12 w-full rounded-2xl border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-[0.15em] sm:w-[160px] focus:ring-primary/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-white/10 bg-background/95 backdrop-blur-xl">
                <SelectItem value="ALL" className="text-xs font-bold uppercase tracking-wider">All sources</SelectItem>
                <SelectItem value="MEETING" className="text-xs font-bold uppercase tracking-wider">Meetings</SelectItem>
                <SelectItem value="TASK_DEADLINE" className="text-xs font-bold uppercase tracking-wider">Deadlines</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-12 w-full rounded-2xl border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-[0.15em] sm:w-[160px] focus:ring-primary/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-white/10 bg-background/95 backdrop-blur-xl">
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs font-bold uppercase tracking-wider">
                    {s === "ALL" ? "All statuses" : formatLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Team filter — visible only to doctors / TAs when they supervise >1 team */}
          {isSupervisor && teamOptions.length > 0 && (
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-12 w-full rounded-2xl border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-[0.15em] sm:w-[200px] focus:ring-primary/20">
                <Users className="mr-2 h-4 w-4 shrink-0 text-muted-foreground/50" />
                <SelectValue placeholder="All teams" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-white/10 bg-background/95 backdrop-blur-xl">
                <SelectItem value="ALL" className="text-xs font-bold uppercase tracking-wider">All teams</SelectItem>
                {teamOptions.map(({ id, name }) => (
                  <SelectItem key={id} value={id} className="text-xs font-bold uppercase tracking-wider">{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center justify-between gap-4 sm:ml-auto">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-10 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-all rounded-xl"
              onClick={() => { setSearch(""); setSourceFilter("ALL"); setStatusFilter("ALL"); setTeamFilter("ALL") }}
            >
              Reset
            </Button>
            <div className="h-6 w-px bg-white/10" />
            <span className="text-[10px] font-black uppercase tracking-wider text-primary/70 whitespace-nowrap bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">
              {filteredEvents.length} Results
            </span>
          </div>
        </div>
        {/* END FILTER BAR */}
        {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
        {error ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div>
              <h2 className="font-semibold text-foreground/80">Calendar could not be loaded</h2>
              <p className="mt-1 text-sm text-muted-foreground/60">{error}</p>
            </div>
            <Button size="sm" onClick={() => void loadPage(false)} className="rounded-xl">
              <RefreshCcw className="h-4 w-4 mr-2" />Retry
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
            {/* ── LEFT: Views ─────────────────────────────────────── */}
            <div className="space-y-0 min-w-0">
              <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)} className="w-full">
                {/* View header + tab switcher */}
                <div className="flex flex-col gap-4 px-2 sm:px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <h2 className="text-lg font-bold tracking-tight text-foreground/80">
                      {view === "month" || view === "agenda"
                        ? format(month, "MMMM yyyy")
                        : format(selectedDay, "MMMM d, yyyy")}
                    </h2>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/30">
                      {format(visibleRange.start, "MMM d")} – {format(visibleRange.end, "MMM d, yyyy")}
                    </p>
                  </div>
                  <TabsList className="h-11 p-1 bg-muted/10 rounded-xl flex sm:w-fit overflow-x-auto custom-scrollbar">
                    {Object.entries(viewLabels).map(([key, label]) => (
                      <TabsTrigger 
                        key={key} 
                        value={key} 
                        className="h-9 px-3 sm:px-6 rounded-lg text-xs font-bold uppercase tracking-wider shrink-0 transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
                      >
                        {label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <div className="overflow-hidden">
                  <TabsContent value="month" className="mt-0 outline-none focus-visible:ring-0">
                    <CalendarGrid
                      month={month}
                      selectedDay={selectedDay}
                      days={calendarDays}
                      eventsByDay={eventsByDay}
                      loading={loading}
                      onSelectDay={selectDay}
                      onOpenEvent={setSelectedEvent}
                    />
                  </TabsContent>

                  <TabsContent value="week" className="mt-0 outline-none focus-visible:ring-0">
                    <div className="p-4 sm:p-6">
                      {loading ? <CalendarSkeleton /> : (
                        <WeekView
                          days={weekDays}
                          eventsByDay={eventsByDay}
                          selectedDay={selectedDay}
                          onSelectDay={selectDay}
                          onOpenEvent={setSelectedEvent}
                        />
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="day" className="mt-0 outline-none focus-visible:ring-0">
                    <div className="p-6">
                      <div className="mb-6 flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-bold tracking-tight text-foreground/80">{format(selectedDay, "EEEE, MMMM d")}</h3>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/30">{selectedEvents.length} Items Scheduled</p>
                        </div>
                        <div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center text-primary/60">
                          <CalendarClock className="h-4.5 w-4.5" />
                        </div>
                      </div>
                      {loading ? <EventListSkeleton /> : (
                        <EventList
                          events={selectedEvents}
                          emptyTitle="No events on this day"
                          emptyDescription="Use the Meetings page to create a meeting or choose another date."
                          onOpenEvent={setSelectedEvent}
                        />
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="agenda" className="mt-0 outline-none focus-visible:ring-0">
                    <div className="p-6">
                      <div className="mb-6 flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-bold tracking-tight text-foreground/80">Agenda View</h3>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/30">Chronological schedule list</p>
                        </div>
                        <div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center text-primary/60">
                          <Search className="h-4.5 w-4.5" />
                        </div>
                      </div>
                      {loading ? <EventListSkeleton /> : <AgendaList events={agendaEvents} onOpenEvent={setSelectedEvent} />}
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>

            {/* ── RIGHT: Sidebar ──────────────────────────────────── */}
            <div className="space-y-4">
              {/* Provider connections */}
              <div className="rounded-3xl bg-white/5 overflow-hidden transition-all duration-500 hover:bg-white/10">
                <div className="border-b border-border/40 px-5 py-4">
                  <h3 className="text-xs font-bold tracking-tight text-foreground/70">Calendar Sync</h3>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/30">{connectedCount}/2 Active</p>
                </div>
                <div className="divide-y divide-border/10">
                  <ProviderCard provider="GOOGLE" integration={googleIntegration} running={runningAction} onAction={requestProviderAction} />
                  <ProviderCard provider="OUTLOOK" integration={outlookIntegration} running={runningAction} onAction={requestProviderAction} />
                </div>
              </div>

              {/* Action center */}
              <div className="rounded-3xl bg-white/5 overflow-hidden transition-all duration-500 hover:bg-white/10">
                <div className="border-b border-border/40 px-5 py-4">
                  <h3 className="text-xs font-bold tracking-tight text-foreground/70">Action Center</h3>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/30">Alerts & Status</p>
                </div>
                <div className="p-3">
                  {loading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-14 rounded-xl" />
                      <Skeleton className="h-14 rounded-xl" />
                    </div>
                  ) : actionNeededEvents.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/5 flex items-center justify-center text-emerald-500/40">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-bold text-foreground/60">Schedule Clear</p>
                        <p className="text-[9px] font-medium text-muted-foreground/30 px-4">No pending approvals or sync errors.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {actionNeededEvents.slice(0, 5).map((event) => (
                        <CompactEventCard
                          key={`${event.sourceType}-${event.sourceId}`}
                          event={event}
                          onOpenEvent={setSelectedEvent}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        </motion.div>
      </motion.div>

      {/* ── EVENT DETAIL SHEET ─────────────────────────────────────── */}
      <Sheet open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selectedEvent && (
            <EventDetails
              event={selectedEvent}
              onCopyLink={copyEventLink}
              onMeetingAction={requestMeetingAction}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ── CONFIRM ACTION DIALOG ─────────────────────────────────── */}
      <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && !runningAction && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {pendingAction?.details && (
            <div className="space-y-2 rounded-xl border bg-muted/30 p-3 text-sm">
              {pendingAction.details.map((d) => (
                <div key={d.label} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="text-right font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={runningAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void runPendingAction() }}
              disabled={runningAction}
              className={pendingAction?.confirmVariant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            >
              {runningAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pendingAction?.confirmLabel || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TeamRequiredGuard>
  )
}

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────

function QuickStat({ 
  label, 
  value, 
  tone = "default", 
  icon: Icon 
}: { 
  label: string; 
  value: number; 
  tone?: "default" | "warning";
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="group flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-3 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-primary/20 hover:bg-white/10"
    >
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-500 shadow-inner",
        tone === "warning" && value > 0 
          ? "bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20" 
          : "bg-primary/10 text-primary group-hover:bg-primary/20 group-hover:rotate-3 ring-1 ring-primary/20"
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-col items-start min-w-0">
        <motion.span 
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "text-xl font-bold leading-none tabular-nums tracking-tight transition-colors duration-300",
            tone === "warning" && value > 0 ? "text-amber-500" : "text-foreground/90"
          )}
        >
          {value}
        </motion.span>
        <span className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 transition-colors duration-300 group-hover:text-muted-foreground/80">
          {label}
        </span>
      </div>
    </motion.div>
  )
}

function CalendarGrid({
  month,
  selectedDay,
  days,
  eventsByDay,
  loading,
  onSelectDay,
  onOpenEvent,
}: {
  month: Date
  selectedDay: Date
  days: Date[]
  eventsByDay: Record<string, ApiCalendarEvent[]>
  loading: boolean
  onSelectDay: (day: Date) => void
  onOpenEvent: (event: ApiCalendarEvent) => void
}) {
  const prefersReducedMotion = useReducedMotion()
  
  if (loading) {
    return <div className="p-4"><CalendarSkeleton /></div>
  }

  // Use month string as key for animations so they only run when changing months
  const monthKey = format(month, "yyyy-MM")

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.005
      }
    }
  }

  const item: Variants = {
    hidden: { opacity: 0, scale: 0.98, y: 5 },
    show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } }
  }

  return (
    <div className="overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-white/5 bg-muted/10 text-center">
        {[["S","Sat"],["S","Sun"],["M","Mon"],["T","Tue"],["W","Wed"],["T","Thu"],["F","Fri"]].map(([short, full], i) => (
          <div key={i} className="py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{full}</span>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <motion.div 
        key={monthKey}
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-7 border-white/5"
      >
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd")
          const dayEvents = sortEvents(eventsByDay[key] || [])
          const isSelected = isSameDay(day, selectedDay)
          const today = isToday(day)
          const inMonth = isSameMonth(day, month)

          return (
            <motion.div
              key={key}
              variants={item}
              onClick={() => onSelectDay(day)}
              className={cn(
                "group relative cursor-pointer border-b border-r border-white/5 p-1.5 transition-all duration-300",
                "min-h-[90px] sm:min-h-[120px] lg:min-h-[140px]",
                !inMonth && "bg-muted/[0.01] opacity-30",
                today && !isSelected && "bg-primary/[0.02]",
                isSelected ? "bg-primary/[0.04] z-10" : "hover:bg-primary/[0.01] hover:z-10",
              )}
            >
              {/* Date row */}
              <div className="mb-2 flex items-start justify-between">
                <div className="relative">
                  <span className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-xl text-xs font-black transition-all duration-300",
                    today && "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105",
                    !today && isSelected && "bg-primary/10 text-primary ring-1 ring-primary/20",
                    !today && !isSelected && "text-foreground group-hover:text-foreground group-hover:scale-110",
                    !inMonth && "opacity-20",
                  )}>
                    {format(day, "d")}
                  </span>
                  {dayEvents.length > 0 && !today && (
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={cn(
                        "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-background shadow-sm transition-all duration-300 group-hover:scale-125",
                        dayEvents.some(e => e.status === "PENDING_APPROVAL") ? "bg-amber-500" : "bg-primary"
                      )} 
                    />
                  )}
                </div>
                {dayEvents.length > 0 && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "hidden h-4.5 items-center rounded-lg border-none px-1 text-[9px] font-black group-hover:scale-110 transition-all duration-300 sm:inline-flex",
                      isSelected ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground/70 group-hover:bg-primary/10 group-hover:text-primary"
                    )}
                  >
                    {dayEvents.length}
                  </Badge>
                )}
              </div>

              {/* Events */}
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <motion.button
                    key={`${event.sourceType}-${event.sourceId}`}
                    type="button"
                    whileHover={{ x: 1, backgroundColor: "rgba(var(--primary), 0.05)" }}
                    onClick={(e) => { e.stopPropagation(); onOpenEvent(event) }}
                    className={cn(
                      "hidden w-full rounded-md border-l-2 px-1.5 py-1 text-left transition-all sm:block",
                      event.sourceType === "MEETING"
                        ? "bg-primary/[0.04] border-l-primary text-primary"
                        : "bg-amber-500/[0.04] border-l-amber-500 text-amber-600"
                    )}
                  >
                    <div className="truncate text-[9px] font-black tracking-tight leading-tight">{event.title}</div>
                    {!event.allDay && (
                      <div className="mt-0.5 truncate text-[8px] font-bold text-muted-foreground/60">
                        {format(new Date(event.startAt), "p")}
                      </div>
                    )}
                  </motion.button>
                ))}

                {dayEvents.length > 3 && (
                  <p className="hidden pl-1 text-[8px] font-black uppercase tracking-wider text-muted-foreground/40 transition-colors group-hover:text-muted-foreground/60 sm:block">
                    +{dayEvents.length - 3} more
                  </p>
                )}
              </div>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}

function WeekView({
  days,
  eventsByDay,
  selectedDay,
  onSelectDay,
  onOpenEvent,
}: {
  days: Date[]
  eventsByDay: Record<string, ApiCalendarEvent[]>
  selectedDay: Date
  onSelectDay: (day: Date) => void
  onOpenEvent: (event: ApiCalendarEvent) => void
}) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <div className="min-w-[700px] px-4 sm:px-0">
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd")
            const dayEvents = sortEvents(eventsByDay[key] || [])
            const isSelected = isSameDay(day, selectedDay)
            const today = isToday(day)

            return (
              <motion.div
                key={day.toISOString()}
                whileHover={{ y: -2 }}
                className={cn(
                  "flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 backdrop-blur-md",
                  isSelected 
                    ? "border-primary/40 bg-primary/[0.03] ring-1 ring-primary/10 shadow-lg" 
                    : "border-white/5 bg-white/[0.02] shadow-sm hover:border-primary/10 hover:bg-white/[0.04]",
                )}
              >
                {/* Day header */}
                <button
                  type="button"
                  onClick={() => onSelectDay(day)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-2 py-3 text-center transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-md"
                      : today
                        ? "bg-primary/10 text-primary"
                        : "bg-white/5 hover:bg-white/10"
                  )}
                >
                  <span className={cn(
                    "text-[9px] font-semibold uppercase tracking-wider",
                    isSelected ? "text-primary-foreground/70" : "text-muted-foreground/40"
                  )}>
                    {format(day, "EEE")}
                  </span>
                  <span className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg text-base font-black transition-transform duration-300",
                    today && !isSelected && "bg-primary text-primary-foreground scale-105",
                    isSelected && "text-primary-foreground",
                    !today && !isSelected && "text-foreground group-hover:text-primary transition-colors"
                  )}>
                    {format(day, "d")}
                  </span>
                </button>

                {/* Events area */}
                <div className="flex-1 space-y-1.5 p-2 min-h-[100px]">
                  {dayEvents.length === 0 ? (
                    <div className="flex h-full min-h-[80px] items-center justify-center rounded-xl border border-dashed border-white/5 bg-white/[0.01]">
                      <span className="text-[10px] text-muted-foreground/20">—</span>
                    </div>
                  ) : (
                    dayEvents.map((event) => (
                      <motion.button
                        key={`${event.sourceType}-${event.sourceId}`}
                        type="button"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => onOpenEvent(event)}
                        className={cn(
                          "w-full rounded-lg border-l-2 px-1.5 py-1.5 text-left text-[9px] font-medium leading-snug transition-all",
                          event.sourceType === "MEETING"
                            ? "bg-primary/5 border-l-primary text-primary/90"
                            : "bg-amber-500/5 border-l-amber-500 text-amber-700/90"
                        )}
                      >
                        <div className="truncate font-semibold">{event.title}</div>
                        {!event.allDay && (
                          <div className="mt-0.5 truncate text-[8px] text-muted-foreground/50">
                            {format(new Date(event.startAt), "p")}
                          </div>
                        )}
                      </motion.button>
                    ))
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AgendaList({ events, onOpenEvent }: { events: ApiCalendarEvent[]; onOpenEvent: (event: ApiCalendarEvent) => void }) {
  if (events.length === 0) {
    return <EmptyState title="No calendar items found" description="Try clearing filters or moving to another month." />
  }

  const groups = events.reduce<Record<string, ApiCalendarEvent[]>>((acc, event) => {
    const key = format(new Date(event.startAt), "yyyy-MM-dd")
    acc[key] = acc[key] || []
    acc[key].push(event)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([key, group]) => (
        <section key={key} className="space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <h3 className="text-xs font-semibold text-muted-foreground">
              {format(new Date(`${key}T00:00:00`), "EEEE, MMMM d")}
            </h3>
            <div className="h-px flex-1 bg-border" />
          </div>
          <EventList events={group} emptyTitle="No events" emptyDescription="" onOpenEvent={onOpenEvent} />
        </section>
      ))}
    </div>
  )
}

function EventList({
  events,
  emptyTitle,
  emptyDescription,
  onOpenEvent,
}: {
  events: ApiCalendarEvent[]
  emptyTitle: string
  emptyDescription: string
  onOpenEvent: (event: ApiCalendarEvent) => void
}) {
  const prefersReducedMotion = useReducedMotion()
  if (events.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />

  return (
    <div className="space-y-2.5">
      {sortEvents(events).map((event, index) => (
        <motion.div
          key={`${event.sourceType}-${event.sourceId}`}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: prefersReducedMotion ? 0 : Math.min(index * 0.03, 0.18), duration: 0.22 }}
        >
          <EventCard event={event} onOpenEvent={onOpenEvent} />
        </motion.div>
      ))}
    </div>
  )
}

function EventCard({ event, onOpenEvent }: { event: ApiCalendarEvent; onOpenEvent: (event: ApiCalendarEvent) => void }) {
  const borderCls = sourceBorderColor[event.sourceType] ?? "border-l-border"

  return (
    <motion.button
      type="button"
      onClick={() => onOpenEvent(event)}
      whileHover={{ y: -2, scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      className={cn(
        "group w-full rounded-2xl bg-background/40 p-4 text-left transition-all hover:bg-background hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
        borderCls,
        "border-l-4"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: core info */}
        <div className="min-w-0 flex-1 space-y-3">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border-none shadow-sm", sourceBadgeClass[event.sourceType])}>
              {sourceLabel[event.sourceType]}
            </Badge>
            <Badge variant="outline" className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border-none shadow-sm", statusClass[event.status] || "border-muted-foreground/20 text-muted-foreground/60 bg-muted/10")}>
              {formatLabel(event.status)}
            </Badge>
          </div>
          {/* Title + time */}
          <div>
            <h3 className="truncate text-base font-black tracking-tight text-foreground/90 transition-colors group-hover:text-primary">
              {event.title}
            </h3>
            <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">
              <Clock3 className="h-3 w-3" />
              {formatEventTime(event)}
            </div>
          </div>
          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase tracking-wide text-muted-foreground/50">
            <span className="inline-flex items-center gap-1.5 bg-muted/5 px-2 py-1 rounded-lg">
              <Users className="h-3 w-3 shrink-0" />
              {event.team?.name || "No team"}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-muted/5 px-2 py-1 rounded-lg">
              {event.mode === "VIRTUAL" ? <Video className="h-3 w-3 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />}
              <span className="truncate max-w-[120px]">{event.location || formatLabel(event.mode || event.sourceType)}</span>
            </span>
          </div>
        </div>

        {/* Right: owner — visible on sm+ */}
        <div className="hidden shrink-0 flex-col items-end justify-between self-stretch sm:flex">
          <div className="flex flex-col items-end gap-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/20">Owner</p>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-foreground/60">
                {event.organizer?.fullName || event.assignee?.fullName || "—"}
              </p>
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/10">
                {(event.organizer?.fullName || event.assignee?.fullName || "?").charAt(0)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-primary/5 px-3 py-1.5 border border-primary/10 transition-all group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-md">
            <span className="text-[9px] font-bold uppercase tracking-wider">Details</span>
            <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </motion.button>
  )
}

function CompactEventCard({ event, onOpenEvent }: { event: ApiCalendarEvent; onOpenEvent: (event: ApiCalendarEvent) => void }) {
  const borderCls = sourceBorderColor[event.sourceType] ?? "border-l-border"

  return (
    <motion.button
      type="button"
      onClick={() => onOpenEvent(event)}
      whileHover={{ x: 2, backgroundColor: "rgba(var(--primary), 0.03)" }}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl bg-background/20 p-2.5 text-left transition-all hover:bg-background/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
        borderCls,
        "border-l-4"
      )}
    >
      <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-xl bg-muted/20 text-muted-foreground/50 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        <span className="text-[8px] font-bold uppercase tracking-tighter opacity-50">
          {format(new Date(event.startAt), "MMM")}
        </span>
        <span className="text-sm font-bold leading-none">
          {format(new Date(event.startAt), "d")}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold tracking-tight text-foreground/70 group-hover:text-primary transition-colors">
          {event.title}
        </p>
        <p className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-wider text-muted-foreground/30">
          {format(new Date(event.startAt), "p")}
        </p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/10 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
    </motion.button>
  )
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.26 1.07-3.71 1.07-2.87 0-5.3-1.94-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.09H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.91l3.66-2.8z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.09l3.66 2.84c.86-2.59 3.3-4.55 6.16-4.55z" />
  </svg>
)

const OutlookIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4">
    <path fill="#0078D4" d="M1 5.5V18.5L6.5 21V3L1 5.5Z" />
    <path fill="#28A8EA" d="M23 5.5V18.5L13.5 21V3L23 5.5Z" />
    <path fill="#50D9FF" d="M13.5 3L6.5 5.5V18.5L13.5 21V3Z" />
    <path fill="#005A9E" d="M1 5.5L6.5 8V16L1 18.5V5.5Z" />
  </svg>
)

function ProviderCard({
  provider,
  integration,
  running,
  onAction,
}: {
  provider: ApiCalendarProvider
  integration?: ApiCalendarIntegration
  running: boolean
  onAction: (provider: ApiCalendarProvider, action: ProviderAction) => void
}) {
  const connected = Boolean(integration?.syncEnabled)
  const isGoogle = provider === "GOOGLE"

  return (
    <div className="group/provider relative overflow-hidden p-4 transition-all hover:bg-white/[0.02]">
      <div className="flex items-center gap-3">
        {/* Provider icon accent */}
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm transition-all duration-300 group-hover/provider:scale-110",
          isGoogle ? "bg-white/5 border border-white/10" : "bg-white/5 border border-white/10"
        )}>
          {isGoogle ? <GoogleIcon /> : <OutlookIcon />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-[13px] text-foreground/70">{providerLabel(provider)}</p>
            <Badge 
              variant={connected ? "default" : "outline"} 
              className={cn(
                "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0 rounded-full border-none",
                connected ? "bg-emerald-500/20 text-emerald-500" : "bg-muted/30 text-muted-foreground/40"
              )}
            >
              {connected ? "Active" : "Off"}
            </Badge>
          </div>
          <p className="text-[10px] font-medium text-muted-foreground/30 truncate">{integration?.email || "Not connected"}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/20">Last sync</span>
          <span className="text-[10px] font-medium text-muted-foreground/50">
            {integration?.lastSyncedAt ? format(new Date(integration.lastSyncedAt), "MMM d, p") : "—"}
          </span>
        </div>
        
        <div className="flex gap-2">
          {!connected ? (
            <Button 
              size="sm" 
              className="h-8 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[9px] font-bold uppercase tracking-wider px-3 transition-all active:scale-95" 
              onClick={() => onAction(provider, "connect")} 
              disabled={running}
            >
              Connect
            </Button>
          ) : (
            <>
              <Button 
                size="sm" 
                variant="ghost"
                className="h-8 w-8 p-0 rounded-lg text-muted-foreground/30 hover:text-primary hover:bg-primary/5" 
                onClick={() => onAction(provider, "sync")} 
                disabled={running}
                title="Sync now"
              >
                <RefreshCcw className={cn("h-3.5 w-3.5", running && "animate-spin")} />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 w-8 p-0 rounded-lg text-muted-foreground/20 hover:text-destructive hover:bg-destructive/5" 
                onClick={() => onAction(provider, "disconnect")} 
                disabled={running}
                title="Disconnect"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {integration?.lastSyncError && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 rounded-lg border border-amber-500/10 bg-amber-500/5 px-3 py-2 text-[9px] font-medium text-amber-600/60"
        >
          {integration.lastSyncError}
        </motion.div>
      )}
    </div>
  )
}

function EventDetails({
  event,
  onCopyLink,
  onMeetingAction,
}: {
  event: ApiCalendarEvent
  onCopyLink: (event: ApiCalendarEvent) => Promise<void>
  onMeetingAction: (event: ApiCalendarEvent, kind: "cancel" | "complete" | "delete" | "sync") => void
}) {
  const isMeeting = event.sourceType === "MEETING"
  const canManage = Boolean(isMeeting && event.permissions?.canManage)
  const canCancel = canManage && !["CANCELLED", "COMPLETED"].includes(event.status)
  const canComplete = canManage && event.status === "CONFIRMED"
  const canSync = canManage && event.status === "CONFIRMED" && Boolean(event.externalProvider)
  const borderCls = sourceBorderColor[event.sourceType] ?? "border-l-border"

  return (
    <div className="space-y-10 pb-12">
      {/* ── HEADER ────────────────────────────────────────────── */}
      <SheetHeader className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className={cn("h-6 rounded-full border-none px-3 text-[10px] font-bold uppercase tracking-wider shadow-sm", sourceBadgeClass[event.sourceType])}>
            {sourceLabel[event.sourceType]}
          </Badge>
          <div className="h-1.5 w-1.5 rounded-full bg-primary/20" />
          <Badge variant="outline" className={cn("h-6 rounded-full border-none px-3 text-[10px] font-bold uppercase tracking-wider shadow-sm", statusClass[event.status] || "bg-muted/40 text-muted-foreground/60")}>
            {formatLabel(event.status)}
          </Badge>
        </div>
        
        <div className={cn("border-l-4 pl-5 transition-all duration-500", borderCls)}>
          <SheetTitle className="text-xl font-black tracking-tight text-foreground/90">
            {event.title}
          </SheetTitle>
          <div className="mt-2 flex items-center gap-2.5 text-[13px] font-bold text-muted-foreground/60">
            <Calendar className="h-3.5 w-3.5" />
            {format(new Date(event.startAt), "EEEE, MMMM d, yyyy")}
          </div>
        </div>
      </SheetHeader>

      <div className="space-y-10">
        {/* ── CORE INFO GRID ──────────────────────────────────── */}
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <DetailCard icon={CalendarClock} label="Schedule" value={`${format(new Date(event.startAt), "p")} – ${format(new Date(event.endAt), "p")}`} />
          <DetailCard icon={MapPin} label="Location" value={event.location || formatLabel(event.mode || "Physical")} />
          <DetailCard icon={Users} label="Team" value={event.team?.name || "Independent"} />
          <DetailCard icon={CheckCircle2} label="Lead" value={event.organizer?.fullName || event.assignee?.fullName || "Unassigned"} />
        </div>

        {/* ── DESCRIPTION ─────────────────────────────────────── */}
        {event.description && (
          <div className="space-y-3">
            <SectionHeader label="Overview" />
            <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 backdrop-blur-sm">
              <p className="text-[14px] font-medium leading-relaxed text-foreground/70">
                {event.description}
              </p>
            </div>
          </div>
        )}

        {/* ── PARTICIPANTS ────────────────────────────────────── */}
        {isMeeting && event.participants && event.participants.length > 0 && (
          <div className="space-y-3">
            <SectionHeader label="Stakeholders" />
            <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">Invited stakeholders</span>
                <span className="text-[9px] font-black text-primary/60">{event.participants.length} TOTAL</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {event.participants.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-full bg-muted/20 px-3 py-1 border border-white/5 transition-colors hover:bg-muted/30">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-[8px] font-bold text-primary">
                      {(p.displayName || p.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[11px] font-semibold text-foreground/70">{p.displayName || p.email}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── APPROVALS ───────────────────────────────────────── */}
        {event.approvals && event.approvals.length > 0 && (
          <div className="space-y-3">
            <SectionHeader label="Approval Pipeline" />
            <div className="space-y-2.5">
              {event.approvals.map((approval) => (
                <div key={approval.id} className="group relative rounded-2xl border border-white/5 bg-white/[0.01] p-4 transition-all hover:bg-white/[0.02]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-xl shadow-inner",
                        approval.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted/30 text-muted-foreground/50"
                      )}>
                        {approval.status === "APPROVED" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[13px] font-black text-foreground/80 tracking-tight">{approval.approverName || formatLabel(approval.approverRole)}</p>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">{formatLabel(approval.approverRole)}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("rounded-lg border-none px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-sm", statusClass[approval.status] || "bg-muted/20 text-muted-foreground/60")}>
                      {formatLabel(approval.status)}
                    </Badge>
                  </div>
                  {approval.note && (
                    <div className="mt-3 rounded-xl bg-white/[0.02] p-3 text-[11px] font-semibold leading-relaxed text-foreground/60 border border-white/5 italic">
                      "{approval.note}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INTEGRATION ─────────────────────────────────────── */}
        <div className="space-y-4">
          <SectionHeader label="Connectivity" />
          <div className="rounded-[24px] border border-white/5 bg-white/[0.02] p-6 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Source Platform</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 border border-white/5 shadow-sm">
                    {event.externalProvider === "GOOGLE" ? <GoogleIcon /> : event.externalProvider === "OUTLOOK" ? <OutlookIcon /> : <div className="h-4 w-4 rounded-full bg-primary/20" />}
                  </div>
                  <span className="text-sm font-black text-foreground/80">{event.externalProvider ? formatLabel(event.externalProvider) : "Native Dashboard"}</span>
                </div>
              </div>
              <div className="text-right space-y-2">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Sync Status</p>
                <div className="flex items-center justify-end gap-3">
                  <span className="text-sm font-black text-foreground/80">{formatLabel(event.externalSyncStatus || "NOT_CONNECTED")}</span>
                  <div className={cn("h-2.5 w-2.5 rounded-full shadow-lg", event.externalSyncStatus === "SYNCED" ? "bg-emerald-500 shadow-emerald-500/20" : "bg-muted/40")} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ACTIONS ─────────────────────────────────────────── */}
      <SheetFooter className="mt-12 flex flex-col gap-4 sm:flex-col sm:space-x-0">
        {event.joinUrl && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Button asChild className="h-14 rounded-2xl bg-primary text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
              <a href={event.joinUrl} target="_blank" rel="noreferrer">
                <Link2 className="mr-3 h-5 w-5" />Join Session
              </a>
            </Button>
            <Button variant="outline" className="h-14 rounded-2xl border-white/10 bg-white/5 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all" onClick={() => void onCopyLink(event)}>
              <ClipboardCopy className="mr-3 h-5 w-5" />Copy Link
            </Button>
          </div>
        )}
        
        {canManage && (
          <div className="grid gap-3 sm:grid-cols-2">
            {canSync && (
              <Button variant="outline" className="h-12 rounded-2xl border-white/5 bg-white/[0.02] text-[10px] font-black uppercase tracking-wider hover:bg-white/[0.05]" onClick={() => onMeetingAction(event, "sync")}>
                <RefreshCcw className="mr-2 h-4 w-4" />Refresh Sync
              </Button>
            )}
            {canComplete && (
              <Button variant="outline" className="h-12 rounded-2xl border-white/5 bg-white/[0.02] text-[10px] font-black uppercase tracking-wider hover:bg-emerald-500/10 hover:text-emerald-500" onClick={() => onMeetingAction(event, "complete")}>
                <CheckCircle2 className="mr-2 h-4 w-4" />Mark Done
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" className="h-12 rounded-2xl border-white/5 bg-white/[0.02] text-[10px] font-black uppercase tracking-wider hover:bg-amber-500/10 hover:text-amber-500" onClick={() => onMeetingAction(event, "cancel")}>
                <AlertCircle className="mr-2 h-4 w-4" />Cancel Event
              </Button>
            )}
            <Button variant="destructive" className="h-12 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-destructive/10" onClick={() => onMeetingAction(event, "delete")}>
              <Trash2 className="mr-2 h-4 w-4" />Delete Event
            </Button>
          </div>
        )}
      </SheetFooter>
    </div>
  )
}

function DetailCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="group rounded-[24px] border border-white/5 bg-white/[0.02] p-6 transition-all hover:border-primary/10 hover:bg-white/[0.04] hover:shadow-lg">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner transition-transform group-hover:scale-110 group-hover:rotate-3">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 transition-colors group-hover:text-primary/70">{label}</p>
      <p className="mt-1.5 truncate text-[15px] font-black text-foreground/90 tracking-tight">{value}</p>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-px flex-1 bg-white/10" />
      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">{label}</h4>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[32px] border border-dashed border-white/10 bg-white/[0.01] px-6 py-16 text-center backdrop-blur-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/10 text-muted-foreground/20">
        <CalendarDays className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight text-foreground/60">{title}</h3>
        {description && <p className="max-w-xs text-sm font-medium text-muted-foreground/30">{description}</p>}
      </div>
    </div>
  )
}

function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl bg-white/5" />)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl bg-white/5" />)}
      </div>
    </div>
  )
}

function EventListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-3xl bg-white/5" />)}
    </div>
  )
}
