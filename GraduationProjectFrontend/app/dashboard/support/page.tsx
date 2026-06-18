"use client"

import type React from "react"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  CircleDot,
  Clock,
  Clock3,
  FileText,
  History,
  Inbox,
  Loader2,
  MessageCircle,
  MessageSquare,
  Plus,
  Paperclip,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  TimerReset,
  X,
  UserPlus,
  Users,
  UserCheck,
  AlertCircle,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { API_BASE_URL, ApiRequestError } from "@/lib/api/http"
import { supportApi } from "@/lib/api/support"
import type {
  ApiSupportSummary,
  ApiSupportSavedReply,
  ApiSupportTicketActivity,
  ApiSupportTicketCategory,
  ApiSupportTicketDetail,
  ApiSupportTicketMessage,
  ApiSupportTicketMessageVisibility,
  ApiSupportTicketPriority,
  ApiSupportTicketStatus,
  ApiSupportTicketSummary,
  ApiSupportUser,
  Paginated,
} from "@/lib/api/types"
import { getSocket } from "@/lib/socket"
import { useAuthStore } from "@/lib/stores/auth-store"
import { cn } from "@/lib/utils"

type TicketFilterValue<T extends string> = "ALL" | T
type AssignedFilter = "ALL" | "me" | "unassigned" | string
type SlaFilter = "ALL" | "overdue" | "dueSoon" | "ok"
type SourceFilter = "ALL" | "FORM" | "CHAT"
type QueueView = "active" | "mine" | "unassigned" | "overdue" | "archive"

type TicketFilters = {
  search: string
  status: TicketFilterValue<ApiSupportTicketStatus>
  priority: TicketFilterValue<ApiSupportTicketPriority>
  category: TicketFilterValue<ApiSupportTicketCategory>
  assignedTo: AssignedFilter
  sla: SlaFilter
  source: SourceFilter
  tags: string
}

type Option<T extends string> = {
  value: T
  label: string
  description?: string
}

const STATUS_OPTIONS: Array<Option<ApiSupportTicketStatus>> = [
  { value: "OPEN", label: "New" },
  { value: "IN_PROGRESS", label: "Working" },
  { value: "WAITING_ON_USER", label: "Waiting for requester" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
]

const PRIORITY_OPTIONS: Array<Option<ApiSupportTicketPriority>> = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
]

const CATEGORY_OPTIONS: Array<Option<ApiSupportTicketCategory>> = [
  { value: "BUG", label: "Bug", description: "Something is broken" },
  { value: "FEATURE", label: "Feature", description: "New capability request" },
  { value: "QUESTION", label: "Question", description: "How-to or clarification" },
  { value: "ACCOUNT", label: "Account", description: "Login, profile, access" },
  { value: "TECHNICAL", label: "Technical", description: "System or integration issue" },
  { value: "GENERAL", label: "General", description: "Anything else" },
]

