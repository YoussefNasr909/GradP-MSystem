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
  Archive,
  ArrowUpRight,
  Calendar,
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
  GraduationCap,
  LinkIcon,
  Loader2,
  MapPin,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  User,
  Users,
  Video,
  XCircle,
} from "lucide-react"
import { motion, useReducedMotion, AnimatePresence, type Variants } from "framer-motion"
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
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
type MeetingView = "agenda" | "calendar" | "archive"
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

const responseMeta: Record<ApiMeetingResponseStatus, { label: string; icon: typeof Clock3; className: string }> = {
  PENDING: {
    label: "Pending",
    icon: Clock3,
    className: "bg-muted/50 text-muted-foreground border-muted-foreground/20",
  },
  ACCEPTED: {
    label: "Accepted",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  DECLINED: {
    label: "Declined",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  TENTATIVE: {
    label: "Tentative",
    icon: AlertCircle,
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
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
    <Badge variant="outline" className={cn("gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border-none shadow-sm", meta.className)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  )
}

function SyncBadge({ meeting }: { meeting: ApiMeeting }) {
  if (!meeting.externalProvider) return <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border-none bg-muted/20 text-muted-foreground/60">ProjectHub only</Badge>
  if (meeting.externalSyncStatus === "SYNCED") return <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border-none bg-emerald-500/10 text-emerald-600">Synced · {formatLabel(meeting.externalProvider)}</Badge>
  if (meeting.externalSyncStatus === "ERROR") return <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border-none">Sync error</Badge>
  if (meeting.externalSyncStatus === "NOT_CONNECTED") return <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border-none">Connect {formatLabel(meeting.externalProvider)}</Badge>
  return <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border-none">{formatLabel(meeting.externalSyncStatus)}</Badge>
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
      <p className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">{label}</p>
      <div className="h-px flex-1 bg-border/20" />
    </div>
  )
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[32px] border border-dashed border-border/40 bg-muted/5 p-12 text-center backdrop-blur-sm">
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-background text-muted-foreground/20 shadow-sm ring-1 ring-border/30 transition-transform hover:scale-105 duration-500">
        <CalendarClock className="h-10 w-10" />
      </div>
      <div className="space-y-2">
        <h4 className="text-xl font-black tracking-tight text-foreground/80">{title}</h4>
        <p className="mx-auto max-w-[280px] text-sm font-medium text-muted-foreground/40 leading-relaxed">{description}</p>
      </div>
      {action && <div className="mt-8">{action}</div>}
    </div>
  )
}

function MeetingsLoadingState() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-[28px] border border-border/40 bg-background/50 p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:gap-1.5 sm:w-20">
                <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl" />
                <div className="flex flex-col items-center gap-1">
                  <Skeleton className="h-3 w-12 rounded-full" />
                  <Skeleton className="h-3 w-8 rounded-full" />
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-7 w-1/2 rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-20 rounded-full" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-[300px] rounded-3xl" />
        <Skeleton className="h-[200px] rounded-3xl" />
      </div>
    </div>
  )
}

