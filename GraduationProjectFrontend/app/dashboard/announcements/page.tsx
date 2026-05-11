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
  AlertCircle, RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth-store"
import { announcementsApi, audienceApi, type Announcement, type AnnouncementAudience, type AudiencePreviewTeam } from "@/lib/api/supervisor-tools"
import { toast } from "sonner"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

export default function AnnouncementsPage() {
  const { currentUser } = useAuthStore()
  const role = currentUser?.role?.toLowerCase() ?? ""
  const canPost = role === "doctor" || role === "ta" || role === "admin"

  const { data: myTeamState } = useMyTeamState()
  const supervisedTeams = useMemo(() => myTeamState?.supervisedTeams ?? [], [myTeamState])

  const [items, setItems]     = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle]     = useState("")
  const [content, setContent] = useState("")
  const [targetTeam, setTargetTeam] = useState<string>("ALL")
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)

  // Smart audience targeting
  const [audience, setAudience] = useState<AnnouncementAudience>("all")
  const [audienceParam, setAudienceParam] = useState<string>("REQUIREMENTS")
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreviewTeam[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)

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
    if (title.trim().length < 3 || content.trim().length < 5) {
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
      setItems((prev) => [created, ...prev])
      toast.success(targetTeam === "ALL"
        ? `Announcement sent to ${audiencePreview.length} team${audiencePreview.length === 1 ? "" : "s"}`
        : "Announcement sent to team")
      setDialogOpen(false)
      setTitle("")
      setContent("")
      setTargetTeam("ALL")
      setPinned(false)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to post")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this announcement?")) return
    try {
      await announcementsApi.delete(id)
      setItems((prev) => prev.filter((a) => a.id !== id))
      toast.success("Announcement deleted")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete")
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 sm:p-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 border border-border/50 relative overflow-hidden bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 via-transparent to-violet-500/5" />
        <motion.div
          className="absolute -right-20 -top-20 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl pointer-events-none"
          animate={{ scale: [1, 1.15, 1], rotate: [0, 120, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <motion.h1 className="text-3xl font-bold mb-1.5 flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <Megaphone className="h-7 w-7 text-pink-500" />
              Announcements
            </motion.h1>
            <motion.p className="text-muted-foreground"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              {canPost
                ? "Broadcast updates to all your supervised teams or target a specific team"
                : "Updates from your supervisors"}
            </motion.p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing}>
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
            {canPost && (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> New Announcement
              </Button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-24" /></Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-12 text-center border-border/50">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <p className="text-muted-foreground mb-4">Failed to load announcements</p>
          <Button variant="outline" onClick={() => void load()}>Try again</Button>
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-border/60">
          <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {canPost
              ? "No announcements yet — click \"New Announcement\" to post one."
              : "No announcements from your supervisors yet."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {items.map((a, i) => {
              const isMine = a.authorUserId === currentUser?.id
              return (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                >
                  <Card className={cn(
                    "p-5 border-border/50 transition-all relative overflow-hidden",
                    a.pinned && "border-pink-500/30 bg-pink-500/[0.04]",
                  )}>
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 shrink-0 ring-2 ring-border/40">
                        <AvatarImage src={a.author?.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs bg-pink-500/10 text-pink-500">
                          {getInitials(a.author?.fullName ?? "?")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="font-semibold text-sm">{a.author?.fullName ?? "Unknown"}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">{a.authorRole.toLowerCase()}</Badge>
                          {a.team ? (
                            <Badge variant="outline" className="text-[10px] gap-1 border-blue-500/30 text-blue-500">
                              <Users className="h-3 w-3" /> {a.team.name}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] gap-1 border-purple-500/30 text-purple-500">
                              <Globe className="h-3 w-3" /> All supervised teams
                            </Badge>
                          )}
                          {a.pinned && (
                            <Badge className="gap-1 border-0 bg-pink-500/10 px-2 text-[10px] font-medium text-pink-600 shadow-none hover:bg-pink-500/10 dark:text-pink-300">
                              <Pin className="h-3 w-3" /> Pinned
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(a.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <h3 className="font-semibold text-base mb-1">{a.title}</h3>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
                          {a.content}
                        </p>
                      </div>

                      {isMine && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-8 w-8 rounded-lg", a.pinned && "text-pink-500 hover:bg-pink-500/10")}
                            onClick={() => togglePin(a)}
                            title={a.pinned ? "Unpin" : "Pin"}
                            aria-label={a.pinned ? "Unpin announcement" : "Pin announcement"}
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(a.id)}
                            aria-label="Delete announcement"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-pink-500" />
              New Announcement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Submission deadline moved to Friday"
                className="mt-1.5"
                maxLength={200}
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your announcement..."
                className="mt-1.5 resize-none"
                rows={5}
                maxLength={5000}
              />
              <p className="text-[10px] text-muted-foreground mt-1">{content.length}/5000</p>
            </div>
            <div>
              <Label>Send to</Label>
              <Select value={targetTeam} onValueChange={setTargetTeam}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    <span className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5" /> All supervised teams (filtered)
                    </span>
                  </SelectItem>
                  {supervisedTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {targetTeam === "ALL" && (
              <div className="space-y-2 border-l-2 border-primary/30 pl-3">
                <Label className="text-xs">Audience filter</Label>
                <Select value={audience} onValueChange={(v) => setAudience(v as AnnouncementAudience)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All my supervised teams</SelectItem>
                    <SelectItem value="byStage">Teams in a specific SDLC stage</SelectItem>
                    <SelectItem value="overdue">Teams with overdue deadlines</SelectItem>
                    <SelectItem value="needsProposalApproval">Teams whose proposal isn&apos;t approved yet</SelectItem>
                  </SelectContent>
                </Select>

                {audience === "byStage" && (
                  <Select value={audienceParam} onValueChange={setAudienceParam}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["REQUIREMENTS", "DESIGN", "IMPLEMENTATION", "TESTING", "DEPLOYMENT", "MAINTENANCE"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Live preview */}
                <div className="rounded-lg bg-muted/40 border border-border/40 p-2 text-xs">
                  {previewLoading ? (
                    <span className="text-muted-foreground">Calculating audience…</span>
                  ) : audiencePreview.length === 0 ? (
                    <span className="text-amber-600">⚠ This filter currently matches no teams.</span>
                  ) : (
                    <>
                      <p className="font-medium mb-1">
                        Will reach <b>{audiencePreview.length} team{audiencePreview.length === 1 ? "" : "s"}</b>:
                      </p>
                      <p className="text-muted-foreground line-clamp-2">
                        {audiencePreview.map((t) => t.name).join(", ")}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
              <div>
                <Label className="cursor-pointer flex items-center gap-2"><Pin className="h-3.5 w-3.5" /> Pin to top</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Pinned announcements stay at the top of the list.
                </p>
              </div>
              <Switch checked={pinned} onCheckedChange={setPinned} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} disabled={saving} className="flex-1">
                <Send className="h-4 w-4 mr-2" />
                {saving ? "Posting…" : "Post Announcement"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
