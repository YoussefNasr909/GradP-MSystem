"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type React from "react"
import {
  addDays,
  addMonths,
  differenceInMinutes,
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
  CalendarCheck2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Clock3,
  Edit3,
  ExternalLink,
  Filter,
  LinkIcon,
  Loader2,
  MapPin,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users,
  Video,
  XCircle,
} from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { meetingsApi, type CreateMeetingPayload, type UpdateMeetingPayload } from "@/lib/api/meetings"
import { teamsApi } from "@/lib/api/teams"
import type {
  ApiMeeting,
  ApiMeetingResponseStatus,
  ApiMeetingStatus,
  ApiMyTeamState,
  ApiTeamDetail,
  ApiTeamSummary,
} from "@/lib/api/types"
import { getSocket } from "@/lib/socket"
import { useAuthStore } from "@/lib/stores/auth-store"
import { cn } from "@/lib/utils"

type MeetingDateScope = "ALL" | "TODAY" | "UPCOMING" | "SELECTED"
type MeetingView = "agenda" | "calendar"
type ExternalProviderChoice = "GOOGLE" | "OUTLOOK" | "NONE"

type MeetingFormState = {
  teamId: string
  title: string
  description: string
  agenda: string
  date: string
  startTime: string
  endTime: string
  timezone: string
  mode: "VIRTUAL" | "IN_PERSON" | "HYBRID"
  externalProvider: ExternalProviderChoice
  location: string
  includeDoctor: boolean
  includeTa: boolean
  includeTeamMembers: boolean
  participantUserIds: string[]
  externalGuests: string
}

type FormErrors = Partial<Record<keyof MeetingFormState | "timeRange", string>>

type RosterPerson = {
  id: string
  name: string
  primaryRole: string
  roles: string[]
}

type PendingAction = {
  title: string
  description: string
  confirmLabel: string
  confirmVariant?: "default" | "destructive"
  details?: Array<{ label: string; value: string }>
  action: () => Promise<ApiMeeting | { id: string; deleted: boolean } | void>
}

const statusFilterOptions: Array<{ value: "ALL" | ApiMeetingStatus; label: string }> = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING_APPROVAL", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "DECLINED", label: "Needs reschedule" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
]

const dateScopeOptions: Array<{ value: MeetingDateScope; label: string }> = [
  { value: "ALL", label: "All dates" },
  { value: "TODAY", label: "Today" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "SELECTED", label: "Selected day" },
]

const statusMeta: Record<ApiMeetingStatus, { label: string; icon: typeof CalendarClock; className: string; borderColor: string }> = {
  PENDING_APPROVAL: {
    label: "Pending approval",
    icon: Clock3,
    className: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
    borderColor: "border-l-amber-400",
  },
  CONFIRMED: {
    label: "Confirmed",
    icon: CheckCircle2,
    className: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
    borderColor: "border-l-emerald-400",
  },
  DECLINED: {
    label: "Needs reschedule",
    icon: AlertCircle,
    className: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200",
    borderColor: "border-l-orange-400",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: XCircle,
    className: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
    borderColor: "border-l-slate-300",
  },
  COMPLETED: {
    label: "Completed",
    icon: Check,
    className: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
    borderColor: "border-l-blue-400",
  },
}

const labelOverrides: Record<string, string> = {
  TA: "TA",
  GOOGLE: "Google",
  OUTLOOK: "Outlook",
  GOOGLE_MEET: "Google Meet",
  MICROSOFT_TEAMS: "Microsoft Teams",
  PENDING_APPROVAL: "Pending approval",
  IN_PERSON: "In person",
  NOT_CONNECTED: "Needs connection",
  PROJECTHUB: "ProjectHub",
}

const rolePriority = ["LEADER", "DOCTOR", "TA", "MEMBER"]

const isTerminalStatus = (status: ApiMeetingStatus) => status === "CANCELLED" || status === "COMPLETED"
const isActiveMeeting = (meeting: ApiMeeting) => !isTerminalStatus(meeting.status)

function safeDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function toLocalDateValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function toLocalTimeValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(11, 16)
}

function toApiDateTime(date: string, time: string) {
  const parsed = new Date(`${date}T${time}`)
  return Number.isNaN(parsed.getTime()) ? `${date}T${time}` : parsed.toISOString()
}

function createInitialForm(timezone: string, teamId = ""): MeetingFormState {
  const start = addDays(new Date(), 1)
  start.setHours(10, 0, 0, 0)
  const end = new Date(start)
  end.setHours(11, 0, 0, 0)

  return {
    teamId,
    title: "",
    description: "",
    agenda: "",
    date: toLocalDateValue(start),
    startTime: toLocalTimeValue(start),
    endTime: toLocalTimeValue(end),
    timezone,
    mode: "VIRTUAL",
    externalProvider: "GOOGLE",
    location: "",
    includeDoctor: true,
    includeTa: true,
    includeTeamMembers: true,
    participantUserIds: [],
    externalGuests: "",
  }
}

function meetingToForm(meeting: ApiMeeting, timezone: string): MeetingFormState {
  const start = safeDate(meeting.startAt)
  const end = safeDate(meeting.endAt)

  return {
    teamId: meeting.team.id,
    title: meeting.title,
    description: meeting.description ?? "",
    agenda: meeting.agenda ?? "",
    date: toLocalDateValue(start),
    startTime: toLocalTimeValue(start),
    endTime: toLocalTimeValue(end),
    timezone: meeting.timezone || timezone,
    mode: meeting.mode,
    externalProvider: meeting.externalProvider ?? "NONE",
    location: meeting.location ?? "",
    includeDoctor: meeting.participants.some((p) => p.participantRole === "DOCTOR"),
    includeTa: meeting.participants.some((p) => p.participantRole === "TA"),
    includeTeamMembers: meeting.participants.some((p) => p.participantRole === "MEMBER"),
    participantUserIds: meeting.participants.map((p) => p.userId).filter(Boolean) as string[],
    externalGuests: meeting.participants
      .filter((p) => p.isExternalGuest && p.email)
      .map((p) => p.email)
      .join(", "),
  }
}

