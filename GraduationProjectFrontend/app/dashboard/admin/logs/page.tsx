"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { motion } from "framer-motion"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Info,
  Lock,
  RefreshCw,
  Search,
  Server,
  Terminal,
  User,
  XCircle,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { adminLogsApi } from "@/lib/api/admin-logs"
import type { ActivityEntry, LogCounts, SystemLog } from "@/lib/api/admin-logs"
import { useAuthStore } from "@/lib/stores/auth-store"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

function useDebouncedValue<T>(value: T, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timeoutId)
  }, [delay, value])

  return debouncedValue
}

function getLevelIcon(level: string) {
  switch (level) {
    case "info":
      return <Info className="h-4 w-4" />
    case "warning":
      return <AlertTriangle className="h-4 w-4" />
    case "error":
      return <XCircle className="h-4 w-4" />
    case "success":
      return <CheckCircle2 className="h-4 w-4" />
    default:
      return <Activity className="h-4 w-4" />
  }
}

function getLevelTone(level: string) {
  switch (level) {
    case "info":
      return "border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300"
    case "warning":
      return "border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
    case "error":
      return "border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
    case "success":
      return "border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
    default:
      return "border-border bg-muted text-muted-foreground"
  }
}

function getRoleTone(role: string) {
  switch (role.toLowerCase()) {
    case "admin":
      return "border-fuchsia-200/80 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/30 dark:text-fuchsia-300"
    case "doctor":
      return "border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300"
    case "ta":
      return "border-cyan-200/80 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300"
    case "leader":
      return "border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
    default:
      return "border-border bg-muted text-muted-foreground"
  }
}

function getUserInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ElementType
  tone: string
}) {
  return (
    <Card className="border-border/60 bg-card/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
        <div className={cn("rounded-2xl border p-2.5", tone)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  )
}

function ListSkeleton({ activity = false }: { activity?: boolean }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border/60 p-4">
          <div className="flex gap-4">
            <Skeleton className={cn("shrink-0", activity ? "h-10 w-10 rounded-full" : "h-10 w-10 rounded-2xl")} />
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 rounded-3xl border border-border/60 bg-muted/40 p-4">
        <Terminal className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 rounded-3xl border border-rose-200/80 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
        <AlertCircle className="h-6 w-6 text-rose-600 dark:text-rose-300" />
      </div>
      <h3 className="text-base font-semibold">Couldn&apos;t load this section</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Try again in a moment. If the issue keeps happening, refresh the page.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Try again
      </Button>
    </div>
  )
}

function DetailCard({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-gradient-to-br from-background to-muted/30 p-4 shadow-sm", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <div className="mt-2.5 min-w-0">{children}</div>
    </div>
  )
}

