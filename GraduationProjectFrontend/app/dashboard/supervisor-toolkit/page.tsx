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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Lock,
  Users,
  StickyNote,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Activity,
  Plus,
  Trash2,
  FileText,
  GitPullRequest,
  AlertTriangle,
  Megaphone,
  CalendarPlus,
  ListChecks,
  Wand2,
  Save,
  RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth-store"
import {
  supervisorNotesApi,
  deadlinesApi,
  activityApi,
  rubricTemplatesApi,
  type SupervisorNote,
  type Deadline,
  type ActivityEvent,
  type DeliverableType,
  type RubricTemplate,
} from "@/lib/api/supervisor-tools"
import { getDefaultRubric } from "@/components/dashboard/rubric-editor"
import type { RubricItem } from "@/lib/api/submissions"
import { teamsApi } from "@/lib/api/teams"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"

// ─── Constants ───────────────────────────────────────────────────────────────

const DELIVERABLE_TYPES: DeliverableType[] = [
  "SRS", "UML", "PROTOTYPE", "CODE", "TEST_PLAN", "FINAL_REPORT", "PRESENTATION",
]

const ACTIVITY_ICON: Record<ActivityEvent["type"], React.ElementType> = {
  submission: FileText,
  proposal: FileText,
  meeting: CalendarPlus,
  risk: AlertTriangle,
  task: GitPullRequest,
  note: StickyNote,
  deadline: CalendarClock,
  announcement: Megaphone,
}

