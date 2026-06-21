"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, AlertTriangle, CheckCircle2, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { meetingsApi } from "@/lib/api/meetings"
import { submissionsApi } from "@/lib/api/submissions"
import { meetingConflictApi, type MeetingConflict } from "@/lib/api/supervisor-tools"
import type { ApiMeetingMode } from "@/lib/api/types"
import { toast } from "sonner"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  submissionId: string
  teamId: string
  /** Participant user IDs to check for conflicts (leader + doctor + TA + members) */
  participantUserIds: string[]
  /** Called after meeting is created AND attached to the submission */
  onScheduled: () => void | Promise<void>
}

/**
 * Inline defense-meeting scheduler.
 *
 * Doctor (or TA) picks a date/time + mode → we (1) check for calendar
 * conflicts across all participants, (2) create the Meeting, (3) attach it
 * to the submission via `submissionsApi.attachDefense`. The grade can then
 * be finalized once the meeting is marked COMPLETED.
 */
export function DefenseScheduler({
  open,
  onOpenChange,
  submissionId,
  teamId,
  participantUserIds,
  onScheduled,
}: Props) {
  const [title, setTitle] = useState("Final Project Defense")
  const [startAt, setStartAt] = useState("")
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [mode, setMode] = useState<ApiMeetingMode>("IN_PERSON")
  const [location, setLocation] = useState("")
  const [joinUrl, setJoinUrl] = useState("")
  const [agenda, setAgenda] = useState("Project presentation, code walkthrough, and Q&A.")

  const [conflicts, setConflicts] = useState<MeetingConflict[] | null>(null)
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function computeEndAt(): string | null {
    if (!startAt) return null
    const start = new Date(startAt)
    if (Number.isNaN(start.getTime())) return null
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
    return end.toISOString()
  }

  async function handleCheckConflicts() {
    const endIso = computeEndAt()
    if (!startAt || !endIso) {
      toast.error("Pick a start time first.")
      return
    }
    if (participantUserIds.length === 0) {
      // No participants to check — nothing can conflict.
      setConflicts([])
      return
    }
    setCheckingConflicts(true)
    try {
      const startIso = new Date(startAt).toISOString()
      const result = await meetingConflictApi.check(startIso, endIso, participantUserIds)
      setConflicts(result)
      if (result.length === 0) {
        toast.success("No calendar conflicts in that window.")
      } else {
        toast.warning(`${result.length} conflict${result.length === 1 ? "" : "s"} detected.`)
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't check conflicts.")
    } finally {
      setCheckingConflicts(false)
    }
  }

  async function handleSchedule() {
    const endIso = computeEndAt()
    if (!startAt || !endIso) {
      toast.error("Pick a start time.")
      return
    }
    if (mode !== "VIRTUAL" && !location.trim()) {
      toast.error("Add a location for in-person/hybrid meetings.")
      return
    }
    setSubmitting(true)
    try {
      // 1. Create the meeting
      const meeting = await meetingsApi.create({
        teamId,
        title: title.trim() || "Final Project Defense",
        agenda: agenda.trim() || undefined,
        startAt: new Date(startAt).toISOString(),
        endAt: endIso,
        mode,
        location: mode !== "VIRTUAL" ? location.trim() : undefined,
        // Optional join URL for virtual/hybrid — passed via provider/extras isn't
        // supported by CreateMeetingPayload, but the user can edit the meeting
        // later to add it. For now we use location field.
        includeDoctor: true,
        includeTa: true,
        includeTeamMembers: true,
        provider: mode === "VIRTUAL" ? "GOOGLE_MEET" : "MANUAL",
      })

      // 2. Attach to the submission
      await submissionsApi.attachDefense(submissionId, { meetingId: meeting.id })

      toast.success("Defense meeting scheduled and linked to this submission.")
      // Re-fetch submission so the dialog re-renders with the link
      await onScheduled()
      onOpenChange(false)

      // Reset form for next use
      setStartAt("")
      setConflicts(null)
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to schedule defense.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-500" />
            Schedule Defense Meeting
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 text-xs leading-relaxed text-purple-900 dark:text-purple-300">
            This will create a meeting, invite the team + supervisors, and link it
            to this submission. The grade can&apos;t be finalized until the meeting is
            marked <b>COMPLETED</b>.
          </div>

          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start time</Label>
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => {
                  setStartAt(e.target.value)
                  setConflicts(null) // Invalidate conflict check when time changes
                }}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input
                type="number"
                min={15}
                max={240}
                step={15}
                value={durationMinutes}
                onChange={(e) => {
                  setDurationMinutes(Math.max(15, Math.min(240, Number(e.target.value) || 60)))
                  setConflicts(null)
                }}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as ApiMeetingMode)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN_PERSON">In person</SelectItem>
                <SelectItem value="VIRTUAL">Virtual</SelectItem>
                <SelectItem value="HYBRID">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode !== "VIRTUAL" && (
            <div>
              <Label>Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Room 305, Engineering Building"
                className="mt-1.5"
              />
            </div>
          )}

          {mode !== "IN_PERSON" && (
            <div>
              <Label>Join URL (optional)</Label>
              <Input
                value={joinUrl}
                onChange={(e) => setJoinUrl(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="mt-1.5"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                You can add the link from the meeting detail page after creating it.
              </p>
            </div>
          )}

          <div>
            <Label>Agenda (optional)</Label>
            <Textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              className="mt-1.5 resize-none"
              rows={2}
            />
          </div>

          {/* Conflict check section */}
          <div className="rounded-lg border border-border/60 p-3 bg-muted/30">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Participant availability
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => void handleCheckConflicts()}
                disabled={!startAt || checkingConflicts}
              >
                {checkingConflicts ? "Checking…" : "Check conflicts"}
              </Button>
            </div>

            {conflicts === null ? (
              <p className="text-[11px] text-muted-foreground">
                Check before scheduling to see if any participant has a clash.
              </p>
            ) : conflicts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Everyone is free in that window.
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1.5"
              >
                <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {conflicts.length} conflicting meeting{conflicts.length === 1 ? "" : "s"}:
                </div>
                {conflicts.map((c) => (
                  <div key={c.id} className="text-[11px] text-muted-foreground pl-5 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    <span className="font-medium text-foreground">{c.title}</span>
                    <span>·</span>
                    <span>{new Date(c.startAt).toLocaleString()}</span>
                    {c.team && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{c.team.name}</Badge>
                    )}
                  </div>
                ))}
                <p className="text-[10px] text-amber-600 dark:text-amber-500 italic">
                  You can still schedule, but expect some attendance issues.
                </p>
              </motion.div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => void handleSchedule()}
              disabled={submitting || !startAt}
              className={cn(
                "flex-1 bg-purple-600 hover:bg-purple-700",
                conflicts && conflicts.length > 0 && "bg-amber-600 hover:bg-amber-700",
              )}
            >
              <Calendar className="h-4 w-4 mr-2" />
              {submitting
                ? "Scheduling…"
                : conflicts && conflicts.length > 0
                  ? "Schedule anyway"
                  : "Schedule defense"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
