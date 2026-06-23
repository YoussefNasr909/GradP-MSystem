"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import {
  Megaphone, Plus, Pin, Trash2, Send, Users, Globe,
  AlertCircle, RefreshCw, Loader2, Filter, Search, ShieldCheck, GraduationCap, User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth-store"
import { announcementsApi, audienceApi, type Announcement, type AnnouncementAudience, type AudiencePreviewTeam } from "@/lib/api/supervisor-tools"
import { toast } from "sonner"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import { teamsApi } from "@/lib/api/teams"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

export default function AnnouncementsPage() {
  const { currentUser } = useAuthStore()
  const role = currentUser?.role?.toLowerCase() ?? ""
  const canPost = role === "doctor" || role === "ta" || role === "admin"

  const { data: myTeamState } = useMyTeamState()

  // For doctor/TA: their supervisedTeams come from /my-team.
  // For admin: they don't appear as doctor/ta of any team, so we paginate
  // through /teams to populate the picker with every team in the program.
  const [adminTeams, setAdminTeams] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (role !== "admin") return
    let cancelled = false
    async function loadAllTeams() {
      try {
        const collected: { id: string; name: string }[] = []
        let page = 1
        for (let i = 0; i < 20; i++) {
          const res = await teamsApi.list({ page, limit: 50 })
          if (cancelled) return
          for (const t of res.items) collected.push({ id: t.id, name: t.name })
          if (res.items.length < 50 || page >= (res.meta?.totalPages ?? 1)) break
          page += 1
        }
        if (!cancelled) setAdminTeams(collected)
      } catch (err) {
        console.error("[announcements] loadAllTeams failed:", err)
      }
    }
    void loadAllTeams()
    return () => { cancelled = true }
  }, [role])

  const supervisedTeams = useMemo(() => {
    if (role === "admin") return adminTeams
    return myTeamState?.supervisedTeams ?? []
  }, [role, adminTeams, myTeamState])

  const [items, setItems]     = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredItems = useMemo(() => {
    return items.filter((a) => {
      const matchesRole = roleFilter === "all" || a.authorRole.toLowerCase() === roleFilter.toLowerCase()
      const matchesSearch = 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        a.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.author?.fullName.toLowerCase().includes(searchQuery.toLowerCase())
      
      return matchesRole && matchesSearch
    })
  }, [items, roleFilter, searchQuery])

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle]     = useState("")
  const [content, setContent] = useState("")
  const [targetTeam, setTargetTeam] = useState<string>("ALL")
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Smart audience targeting
  const [audience, setAudience] = useState<AnnouncementAudience>("all")
  const [audienceParam, setAudienceParam] = useState<string>("REQUIREMENTS")
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreviewTeam[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const isTitleInvalid = submitAttempted && title.trim().length < 3
  const isContentInvalid = submitAttempted && content.trim().length < 5

  const load = useCallback(async () => {
    setError(false)
    try {
      const data = await announcementsApi.list()
      setItems(data)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  const handleRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  // Preview which teams the current audience selection would reach
  useEffect(() => {
    if (!dialogOpen || targetTeam !== "ALL" || !canPost) {
      setAudiencePreview([])
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    audienceApi.preview(audience, audience === "byStage" ? audienceParam : undefined)
      .then((teams) => { if (!cancelled) setAudiencePreview(teams) })
      .catch(() => { if (!cancelled) setAudiencePreview([]) })
      .finally(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  }, [dialogOpen, targetTeam, audience, audienceParam, canPost])

  async function handleCreate() {
    setSubmitAttempted(true)
    setSubmitError(null)
    const titleInvalid = title.trim().length < 3
    const contentInvalid = content.trim().length < 5

    if (titleInvalid || contentInvalid) {
      toast.error("Title (≥3 chars) and content (≥5 chars) are required")
      return
    }
    setSaving(true)
    try {
      const created = await announcementsApi.create({
        title: title.trim(),
        content: content.trim(),
        teamId: targetTeam === "ALL" ? null : targetTeam,
        pinned,
        audience: targetTeam === "ALL" ? audience : undefined,
        audienceParam: targetTeam === "ALL" && audience === "byStage" ? audienceParam : undefined,
      })
      const sentCount = created.targetTeamCount ?? created.targetTeams?.length ?? (created.teamId ? 1 : 0)
      setItems((prev) => [created, ...prev])
      if (sentCount > 0) {
        toast.success(`Announcement sent to ${sentCount} team${sentCount === 1 ? "" : "s"}`)
      } else {
        toast.warning("Announcement posted, but no teams matched this audience")
      }
      setDialogOpen(false)
      setTitle("")
      setContent("")
      setTargetTeam("ALL")
      setPinned(false)
      setSubmitAttempted(false)
      setSubmitError(null)
    } catch (e: any) {
      const message = e?.message ?? "Failed to post announcement"
      setSubmitError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // Delete confirmation — stores the target id so the dialog can render even
  // after we lose hover focus on the row's trash button.
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const deleteTarget = useMemo(
    () => (deleteTargetId ? items.find((a) => a.id === deleteTargetId) ?? null : null),
    [deleteTargetId, items],
  )

  async function performDelete(id: string) {
    try {
      await announcementsApi.delete(id)
      setItems((prev) => prev.filter((a) => a.id !== id))
      toast.success("Announcement deleted")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete")
      throw e // keep dialog open so the user sees the failure
    }
  }

  async function togglePin(a: Announcement) {
    try {
      const updated = await announcementsApi.update(a.id, { pinned: !a.pinned })
      setItems((prev) =>
        prev.map((x) => (x.id === a.id ? updated : x)).sort((m, n) =>
          (n.pinned ? 1 : 0) - (m.pinned ? 1 : 0) ||
          new Date(n.createdAt).getTime() - new Date(m.createdAt).getTime(),
        ),
      )
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update")
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 p-4 sm:p-8">
      {/* Hero Section */}
      <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-background/50 p-6 shadow-sm backdrop-blur-md">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.03] via-transparent to-primary/[0.03]" />
        <motion.div
          className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none"
          animate={{ scale: [1, 1.1, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <motion.div 
              className="flex items-center gap-3.5"
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-indigo-500/10 text-indigo-500 shadow-inner ring-1 ring-indigo-500/20">
                <Megaphone className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground/90">Announcements</h1>
            </motion.div>
            <motion.p 
              className="max-w-lg text-[13px] font-normal leading-relaxed text-muted-foreground/70"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ delay: 0.1 }}
            >
              {canPost
                ? "Broadcast important updates to your supervised teams or target specific groups with smart audience filters."
                : "Stay updated with the latest news and announcements from your project supervisors."}
            </motion.p>
          </div>
          <div className="flex items-center gap-3">
            {canPost && (
              <Button 
                className="h-11 rounded-2xl bg-primary px-6 text-xs font-semibold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" /> 
                New Post
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <Card className="overflow-hidden rounded-[32px] border-border/50 bg-background/50 shadow-xl backdrop-blur-md">
        {/* Filters Header */}
        <div className="border-b border-border/40 bg-muted/5 p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Filter className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Recent Updates</h2>
                <p className="text-xs font-medium text-muted-foreground/60">Filter announcements by role or search content.</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                <Input 
                  placeholder="Search updates..." 
                  className="h-10 w-full rounded-xl border-border/40 bg-background/50 pl-9 transition-all focus:ring-primary/20 sm:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Role Filters */}
              <ToggleGroup 
                type="single" 
                value={roleFilter} 
                onValueChange={(v) => v && setRoleFilter(v)}
                className="justify-start rounded-xl border border-border/40 bg-background/50 p-1"
              >
                <ToggleGroupItem value="all" className="h-8 rounded-lg px-3 text-[10px] font-semibold uppercase tracking-wider">
                  All
                </ToggleGroupItem>
                <ToggleGroupItem value="admin" className="h-8 gap-1.5 rounded-lg px-3 text-[10px] font-semibold uppercase tracking-wider">
                  <ShieldCheck className="h-3 w-3" /> Admin
                </ToggleGroupItem>
                <ToggleGroupItem value="doctor" className="h-8 gap-1.5 rounded-lg px-3 text-[10px] font-semibold uppercase tracking-wider">
                  <GraduationCap className="h-3 w-3" /> Doctor
                </ToggleGroupItem>
                <ToggleGroupItem value="ta" className="h-8 gap-1.5 rounded-lg px-3 text-[10px] font-semibold uppercase tracking-wider">
                  <User className="h-3 w-3" /> TA
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-[28px] border border-border/40 p-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-3">
                      <div className="flex gap-2">
                        <Skeleton className="h-4 w-24 rounded-full" />
                        <Skeleton className="h-4 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-6 w-1/3 rounded-lg" />
                      <Skeleton className="h-16 w-full rounded-xl" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[32px] border border-red-500/10 bg-red-500/5 p-12 text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 shadow-sm ring-1 ring-red-500/20">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h4 className="text-xl font-semibold tracking-tight text-red-900 dark:text-red-100">Couldn't load announcements</h4>
              <p className="mx-auto mt-2 max-w-[280px] text-sm font-medium text-red-700/60 dark:text-red-300/60 leading-relaxed">
                There was a technical issue fetching the latest updates. Please try again.
              </p>
              <Button variant="outline" className="mt-8 rounded-xl border-red-200/50 bg-background text-red-600 hover:bg-red-50" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[32px] border border-dashed border-border/60 bg-muted/5 p-12 text-center">
              <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-background text-muted-foreground/30 shadow-sm ring-1 ring-border/50">
                <Megaphone className="h-10 w-10" />
              </div>
              <h4 className="text-xl font-semibold tracking-tight text-foreground/80">
                {searchQuery || roleFilter !== "all" ? "No matches found" : "No announcements found"}
              </h4>
              <p className="mx-auto mt-2 max-w-[280px] text-sm font-medium text-muted-foreground/50 leading-relaxed">
                {searchQuery || roleFilter !== "all" 
                  ? "Try adjusting your filters or search query to find what you're looking for."
                  : canPost
                    ? "You haven't posted any updates yet. Click \"New Post\" to reach your teams."
                    : "Your supervisors haven't posted any updates for you yet."}
              </p>
              {(searchQuery || roleFilter !== "all") && (
                <Button 
                  variant="ghost" 
                  className="mt-6 text-xs font-semibold uppercase tracking-wider text-primary hover:bg-primary/5"
                  onClick={() => {
                    setSearchQuery("")
                    setRoleFilter("all")
                  }}
                >
                  Clear all filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredItems.map((a, i) => {
                  const isMine = a.authorUserId === currentUser?.id
                  const reachedTeamCount = a.targetTeamCount ?? a.targetTeams?.length ?? (a.team ? 1 : 0)
                  const date = new Date(a.createdAt)
                  
                  return (
                    <motion.div
                      key={a.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ 
                        duration: 0.4,
                        delay: Math.min(i * 0.05, 0.4),
                        ease: [0.22, 1, 0.36, 1]
                      }}
                    >
                      <Card className={cn(
                        "group relative overflow-hidden rounded-[28px] border border-border/50 bg-background/50 p-6 transition-all hover:border-primary/20 hover:bg-background hover:shadow-xl hover:shadow-primary/5",
                        a.pinned && "border-indigo-500/20 bg-indigo-500/[0.02] ring-1 ring-indigo-500/10",
                      )}>
                        {a.pinned && (
                          <div className="absolute right-0 top-0 h-20 w-20">
                            <div className="absolute right-[-24px] top-[12px] rotate-45 bg-indigo-600 px-8 py-1 shadow-lg">
                              <Pin className="h-3 w-3 text-white" />
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-5">
                          <Avatar className="h-12 w-12 shrink-0 border border-border/40 shadow-sm transition-transform duration-300 group-hover:scale-105">
                            <AvatarImage src={a.author?.avatarUrl ?? undefined} />
                            <AvatarFallback className="bg-indigo-500/10 font-semibold text-indigo-600 text-sm">
                              {getInitials(a.author?.fullName ?? "?")}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0 space-y-4">
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="text-sm font-semibold tracking-tight text-foreground/90">{a.author?.fullName}</span>
                                <Badge variant="outline" className="rounded-full border-none bg-muted/60 px-2 py-0 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/80 shadow-none">
                                  {a.authorRole.toLowerCase()}
                                </Badge>
                                
                                <div className="h-1 w-1 rounded-full bg-border/60" />
                                
                                {a.team ? (
                                  <Badge className="rounded-full border-none bg-blue-500/10 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-blue-600 shadow-none">
                                    <Users className="mr-1 h-3 w-3" /> {a.team.name}
                                  </Badge>
                                ) : (
                                  <Badge className="rounded-full border-none bg-purple-500/10 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-purple-600 shadow-none">
                                    <Globe className="mr-1 h-3 w-3" /> All teams
                                  </Badge>
                                )}

                                {canPost && reachedTeamCount > 0 && (
                                  <Badge className="rounded-full border-none bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-600 shadow-none">
                                    <Send className="mr-1 h-3 w-3" /> Reached {reachedTeamCount}
                                  </Badge>
                                )}

                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                                  {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              
                              <h3 className="text-xl font-semibold tracking-tight text-foreground/90 group-hover:text-primary transition-colors leading-tight">
                                {a.title}
                              </h3>
                            </div>

                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <p className="whitespace-pre-wrap text-[15px] font-normal leading-relaxed text-muted-foreground/80">
                                {a.content}
                              </p>
                            </div>
                          </div>

                          {isMine && (
                            <div className="flex flex-col items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button
                                variant="outline"
                                size="icon"
                                className={cn(
                                  "h-9 w-9 rounded-xl border-border/40 bg-background/50 transition-all",
                                  a.pinned ? "text-indigo-600 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20" : "hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                                )}
                                onClick={() => togglePin(a)}
                                title={a.pinned ? "Unpin" : "Pin"}
                              >
                                <Pin className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-xl border-red-200/40 bg-red-500/5 text-red-600 transition-all hover:bg-red-500 hover:text-white hover:border-red-500"
                                onClick={() => setDeleteTargetId(a.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </Card>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null) }}
        title="Delete this announcement?"
        description={
          deleteTarget
            ? `"${deleteTarget.title}" will be removed for everyone who can see it. This can't be undone.`
            : "This announcement will be removed for everyone who can see it. This can't be undone."
        }
        onConfirm={async () => { if (deleteTargetId) await performDelete(deleteTargetId) }}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setSubmitAttempted(false)
            setSubmitError(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-[32px] border-border/50 bg-background/95 p-0 shadow-2xl backdrop-blur-xl">
          <div className="sticky top-0 z-10 border-b border-border/40 bg-background/80 p-6 backdrop-blur-md">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold tracking-tight">New Post</DialogTitle>
                  <p className="text-xs font-normal text-muted-foreground/60">Broadcast updates to your teams.</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="space-y-6 p-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Post Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Project Phase 2 Deadline Updated"
                  className={cn(
                    "h-12 rounded-2xl border-border/40 bg-background/80 transition-all focus:ring-indigo-500/20",
                    isTitleInvalid && "border-red-500/50 focus:ring-red-500/20",
                  )}
                  maxLength={200}
                />
                {isTitleInvalid && (
                  <p className="px-1 text-[10px] font-semibold text-red-500 uppercase tracking-wider">
                    Title must be at least 3 characters
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Message Content</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your detailed announcement here..."
                  className={cn(
                    "min-h-[160px] rounded-2xl border-border/40 bg-background/80 p-4 transition-all focus:ring-indigo-500/20 resize-none",
                    isContentInvalid && "border-red-500/50 focus:ring-red-500/20",
                  )}
                  maxLength={5000}
                />
                <div className="flex items-center justify-between px-1">
                  {isContentInvalid ? (
                    <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">
                      Content must be at least 5 characters
                    </p>
                  ) : <div />}
                  <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">
                    {content.length}/5000
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Target Group</Label>
                  <Select value={targetTeam} onValueChange={setTargetTeam}>
                    <SelectTrigger className="h-11 rounded-2xl border-border/40 bg-background/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="ALL" className="rounded-xl">
                        <span className="flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5" /> All teams
                        </span>
                      </SelectItem>
                      {supervisedTeams.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="rounded-xl">{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-muted/5 px-4 py-2 mt-auto h-11">
                  <Label className="text-xs font-semibold text-foreground/70">Pin to top</Label>
                  <Switch checked={pinned} onCheckedChange={setPinned} className="data-[state=checked]:bg-primary" />
                </div>
              </div>

              {targetTeam === "ALL" && (
                <div className="rounded-[24px] border border-primary/10 bg-primary/5 p-5 space-y-4">
                  <div className="space-y-2">
                    <Label className="px-1 text-[10px] font-semibold uppercase tracking-wider text-primary/60">Smart Audience Filter</Label>
                    <Select value={audience} onValueChange={(v) => setAudience(v as AnnouncementAudience)}>
                      <SelectTrigger className="h-10 rounded-xl border-primary/20 bg-background/80">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all" className="rounded-lg">{role === "admin" ? "Global Broadcast" : "All Supervised Teams"}</SelectItem>
                        <SelectItem value="byStage" className="rounded-lg">Target by SDLC Stage</SelectItem>
                        <SelectItem value="overdue" className="rounded-lg">Teams with Overdue Tasks</SelectItem>
                        <SelectItem value="needsProposalApproval" className="rounded-lg">Pending Proposal Approval</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {audience === "byStage" && (
                    <div className="space-y-2">
                      <Label className="px-1 text-[10px] font-semibold uppercase tracking-wider text-primary/60">Select Stage</Label>
                      <Select value={audienceParam} onValueChange={setAudienceParam}>
                        <SelectTrigger className="h-10 rounded-xl border-primary/20 bg-background/80">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {["REQUIREMENTS", "DESIGN", "IMPLEMENTATION", "TESTING", "DEPLOYMENT", "MAINTENANCE"].map((s) => (
                            <SelectItem key={s} value={s} className="rounded-lg">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="rounded-xl bg-background/60 border border-primary/10 p-3">
                    {previewLoading ? (
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        Calculating audience...
                      </div>
                    ) : audiencePreview.length === 0 ? (
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                        <AlertCircle className="h-3 w-3" />
                        No teams match this filter
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">
                          Will reach {audiencePreview.length} team{audiencePreview.length === 1 ? "" : "s"}:
                        </p>
                        <p className="text-[11px] font-normal text-muted-foreground/60 line-clamp-1 italic">
                          {audiencePreview.map((t) => t.name).join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {submitError && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-600">
                {submitError}
              </p>
            )}

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="h-12 flex-1 rounded-2xl border-border/40 font-semibold text-xs uppercase tracking-widest"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                className="h-12 flex-[2] rounded-2xl bg-primary font-semibold text-xs uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => void handleCreate()}
                disabled={saving}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Post Announcement
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