const ACTIVITY_COLOR: Record<ActivityEvent["type"], string> = {
  submission: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  proposal: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  meeting: "bg-green-500/10 text-green-500 border-green-500/30",
  risk: "bg-red-500/10 text-red-500 border-red-500/30",
  task: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  note: "bg-gray-500/10 text-gray-500 border-gray-500/30",
  deadline: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
  announcement: "bg-indigo-500/10 text-indigo-500 border-indigo-500/30",
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

// ─── Sub-Panels ─────────────────────────────────────────────────────────────

function NotesPanel({ teamId, allTeamIds, teamOptions }: { teamId: string; allTeamIds: string[]; teamOptions: {id: string, name: string}[] }) {
  const [notes, setNotes] = useState<SupervisorNote[]>([])
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState("")
  const [saving, setSaving] = useState(false)
  const { currentUser } = useAuthStore()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const targetIds = teamId === "all" ? allTeamIds : [teamId]
      const results = await Promise.all(targetIds.map(id => supervisorNotesApi.list(id).catch(() => [])))
      const allNotes = results.flat().sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setNotes(allNotes)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load notes")
    } finally {
      setLoading(false)
    }
  }, [teamId, allTeamIds])

  useEffect(() => { void load() }, [load])

  async function handleAdd() {
    if (newNote.trim().length === 0 || teamId === "all") return
    setSaving(true)
    try {
      const created = await supervisorNotesApi.create(teamId, newNote.trim())
      setNotes((prev) => [created, ...prev])
      setNewNote("")
      toast.success("Note added")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add note")
    } finally {
      setSaving(false)
    }
  }

  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function performDelete(id: string) {
    try {
      await supervisorNotesApi.delete(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
      toast.success("Note deleted")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete")
      throw e
    }
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => { if (!o) setDeleteId(null) }}
        title="Delete this note?"
        description="The note is permanently removed. Other supervisors of this team won't see it anymore."
        onConfirm={async () => { if (deleteId) await performDelete(deleteId) }}
      />

      <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
        <p className="text-xs text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
          <Lock className="h-3 w-3" /> 
          {teamId === "all" 
            ? "Viewing notes from all your supervised teams. Access is shared between the Doctor and TA of each respective team." 
            : "Shared Supervision: These notes are private and visible only to you and the other supervisors (Doctor/TA) assigned to this team."}
        </p>
      </div>

      {teamId !== "all" && (
        <Card className="p-4 border-border/50">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Add a new note</Label>
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="e.g. Team seems to be falling behind on testing — need to check in next meeting…"
            className="resize-none mb-2"
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAdd} disabled={saving || newNote.trim().length === 0}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {saving ? "Saving…" : "Add note"}
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-12 w-full" /></Card>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
          <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No notes yet. {teamId !== "all" && "Use the box above to start tracking observations."}
        </Card>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {notes.map((n, i) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: Math.min(i * 0.03, 0.2) }}
              >
                <Card className="p-4 border-border/50 hover:border-border transition-colors">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={n.author?.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">{getInitials(n.author?.fullName ?? "?")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm">{n.author?.fullName ?? "Unknown"}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{n.authorRole.toLowerCase()}</Badge>
                        {teamId === "all" && n.teamId && (
                           <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-medium border-muted-foreground/20">
                             {teamOptions.find(t => t.id === n.teamId)?.name ?? "Shared Team"}
                           </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{n.content}</p>
                    </div>
                    {n.authorUserId === currentUser?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive shrink-0"
                        onClick={() => setDeleteId(n.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}

function formatRelativeTime(dueDate: string) {
  const due = new Date(dueDate)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const overdue = diffMs < 0
  const absDiff = Math.abs(diffMs)

  const minutes = Math.floor(absDiff / (1000 * 60))
  const hours = Math.floor(absDiff / (1000 * 60 * 60))
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24))

  if (overdue) {
    if (minutes < 60) return `${minutes}m overdue`
    if (hours < 24) return `${hours}h overdue`
    return `${days}d overdue`
  } else {
    if (minutes < 1) return "due now"
    if (minutes < 60) return `${minutes}m left`
    if (hours < 24) return `${hours}h left`
    return `${days}d left`
  }
}

function DeadlinesPanel({ teamId, allTeamIds, userRole }: { teamId: string; allTeamIds: string[]; userRole: string }) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading]     = useState(true)
  const [type, setType] = useState<DeliverableType>("SRS")
  const [date, setDate] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const isDoctorOrAdmin = userRole === "DOCTOR" || userRole === "ADMIN"

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const targetIds = teamId === "all" ? allTeamIds : [teamId]
      const results = await Promise.all(targetIds.map(id => deadlinesApi.list({ teamId: id }).catch(() => [])))
      const allDeadlines = results.flat().sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      setDeadlines(allDeadlines)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load deadlines")
    } finally {
      setLoading(false)
    }
  }, [teamId, allTeamIds])

  useEffect(() => { void load() }, [load])

  async function handleSave() {
    if (!date) { toast.error("Pick a date"); return }
    
    // Check if TA is trying to overwrite a Doctor's deadline
    if (!isDoctorOrAdmin) {
      const existing = deadlines.find(d => d.deliverableType === type && d.setBy?.role === "DOCTOR")
      if (existing) {
        toast.error(`A Doctor has already set a deadline for ${type}. You cannot override it.`)
        return
      }
    }

    setSaving(true)
    try {
      const targetIds = teamId === "all" ? allTeamIds : [teamId]
      const payload = {
        deliverableType: type,
        dueDate: new Date(date).toISOString(),
        note: note || undefined,
      }

      await Promise.all(targetIds.map(id => deadlinesApi.upsert({ ...payload, teamId: id })))
      
      toast.success(teamId === "all" ? "Deadlines applied to all teams" : "Deadline saved")
      setDate("")
      setNote("")
      await load()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const deleteTarget = useMemo(
    () => (deleteId ? deadlines.find((d) => d.id === deleteId) ?? null : null),
    [deleteId, deadlines],
  )

  const canDelete = (d: Deadline) => {
    if (isDoctorOrAdmin) return true
    // TA can only delete if it wasn't set by a Doctor/Admin
    return d.setBy?.role !== "DOCTOR" && d.setBy?.role !== "ADMIN"
  }

  async function performDelete(id: string) {
    const target = deadlines.find(d => d.id === id)
    if (target && !canDelete(target)) {
      toast.error("You cannot delete a deadline set by a Doctor")
      return
    }

    try {
      await deadlinesApi.delete(id)
      setDeadlines((prev) => prev.filter((d) => d.id !== id))
      toast.success("Deadline deleted")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete")
      throw e
    }
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => { if (!o) setDeleteId(null) }}
        title="Delete this deadline?"
        description={
          deleteTarget
            ? `The ${deleteTarget.deliverableType} deadline (${new Date(deleteTarget.dueDate).toLocaleDateString()}) will be removed. Late submissions to this deliverable will no longer be flagged automatically.`
            : "The deadline will be removed."
        }
        onConfirm={async () => { if (deleteId) await performDelete(deleteId) }}
      />

      {/* Enhanced Creation Form */}
      <Card className="overflow-hidden border-none shadow-xl bg-white dark:bg-zinc-950 ring-1 ring-border/50">
        <div className="p-0">
          <div className="bg-primary/5 px-6 py-4 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <CalendarPlus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight">
                  {teamId === "all" ? "Global Deadline Broadcast" : "New Team Deadline"}
                </h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  {teamId === "all" ? "Affects all supervised teams" : "Schedule deliverable due date"}
                </p>
              </div>
            </div>
            {saving && (
              <Badge variant="outline" className="animate-pulse bg-primary/5 text-primary border-primary/20">
                <RotateCcw className="h-3 w-3 animate-spin mr-1.5" />
                Processing...
              </Badge>
            )}
          </div>
          
          <div className="p-6 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground/70 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" /> Deliverable Type
                </Label>
                <Select value={type} onValueChange={(v) => setType(v as DeliverableType)}>
                  <SelectTrigger className="h-11 bg-muted/30 border-border/40 hover:bg-muted/50 transition-colors rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-sm py-2.5 font-medium">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground/70 flex items-center gap-2">
                  <CalendarClock className="h-3.5 w-3.5" /> Due Date & Time
                </Label>
                <Input 
                  type="datetime-local" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                  className="h-11 bg-muted/30 border-border/40 hover:bg-muted/50 transition-colors rounded-xl font-medium px-4" 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground/70 flex items-center gap-2">
                <Megaphone className="h-3.5 w-3.5" /> Supervisor Instructions
              </Label>
              <div className="relative group">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Ensure all diagrams follow the UML 2.5 standard..."
                  className="h-11 bg-muted/30 border-border/40 hover:bg-muted/50 transition-colors rounded-xl text-sm pl-4 pr-12"
                  maxLength={500}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  {note.length}/500
                </div>
              </div>
            </div>

            <Button 
              size="lg" 
              onClick={handleSave} 
              disabled={saving || !date}
              className="w-full h-12 shadow-lg shadow-primary/20 font-bold rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              {saving ? (
                <RotateCcw className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Plus className="h-5 w-5 mr-2" />
              )}
              {saving ? "Creating Deadlines..." : "Set Deliverable Deadline"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Deadline List Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold tracking-tight text-foreground/80">Active Deadlines</h4>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{deadlines.length} scheduled</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-5 border-border/40 shadow-none rounded-2xl">
                <div className="flex gap-4">
                  <Skeleton className="h-12 w-12 rounded-2xl" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-1/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : deadlines.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-border/40 rounded-[2rem] bg-muted/5"
          >
            <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-5 ring-8 ring-muted/20">
              <CalendarClock className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-base font-bold text-foreground/60">No deadlines scheduled</p>
            <p className="text-sm text-muted-foreground/50 mt-1 max-w-[240px] text-center">Your teams have a clear schedule. Set a new deadline above to get started.</p>
          </motion.div>
        ) : (
          <div className="grid gap-3.5">
            <AnimatePresence mode="popLayout">
              {deadlines.map((d, idx) => {
                const due = new Date(d.dueDate)
                const now = new Date()
                const diffMs = due.getTime() - now.getTime()
                const overdue = diffMs < 0
                const days = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24))
                const deletable = canDelete(d)
                const isDoctorSet = d.setBy?.role === "DOCTOR"
                const relativeText = formatRelativeTime(d.dueDate)

                return (
                  <motion.div
                    key={d.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, type: "spring", stiffness: 100 }}
                  >
                    <Card className={cn(
                      "group relative overflow-hidden border-border/40 hover:border-primary/40 transition-all duration-300 hover:shadow-xl rounded-[1.25rem] bg-card",
                      overdue && "bg-red-500/[0.01] border-red-500/20 hover:border-red-500/40",
                      !overdue && days <= 3 && "bg-amber-500/[0.01] border-amber-500/20 hover:border-amber-500/40"
                    )}>
                      {/* Accent highlight */}
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300",
                        overdue ? "bg-red-500" : days <= 3 ? "bg-amber-500" : "bg-primary"
                      )} />

                      <div className="p-5 flex items-center gap-5">
                        <div className={cn(
                          "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 duration-300",
                          overdue ? "bg-red-500/10 text-red-600" : days <= 3 ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"
                        )}>
                          <FileText className="h-7 w-7" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h5 className="font-extrabold text-base tracking-tight">{d.deliverableType}</h5>
                            <Badge 
                              variant={overdue ? "destructive" : "secondary"} 
                              className={cn(
                                "text-[10px] h-5 px-2 uppercase tracking-tighter font-bold rounded-lg border-none",
                                !overdue && days <= 3 && "bg-amber-500 text-white hover:bg-amber-600",
                                !overdue && days > 3 && "bg-primary/10 text-primary hover:bg-primary/20"
                              )}
                            >
                              {relativeText}
                            </Badge>
                            {isDoctorSet && (
                              <Badge variant="outline" className="text-[10px] h-5 px-2 border-indigo-500/20 text-indigo-600 bg-indigo-500/5 font-bold uppercase tracking-tighter rounded-lg">
                                <Lock className="h-2.5 w-2.5 mr-1.5" /> Protected
                              </Badge>
                            )}
                            {teamId === "all" && d.team && (
                              <Badge variant="outline" className="text-[10px] h-5 px-2 font-bold text-muted-foreground/70 border-muted-foreground/10 bg-muted/30 rounded-lg">
                                {d.team.name}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                            <div className="flex items-center gap-2 bg-muted/30 px-2 py-1 rounded-md">
                              <CalendarClock className="h-3.5 w-3.5 text-primary/60" />
                              <span className="text-foreground/80">{due.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              <span className="opacity-30">|</span>
                              <span className="text-foreground/80">{due.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            {d.setBy && (
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5 ring-2 ring-background shadow-sm">
                                  <AvatarImage src={d.setBy.avatarUrl ?? undefined} />
                                  <AvatarFallback className="text-[8px] font-bold">{getInitials(d.setBy.fullName)}</AvatarFallback>
                                </Avatar>
                                <span className="hover:text-foreground transition-colors cursor-default">{d.setBy.fullName}</span>
                              </div>
                            )}
                          </div>

                          {d.note && (
                            <div className="mt-3 relative">
                              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border/60 rounded-full" />
                              <p className="pl-3 text-xs text-muted-foreground/90 italic leading-relaxed">
                                &quot;{d.note}&quot;
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {deletable ? (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all opacity-0 group-hover:opacity-100" 
                              onClick={() => setDeleteId(d.id)}
                            >
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          ) : (
                            <div className="p-2 text-muted-foreground/30" title="Protected by Doctor Authority">
                              <Lock className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

function ActivityPanel({ teamId, allTeamIds, teamOptions }: { teamId: string; allTeamIds: string[]; teamOptions: {id: string, name: string}[] }) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 8

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const targetIds = teamId === "all" ? allTeamIds : [teamId]
      const results = await Promise.all(targetIds.map(async id => {
        const data = await activityApi.forTeam(id).catch(() => [])
        return data.map(e => ({ ...e, teamId: id }))
      }))
      const allEvents = results.flat().sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      setEvents(allEvents as (ActivityEvent & { teamId: string })[])
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load activity")
    } finally {
      setLoading(false)
    }
  }, [teamId, allTeamIds])

  useEffect(() => {
    void load()
    setPage(1) // reset page when team changes
  }, [load])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-4"><Skeleton className="h-12 w-full" /></Card>
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        No activity yet.
      </Card>
    )
  }

  const totalPages = Math.ceil(events.length / pageSize)
  const paginatedEvents = events.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="absolute left-[20px] top-2 bottom-2 w-px bg-border/60" />
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {paginatedEvents.map((e, i) => {
              const Icon = ACTIVITY_ICON[e.type]
              return (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="relative pl-12"
                >
                  <div className={cn(
                    "absolute left-0 top-2 h-10 w-10 rounded-full border flex items-center justify-center shadow-sm",
                    ACTIVITY_COLOR[e.type],
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <Card className="p-3 border-border/50 hover:shadow-md transition-shadow cursor-default">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold tracking-tight">{e.title}</p>
                          <Badge variant="outline" className="text-[9px] uppercase tracking-tighter h-4 px-1 opacity-70">
                            {e.category}
                          </Badge>
                          {teamId === "all" && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-medium border-muted-foreground/20">
                              {teamOptions.find(t => t.id === (e as any).teamId)?.name ?? "Shared Team"}
                            </Badge>
                          )}
                        </div>
                        {e.detail && <p className="text-xs text-muted-foreground line-clamp-2">{e.detail}</p>}
                        <div className="flex items-center gap-1.5 mt-2">
                          {e.actor?.name && (
                            <span className="text-[10px] font-medium text-foreground/70">{e.actor.name}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground opacity-40">·</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <p className="text-xs text-muted-foreground font-medium">
            Showing <span className="text-foreground">{(page - 1) * pageSize + 1}</span> to <span className="text-foreground">{Math.min(page * pageSize, events.length)}</span> of <span className="text-foreground">{events.length}</span> activities
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1 text-xs font-bold px-2">
              <span className="text-primary">{page}</span>
              <span className="text-muted-foreground opacity-40">/</span>
              <span>{totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Team Pulse (header stats strip) ────────────────────────────────────────
//
// Quick "vital signs" for the selected team — current SDLC stage, action
// queue counts, and the last activity timestamp. Sits above the tabs so the
// supervisor sees what matters before drilling in.
type PulseCounts = {
  stage: string | null
  notes: number
  deadlines: number
  overdueDeadlines: number
  activityLastWeek: number
  lastActivityAt: string | null
}

function TeamPulse({ teamId, allTeamIds }: { teamId: string; allTeamIds: string[] }) {
  const [counts, setCounts] = useState<PulseCounts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        const targetIds = teamId === "all" ? allTeamIds : [teamId]
        
        const results = await Promise.all(targetIds.map(async (id) => {
          const [notes, deadlines, activity] = await Promise.all([
            supervisorNotesApi.list(id).catch(() => []),
            deadlinesApi.list({ teamId: id }).catch(() => []),
            activityApi.forTeam(id).catch(() => []),
          ])
          return { id, notes, deadlines, activity }
        }))

        const allNotes = results.flatMap(r => r.notes)
        const allDeadlines = results.flatMap(r => r.deadlines)
        const allActivity = results.flatMap(r => r.activity).sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )

        const now = Date.now()
        const overdueDeadlines = allDeadlines.filter((d) => new Date(d.dueDate).getTime() < now).length
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000
        const activityLastWeek = allActivity.filter((e) => new Date(e.timestamp).getTime() > weekAgo).length
        const lastActivityAt = allActivity[0]?.timestamp ?? null

        let stage: string | null = null
        if (teamId !== "all") {
          try {
            const team = await teamsApi.getById(teamId)
            stage = team.stage
          } catch { /* fall through */ }
        }

        if (cancelled) return
        setCounts({
          stage,
          notes: allNotes.length,
          deadlines: allDeadlines.length,
          overdueDeadlines,
          activityLastWeek,
          lastActivityAt,
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [teamId, allTeamIds])

  if (loading || !counts) {
    return (
      <Card className="p-4 border-border/50">
        <Skeleton className="h-12 w-full" />
      </Card>
    )
  }

  const STAGE_COLORS: Record<string, string> = {
    REQUIREMENTS: "border-blue-500/30 text-blue-500 bg-blue-500/5",
    DESIGN: "border-purple-500/30 text-purple-500 bg-purple-500/5",
    IMPLEMENTATION: "border-amber-500/30 text-amber-500 bg-amber-500/5",
    TESTING: "border-cyan-500/30 text-cyan-500 bg-cyan-500/5",
    DEPLOYMENT: "border-green-500/30 text-green-500 bg-green-500/5",
    MAINTENANCE: "border-gray-500/30 text-gray-500 bg-gray-500/5",
  }

  function relative(iso: string | null): string {
    if (!iso) return "no activity yet"
    const diffMs = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diffMs / 60000)
    if (m < 1) return "just now"
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 7) return `${d}d ago`
    return new Date(iso).toLocaleDateString()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="p-4 border-border/50">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Stage */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted/50 shrink-0">
              <ListChecks className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">SDLC Stage</p>
              {counts.stage ? (
                <Badge variant="outline" className={cn("text-[11px] mt-0.5", STAGE_COLORS[counts.stage] ?? "")}>
                  {counts.stage}
                </Badge>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
          </div>

          {/* Activity */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last 7 days</p>
              <p className="text-sm font-semibold">
                {counts.activityLastWeek} event{counts.activityLastWeek === 1 ? "" : "s"}
                <span className="text-xs text-muted-foreground font-normal ml-1.5">
                  · {relative(counts.lastActivityAt)}
                </span>
              </p>
            </div>
          </div>

          {/* Deadlines */}
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg shrink-0",
              counts.overdueDeadlines > 0 ? "bg-red-500/10" : "bg-cyan-500/10",
            )}>
              <CalendarClock className={cn(
                "h-4 w-4",
                counts.overdueDeadlines > 0 ? "text-red-500" : "text-cyan-500",
              )} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deadlines</p>
              <p className="text-sm font-semibold">
                {counts.deadlines} set
                {counts.overdueDeadlines > 0 && (
                  <span className="text-red-500 text-xs font-normal ml-1.5">
                    · {counts.overdueDeadlines} overdue
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
              <StickyNote className="h-4 w-4 text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Private notes</p>
              <p className="text-sm font-semibold">
                {counts.notes} entr{counts.notes === 1 ? "y" : "ies"}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

// ─── Rubrics Panel ──────────────────────────────────────────────────────────
//
// Per-team custom rubric overrides. When a team has a custom rubric for a
// deliverable type, the grading dialog will preload it instead of the global
// default. Only the team's doctor can manage these (backend enforces it).
function RubricsPanel({ teamId, allTeamIds, userRole }: { teamId: string; allTeamIds: string[]; userRole: string }) {
  const [templates, setTemplates] = useState<RubricTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editingType, setEditingType] = useState<DeliverableType | null>(null)
  const [draft, setDraft] = useState<RubricItem[]>([])
  const [saving, setSaving] = useState(false)

  const canEdit = userRole === "DOCTOR" || userRole === "ADMIN"

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const targetIds = teamId === "all" ? allTeamIds : [teamId]
      const results = await Promise.all(targetIds.map(id => rubricTemplatesApi.list(id).catch(() => [])))
      setTemplates(results.flat())
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load rubrics")
    } finally {
      setLoading(false)
    }
  }, [teamId, allTeamIds])

  useEffect(() => { void load() }, [load])

  function startEdit(type: DeliverableType) {
    const existing = templates.find((t) => t.deliverableType === type)
    const initial = existing ? [...existing.rubric] : getDefaultRubric(type)
    setDraft(initial)
    setEditingType(type)
  }

  function updateCriterion(i: number, patch: Partial<RubricItem>) {
    setDraft((curr) => curr.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }
  function addCriterion() {
    setDraft((curr) => [...curr, { name: "", score: 0, maxScore: 10 }])
  }
  function removeCriterion(i: number) {
    setDraft((curr) => curr.filter((_, idx) => idx !== i))
  }
  function resetToDefault() {
    if (!editingType) return
    setDraft(getDefaultRubric(editingType))
  }

  async function handleSave() {
    if (!editingType) return
    if (draft.length === 0) {
      toast.error("Add at least one criterion.")
      return
    }
    if (draft.some((c) => !c.name.trim())) {
      toast.error("Every criterion needs a name.")
      return
    }
    setSaving(true)
    try {
      const targetIds = teamId === "all" ? allTeamIds : [teamId]
      const rubricPayload = draft.map((c) => ({
        name: c.name.trim(),
        score: 0,
        maxScore: c.maxScore,
      }))

      await Promise.all(targetIds.map(id => 
        rubricTemplatesApi.upsert({
          teamId: id,
          deliverableType: editingType,
          rubric: rubricPayload,
        })
      ))

      toast.success(teamId === "all" ? `Custom ${editingType} rubric saved for all teams.` : `Custom ${editingType} rubric saved.`)
      setEditingType(null)
      await load()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save rubric")
    } finally {
      setSaving(false)
    }
  }

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const deleteTarget = useMemo(
    () => (deleteId ? templates.find((t) => t.id === deleteId) ?? null : null),
    [deleteId, templates],
  )

  async function performDelete(id: string) {
    try {
      await rubricTemplatesApi.delete(id)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      toast.success("Custom rubric removed")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete")
      throw e
    }
  }

  const draftTotal = draft.reduce((s, c) => s + (Number(c.maxScore) || 0), 0)

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => { if (!o) setDeleteId(null) }}
        title="Remove this custom rubric?"
        description={
          deleteTarget
            ? `The custom rubric for ${deleteTarget.deliverableType} will be removed. Future grading will fall back to the global default for this deliverable.`
            : "The custom rubric will be removed and grading will fall back to the global default."
        }
        confirmLabel="Remove"
        onConfirm={async () => { if (deleteId) await performDelete(deleteId) }}
      />

      {/* Modern Info Header */}
      <div className="relative overflow-hidden rounded-2xl bg-indigo-500/5 border border-indigo-500/10 p-5">
        <div className="relative z-10 flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Wand2 className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-300">Smart Rubric Overrides</h4>
            <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 leading-relaxed">
              Define specialized grading criteria for this team. Custom rubrics will automatically load 
              during grading, overriding global system defaults.
              {!canEdit && <span className="block mt-1 font-semibold italic text-red-500/80">Read-only: TAs cannot modify official rubrics.</span>}
            </p>
          </div>
        </div>
        {/* Background decorative element */}
        <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-indigo-500/10 rounded-full blur-2xl" />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5 border-border/40 shadow-none">
              <Skeleton className="h-4 w-1/2 mb-3" />
              <Skeleton className="h-3 w-3/4 mb-6" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DELIVERABLE_TYPES.map((type) => {
            const existing = templates.find((t) => t.deliverableType === type)
            return (
              <motion.div
                key={type}
                whileHover={canEdit ? { y: -2 } : {}}
                transition={{ duration: 0.2 }}
              >
                <Card className={cn(
                  "h-full flex flex-col p-5 border-border/40 hover:border-indigo-500/30 transition-all duration-300",
                  existing && "bg-indigo-500/[0.02] border-indigo-500/20 shadow-sm"
                )}>
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant={existing ? "default" : "outline"} className={cn(
                      "text-[10px] font-bold tracking-wider",
                      !existing && "text-muted-foreground/60"
                    )}>
                      {type}
                    </Badge>
                    {existing && canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full"
                        onClick={() => setDeleteId(existing.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5 mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold tracking-tight">
                        {existing ? existing.rubric.reduce((s, c) => s + (c.maxScore || 0), 0) : "100"}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Points</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {existing 
                        ? `${existing.rubric.length} custom criteria defined` 
                        : "Using global system rubric"}
                    </p>
                  </div>

                  {canEdit && (
                    <Button
                      size="sm"
                      variant={existing ? "secondary" : "outline"}
                      className="w-full font-semibold shadow-sm h-9"
                      onClick={() => startEdit(type)}
                    >
                      {existing ? "Modify Rubric" : "Customize"}
                    </Button>
                  )}
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Redesigned Editor Dialog */}
      <AnimatePresence>
        {editingType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => !saving && setEditingType(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-card border border-border/60 shadow-2xl rounded-3xl overflow-hidden"
            >
              {/* Editor Header */}
              <div className="bg-muted/30 p-6 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                      <ListChecks className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-none">
                        Editing {editingType} Rubric
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Define grading criteria and point distribution.
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-sm px-3 py-1 rounded-lg">
                    {draftTotal} / 100 Total
                  </Badge>
                </div>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <div className="space-y-3">
                  <div className="grid grid-cols-[1fr_100px_48px] gap-3 px-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Criterion Description</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">Max Pts</span>
                    <span />
                  </div>
                  
                  <div className="space-y-2.5">
                    {draft.map((c, i) => (
                      <motion.div
                        key={i}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="grid grid-cols-[1fr_100px_48px] gap-3 items-center group"
                      >
                        <Input
                          value={c.name}
                          onChange={(e) => updateCriterion(i, { name: e.target.value })}
                          placeholder="e.g. Technical Implementation"
                          className="h-11 bg-muted/20 border-border/40 focus:bg-background transition-colors rounded-xl"
                        />
                        <Input
                          type="number"
                          value={c.maxScore}
                          onChange={(e) => updateCriterion(i, { maxScore: Number(e.target.value) })}
                          className="h-11 text-center font-mono font-bold bg-muted/20 border-border/40 focus:bg-background transition-colors rounded-xl"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                          onClick={() => removeCriterion(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    className="w-full h-11 border-dashed border-2 hover:border-indigo-500/40 hover:bg-indigo-500/[0.02] rounded-xl transition-all"
                    onClick={addCriterion}
                  >
                    <Plus className="h-4 w-4 mr-2 text-indigo-500" />
                    Add New Criterion
                  </Button>
                </div>
              </div>

              {/* Editor Footer */}
              <div className="p-6 bg-muted/30 border-t border-border/40 flex items-center justify-between gap-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-foreground"
                  onClick={resetToDefault}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-2" />
                  Restore Defaults
                </Button>
                
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    onClick={() => setEditingType(null)}
                    disabled={saving}
                    className="rounded-xl px-6"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={saving || draftTotal === 0}
                    className="rounded-xl px-8 shadow-lg shadow-indigo-500/20 font-bold"
                  >
                    {saving ? <RotateCcw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Rubric
                  </Button>
                </div>
              </div>

              {draftTotal !== 100 && (
                <div className="px-6 py-2 bg-amber-500/10 border-t border-amber-500/20 text-[10px] text-amber-700 dark:text-amber-400 font-medium text-center">
                  Notice: Total points are {draftTotal}. The system will normalize this to a 100-point scale during grading.
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SupervisorToolkitPage() {
  const { currentUser } = useAuthStore()
  const role = currentUser?.role?.toLowerCase() ?? ""
  const canView = role === "doctor" || role === "ta" || role === "admin"

  const { data: myTeamState, isLoading: myTeamLoading } = useMyTeamState()
  const supervisedTeams = useMemo(() => myTeamState?.supervisedTeams ?? [], [myTeamState])

  const [allTeams, setAllTeams] = useState<{ id: string; name: string }[]>([])
  const [allTeamsLoaded, setAllTeamsLoaded] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string>("")

  // For admin we don't have a supervisedTeams equivalent — load all teams.
  // /teams caps at limit=50, so we paginate until we've collected everything.
  useEffect(() => {
    if (!canView) return
    if (role !== "admin") return

    let cancelled = false
    async function loadAllTeams() {
      try {
        const collected: { id: string; name: string }[] = []
        let page = 1
        // Safety cap: walk up to 20 pages × 50 = 1000 teams max
        for (let i = 0; i < 20; i++) {
          const res = await teamsApi.list({ page, limit: 50 })
          if (cancelled) return
          for (const t of res.items) collected.push({ id: t.id, name: t.name })
          if (res.items.length < 50 || page >= (res.meta?.totalPages ?? 1)) break
          page += 1
        }
        if (!cancelled) {
          setAllTeams(collected)
          setAllTeamsLoaded(true)
        }
      } catch (err) {
        if (!cancelled) {
          // Even on failure, flip the loaded flag so we surface an empty state
          // instead of a perma-skeleton.
          setAllTeamsLoaded(true)
          toast.error("Failed to load teams")
          console.error("[supervision] loadAllTeams failed:", err)
        }
      }
    }

    void loadAllTeams()
    return () => { cancelled = true }
  }, [canView, role])

  const teamOptions = useMemo(() => {
    const base = role === "admin" ? allTeams : supervisedTeams.map((t) => ({ id: t.id, name: t.name }))
    if (base.length > 1) {
      return [{ id: "all", name: "All Teams" }, ...base]
    }
    return base
  }, [role, allTeams, supervisedTeams])

  const allTeamIds = useMemo(() => 
    teamOptions.filter(t => t.id !== "all").map(t => t.id),
    [teamOptions]
  )

  useEffect(() => {
    if (!selectedTeamId && teamOptions.length > 0) {
      setSelectedTeamId(teamOptions[0].id)
    }
  }, [teamOptions, selectedTeamId])

  const selectedTeamName = useMemo(() => {
    if (selectedTeamId === "all") return "All Supervised Teams"
    return teamOptions.find(t => t.id === selectedTeamId)?.name ?? "Selected Team"
  }, [selectedTeamId, teamOptions])

  if (!canView) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="min-h-[60vh] flex items-center justify-center">
        <Card className="p-12 text-center max-w-md border-border/50">
          <Lock className="h-16 w-16 mx-auto mb-6 text-destructive" />
          <h2 className="text-2xl font-bold mb-3">Supervisors Only</h2>
          <p className="text-muted-foreground">This toolkit is only available to doctors, TAs, and admins.</p>
        </Card>
      </motion.div>
    )
  }

  // Admin: we've finished paginating /teams once `allTeamsLoaded` flips true.
  // Doctor/TA: we wait for the /my-team hook to settle.
  const isLoadingTeams = role === "admin" ? !allTeamsLoaded : myTeamLoading

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 sm:p-6 pb-24">
      {/* Hero */}
      <div className="rounded-2xl p-6 border border-border/50 relative overflow-hidden bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/5" />
        <motion.div
          className="absolute -right-20 -top-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"
          animate={{ scale: [1, 1.15, 1], rotate: [0, 120, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <motion.h1
              className="text-3xl font-bold mb-1.5 flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <StickyNote className="h-7 w-7 text-indigo-500" />
              Supervision
            </motion.h1>
            <motion.p
              className="text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              Everything you need to supervise a team — activity history, private notes,
              deadlines, and custom grading rubrics.
            </motion.p>
          </div>

          {!isLoadingTeams && teamOptions.length > 0 && (
            <motion.div
              className="flex items-center gap-2 shrink-0"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground px-2">
                <Users className="h-3.5 w-3.5" />
                <span>{teamOptions.length} supervised team{teamOptions.length === 1 ? "" : "s"}</span>
              </div>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {teamOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>
          )}
        </div>
      </div>

      {isLoadingTeams ? (
        <Card className="p-12"><Skeleton className="h-24 w-full" /></Card>
      ) : teamOptions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-12 text-center border-dashed border-2 border-border/60">
            <motion.div
              className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/60"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Users className="h-10 w-10 text-muted-foreground" />
            </motion.div>
            <h2 className="text-xl font-bold mb-2">No supervised teams yet</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              When teams request you as their doctor or TA and you accept, they&apos;ll
              appear here. Check{" "}
              <span className="text-foreground font-medium">Notifications</span>
              {" "}for incoming requests.
            </p>
          </Card>
        </motion.div>
      ) : selectedTeamId ? (
        <div className="space-y-6">
          {/* Team Context Header - Clearly shows which team settings apply to */}
          <motion.div 
            key={`header-${selectedTeamId}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center justify-between px-1"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                {selectedTeamId === "all" ? <Users className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">{selectedTeamName}</h2>
                <p className="text-xs text-muted-foreground">
                  {selectedTeamId === "all" 
                    ? `Managing all ${teamOptions.length - 1} supervised teams`
                    : `Managing settings and tracking progress for ${selectedTeamName}`}
                </p>
              </div>
            </div>
            {selectedTeamId !== "all" && (
               <Badge variant="secondary" className="h-6">Active Team</Badge>
            )}
          </motion.div>

          {/* Vital-signs strip — quick at-a-glance counts for the selected team */}
          <TeamPulse key={selectedTeamId} teamId={selectedTeamId} allTeamIds={allTeamIds} />

        <Tabs defaultValue="activity" className="space-y-4">
          <TabsList className="p-1 gap-0.5 bg-muted/50 backdrop-blur-sm border border-border/60">
            <TabsTrigger
              value="activity"
              className="h-9 rounded-xl px-4 text-sm font-medium transition-all duration-200 ease-out hover:bg-muted/70 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.96] data-[state=active]:shadow-md"
            >
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Activity
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="h-9 rounded-xl px-4 text-sm font-medium transition-all duration-200 ease-out hover:bg-muted/70 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.96] data-[state=active]:shadow-md"
            >
              <StickyNote className="h-3.5 w-3.5 mr-1.5" />
              Private Notes
            </TabsTrigger>
            <TabsTrigger
              value="deadlines"
              className="h-9 rounded-xl px-4 text-sm font-medium transition-all duration-200 ease-out hover:bg-muted/70 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.96] data-[state=active]:shadow-md"
            >
              <CalendarClock className="h-3.5 w-3.5 mr-1.5" />
              Deadlines
            </TabsTrigger>
            <TabsTrigger
              value="rubrics"
              className="h-9 rounded-xl px-4 text-sm font-medium transition-all duration-200 ease-out hover:bg-muted/70 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.96] data-[state=active]:shadow-md"
            >
              <ListChecks className="h-3.5 w-3.5 mr-1.5" />
              Rubrics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-4">
            <ActivityPanel teamId={selectedTeamId} allTeamIds={allTeamIds} teamOptions={teamOptions} />
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <NotesPanel teamId={selectedTeamId} allTeamIds={allTeamIds} teamOptions={teamOptions} />
          </TabsContent>

          <TabsContent value="deadlines" className="mt-4">
            <DeadlinesPanel teamId={selectedTeamId} allTeamIds={allTeamIds} userRole={(currentUser?.role ?? "").toUpperCase()} />
          </TabsContent>

          <TabsContent value="rubrics" className="mt-4">
            <RubricsPanel teamId={selectedTeamId} allTeamIds={allTeamIds} userRole={(currentUser?.role ?? "").toUpperCase()} />
          </TabsContent>
        </Tabs>
        </div>
      ) : null}
    </motion.div>
  )
}