function formatLabel(value?: string | null) {
  if (!value) return "Not set"
  if (labelOverrides[value]) return labelOverrides[value]
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatMeetingRange(meeting: Pick<ApiMeeting, "startAt" | "endAt">) {
  const start = safeDate(meeting.startAt)
  const end = safeDate(meeting.endAt)
  return `${format(start, "EEE, MMM d")} · ${format(start, "p")} – ${format(end, "p")}`
}

function getMeetingDurationLabel(meeting: Pick<ApiMeeting, "startAt" | "endAt">) {
  const minutes = Math.max(0, differenceInMinutes(safeDate(meeting.endAt), safeDate(meeting.startAt)))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`
}

function getCalendarDays(date: Date) {
  const gridStart = startOfWeek(startOfMonth(date), { weekStartsOn: 6 })
  const gridEnd = endOfWeek(endOfMonth(date), { weekStartsOn: 6 })
  const days: Date[] = []
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    days.push(cursor)
  }
  return days
}

function parseExternalGuests(input: string) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const values = input
    .split(/[;,\n]/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
  const unique = Array.from(new Set(values))
  const invalid = unique.filter((e) => !emailPattern.test(e))
  return {
    invalid,
    guests: unique.filter((e) => emailPattern.test(e)).map((email) => ({ email })),
  }
}

function validateMeetingForm(form: MeetingFormState) {
  const errors: FormErrors = {}

  if (!form.teamId) errors.teamId = "Please choose a team for this meeting."

  const titleTrimmed = form.title.trim()
  if (!titleTrimmed) {
    errors.title = "Meeting title is required."
  } else if (titleTrimmed.length < 3) {
    errors.title = "Title must be at least 3 characters."
  } else if (titleTrimmed.length > 100) {
    errors.title = "Title must be 100 characters or fewer."
  }

  if (!form.date) errors.date = "Please pick a date."
  if (!form.startTime) errors.startTime = "Start time is required."
  if (!form.endTime) errors.endTime = "End time is required."

  if (form.date && form.startTime && form.endTime) {
    const start = new Date(`${form.date}T${form.startTime}`)
    const end = new Date(`${form.date}T${form.endTime}`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      errors.timeRange = "Please enter a valid date and time."
    } else if (end <= start) {
      errors.timeRange = "End time must be after start time."
    } else {
      const mins = (end.getTime() - start.getTime()) / 60_000
      if (mins < 5) errors.timeRange = "Meeting must be at least 5 minutes long."
    }
  }

  const { invalid, guests } = parseExternalGuests(form.externalGuests)
  if (invalid.length) errors.externalGuests = `Invalid email address: "${invalid[0]}"`

  return { errors, guests }
}

function providerFromChoice(mode: MeetingFormState["mode"], provider: ExternalProviderChoice) {
  if (mode === "IN_PERSON") return "MANUAL" as const
  if (provider === "GOOGLE") return "GOOGLE_MEET" as const
  if (provider === "OUTLOOK") return "MICROSOFT_TEAMS" as const
  return "MANUAL" as const
}

function sortMeetings(meetings: ApiMeeting[]) {
  return [...meetings].sort((a, b) => safeDate(a.startAt).getTime() - safeDate(b.startAt).getTime())
}

function StatusBadge({ status }: { status: ApiMeetingStatus }) {
  const meta = statusMeta[status]
  const Icon = meta.icon
  return (
    <Badge variant="outline" className={cn("gap-1.5 text-xs", meta.className)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  )
}

function SyncBadge({ meeting }: { meeting: ApiMeeting }) {
  if (!meeting.externalProvider) return <Badge variant="outline" className="text-xs">ProjectHub only</Badge>
  if (meeting.externalSyncStatus === "SYNCED") return <Badge variant="outline" className="text-xs">Synced · {formatLabel(meeting.externalProvider)}</Badge>
  if (meeting.externalSyncStatus === "ERROR") return <Badge variant="destructive" className="text-xs">Sync error</Badge>
  if (meeting.externalSyncStatus === "NOT_CONNECTED") return <Badge variant="secondary" className="text-xs">Connect {formatLabel(meeting.externalProvider)}</Badge>
  return <Badge variant="outline" className="text-xs">{formatLabel(meeting.externalSyncStatus)}</Badge>
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <p className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <CalendarClock className="h-7 w-7" />
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

function MeetingsLoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border-l-4 border-l-muted bg-card p-5">
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="mb-2 h-5 w-2/3" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  )
}

export default function MeetingsPage() {
  const { currentUser, accessToken } = useAuthStore()
  const prefersReducedMotion = useReducedMotion()
  const browserTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo", [])
  const [teamState, setTeamState] = useState<ApiMyTeamState | null>(null)
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<ApiTeamDetail | null>(null)
  const [meetings, setMeetings] = useState<ApiMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [view, setView] = useState<MeetingView>("agenda")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | ApiMeetingStatus>("ALL")
  const [dateScope, setDateScope] = useState<MeetingDateScope>("ALL")
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [formOpen, setFormOpen] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<ApiMeeting | null>(null)
  const [form, setForm] = useState<MeetingFormState>(() => createInitialForm(browserTimeZone))
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<ApiMeeting | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [rescheduleMeeting, setRescheduleMeeting] = useState<ApiMeeting | null>(null)
  const [declinePayload, setDeclinePayload] = useState({
    proposedDate: toLocalDateValue(addDays(new Date(), 1)),
    proposedStartTime: "10:00",
    proposedEndTime: "11:00",
    note: "",
  })
  const [proposalSubmitting, setProposalSubmitting] = useState(false)

  const availableTeams = useMemo(() => {
    const byId = new Map<string, Pick<ApiTeamDetail | ApiTeamSummary, "id" | "name">>()
    if (teamState?.team) byId.set(teamState.team.id, teamState.team)
    for (const team of teamState?.supervisedTeams ?? []) byId.set(team.id, team)
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [teamState])

  const canCreate = ["leader", "doctor", "ta", "admin"].includes(currentUser?.role ?? "")

  const roster = useMemo<RosterPerson[]>(() => {
    const team = selectedTeamDetail
    if (!team || form.teamId !== team.id) return []

    const raw = [
      team.leader ? { id: team.leader.id, name: team.leader.fullName, role: "LEADER" } : null,
      team.doctor ? { id: team.doctor.id, name: team.doctor.fullName, role: "DOCTOR" } : null,
      team.ta ? { id: team.ta.id, name: team.ta.fullName, role: "TA" } : null,
      ...team.members.map((m) => ({ id: m.user.id, name: m.user.fullName, role: "MEMBER" })),
    ].filter(Boolean) as Array<{ id: string; name: string; role: string }>

    const people = new Map<string, RosterPerson>()
    for (const person of raw) {
      const existing = people.get(person.id)
      if (!existing) {
        people.set(person.id, { id: person.id, name: person.name, primaryRole: person.role, roles: [person.role] })
        continue
      }
      if (!existing.roles.includes(person.role)) existing.roles.push(person.role)
      existing.roles.sort((a, b) => rolePriority.indexOf(a) - rolePriority.indexOf(b))
      existing.primaryRole = existing.roles[0] ?? existing.primaryRole
    }

    return Array.from(people.values()).sort(
      (a, b) => rolePriority.indexOf(a.primaryRole) - rolePriority.indexOf(b.primaryRole)
    )
  }, [form.teamId, selectedTeamDetail])

  useEffect(() => {
    if (!form.teamId) {
      setSelectedTeamDetail(null)
      return
    }
    if (teamState?.team?.id === form.teamId) {
      setSelectedTeamDetail(teamState.team)
      return
    }
    let active = true
    teamsApi
      .getById(form.teamId)
      .then((team) => { if (active) setSelectedTeamDetail(team) })
      .catch(() => { if (active) setSelectedTeamDetail(null) })
    return () => { active = false }
  }, [form.teamId, teamState?.team])

  const loadPage = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const [myTeam, allMeetings] = await Promise.all([teamsApi.my(), meetingsApi.list()])
      setTeamState(myTeam)
      setMeetings(sortMeetings(allMeetings))
      const firstTeamId = myTeam.team?.id || myTeam.supervisedTeams?.[0]?.id || ""
      if (firstTeamId) {
        setForm((c) => ({ ...c, teamId: c.teamId || firstTeamId, timezone: browserTimeZone }))
      }
    } catch (err: any) {
      const message = err?.message || "Failed to load meetings."
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [browserTimeZone])

  useEffect(() => { void loadPage() }, [loadPage])

  useEffect(() => {
    if (!accessToken) return
    const socket = getSocket(accessToken)
    if (!socket) return
    const handler = () => void loadPage()
    const events = [
      "meeting.created", "meeting.pending", "meeting.approved", "meeting.declined",
      "meeting.updated", "meeting.cancelled", "meeting.completed", "meeting.deleted",
      "meeting.response", "calendar.event.updated",
    ]
    events.forEach((e) => socket.on(e, handler))
    return () => { events.forEach((e) => socket.off(e, handler)) }
  }, [accessToken, loadPage])

  useEffect(() => {
    setSelectedMeeting((current) => {
      if (!current) return current
      return meetings.find((meeting) => meeting.id === current.id) ?? null
    })
  }, [meetings])

  useEffect(() => {
    setForm((c) => ({ ...c, timezone: browserTimeZone }))
  }, [browserTimeZone])

  const meetingsByDay = useMemo(() => {
    return meetings.reduce<Record<string, ApiMeeting[]>>((groups, meeting) => {
      const key = format(safeDate(meeting.startAt), "yyyy-MM-dd")
      groups[key] = groups[key] || []
      groups[key].push(meeting)
      return groups
    }, {})
  }, [meetings])

  const selectedDayMeetings = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd")
    return sortMeetings(meetingsByDay[key] || [])
  }, [meetingsByDay, selectedDate])

  const filteredMeetings = useMemo(() => {
    const q = search.trim().toLowerCase()
    const today = startOfDay(new Date())
    return meetings.filter((m) => {
      const matchesStatus = statusFilter === "ALL" || m.status === statusFilter
      const start = safeDate(m.startAt)
      const end = safeDate(m.endAt)
      const matchesScope =
        dateScope === "ALL" ||
        (dateScope === "TODAY" && isSameDay(start, new Date())) ||
        (dateScope === "UPCOMING" && end >= today && isActiveMeeting(m)) ||
        (dateScope === "SELECTED" && isSameDay(start, selectedDate))
      const haystack = [
        m.title, m.description, m.agenda, m.team.name, m.organizer.fullName, m.location, m.joinUrl,
        ...m.participants.map((p) => p.user?.fullName || p.displayName || p.email || ""),
      ].filter(Boolean).join(" ").toLowerCase()
      return matchesStatus && matchesScope && (!q || haystack.includes(q))
    })
  }, [dateScope, meetings, search, selectedDate, statusFilter])

  const summary = useMemo(() => {
    const now = new Date()
    const todayMeetings = meetings.filter((m) => isSameDay(safeDate(m.startAt), now) && isActiveMeeting(m))
    const upcomingMeetings = meetings.filter((m) => safeDate(m.endAt) >= startOfDay(now) && isActiveMeeting(m))
    const nextMeeting = upcomingMeetings.find((m) => safeDate(m.endAt).getTime() >= Date.now()) ?? null
    return {
      today: todayMeetings.length,
      upcoming: upcomingMeetings.length,
      completed: meetings.filter((m) => m.status === "COMPLETED").length,
      cancelled: meetings.filter((m) => m.status === "CANCELLED").length,
      pending: meetings.filter((m) => m.status === "PENDING_APPROVAL").length,
      needsAttention: meetings.filter(
        (m) => m.status === "DECLINED" || (m.status === "CONFIRMED" && ["ERROR", "NOT_CONNECTED", "DISCONNECTED"].includes(m.externalSyncStatus))
      ).length,
      nextMeeting,
    }
  }, [meetings])

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth])

  const conflictMeeting = useMemo(() => {
    const start = new Date(`${form.date}T${form.startTime}`)
    const end = new Date(`${form.date}T${form.endTime}`)
    if (!form.teamId || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null
    return (
      meetings.find((m) => {
        if (m.id === editingMeeting?.id) return false
        if (m.team.id !== form.teamId || !isActiveMeeting(m)) return false
        return safeDate(m.startAt) < end && safeDate(m.endAt) > start
      }) ?? null
    )
  }, [editingMeeting?.id, form.date, form.endTime, form.startTime, form.teamId, meetings])

  const formDuration = useMemo(() => {
    const start = new Date(`${form.date}T${form.startTime}`)
    const end = new Date(`${form.date}T${form.endTime}`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null
    const mins = Math.round((end.getTime() - start.getTime()) / 60_000)
    if (mins < 60) return `${mins} min`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m ? `${h}h ${m}m` : `${h}h`
  }, [form.date, form.startTime, form.endTime])

  const isFormDatePast = useMemo(() => {
    if (!form.date || !form.startTime) return false
    const d = new Date(`${form.date}T${form.startTime}`)
    return !Number.isNaN(d.getTime()) && d < new Date()
  }, [form.date, form.startTime])

  function openCreateDialog() {
    const firstTeamId = availableTeams[0]?.id || ""
    if (!firstTeamId) { toast.error("No team is available for meeting creation yet."); return }
    setEditingMeeting(null)
    setForm(createInitialForm(browserTimeZone, firstTeamId))
    setFormErrors({})
    setFormOpen(true)
  }

  function openEditDialog(meeting: ApiMeeting) {
    setEditingMeeting(meeting)
    setForm(meetingToForm(meeting, browserTimeZone))
    setFormErrors({})
    setFormOpen(true)
  }

  function upsertMeeting(meeting: ApiMeeting) {
    setMeetings((c) => sortMeetings([...c.filter((m) => m.id !== meeting.id), meeting]))
  }

  async function handleSaveMeeting() {
    const { errors, guests } = validateMeetingForm(form)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    const externalProvider = form.externalProvider === "NONE" ? null : form.externalProvider
    const commonPayload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      agenda: form.agenda.trim() || undefined,
      startAt: toApiDateTime(form.date, form.startTime),
      endAt: toApiDateTime(form.date, form.endTime),
      timezone: browserTimeZone,
      mode: form.mode,
      provider: providerFromChoice(form.mode, form.externalProvider),
      externalProvider,
      location: form.location.trim() || undefined,
    }

    try {
      setSubmitting(true)
      if (editingMeeting) {
        const updated = await meetingsApi.update(editingMeeting.id, commonPayload as UpdateMeetingPayload)
        upsertMeeting(updated)
        setSelectedMeeting((c) => (c?.id === updated.id ? updated : c))
        toast.success("Meeting updated")
      } else {
        const payload: CreateMeetingPayload = {
          ...commonPayload,
          teamId: form.teamId,
          includeDoctor: form.includeDoctor,
          includeTa: form.includeTa,
          includeTeamMembers: form.includeTeamMembers,
          participantUserIds: form.participantUserIds,
          externalGuests: guests,
        }
        const created = await meetingsApi.create(payload)
        upsertMeeting(created)
        setSelectedMeeting(created)
        toast.success(created.status === "PENDING_APPROVAL" ? "Meeting request sent for approval" : "Meeting created")
      }
      setFormOpen(false)
      setEditingMeeting(null)
    } catch (err: any) {
      toast.error(err?.message || "Could not save this meeting.")
    } finally {
      setSubmitting(false)
    }
  }

  async function copyMeetingLink(meeting: ApiMeeting) {
    if (!meeting.joinUrl) return
    try {
      await navigator.clipboard.writeText(meeting.joinUrl)
      toast.success("Meeting link copied")
    } catch {
      toast.error("Could not copy the meeting link")
    }
  }

  function createAction(action: PendingAction) { setPendingAction(action) }

  async function confirmPendingAction() {
    if (!pendingAction) return
    try {
      setActionSubmitting(true)
      const result = await pendingAction.action()
      if (result && "deleted" in result) {
        setMeetings((c) => c.filter((m) => m.id !== result.id))
        setSelectedMeeting((c) => (c?.id === result.id ? null : c))
      } else if (result && "id" in result) {
        upsertMeeting(result)
        setSelectedMeeting((c) => (c?.id === result.id ? result : c))
      }
      setPendingAction(null)
    } catch (err: any) {
      toast.error(err?.message || "Action failed")
    } finally {
      setActionSubmitting(false)
    }
  }

  async function handleProposalSubmit() {
    if (!rescheduleMeeting) return
    const start = new Date(`${declinePayload.proposedDate}T${declinePayload.proposedStartTime}`)
    const end = new Date(`${declinePayload.proposedDate}T${declinePayload.proposedEndTime}`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      toast.error("Proposed end time must be after proposed start time.")
      return
    }
    try {
      setProposalSubmitting(true)
      const updated = await meetingsApi.decline(rescheduleMeeting.id, {
        proposedStartAt: start.toISOString(),
        proposedEndAt: end.toISOString(),
        note: declinePayload.note.trim() || undefined,
      })
      upsertMeeting(updated)
      setSelectedMeeting((c) => (c?.id === updated.id ? updated : c))
      setRescheduleMeeting(null)
      toast.success("New time proposed")
    } catch (err: any) {
      toast.error(err?.message || "Failed to send proposal")
    } finally {
      setProposalSubmitting(false)
    }
  }

  function setSelectedDay(day: Date) {
    setSelectedDate(day)
    setCalendarMonth(day)
    setDateScope("SELECTED")
  }

  function jumpToday() {
    const today = new Date()
    setSelectedDate(today)
    setCalendarMonth(today)
    setDateScope("TODAY")
  }

  function actionDetails(meeting: ApiMeeting) {
    return [
      { label: "Meeting", value: meeting.title },
      { label: "When", value: formatMeetingRange(meeting) },
      { label: "Team", value: meeting.team.name },
    ]
  }

  function meetingActions(meeting: ApiMeeting) {
    const actions: React.ReactNode[] = []
    const myParticipant = currentUser?.id
      ? meeting.participants.find((p) => p.userId === currentUser.id)
      : null
    const canRespond = meeting.permissions.canRespond && myParticipant?.responseStatus === "PENDING" && !meeting.permissions.canApprove

    if (meeting.joinUrl) {
      actions.push(
        <Button key="join" asChild size="sm">
          <a href={meeting.joinUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />Join
          </a>
        </Button>
      )
      actions.push(
        <Button key="copy" size="sm" variant="outline" onClick={() => void copyMeetingLink(meeting)}>
          <ClipboardCopy className="h-4 w-4" />Copy link
        </Button>
      )
    }

    if (meeting.permissions.canApprove) {
      actions.push(
        <Button key="approve" size="sm" onClick={() => createAction({
          title: "Approve this meeting?",
          description: "Approving confirms that this time works for you.",
          confirmLabel: "Approve meeting",
          details: actionDetails(meeting),
          action: async () => { const u = await meetingsApi.approve(meeting.id); toast.success("Meeting approved"); return u },
        })}>
          <Check className="h-4 w-4" />Approve
        </Button>
      )
      actions.push(
        <Button key="reschedule" size="sm" variant="outline" onClick={() => {
          const start = safeDate(meeting.startAt)
          const end = safeDate(meeting.endAt)
          setDeclinePayload({ proposedDate: toLocalDateValue(start), proposedStartTime: toLocalTimeValue(start), proposedEndTime: toLocalTimeValue(end), note: "" })
          setRescheduleMeeting(meeting)
        }}>
          <ChevronRight className="h-4 w-4" />Propose new time
        </Button>
      )
    }

    if (canRespond) {
      const responses: Array<{ label: string; status: ApiMeetingResponseStatus }> = [
        { label: "Accept", status: "ACCEPTED" },
        { label: "Tentative", status: "TENTATIVE" },
        { label: "Decline", status: "DECLINED" },
      ]
      responses.forEach((r) => {
        actions.push(
          <Button key={`respond-${r.status}`} size="sm" variant="outline" onClick={() => createAction({
            title: `${r.label} this meeting?`,
            description: "Your response updates the attendance summary.",
            confirmLabel: r.label,
            details: actionDetails(meeting),
            action: async () => { const u = await meetingsApi.respond(meeting.id, r.status); toast.success("Response updated"); return u },
          })}>
            {r.label}
          </Button>
        )
      })
    }

    if (meeting.permissions.canManage && meeting.status === "CONFIRMED") {
      actions.push(
        <Button key="sync" size="sm" variant="outline" onClick={() => createAction({
          title: "Sync this meeting now?",
          description: "Pushes meeting details to the selected external calendar.",
          confirmLabel: "Sync meeting",
          details: actionDetails(meeting),
          action: async () => { const u = await meetingsApi.sync(meeting.id); toast.success("Meeting sync requested"); return u },
        })}>
          <RefreshCcw className="h-4 w-4" />Sync
        </Button>
      )
      actions.push(
        <Button key="complete" size="sm" variant="outline" onClick={() => createAction({
          title: "Mark this meeting as completed?",
          description: "Completed meetings stay visible in history.",
          confirmLabel: "Mark completed",
          details: actionDetails(meeting),
          action: async () => { const u = await meetingsApi.complete(meeting.id); toast.success("Meeting marked completed"); return u },
        })}>
          <CheckCircle2 className="h-4 w-4" />Complete
        </Button>
      )
    }

    if (meeting.permissions.canManage && isActiveMeeting(meeting)) {
      actions.push(
        <Button key="edit" size="sm" variant="outline" onClick={() => openEditDialog(meeting)}>
          <Edit3 className="h-4 w-4" />Edit
        </Button>
      )
      actions.push(
        <Button key="cancel" size="sm" variant="outline" onClick={() => createAction({
          title: "Cancel this meeting?",
          description: "The meeting remains in history as cancelled.",
          confirmLabel: "Cancel meeting",
          confirmVariant: "destructive",
          details: actionDetails(meeting),
          action: async () => { const u = await meetingsApi.cancel(meeting.id); toast.success("Meeting cancelled"); return u },
        })}>
          <XCircle className="h-4 w-4" />Cancel
        </Button>
      )
    }

    if (meeting.permissions.canManage) {
      actions.push(
        <Button key="delete" size="sm" variant="outline"
          className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => createAction({
            title: "Delete this meeting permanently?",
            description: "This removes the meeting and all records. Cannot be undone.",
            confirmLabel: "Delete meeting",
            confirmVariant: "destructive",
            details: actionDetails(meeting),
            action: async () => { const d = await meetingsApi.delete(meeting.id); toast.success("Meeting deleted"); return d },
          })}>
          <Trash2 className="h-4 w-4" />Delete
        </Button>
      )
    }

    return actions
  }

  return (
    <TeamRequiredGuard
      pageName="Meetings"
      pageDescription="Create, approve, join, and track every project meeting from one clean workspace."
      icon={<CalendarClock className="h-8 w-8 text-primary" />}
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
                <CalendarClock className="h-3 w-3" />
                Meetings
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Plan, approve &amp; join.</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                A focused schedule for your team. Upcoming stays first, history stays out of the way.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void loadPage()} disabled={loading}>
                <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </Button>
              {canCreate && (
                <Button size="sm" onClick={openCreateDialog} disabled={!availableTeams.length}>
                  <Plus className="h-4 w-4" />
                  New meeting
                </Button>
              )}
            </div>
          </div>

          {/* Stats + next meeting */}
          <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
            <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
              <SummaryPill label="Today" value={summary.today} active={dateScope === "TODAY"} onClick={jumpToday} />
              <SummaryPill label="Upcoming" value={summary.upcoming} active={dateScope === "UPCOMING"} onClick={() => setDateScope("UPCOMING")} />
              <SummaryPill label="Pending" value={summary.pending} active={statusFilter === "PENDING_APPROVAL"} onClick={() => setStatusFilter("PENDING_APPROVAL")} />
              <SummaryPill label="Attention" value={summary.needsAttention || summary.cancelled} tone="warning" />
            </div>

            <div className={cn(
              "rounded-xl border p-3 sm:p-4 transition-colors",
              summary.nextMeeting ? "bg-primary/5 border-primary/20" : "bg-muted/20 border-border/50"
            )}>
              {summary.nextMeeting ? (
                <div className="flex flex-col gap-2 sm:gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-primary/70">Next up</p>
                    <StatusBadge status={summary.nextMeeting.status} />
                  </div>
                  {/* On mobile: horizontal compact row; on lg: stacked */}
                  <div className="flex items-start justify-between gap-3 lg:flex-col lg:gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold leading-snug">{summary.nextMeeting.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatMeetingRange(summary.nextMeeting)}</p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 lg:w-full" onClick={() => setSelectedMeeting(summary.nextMeeting)}>
                      <span className="hidden lg:inline">Open details</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{summary.nextMeeting.participants.length}</span>
                    <span className="flex items-center gap-1">
                      {summary.nextMeeting.mode === "VIRTUAL" ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                      {summary.nextMeeting.location || formatLabel(summary.nextMeeting.mode)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-20 flex-row items-center gap-3 lg:min-h-28 lg:flex-col lg:justify-center lg:text-center">
                  <CalendarCheck2 className="h-6 w-6 shrink-0 text-muted-foreground/40 lg:h-7 lg:w-7" />
                  <p className="text-sm text-muted-foreground">No upcoming meetings</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── FILTER BAR ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-2 rounded-xl bg-muted/30 p-3 sm:flex sm:flex-wrap sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search meetings..."
              className="h-9 w-full bg-background pl-8 text-sm sm:min-w-[180px] sm:flex-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "ALL" | ApiMeetingStatus)}>
              <SelectTrigger className="h-9 w-full bg-background text-sm sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusFilterOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dateScope} onValueChange={(v) => setDateScope(v as MeetingDateScope)}>
              <SelectTrigger className="h-9 w-full bg-background text-sm sm:w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateScopeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="sm" className="h-9 w-full text-sm sm:w-auto sm:px-3"
            onClick={() => { setSearch(""); setStatusFilter("ALL"); setDateScope("ALL") }}>
            Clear filters
          </Button>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Could not load meetings</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button size="sm" onClick={() => void loadPage()}>
              <RefreshCcw className="h-4 w-4" />Retry
            </Button>
          </div>
        )}

        {/* ── VIEWS ───────────────────────────────────────────────── */}
        <Tabs value={view} onValueChange={(v) => setView(v as MeetingView)} className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <TabsList className="h-9 grid w-full grid-cols-2 rounded-lg sm:w-fit">
              <TabsTrigger value="agenda" className="rounded-md text-sm">Agenda</TabsTrigger>
              <TabsTrigger value="calendar" className="rounded-md text-sm">Month</TabsTrigger>
            </TabsList>
            <p className="shrink-0 text-xs text-muted-foreground">
              {filteredMeetings.length}/{meetings.length}
            </p>
          </div>

          {loading ? (
            <MeetingsLoadingState />
          ) : (
            <>
              <TabsContent value="agenda" className="mt-0">
                <div className="grid gap-4 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px]">
                  {/* Sidebar — shown above list on mobile, right column on lg+ */}
                  <aside className="space-y-3 lg:order-last">
                    <CalendarMiniPanel
                      month={calendarMonth}
                      selectedDate={selectedDate}
                      days={calendarDays}
                      meetingsByDay={meetingsByDay}
                      onPreviousMonth={() => setCalendarMonth((c) => addMonths(c, -1))}
                      onNextMonth={() => setCalendarMonth((c) => addMonths(c, 1))}
                      onToday={jumpToday}
                      onSelectDay={setSelectedDay}
                    />
                    <SelectedDayPanel
                      selectedDate={selectedDate}
                      meetings={selectedDayMeetings}
                      onSelect={setSelectedMeeting}
                      onCreate={canCreate ? openCreateDialog : undefined}
                    />
                  </aside>
                  {/* Meeting list */}
                  <div className="space-y-3 lg:order-first">
                    {filteredMeetings.length === 0 ? (
                      <EmptyState
                        title="No meetings match this view"
                        description="Try a different filter, choose another day, or create a meeting."
                        action={canCreate ? (
                          <Button size="sm" onClick={openCreateDialog} className="mt-4">
                            <Plus className="h-4 w-4" />Create meeting
                          </Button>
                        ) : undefined}
                      />
                    ) : (
                      filteredMeetings.map((meeting, index) => (
                        <motion.div
                          key={meeting.id}
                          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: prefersReducedMotion ? 0 : Math.min(index * 0.04, 0.25), duration: 0.22 }}
                        >
                          <MeetingCard
                            meeting={meeting}
                            actions={meetingActions(meeting)}
                            onSelect={() => setSelectedMeeting(meeting)}
                          />
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="calendar" className="mt-0">
                <div className="grid gap-4 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px]">
                  <CalendarFullPanel
                    month={calendarMonth}
                    selectedDate={selectedDate}
                    days={calendarDays}
                    meetingsByDay={meetingsByDay}
                    filteredMeetings={filteredMeetings}
                    onPreviousMonth={() => setCalendarMonth((c) => addMonths(c, -1))}
                    onNextMonth={() => setCalendarMonth((c) => addMonths(c, 1))}
                    onToday={jumpToday}
                    onSelectDay={setSelectedDay}
                    onSelectMeeting={setSelectedMeeting}
                  />
                  <SelectedDayPanel
                    selectedDate={selectedDate}
                    meetings={selectedDayMeetings}
                    onSelect={setSelectedMeeting}
                    onCreate={canCreate ? openCreateDialog : undefined}
                  />
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* ── CREATE / EDIT DIALOG ─────────────────────────────────── */}
        <Dialog open={formOpen} onOpenChange={(open) => { if (!submitting) setFormOpen(open) }}>
          <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col overflow-hidden p-0">
            {/* Header */}
            <DialogHeader className="border-b px-6 py-5">
              <DialogTitle className="text-xl">
                {editingMeeting ? "Edit meeting" : "Schedule a meeting"}
              </DialogTitle>
              <DialogDescription>
                {editingMeeting
                  ? "Update the schedule, content, and sync settings below."
                  : "Fill in the details — calendar sync with Google or Outlook happens after the meeting is confirmed."}
              </DialogDescription>
            </DialogHeader>

            {/* Scrollable body — divided into sections */}
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y">

                {/* ── Notices (conflict + past date) ── */}
                {(conflictMeeting || isFormDatePast) && (
                  <div className="space-y-2 px-6 py-4">
                    {conflictMeeting && (
                      <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0 text-sm">
                          <p className="font-semibold">Schedule conflict detected</p>
                          <p className="mt-0.5 opacity-80">
                            This time overlaps with <strong>&ldquo;{conflictMeeting.title}&rdquo;</strong>{" "}
                            ({formatMeetingRange(conflictMeeting)}). You can still save, but consider adjusting the time.
                          </p>
                        </div>
                      </div>
                    )}
                    {isFormDatePast && (
                      <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="text-sm">
                          <p className="font-semibold">Past date selected</p>
                          <p className="mt-0.5 opacity-80">This meeting is scheduled in the past. Make sure that&apos;s intentional.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Section 1: Meeting details ── */}
                <div className="space-y-4 px-6 py-5">
                  <SectionHeader label="Meeting details" />

                  {/* Team */}
                  {!editingMeeting && availableTeams.length > 1 ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="meeting-team">
                        Team <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={form.teamId || undefined}
                        onValueChange={(v) => setForm((c) => ({ ...c, teamId: v, participantUserIds: [] }))}
                      >
                        <SelectTrigger
                          id="meeting-team"
                          className={cn(formErrors.teamId && "border-destructive focus-visible:ring-destructive")}
                        >
                          <SelectValue placeholder="Choose a team…" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FieldError message={formErrors.teamId} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 rounded-xl border bg-muted/30 px-4 py-2.5 text-sm">
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">Team</span>
                      <span className="font-medium">{editingMeeting?.team.name || availableTeams[0]?.name || "—"}</span>
                    </div>
                  )}

                  {/* Title */}
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <Label htmlFor="meeting-title">
                        Title <span className="text-destructive">*</span>
                      </Label>
                      <span className={cn(
                        "text-xs tabular-nums transition-colors",
                        form.title.length > 90 ? "font-medium text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                      )}>
                        {form.title.length}/100
                      </span>
                    </div>
                    <Input
                      id="meeting-title"
                      value={form.title}
                      onChange={(e) => setForm((c) => ({ ...c, title: e.target.value.slice(0, 100) }))}
                      placeholder="Sprint planning, supervisor review, weekly sync…"
                      className={cn(formErrors.title && "border-destructive focus-visible:ring-destructive")}
                    />
                    <FieldError message={formErrors.title} />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label htmlFor="meeting-description">Description</Label>
                    <Textarea
                      id="meeting-description"
                      value={form.description}
                      onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                      className="min-h-[80px] resize-none"
                      placeholder="Give participants context — why this meeting matters and what to prepare."
                    />
                  </div>

                  {/* Agenda */}
                  <div className="space-y-1.5">
                    <Label htmlFor="meeting-agenda">Agenda</Label>
                    <Textarea
                      id="meeting-agenda"
                      value={form.agenda}
                      onChange={(e) => setForm((c) => ({ ...c, agenda: e.target.value }))}
                      className="min-h-[80px] resize-none"
                      placeholder="Key decisions, demos, blockers, or review items…"
                    />
                  </div>
                </div>

                {/* ── Section 2: Schedule ── */}
                <div className="space-y-4 px-6 py-5">
                  <SectionHeader label="Schedule" />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Date */}
                    <div className="space-y-1.5">
                      <Label htmlFor="meeting-date">
                        Date <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="meeting-date"
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))}
                        className={cn(formErrors.date && "border-destructive focus-visible:ring-destructive")}
                      />
                      <FieldError message={formErrors.date} />
                    </div>

                    {/* Time range */}
                    <div className="space-y-1.5">
                      <Label>
                        Time <span className="text-destructive">*</span>
                      </Label>
                      <div className="grid grid-cols-[1fr_16px_1fr] items-center gap-1.5">
                        <Input
                          id="meeting-start"
                          type="time"
                          value={form.startTime}
                          onChange={(e) => setForm((c) => ({ ...c, startTime: e.target.value }))}
                          className={cn(
                            (formErrors.startTime || formErrors.timeRange) && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <Input
                          id="meeting-end"
                          type="time"
                          value={form.endTime}
                          onChange={(e) => setForm((c) => ({ ...c, endTime: e.target.value }))}
                          className={cn(
                            (formErrors.endTime || formErrors.timeRange) && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Duration preview / error + timezone */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      {formErrors.timeRange ? (
                        <FieldError message={formErrors.timeRange} />
                      ) : formDuration ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          <Clock3 className="h-3 w-3" />
                          Duration: {formDuration}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{browserTimeZone}</p>
                  </div>
                </div>

                {/* ── Section 3: Meeting setup ── */}
                <div className="space-y-4 px-6 py-5">
                  <SectionHeader label="Meeting setup" />

                  {/* Mode — visual card picker */}
                  <div className="space-y-2">
                    <Label>Mode</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { value: "VIRTUAL",   label: "Virtual",   icon: Video,   desc: "Online only" },
                        { value: "IN_PERSON", label: "In person", icon: MapPin,  desc: "On-site" },
                        { value: "HYBRID",    label: "Hybrid",    icon: Users,   desc: "Both" },
                      ] as const).map(({ value, label, icon: Icon, desc }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setForm((c) => ({ ...c, mode: value }))}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            form.mode === value
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "hover:border-muted-foreground/30 hover:bg-muted/30"
                          )}
                        >
                          <Icon className={cn("h-5 w-5", form.mode === value ? "text-primary" : "text-muted-foreground")} />
                          <span className={cn("text-xs font-semibold", form.mode === value ? "text-primary" : "")}>
                            {label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Calendar sync — visual card picker (hidden for in-person) */}
                  {form.mode !== "IN_PERSON" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label>Calendar sync</Label>
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                          <Sparkles className="h-2.5 w-2.5" />
                          Confirmed, not instant
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { value: "GOOGLE",  label: "Google",  sub: "Calendar + Meet",  color: "bg-[#4285f4]", letter: "G" },
                          { value: "OUTLOOK", label: "Outlook", sub: "Calendar + Teams", color: "bg-[#0078d4]", letter: "O" },
                          { value: "NONE",    label: "No sync", sub: "ProjectHub only",  color: "bg-muted-foreground/30 text-foreground", letter: "P" },
                        ] as const).map(({ value, label, sub, color, letter }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setForm((c) => ({ ...c, externalProvider: value }))}
                            className={cn(
                              "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              form.externalProvider === value
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "hover:border-muted-foreground/30 hover:bg-muted/30"
                            )}
                          >
                            <div className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold text-white",
                              color
                            )}>
                              {letter}
                            </div>
                            <div>
                              <p className={cn(
                                "text-xs font-semibold leading-tight",
                                form.externalProvider === value ? "text-primary" : ""
                              )}>
                                {label}
                              </p>
                              <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{sub}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Location */}
                  <div className="space-y-1.5">
                    <Label htmlFor="meeting-location">
                      {form.mode === "IN_PERSON" ? "Location" : "Location or notes"}
                    </Label>
                    <Input
                      id="meeting-location"
                      value={form.location}
                      onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))}
                      placeholder={
                        form.mode === "IN_PERSON"
                          ? "Room 305, Lab 2, Building A…"
                          : form.mode === "HYBRID"
                            ? "Physical address for in-person attendees"
                            : "Optional — join link auto-generated by provider after sync"
                      }
                    />
                    {form.mode === "VIRTUAL" && form.externalProvider !== "NONE" && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <LinkIcon className="h-3 w-3 shrink-0" />
                        A join link will be generated by{" "}
                        {form.externalProvider === "GOOGLE" ? "Google Meet" : "Microsoft Teams"} after sync.
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Section 4: Participants (new meeting only) ── */}
                {!editingMeeting && (
                  <div className="space-y-4 px-6 py-5">
                    <SectionHeader label="Participants" />

                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Default audience */}
                      <div className="space-y-2.5 rounded-xl border p-4">
                        <div>
                          <p className="text-sm font-semibold">Default audience</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Auto-included from your team when they exist.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          {[
                            { key: "includeDoctor",      label: "Doctor" },
                            { key: "includeTa",          label: "TA (Teaching Assistant)" },
                            { key: "includeTeamMembers", label: "Team members" },
                          ].map(({ key, label }) => (
                            <label
                              key={key}
                              className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/30"
                            >
                              <Checkbox
                                checked={form[key as keyof MeetingFormState] as boolean}
                                onCheckedChange={(v) => setForm((c) => ({ ...c, [key]: Boolean(v) }))}
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Roster picker */}
                      <div className="space-y-2.5 rounded-xl border p-4">
                        <div>
                          <p className="text-sm font-semibold">Extra attendees</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Pick individuals beyond the default audience.
                          </p>
                        </div>
                        {roster.length ? (
                          <div className="max-h-52 space-y-1 overflow-y-auto pr-0.5">
                            {roster.map((person) => (
                              <label
                                key={`${person.id}-${person.primaryRole}`}
                                className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/30"
                              >
                                <Checkbox
                                  checked={form.participantUserIds.includes(person.id)}
                                  onCheckedChange={(v) =>
                                    setForm((c) => ({
                                      ...c,
                                      participantUserIds: v
                                        ? [...new Set([...c.participantUserIds, person.id])]
                                        : c.participantUserIds.filter((i) => i !== person.id),
                                    }))
                                  }
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-xs font-medium">{person.name}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {person.roles.map(formatLabel).join(" / ")}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                            Detailed roster is available for your own team.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* External guests */}
                    <div className="space-y-1.5">
                      <Label htmlFor="external-guests">External guests</Label>
                      <Textarea
                        id="external-guests"
                        value={form.externalGuests}
                        onChange={(e) => setForm((c) => ({ ...c, externalGuests: e.target.value }))}
                        placeholder="Enter email addresses separated by commas, semicolons, or new lines…"
                        className={cn(
                          "min-h-[80px] resize-none",
                          formErrors.externalGuests && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      <div className="flex items-start justify-between gap-3">
                        <FieldError message={formErrors.externalGuests} />
                        <p className="shrink-0 text-xs text-muted-foreground">Guests receive an invitation email</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="border-t bg-background px-6 py-4">
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={() => void handleSaveMeeting()} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingMeeting ? "Save changes" : "Schedule meeting"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── DETAIL SHEET ─────────────────────────────────────────── */}
        <Sheet open={Boolean(selectedMeeting)} onOpenChange={(open) => !open && setSelectedMeeting(null)}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
            {selectedMeeting && (
              <>
                <SheetHeader className="border-b p-5">
                  <div className="flex flex-wrap items-center gap-2 pr-8">
                    <StatusBadge status={selectedMeeting.status} />
                    <SyncBadge meeting={selectedMeeting} />
                  </div>
                  <SheetTitle className="text-xl leading-tight">{selectedMeeting.title}</SheetTitle>
                  <SheetDescription>{formatMeetingRange(selectedMeeting)} · {getMeetingDurationLabel(selectedMeeting)}</SheetDescription>
                </SheetHeader>
                <div className="space-y-4 p-5">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <InfoTile icon={Users} label="Team" value={selectedMeeting.team.name} />
                    <InfoTile icon={Clock3} label="Timezone" value={selectedMeeting.timezone || browserTimeZone} />
                    <InfoTile icon={Video} label="Mode" value={formatLabel(selectedMeeting.mode)} />
                    <InfoTile icon={MapPin} label="Location" value={selectedMeeting.location || (selectedMeeting.joinUrl ? "Online" : "Not set")} />
                  </div>

                  {(selectedMeeting.description || selectedMeeting.agenda) && (
                    <div className="rounded-xl border p-4 space-y-3">
                      {selectedMeeting.description && (
                        <div>
                          <p className="text-sm font-semibold">Description</p>
                          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{selectedMeeting.description}</p>
                        </div>
                      )}
                      {selectedMeeting.description && selectedMeeting.agenda && <Separator />}
                      {selectedMeeting.agenda && (
                        <div>
                          <p className="text-sm font-semibold">Agenda</p>
                          <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-muted-foreground">{selectedMeeting.agenda}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-sm font-semibold">Participants</p>
                      <Badge variant="outline">{selectedMeeting.participants.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {selectedMeeting.participants.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.user?.fullName || p.displayName || p.email || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{formatLabel(p.participantRole)}{p.isExternalGuest ? " · external" : ""}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-xs">{formatLabel(p.responseStatus)}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedMeeting.approvals.length > 0 && (
                    <div className="rounded-xl border p-4">
                      <p className="mb-3 text-sm font-semibold">Approval trail</p>
                      <div className="space-y-2">
                        {selectedMeeting.approvals.map((a) => (
                          <div key={a.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">{a.approver?.fullName || formatLabel(a.approverRole)}</p>
                                <p className="text-xs text-muted-foreground">{formatLabel(a.approverRole)}</p>
                              </div>
                              <Badge variant="outline" className="text-xs">{formatLabel(a.status)}</Badge>
                            </div>
                            {a.proposedStartAt && a.proposedEndAt && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Proposed: {format(safeDate(a.proposedStartAt), "PPP p")} to {format(safeDate(a.proposedEndAt), "p")}
                              </p>
                            )}
                            {a.note && <p className="mt-2 text-muted-foreground">{a.note}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedMeeting.externalSyncError && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
                      <p className="font-medium">Calendar sync issue</p>
                      <p className="mt-1">{selectedMeeting.externalSyncError}</p>
                    </div>
                  )}
                </div>
                <SheetFooter className="border-t p-5">
                  <div className="flex flex-wrap gap-2">{meetingActions(selectedMeeting)}</div>
                </SheetFooter>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* ── RESCHEDULE DIALOG ─────────────────────────────────────── */}
        <Dialog open={Boolean(rescheduleMeeting)} onOpenChange={(open) => !open && !proposalSubmitting && setRescheduleMeeting(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Propose a new time</DialogTitle>
              <DialogDescription>Send a replacement slot and a clear note for the organizer.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="proposal-date">Date</Label>
                <Input id="proposal-date" type="date" value={declinePayload.proposedDate} onChange={(e) => setDeclinePayload((c) => ({ ...c, proposedDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-start">Start</Label>
                <Input id="proposal-start" type="time" value={declinePayload.proposedStartTime} onChange={(e) => setDeclinePayload((c) => ({ ...c, proposedStartTime: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-end">End</Label>
                <Input id="proposal-end" type="time" value={declinePayload.proposedEndTime} onChange={(e) => setDeclinePayload((c) => ({ ...c, proposedEndTime: e.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="proposal-note">Note</Label>
                <Textarea id="proposal-note" value={declinePayload.note} onChange={(e) => setDeclinePayload((c) => ({ ...c, note: e.target.value }))} className="min-h-20" placeholder="Explain why the current time doesn't work." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRescheduleMeeting(null)} disabled={proposalSubmitting}>Close</Button>
              <Button onClick={() => void handleProposalSubmit()} disabled={proposalSubmitting}>
                {proposalSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Send proposal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── CONFIRM ACTION DIALOG ─────────────────────────────────── */}
        <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && !actionSubmitting && setPendingAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{pendingAction?.title}</AlertDialogTitle>
              <AlertDialogDescription>{pendingAction?.description}</AlertDialogDescription>
            </AlertDialogHeader>
            {pendingAction?.details?.length && (
              <div className="space-y-2.5 rounded-xl border bg-muted/20 p-4 text-sm">
                {pendingAction.details.map((d) => (
                  <div key={`${d.label}-${d.value}`} className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className="max-w-[16rem] text-right font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionSubmitting}>Back</AlertDialogCancel>
              <AlertDialogAction
                className={cn(pendingAction?.confirmVariant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
                disabled={actionSubmitting}
                onClick={(e) => { e.preventDefault(); void confirmPendingAction() }}
              >
                {actionSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {actionSubmitting ? "Working..." : pendingAction?.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </TeamRequiredGuard>
  )
}

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────

function SummaryPill({
  label,
  value,
  active,
  tone = "default",
  onClick,
}: {
  label: string
  value: number
  active?: boolean
  tone?: "default" | "warning"
  onClick?: () => void
}) {
  const content = (
    <>
      <span className={cn(
        "text-2xl font-bold leading-none tabular-nums",
        tone === "warning" && value > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
      )}>
        {value}
      </span>
      <span className="mt-1 text-xs text-muted-foreground">{label}</span>
    </>
  )

  const baseClass = "flex flex-col items-start justify-between rounded-xl border bg-card p-3 sm:p-4 transition-all duration-200 min-h-[64px] sm:min-h-[72px]"

  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
        whileTap={{ scale: 0.97 }}
        className={cn(
          baseClass,
          "w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" : "hover:border-primary/40 hover:shadow-sm"
        )}
      >
        {content}
      </motion.button>
    )
  }

  return <div className={baseClass}>{content}</div>
}

function InfoTile({ icon: Icon, label, value }: { icon: typeof CalendarClock; label: string; value: string }) {
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

function MeetingCard({ meeting, actions, onSelect }: { meeting: ApiMeeting; actions: React.ReactNode[]; onSelect: () => void }) {
  const border = statusMeta[meeting.status]?.borderColor ?? "border-l-border"
  const visibleParticipants = meeting.participants.slice(0, 4)
  const extraCount = meeting.participants.length - visibleParticipants.length

  return (
    <motion.div
      whileHover={{ y: -1, transition: { duration: 0.15 } }}
      className={cn(
        "group rounded-xl border border-l-4 bg-card shadow-sm transition-shadow hover:shadow-md",
        border
      )}
    >
      <div className="p-3 sm:p-4 lg:p-5">
        {/* Main content row */}
        <button
          type="button"
          onClick={onSelect}
          className="flex w-full min-w-0 gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg sm:gap-4"
          aria-label={`View details for ${meeting.title}`}
        >
          {/* Date box */}
          <span className={cn(
            "flex shrink-0 flex-col items-center justify-center rounded-xl bg-muted/40 transition-colors group-hover:bg-muted/60",
            "h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16"
          )}>
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:text-[10px]">
              {format(safeDate(meeting.startAt), "EEE")}
            </span>
            <span className="text-xl font-bold leading-none sm:text-2xl lg:text-3xl">
              {format(safeDate(meeting.startAt), "d")}
            </span>
            <span className="hidden text-[9px] text-muted-foreground sm:block">
              {format(safeDate(meeting.startAt), "MMM")}
            </span>
          </span>

          {/* Info */}
          <span className="min-w-0 flex-1 space-y-1.5">
            {/* Badges row */}
            <span className="flex flex-wrap items-center gap-1">
              <StatusBadge status={meeting.status} />
              <span className="hidden sm:contents">
                <SyncBadge meeting={meeting} />
              </span>
              <Badge variant="outline" className="text-xs">{meeting.team.name}</Badge>
            </span>

            {/* Title + time */}
            <span className="block">
              <span className="block truncate font-semibold tracking-tight leading-snug group-hover:text-primary transition-colors">
                {meeting.title}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {format(safeDate(meeting.startAt), "p")} – {format(safeDate(meeting.endAt), "p")}
                <span className="hidden sm:inline"> · {getMeetingDurationLabel(meeting)}</span>
                <span className="hidden sm:inline"> · by {meeting.organizer.fullName}</span>
              </span>
            </span>

            {/* Description — visible on desktop */}
            {meeting.description && (
              <span className="line-clamp-2 hidden text-xs text-muted-foreground lg:block">{meeting.description}</span>
            )}

            {/* Meta row */}
            <span className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />{meeting.participants.length}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />{getMeetingDurationLabel(meeting)}
              </span>
              <span className="inline-flex items-center gap-1">
                {meeting.mode === "VIRTUAL" ? <Video className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                <span className="hidden sm:inline">{meeting.location || formatLabel(meeting.mode)}</span>
              </span>
            </span>
          </span>
        </button>

        {/* Bottom row: participants (sm+) + actions */}
        <div className="mt-3 flex items-center justify-between gap-2">
          {/* Participant chips — hidden on mobile */}
          <div className="hidden flex-wrap items-center gap-1 sm:flex">
            {visibleParticipants.map((p) => (
              <span
                key={p.id}
                className="max-w-[120px] truncate rounded-full border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {p.user?.fullName || p.displayName || p.email || "Guest"}
              </span>
            ))}
            {extraCount > 0 && (
              <span className="rounded-full border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
                +{extraCount} more
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-1 flex-wrap justify-end gap-1.5">
            {/* Details — full-width on mobile */}
            <Button size="sm" variant="outline" className="h-8 flex-1 justify-center px-3 text-xs sm:flex-none" onClick={onSelect}>
              Details <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            {/* Primary action */}
            {actions[0] && <span className="contents">{actions[0]}</span>}
            {/* Secondary actions — desktop only */}
            {actions.length > 1 && (
              <span className="hidden sm:contents">{actions.slice(1, 3)}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function SelectedDayPanel({
  selectedDate,
  meetings,
  onSelect,
  onCreate,
}: {
  selectedDate: Date
  meetings: ApiMeeting[]
  onSelect: (meeting: ApiMeeting) => void
  onCreate?: () => void
}) {
  return (
    <div className="rounded-xl border bg-card/95 overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="font-semibold leading-tight">{format(selectedDate, "EEE, MMM d")}</h3>
          <p className="text-xs text-muted-foreground">{meetings.length} meeting{meetings.length !== 1 ? "s" : ""}</p>
        </div>
        {onCreate && (
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={onCreate}>
            <Plus className="h-3.5 w-3.5" />New
          </Button>
        )}
      </div>
      <div className="p-3 space-y-2">
        {meetings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CalendarClock className="h-7 w-7 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No meetings this day</p>
          </div>
        ) : (
          meetings.map((meeting) => {
            const border = statusMeta[meeting.status]?.borderColor ?? "border-l-border"
            return (
              <button
                key={meeting.id}
                type="button"
                onClick={() => onSelect(meeting)}
                className={cn(
                  "w-full rounded-lg border border-l-4 bg-muted/20 px-3 py-2.5 text-left transition hover:bg-muted/40",
                  border
                )}
              >
                <p className="truncate text-sm font-medium">{meeting.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {format(safeDate(meeting.startAt), "p")} – {format(safeDate(meeting.endAt), "p")}
                </p>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function CalendarMiniPanel({
  month,
  selectedDate,
  days,
  meetingsByDay,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onSelectDay,
}: {
  month: Date
  selectedDate: Date
  days: Date[]
  meetingsByDay: Record<string, ApiMeeting[]>
  onPreviousMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onSelectDay: (day: Date) => void
}) {
  return (
    <div className="rounded-xl border bg-card/95 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{format(month, "MMMM yyyy")}</h3>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onToday}>Today</Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPreviousMonth} aria-label="Previous month">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNextMonth} aria-label="Next month">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center mb-1">
        {["S", "S", "M", "T", "W", "T", "F"].map((d, i) => (
          <div key={i} className="py-1 text-[11px] font-medium text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd")
          const count = meetingsByDay[key]?.length ?? 0
          const selected = isSameDay(day, selectedDate)
          const today = isToday(day)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(day)}
              aria-label={`Select ${format(day, "PPP")}${count ? `, ${count} meeting${count > 1 ? "s" : ""}` : ""}`}
              className={cn(
                "group relative flex h-8 w-full flex-col items-center justify-center rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !isSameMonth(day, month) && "opacity-25",
                today && !selected && "bg-primary/10 text-primary",
                selected ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
              )}
            >
              {format(day, "d")}
              {count > 0 && (
                <span className={cn(
                  "absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full",
                  selected ? "bg-primary-foreground/70" : "bg-primary"
                )} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CalendarFullPanel({
  month,
  selectedDate,
  days,
  meetingsByDay,
  filteredMeetings,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onSelectDay,
  onSelectMeeting,
}: {
  month: Date
  selectedDate: Date
  days: Date[]
  meetingsByDay: Record<string, ApiMeeting[]>
  filteredMeetings: ApiMeeting[]
  onPreviousMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onSelectDay: (day: Date) => void
  onSelectMeeting: (meeting: ApiMeeting) => void
}) {
  const filteredIds = new Set(filteredMeetings.map((m) => m.id))

  return (
    <div className="overflow-hidden rounded-xl border bg-card/95">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold">{format(month, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onPreviousMonth}>
            <ChevronLeft className="h-3.5 w-3.5" />Prev
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onToday}>Today</Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onNextMonth}>
            Next<ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b bg-muted/30 text-center">
        {[["S","Sat"],["S","Sun"],["M","Mon"],["T","Tue"],["W","Wed"],["T","Thu"],["F","Fri"]].map(([short, full], i) => (
          <div key={i} className="py-2.5 text-xs font-semibold tracking-wide text-muted-foreground">
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{full}</span>
          </div>
        ))}
      </div>

      {/* Day cells — entire cell is clickable; meeting pills stop propagation */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd")
          const dayMeetings = (meetingsByDay[key] || []).filter((m) => filteredIds.has(m.id))
          const selected = isSameDay(day, selectedDate)
          const today = isToday(day)
          const inMonth = isSameMonth(day, month)

          return (
            <div
              key={key}
              onClick={() => onSelectDay(day)}
              aria-label={`Select ${format(day, "PPP")}${dayMeetings.length ? `, ${dayMeetings.length} meeting${dayMeetings.length > 1 ? "s" : ""}` : ""}`}
              className={cn(
                "group cursor-pointer border-b border-r p-1 sm:p-1.5 transition-colors",
                "min-h-[80px] sm:min-h-[110px] lg:min-h-[140px]",
                !inMonth && "bg-muted/5",
                today && !selected && "bg-primary/[0.04]",
                selected ? "bg-primary/10" : "hover:bg-muted/20",
              )}
            >
              {/* Date row */}
              <div className="mb-1 flex items-start justify-between gap-0.5">
                <span className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold leading-none transition-colors",
                  today && "bg-primary text-primary-foreground shadow-sm",
                  !today && selected && "ring-2 ring-primary text-primary",
                  !today && !selected && "group-hover:bg-muted/70 text-foreground",
                  !inMonth && "text-muted-foreground/40",
                )}>
                  {format(day, "d")}
                </span>
                {dayMeetings.length > 0 && (
                  <Badge variant="outline" className="hidden h-4 shrink-0 px-1 text-[9px] leading-none sm:inline-flex">
                    {dayMeetings.length}
                  </Badge>
                )}
              </div>

              {/* Meetings */}
              <div className="space-y-px">
                {/* Mobile: colored dots */}
                {dayMeetings.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 px-0.5 sm:hidden">
                    {dayMeetings.slice(0, 5).map((meeting) => (
                      <span key={meeting.id} className="h-1.5 w-1.5 rounded-full bg-primary" />
                    ))}
                  </div>
                )}

                {/* sm+: clickable meeting pills — stop propagation */}
                {dayMeetings.slice(0, 3).map((meeting) => {
                  const borderCls = statusMeta[meeting.status]?.borderColor ?? "border-l-border"
                  return (
                    <button
                      key={meeting.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onSelectMeeting(meeting) }}
                      className={cn(
                        "hidden w-full rounded border-l-2 px-1 py-px text-left text-[10px] leading-snug bg-muted/30 transition-opacity hover:opacity-75 focus-visible:outline-none sm:block",
                        borderCls
                      )}
                    >
                      <span className="block truncate font-medium">{meeting.title}</span>
                      <span className="hidden truncate text-muted-foreground opacity-70 lg:block">
                        {format(safeDate(meeting.startAt), "p")}
                      </span>
                    </button>
                  )
                })}
                {dayMeetings.length > 3 && (
                  <p className="hidden pl-0.5 text-[10px] text-muted-foreground sm:block">
                    +{dayMeetings.length - 3} more
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