export default function AdminLogsPage() {
  const { currentUser } = useAuthStore()

  const [sysLogs, setSysLogs] = useState<SystemLog[]>([])
  const [sysCounts, setSysCounts] = useState<LogCounts | null>(null)
  const [sysTotal, setSysTotal] = useState(0)
  const [sysLoading, setSysLoading] = useState(false)
  const [sysError, setSysError] = useState(false)
  const [sysSearch, setSysSearch] = useState("")
  const [sysLevel, setSysLevel] = useState("all")
  const [sysCategory, setSysCategory] = useState("all")
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null)

  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [actTotal, setActTotal] = useState(0)
  const [actLoading, setActLoading] = useState(false)
  const [actError, setActError] = useState(false)
  const [actSearch, setActSearch] = useState("")
  const [actRole, setActRole] = useState("all")

  const [activeTab, setActiveTab] = useState("system")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const debouncedSysSearch = useDebouncedValue(sysSearch.trim())
  const debouncedActSearch = useDebouncedValue(actSearch.trim())

  const fetchSystemLogs = useCallback(async () => {
    setSysLoading(true)
    setSysError(false)

    try {
      const response = await adminLogsApi.getSystemLogs({
        limit: 24,
        level: sysLevel,
        category: sysCategory,
        search: debouncedSysSearch || undefined,
      })

      setSysLogs(response.logs)
      setSysCounts(response.counts)
      setSysTotal(response.total)
      setLastUpdatedAt(new Date())
    } catch {
      setSysError(true)
    } finally {
      setSysLoading(false)
    }
  }, [debouncedSysSearch, sysCategory, sysLevel])

  const fetchActivity = useCallback(async () => {
    setActLoading(true)
    setActError(false)

    try {
      const response = await adminLogsApi.getUserActivity({
        limit: 24,
        search: debouncedActSearch || undefined,
        role: actRole,
      })

      setActivities(response.activities)
      setActTotal(response.total)
      setLastUpdatedAt(new Date())
    } catch {
      setActError(true)
    } finally {
      setActLoading(false)
    }
  }, [actRole, debouncedActSearch])

  useEffect(() => {
    if (activeTab === "system") {
      void fetchSystemLogs()
    }
  }, [activeTab, fetchSystemLogs])

  useEffect(() => {
    if (activeTab === "activity") {
      void fetchActivity()
    }
  }, [activeTab, fetchActivity])

  const handleRefresh = async () => {
    setIsRefreshing(true)

    if (activeTab === "system") {
      await fetchSystemLogs()
      toast.success("System logs refreshed")
    } else {
      await fetchActivity()
      toast.success("User activity refreshed")
    }

    setIsRefreshing(false)
  }

  const clearSystemFilters = () => {
    setSysSearch("")
    setSysLevel("all")
    setSysCategory("all")
  }

  const clearActivityFilters = () => {
    setActSearch("")
    setActRole("all")
  }

  const copyLogJson = (log: SystemLog) => {
    void navigator.clipboard.writeText(JSON.stringify(log, null, 2))
    toast.success("Log JSON copied")
  }

  if (currentUser?.role !== "admin") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex min-h-[60vh] items-center justify-center"
      >
        <Card className="max-w-md border-border/60 p-12 text-center shadow-sm">
          <Lock className="mx-auto mb-6 h-16 w-16 text-destructive" />
          <h2 className="text-2xl font-bold">Access denied</h2>
          <p className="mt-3 text-muted-foreground">You don&apos;t have permission to view the system logs page.</p>
        </Card>
      </motion.div>
    )
  }

  const counts = sysCounts ?? { total: 0, info: 0, warning: 0, error: 0, success: 0 }
  const systemFilterCount = Number(Boolean(sysSearch)) + Number(sysLevel !== "all") + Number(sysCategory !== "all")
  const activityFilterCount = Number(Boolean(actSearch)) + Number(actRole !== "all")

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-8">
      <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-background via-background to-slate-50/80 p-6 shadow-sm dark:to-slate-950/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="rounded-3xl border border-violet-200/70 bg-violet-50 p-3 text-violet-600 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300">
                <Terminal className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-semibold tracking-tight">System Logs</h1>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em]">
                    Admin only
                  </Badge>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Review platform events and user activity in a cleaner stream. Heavy visual noise has been removed so
                  it&apos;s faster to scan and easier on the eyes.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {activeTab === "system" ? "Showing latest 24 logs" : "Showing latest 24 actions"}
              </Badge>
              <span>
                Last updated{" "}
                {lastUpdatedAt ? format(lastUpdatedAt, "MMM d, yyyy HH:mm:ss") : "when the first request completes"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" className="rounded-xl px-4" onClick={() => void handleRefresh()} disabled={isRefreshing}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh current view
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryTile label="Total" value={counts.total} icon={Server} tone="border-slate-200/80 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300" />
            <SummaryTile label="Info" value={counts.info} icon={Info} tone={getLevelTone("info")} />
            <SummaryTile label="Warnings" value={counts.warning} icon={AlertTriangle} tone={getLevelTone("warning")} />
            <SummaryTile label="Errors" value={counts.error} icon={XCircle} tone={getLevelTone("error")} />
          </div>
        </div>
      </Card>


      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto w-full max-w-md grid-cols-2 rounded-2xl border border-border/60 bg-muted/40 p-1">
          <TabsTrigger value="system" className="rounded-xl px-4 py-2.5 text-sm font-medium">
            <Server className="mr-2 h-4 w-4" />
            System
            <Badge variant="secondary" className="ml-2 h-5 rounded-full px-2 text-[11px]">
              {sysTotal}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-xl px-4 py-2.5 text-sm font-medium">
            <Activity className="mr-2 h-4 w-4" />
            Activity
            <Badge variant="secondary" className="ml-2 h-5 rounded-full px-2 text-[11px]">
              {actTotal}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="mt-0 space-y-4">
          <Card className="border-border/60 p-4 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-base font-semibold">System events</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Search by message or source, then open a row only when you need the full payload.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {sysTotal} total records
                </Badge>
                {systemFilterCount > 0 && (
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {systemFilterCount} active filters
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_170px_170px_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={sysSearch}
                  onChange={(event) => setSysSearch(event.target.value)}
                  className="h-11 rounded-xl pl-9"
                  placeholder="Search message or source"
                />
              </div>

              <Select value={sysLevel} onValueChange={setSysLevel}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sysCategory} onValueChange={setSysCategory}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                className="h-11 rounded-xl px-4"
                onClick={clearSystemFilters}
                disabled={systemFilterCount === 0}
              >
                Clear filters
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden border-border/60 shadow-sm">
            <ScrollArea className="h-[560px]">
              {sysLoading ? (
                <ListSkeleton />
              ) : sysError ? (
                <ErrorState onRetry={fetchSystemLogs} />
              ) : sysLogs.length === 0 ? (
                <EmptyState title="No logs matched these filters" description="Try a different keyword or clear the active filters to see more system events." />
              ) : (
                <div className="space-y-3 p-4">
                  {sysLogs.map((log) => (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className="w-full rounded-2xl border border-border/60 bg-card/80 p-4 text-left transition-colors hover:border-border hover:bg-muted/20"
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn("rounded-2xl border p-2.5", getLevelTone(log.level))}>{getLevelIcon(log.level)}</div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={cn("rounded-full capitalize", getLevelTone(log.level))}>
                              {log.level}
                            </Badge>
                            <Badge variant="outline" className="rounded-full capitalize">
                              {log.category}
                            </Badge>
                            <Badge variant="secondary" className="rounded-full font-mono text-[11px]">
                              {log.source}
                            </Badge>
                          </div>

                          <p className="mt-3 text-sm font-semibold leading-6 text-foreground">{log.message}</p>

                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {format(new Date(log.timestamp), "MMM d, yyyy HH:mm:ss")}
                            </span>
                            <span className="font-mono">#{log.id.slice(0, 8)}</span>
                          </div>
                        </div>

                        <div className="hidden shrink-0 self-center text-xs font-medium text-primary md:block">
                          View details
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-0 space-y-4">
          <Card className="border-border/60 p-4 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-base font-semibold">User activity</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Focus on who did what, with less visual clutter and fewer distractions.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {actTotal} recent actions
                </Badge>
                {activityFilterCount > 0 && (
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {activityFilterCount} active filters
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_190px_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={actSearch}
                  onChange={(event) => setActSearch(event.target.value)}
                  className="h-11 rounded-xl pl-9"
                  placeholder="Search user, action, or team"
                />
              </div>

              <Select value={actRole} onValueChange={setActRole}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="ta">TA</SelectItem>
                  <SelectItem value="leader">Leader</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                className="h-11 rounded-xl px-4"
                onClick={clearActivityFilters}
                disabled={activityFilterCount === 0}
              >
                Clear filters
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden border-border/60 shadow-sm">
            <ScrollArea className="h-[560px]">
              {actLoading ? (
                <ListSkeleton activity />
              ) : actError ? (
                <ErrorState onRetry={fetchActivity} />
              ) : activities.length === 0 ? (
                <EmptyState title="No activity found" description="Try broadening the search or resetting the role filter to see more actions." />
              ) : (
                <div className="space-y-3 p-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="rounded-2xl border border-border/60 bg-card/80 p-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-11 w-11 shrink-0 border border-border/60">
                          <AvatarImage src={activity.user.avatarUrl ?? undefined} />
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                            {getUserInitials(activity.user.name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{activity.user.name}</span>
                            <Badge variant="outline" className={cn("rounded-full capitalize", getRoleTone(activity.user.role))}>
                              {activity.user.role}
                            </Badge>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium text-primary">{activity.action}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">{activity.target}</span>
                          </div>

                          {activity.details && (
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{activity.details}</p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {format(new Date(activity.timestamp), "MMM d, yyyy HH:mm")}
                            </span>
                            {activity.user.email && (
                              <span className="inline-flex items-center gap-1">
                                <User className="h-3.5 w-3.5" />
                                {activity.user.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden border-border/60 bg-background p-0 shadow-2xl">
          {selectedLog ? (
            <>
              <DialogHeader className="border-b border-border/60 bg-gradient-to-r from-slate-50 via-background to-blue-50/60 px-4 py-4 text-left sm:px-5 dark:from-slate-950 dark:to-blue-950/20">
                <div className="flex items-start gap-3 pr-8">
                  <span className={cn("mt-0.5 rounded-2xl border p-2.5 shadow-sm", getLevelTone(selectedLog.level))}>
                    {getLevelIcon(selectedLog.level)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl">Log details</DialogTitle>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                      Review the event metadata, message summary, and raw payload for this log.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn("rounded-full px-3 py-1 capitalize", getLevelTone(selectedLog.level))}>
                        {selectedLog.level}
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-3 py-1 capitalize">
                        {selectedLog.category}
                      </Badge>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        {selectedLog.source}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4 px-4 py-4 pb-10 sm:px-5 sm:py-5 sm:pb-12">
                  <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                    <DetailCard label="Message">
                      <p className="text-sm font-semibold leading-6 text-foreground sm:text-base">{selectedLog.message}</p>
                    </DetailCard>

                    <DetailCard label="Timestamp">
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium text-foreground sm:text-base">
                          {format(new Date(selectedLog.timestamp), "MMM d, yyyy")}
                        </p>
                        <p className="text-sm text-muted-foreground">{format(new Date(selectedLog.timestamp), "HH:mm:ss")}</p>
                      </div>
                    </DetailCard>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <DetailCard label="Log ID" className="md:col-span-2 xl:col-span-2">
                      <p className="break-all font-mono text-xs leading-6 text-foreground sm:text-sm">{selectedLog.id}</p>
                    </DetailCard>

                    <DetailCard label="Level">
                      <Badge variant="outline" className={cn("rounded-full px-3 py-1 capitalize", getLevelTone(selectedLog.level))}>
                        {selectedLog.level}
                      </Badge>
                    </DetailCard>

                    <DetailCard label="Category">
                      <Badge variant="outline" className="rounded-full px-3 py-1 capitalize">
                        {selectedLog.category}
                      </Badge>
                    </DetailCard>
                  </div>

                  <DetailCard label="Source">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl border border-border/60 bg-muted/50 p-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{selectedLog.source}</p>
                        <p className="text-xs text-muted-foreground">Service or module that emitted this system event</p>
                      </div>
                    </div>
                  </DetailCard>

                  <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl">
                    <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-950/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Payload</p>
                        <p className="mt-1 text-xs text-slate-300 sm:text-sm">Raw JSON captured with this log entry.</p>
                      </div>
                      <Button variant="secondary" size="sm" className="shrink-0" onClick={() => copyLogJson(selectedLog)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy JSON
                      </Button>
                    </div>
                    <pre className="overflow-auto px-4 py-3 font-mono text-[11px] leading-6 text-slate-100 sm:max-h-[280px] sm:text-xs md:max-h-[320px]">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
