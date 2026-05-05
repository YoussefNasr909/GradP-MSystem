"use client"

import { useState, useCallback, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Filter,
  Info,
  Lock,
  RefreshCw,
  Search,
  Server,
  User,
  XCircle,
  Terminal,
  ChevronRight,
  Copy,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth-store"
import { adminLogsApi } from "@/lib/api/admin-logs"
import type { SystemLog, ActivityEntry, LogCounts } from "@/lib/api/admin-logs"
import { toast } from "sonner"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLevelIcon(level: string) {
  switch (level) {
    case "info":    return <Info className="h-4 w-4" />
    case "warning": return <AlertTriangle className="h-4 w-4" />
    case "error":   return <XCircle className="h-4 w-4" />
    case "success": return <CheckCircle2 className="h-4 w-4" />
    default:        return <Activity className="h-4 w-4" />
  }
}

function getLevelColor(level: string) {
  switch (level) {
    case "info":    return "text-blue-500 bg-blue-500/10 border-blue-500/20"
    case "warning": return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20"
    case "error":   return "text-red-500 bg-red-500/10 border-red-500/20"
    case "success": return "text-green-500 bg-green-500/10 border-green-500/20"
    default:        return "text-muted-foreground bg-muted"
  }
}

function getLevelBadge(level: string) {
  switch (level) {
    case "info":    return "border-blue-500/30 text-blue-500"
    case "warning": return "border-yellow-500/30 text-yellow-500"
    case "error":   return "border-red-500/30 text-red-500"
    case "success": return "border-green-500/30 text-green-500"
    default:        return ""
  }
}

function getRoleColor(role: string) {
  switch (role.toLowerCase()) {
    case "admin":   return "border-purple-500/30 text-purple-500"
    case "doctor":  return "border-blue-500/30 text-blue-500"
    case "ta":      return "border-cyan-500/30 text-cyan-500"
    case "leader":  return "border-amber-500/30 text-amber-500"
    default:        return "border-border text-muted-foreground"
  }
}

function getUserInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass,
  delay,
}: {
  label: string
  value: number
  icon: React.ElementType
  colorClass: string
  bgClass: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="p-4 border-border/50 hover:border-border/80 transition-colors">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", bgClass)}>
            <Icon className={cn("h-5 w-5", colorClass)} />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="p-4 border-border/50">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function LogListSkeleton() {
  return (
    <div className="divide-y divide-border/50">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="p-4 flex items-start gap-4">
          <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ActivityListSkeleton() {
  return (
    <div className="divide-y divide-border/50">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="p-4 flex items-start gap-4">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
        <Terminal className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </motion.div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <p className="text-sm font-medium mb-4 text-muted-foreground">Failed to load data</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" /> Try again
      </Button>
    </motion.div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminLogsPage() {
  const { currentUser } = useAuthStore()

  // ── System Logs state ─────────────────────────────────────────────────────
  const [sysLogs, setSysLogs] = useState<SystemLog[]>([])
  const [sysCounts, setSysCounts] = useState<LogCounts | null>(null)
  const [sysTotal, setSysTotal] = useState(0)
  const [sysLoading, setSysLoading] = useState(false)
  const [sysError, setSysError] = useState(false)
  const [sysSearch, setSysSearch] = useState("")
  const [sysLevel, setSysLevel] = useState("all")
  const [sysCategory, setSysCategory] = useState("all")
  const [sysPage, setSysPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null)

  // ── Activity state ────────────────────────────────────────────────────────
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [actTotal, setActTotal] = useState(0)
  const [actLoading, setActLoading] = useState(false)
  const [actError, setActError] = useState(false)
  const [actSearch, setActSearch] = useState("")
  const [actRole, setActRole] = useState("all")
  const [actPage, setActPage] = useState(1)

  // ── Refresh ───────────────────────────────────────────────────────────────
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState("system")

  // ── Fetch system logs ─────────────────────────────────────────────────────
  const fetchSystemLogs = useCallback(async () => {
    setSysLoading(true)
    setSysError(false)
    try {
      const res = await adminLogsApi.getSystemLogs({
        page: sysPage,
        limit: 50,
        level: sysLevel,
        category: sysCategory,
        search: sysSearch || undefined,
      })
      setSysLogs(res.logs)
      setSysCounts(res.counts)
      setSysTotal(res.total)
    } catch {
      setSysError(true)
    } finally {
      setSysLoading(false)
    }
  }, [sysPage, sysLevel, sysCategory, sysSearch])

  // ── Fetch activity ────────────────────────────────────────────────────────
  const fetchActivity = useCallback(async () => {
    setActLoading(true)
    setActError(false)
    try {
      const res = await adminLogsApi.getUserActivity({
        page: actPage,
        limit: 50,
        search: actSearch || undefined,
        role: actRole,
      })
      setActivities(res.activities)
      setActTotal(res.total)
    } catch {
      setActError(true)
    } finally {
      setActLoading(false)
    }
  }, [actPage, actSearch, actRole])

  // ── Initial + reactive fetches ────────────────────────────────────────────
  useEffect(() => { void fetchSystemLogs() }, [fetchSystemLogs])
  useEffect(() => { void fetchActivity() }, [fetchActivity])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await Promise.allSettled([fetchSystemLogs(), fetchActivity()])
    setIsRefreshing(false)
    toast.success("Logs refreshed")
  }

  const copyLogJson = (log: SystemLog) => {
    void navigator.clipboard.writeText(JSON.stringify(log, null, 2))
    toast.success("Copied to clipboard")
  }

  // ── Access guard ──────────────────────────────────────────────────────────
  if (currentUser?.role !== "admin") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-[60vh] flex items-center justify-center"
      >
        <Card className="p-12 text-center max-w-md border-border/50">
          <Lock className="h-16 w-16 mx-auto mb-6 text-destructive" />
          <h2 className="text-2xl font-bold mb-3">Access Denied</h2>
          <p className="text-muted-foreground">You don&apos;t have permission to access the system logs.</p>
        </Card>
      </motion.div>
    )
  }

  const counts = sysCounts ?? { total: 0, info: 0, warning: 0, error: 0, success: 0 }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 border border-border/50 relative overflow-hidden bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
        <motion.div
          className="absolute -right-20 -top-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"
          animate={{ scale: [1, 1.15, 1], rotate: [0, 180, 0] }}
          transition={{ duration: 18, repeat: Infinity }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <motion.h1
              className="text-3xl font-bold mb-1.5 flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Terminal className="h-7 w-7 text-purple-500" />
              System Logs
            </motion.h1>
            <motion.p
              className="text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              Monitor real-time system activity and user actions
            </motion.p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stats cards ────────────────────────────────────────────────────── */}
      {sysLoading && !sysCounts ? (
        <StatsSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-5">
          <StatCard label="Total Logs"  value={counts.total}   icon={Activity}      colorClass="text-blue-500"   bgClass="bg-blue-500/10"   delay={0}    />
          <StatCard label="Info"        value={counts.info}    icon={Info}          colorClass="text-blue-500"   bgClass="bg-blue-500/10"   delay={0.05} />
          <StatCard label="Warnings"    value={counts.warning} icon={AlertTriangle} colorClass="text-yellow-500" bgClass="bg-yellow-500/10" delay={0.1}  />
          <StatCard label="Errors"      value={counts.error}   icon={XCircle}       colorClass="text-red-500"    bgClass="bg-red-500/10"    delay={0.15} />
          <StatCard label="Success"     value={counts.success} icon={CheckCircle2}  colorClass="text-green-500"  bgClass="bg-green-500/10"  delay={0.2}  />
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="p-1 gap-0.5 bg-muted/50 backdrop-blur-sm border border-border/60">
          <TabsTrigger
            value="system"
            className="h-9 rounded-xl px-4 text-sm font-medium transition-all duration-200 ease-out hover:bg-muted/70 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.96] data-[state=active]:shadow-md"
          >
            <Server className="h-4 w-4 mr-2" />
            System Logs
            {sysTotal > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {sysTotal}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="h-9 rounded-xl px-4 text-sm font-medium transition-all duration-200 ease-out hover:bg-muted/70 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.96] data-[state=active]:shadow-md"
          >
            <Activity className="h-4 w-4 mr-2" />
            User Activity
            {actTotal > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {actTotal}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ═══════ System Logs ════════════════════════════════════════════════ */}
        <TabsContent value="system" className="space-y-4 mt-4">
          {/* Filters */}
          <Card className="p-4 border-border/50">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by message, source…"
                  className="pl-9"
                  value={sysSearch}
                  onChange={(e) => { setSysSearch(e.target.value); setSysPage(1) }}
                />
              </div>
              <Select value={sysLevel} onValueChange={(v) => { setSysLevel(v); setSysPage(1) }}>
                <SelectTrigger className="w-[145px]">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sysCategory} onValueChange={(v) => { setSysCategory(v); setSysPage(1) }}>
                <SelectTrigger className="w-[145px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              {(sysSearch || sysLevel !== "all" || sysCategory !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSysSearch(""); setSysLevel("all"); setSysCategory("all"); setSysPage(1) }}
                >
                  <Filter className="h-4 w-4 mr-1.5" />
                  Clear
                </Button>
              )}
            </div>
          </Card>

          {/* Log List */}
          <Card className="border-border/50 overflow-hidden">
            <ScrollArea className="h-[520px]">
              {sysLoading ? (
                <LogListSkeleton />
              ) : sysError ? (
                <ErrorState onRetry={fetchSystemLogs} />
              ) : sysLogs.length === 0 ? (
                <EmptyState message="No logs match your filters" />
              ) : (
                <AnimatePresence mode="popLayout" initial={false}>
                  <div className="divide-y divide-border/50">
                    {sysLogs.map((log, index) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ delay: index * 0.02, duration: 0.25 }}
                        className="p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                        onClick={() => setSelectedLog(log)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={cn("p-2 rounded-lg border shrink-0", getLevelColor(log.level))}>
                            {getLevelIcon(log.level)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge
                                variant="outline"
                                className={cn("text-xs capitalize", getLevelBadge(log.level))}
                              >
                                {log.level}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">
                                {log.category}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{log.source}</span>
                            </div>
                            <p className="font-medium text-sm mb-1 line-clamp-1">{log.message}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(log.timestamp), "MMM d, yyyy HH:mm:ss")}
                              </span>
                              <span className="font-mono opacity-60">{log.id}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); setSelectedLog(log) }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </AnimatePresence>
              )}
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* ═══════ User Activity ══════════════════════════════════════════════ */}
        <TabsContent value="activity" className="space-y-4 mt-4">
          {/* Filters */}
          <Card className="p-4 border-border/50">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, action, team…"
                  className="pl-9"
                  value={actSearch}
                  onChange={(e) => { setActSearch(e.target.value); setActPage(1) }}
                />
              </div>
              <Select value={actRole} onValueChange={(v) => { setActRole(v); setActPage(1) }}>
                <SelectTrigger className="w-[145px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="ta">TA</SelectItem>
                  <SelectItem value="leader">Leader</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
              {(actSearch || actRole !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setActSearch(""); setActRole("all"); setActPage(1) }}
                >
                  <Filter className="h-4 w-4 mr-1.5" />
                  Clear
                </Button>
              )}
            </div>
          </Card>

          {/* Activity List */}
          <Card className="border-border/50 overflow-hidden">
            <ScrollArea className="h-[520px]">
              {actLoading ? (
                <ActivityListSkeleton />
              ) : actError ? (
                <ErrorState onRetry={fetchActivity} />
              ) : activities.length === 0 ? (
                <EmptyState message="No activity found" />
              ) : (
                <AnimatePresence mode="popLayout" initial={false}>
                  <div className="divide-y divide-border/50">
                    {activities.map((act, index) => (
                      <motion.div
                        key={act.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.025, duration: 0.25 }}
                        className="p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <Avatar className="h-10 w-10 shrink-0 ring-2 ring-border/40">
                            <AvatarImage src={act.user.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                              {getUserInitials(act.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-semibold text-sm">{act.user.name}</span>
                              <Badge
                                variant="outline"
                                className={cn("text-xs capitalize", getRoleColor(act.user.role))}
                              >
                                {act.user.role}
                              </Badge>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-primary text-sm font-medium">{act.action}</span>
                              <span className="text-muted-foreground text-sm truncate max-w-[200px]">{act.target}</span>
                            </div>
                            {act.details && (
                              <p className="text-xs text-muted-foreground mb-1.5">{act.details}</p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(act.timestamp), "MMM d, yyyy HH:mm")}
                              </span>
                              {act.user.email && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {act.user.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </AnimatePresence>
              )}
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Log Details Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLog && (
                <span className={cn("p-1.5 rounded-lg border", getLevelColor(selectedLog.level))}>
                  {getLevelIcon(selectedLog.level)}
                </span>
              )}
              Log Details
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Log ID</p>
                  <p className="font-mono">{selectedLog.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Timestamp</p>
                  <p>{format(new Date(selectedLog.timestamp), "MMM d, yyyy HH:mm:ss")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Level</p>
                  <Badge variant="outline" className={cn("capitalize", getLevelBadge(selectedLog.level))}>
                    {selectedLog.level}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Category</p>
                  <Badge variant="outline" className="capitalize">{selectedLog.category}</Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Source</p>
                  <p>{selectedLog.source}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Message</p>
                  <p className="font-medium">{selectedLog.message}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Details</p>
                  <pre className="p-3 rounded-xl bg-muted text-xs font-mono overflow-auto max-h-48">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => copyLogJson(selectedLog)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </Button>
              </div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
