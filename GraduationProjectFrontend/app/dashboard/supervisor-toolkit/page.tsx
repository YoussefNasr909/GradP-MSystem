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
  announcement: "bg-pink-500/10 text-pink-500 border-pink-500/30",
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

// ─── Sub-Panels ─────────────────────────────────────────────────────────────

function NotesPanel({ teamId }: { teamId: string }) {
  const [notes, setNotes] = useState<SupervisorNote[]>([])
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState("")
  const [saving, setSaving] = useState(false)
  const { currentUser } = useAuthStore()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await supervisorNotesApi.list(teamId)
      setNotes(data)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load notes")
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => { void load() }, [load])

  async function handleAdd() {
    if (newNote.trim().length === 0) return
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

  async function handleDelete(id: string) {
    if (!confirm("Delete this note?")) return
    try {
      await supervisorNotesApi.delete(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
      toast.success("Note deleted")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete")
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
        <p className="text-xs text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
          <Lock className="h-3 w-3" /> These notes are private — only the team&apos;s Doctor, TA, and admins can see them.
        </p>
      </div>

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

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-12 w-full" /></Card>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
          <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No notes yet. Use the box above to start tracking observations.
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
                        onClick={() => handleDelete(n.id)}
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

function DeadlinesPanel({ teamId }: { teamId: string }) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading]     = useState(true)
  const [type, setType] = useState<DeliverableType>("SRS")
  const [date, setDate] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await deadlinesApi.list({ teamId })
      setDeadlines(data)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load deadlines")
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => { void load() }, [load])

  async function handleSave() {
    if (!date) { toast.error("Pick a date"); return }
    setSaving(true)
    try {
      const created = await deadlinesApi.upsert({
        teamId,
        deliverableType: type,
        dueDate: new Date(date).toISOString(),
        note: note || undefined,
      })
      setDeadlines((prev) => {
        const filtered = prev.filter((d) => d.deliverableType !== type)
        return [...filtered, created].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      })
      setDate("")
      setNote("")
      toast.success("Deadline saved")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this deadline?")) return
    try {
      await deadlinesApi.delete(id)
      setDeadlines((prev) => prev.filter((d) => d.id !== id))
      toast.success("Deadline deleted")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete")
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 border-border/50">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Set a deadline</Label>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Deliverable</Label>
            <Select value={type} onValueChange={(v) => setType(v as DeliverableType)}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DELIVERABLE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Due Date</Label>
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-9" />
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving || !date}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note for the team"
          className="mt-3 h-9 text-sm"
          maxLength={500}
        />
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-10 w-full" /></Card>
          ))}
        </div>
      ) : deadlines.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
          <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No deadlines set yet.
        </Card>
      ) : (
        <div className="space-y-2">
          {deadlines.map((d) => {
            const due = new Date(d.dueDate)
            const overdue = due.getTime() < Date.now()
            const days = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            return (
              <Card key={d.id} className={cn(
                "p-4 border-border/50 flex items-center gap-3",
                overdue && "border-red-500/30 bg-red-500/5",
                !overdue && days <= 3 && "border-amber-500/30 bg-amber-500/5",
              )}>
                <div className={cn(
                  "p-2 rounded-lg shrink-0",
                  overdue ? "bg-red-500/15 text-red-500" : days <= 3 ? "bg-amber-500/15 text-amber-500" : "bg-blue-500/15 text-blue-500",
                )}>
                  <CalendarClock className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{d.deliverableType}</span>
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      overdue && "border-red-500/30 text-red-500",
                      !overdue && days <= 3 && "border-amber-500/30 text-amber-500",
                    )}>
                      {overdue ? `${-days}d overdue` : days === 0 ? "today" : `in ${days}d`}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Due {due.toLocaleString()}
                    {d.setBy && ` · Set by ${d.setBy.fullName}`}
                  </p>
                  {d.note && <p className="text-xs mt-1">{d.note}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(d.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ActivityPanel({ teamId }: { teamId: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await activityApi.forTeam(teamId)
      setEvents(data)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load activity")
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => { void load() }, [load])

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

  return (
    <div className="relative">
      <div className="absolute left-[20px] top-2 bottom-2 w-px bg-border/60" />
      <div className="space-y-3">
        <AnimatePresence>
          {events.map((e, i) => {
            const Icon = ACTIVITY_ICON[e.type]
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="relative pl-12"
              >
                <div className={cn(
                  "absolute left-0 top-2 h-10 w-10 rounded-full border flex items-center justify-center",
                  ACTIVITY_COLOR[e.type],
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <Card className="p-3 border-border/50">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{e.title}</p>
                      {e.detail && <p className="text-xs text-muted-foreground mt-0.5">{e.detail}</p>}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {e.actor?.name && (
                          <span className="text-[10px] text-muted-foreground">{e.actor.name}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">·</span>
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
  )
}

// ─── Rubrics Panel ──────────────────────────────────────────────────────────
//
// Per-team custom rubric overrides. When a team has a custom rubric for a
// deliverable type, the grading dialog will preload it instead of the global
// default. Only the team's doctor can manage these (backend enforces it).
function RubricsPanel({ teamId, userRole }: { teamId: string; userRole: string }) {
  const [templates, setTemplates] = useState<RubricTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editingType, setEditingType] = useState<DeliverableType | null>(null)
  const [draft, setDraft] = useState<RubricItem[]>([])
  const [saving, setSaving] = useState(false)

  const canEdit = userRole === "DOCTOR" || userRole === "ADMIN"

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await rubricTemplatesApi.list(teamId)
      setTemplates(rows)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load rubrics")
    } finally {
      setLoading(false)
    }
  }, [teamId])

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
      await rubricTemplatesApi.upsert({
        teamId,
        deliverableType: editingType,
        rubric: draft.map((c) => ({
          name: c.name.trim(),
          score: 0,                    // criteria scores aren't stored in the template; only structure
          maxScore: c.maxScore,
        })),
      })
      toast.success(`Custom ${editingType} rubric saved.`)
      setEditingType(null)
      await load()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save rubric")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this custom rubric? Grading will fall back to the default.")) return
    try {
      await rubricTemplatesApi.delete(id)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      toast.success("Custom rubric removed")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete")
    }
  }

  const draftTotal = draft.reduce((s, c) => s + (Number(c.maxScore) || 0), 0)

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40">
        <p className="text-xs text-purple-800 dark:text-purple-400 flex items-center gap-1.5">
          <Wand2 className="h-3 w-3" />
          Override the default rubric for any deliverable type. When this team is graded,
          the saved rubric will preload instead of the global default.
          {!canEdit && <span className="ml-1 italic">(Read-only — TA can&apos;t edit official rubrics.)</span>}
        </p>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-20 w-full" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {DELIVERABLE_TYPES.map((type) => {
            const existing = templates.find((t) => t.deliverableType === type)
            return (
              <Card key={type} className={cn(
                "p-4 border-border/50 transition-colors",
                existing && "border-purple-500/30 bg-purple-500/5",
              )}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{type}</Badge>
                    {existing && (
                      <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-700 dark:text-purple-400">
                        Custom
                      </Badge>
                    )}
                  </div>
                  {existing && canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(existing.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {existing
                    ? `${existing.rubric.length} criteria · total ${existing.rubric.reduce((s, c) => s + (c.maxScore || 0), 0)} pts`
                    : "Using global default rubric"}
                </p>
                {canEdit && (
                  <Button
                    size="sm"
                    variant={existing ? "outline" : "default"}
                    className="w-full"
                    onClick={() => startEdit(type)}
                  >
                    {existing ? "Edit" : "Customize"}
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Editor dialog */}
      {editingType && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingType(null) }}
        >
          <Card className="w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-purple-500" />
                  Customize {editingType} Rubric
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Define the criteria you'll use to grade this deliverable for this team.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_90px_40px] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground px-1">
                <span>Criterion</span>
                <span className="text-right">Max points</span>
                <span />
              </div>
              <AnimatePresence initial={false}>
                {draft.map((c, i) => (
                  <motion.div
                    key={i}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="grid grid-cols-[1fr_90px_40px] gap-2 items-center"
                  >
                    <Input
                      value={c.name}
                      onChange={(e) => updateCriterion(i, { name: e.target.value })}
                      placeholder="e.g. Documentation Quality"
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={c.maxScore}
                      onChange={(e) =>
                        updateCriterion(i, {
                          maxScore: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                        })
                      }
                      className="h-8 text-sm text-center tabular-nums"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeCriterion(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addCriterion}>
                  <Plus className="h-3 w-3 mr-1" /> Add criterion
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Reset to default
                </Button>
              </div>
              <Badge variant="outline" className="font-mono">{draftTotal} max pts</Badge>
            </div>

            {draftTotal !== 100 && (
              <p className="text-[10px] text-amber-700 dark:text-amber-500 mt-2">
                ⚠ Criteria max totals to {draftTotal}, not 100. Grading still scales to /100, but
                a clean 100-point breakdown reads better.
              </p>
            )}

            <div className="flex gap-2 mt-4">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving…" : "Save rubric"}
              </Button>
              <Button variant="outline" onClick={() => setEditingType(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
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
  const [selectedTeamId, setSelectedTeamId] = useState<string>("")

  // For admin we don't have a supervisedTeams equivalent — load all teams
  useEffect(() => {
    if (!canView) return
    if (role === "admin") {
      teamsApi.list({ limit: 200 }).then((res) => {
        setAllTeams(res.items.map((t) => ({ id: t.id, name: t.name })))
      }).catch(() => {})
    }
  }, [canView, role])

  const teamOptions = useMemo(() => {
    if (role === "admin") return allTeams
    return supervisedTeams.map((t) => ({ id: t.id, name: t.name }))
  }, [role, allTeams, supervisedTeams])

  useEffect(() => {
    if (!selectedTeamId && teamOptions.length > 0) {
      setSelectedTeamId(teamOptions[0].id)
    }
  }, [teamOptions, selectedTeamId])

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

  const isLoadingTeams = (role === "admin" ? allTeams.length === 0 : myTeamLoading)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 sm:p-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 border border-border/50 relative overflow-hidden bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/5" />
        <motion.div
          className="absolute -right-20 -top-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"
          animate={{ scale: [1, 1.15, 1], rotate: [0, 120, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <motion.h1 className="text-3xl font-bold mb-1.5 flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <StickyNote className="h-7 w-7 text-indigo-500" />
              Supervisor Toolkit
            </motion.h1>
            <motion.p className="text-muted-foreground"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              Per-team supervisor view — private notes, deadlines, and full activity history
            </motion.p>
          </div>

          {!isLoadingTeams && teamOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teamOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {isLoadingTeams ? (
        <Card className="p-12"><Skeleton className="h-24 w-full" /></Card>
      ) : teamOptions.length === 0 ? (
        <Card className="p-12 text-center border-border/50">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            You don&apos;t supervise any teams yet.
          </p>
        </Card>
      ) : selectedTeamId ? (
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
            <ActivityPanel teamId={selectedTeamId} />
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <NotesPanel teamId={selectedTeamId} />
          </TabsContent>

          <TabsContent value="deadlines" className="mt-4">
            <DeadlinesPanel teamId={selectedTeamId} />
          </TabsContent>

          <TabsContent value="rubrics" className="mt-4">
            <RubricsPanel teamId={selectedTeamId} userRole={(currentUser?.role ?? "").toUpperCase()} />
          </TabsContent>
        </Tabs>
      ) : null}
    </motion.div>
  )
}