const STATUS_META: Record<ApiSupportTicketStatus, { label: string; className: string; icon: React.ElementType }> = {
  OPEN: { label: "New", className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300", icon: CircleDot },
  IN_PROGRESS: { label: "Working", className: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300", icon: Loader2 },
  WAITING_ON_USER: { label: "Waiting for requester", className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300", icon: Clock3 },
  RESOLVED: { label: "Resolved", className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300", icon: CheckCircle2 },
  CLOSED: { label: "Closed", className: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300", icon: ShieldCheck },
}

const PRIORITY_META: Record<ApiSupportTicketPriority, { label: string; className: string }> = {
  LOW: { label: "Low", className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" },
  MEDIUM: { label: "Medium", className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300" },
  HIGH: { label: "High", className: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300" },
  URGENT: { label: "Urgent", className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" },
}

const ACTIVITY_LABELS: Record<ApiSupportTicketActivity["type"], string> = {
  CREATED: "Ticket created",
  MESSAGE_ADDED: "Public reply added",
  INTERNAL_NOTE_ADDED: "Internal note added",
  STATUS_CHANGED: "Status changed",
  PRIORITY_CHANGED: "Priority changed",
  CATEGORY_CHANGED: "Category changed",
  ASSIGNED: "Assignment changed",
  REOPENED: "Ticket reopened",
}

const SUPPORT_UPLOAD_LIMIT = "Up to 5 files, 10MB each"

const QUEUE_STATUS_META: Record<ApiSupportTicketStatus, { label: string; className: string }> = {
  OPEN: { label: "New", className: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
  IN_PROGRESS: { label: "Working", className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" },
  WAITING_ON_USER: { label: "Waiting", className: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
  RESOLVED: { label: "Resolved", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" },
  CLOSED: { label: "Closed", className: "bg-muted text-muted-foreground" },
}

function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return "Something went wrong. Please try again."
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not set"
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function formatFullDateTime(value?: string | null) {
  if (!value) return "Not set"
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function initials(user?: Pick<ApiSupportUser, "fullName" | "firstName" | "lastName"> | null) {
  const fullName = user?.fullName?.trim()
  if (fullName) {
    return fullName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
  }
  return `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "U"
}

function fileSizeLabel(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function absoluteUploadUrl(fileUrl: string) {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl
  return `${API_BASE_URL.replace(/\/api\/v1\/?$/, "")}${fileUrl}`
}

function StatusBadge({ status }: { status: ApiSupportTicketStatus }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <Badge variant="outline" className={cn("gap-1.5", meta.className)}>
      <Icon className={cn("h-3 w-3", status === "IN_PROGRESS" && "animate-spin")} />
      {meta.label}
    </Badge>
  )
}

function PriorityBadge({ priority }: { priority: ApiSupportTicketPriority }) {
  const meta = PRIORITY_META[priority]
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  )
}

function QueueStatusBadge({ status }: { status: ApiSupportTicketStatus }) {
  const meta = QUEUE_STATUS_META[status]
  return <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium", meta.className)}>{meta.label}</span>
}

function QueueOwnerLabel({ ticket, currentUserId }: { ticket: ApiSupportTicketSummary; currentUserId?: string }) {
  if (!ticket.assignedSupport) return <span className="text-amber-700 dark:text-amber-300">Unassigned</span>
  if (ticket.assignedSupport.id === currentUserId) return <span className="text-foreground">Mine</span>
  return <span>{ticket.assignedSupport.fullName}</span>
}

function SlaBadge({ ticket }: { ticket: Pick<ApiSupportTicketSummary, "sla"> }) {
  const state = ticket.sla?.state ?? "PAUSED"
  const label =
    state === "OVERDUE"
      ? "Overdue"
      : state === "DUE_SOON"
        ? "Due soon"
        : state === "SNOOZED"
          ? "Snoozed"
          : state === "OK"
            ? "On track"
            : "Paused"
  const className =
    state === "OVERDUE"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
      : state === "DUE_SOON"
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
        : state === "OK"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
          : "border-muted bg-muted/40 text-muted-foreground"

  return (
    <Badge variant="outline" className={cn("gap-1.5", className)}>
      <TimerReset className="h-3 w-3" />
      {label}
    </Badge>
  )
}

function UserPill({ user, fallback = "Unassigned" }: { user?: ApiSupportUser | null; fallback?: string }) {
  if (!user) return <span className="text-sm text-muted-foreground">{fallback}</span>
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="h-7 w-7">
        <AvatarImage src={user.avatarUrl ?? undefined} alt={user.fullName} />
        <AvatarFallback className="text-[11px]">{initials(user)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight">{user.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      <div className="mb-3 rounded-full bg-muted p-3">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function TicketListItem({
  ticket,
  active,
  onSelect,
  variant = "staff",
  selectable,
  checked,
  onCheckedChange,
  currentUserId,
  isArchiveView,
}: {
  ticket: ApiSupportTicketSummary
  active: boolean
  onSelect: () => void
  variant?: "staff" | "requester"
  selectable?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  currentUserId?: string
  isArchiveView?: boolean
}) {
  const isStaffRow = variant === "staff"
  const showSla = ticket.sla?.state === "OVERDUE" || ticket.sla?.state === "DUE_SOON"
  const showPriority = ticket.priority === "URGENT" || ticket.priority === "HIGH" || isArchiveView
  const categoryLabel = CATEGORY_OPTIONS.find((option) => option.value === ticket.category)?.label ?? ticket.category

  return (
    <div
      className={cn(
        "group flex w-full gap-2 rounded-xl border p-3 text-left transition-all duration-300",
        "hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30",
        isArchiveView && "opacity-75 hover:opacity-100",
        active 
          ? "bg-primary/5 shadow-md border-primary/40 ring-1 ring-primary/20" 
          : "bg-card border-border/40 hover:bg-muted/30",
      )}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
              {ticket.source === "CHAT" ? (
                <Badge variant="secondary" className="h-5 gap-1 rounded-md bg-muted px-1.5 text-[11px] text-muted-foreground">
                  <MessageCircle className="h-3 w-3" />
                  Chat
                </Badge>
              ) : null}
            </div>
            <h3 className="mt-1 line-clamp-2 text-sm font-semibold">{ticket.subject}</h3>
          </div>
          {isStaffRow ? (
            showPriority ? <PriorityBadge priority={ticket.priority} /> : null
          ) : (
            <QueueStatusBadge status={ticket.status} />
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isStaffRow ? <QueueStatusBadge status={ticket.status} /> : showPriority ? <PriorityBadge priority={ticket.priority} /> : null}
          {isStaffRow && showSla ? <SlaBadge ticket={ticket} /> : null}
        </div>
        {isStaffRow ? (
          <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate">{ticket.requester?.fullName ?? "Unknown requester"}</span>
              <span className="shrink-0">{formatDateTime(ticket.lastActivityAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="truncate">
                Agent: <QueueOwnerLabel ticket={ticket} currentUserId={currentUserId} />
              </span>
              {ticket.counts.internalNotes ? <span className="shrink-0">{ticket.counts.internalNotes} notes</span> : null}
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="truncate">{categoryLabel}</span>
            <span className="shrink-0">Updated {formatDateTime(ticket.lastActivityAt)}</span>
          </div>
        )}
      </button>
    </div>
  )
}

function AttachmentChips({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  if (!files.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((file, index) => (
        <Badge key={`${file.name}-${index}`} variant="secondary" className="gap-2">
          <Paperclip className="h-3 w-3" />
          <span className="max-w-[180px] truncate">{file.name}</span>
          <span className="text-muted-foreground">{fileSizeLabel(file.size)}</span>
          <button type="button" onClick={() => onRemove(index)} aria-label={`Remove ${file.name}`}>
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}

function MessageBubble({ message, isStaff }: { message: ApiSupportTicketMessage; isStaff: boolean }) {
  const isInternal = message.visibility === "INTERNAL"
  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/5 p-3", isInternal ? "border-amber-200/70 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20" : "bg-background/40")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <UserPill user={message.author} fallback="Deleted user" />
        <div className="flex items-center gap-2">
          {isInternal ? (
            <Badge variant="outline" className="border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
              Internal
            </Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">{formatDateTime(message.createdAt)}</span>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
      {message.attachments.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.attachments.map((attachment) => (
            <Button key={attachment.id} asChild variant="outline" size="sm" className="h-8">
              <a href={absoluteUploadUrl(attachment.fileUrl)} target="_blank" rel="noreferrer">
                <Paperclip className="h-3.5 w-3.5" />
                <span className="max-w-[180px] truncate">{attachment.fileName}</span>
              </a>
            </Button>
          ))}
        </div>
      ) : null}
      {!isStaff && isInternal ? <p className="mt-2 text-xs text-muted-foreground">Private support note</p> : null}
    </div>
  )
}

function ActivityRow({ activity }: { activity: ApiSupportTicketActivity }) {
  return (
    <div className="flex gap-3 rounded-lg bg-background/20 p-3">
      <div className="mt-0.5 rounded-full bg-muted p-2">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{ACTIVITY_LABELS[activity.type] ?? activity.type}</p>
        <p className="text-xs text-muted-foreground">
          {activity.actor?.fullName ?? "System"} - {formatDateTime(activity.createdAt)}
        </p>
        {(activity.fromValue || activity.toValue) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {activity.fromValue ?? "None"} to {activity.toValue ?? "None"}
          </p>
        )}
      </div>
    </div>
  )
}

export default function SupportPage() {
  const { currentUser, accessToken } = useAuthStore()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const isStaff = currentUser?.role === "support"
  const requestedTicketId = searchParams.get("ticket")
  const requestedView = searchParams.get("view")

  const [summary, setSummary] = useState<ApiSupportSummary | null>(null)
  const [ticketsPage, setTicketsPage] = useState<Paginated<ApiSupportTicketSummary> | null>(null)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<ApiSupportTicketDetail | null>(null)
  const [agents, setAgents] = useState<ApiSupportUser[]>([])
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)
  const [queueView, setQueueView] = useState<QueueView>("active")
  const [ticketTagsDraft, setTicketTagsDraft] = useState("")
  const [filters, setFilters] = useState<TicketFilters>({
    search: "",
    status: "ALL",
    priority: "ALL",
    category: "ALL",
    assignedTo: "ALL",
    sla: "ALL",
    source: "ALL",
    tags: "",
  })
  const [page, setPage] = useState(1)
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [loadingTicket, setLoadingTicket] = useState(false)
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState({
    subject: "",
    category: "GENERAL" as ApiSupportTicketCategory,
    priority: "MEDIUM" as ApiSupportTicketPriority,
    description: "",
  })
  const [createFiles, setCreateFiles] = useState<File[]>([])
  const [createFileInputKey, setCreateFileInputKey] = useState(0)
  const [creatingTicket, setCreatingTicket] = useState(false)

  const [quickMessage, setQuickMessage] = useState("")
  const [quickChatLoading, setQuickChatLoading] = useState(false)

  const [replyBody, setReplyBody] = useState("")
  const [replyVisibility, setReplyVisibility] = useState<ApiSupportTicketMessageVisibility>("PUBLIC")
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [replyFileInputKey, setReplyFileInputKey] = useState(0)
  const [replying, setReplying] = useState(false)
  const [updatingTicket, setUpdatingTicket] = useState(false)
  const ticketItems = useMemo(() => ticketsPage?.items ?? [], [ticketsPage?.items])
  const ticketMeta = ticketsPage?.meta

  const listParams = useMemo(() => {
    const statusGroup: "active" | "archive" | undefined =
      isStaff && filters.status === "ALL" ? (queueView === "archive" ? "archive" : "active") : undefined

    return {
      page,
      limit: isStaff ? 20 : 12,
      search: filters.search.trim() || undefined,
      status: filters.status === "ALL" ? undefined : filters.status,
      statusGroup,
      priority: filters.priority === "ALL" ? undefined : filters.priority,
      category: filters.category === "ALL" ? undefined : filters.category,
      assignedTo: filters.assignedTo === "ALL" ? undefined : filters.assignedTo,
      sla: filters.sla === "ALL" ? undefined : filters.sla,
      source: filters.source === "ALL" ? undefined : filters.source,
      tags: filters.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    }
  }, [filters.assignedTo, filters.category, filters.priority, filters.search, filters.sla, filters.source, filters.status, filters.tags, isStaff, page, queueView])

  const loadSummary = useCallback(async () => {
    const data = await supportApi.summary()
    setSummary(data)
  }, [])

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true)
    setError(null)
    try {
      const data = await supportApi.listTickets(listParams)
      setTicketsPage(data)
      setSelectedTicketId((current) => {
        if (current && (current === requestedTicketId || data.items.some((ticket) => ticket.id === current))) return current
        return data.items[0]?.id ?? null
      })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoadingTickets(false)
    }
  }, [listParams, requestedTicketId])

  const loadTicket = useCallback(async (ticketId: string, options?: { quiet?: boolean }) => {
    if (!options?.quiet) setLoadingTicket(true)
    try {
      const data = await supportApi.getTicket(ticketId)
      setSelectedTicket(data)
    } catch (err) {
      if (!options?.quiet) {
        toast({
          title: "Ticket unavailable",
          description: errorMessage(err),
          variant: "destructive",
        })
      }
    } finally {
      if (!options?.quiet) setLoadingTicket(false)
    }
  }, [toast])

  const refreshAll = useCallback(async () => {
    try {
      await Promise.all([loadSummary(), loadTickets()])
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [loadSummary, loadTickets])

  useEffect(() => {
    if (requestedTicketId) setSelectedTicketId(requestedTicketId)
  }, [requestedTicketId])

  useEffect(() => {
    if (!currentUser) return
    void refreshAll()
  }, [currentUser, refreshAll])

  useEffect(() => {
    if (!selectedTicketId) {
      setSelectedTicket(null)
      return
    }
    void loadTicket(selectedTicketId)
  }, [loadTicket, selectedTicketId])

  useEffect(() => {
    setTicketTagsDraft(selectedTicket?.tags?.join(", ") ?? "")
  }, [selectedTicket?.id, selectedTicket?.tags])



  useEffect(() => {
    if (!isStaff) return
    let cancelled = false
    setLoadingAgents(true)
    Promise.all([supportApi.agents()])
      .then(([agentsData]) => {
        if (cancelled) return
        setAgents(agentsData)
      })
      .catch((err) => {
        if (!cancelled) {
          toast({
            title: "Support tools unavailable",
            description: errorMessage(err),
            variant: "destructive",
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAgents(false)
      })
    return () => {
      cancelled = true
    }
  }, [isStaff, toast])

  useEffect(() => {
    const socket = getSocket(accessToken)
    if (!socket) return

    const handleTicketUpdated = (payload: { ticketId?: string }) => {
      void loadSummary()
      void loadTickets()
      if (payload.ticketId && payload.ticketId === selectedTicketId) {
        void loadTicket(payload.ticketId, { quiet: true })
      }
    }

    socket.on("support:ticket.updated", handleTicketUpdated)
    return () => {
      socket.off("support:ticket.updated", handleTicketUpdated)
    }
  }, [accessToken, loadSummary, loadTicket, loadTickets, selectedTicketId])

  const updateFilters = useCallback((patch: Partial<TicketFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(1)
  }, [])

  const applyQueueView = useCallback((view: QueueView) => {
    setQueueView(view)
    if (view === "mine") {
      updateFilters({ assignedTo: "me", status: "ALL", priority: "ALL", category: "ALL", sla: "ALL", source: "ALL", tags: "" })
      return
    }
    if (view === "unassigned") {
      updateFilters({ assignedTo: "unassigned", status: "ALL", priority: "ALL", category: "ALL", sla: "ALL", source: "ALL", tags: "" })
      return
    }
    if (view === "overdue") {
      updateFilters({ assignedTo: "ALL", status: "ALL", priority: "ALL", category: "ALL", sla: "overdue", source: "ALL", tags: "" })
      return
    }
    if (view === "archive") {
      updateFilters({ assignedTo: "ALL", status: "ALL", priority: "ALL", category: "ALL", sla: "ALL", source: "ALL", tags: "" })
      return
    }
    updateFilters({ assignedTo: "ALL", status: "ALL", priority: "ALL", category: "ALL", sla: "ALL", source: "ALL", tags: "" })
  }, [updateFilters])

  useEffect(() => {
    if (!isStaff) return
    if (requestedView === "active" || requestedView === "mine" || requestedView === "unassigned" || requestedView === "overdue" || requestedView === "archive") {
      applyQueueView(requestedView)
    }
  }, [applyQueueView, isStaff, requestedView])

  const handleCreateTicket = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreatingTicket(true)
    try {
      const ticket = await supportApi.createTicket(createForm, createFiles)
      setCreateForm({
        subject: "",
        category: "GENERAL",
        priority: "MEDIUM",
        description: "",
      })
      setCreateFiles([])
      setCreateFileInputKey((key) => key + 1)
      setSelectedTicketId(ticket.id)
      setSelectedTicket(ticket)
      toast({
        title: "Ticket created",
        description: `${ticket.ticketNumber} is now in the support queue.`,
      })
      await refreshAll()
    } catch (err) {
      toast({
        title: "Could not create ticket",
        description: errorMessage(err),
        variant: "destructive",
      })
    } finally {
      setCreatingTicket(false)
    }
  }

  const handleQuickChat = async () => {
    setQuickChatLoading(true)
    try {
      const ticket = await supportApi.quickChat({
        content: quickMessage.trim() || "I need help from support.",
      })
      setQuickMessage("")
      setSelectedTicketId(ticket.id)
      setSelectedTicket(ticket)
      toast({
        title: ticket.status === "OPEN" ? "Quick chat opened" : "Quick chat updated",
        description: `${ticket.ticketNumber} is ready.`,
      })
      await refreshAll()
    } catch (err) {
      toast({
        title: "Could not open quick chat",
        description: errorMessage(err),
        variant: "destructive",
      })
    } finally {
      setQuickChatLoading(false)
    }
  }

  const handleReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTicket) return
    setReplying(true)
    try {
      const ticket = await supportApi.addMessage(
        selectedTicket.id,
        {
          body: replyBody,
          visibility: isStaff ? replyVisibility : "PUBLIC",
        },
        replyFiles,
      )
      setReplyBody("")
      setReplyVisibility("PUBLIC")
      setReplyFiles([])
      setReplyFileInputKey((key) => key + 1)
      setSelectedTicket(ticket)
      toast({
        title: replyVisibility === "INTERNAL" ? "Internal note saved" : "Reply sent",
        description: `${ticket.ticketNumber} was updated.`,
      })
      await refreshAll()
    } catch (err) {
      toast({
        title: "Could not send reply",
        description: errorMessage(err),
        variant: "destructive",
      })
    } finally {
      setReplying(false)
    }
  }

  const patchSelectedTicket = async (payload: Parameters<typeof supportApi.updateTicket>[1]) => {
    if (!selectedTicket) return
    setUpdatingTicket(true)
    try {
      const ticket = await supportApi.updateTicket(selectedTicket.id, payload)
      setSelectedTicket(ticket)
      toast({
        title: "Ticket updated",
        description: `${ticket.ticketNumber} changes were saved.`,
      })
      await refreshAll()
    } catch (err) {
      toast({
        title: "Could not update ticket",
        description: errorMessage(err),
        variant: "destructive",
      })
    } finally {
      setUpdatingTicket(false)
    }
  }

  const parsedTicketTags = () =>
    ticketTagsDraft
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)

  const saveSelectedTicketTags = async () => {
    if (!selectedTicket) return
    await patchSelectedTicket({ tags: parsedTicketTags() })
  }

  const reopenSelectedTicket = async () => {
    if (!selectedTicket) return
    setUpdatingTicket(true)
    try {
      const ticket = await supportApi.reopenTicket(selectedTicket.id, {
        body: "I still need help with this ticket.",
      })
      setSelectedTicket(ticket)
      toast({
        title: "Ticket reopened",
        description: `${ticket.ticketNumber} is back in the queue.`,
      })
      await refreshAll()
    } catch (err) {
      toast({
        title: "Could not reopen ticket",
        description: errorMessage(err),
        variant: "destructive",
      })
    } finally {
      setUpdatingTicket(false)
    }
  }

  const removeCreateFile = (index: number) => {
    setCreateFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))
  }

  const removeReplyFile = (index: number) => {
    setReplyFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))
  }

  if (!currentUser) {
    return (
      <div className="space-y-5 pb-8">
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Skeleton className="h-[520px]" />
          <Skeleton className="h-[520px]" />
        </div>
      </div>
    )
  }

  const selectedClosed = selectedTicket?.status === "RESOLVED" || selectedTicket?.status === "CLOSED"
  const activeTicketCount = (summary?.open ?? 0) + (summary?.inProgress ?? 0) + (summary?.waitingOnUser ?? 0)
  const archiveTicketCount = (summary?.resolved ?? 0) + (summary?.closed ?? 0)
  const activeAdvancedFilterCount = [
    filters.status !== "ALL",
    filters.priority !== "ALL",
    filters.category !== "ALL",
    filters.source !== "ALL",
    Boolean(filters.tags.trim()),
  ].filter(Boolean).length
  const currentQueueView = queueView

  const renderActionsPanel = () => {
    if (!selectedTicket) return null
    return (
      <div className="space-y-6 pb-8">
        {/* Quick Actions */}
        <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</p>
          {selectedTicket.assignedSupport?.id !== currentUser.id ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => patchSelectedTicket({ assignedSupportUserId: currentUser.id })}
              disabled={updatingTicket}
              className="w-full justify-start font-medium transition-all duration-300 hover:bg-primary hover:text-primary-foreground hover:shadow-md hover:-translate-y-[1px]"
            >
              <UserPlus className="mr-2 h-4 w-4" /> Take ownership
            </Button>
          ) : null}
          {selectedTicket.status === "RESOLVED" || selectedTicket.status === "CLOSED" ? (
            <Button type="button" variant="outline" onClick={() => patchSelectedTicket({ status: "OPEN" })} disabled={updatingTicket} className="w-full justify-start text-primary">
              <RotateCcw className="mr-2 h-4 w-4" /> Reopen ticket
            </Button>
          ) : (
            <div className="grid gap-2.5">
              <Button type="button" variant="outline" onClick={() => patchSelectedTicket({ status: "IN_PROGRESS" })} disabled={updatingTicket} className="justify-start bg-background hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all duration-300 hover:shadow-sm">
                <Activity className="mr-2 h-4 w-4" /> Start working
              </Button>
              <Button type="button" variant="outline" onClick={() => patchSelectedTicket({ status: "WAITING_ON_USER" })} disabled={updatingTicket} className="justify-start bg-background hover:bg-orange-500/10 hover:text-orange-600 hover:border-orange-500/30 transition-all duration-300 hover:shadow-sm">
                <Clock className="mr-2 h-4 w-4" /> Wait for user
              </Button>
              <Button type="button" variant="default" onClick={() => patchSelectedTicket({ status: "RESOLVED" })} disabled={updatingTicket} className="justify-start bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm border-transparent transition-all duration-300 hover:shadow-emerald-500/25 hover:shadow-md hover:-translate-y-[1px]">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Resolve ticket
              </Button>
            </div>
          )}
        </div>

        {/* Properties */}
        <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm space-y-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Properties</p>
          
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Assignee</Label>
            <Select
              value={selectedTicket.assignedSupport?.id ?? "UNASSIGNED"}
              onValueChange={(value) => patchSelectedTicket({ assignedSupportUserId: value === "UNASSIGNED" ? null : value })}
              disabled={updatingTicket || loadingAgents}
            >
              <SelectTrigger className="w-full bg-background shadow-none border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={selectedTicket.status}
                onValueChange={(value) => patchSelectedTicket({ status: value as ApiSupportTicketStatus })}
                disabled={updatingTicket}
              >
                <SelectTrigger className="w-full bg-background shadow-none border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <Select
                value={selectedTicket.priority}
                onValueChange={(value) => patchSelectedTicket({ priority: value as ApiSupportTicketPriority })}
                disabled={updatingTicket}
              >
                <SelectTrigger className="w-full bg-background shadow-none border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Labels</Label>
            <div className="flex gap-2">
              <Input value={ticketTagsDraft} onChange={(event) => setTicketTagsDraft(event.target.value)} placeholder="login, access" className="bg-background shadow-none border-border/60" />
              <Button type="button" variant="secondary" onClick={saveSelectedTicketTags} disabled={updatingTicket}>
                Save
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Comma-separated internal tags.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ── WORKSPACE CARD ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col gap-6 rounded-[32px] border border-border/40 bg-background/50 p-4 sm:p-8 backdrop-blur-md shadow-2xl overflow-hidden"
      >
        <section className={cn("flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between", isStaff && "border-b border-border/40 pb-6")}>
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{isStaff ? "Support workspace" : "Support"}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{isStaff ? "Support queue" : "Contact support"}</h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {isStaff
                ? "Triage active requests, reply from one place, and keep urgent work visible."
                : "Start a quick chat or create a tracked ticket when you need help."}
            </p>
          </div>
          {isStaff ? (
            <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-4 lg:border-l lg:border-border/40 lg:pl-8">
              {[
                { label: "Active tickets", value: activeTicketCount, icon: Activity },
                { label: "Assigned to me", value: summary?.assignedToMe ?? 0, icon: UserCheck },
                { label: "Unassigned", value: summary?.unassigned ?? 0, icon: Users },
                { label: "Overdue", value: summary?.overdue ?? 0, danger: true, icon: AlertCircle },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                <div key={metric.label} className="group flex flex-col justify-between rounded-xl border border-border/40 bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/20 sm:min-w-[140px]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">{metric.label}</p>
                    <Icon className={cn("h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary", metric.danger && metric.value > 0 ? "text-red-500 group-hover:text-red-600" : "")} />
                  </div>
                  <p className={cn("text-3xl font-semibold tracking-tight transition-transform duration-300 group-hover:scale-105 origin-left", metric.danger && metric.value > 0 ? "text-red-500" : "text-foreground")}>{metric.value}</p>
                </div>
              )})}
            </div>
          ) : null}
        </section>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-medium">Support data could not load</p>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {isStaff ? (
        <>
          <div className="p-1 sm:px-2 border-b border-border/40 pb-4 mb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <Tabs value={currentQueueView} onValueChange={(v) => applyQueueView(v as QueueView)} className="w-full lg:w-auto">
                <TabsList className="bg-muted/50 p-1 rounded-lg h-auto gap-1 flex flex-nowrap justify-start overflow-x-auto w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <TabsTrigger value="active" className="rounded-md px-4 py-2 text-sm font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/50 transition-colors whitespace-nowrap">Active</TabsTrigger>
                  <TabsTrigger value="mine" className="rounded-md px-4 py-2 text-sm font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/50 transition-colors whitespace-nowrap">Mine</TabsTrigger>
                  <TabsTrigger value="unassigned" className="rounded-md px-4 py-2 text-sm font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/50 transition-colors whitespace-nowrap">Unassigned</TabsTrigger>
                  <TabsTrigger value="overdue" className="rounded-md px-4 py-2 text-sm font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/50 transition-colors whitespace-nowrap">Overdue</TabsTrigger>
                  <TabsTrigger value="archive" className="rounded-md px-4 py-2 text-sm font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/50 transition-colors whitespace-nowrap">Archive</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdvancedFiltersOpen((open) => !open)}
                  className={cn("gap-2 text-muted-foreground", advancedFiltersOpen && "bg-muted text-foreground")}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters{activeAdvancedFilterCount ? ` (${activeAdvancedFilterCount})` : ""}
                </Button>
              </div>
            </div>
          </div>

          <div className={cn("grid gap-4 lg:gap-8 min-h-[60vh]", selectedTicketId ? "lg:grid-cols-[22rem_minmax(0,1fr)_18rem] xl:grid-cols-[22rem_minmax(0,1fr)_18rem]" : "lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]")}>
            <div className={cn("flex flex-col gap-4 min-w-0", selectedTicketId ? "hidden lg:flex lg:border-r lg:border-border/40 lg:pr-8" : "flex lg:border-r lg:border-border/40 lg:pr-8")}>
              <div className="px-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                    <Inbox className="h-4 w-4" />
                    Tickets
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentQueueView === "archive" ? `${archiveTicketCount} resolved or closed` : `${ticketMeta?.total ?? 0} active tickets`}
                </p>
              </div>
              <div className="space-y-3 px-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={filters.search}
                    onChange={(event) => updateFilters({ search: event.target.value })}
                    placeholder="Search tickets"
                    className="pl-9"
                  />
                </div>
                {advancedFiltersOpen ? (
                  <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={filters.status} onValueChange={(value) => updateFilters({ status: value as TicketFilters["status"] })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All status</SelectItem>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={filters.priority} onValueChange={(value) => updateFilters({ priority: value as TicketFilters["priority"] })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All priority</SelectItem>
                          {PRIORITY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={filters.assignedTo} onValueChange={(value) => updateFilters({ assignedTo: value })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Owner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All owners</SelectItem>
                          <SelectItem value="me">Assigned to me</SelectItem>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={filters.sla} onValueChange={(value) => updateFilters({ sla: value as TicketFilters["sla"] })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="SLA" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All SLA</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="dueSoon">Due soon</SelectItem>
                          <SelectItem value="ok">On track</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={filters.category} onValueChange={(value) => updateFilters({ category: value as TicketFilters["category"] })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All categories</SelectItem>
                          {CATEGORY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={filters.source} onValueChange={(value) => updateFilters({ source: value as TicketFilters["source"] })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All source</SelectItem>
                          <SelectItem value="FORM">Form</SelectItem>
                          <SelectItem value="CHAT">Quick chat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="relative">
                      <Tags className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={filters.tags}
                        onChange={(event) => updateFilters({ tags: event.target.value })}
                        placeholder="Tags"
                        className="pl-9"
                      />
                    </div>
                  </div>
                ) : null}
                <ScrollArea className="h-[62vh] min-h-[420px] pr-3">
                  <div className="space-y-2">
                    {loadingTickets ? (
                      Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-32" />)
                    ) : ticketItems.length ? (
                      ticketItems.map((ticket) => (
                        <TicketListItem
                          key={ticket.id}
                          ticket={ticket}
                          active={ticket.id === selectedTicketId}
                          currentUserId={currentUser.id}
                          isArchiveView={currentQueueView === "archive"}
                          onSelect={() => setSelectedTicketId(ticket.id)}
                        />
                      ))
                    ) : (
                      <EmptyState title="No tickets found" description="Adjust filters or refresh the queue." />
                    )}
                  </div>
                </ScrollArea>
                {ticketMeta && ticketMeta.totalPages > 1 ? (
                  <div className="flex items-center justify-between gap-3 pt-1 text-sm">
                    <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                      Previous
                    </Button>
                    <span className="text-muted-foreground">
                      Page {ticketMeta.page} of {ticketMeta.totalPages}
                    </span>
                    <Button type="button" variant="outline" size="sm" disabled={page >= ticketMeta.totalPages} onClick={() => setPage((value) => value + 1)}>
                      Next
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            {selectedTicketId ? (
              <div className="flex flex-col gap-4 min-w-0 h-full">
                <div className="flex items-center justify-between xl:hidden mb-[-1rem]">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-1.5 rounded-full px-4 text-muted-foreground hover:text-foreground shadow-sm bg-background/50 hover:bg-muted/50 backdrop-blur-sm" 
                    onClick={() => setSelectedTicketId(null)}
                  >
                    <ChevronLeft className="h-4 w-4" /> Back to tickets
                  </Button>
                  {isStaff && selectedTicket ? (
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2 rounded-full shadow-sm bg-background/50 hover:bg-muted/50 backdrop-blur-sm">
                          <Settings2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Actions</span>
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="right" className="w-full sm:w-[400px] overflow-y-auto">
                        <SheetHeader className="mb-6">
                          <SheetTitle className="flex items-center gap-2">
                            <Settings2 className="h-5 w-5 text-muted-foreground" />
                            Ticket Actions
                          </SheetTitle>
                        </SheetHeader>
                        {renderActionsPanel()}
                      </SheetContent>
                    </Sheet>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <TicketThreadPanel
                    isStaff={Boolean(isStaff)}
                    loading={loadingTicket}
                    selectedTicket={selectedTicket}
                    replyBody={replyBody}
                    setReplyBody={setReplyBody}
                    replyVisibility={replyVisibility}
                    setReplyVisibility={setReplyVisibility}
                    replyFiles={replyFiles}
                    replyFileInputKey={replyFileInputKey}
                    setReplyFiles={setReplyFiles}
                    removeReplyFile={removeReplyFile}
                    replying={replying}
                    onReply={handleReply}
                    onReopen={reopenSelectedTicket}
                    updatingTicket={updatingTicket}
                    canReopen={false}
                  />
                </div>
              </div>
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center h-full text-center">
                <EmptyState title="No ticket selected" description="Choose a ticket from the queue..." />
              </div>
            )}

            {selectedTicketId && selectedTicket ? (
              <div className="hidden xl:flex flex-col gap-6 min-w-0 xl:border-l xl:border-border/40 xl:pl-8">
                <div className="px-2 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    Ticket Actions
                  </h2>
                  <QueueStatusBadge status={selectedTicket.status} />
                </div>
                <div className="px-2">
                  {renderActionsPanel()}
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="grid gap-4 lg:gap-8 min-h-[60vh] lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className={cn("flex flex-col gap-4 min-w-0", selectedTicketId ? "hidden lg:flex lg:border-r lg:border-border/40 lg:pr-8" : "flex lg:border-r lg:border-border/40 lg:pr-8")}>
            <div className="flex items-center justify-between px-2">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                  <FileText className="h-4 w-4" />
                  Your tickets
                </h2>
                <p className="text-sm text-muted-foreground mt-1">{ticketMeta?.total ?? 0} requests in your support history</p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2 rounded-full px-4">
                    <Plus className="h-4 w-4" />
                    New Request
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[450px] overflow-y-auto max-h-[90vh]">
                  <DialogHeader>
                    <DialogTitle>Contact support</DialogTitle>
                    <DialogDescription>
                      Use chat for quick questions or a ticket when you want the issue tracked.
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs defaultValue="quick" className="gap-4 mt-2">
                    <TabsList className="grid w-full grid-cols-2 bg-muted/60">
                      <TabsTrigger value="quick">Quick chat</TabsTrigger>
                      <TabsTrigger value="ticket">New ticket</TabsTrigger>
                    </TabsList>
                    <TabsContent value="quick" className="space-y-3">
                      <Label htmlFor="support-quick-message">Message</Label>
                      <Textarea
                        id="support-quick-message"
                        value={quickMessage}
                        onChange={(event) => setQuickMessage(event.target.value)}
                        placeholder="Write the question or issue you need help with."
                        rows={5}
                        className="resize-none"
                      />
                      <Button type="button" onClick={handleQuickChat} disabled={quickChatLoading} className="w-full">
                        {quickChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                        Open quick chat
                      </Button>
                    </TabsContent>
                    <TabsContent value="ticket">
                      <form className="space-y-4" onSubmit={handleCreateTicket}>
                        <div className="space-y-2">
                          <Label htmlFor="support-subject">Subject</Label>
                          <Input
                            id="support-subject"
                            value={createForm.subject}
                            onChange={(event) => setCreateForm((form) => ({ ...form, subject: event.target.value }))}
                            placeholder="Short summary"
                            required
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <Select value={createForm.category} onValueChange={(value) => setCreateForm((form) => ({ ...form, category: value as ApiSupportTicketCategory }))}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORY_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Priority</Label>
                            <Select value={createForm.priority} onValueChange={(value) => setCreateForm((form) => ({ ...form, priority: value as ApiSupportTicketPriority }))}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PRIORITY_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="support-description">Details</Label>
                          <Textarea
                            id="support-description"
                            value={createForm.description}
                            onChange={(event) => setCreateForm((form) => ({ ...form, description: event.target.value }))}
                            placeholder="Add details, steps, links, or screenshots."
                            rows={5}
                            required
                            className="resize-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="support-files">Attachments</Label>
                          <Input
                            key={createFileInputKey}
                            id="support-files"
                            type="file"
                            multiple
                            onChange={(event) => setCreateFiles(Array.from(event.target.files ?? []))}
                          />
                          <p className="text-xs text-muted-foreground">{SUPPORT_UPLOAD_LIMIT}</p>
                          <AttachmentChips files={createFiles} onRemove={removeCreateFile} />
                        </div>
                        <Button type="submit" disabled={creatingTicket} className="w-full">
                          {creatingTicket ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                          Submit ticket
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="space-y-3 px-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(event) => updateFilters({ search: event.target.value })}
                  placeholder="Search my tickets"
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-[55vh] min-h-[380px] pr-3">
                <div className="space-y-2">
                  {loadingTickets ? (
                    Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32" />)
                  ) : ticketItems.length ? (
                    ticketItems.map((ticket) => (
                      <TicketListItem
                        key={ticket.id}
                        ticket={ticket}
                        active={ticket.id === selectedTicketId}
                        variant="requester"
                        currentUserId={currentUser.id}
                        onSelect={() => setSelectedTicketId(ticket.id)}
                      />
                    ))
                  ) : (
                    <EmptyState title="No tickets yet" description="Create a ticket or open quick chat to reach support." />
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {selectedTicketId ? (
            <div className="flex flex-col gap-4 min-w-0 h-full">
              <Button 
                variant="outline" 
                size="sm"
                className="lg:hidden self-start mb-[-0.5rem] gap-1.5 rounded-full px-4 text-muted-foreground hover:text-foreground shadow-sm bg-background/50 hover:bg-muted/50 backdrop-blur-sm" 
                onClick={() => setSelectedTicketId(null)}
              >
                <ChevronLeft className="h-4 w-4" /> Back to tickets
              </Button>
              <TicketThreadPanel
                isStaff={false}
                loading={loadingTicket}
                selectedTicket={selectedTicket}
                replyBody={replyBody}
                setReplyBody={setReplyBody}
                replyVisibility={replyVisibility}
                setReplyVisibility={setReplyVisibility}
                replyFiles={replyFiles}
                replyFileInputKey={replyFileInputKey}
                setReplyFiles={setReplyFiles}
                removeReplyFile={removeReplyFile}
                replying={replying}
                onReply={handleReply}
                onReopen={reopenSelectedTicket}
                updatingTicket={updatingTicket}
                canReopen={Boolean(selectedClosed)}
              />
            </div>
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center h-full text-center">
              <EmptyState 
                title="No request selected" 
                description="Select a ticket from the left to view the conversation, or create a new request." 
              />
            </div>
          )}
        </div>
      )}
      </motion.div>
    </div>
  )
}

function TicketThreadPanel({
  isStaff,
  loading,
  selectedTicket,
  replyBody,
  setReplyBody,
  replyVisibility,
  setReplyVisibility,
  replyFiles,
  replyFileInputKey,
  setReplyFiles,
  removeReplyFile,
  replying,
  onReply,
  onReopen,
  updatingTicket,
  canReopen,
}: {
  isStaff: boolean
  loading: boolean
  selectedTicket: ApiSupportTicketDetail | null
  replyBody: string
  setReplyBody: (value: string) => void
  replyVisibility: ApiSupportTicketMessageVisibility
  setReplyVisibility: (value: ApiSupportTicketMessageVisibility) => void
  replyFiles: File[]
  replyFileInputKey: number
  setReplyFiles: (files: File[]) => void
  removeReplyFile: (index: number) => void
  replying: boolean
  onReply: (event: React.FormEvent<HTMLFormElement>) => void
  onReopen: () => void
  updatingTicket: boolean
  canReopen: boolean
}) {
  const isClosed = selectedTicket?.status === "RESOLVED" || selectedTicket?.status === "CLOSED"

  return (
    <div className="flex flex-col min-w-0 gap-4 overflow-hidden rounded-xl py-4">
      <div className="px-2">
        {!selectedTicket ? (
          <>
            <h2 className="text-base font-semibold tracking-tight">Conversation</h2>
            <p className="text-sm text-muted-foreground mt-1">Select a ticket to read the thread</p>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{selectedTicket.ticketNumber}</span>
                  <StatusBadge status={selectedTicket.status} />
                  <PriorityBadge priority={selectedTicket.priority} />
                  <SlaBadge ticket={selectedTicket} />
                </div>
                <h3 className="mt-2 text-xl font-semibold leading-6 tracking-tight">{selectedTicket.subject}</h3>
                
                <div className="mt-3 flex items-center gap-3">
                  <UserPill user={selectedTicket.requester} fallback="Unknown requester" />
                  <span className="text-xs text-muted-foreground">
                    opened this on {formatDateTime(selectedTicket.createdAt)}
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground mt-2 border-l-2 border-muted pl-2">
                  Last activity {formatFullDateTime(selectedTicket.lastActivityAt)}
                  {selectedTicket.assignedSupport ? ` - Assigned to ${selectedTicket.assignedSupport.fullName}` : " - Unassigned"}
                </p>
              </div>
              {canReopen ? (
                <Button type="button" variant="outline" onClick={onReopen} disabled={updatingTicket}>
                  {updatingTicket ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Reopen
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
      <div className="min-w-0 px-2 mt-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-32" />
            <Skeleton className="h-24" />
          </div>
        ) : !selectedTicket ? (
          <EmptyState title="No ticket selected" description="Choose a ticket from the list to open its thread." />
        ) : (
          <div className="flex min-h-0 flex-col">
            <ScrollArea className="h-[40vh] min-h-[16rem] max-h-[30rem] pr-3">
              <div className="space-y-3">
                {selectedTicket.messages.length ? (
                  selectedTicket.messages.map((message) => <MessageBubble key={message.id} message={message} isStaff={isStaff} />)
                ) : (
                  <EmptyState title="No messages yet" description="Start the thread with a reply." />
                )}
              </div>
            </ScrollArea>

            <Separator className="my-4" />

            {isClosed && !isStaff ? (
              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <p className="font-medium">This ticket is closed.</p>
                <p className="mt-1 text-muted-foreground">Reopen it if you still need help.</p>
              </div>
            ) : (
              <form className="space-y-3" onSubmit={onReply}>
                {isStaff ? (
                  <div className="space-y-2">
                    <div className="inline-grid w-full grid-cols-2 rounded-lg bg-muted p-1 text-sm sm:w-auto">
                      <Button
                        type="button"
                        variant={replyVisibility === "PUBLIC" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setReplyVisibility("PUBLIC")}
                        className="h-8"
                      >
                        Reply
                      </Button>
                      <Button
                        type="button"
                        variant={replyVisibility === "INTERNAL" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setReplyVisibility("INTERNAL")}
                        className="h-8"
                      >
                        Private note
                      </Button>
                    </div>
                    {replyVisibility === "INTERNAL" ? (
                      <p className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">Private notes are visible only to support agents.</p>
                    ) : null}
                  </div>
                ) : null}
                <Textarea
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  placeholder={isStaff && replyVisibility === "INTERNAL" ? "Write a private note" : "Write a reply to the requester"}
                  rows={4}
                  required
                />
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="space-y-2">
                    <Input
                      key={replyFileInputKey}
                      type="file"
                      multiple
                      onChange={(event) => setReplyFiles(Array.from(event.target.files ?? []))}
                    />
                    <p className="text-xs text-muted-foreground">{SUPPORT_UPLOAD_LIMIT}</p>
                    <AttachmentChips files={replyFiles} onRemove={removeReplyFile} />
                  </div>
                  <Button type="submit" disabled={replying || !replyBody.trim()} className="w-full sm:w-auto">
                    {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {replyVisibility === "INTERNAL" ? "Save note" : "Send reply"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