const ITEMS_PER_PAGE = 5

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
  const [currentPage, setCurrentPage] = useState(1)
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
      // Archive view only shows terminal statuses, other views hide them
      const isTerminal = isTerminalStatus(m.status)
      if (view === "archive") {
        if (!isTerminal) return false
      } else {
        if (isTerminal) return false
      }

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
  }, [dateScope, meetings, search, selectedDate, statusFilter, view])

  // Pagination logic
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, dateScope, selectedDate, view])

  const totalPages = Math.ceil(filteredMeetings.length / ITEMS_PER_PAGE)
  const paginatedMeetings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredMeetings.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredMeetings, currentPage])

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
        <Button key="join" asChild size="sm" className="h-9 rounded-xl bg-primary px-5 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.05] active:scale-[0.95] transition-all">
          <a href={meeting.joinUrl} target="_blank" rel="noreferrer">
            <Video className="mr-2 h-3.5 w-3.5" />Join Session
          </a>
        </Button>
      )
      actions.push(
        <Button key="copy" size="sm" variant="outline" className="h-9 rounded-xl border-border/40 bg-background/50 px-4 text-[10px] font-black uppercase tracking-widest text-foreground/80 hover:bg-muted hover:text-foreground transition-all" onClick={(e) => { e.stopPropagation(); void copyMeetingLink(meeting) }}>
          <ClipboardCopy className="mr-2 h-3.5 w-3.5" />Copy Link
        </Button>
      )
    }

    if (meeting.permissions.canApprove) {
      actions.push(
        <Button key="approve" size="sm" className="h-9 rounded-xl bg-emerald-500 px-5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 hover:scale-[1.05] active:scale-[0.95] transition-all" onClick={(e) => { e.stopPropagation(); createAction({
          title: "Approve this meeting?",
          description: "Approving confirms that this time works for you.",
          confirmLabel: "Approve meeting",
          details: actionDetails(meeting),
          action: async () => { const u = await meetingsApi.approve(meeting.id); toast.success("Meeting approved"); return u },
        }) }}>
          <Check className="mr-2 h-3.5 w-3.5" />Approve
        </Button>
      )
      actions.push(
        <Button key="reschedule" size="sm" variant="outline" className="h-9 rounded-xl border-border/40 bg-background/50 px-4 text-[10px] font-black uppercase tracking-widest text-foreground/80 hover:bg-muted hover:text-foreground transition-all" onClick={(e) => {
          e.stopPropagation()
          const start = safeDate(meeting.startAt)
          const end = safeDate(meeting.endAt)
          setDeclinePayload({ proposedDate: toLocalDateValue(start), proposedStartTime: toLocalTimeValue(start), proposedEndTime: toLocalTimeValue(end), note: "" })
          setRescheduleMeeting(meeting)
        }}>
          <RefreshCcw className="mr-2 h-3.5 w-3.5" />Propose New Time
        </Button>
      )
    }

    if (meeting.permissions.canRespond && myParticipant?.responseStatus === "PENDING" && !meeting.permissions.canApprove) {
      const responses: Array<{ label: string; status: ApiMeetingResponseStatus }> = [
        { label: "Accept", status: "ACCEPTED" },
        { label: "Tentative", status: "TENTATIVE" },
        { label: "Decline", status: "DECLINED" },
      ]
      responses.forEach((r) => {
        actions.push(
          <Button key={`respond-${r.status}`} size="sm" variant="outline" className="text-foreground/80 hover:text-foreground hover:bg-muted" onClick={(e) => { e.stopPropagation(); createAction({
            title: `${r.label} this meeting?`,
            description: "Your response updates the attendance summary.",
            confirmLabel: r.label,
            details: actionDetails(meeting),
            action: async () => { const u = await meetingsApi.respond(meeting.id, r.status); toast.success("Response updated"); return u },
          }) }}>
            {r.label}
          </Button>
        )
      })
    }

    if (meeting.permissions.canManage && meeting.status === "CONFIRMED") {
      actions.push(
        <Button key="complete" size="sm" variant="outline" className="h-9 rounded-xl border-border/40 bg-background/50 px-4 text-[10px] font-black uppercase tracking-widest text-foreground/80 hover:bg-emerald-500/10 hover:text-emerald-600 transition-all" onClick={(e) => { e.stopPropagation(); createAction({
          title: "Mark this meeting as completed?",
          description: "Completed meetings stay visible in history.",
          confirmLabel: "Mark completed",
          details: actionDetails(meeting),
          action: async () => { const u = await meetingsApi.complete(meeting.id); toast.success("Meeting marked completed"); return u },
        }) }}>
          <CheckCircle2 className="mr-2 h-3.5 w-3.5" />Complete
        </Button>
      )
    }

    if (meeting.permissions.canManage && isActiveMeeting(meeting)) {
      actions.push(
        <Button key="edit" size="sm" variant="outline" className="h-9 rounded-xl border-border/40 bg-background/50 px-4 text-[10px] font-black uppercase tracking-widest text-foreground/80 hover:bg-muted hover:text-foreground transition-all" onClick={(e) => { e.stopPropagation(); openEditDialog(meeting) }}>
          <Edit3 className="mr-2 h-3.5 w-3.5" />Edit
        </Button>
      )
      actions.push(
        <Button key="cancel" size="sm" variant="outline" className="h-9 rounded-xl border-border/40 bg-background/50 px-4 text-[10px] font-black uppercase tracking-widest text-foreground/80 hover:bg-amber-500/10 hover:text-amber-600 transition-all" onClick={(e) => { e.stopPropagation(); createAction({
          title: "Cancel this meeting?",
          description: "The meeting remains in history as cancelled.",
          confirmLabel: "Cancel meeting",
          confirmVariant: "destructive",
          details: actionDetails(meeting),
          action: async () => { const u = await meetingsApi.cancel(meeting.id); toast.success("Meeting cancelled"); return u },
        }) }}>
          <XCircle className="mr-2 h-3.5 w-3.5" />Cancel
        </Button>
      )
    }

    if (meeting.permissions.canManage) {
      actions.push(
        <Button key="delete" size="sm" variant="outline"
          className="h-9 rounded-xl border-destructive/20 bg-background/50 px-4 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive hover:text-white transition-all shadow-sm"
          onClick={(e) => { e.stopPropagation(); createAction({
            title: "Delete this meeting permanently?",
            description: "This removes the meeting and all records. Cannot be undone.",
            confirmLabel: "Delete meeting",
            confirmVariant: "destructive",
            details: actionDetails(meeting),
            action: async () => { const d = await meetingsApi.delete(meeting.id); toast.success("Meeting deleted"); return d },
          }) }}>
          <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
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
        initial="initial"
        animate="animate"
        variants={{
          initial: { opacity: 0, y: 16 },
          animate: { 
            opacity: 1, 
            y: 0,
            transition: {
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1],
              staggerChildren: 0.1
            }
          }
        }}
        className="space-y-5"
      >
        {/* ── PAGE HEADER ────────────────────────────────────────── */}
        <motion.div 
          variants={{
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 }
          }}
          className="group/header relative overflow-hidden rounded-[32px] border border-border/50 bg-background/50 p-6 shadow-sm backdrop-blur-md transition-all duration-700 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5"
        >
          {/* Animated Background Elements */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-indigo-500/[0.03]" />
          <motion.div
            className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/5 blur-3xl pointer-events-none transition-all duration-1000 group-hover/header:bg-primary/10 group-hover/header:scale-110"
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 45, 0],
              x: [0, 20, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-indigo-500/[0.02] blur-3xl pointer-events-none" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <motion.div 
                className="flex items-center gap-3.5"
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-primary/10 text-primary shadow-inner ring-1 ring-primary/20 transition-transform duration-500 group-hover/header:scale-110 group-hover/header:rotate-3">
                  <CalendarClock className="h-6 w-6" />
                </div>
                <div className="space-y-0.5">
                  <h1 className="text-3xl font-bold tracking-tight text-foreground/90">Meetings</h1>
                  <p className="text-xs font-medium text-muted-foreground/60">
                    {format(new Date(), "EEEE, MMMM do")}
                  </p>
                </div>
              </motion.div>
              <motion.p 
                className="max-w-xl text-[13px] font-normal leading-relaxed text-muted-foreground/70"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 0.1 }}
              >
                Coordinate with your team, manage project milestones, and track every sync in one refined workspace.
              </motion.p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3">

              {canCreate && (
                <Button 
                  className="h-10 rounded-xl bg-primary px-6 text-[11px] font-bold uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.05] hover:shadow-primary/30 active:scale-[0.95]"
                  onClick={openCreateDialog} 
                  disabled={!availableTeams.length}
                >
                  <Plus className="mr-2 h-3.5 w-3.5" /> 
                  New Meeting
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 self-center">
              <SummaryPill 
                label="Today" 
                value={summary.today} 
                active={dateScope === "TODAY"} 
                onClick={() => setDateScope(prev => prev === "TODAY" ? "ALL" : "TODAY")} 
                icon={Calendar} 
              />
              <SummaryPill 
                label="Upcoming" 
                value={summary.upcoming} 
                active={dateScope === "UPCOMING"} 
                onClick={() => setDateScope(prev => prev === "UPCOMING" ? "ALL" : "UPCOMING")} 
                icon={ArrowUpRight} 
              />
              <SummaryPill 
                label="Pending" 
                value={summary.pending} 
                active={statusFilter === "PENDING_APPROVAL"} 
                onClick={() => setStatusFilter(prev => prev === "PENDING_APPROVAL" ? "ALL" : "PENDING_APPROVAL")} 
                icon={Clock3} 
              />
              <SummaryPill 
                label="Attention" 
                value={summary.needsAttention || summary.cancelled} 
                tone="warning" 
                active={statusFilter === "CANCELLED"}
                onClick={() => setStatusFilter(prev => prev === "CANCELLED" ? "ALL" : "CANCELLED")}
                icon={AlertCircle} 
              />
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "group relative overflow-hidden rounded-[28px] border p-0.5 transition-all duration-500",
                summary.nextMeeting 
                  ? "border-primary/20 bg-primary/[0.03] shadow-lg shadow-primary/5" 
                  : "border-border/40 bg-muted/5"
              )}
            >
              {summary.nextMeeting ? (
                <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[26px] bg-background/80 p-5 backdrop-blur-xl">
                  {/* Decorative element */}
                  <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/5 blur-2xl transition-all duration-700 group-hover:bg-primary/10" />
                  
                  <div className="relative space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary"></span>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-primary/80">Next Meeting</span>
                      </div>
                      <StatusBadge status={summary.nextMeeting.status} />
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="line-clamp-1 text-xl font-bold tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary">
                        {summary.nextMeeting.title}
                      </h3>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground/80">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground/40" />
                          {format(safeDate(summary.nextMeeting.startAt), "EEE, MMM d")} · {format(safeDate(summary.nextMeeting.startAt), "p")}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground/80">
                          <Users className="h-3.5 w-3.5 text-muted-foreground/40" />
                          {summary.nextMeeting.team.name}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <div className="flex -space-x-2.5">
                      {summary.nextMeeting.participants.slice(0, 4).map((p, i) => (
                        <div 
                          key={p.id} 
                          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px] font-bold text-muted-foreground/70 ring-1 ring-border/20 transition-all duration-500 group-hover:translate-x-1.5"
                          style={{ zIndex: 10 - i }}
                        >
                          {p.user?.fullName?.charAt(0) || "?"}
                        </div>
                      ))}
                      {summary.nextMeeting.participants.length > 4 && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-[9px] font-bold text-primary ring-1 ring-primary/20" style={{ zIndex: 0 }}>
                          +{summary.nextMeeting.participants.length - 4}
                        </div>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      className="h-9 rounded-xl bg-primary px-4 text-[10px] font-bold uppercase tracking-widest text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.98]"
                      onClick={() => setSelectedMeeting(summary.nextMeeting)}
                    >
                      Join / Details
                      <ChevronRight className="ml-1 h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center py-6 bg-background/40 backdrop-blur-md rounded-[26px]">
                  <div className="h-12 w-12 rounded-xl bg-muted/20 flex items-center justify-center">
                    <CalendarCheck2 className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Schedule Clear</p>
                    <p className="text-[11px] font-medium text-muted-foreground/60 px-6 leading-tight">No meetings on your immediate horizon.</p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>

        <div className="rounded-[32px] border border-border/40 bg-background/50 p-6 md:p-8 backdrop-blur-xl shadow-sm space-y-8">
          {/* ── FILTER BAR ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search schedule..."
                className="h-10 rounded-xl border-border/40 bg-background/50 pl-9 text-xs transition-all focus:ring-primary/20"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "ALL" | ApiMeetingStatus)}>
                <SelectTrigger className="h-10 w-[140px] rounded-xl border-border/40 bg-background/50 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {statusFilterOptions.map((o) => <SelectItem key={o.value} value={o.value} className="rounded-lg">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              
              <Select value={dateScope} onValueChange={(v) => setDateScope(v as MeetingDateScope)}>
                <SelectTrigger className="h-10 w-[130px] rounded-xl border-border/40 bg-background/50 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {dateScopeOptions.map((o) => <SelectItem key={o.value} value={o.value} className="rounded-lg">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            className="h-10 rounded-xl px-4 text-xs font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => { setSearch(""); setStatusFilter("ALL"); setDateScope("ALL") }}
          >
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
        <Tabs value={view} onValueChange={(v) => setView(v as MeetingView)} className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <TabsList className="h-11 p-1 bg-muted/10 rounded-2xl border border-border/40 sm:w-fit overflow-x-auto custom-scrollbar">
              <TabsTrigger value="agenda" className="h-9 px-3 sm:px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary">
                Agenda
              </TabsTrigger>
              <TabsTrigger value="calendar" className="h-9 px-3 sm:px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary">
                Calendar
              </TabsTrigger>
              <TabsTrigger value="archive" className="h-9 px-3 sm:px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary">
                Archive
              </TabsTrigger>
            </TabsList>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/5 border border-border/40">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                {filteredMeetings.length} Updates
              </p>
            </div>
          </div>

          {loading ? (
            <MeetingsLoadingState />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <TabsContent value="agenda" className="mt-0 outline-none">
                  <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                    {/* Meeting list */}
                    <div className="space-y-6 lg:order-first">
                      {filteredMeetings.length === 0 ? (
                        <EmptyState
                          title="No meetings match this view"
                          description="Try a different filter, choose another day, or create a meeting."
                          action={canCreate ? (
                            <Button 
                              size="sm" 
                              onClick={openCreateDialog} 
                              className="h-11 rounded-2xl bg-primary px-6 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30"
                            >
                              <Plus className="mr-2 h-4 w-4" /> Schedule Meeting
                            </Button>
                          ) : undefined}
                        />
                      ) : (
                        <div className="space-y-6">
                          <div className="space-y-4">
                            {paginatedMeetings.map((meeting, index) => (
                              <motion.div
                                key={meeting.id}
                                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: prefersReducedMotion ? 0 : Math.min(index * 0.05, 0.3), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                              >
                                <MeetingCard
                                  meeting={meeting}
                                  actions={meetingActions(meeting)}
                                  onSelect={() => setSelectedMeeting(meeting)}
                                />
                              </motion.div>
                            ))}
                          </div>

                          {/* Pagination */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-background/50 p-4 backdrop-blur-sm">
                              <p className="text-xs font-medium text-muted-foreground/60">
                                Showing <span className="text-foreground/80">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-foreground/80">{Math.min(currentPage * ITEMS_PER_PAGE, filteredMeetings.length)}</span> of <span className="text-foreground/80">{filteredMeetings.length}</span> meetings
                              </p>
                              <Pagination className="mx-0 w-auto">
                                <PaginationContent>
                                  <PaginationItem>
                                    <PaginationPrevious 
                                      className={cn("cursor-pointer rounded-xl hover:bg-primary/5 hover:text-primary transition-colors", currentPage === 1 && "pointer-events-none opacity-50")}
                                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} 
                                    />
                                  </PaginationItem>
                                  
                                  {Array.from({ length: totalPages }).map((_, i) => {
                                    const page = i + 1
                                    // Show first, last, current, and pages around current
                                    if (
                                      page === 1 || 
                                      page === totalPages || 
                                      (page >= currentPage - 1 && page <= currentPage + 1)
                                    ) {
                                      return (
                                        <PaginationItem key={page}>
                                          <PaginationLink
                                            isActive={currentPage === page}
                                            onClick={() => setCurrentPage(page)}
                                            className={cn(
                                              "h-9 w-9 cursor-pointer rounded-xl transition-all",
                                              currentPage === page 
                                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90" 
                                                : "hover:bg-primary/5 hover:text-primary"
                                            )}
                                          >
                                            {page}
                                          </PaginationLink>
                                        </PaginationItem>
                                      )
                                    }
                                    if (page === currentPage - 2 || page === currentPage + 2) {
                                      return (
                                        <PaginationItem key={page}>
                                          <PaginationEllipsis />
                                        </PaginationItem>
                                      )
                                    }
                                    return null
                                  })}

                                  <PaginationItem>
                                    <PaginationNext 
                                      className={cn("cursor-pointer rounded-xl hover:bg-primary/5 hover:text-primary transition-colors", currentPage === totalPages && "pointer-events-none opacity-50")}
                                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} 
                                    />
                                  </PaginationItem>
                                </PaginationContent>
                              </Pagination>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Sidebar */}
                    <aside className="space-y-6 lg:order-last">
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
                    </aside>
                  </div>
                </TabsContent>

                <TabsContent value="calendar" className="mt-0 outline-none">
                  <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
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

                <TabsContent value="archive" className="mt-0 outline-none">
                  <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                    <div className="space-y-6 lg:order-first">
                      {filteredMeetings.length === 0 ? (
                        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[32px] border border-dashed border-border/60 bg-muted/5 p-12 text-center">
                          <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-background text-muted-foreground/30 shadow-sm ring-1 ring-border/50">
                            <Archive className="h-10 w-10" />
                          </div>
                          <h4 className="text-xl font-semibold tracking-tight text-foreground/80">Your archive is empty</h4>
                          <p className="mx-auto mt-2 max-w-[280px] text-sm font-medium text-muted-foreground/50 leading-relaxed">
                            Completed and cancelled meetings will appear here once they&apos;re off your active schedule.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="space-y-4">
                            {paginatedMeetings.map((meeting, index) => (
                              <motion.div
                                key={meeting.id}
                                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: prefersReducedMotion ? 0 : Math.min(index * 0.05, 0.3), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                              >
                                <MeetingCard
                                  meeting={meeting}
                                  actions={meetingActions(meeting)}
                                  onSelect={() => setSelectedMeeting(meeting)}
                                />
                              </motion.div>
                            ))}
                          </div>

                          {/* Pagination */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-background/50 p-4 backdrop-blur-sm">
                              <p className="text-xs font-medium text-muted-foreground/60">
                                Showing <span className="text-foreground/80">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-foreground/80">{Math.min(currentPage * ITEMS_PER_PAGE, filteredMeetings.length)}</span> of <span className="text-foreground/80">{filteredMeetings.length}</span> archived meetings
                              </p>
                              <Pagination className="mx-0 w-auto">
                                <PaginationContent>
                                  <PaginationItem>
                                    <PaginationPrevious 
                                      className={cn("cursor-pointer rounded-xl hover:bg-primary/5 hover:text-primary transition-colors", currentPage === 1 && "pointer-events-none opacity-50")}
                                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} 
                                    />
                                  </PaginationItem>
                                  {Array.from({ length: totalPages }).map((_, i) => (
                                    <PaginationItem key={i + 1}>
                                      <PaginationLink
                                        isActive={currentPage === i + 1}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={cn(
                                          "h-9 w-9 cursor-pointer rounded-xl transition-all",
                                          currentPage === i + 1 
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90" 
                                            : "hover:bg-primary/5 hover:text-primary"
                                        )}
                                      >
                                        {i + 1}
                                      </PaginationLink>
                                    </PaginationItem>
                                  ))}
                                  <PaginationItem>
                                    <PaginationNext 
                                      className={cn("cursor-pointer rounded-xl hover:bg-primary/5 hover:text-primary transition-colors", currentPage === totalPages && "pointer-events-none opacity-50")}
                                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} 
                                    />
                                  </PaginationItem>
                                </PaginationContent>
                              </Pagination>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <aside className="space-y-6 lg:order-last">
                      <div className="rounded-3xl border border-primary/20 bg-primary/[0.02] p-6 text-center shadow-sm backdrop-blur-md">
                        <Archive className="mx-auto mb-4 h-10 w-10 text-primary/40" />
                        <h3 className="text-sm font-semibold tracking-tight text-primary">Meeting Archive</h3>
                        <p className="mt-2 text-xs font-medium leading-relaxed text-muted-foreground/60">
                          Review past decisions, feedback, and history for your teams. Active meetings are hidden here.
                        </p>
                      </div>
                    </aside>
                  </div>
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          )}
        </Tabs>
        </div>

        {/* ── CREATE / EDIT DIALOG ─────────────────────────────────── */}
        <Dialog open={formOpen} onOpenChange={(open) => { if (!submitting) setFormOpen(open) }}>
          <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col overflow-hidden p-0 rounded-[32px] border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl">
            {/* Header */}
            <div className="relative overflow-hidden border-b border-border/40 bg-muted/5 px-5 py-6 sm:px-8 sm:py-6">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent" />
              <DialogHeader className="relative">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner ring-1 ring-primary/20">
                    <CalendarClock className="h-6 w-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                      {editingMeeting ? "Edit Meeting" : "Schedule Meeting"}
                    </DialogTitle>
                    <DialogDescription className="text-[11px] sm:text-xs font-medium text-muted-foreground/60">
                      {editingMeeting
                        ? "Refine the details and coordinate with your team."
                        : "Plan a new sync with your teams and supervisors."}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
            </div>

            {/* Scrollable body — divided into sections */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-2 custom-scrollbar">
              <div className="space-y-8 py-6">

                {/* ── Notices (conflict + past date) ── */}
                {(conflictMeeting || isFormDatePast) && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-3"
                  >
                    {conflictMeeting && (
                      <div className="flex gap-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-700 dark:text-amber-400">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0 text-xs font-medium leading-relaxed">
                          <p className="font-bold uppercase tracking-widest text-[10px]">Schedule Conflict</p>
                          <p className="mt-1 opacity-90">
                            Overlaps with <span className="font-bold">&ldquo;{conflictMeeting.title}&rdquo;</span> ({formatMeetingRange(conflictMeeting)}).
                          </p>
                        </div>
                      </div>
                    )}
                    {isFormDatePast && (
                      <div className="flex gap-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-700 dark:text-amber-400">
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0 text-xs font-medium leading-relaxed">
                          <p className="font-bold uppercase tracking-widest text-[10px]">Past Date Selected</p>
                          <p className="mt-1 opacity-90">This meeting is scheduled in the past. Please ensure this is intentional.</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── Section 1: Core Details ── */}
                <div className="space-y-5">
                  <SectionHeader label="Core Details" />

                  {/* Team Selection (if multiple) */}
                  {!editingMeeting && availableTeams.length > 1 ? (
                    <div className="space-y-2">
                      <Label className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        Target Team <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={form.teamId || undefined}
                        onValueChange={(v) => setForm((c) => ({ ...c, teamId: v, participantUserIds: [] }))}
                      >
                        <SelectTrigger
                          className={cn(
                            "h-12 rounded-2xl border-border/40 bg-background/50 px-4 transition-all focus:ring-primary/20",
                            formErrors.teamId && "border-destructive focus-visible:ring-destructive"
                          )}
                        >
                          <SelectValue placeholder="Select a team…" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {availableTeams.map((t) => (
                            <SelectItem key={t.id} value={t.id} className="rounded-xl">
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError message={formErrors.teamId} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-muted/5 px-4 py-3 text-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background shadow-sm">
                        <Users className="h-4 w-4 text-primary/70" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Team</p>
                        <p className="font-semibold text-foreground/80">{editingMeeting?.team.name || availableTeams[0]?.name || "—"}</p>
                      </div>
                    </div>
                  )}

                  {/* Title */}
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between px-1">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        Meeting Title <span className="text-destructive">*</span>
                      </Label>
                      <span className={cn(
                        "text-[10px] font-bold tabular-nums tracking-widest transition-colors",
                        form.title.length > 90 ? "text-amber-600" : "text-muted-foreground/30"
                      )}>
                        {form.title.length}/100
                      </span>
                    </div>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((c) => ({ ...c, title: e.target.value.slice(0, 100) }))}
                      placeholder="e.g. Project Phase Review, Sprint Planning…"
                      className={cn(
                        "h-12 rounded-2xl border-border/40 bg-background/50 px-4 transition-all focus:ring-primary/20 font-medium",
                        formErrors.title && "border-destructive focus-visible:ring-destructive"
                      )}
                    />
                    <FieldError message={formErrors.title} />
                  </div>

                  {/* Description & Agenda */}
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Description</Label>
                      <Textarea
                        value={form.description}
                        onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                        className="min-h-[80px] rounded-2xl border-border/40 bg-background/50 p-4 transition-all focus:ring-primary/20 resize-none text-sm leading-relaxed"
                        placeholder="Purpose of this meeting…"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Meeting Agenda</Label>
                      <Textarea
                        value={form.agenda}
                        onChange={(e) => setForm((c) => ({ ...c, agenda: e.target.value }))}
                        className="min-h-[80px] rounded-2xl border-border/40 bg-background/50 p-4 transition-all focus:ring-primary/20 resize-none text-sm leading-relaxed"
                        placeholder="Key points to cover…"
                      />
                    </div>
                  </div>
                </div>

                {/* ── Section 2: Scheduling ── */}
                <div className="space-y-5">
                  <SectionHeader label="Scheduling" />

                  <div className="space-y-5">
                    {/* Date */}
                    <div className="space-y-2">
                      <Label className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        Date <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                        <Input
                          type="date"
                          value={form.date}
                          onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))}
                          className={cn(
                            "h-12 rounded-2xl border-border/40 bg-background/50 pl-11 transition-all focus:ring-primary/20",
                            formErrors.date && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                      </div>
                      <FieldError message={formErrors.date} />
                    </div>

                    {/* Time Range */}
                    <div className="space-y-2">
                      <Label className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        Time Slot <span className="text-destructive">*</span>
                      </Label>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="relative">
                          <Clock3 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                          <Input
                            type="time"
                            value={form.startTime}
                            onChange={(e) => setForm((c) => ({ ...c, startTime: e.target.value }))}
                            className={cn(
                              "h-12 rounded-2xl border-border/40 bg-background/50 pl-11 transition-all focus:ring-primary/20",
                              (formErrors.startTime || formErrors.timeRange) && "border-destructive focus-visible:ring-destructive"
                            )}
                          />
                        </div>
                        <div className="relative">
                          <Clock3 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                          <Input
                            type="time"
                            value={form.endTime}
                            onChange={(e) => setForm((c) => ({ ...c, endTime: e.target.value }))}
                            className={cn(
                              "h-12 rounded-2xl border-border/40 bg-background/50 pl-11 transition-all focus:ring-primary/20",
                              (formErrors.endTime || formErrors.timeRange) && "border-destructive focus-visible:ring-destructive"
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Duration & Timezone */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-3">
                      {formErrors.timeRange ? (
                        <FieldError message={formErrors.timeRange} />
                      ) : formDuration ? (
                        <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                          <Sparkles className="h-3 w-3" />
                          Duration: {formDuration}
                        </div>
                      ) : null}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{browserTimeZone}</p>
                  </div>
                </div>

                {/* ── Section 3: Connectivity ── */}
                <div className="space-y-5">
                  <SectionHeader label="Connectivity" />

                  {/* Mode Card Picker */}
                  <div className="space-y-3">
                    <Label className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Meeting Mode</Label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {([
                        { value: "VIRTUAL",   label: "Virtual",   icon: Video,   desc: "Online only" },
                        { value: "IN_PERSON", label: "In-Person", icon: MapPin,  desc: "On-site" },
                        { value: "HYBRID",    label: "Hybrid",    icon: Users,   desc: "Both" },
                      ] as const).map(({ value, label, icon: Icon, desc }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setForm((c) => ({ ...c, mode: value }))}
                          className={cn(
                            "group relative flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-300",
                            form.mode === value
                              ? "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/20 shadow-lg shadow-primary/5"
                              : "border-border/40 bg-background/50 hover:border-primary/20 hover:bg-muted/5"
                          )}
                        >
                          <div className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-500",
                            form.mode === value ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted/10 text-muted-foreground/40 group-hover:text-primary/60"
                          )}>
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="text-left">
                            <p className={cn("text-xs font-bold uppercase tracking-widest transition-colors", form.mode === value ? "text-primary" : "text-foreground/70")}>
                              {label}
                            </p>
                            <p className="mt-0.5 text-[9px] font-medium text-muted-foreground/40">{desc}</p>
                          </div>
                          {form.mode === value && (
                            <motion.div layoutId="mode-indicator" className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                              <Check className="h-2.5 w-2.5" />
                            </motion.div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sync Card Picker */}
                  {form.mode !== "IN_PERSON" && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <Label className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Calendar Integration</Label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {([
                          { value: "GOOGLE",  label: "Google",  sub: "Meet",  color: "bg-[#4285f4]", letter: "G" },
                          { value: "OUTLOOK", label: "Outlook", sub: "Teams", color: "bg-[#0078d4]", letter: "O" },
                          { value: "NONE",    label: "None",    sub: "Hub",   color: "bg-muted-foreground/30 text-foreground", letter: "P" },
                        ] as const).map(({ value, label, sub, color, letter }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setForm((c) => ({ ...c, externalProvider: value }))}
                            className={cn(
                              "group relative flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-300",
                              form.externalProvider === value
                                ? "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/20 shadow-lg shadow-primary/5"
                                : "border-border/40 bg-background/50 hover:border-primary/20 hover:bg-muted/5"
                            )}
                          >
                            <div className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm transition-transform duration-500 group-hover:scale-110",
                              color
                            )}>
                              {letter}
                            </div>
                            <div className="text-left">
                              <p className={cn("text-xs font-bold uppercase tracking-widest transition-colors", form.externalProvider === value ? "text-primary" : "text-foreground/70")}>
                                {label}
                              </p>
                              <p className="mt-0.5 text-[9px] font-medium text-muted-foreground/40">{sub}</p>
                            </div>
                            {form.externalProvider === value && (
                              <motion.div layoutId="sync-indicator" className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                                <Check className="h-2.5 w-2.5" />
                              </motion.div>
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Location Input */}
                  <div className="space-y-2">
                    <Label className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      {form.mode === "IN_PERSON" ? "Physical Location" : "Location or Link"}
                    </Label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded bg-muted/10 text-muted-foreground/40">
                        {form.mode === "IN_PERSON" ? <MapPin className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
                      </div>
                      <Input
                        value={form.location}
                        onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))}
                        placeholder={
                          form.mode === "IN_PERSON"
                            ? "e.g. Lab 302, Building C…"
                            : form.mode === "HYBRID"
                              ? "Physical room + auto-generated link"
                              : "Optional notes for participants…"
                        }
                        className="h-12 rounded-2xl border-border/40 bg-background/50 pl-12 transition-all focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>

                {/* ── Section 4: Audience ── */}
                {!editingMeeting && (
                  <div className="space-y-6 pb-4">
                    <SectionHeader label="Target Audience" />

                    <div className="space-y-6">
                      {/* Default Logic */}
                      <div className="space-y-3">
                        <Label className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Include Groups</Label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          {[
                            { key: "includeDoctor",      label: "Doctor", icon: GraduationCap },
                            { key: "includeTa",          label: "TA",     icon: User },
                            { key: "includeTeamMembers", label: "Team",   icon: Users },
                          ].map(({ key, label, icon: Icon }) => (
                            <label
                              key={key}
                              className={cn(
                                "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 transition-all duration-300",
                                form[key as keyof MeetingFormState]
                                  ? "border-primary/30 bg-primary/[0.02] text-primary shadow-sm"
                                  : "border-border/40 bg-background/50 hover:bg-muted/5"
                              )}
                            >
                              <div className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                                form[key as keyof MeetingFormState] ? "bg-primary/10 text-primary" : "bg-muted/10 text-muted-foreground/30"
                              )}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-xs font-bold leading-none">{label}</span>
                              <Checkbox
                                checked={form[key as keyof MeetingFormState] as boolean}
                                onCheckedChange={(v) => setForm((c) => ({ ...c, [key]: Boolean(v) }))}
                                className="ml-auto rounded-full data-[state=checked]:bg-primary"
                              />
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Manual Picker */}
                      <div className="space-y-3">
                        <Label className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Individual Attendees</Label>
                        <div className={cn(
                          "rounded-2xl border border-border/40 bg-muted/5 p-2 transition-all duration-300",
                          roster.length > 0 ? "h-[180px]" : "h-auto"
                        )}>
                          {roster.length ? (
                            <div className="h-full space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                {roster.map((person) => (
                                  <label
                                    key={`${person.id}-${person.primaryRole}`}
                                    className={cn(
                                      "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-300",
                                      form.participantUserIds.includes(person.id)
                                        ? "border-primary/20 bg-background text-primary shadow-sm"
                                        : "border-transparent hover:bg-background/50"
                                    )}
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
                                      className="rounded-full data-[state=checked]:bg-primary"
                                    />
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground/70 ring-1 ring-border/40">
                                      {person.primaryRole === "DOCTOR" ? <GraduationCap className="h-3.5 w-3.5 text-primary/60" /> : person.primaryRole === "TA" ? <User className="h-3.5 w-3.5 text-primary/60" /> : person.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-xs font-bold leading-tight">{person.name}</div>
                                      <div className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/30 mt-0.5">
                                        {person.roles.map(formatLabel).join(" · ")}
                                      </div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                              <Users className="mb-2 h-6 w-6 text-muted-foreground/20" />
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30 px-6">
                                Team roster available for internal syncs
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* External Guests */}
                    <div className="space-y-2">
                      <Label className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">External Guests</Label>
                      <Textarea
                        value={form.externalGuests}
                        onChange={(e) => setForm((c) => ({ ...c, externalGuests: e.target.value }))}
                        placeholder="Emails separated by commas, new lines…"
                        className={cn(
                          "min-h-[100px] rounded-2xl border-border/40 bg-background/50 p-4 transition-all focus:ring-primary/20 resize-none text-sm",
                          formErrors.externalGuests && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      <div className="flex items-center justify-between px-1">
                        <FieldError message={formErrors.externalGuests} />
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30">Invited via system email</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border/40 bg-muted/5 px-5 sm:px-8 py-5">
              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => setFormOpen(false)} 
                  disabled={submitting}
                  className="h-12 flex-1 rounded-2xl border-border/40 bg-background font-bold text-xs uppercase tracking-widest transition-all hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => void handleSaveMeeting()} 
                  disabled={submitting}
                  className="h-12 flex-[2] rounded-2xl bg-primary font-bold text-[10px] sm:text-xs uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
                  {editingMeeting ? "Update Schedule" : "Confirm & Schedule"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── DETAIL SHEET ─────────────────────────────────────────── */}
        <Sheet open={Boolean(selectedMeeting)} onOpenChange={(open) => !open && setSelectedMeeting(null)}>
          <SheetContent className="flex h-full w-full flex-col p-0 sm:max-w-xl rounded-l-[32px] border-l border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl">
            {selectedMeeting && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col h-full overflow-hidden"
              >
                {/* Header Section */}
                <div className="relative overflow-hidden border-b border-border/40 bg-muted/5 px-5 py-6 sm:px-8 sm:py-8">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent" />
                  <div className="relative space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge status={selectedMeeting.status} />
                      <SyncBadge meeting={selectedMeeting} />
                      {selectedMeeting.mode === "VIRTUAL" && (
                        <Badge variant="outline" className="gap-1.5 bg-primary/5 text-primary border-primary/20">
                          <Video className="h-3 w-3" /> Virtual
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-1.5">
                      <SheetTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground/90">
                        {selectedMeeting.title}
                      </SheetTitle>
                      <SheetDescription className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground/60">
                        <Calendar className="h-4 w-4" />
                        {formatMeetingRange(selectedMeeting)}
                      </SheetDescription>
                    </div>
                  </div>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 custom-scrollbar">
                  <div className="space-y-8">
                    {/* Quick Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <DetailCard icon={Users} label="Team" value={selectedMeeting.team.name} />
                      <DetailCard icon={Clock3} label="Duration" value={getMeetingDurationLabel(selectedMeeting)} />
                      <DetailCard icon={MapPin} label="Location" value={selectedMeeting.location || (selectedMeeting.joinUrl ? "Online" : "Not set")} />
                      <DetailCard icon={ShieldAlert} label="Organizer" value={selectedMeeting.organizer.fullName} />
                    </div>

                    {/* Description & Agenda */}
                    {(selectedMeeting.description || selectedMeeting.agenda) && (
                      <div className="space-y-6">
                        {selectedMeeting.description && (
                          <div className="space-y-3">
                            <SectionHeader label="Description" />
                            <div className="text-sm font-medium leading-relaxed text-foreground/70 whitespace-pre-line">
                              {selectedMeeting.description}
                            </div>
                          </div>
                        )}
                        {selectedMeeting.agenda && (
                          <div className="space-y-3">
                            <SectionHeader label="Agenda" />
                            <div className="text-sm font-medium leading-relaxed text-foreground/70 whitespace-pre-line">
                              {selectedMeeting.agenda}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Participants */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <SectionHeader label="Participants" />
                        <Badge variant="outline" className="rounded-full bg-muted/10 px-2.5 py-0.5 text-[10px] font-bold">
                          {selectedMeeting.participants.length} Total
                        </Badge>
                      </div>
                      <div className="grid gap-2">
                        {selectedMeeting.participants.map((p) => {
                          const meta = responseMeta[p.responseStatus]
                          const Icon = meta.icon
                          return (
                            <div key={p.id} className="group flex items-center justify-between gap-4 rounded-2xl border border-border/40 bg-background/50 p-3.5 transition-all hover:border-primary/20 hover:bg-background hover:shadow-sm">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground/70 ring-1 ring-border/40">
                                  {p.user?.fullName?.charAt(0) || "?"}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground/80">{p.user?.fullName || p.displayName || p.email}</p>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                                    {formatLabel(p.participantRole)}{p.isExternalGuest ? " · Guest" : ""}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="outline" className={cn("gap-1.5 h-7 px-2.5 rounded-full border shadow-none", meta.className)}>
                                <Icon className="h-3 w-3" />
                                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">{meta.label}</span>
                              </Badge>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Approval Trail */}
                    {selectedMeeting.approvals.length > 0 && (
                      <div className="space-y-4">
                        <SectionHeader label="Approval Status" />
                        <div className="relative space-y-4 before:absolute before:left-6 before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-border/60">
                          {selectedMeeting.approvals.map((a) => (
                            <div key={a.id} className="relative flex items-start gap-4 pl-10">
                              <div className={cn(
                                "absolute left-4 top-1.5 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full ring-4 ring-background",
                                a.status === "APPROVED" ? "bg-emerald-500" : a.status === "DECLINED" ? "bg-destructive" : "bg-amber-500"
                              )}>
                                {a.status === "APPROVED" ? <Check className="h-2.5 w-2.5 text-white" /> : a.status === "DECLINED" ? <XCircle className="h-2.5 w-2.5 text-white" /> : <Clock3 className="h-2.5 w-2.5 text-white" />}
                              </div>
                              <div className="flex-1 space-y-1.5 rounded-2xl border border-border/40 bg-muted/5 p-4">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-bold text-foreground/80">{a.approver?.fullName || formatLabel(a.approverRole)}</p>
                                  <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest">{formatLabel(a.status)}</Badge>
                                </div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{formatLabel(a.approverRole)}</p>
                                {a.proposedStartAt && (
                                  <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-amber-600 bg-amber-500/5 rounded-lg p-2 border border-amber-500/10">
                                    <ArrowUpRight className="h-3 w-3" />
                                    Proposed new time: {format(safeDate(a.proposedStartAt), "MMM d, p")}
                                  </div>
                                )}
                                {a.note && <p className="mt-2 text-xs italic text-muted-foreground/60">&ldquo;{a.note}&rdquo;</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer - Actions */}
                <div className="border-t border-border/40 bg-muted/5 px-5 py-6 sm:px-8">
                  <div className="flex flex-wrap gap-3 justify-end sm:justify-start">
                    {meetingActions(selectedMeeting)}
                  </div>
                </div>
              </motion.div>
            )}
          </SheetContent>
        </Sheet>

        {/* ── RESCHEDULE DIALOG ─────────────────────────────────────── */}
        <Dialog open={Boolean(rescheduleMeeting)} onOpenChange={(open) => !open && !proposalSubmitting && setRescheduleMeeting(null)}>
          <DialogContent className="flex max-h-[92vh] max-w-xl flex-col overflow-hidden p-0 rounded-[32px] border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl">
            {/* Header */}
            <div className="relative overflow-hidden border-b border-border/40 bg-muted/5 px-8 py-6">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] via-transparent to-transparent" />
              <DialogHeader className="relative">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 shadow-inner ring-1 ring-amber-500/20">
                    <CalendarClock className="h-6 w-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-bold tracking-tight">Propose New Time</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-muted-foreground/60">
                      Send a replacement slot and a clear note for the organizer.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-8 py-2 custom-scrollbar">
              <div className="space-y-8 py-6">
                {/* Current Time Reference */}
                {rescheduleMeeting && (
                  <div className="rounded-2xl border border-border/40 bg-muted/5 p-4 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Current Schedule</p>
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/70">
                      <Clock3 className="h-4 w-4 text-muted-foreground/40" />
                      {formatMeetingRange(rescheduleMeeting)}
                    </div>
                  </div>
                )}

                <div className="space-y-5">
                  <SectionHeader label="New Proposal" />
                  
                  <div className="space-y-2">
                    <Label className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                      <Input
                        type="date"
                        value={declinePayload.proposedDate}
                        onChange={(e) => setDeclinePayload((c) => ({ ...c, proposedDate: e.target.value }))}
                        className="h-12 rounded-2xl border-border/40 bg-background/50 pl-11 transition-all focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Start Time</Label>
                      <div className="relative">
                        <Clock3 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                        <Input
                          type="time"
                          value={declinePayload.proposedStartTime}
                          onChange={(e) => setDeclinePayload((c) => ({ ...c, proposedStartTime: e.target.value }))}
                          className="h-12 rounded-2xl border-border/40 bg-background/50 pl-11 transition-all focus:ring-primary/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">End Time</Label>
                      <div className="relative">
                        <Clock3 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                        <Input
                          type="time"
                          value={declinePayload.proposedEndTime}
                          onChange={(e) => setDeclinePayload((c) => ({ ...c, proposedEndTime: e.target.value }))}
                          className="h-12 rounded-2xl border-border/40 bg-background/50 pl-11 transition-all focus:ring-primary/20"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Note to Organizer</Label>
                    <Textarea
                      value={declinePayload.note}
                      onChange={(e) => setDeclinePayload((c) => ({ ...c, note: e.target.value }))}
                      placeholder="Explain why the current time doesn't work..."
                      className="min-h-[120px] rounded-2xl border-border/40 bg-background/50 p-4 transition-all focus:ring-primary/20 resize-none text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border/40 bg-muted/5 px-8 py-5">
              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => setRescheduleMeeting(null)} 
                  disabled={proposalSubmitting}
                  className="h-12 flex-1 rounded-2xl border-border/40 bg-background font-bold text-xs uppercase tracking-widest transition-all hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => void handleProposalSubmit()} 
                  disabled={proposalSubmitting}
                  className="h-12 flex-[2] rounded-2xl bg-primary font-bold text-xs uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:bg-primary/90"
                >
                  {proposalSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                  Send Proposal
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── CONFIRM ACTION DIALOG ─────────────────────────────────── */}
        <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && !actionSubmitting && setPendingAction(null)}>
          <AlertDialogContent className="rounded-[32px] border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl p-0 overflow-hidden">
            <div className="relative overflow-hidden border-b border-border/40 bg-muted/5 px-8 py-6">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent" />
              <AlertDialogHeader className="relative">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner ring-1 ring-primary/20">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <AlertDialogTitle className="text-xl font-bold tracking-tight">{pendingAction?.title}</AlertDialogTitle>
                    <AlertDialogDescription className="text-xs font-medium text-muted-foreground/60">
                      {pendingAction?.description}
                    </AlertDialogDescription>
                  </div>
                </div>
              </AlertDialogHeader>
            </div>

            <div className="px-8 py-6">
              {pendingAction?.details?.length && (
                <div className="space-y-3 rounded-2xl border border-border/40 bg-muted/5 p-5 text-sm">
                  {pendingAction.details.map((d) => (
                    <div key={`${d.label}-${d.value}`} className="flex items-start justify-between gap-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{d.label}</span>
                      <span className="max-w-[16rem] text-right font-semibold text-foreground/80">{d.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <AlertDialogFooter className="bg-muted/5 px-8 py-5 border-t border-border/40">
              <div className="flex w-full gap-4">
                <AlertDialogCancel 
                  disabled={actionSubmitting}
                  className="h-12 flex-1 rounded-2xl border-border/40 bg-background font-bold text-xs uppercase tracking-widest transition-all hover:bg-muted m-0"
                >
                  Back
                </AlertDialogCancel>
                <AlertDialogAction
                  className={cn(
                    "h-12 flex-[2] rounded-2xl font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] m-0",
                    pendingAction?.confirmVariant === "destructive" 
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xl shadow-destructive/20" 
                      : "bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90"
                  )}
                  disabled={actionSubmitting}
                  onClick={(e) => { e.preventDefault(); void confirmPendingAction() }}
                >
                  {actionSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {actionSubmitting ? "Working..." : pendingAction?.confirmLabel}
                </AlertDialogAction>
              </div>
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
  icon: Icon,
}: {
  label: string
  value: number
  active?: boolean
  tone?: "default" | "warning"
  onClick?: () => void
  icon?: typeof CalendarClock
}) {
  const content = (
    <div className="flex w-full items-center gap-3">
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-500",
        active 
          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 rotate-3" 
          : "bg-muted/10 text-muted-foreground/40 group-hover:bg-primary/10 group-hover:text-primary/60 group-hover:rotate-6"
      )}>
        {Icon && <Icon className="h-4 w-4" />}
      </div>
      <div className="flex flex-col items-start min-w-0">
        <span className={cn(
          "text-xl font-black leading-none tabular-nums tracking-tight transition-colors duration-300",
          active ? "text-primary" : tone === "warning" && value > 0 ? "text-amber-600" : "text-foreground/90"
        )}>
          {value}
        </span>
        <span className={cn(
          "mt-1 truncate text-[9px] font-black uppercase tracking-widest transition-colors duration-300",
          active ? "text-primary/70" : "text-muted-foreground/50 group-hover:text-muted-foreground/70"
        )}>
          {label}
        </span>
      </div>
    </div>
  )

  const baseClass = "flex flex-col items-start justify-center rounded-[20px] border bg-background/40 px-3.5 py-3 transition-all duration-500 min-h-[68px] group overflow-hidden relative"

  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ y: -3, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
        whileTap={{ scale: 0.97 }}
        className={cn(
          baseClass,
          "w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
          active 
            ? "border-primary/30 bg-background/80 shadow-xl shadow-primary/5 ring-1 ring-primary/20" 
            : "border-border/40 hover:border-primary/20 hover:bg-background/80 hover:shadow-lg hover:shadow-primary/5"
        )}
      >
        {active && (
          <motion.div 
            layoutId="active-glow-pill"
            className="absolute inset-0 bg-gradient-to-br from-primary/[0.1] via-transparent to-transparent opacity-100"
          />
        )}
        <div className="relative z-10 w-full">{content}</div>
      </motion.button>
    )
  }

  return <div className={baseClass}>{content}</div>
}

function DetailCard({ icon: Icon, label, value }: { icon: typeof CalendarClock; label: string; value: string }) {
  return (
    <div className="group rounded-2xl border border-border/40 bg-background/50 p-4 transition-all hover:border-primary/20 hover:bg-background hover:shadow-md">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 group-hover:text-primary/70 transition-colors">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-foreground/90 tracking-tight">{value}</p>
    </div>
  )
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
  const visibleParticipants = meeting.participants.slice(0, 4)
  const extraCount = meeting.participants.length - visibleParticipants.length

  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      onClick={onSelect}
      className={cn(
        "group relative overflow-hidden rounded-[24px] bg-background/40 p-5 transition-all hover:bg-background hover:shadow-lg hover:shadow-primary/5 cursor-pointer",
        meeting.status === "PENDING_APPROVAL" && "bg-amber-500/[0.02]"
      )}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* Date visualization */}
        <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:gap-1 sm:w-20">
          <div className="flex flex-col items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-primary/5 text-primary ring-1 ring-primary/20 shadow-inner">
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">
              {format(safeDate(meeting.startAt), "MMM")}
            </span>
            <span className="text-xl font-bold tracking-tight leading-none">
              {format(safeDate(meeting.startAt), "d")}
            </span>
          </div>
          <div className="flex flex-col sm:items-center">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
              {format(safeDate(meeting.startAt), "EEEE")}
            </span>
            <span className="text-[10px] font-bold text-primary/70">
              {format(safeDate(meeting.startAt), "p")}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={meeting.status} />
              <Badge variant="outline" className="rounded-full border-none bg-muted/40 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                {meeting.team.name}
              </Badge>
            </div>
            
            <h3 className="text-lg font-bold tracking-tight text-foreground transition-colors leading-tight group-hover:text-primary">
              {meeting.title}
            </h3>

            {meeting.description && (
              <p className="line-clamp-1 text-xs font-medium leading-relaxed text-muted-foreground/60">
                {meeting.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1.5">
                {visibleParticipants.map((p, i) => {
                  const initial = (p.user?.fullName || p.displayName || p.email || "?").charAt(0).toUpperCase()
                  return (
                    <div key={p.userId || i} className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[8px] font-bold text-primary ring-2 ring-background">
                      {initial}
                    </div>
                  )
                })}
                {extraCount > 0 && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted/50 text-[8px] font-bold text-muted-foreground ring-2 ring-background">
                    +{extraCount}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock3 className="h-3 w-3" />
              <span>{getMeetingDurationLabel(meeting)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {meeting.mode === "VIRTUAL" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
              <span>{meeting.location || formatLabel(meeting.mode)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-row sm:flex-col items-center justify-end gap-2">
          {actions.length > 0 && (
            <div className="flex flex-row sm:flex-col gap-2">
              {actions.slice(0, 2).map((action, i) => (
                <div key={i} className="contents">{action}</div>
              ))}
            </div>
          )}
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 w-8 rounded-lg border border-border/40 bg-background/50 transition-all hover:bg-primary/5 hover:text-primary hover:border-primary/20" 
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
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
    <div className="overflow-hidden rounded-3xl transition-all duration-500 hover:bg-white/5">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-white/[0.02]">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold tracking-tight text-foreground/80 uppercase tracking-wider">{format(selectedDate, "EEE, MMM d")}</h3>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">
            {meetings.length} meeting{meetings.length !== 1 ? "s" : ""}
          </p>
        </div>
        {onCreate && (
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-9 gap-2 rounded-xl px-3 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/5 transition-all" 
            onClick={onCreate}
          >
            <Plus className="h-4 w-4" /> New
          </Button>
        )}
      </div>
      <div className="p-4 space-y-2">
        {meetings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center opacity-20">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/20 text-muted-foreground/30 shadow-inner">
              <CalendarClock className="h-6 w-6" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest">No meetings</p>
          </div>
        ) : (
          meetings.map((meeting) => {
            const border = statusMeta[meeting.status]?.borderColor ?? "border-l-border"
            return (
              <motion.button
                key={meeting.id}
                whileHover={{ x: 2, backgroundColor: "rgba(var(--primary), 0.03)" }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => onSelect(meeting)}
                className={cn(
                  "group w-full rounded-xl border border-l-4 bg-white/[0.01] px-4 py-3 text-left transition-all hover:shadow-md",
                  border
                )}
              >
                <p className="truncate text-xs font-bold tracking-tight text-foreground/70 group-hover:text-primary transition-colors">{meeting.title}</p>
                <div className="mt-1.5 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/40">
                  <div className="flex h-4.5 w-4.5 items-center justify-center rounded-lg bg-muted/30 text-muted-foreground/50">
                    <Clock3 className="h-3 w-3" />
                  </div>
                  {format(safeDate(meeting.startAt), "p")} – {format(safeDate(meeting.endAt), "p")}
                </div>
              </motion.button>
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
    <div className="p-5 transition-all duration-500 rounded-3xl hover:bg-white/5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-sm font-bold tracking-tight text-foreground/80 uppercase tracking-wider">{format(month, "MMMM yyyy")}</h3>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 hover:text-primary hover:bg-primary/5" onClick={onToday}>Today</Button>
          <div className="flex items-center rounded-lg bg-white/5 border border-white/5 overflow-hidden">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none hover:bg-primary/10 hover:text-primary" onClick={onPreviousMonth} aria-label="Previous month">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none hover:bg-primary/10 hover:text-primary" onClick={onNextMonth} aria-label="Next month">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center mb-2">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/20">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd")
          const count = meetingsByDay[key]?.length ?? 0
          const selected = isSameDay(day, selectedDate)
          const today = isToday(day)
          const inMonth = isSameMonth(day, month)
          return (
              <motion.button
                key={key}
                whileHover={{ scale: 1.05, zIndex: 10 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => onSelectDay(day)}
                className={cn(
                  "group relative flex h-9 w-full flex-col items-center justify-center rounded-xl text-[10px] font-black transition-all duration-300",
                  !inMonth && "opacity-20",
                  today && !selected && "bg-primary/10 text-primary ring-1 ring-primary/20",
                  selected ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 z-10" : "text-foreground hover:bg-white/10 hover:shadow-md",
                  count > 0 && !selected && "text-primary shadow-[inset_0_0_8px_rgba(var(--primary),0.03)]"
                )}
              >
                {format(day, "d")}
              {count > 0 && (
                <span className={cn(
                  "absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full transition-all duration-300 group-hover:scale-125",
                  selected ? "bg-primary-foreground/70" : "bg-primary"
                )} />
              )}
            </motion.button>
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

  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.005
      }
    }
  }

  const item: Variants = {
    hidden: { opacity: 0, scale: 0.98 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" } }
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-background/20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-white/[0.02]">
        <h2 className="text-lg font-bold tracking-tight text-foreground/80">{format(month, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-white/5 border border-white/5 overflow-hidden">
            <Button variant="ghost" size="sm" className="h-9 rounded-none px-3 text-[11px] font-semibold hover:bg-primary/5 hover:text-primary transition-all" onClick={onPreviousMonth}>
              <ChevronLeft className="mr-1 h-4 w-4" />Prev
            </Button>
            <Separator orientation="vertical" className="h-6 bg-white/10" />
            <Button variant="ghost" size="sm" className="h-9 rounded-none px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/30 hover:text-primary hover:bg-primary/5 transition-all" onClick={onToday}>Today</Button>
            <Separator orientation="vertical" className="h-6 bg-white/10" />
            <Button variant="ghost" size="sm" className="h-9 rounded-none px-3 text-[11px] font-semibold hover:bg-primary/5 hover:text-primary transition-all" onClick={onNextMonth}>
              Next<ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-white/5 bg-white/[0.01] text-center">
        {[["S","Sat"],["S","Sun"],["M","Mon"],["T","Tue"],["W","Wed"],["T","Thu"],["F","Fri"]].map(([short, full], i) => (
          <div key={i} className="py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/20">
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{full}</span>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-7"
      >
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd")
          const allDayMeetings = meetingsByDay[key] || []
          const visibleDayMeetings = allDayMeetings.filter((m) => filteredIds.has(m.id))
          const selected = isSameDay(day, selectedDate)
          const today = isToday(day)
          const inMonth = isSameMonth(day, month)

          return (
            <motion.div
              key={key}
              variants={item}
              onClick={() => onSelectDay(day)}
              className={cn(
                "group cursor-pointer border-b border-r border-white/5 p-1.5 sm:p-2.5 transition-all duration-300",
                "min-h-[90px] sm:min-h-[120px] lg:min-h-[150px]",
                !inMonth && "bg-white/[0.01] opacity-20",
                today && !selected && "bg-primary/[0.01]",
                selected ? "bg-primary/[0.03] z-10" : "hover:bg-primary/[0.01] hover:z-10",
              )}
            >
              {/* Date row */}
              <div className="mb-2 flex items-start justify-between">
                <div className="relative">
                  <span className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black transition-all duration-300",
                    today && "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105",
                    !today && selected && "bg-primary/10 text-primary ring-1 ring-primary/20",
                    !today && !selected && "text-foreground group-hover:text-foreground group-hover:scale-105",
                    !inMonth && "opacity-20",
                  )}>
                    {format(day, "d")}
                  </span>
                  {allDayMeetings.length > 0 && !today && (
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={cn(
                        "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-background shadow-sm transition-all duration-300 group-hover:scale-125",
                        visibleDayMeetings.length > 0 ? "bg-primary" : "bg-primary/20"
                      )} 
                    />
                  )}
                </div>
                {allDayMeetings.length > 0 && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "hidden h-4.5 items-center rounded-lg border-none px-1.5 text-[9px] font-black transition-all duration-300 sm:inline-flex",
                      selected ? "bg-primary/20 text-primary-foreground" : "bg-primary/10 text-primary group-hover:bg-primary/20"
                    )}
                  >
                    {allDayMeetings.length}
                  </Badge>
                )}
              </div>

              {/* Meetings */}
              <div className="space-y-1">
                {/* Mobile: colored dots */}
                {allDayMeetings.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-0.5 sm:hidden">
                    {allDayMeetings.slice(0, 3).map((meeting) => (
                      <span key={meeting.id} className={cn("h-1.5 w-1.5 rounded-full", filteredIds.has(meeting.id) ? "bg-primary/40" : "bg-primary/5")} />
                    ))}
                  </div>
                )}

                {/* sm+: meeting pills */}
                {visibleDayMeetings.slice(0, 2).map((meeting) => {
                  const borderCls = statusMeta[meeting.status]?.borderColor ?? "border-l-border"
                  return (
                    <motion.button
                      key={meeting.id}
                      type="button"
                      whileHover={{ x: 1, backgroundColor: "rgba(var(--primary), 0.05)" }}
                      onClick={(e) => { e.stopPropagation(); onSelectMeeting(meeting) }}
                      className={cn(
                        "hidden w-full rounded-lg border-l-2 px-2 py-1.5 text-left transition-all sm:block",
                        "bg-primary/[0.04] backdrop-blur-sm",
                        borderCls
                      )}
                    >
                      <span className="block truncate text-[9px] font-black tracking-tight leading-tight group-hover:text-primary transition-colors">{meeting.title}</span>
                      <span className="hidden truncate text-[8px] font-bold uppercase tracking-wider text-primary/70 lg:block mt-0.5">
                        {format(safeDate(meeting.startAt), "p")}
                      </span>
                    </motion.button>
                  )
                })}
                {visibleDayMeetings.length < allDayMeetings.length && (
                  <p className="hidden pl-1 text-[8px] font-black uppercase tracking-widest text-primary/40 sm:block group-hover:text-primary/60 transition-colors">
                    {allDayMeetings.length - visibleDayMeetings.length} filtered
                  </p>
                )}
                {visibleDayMeetings.length > 2 && (
                  <p className="hidden pl-1 text-[8px] font-black uppercase tracking-widest text-primary/60 sm:block group-hover:text-primary transition-colors">
                    +{visibleDayMeetings.length - 2} more meetings
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
