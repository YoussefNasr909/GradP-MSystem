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
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
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
import { motion, useReducedMotion } from "framer-motion"
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
  const { accessToken } = useAuthStore()
  const prefersReducedMotion = useReducedMotion()
  const [view, setView] = useState<CalendarView>("month")
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
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

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase()
    return events.filter((event) => {
      if (sourceFilter !== "ALL" && event.sourceType !== sourceFilter) return false
      if (statusFilter !== "ALL" && event.status !== statusFilter) return false
      if (!query) return true
      return [event.title, event.description, event.team?.name, event.organizer?.fullName, event.assignee?.fullName, event.location, event.provider, event.externalProvider]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(query))
    })
  }, [events, search, sourceFilter, statusFilter])

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

  function selectDay(day: Date, nextView?: CalendarView) {
    setSelectedDay(day)
    setMonth(day)
    if (nextView) setView(nextView)
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
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <CalendarDays className="h-3 w-3" />
                Calendar
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">One schedule for everything.</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Navigate meetings and deadlines by day, week, month, or agenda. Open any item for details and actions.
              </p>
            </div>

            {/* Nav group */}
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void loadPage(true)} disabled={refreshing}>
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Refresh
              </Button>
              <div className="flex items-center rounded-lg border bg-background divide-x">
                <Button variant="ghost" size="sm" className="h-8 rounded-none rounded-l-md px-2.5" onClick={() => moveCursor(-1)} aria-label={`Previous ${viewLabels[view]}`}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 rounded-none px-3 text-xs font-medium" onClick={goToday}>
                  Today
                </Button>
                <Button variant="ghost" size="sm" className="h-8 rounded-none rounded-r-md px-2.5" onClick={() => moveCursor(1)} aria-label={`Next ${viewLabels[view]}`}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
            <QuickStat label="Today" value={todayEvents.length} />
            <QuickStat label="Meetings" value={meetingEvents.length} />
            <QuickStat label="Deadlines" value={taskEvents.length} />
            <QuickStat label="Needs attention" value={actionNeededEvents.length} tone="warning" />
          </div>
        </div>

        {/* ── FILTER BAR ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-2 rounded-xl bg-muted/30 p-3 sm:flex sm:flex-wrap sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full bg-background pl-8 text-sm sm:min-w-[180px] sm:flex-1"
              placeholder="Search events..."
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
              <SelectTrigger className="h-9 w-full bg-background text-sm sm:w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All sources</SelectItem>
                <SelectItem value="MEETING">Meetings</SelectItem>
                <SelectItem value="TASK_DEADLINE">Deadlines</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full bg-background text-sm sm:w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s === "ALL" ? "All statuses" : formatLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-2 sm:contents">
            <Button variant="ghost" size="sm" className="h-9 w-full px-3 text-sm sm:w-auto"
              onClick={() => { setSearch(""); setSourceFilter("ALL"); setStatusFilter("ALL") }}>
              Clear filters
            </Button>
            <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap sm:ml-auto">
              {filteredEvents.length} item{filteredEvents.length !== 1 ? "s" : ""} · {connectedCount}/2
            </span>
          </div>
        </div>

        {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
        {error ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div>
              <h2 className="font-semibold">Calendar could not be loaded</h2>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
            <Button size="sm" onClick={() => void loadPage(false)}>
              <RefreshCcw className="h-4 w-4" />Retry
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
            {/* ── LEFT: Views ─────────────────────────────────────── */}
            <div className="space-y-0">
              <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
                {/* View header + tab switcher */}
                <div className="flex flex-col gap-3 rounded-t-xl border border-b-0 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {view === "month" || view === "agenda"
                        ? format(month, "MMMM yyyy")
                        : format(selectedDay, "MMMM d, yyyy")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {format(visibleRange.start, "MMM d")} – {format(visibleRange.end, "MMM d, yyyy")}
                    </p>
                  </div>
                  <TabsList className="h-8 w-full grid grid-cols-4 rounded-lg sm:w-fit">
                    <TabsTrigger value="month" className="h-7 rounded-md px-2 text-xs sm:px-3">Month</TabsTrigger>
                    <TabsTrigger value="week" className="h-7 rounded-md px-2 text-xs sm:px-3">Week</TabsTrigger>
                    <TabsTrigger value="day" className="h-7 rounded-md px-2 text-xs sm:px-3">Day</TabsTrigger>
                    <TabsTrigger value="agenda" className="h-7 rounded-md px-2 text-xs sm:px-3">Agenda</TabsTrigger>
                  </TabsList>
                </div>

                <div className="rounded-b-xl border border-t-0 bg-card overflow-hidden">
                  <TabsContent value="month" className="mt-0">
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

                  <TabsContent value="week" className="mt-0">
                    <div className="p-4">
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

                  <TabsContent value="day" className="mt-0">
                    <div className="p-4">
                      <div className="mb-3">
                        <h3 className="font-semibold">{format(selectedDay, "EEEE, MMMM d")}</h3>
                        <p className="text-xs text-muted-foreground">{selectedEvents.length} item{selectedEvents.length !== 1 ? "s" : ""} scheduled</p>
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

                  <TabsContent value="agenda" className="mt-0">
                    <div className="p-4">
                      <div className="mb-3">
                        <h3 className="font-semibold">Agenda</h3>
                        <p className="text-xs text-muted-foreground">Chronological list for this calendar range.</p>
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
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="border-b px-4 py-3">
                  <h3 className="font-semibold">Calendar providers</h3>
                  <p className="text-xs text-muted-foreground">{connectedCount}/2 connected</p>
                </div>
                <div className="divide-y">
                  <ProviderCard provider="GOOGLE" integration={googleIntegration} running={runningAction} onAction={requestProviderAction} />
                  <ProviderCard provider="OUTLOOK" integration={outlookIntegration} running={runningAction} onAction={requestProviderAction} />
                </div>
              </div>

              {/* Action center */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="border-b px-4 py-3">
                  <h3 className="font-semibold">Action center</h3>
                  <p className="text-xs text-muted-foreground">Approvals, conflicts, and sync problems</p>
                </div>
                <div className="p-3">
                  {loading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 rounded-lg" />
                      <Skeleton className="h-16 rounded-lg" />
                    </div>
                  ) : actionNeededEvents.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <CheckCircle2 className="h-7 w-7 text-emerald-500/60" />
                      <p className="text-sm font-medium">Everything looks clear</p>
                      <p className="text-xs text-muted-foreground">No pending approvals or sync errors.</p>
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

function QuickStat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warning" }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 sm:min-w-[120px]">
      <span className={cn(
        "text-xl font-bold leading-none tabular-nums",
        tone === "warning" && value > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
      )}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground leading-tight">{label}</span>
    </div>
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
  if (loading) {
    return <div className="p-4"><CalendarSkeleton /></div>
  }

  return (
    <div className="overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b bg-muted/30 text-center">
        {[["S","Sat"],["S","Sun"],["M","Mon"],["T","Tue"],["W","Wed"],["T","Thu"],["F","Fri"]].map(([short, full], i) => (
          <div key={i} className="py-2.5 text-xs font-semibold tracking-wide text-muted-foreground">
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{full}</span>
          </div>
        ))}
      </div>

      {/* Day cells — entire cell is clickable; event pills stop propagation */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd")
          const dayEvents = sortEvents(eventsByDay[key] || [])
          const isSelected = isSameDay(day, selectedDay)
          const today = isToday(day)
          const inMonth = isSameMonth(day, month)

          return (
            <div
              key={key}
              onClick={() => onSelectDay(day)}
              aria-label={`Select ${format(day, "PPP")}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}` : ""}`}
              className={cn(
                "group relative cursor-pointer border-b border-r p-1 sm:p-1.5 transition-colors",
                "min-h-[80px] sm:min-h-[110px] lg:min-h-[140px]",
                !inMonth && "bg-muted/5",
                today && !isSelected && "bg-primary/[0.04]",
                isSelected ? "bg-primary/10" : "hover:bg-muted/20",
              )}
            >
              {/* Date row */}
              <div className="mb-1 flex items-start justify-between gap-0.5">
                <span className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold leading-none transition-colors",
                  today && "bg-primary text-primary-foreground shadow-sm",
                  !today && isSelected && "ring-2 ring-primary text-primary",
                  !today && !isSelected && "group-hover:bg-muted/70 text-foreground",
                  !inMonth && "text-muted-foreground/40",
                )}>
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 && (
                  <Badge variant="outline" className="hidden h-4 shrink-0 px-1 text-[9px] leading-none sm:inline-flex">
                    {dayEvents.length}
                  </Badge>
                )}
              </div>

              {/* Events */}
              <div className="space-y-px">
                {/* Mobile: colored dots only */}
                {dayEvents.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 px-0.5 sm:hidden">
                    {dayEvents.slice(0, 6).map((event) => (
                      <span
                        key={`${event.sourceType}-${event.sourceId}`}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          event.sourceType === "MEETING" ? "bg-primary" : "bg-amber-500"
                        )}
                      />
                    ))}
                    {dayEvents.length > 6 && <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
                  </div>
                )}

                {/* sm+: clickable event pills — stop propagation so cell click isn't also triggered */}
                {dayEvents.slice(0, 3).map((event) => (
                  <button
                    key={`${event.sourceType}-${event.sourceId}`}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenEvent(event) }}
                    className={cn(
                      "hidden w-full rounded border-l-2 px-1 py-px text-left text-[10px] leading-snug transition-opacity hover:opacity-75 focus-visible:outline-none sm:block",
                      event.sourceType === "MEETING"
                        ? "bg-primary/10 border-l-primary"
                        : "bg-amber-50 border-l-amber-400 dark:bg-amber-950/20"
                    )}
                  >
                    <div className="truncate font-medium">{event.title}</div>
                    {!event.allDay && (
                      <div className="hidden truncate text-muted-foreground opacity-70 lg:block">
                        {format(new Date(event.startAt), "p")}
                      </div>
                    )}
                  </button>
                ))}

                {dayEvents.length > 3 && (
                  <p className="hidden pl-0.5 text-[10px] text-muted-foreground sm:block">
                    +{dayEvents.length - 3} more
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
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
      <div className="min-w-[640px] px-4 sm:px-0">
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd")
            const dayEvents = sortEvents(eventsByDay[key] || [])
            const isSelected = isSameDay(day, selectedDay)
            const today = isToday(day)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex flex-col overflow-hidden rounded-xl border transition-colors",
                  isSelected ? "border-primary/60 ring-1 ring-primary/30" : "border-border",
                )}
              >
                {/* Day header — click to drill into day view */}
                <button
                  type="button"
                  onClick={() => onSelectDay(day)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-2 py-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : today
                        ? "bg-primary/10 hover:bg-primary/15"
                        : "bg-muted/40 hover:bg-muted/60"
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    {format(day, "EEE")}
                  </span>
                  <span className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-base font-bold leading-none",
                    today && !isSelected && "bg-primary text-primary-foreground",
                    isSelected && "text-primary-foreground",
                    !today && !isSelected && "text-foreground"
                  )}>
                    {format(day, "d")}
                  </span>
                  {dayEvents.length > 0 && !isSelected && (
                    <span className="mt-0.5 h-1 w-1 rounded-full bg-primary/60" />
                  )}
                </button>

                {/* Events area */}
                <div className="flex-1 space-y-1 p-1.5 min-h-[100px]">
                  {dayEvents.length === 0 ? (
                    <div className="flex h-full min-h-[80px] items-center justify-center rounded-lg border border-dashed">
                      <span className="text-[10px] text-muted-foreground/40">—</span>
                    </div>
                  ) : (
                    dayEvents.map((event) => (
                      <button
                        key={`${event.sourceType}-${event.sourceId}`}
                        type="button"
                        onClick={() => onOpenEvent(event)}
                        className={cn(
                          "w-full rounded border-l-2 px-1.5 py-1 text-left text-[10px] leading-snug transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          event.sourceType === "MEETING"
                            ? "bg-primary/10 border-l-primary"
                            : "bg-amber-50 border-l-amber-400 dark:bg-amber-950/20"
                        )}
                      >
                        <div className="truncate font-semibold">{event.title}</div>
                        {!event.allDay && (
                          <div className="truncate text-muted-foreground opacity-70">
                            {format(new Date(event.startAt), "p")}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
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
      whileHover={{ y: -1, transition: { duration: 0.15 } }}
      className={cn(
        "group w-full rounded-xl border border-l-4 bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        borderCls
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: core info */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("text-xs", sourceBadgeClass[event.sourceType])}>
              {sourceLabel[event.sourceType]}
            </Badge>
            <Badge variant="outline" className={cn("text-xs", statusClass[event.status] || undefined)}>
              {formatLabel(event.status)}
            </Badge>
            {event.externalProvider && (
              <Badge variant="outline" className="text-xs">{formatLabel(event.externalProvider)}</Badge>
            )}
          </div>
          {/* Title + time */}
          <div>
            <h3 className="truncate font-semibold leading-snug group-hover:text-primary transition-colors">{event.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatEventTime(event)}</p>
          </div>
          {/* Meta */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 shrink-0" />
              {event.team?.name || "No team"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              {event.mode === "VIRTUAL" ? <Video className="h-3.5 w-3.5 shrink-0" /> : <MapPin className="h-3.5 w-3.5 shrink-0" />}
              {event.location || formatLabel(event.mode || event.sourceType)}
            </span>
          </div>
        </div>

        {/* Right: owner + sync — visible on sm+ */}
        <div className="hidden shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground sm:flex">
          <span className="font-medium text-foreground">
            {event.organizer?.fullName || event.assignee?.fullName || "No owner"}
          </span>
          <span>{event.externalSyncStatus ? formatLabel(event.externalSyncStatus) : "Internal"}</span>
          <ChevronRight className="mt-1 h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
    </motion.button>
  )
}

function CompactEventCard({ event, onOpenEvent }: { event: ApiCalendarEvent; onOpenEvent: (event: ApiCalendarEvent) => void }) {
  const borderCls = sourceBorderColor[event.sourceType] ?? "border-l-border"

  return (
    <button
      type="button"
      onClick={() => onOpenEvent(event)}
      className={cn(
        "w-full rounded-lg border border-l-4 bg-background p-2.5 text-left transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        borderCls
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{event.title}</p>
          <p className="text-[11px] text-muted-foreground">{format(new Date(event.startAt), "MMM d, p")}</p>
        </div>
        <Badge variant="outline" className={cn("shrink-0 text-[10px] px-1.5 py-0", sourceBadgeClass[event.sourceType])}>
          {sourceLabel[event.sourceType]}
        </Badge>
      </div>
    </button>
  )
}

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
    <div className="p-4">
      <div className="flex items-center gap-3">
        {/* Provider icon accent */}
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white",
          isGoogle ? "bg-[#4285f4]" : "bg-[#0078d4]"
        )}>
          {isGoogle ? "G" : "O"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{providerLabel(provider)}</p>
            <Badge variant={connected ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
              {connected ? "Connected" : "Off"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{integration?.email || "Not connected"}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-3">
          <span>Last sync</span>
          <span className="font-medium text-foreground">
            {integration?.lastSyncedAt ? format(new Date(integration.lastSyncedAt), "MMM d, p") : "Never"}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Status</span>
          <span className="font-medium text-foreground">{formatLabel(integration?.lastSyncStatus || "NOT_CONNECTED")}</span>
        </div>
      </div>

      {integration?.lastSyncError && (
        <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {integration.lastSyncError}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {!connected ? (
          <Button size="sm" className="h-7 px-3 text-xs" onClick={() => onAction(provider, "connect")} disabled={running}>
            <ExternalLink className="h-3.5 w-3.5" />Connect
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => onAction(provider, "sync")} disabled={running}>
              <RefreshCcw className="h-3.5 w-3.5" />Sync
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-3 text-xs text-muted-foreground" onClick={() => onAction(provider, "disconnect")} disabled={running}>
              Disconnect
            </Button>
          </>
        )}
      </div>
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
    <>
      <SheetHeader className="space-y-3 pb-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={cn("text-xs", sourceBadgeClass[event.sourceType])}>
            {sourceLabel[event.sourceType]}
          </Badge>
          <Badge variant="outline" className={cn("text-xs", statusClass[event.status] || undefined)}>
            {formatLabel(event.status)}
          </Badge>
          {event.externalProvider && (
            <Badge variant="outline" className="text-xs">{formatLabel(event.externalProvider)}</Badge>
          )}
        </div>
        <div className={cn("rounded-xl border-l-4 pl-4", borderCls)}>
          <SheetTitle className="text-xl leading-snug">{event.title}</SheetTitle>
          <SheetDescription className="text-xs">
            {format(new Date(event.startAt), "EEEE, MMMM d, yyyy")} · {formatEventTime(event)}
          </SheetDescription>
        </div>
      </SheetHeader>

      <div className="mt-2 space-y-4">
        {event.description && (
          <p className="rounded-xl border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
            {event.description}
          </p>
        )}

        <div className="grid gap-2.5 sm:grid-cols-2">
          <InfoTile icon={CalendarClock} label="Date and time" value={`${format(new Date(event.startAt), "PPP p")} – ${format(new Date(event.endAt), "p")}`} />
          <InfoTile icon={Users} label="Team" value={event.team?.name || "No team"} />
          <InfoTile icon={event.mode === "VIRTUAL" ? Video : MapPin} label="Mode / location" value={event.location || formatLabel(event.mode || event.sourceType)} />
          <InfoTile icon={CheckCircle2} label="Owner" value={event.organizer?.fullName || event.assignee?.fullName || "Not assigned"} />
        </div>

        {isMeeting && (
          <div className="rounded-xl border p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Participants</h3>
              <span className="text-xs text-muted-foreground">{event.participants?.length || 0} invited</span>
            </div>
            <p className="text-sm text-muted-foreground">{compactParticipants(event)}</p>
          </div>
        )}

        {event.approvals && event.approvals.length > 0 && (
          <div className="rounded-xl border p-4 space-y-2.5">
            <h3 className="text-sm font-semibold">Approval trail</h3>
            <div className="space-y-2">
              {event.approvals.map((approval) => (
                <div key={approval.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{approval.approverName || formatLabel(approval.approverRole)}</span>
                    <Badge variant="outline" className={cn("text-xs", statusClass[approval.status] || undefined)}>
                      {formatLabel(approval.status)}
                    </Badge>
                  </div>
                  {approval.note && <p className="mt-1.5 text-xs text-muted-foreground">{approval.note}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border p-4">
          <h3 className="mb-2.5 text-sm font-semibold">Sync status</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Provider</span>
              <span className="font-medium">{event.externalProvider ? formatLabel(event.externalProvider) : "Internal only"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{formatLabel(event.externalSyncStatus || "NOT_CONNECTED")}</span>
            </div>
          </div>
          {event.externalSyncError && (
            <p className="mt-2.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {event.externalSyncError}
            </p>
          )}
        </div>
      </div>

      <SheetFooter className="mt-5 flex-col gap-2 sm:flex-col sm:space-x-0">
        {event.joinUrl && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild>
              <a href={event.joinUrl} target="_blank" rel="noreferrer">
                <Link2 className="h-4 w-4" />Join meeting
              </a>
            </Button>
            <Button variant="outline" onClick={() => void onCopyLink(event)}>
              <ClipboardCopy className="h-4 w-4" />Copy link
            </Button>
          </div>
        )}
        {canManage && (
          <div className="grid gap-2 sm:grid-cols-2">
            {canSync && (
              <Button variant="outline" onClick={() => onMeetingAction(event, "sync")}>
                <RefreshCcw className="h-4 w-4" />Sync
              </Button>
            )}
            {canComplete && (
              <Button variant="outline" onClick={() => onMeetingAction(event, "complete")}>
                <CheckCircle2 className="h-4 w-4" />Mark completed
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" onClick={() => onMeetingAction(event, "cancel")}>
                <AlertCircle className="h-4 w-4" />Cancel
              </Button>
            )}
            <Button variant="destructive" onClick={() => onMeetingAction(event, "delete")}>
              <Trash2 className="h-4 w-4" />Delete
            </Button>
          </div>
        )}
      </SheetFooter>
    </>
  )
}

function InfoTile({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3.5">
      <div className="mb-2 inline-flex rounded-lg bg-primary/10 p-1.5 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed bg-muted/10 px-4 py-10 text-center">
      <CalendarDays className="h-8 w-8 text-muted-foreground/30" />
      <div>
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}

function CalendarSkeleton() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-7 rounded-lg" />)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl sm:h-28" />)}
      </div>
    </div>
  )
}

function EventListSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  )
}
