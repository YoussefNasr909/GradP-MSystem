"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  CheckCircle2, Clock, GitPullRequest, Search, Filter, AlertCircle,
  RefreshCw, Lock, ExternalLink, ArrowRight, ThumbsUp, ThumbsDown,
  Github, FileCode,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth-store"
import { tasksApi } from "@/lib/api/tasks"
import type { ApiTask } from "@/lib/api/types"
import { toast } from "sonner"

const PRIORITY_COLOR: Record<string, string> = {
  LOW:      "border-blue-500/30 text-blue-500",
  MEDIUM:   "border-amber-500/30 text-amber-500",
  HIGH:     "border-orange-500/30 text-orange-500",
  CRITICAL: "border-red-500/30 text-red-500",
}

function getInitials(n: string) {
  return n.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2)
}

function fullName(u?: { firstName?: string; lastName?: string } | null): string {
  if (!u) return ""
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
}

export default function ReviewWorkPage() {
  const { currentUser } = useAuthStore()
  const role = currentUser?.role?.toLowerCase() ?? ""
  const canView = role === "ta" || role === "admin"

  const [tasks, setTasks] = useState<ApiTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [search, setSearch] = useState("")
  const [priority, setPriority] = useState<string>("all")

  // Review dialog
  const [selectedTask, setSelectedTask] = useState<ApiTask | null>(null)
  const [reviewComment, setReviewComment] = useState("")
  const [submittingReview, setSubmittingReview] = useState(false)

  const fetchData = useCallback(async () => {
    setError(false)
    try {
      const all = await tasksApi.list({ status: "REVIEW" })
      setTasks(all)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    if (!canView) { setLoading(false); return }
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [canView, fetchData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (priority !== "all" && t.priority !== priority) return false
      if (search) {
        const q = search.toLowerCase()
        const inTitle = t.title.toLowerCase().includes(q)
        const inAssignee = t.assignee ? fullName(t.assignee).toLowerCase().includes(q) : false
        const inTeam = t.team?.name?.toLowerCase().includes(q) ?? false
        if (!inTitle && !inAssignee && !inTeam) return false
      }
      return true
    })
  }, [tasks, search, priority])

  async function handleApprove(task: ApiTask) {
    setSubmittingReview(true)
    try {
      const updated = await tasksApi.approve(task.id, {
        reviewComment: reviewComment.trim() || undefined,
        mergePullRequest: Boolean(task.github?.pullRequest.number),
        mergeMethod: "squash",
      })
      setTasks(prev => prev.filter(t => t.id !== updated.id))
      setSelectedTask(null)
      setReviewComment("")
      toast.success("Task approved")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to approve")
    } finally {
      setSubmittingReview(false)
    }
  }

  async function handleReject(task: ApiTask) {
    if (reviewComment.trim().length < 5) {
      toast.error("Provide a reason (at least 5 chars) before rejecting")
      return
    }
    setSubmittingReview(true)
    try {
      const updated = await tasksApi.reject(task.id, { reviewComment: reviewComment.trim() })
      setTasks(prev => prev.filter(t => t.id !== updated.id))
      setSelectedTask(null)
      setReviewComment("")
      toast.success("Changes requested")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reject")
    } finally {
      setSubmittingReview(false)
    }
  }

  if (!canView) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="min-h-[60vh] flex items-center justify-center">
        <Card className="p-12 text-center max-w-md border-border/50">
          <Lock className="h-16 w-16 mx-auto mb-6 text-destructive" />
          <h2 className="text-2xl font-bold mb-3">TA Only</h2>
          <p className="text-muted-foreground">This page is for Teaching Assistants to review submitted tasks &amp; PRs.</p>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 sm:p-6">
      <div className="rounded-2xl p-6 border border-border/50 relative overflow-hidden bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
        <motion.div
          className="absolute -right-20 -top-20 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"
          animate={{ scale: [1, 1.15, 1], rotate: [0, 120, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <motion.h1 className="text-3xl font-bold mb-1.5 flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <GitPullRequest className="h-7 w-7 text-cyan-500" />
              Review Work
            </motion.h1>
            <motion.p className="text-muted-foreground"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              Tasks and pull requests across your supervised teams that are awaiting your review
            </motion.p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="p-4 border-border/50">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search task, assignee, team..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
          {(search || priority !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setPriority("all") }}>
              <Filter className="h-4 w-4 mr-1.5" /> Clear
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-20 w-full" /></Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-12 text-center border-border/50">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <p className="text-muted-foreground mb-4">Failed to load tasks</p>
          <Button variant="outline" onClick={() => void fetchData()}>Try again</Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-border/60">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
          <p className="font-semibold mb-1">All clear!</p>
          <p className="text-sm text-muted-foreground">No tasks awaiting your review right now.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                <Card className="p-5 border-border/50 hover:border-border transition-all hover:shadow-md">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-500 shrink-0">
                      {t.github?.pullRequest.number ? <Github className="h-5 w-5" /> : <FileCode className="h-5 w-5" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{t.title}</h3>
                        <Badge variant="outline" className={cn("text-[10px]", PRIORITY_COLOR[t.priority] ?? "")}>
                          {t.priority}
                        </Badge>
                        {t.team?.name && (
                          <Badge variant="outline" className="text-[10px]">{t.team.name}</Badge>
                        )}
                        {t.github?.pullRequest.number && (
                          <Badge variant="outline" className="text-[10px] gap-1 border-purple-500/30 text-purple-500">
                            <Github className="h-3 w-3" /> PR #{t.github.pullRequest.number}
                          </Badge>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{t.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {t.assignee && (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={t.assignee.avatarUrl ?? undefined} />
                              <AvatarFallback className="text-[8px]">{getInitials(fullName(t.assignee))}</AvatarFallback>
                            </Avatar>
                            <span>{fullName(t.assignee)}</span>
                          </div>
                        )}
                        {t.submittedForReviewAt && (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(t.submittedForReviewAt).toLocaleString()}</span>
                        )}
                        {t.github?.pullRequest.url && (
                          <Link href={t.github.pullRequest.url} target="_blank" className="flex items-center gap-1 text-purple-500 hover:underline">
                            <ExternalLink className="h-3 w-3" /> Open on GitHub
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => { setSelectedTask(t); setReviewComment("") }}>
                        Review
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={!!selectedTask} onOpenChange={(o) => { if (!o) setSelectedTask(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitPullRequest className="h-5 w-5 text-cyan-500" />
              Review Task
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 mt-2">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <p className="font-semibold text-sm">{selectedTask.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedTask.team?.name}
                  {selectedTask.assignee && <> · assigned to <b>{fullName(selectedTask.assignee)}</b></>}
                </p>
              </div>

              <div>
                <Label>Review comment</Label>
                <Textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Approve message, or specific changes you want..."
                  className="mt-1.5 resize-none"
                  rows={4}
                />
              </div>

              <div className="flex gap-2 flex-col sm:flex-row">
                <Button
                  onClick={() => void handleApprove(selectedTask)}
                  disabled={submittingReview}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <ThumbsUp className="h-4 w-4 mr-2" />
                  Approve {selectedTask.github?.pullRequest.number ? "& Merge" : ""}
                </Button>
                <Button
                  onClick={() => void handleReject(selectedTask)}
                  disabled={submittingReview}
                  variant="outline"
                  className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <ThumbsDown className="h-4 w-4 mr-2" />
                  Request Changes
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Approving a GitHub-linked task will merge the PR with a squash commit.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
