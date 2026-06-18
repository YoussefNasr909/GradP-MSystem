"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Inbox,
  Loader2,
  Mail,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { usersApi } from "@/lib/api/users"
import { teamsApi } from "@/lib/api/teams"
import type {
  ApiDirectoryUser,
  ApiSupervisorRequest,
  ApiSupervisorRole,
  ApiTeamDetail,
  ApiTeamSummary,
  ApiTeamUser,
} from "@/lib/api/types"
import { getAvatarInitial, getFullName } from "@/lib/team-display"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type LeaderSupervisorsTabProps = {
  team: ApiTeamDetail
  requests: ApiSupervisorRequest[]
  onRefresh: () => Promise<void>
}

type SupervisorRequestInboxProps = {
  currentRole: "doctor" | "ta"
  requests: ApiSupervisorRequest[]
  supervisedTeams: ApiTeamDetail[] | ApiTeamSummary[]
  onRefresh: () => Promise<void>
}

type RequestDraft = {
  projectName: string
  technologies: string
  projectDescription: string
}

type SupervisorRemovalTarget = {
  role: ApiSupervisorRole
  supervisor: ApiTeamUser
}

const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const

function getSupervisorRevealMotion(reduceMotion: boolean, delay = 0) {
  if (reduceMotion) return {}

  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: EASE_OUT_QUINT },
  }
}

function getSupervisorHoverMotion(reduceMotion: boolean) {
  if (reduceMotion) return {}

  return {
    whileHover: {
      y: -4,
      transition: { duration: 0.2, ease: EASE_OUT_QUINT },
    },
    whileTap: {
      scale: 0.992,
      transition: { duration: 0.14, ease: EASE_OUT_QUINT },
    },
  }
}

export function LeaderSupervisorsTab({ team, requests, onRefresh }: LeaderSupervisorsTabProps) {
  const reduceMotion = Boolean(useReducedMotion())
  const [doctors, setDoctors] = useState<ApiDirectoryUser[]>([])
  const [tas, setTas] = useState<ApiDirectoryUser[]>([])
  const [doctorSearch, setDoctorSearch] = useState("")
  const [taSearch, setTaSearch] = useState("")
  const [doctorPage, setDoctorPage] = useState(1)
  const [taPage, setTaPage] = useState(1)
  const [doctorTotalPages, setDoctorTotalPages] = useState(1)
  const [taTotalPages, setTaTotalPages] = useState(1)
  const [doctorLoading, setDoctorLoading] = useState(true)
  const [taLoading, setTaLoading] = useState(true)
  const [doctorError, setDoctorError] = useState("")
  const [taError, setTaError] = useState("")
  const [removingRole, setRemovingRole] = useState<"" | ApiSupervisorRole>("")
  const [supervisorToRemove, setSupervisorToRemove] = useState<SupervisorRemovalTarget | null>(null)
  const [selectedSupervisor, setSelectedSupervisor] = useState<ApiDirectoryUser | null>(null)
  const [sendingRequest, setSendingRequest] = useState(false)
  const [draft, setDraft] = useState<RequestDraft>({
    projectName: team.name,
    technologies: team.stack.join(", "),
    projectDescription: team.bio,
  })
  const [isAiMatching, setIsAiMatching] = useState(false)
  const [aiMatches, setAiMatches] = useState<{ doctorId: string; matchScore: number; reasoning: string; role?: string; doctor?: ApiDirectoryUser }[]>([])

  useEffect(() => {
    let cancelled = false
    setDoctorLoading(true)
    setDoctorError("")

    usersApi
      .directory({ role: "DOCTOR", search: doctorSearch || undefined, page: doctorPage, limit: 12 })
      .then((result) => {
        if (cancelled) return
        setDoctorTotalPages(result.meta.totalPages || 1)
        setDoctors(result.items)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setDoctorError(error instanceof Error ? error.message : "Couldn't load doctors right now.")
      })
      .finally(() => {
        if (!cancelled) setDoctorLoading(false)
      })

    return () => { cancelled = true }
  }, [doctorPage, doctorSearch])

  useEffect(() => {
    let cancelled = false
    setTaLoading(true)
    setTaError("")

    usersApi
      .directory({ role: "TA", search: taSearch || undefined, page: taPage, limit: 12 })
      .then((result) => {
        if (cancelled) return
        setTaTotalPages(result.meta.totalPages || 1)
        setTas(result.items)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setTaError(error instanceof Error ? error.message : "Couldn't load teaching assistants right now.")
      })
      .finally(() => {
        if (!cancelled) setTaLoading(false)
      })

    return () => { cancelled = true }
  }, [taPage, taSearch])

  const openRequestDialog = (candidate: ApiDirectoryUser) => {
    setSelectedSupervisor(candidate)
    setDraft({
      projectName: team.name,
      technologies: team.stack.join(", "),
      projectDescription: team.bio,
    })
  }

  const sendRequest = async () => {
    if (!selectedSupervisor) return

    const technologies = draft.technologies
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)

    if (draft.projectName.trim().length < 3) {
      toast.error("Add a clear project name before sending the request.")
      return
    }

    if (draft.projectDescription.trim().length < 10) {
      toast.error("Add a short project description so the supervisor understands the idea.")
      return
    }

    if (technologies.length === 0) {
      toast.error("Add at least one technology before sending the request.")
      return
    }

    setSendingRequest(true)
    try {
      await teamsApi.createSupervisorRequest(team.id, {
        supervisorId: selectedSupervisor.id,
        projectName: draft.projectName.trim(),
        projectDescription: draft.projectDescription.trim(),
        technologies,
      })
      toast.success(`Request sent to ${getFullName(selectedSupervisor)}.`)
      setSelectedSupervisor(null)
      await onRefresh()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Couldn't send the supervisor request.")
    } finally {
      setSendingRequest(false)
    }
  }

  const removeSupervisorAssignment = async (role: ApiSupervisorRole) => {
    setRemovingRole(role)
    try {
      await teamsApi.removeSupervisor(team.id, role)
      toast.success(`${role === "DOCTOR" ? "Doctor" : "TA"} assignment removed.`)
      setSupervisorToRemove(null)
      await onRefresh()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Couldn't remove that supervisor assignment.")
    } finally {
      setRemovingRole("")
    }
  }

  async function handleAiMatchSupervisor() {
    setIsAiMatching(true)
    setAiMatches([])
    try {
      const [allDoctors, allTas] = await Promise.all([
        usersApi.directory({ role: "DOCTOR", limit: 50 }),
        usersApi.directory({ role: "TA", limit: 50 }),
      ])
      const allSupervisors = [
        ...allDoctors.items.map(d => ({ id: d.id, name: d.fullName, department: d.department, specialties: [], bio: d.bio, role: "DOCTOR", _ref: d })),
        ...allTas.items.map(d => ({ id: d.id, name: d.fullName, department: d.department, specialties: [], bio: d.bio, role: "TA", _ref: d })),
      ]
      const docData = allSupervisors.map(({ _ref: _, ...rest }) => rest)
      const res = await fetch("/api/generate-supervisor-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team: { name: team.name, stack: team.stack, bio: team.bio },
          doctors: docData,
        }),
      })
      if (!res.ok) throw new Error("Failed to generate matches")
      const result = await res.json()
      const hydrated = result.map((m: { doctorId: string; matchScore: number; reasoning: string; role?: string }) => {
        const found = allSupervisors.find(d => d.id === m.doctorId)
        return { ...m, role: m.role ?? found?.role, doctor: found?._ref }
      })
      setAiMatches(hydrated)
      toast.success("AI found your top 3 supervisor matches!")
    } catch {
      toast.error("AI matching failed. Please try again.")
    } finally {
      setIsAiMatching(false)
    }
  }

  const pendingDoctorRequest = requests.find(
    (item) => item.supervisorRole === "DOCTOR" && item.status === "PENDING",
  ) ?? null
  const pendingTaRequest = requests.find((item) => item.supervisorRole === "TA" && item.status === "PENDING") ?? null
  const assignedCount = Number(Boolean(team.doctor)) + Number(Boolean(team.ta))
  const pendingCount = Number(Boolean(pendingDoctorRequest)) + Number(Boolean(pendingTaRequest))

  return (
    <div className="space-y-5">
      <motion.div
        {...getSupervisorRevealMotion(reduceMotion, 0.05)}
        className="rounded-xl border border-border/70 bg-background p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Supervisors</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Review who is assigned to your team and keep pending requests easy to track.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-md bg-primary/10 px-2.5 py-1 text-primary">
              {assignedCount}/2 assigned
            </Badge>
            {pendingCount > 0 ? (
              <Badge variant="outline" className="rounded-md border-amber-500/35 text-amber-700 dark:text-amber-400">
                {pendingCount} pending
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <AssignmentCard
            role="DOCTOR"
            assignedSupervisor={team.doctor}
            pendingRequest={pendingDoctorRequest}
            helper="Supervises your project direction and milestone reviews."
            reduceMotion={reduceMotion}
            onRemove={team.doctor ? () => setSupervisorToRemove({ role: "DOCTOR", supervisor: team.doctor as ApiTeamUser }) : undefined}
            isRemoving={removingRole === "DOCTOR"}
          />
          <AssignmentCard
            role="TA"
            assignedSupervisor={team.ta}
            pendingRequest={pendingTaRequest}
            helper="Supports technical follow-up and provides ongoing feedback."
            reduceMotion={reduceMotion}
            onRemove={team.ta ? () => setSupervisorToRemove({ role: "TA", supervisor: team.ta as ApiTeamUser }) : undefined}
            isRemoving={removingRole === "TA"}
          />
        </div>
      </motion.div>

      {/* Request history */}
      {requests.length > 0 && (
        <motion.div {...getSupervisorRevealMotion(reduceMotion, 0.08)}>
          <Card className="rounded-xl border-border/70 shadow-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-base">Request history</CardTitle>
              <CardDescription>Track which requests are pending and which supervisors responded.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 xl:grid-cols-2">
              {requests.map((request) => (
                <SupervisorRequestHistoryCard key={request.id} request={request} reduceMotion={reduceMotion} />
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* AI Supervisor Matchmaker */}
      {(!team.doctor || !team.ta) && (
        <motion.div {...getSupervisorRevealMotion(reduceMotion, 0.09)}>
          <div className="overflow-hidden rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/8 via-purple-500/5 to-transparent shadow-sm relative">
            {/* Top gradient bar */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            <div className="p-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    <Sparkles className="h-3 w-3" /> AI Matchmaker
                  </div>
                  <h3 className="text-base font-bold text-foreground">Not sure who to pick?</h3>
                  <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
                    Let our AI analyze your stack ({team.stack?.slice(0, 3).join(", ") || "your technologies"}) and project idea to recommend the <span className="font-semibold text-indigo-600 dark:text-indigo-400">Top 3</span> best-suited Doctors & TAs.
                  </p>
                </div>
                <Button
                  onClick={() => void handleAiMatchSupervisor()}
                  disabled={isAiMatching || aiMatches.length > 0}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-indigo-500/25 shrink-0 transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isAiMatching
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                    : <><Sparkles className="mr-2 h-4 w-4" /> Find Best Match</>}
                </Button>
              </div>

              {/* Match Cards */}
              {aiMatches.length > 0 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {aiMatches.map((m, i) => {
                    const rankColors = [
                      "from-amber-400 to-yellow-500",
                      "from-slate-400 to-slate-500",
                      "from-orange-400 to-amber-500",
                    ]
                    const rankLabels = ["#1 Best Pick", "#2 Runner Up", "#3 Option"]
                    const isDoctor = m.role === "DOCTOR"
                    return (
                      <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}>
                        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all duration-200 p-4 h-full relative overflow-hidden group">
                          {/* Rank ribbon */}
                          <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${rankColors[i]}`} />

                          {/* Rank badge */}
                          <div className={`self-start px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r ${rankColors[i]} text-white`}>
                            {rankLabels[i]}
                          </div>

                          {/* Doctor info */}
                          <div className="flex items-center gap-3">
                            <div className={`relative p-0.5 rounded-full bg-gradient-to-br ${rankColors[i]}`}>
                              <Avatar className="h-10 w-10 border-2 border-background">
                                <AvatarImage src={m.doctor?.avatarUrl} />
                                <AvatarFallback className="bg-indigo-50 text-indigo-700 font-bold text-sm">
                                  {m.doctor ? getAvatarInitial(m.doctor) : "?"}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-sm truncate">{m.doctor?.fullName ?? "Unknown"}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <Badge className={`text-[9px] px-1.5 py-0 border-0 font-semibold ${
                                  isDoctor
                                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                }`}>
                                  {isDoctor ? "Doctor" : "TA"}
                                </Badge>
                                <Badge className="text-[9px] px-1.5 py-0 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-semibold">
                                  {m.matchScore}% Match
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Department chip */}
                          {m.doctor?.department && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <GraduationCap className="h-3 w-3 shrink-0" />
                              <span className="truncate">{m.doctor.department.replace(/_/g, " ")}</span>
                            </div>
                          )}

                          {/* AI Reasoning */}
                          <p className="text-xs leading-relaxed text-muted-foreground italic flex-1 bg-muted/40 rounded-lg p-2.5 border border-border/40">
                            "{m.reasoning}"
                          </p>

                          {/* CTA */}
                          {m.doctor && (
                            <Button
                              size="sm"
                              className="w-full text-xs rounded-lg mt-auto bg-transparent text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white shadow-none transition-all"
                              onClick={() => openRequestDialog(m.doctor!)}
                            >
                              <Send className="mr-1.5 h-3 w-3" /> Send Request
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <motion.div {...getSupervisorRevealMotion(reduceMotion, 0.1)} className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Browse supervisors</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Search by name, email, or department, then open a profile row before sending a request.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <SupervisorCandidatesSection
            title="Available Doctors"
            description="Browse active doctors and send one supervision request when you're ready."
            role="DOCTOR"
            candidates={doctors}
            assignedSupervisor={team.doctor}
            pendingRequest={pendingDoctorRequest}
            isLoading={doctorLoading}
            error={doctorError}
            searchValue={doctorSearch}
            onSearchChange={(val) => { setDoctorSearch(val); setDoctorPage(1); }}
            page={doctorPage}
            totalPages={doctorTotalPages}
            onPageChange={setDoctorPage}
            onSelect={openRequestDialog}
            reduceMotion={reduceMotion}
          />
          <SupervisorCandidatesSection
            title="Available Teaching Assistants"
            description="Browse active TAs and request one that fits your project stack and workflow."
            role="TA"
            candidates={tas}
            assignedSupervisor={team.ta}
            pendingRequest={pendingTaRequest}
            isLoading={taLoading}
            error={taError}
            searchValue={taSearch}
            onSearchChange={(val) => { setTaSearch(val); setTaPage(1); }}
            page={taPage}
            totalPages={taTotalPages}
            onPageChange={setTaPage}
            onSelect={openRequestDialog}
            reduceMotion={reduceMotion}
          />
        </div>
      </motion.div>

      {/* Send Request Dialog */}
      <Dialog
        open={Boolean(selectedSupervisor)}
        onOpenChange={(open) => !open && !sendingRequest && setSelectedSupervisor(null)}
      >
        <DialogContent className="rounded-xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Send supervision request</DialogTitle>
            <DialogDescription>
              {selectedSupervisor
                ? `Share your project snapshot with ${getFullName(selectedSupervisor)}. They'll use this to decide.`
                : "Share a brief project snapshot before sending the request."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {selectedSupervisor && (
              <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/15 p-3">
                <Avatar className="h-12 w-12 border border-border/60">
                  <AvatarImage src={selectedSupervisor.avatarUrl || "/placeholder.svg"} />
                  <AvatarFallback>{getAvatarInitial(selectedSupervisor)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold">{getFullName(selectedSupervisor)}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedSupervisor.role === "DOCTOR" ? "Doctor / Professor" : "Teaching Assistant"}
                  </p>
                </div>
                <Badge variant="outline" className="ml-auto shrink-0 rounded-md border-primary/25 text-primary">
                  {selectedSupervisor.role === "DOCTOR" ? "Doctor" : "TA"}
                </Badge>
              </div>
            )}

            <div className="space-y-2">
              <Label className="font-semibold">Project name</Label>
              <Input
                value={draft.projectName}
                onChange={(event) => setDraft((current) => ({ ...current, projectName: event.target.value }))}
                placeholder="Smart Campus Builders"
                className="h-11 rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Technologies used</Label>
              <Input
                value={draft.technologies}
                onChange={(event) => setDraft((current) => ({ ...current, technologies: event.target.value }))}
                placeholder="Next.js, Node.js, PostgreSQL"
                className="h-11 rounded-lg"
              />
              <p className="text-xs text-muted-foreground">Separate technologies with commas.</p>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Project description</Label>
              <Textarea
                rows={5}
                value={draft.projectDescription}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, projectDescription: event.target.value }))
                }
                placeholder="Describe the problem you're solving, what you want to build, and the kind of supervision you need."
                className="resize-none rounded-lg"
              />
              <p className="text-xs text-muted-foreground">Minimum 10 characters. Be clear and concise.</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="rounded-lg" onClick={() => setSelectedSupervisor(null)} disabled={sendingRequest}>
              Cancel
            </Button>
            <Button onClick={() => void sendRequest()} disabled={sendingRequest} className="min-w-[140px] rounded-lg">
              {sendingRequest ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              <span className="ml-2">{sendingRequest ? "Sending..." : "Send request"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RemoveSupervisorDialog
        open={Boolean(supervisorToRemove)}
        onOpenChange={(open) => {
          if (!open && !removingRole) setSupervisorToRemove(null)
        }}
        target={supervisorToRemove}
        isSubmitting={Boolean(removingRole)}
        onConfirm={() => {
          if (supervisorToRemove) void removeSupervisorAssignment(supervisorToRemove.role)
        }}
      />
    </div>
  )
}

export function SupervisorRequestInbox({ currentRole, requests, supervisedTeams, onRefresh }: SupervisorRequestInboxProps) {
  const [busyRequestId, setBusyRequestId] = useState("")
  const [busyAction, setBusyAction] = useState<"accept" | "decline" | "">("")
  const reduceMotion = Boolean(useReducedMotion())

  const pendingRequests = requests.filter((item) => item.status === "PENDING")
  const historyRequests = requests.filter((item) => item.status !== "PENDING")

  const respond = async (requestId: string, action: "accept" | "decline") => {
    setBusyRequestId(requestId)
    setBusyAction(action)
    try {
      if (action === "accept") {
        await teamsApi.acceptSupervisorRequest(requestId)
        toast.success("Supervisor request accepted.")
      } else {
        await teamsApi.declineSupervisorRequest(requestId)
        toast.success("Supervisor request declined.")
      }
      await onRefresh()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Couldn't update that supervisor request.")
    } finally {
      setBusyRequestId("")
      setBusyAction("")
    }
  }

  const roleLabel = currentRole === "doctor" ? "Doctor" : "Teaching Assistant"

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: EASE_OUT_QUINT,
      },
    },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-6 lg:p-10"
    >
      {/* Hero Section */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-[32px] border border-primary/10 bg-gradient-to-br from-primary/[0.03] via-background to-primary/[0.01] p-8 md:p-12">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl" />
        
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                {roleLabel} Workspace
              </Badge>
              {pendingRequests.length > 0 && (
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Badge className="bg-amber-500 text-white shadow-lg shadow-amber-500/20">
                    {pendingRequests.length} Pending Actions
                  </Badge>
                </motion.div>
              )}
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Supervision Hub
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Review incoming project proposals, manage your supervised teams, and provide guidance to the next generation of engineers.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-6 rounded-3xl border border-primary/10 bg-background/50 p-6 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Supervising</p>
              <p className="mt-1 text-3xl font-bold text-foreground tabular-nums">{supervisedTeams.length}</p>
            </div>
            <div className="h-10 w-px bg-primary/10" />
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Incoming</p>
              <p className="mt-1 text-3xl font-bold text-foreground tabular-nums">{pendingRequests.length}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-8">
          {/* Pending Requests Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <Mail className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Incoming Requests</h2>
              </div>
              {pendingRequests.length > 0 && (
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Awaiting your review
                </span>
              )}
            </div>

            <AnimatePresence mode="popLayout">
              {pendingRequests.length > 0 ? (
                <div className="grid gap-4">
                  {pendingRequests.map((request, i) => (
                    <motion.div
                      key={request.id}
                      variants={itemVariants}
                      layout
                      className="group relative overflow-hidden rounded-[28px] border border-border/60 bg-card p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5"
                    >
                      <div className="absolute right-0 top-0 h-2 w-full bg-gradient-to-r from-amber-400/40 to-amber-500/10" />
                      
                      <div className="space-y-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="bg-muted/50 font-bold">
                                {request.team.name}
                              </Badge>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 italic">
                                Sent {new Date(request.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <h3 className="text-2xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                              {request.projectName}
                            </h3>
                          </div>
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                            <Clock className="h-6 w-6" />
                          </div>
                        </div>

                        <div className="rounded-2xl bg-muted/30 p-4">
                          <p className="text-sm leading-relaxed text-foreground/80">
                            {request.projectDescription}
                          </p>
                        </div>

                        {request.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {request.technologies.map((tech) => (
                              <Badge key={tech} variant="outline" className="rounded-full border-primary/10 bg-primary/5 text-primary">
                                {tech}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                              <AvatarImage src={request.requestedBy.avatarUrl || "/placeholder.svg"} />
                              <AvatarFallback className="bg-primary/10 text-primary font-bold">{getAvatarInitial(request.requestedBy)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground leading-none">{getFullName(request.requestedBy)}</p>
                              <p className="mt-1 text-xs text-muted-foreground truncate">{request.requestedBy.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              className="h-11 rounded-xl font-bold text-muted-foreground hover:bg-destructive/5 hover:text-destructive"
                              disabled={busyRequestId === request.id}
                              onClick={() => void respond(request.id, "decline")}
                            >
                              {busyRequestId === request.id && busyAction === "decline" ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="mr-2 h-4 w-4" />
                              )}
                              Decline
                            </Button>
                            <Button
                              className="h-11 rounded-xl px-6 font-bold shadow-lg shadow-primary/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                              disabled={busyRequestId === request.id}
                              onClick={() => void respond(request.id, "accept")}
                            >
                              {busyRequestId === request.id && busyAction === "accept" ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <UserCheck className="mr-2 h-4 w-4" />
                              )}
                              Accept Request
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div
                  variants={itemVariants}
                  className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-border/60 bg-muted/20 py-16 text-center"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground/40">
                    <Inbox className="h-8 w-8" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold">Inbox is Clear</h3>
                  <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                    You don't have any pending supervision requests right now.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* History Section */}
          {historyRequests.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-3 px-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Past Decisions</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {historyRequests.map((request) => (
                  <motion.div key={request.id} variants={itemVariants}>
                    <SupervisorRequestHistoryCard request={request} />
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar: Supervised Teams */}
        <div className="lg:col-span-4 space-y-8">
          <section className="sticky top-8 space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Users className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Supervised Teams</h2>
              </div>
            </div>

            <div className="grid gap-4">
              {supervisedTeams.length > 0 ? (
                supervisedTeams.map((team) => (
                  <motion.div
                    key={team.id}
                    variants={itemVariants}
                    className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:border-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/5"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-wider">
                          {team.stage.replaceAll("_", " ")}
                        </Badge>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                          {team.memberCount}/{team.maxMembers} members
                        </span>
                      </div>
                      <h3 className="text-xl font-bold tracking-tight group-hover:text-emerald-600 transition-colors">
                        {team.name}
                      </h3>
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {team.bio || "No team bio added yet."}
                      </p>
                      
                      <div className="flex items-center gap-2 pt-2">
                        <Button variant="outline" size="sm" className="h-9 flex-1 rounded-xl border-border/60 font-bold transition-all hover:bg-emerald-500/5 hover:text-emerald-600 hover:border-emerald-500/30" asChild>
                          <Link href={`/dashboard/teams/${team.id}`}>
                            View Space
                          </Link>
                        </Button>
                        <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl border-border/60 hover:bg-primary/5 hover:text-primary transition-all" asChild>
                          <Link href={`/dashboard/tasks?teamId=${team.id}`}>
                            <Users className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  variants={itemVariants}
                  className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-muted/20 py-12 text-center"
                >
                  <Users className="h-8 w-8 text-muted-foreground/30" />
                  <p className="mt-3 text-sm font-bold text-muted-foreground">No assigned teams yet</p>
                </motion.div>
              )}
            </div>

            {/* Support/Resource Card */}
            <motion.div variants={itemVariants} className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 to-transparent p-6">
              <div className="flex items-center gap-3 text-primary">
                <Sparkles className="h-5 w-5" />
                <h3 className="text-sm font-bold uppercase tracking-widest">Supervisor Guide</h3>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Need help with your supervision duties? Check out our guidelines for effective project guidance.
              </p>
              <Button variant="link" className="mt-2 h-auto p-0 text-xs font-bold text-primary hover:no-underline">
                Read Guidelines <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </motion.div>
          </section>
        </div>
      </div>
    </motion.div>
  )
}

function AssignmentCard({
  role,
  assignedSupervisor,
  pendingRequest,
  helper,
  reduceMotion,
  onRemove,
  isRemoving,
}: {
  role: ApiSupervisorRole
  assignedSupervisor: ApiTeamUser | null
  pendingRequest: ApiSupervisorRequest | null
  helper: string
  reduceMotion: boolean
  onRemove?: () => void
  isRemoving?: boolean
}) {
  const roleLabel = role === "DOCTOR" ? "Doctor" : "Teaching Assistant"
  const RoleIcon = role === "DOCTOR" ? GraduationCap : Users

  return (
    <motion.div
      {...getSupervisorHoverMotion(reduceMotion)}
      className="group relative flex flex-col gap-4 rounded-3xl border border-border/60 bg-background p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <RoleIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold tracking-tight text-foreground">{roleLabel}</p>
            <p className="text-xs font-medium text-muted-foreground">{helper}</p>
          </div>
        </div>
        {assignedSupervisor ? (
          <Badge className="h-6 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
            Assigned
          </Badge>
        ) : pendingRequest ? (
          <Badge variant="outline" className="h-6 rounded-full border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
            Pending
          </Badge>
        ) : (
          <Badge variant="secondary" className="h-6 rounded-full bg-muted/50 text-[10px] font-bold uppercase tracking-wider">
            Open
          </Badge>
        )}
      </div>

      {assignedSupervisor ? (
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 transition-colors group-hover:bg-muted/30">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
              <AvatarImage src={assignedSupervisor.avatarUrl || "/placeholder.svg"} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">{getAvatarInitial(assignedSupervisor)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground leading-none">{getFullName(assignedSupervisor)}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{assignedSupervisor.email}</p>
            </div>
            {onRemove ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-destructive/5 hover:text-destructive transition-all"
                onClick={onRemove}
                disabled={isRemoving}
              >
                {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            ) : null}
          </div>
        </div>
      ) : pendingRequest ? (
        <div className="rounded-2xl border border-amber-500/10 bg-amber-500/[0.03] p-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
              <AvatarImage src={pendingRequest.supervisor.avatarUrl || "/placeholder.svg"} />
              <AvatarFallback className="bg-amber-500/10 text-amber-600 font-bold">{getAvatarInitial(pendingRequest.supervisor)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-bold text-foreground leading-none">{getFullName(pendingRequest.supervisor)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Waiting for supervisor to accept</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 py-6 text-center">
          <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">Unassigned Slot</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Find a {roleLabel.toLowerCase()} in the directory below</p>
        </div>
      )}
    </motion.div>
  )
}

function RemoveSupervisorDialog({
  open,
  onOpenChange,
  target,
  isSubmitting,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: SupervisorRemovalTarget | null
  isSubmitting: boolean
  onConfirm: () => void
}) {
  const roleLabel = target?.role === "DOCTOR" ? "Doctor" : "TA"
  const supervisorName = target ? getFullName(target.supervisor) : "this supervisor"

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md overflow-hidden rounded-[40px] border-destructive/20 p-0 shadow-2xl">
        <div className="p-8">
          <AlertDialogHeader className="space-y-4 text-left">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <TriangleAlert className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <AlertDialogTitle className="text-2xl tracking-tight">Remove {roleLabel}?</AlertDialogTitle>
              <AlertDialogDescription className="text-base leading-relaxed">
                This will remove the assignment from your team. You can always re-request them later if needed.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>

          {target ? (
            <div className="mt-6 rounded-2xl border border-destructive/15 bg-destructive/[0.02] p-5">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                  <AvatarImage src={target.supervisor.avatarUrl || "/placeholder.svg"} />
                  <AvatarFallback className="bg-destructive/10 text-destructive font-bold">{getAvatarInitial(target.supervisor)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-bold text-foreground">{supervisorName}</p>
                  <p className="truncate text-xs text-muted-foreground">{target.supervisor.email}</p>
                </div>
              </div>
            </div>
          ) : null}

          <AlertDialogFooter className="mt-8 gap-3 sm:gap-3">
            <Button variant="outline" className="h-11 flex-1 rounded-xl font-bold" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
              Keep Assignment
            </Button>
            <Button
              className="h-11 flex-1 rounded-xl bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/10"
              disabled={isSubmitting}
              onClick={(event) => {
                event.preventDefault()
                onConfirm()
              }}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span className="ml-2">Remove</span>
            </Button>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function SupervisorCandidatesSection({
  title,
  description,
  role,
  candidates,
  assignedSupervisor,
  pendingRequest,
  isLoading,
  error,
  searchValue,
  onSearchChange,
  page,
  totalPages,
  onPageChange,
  onSelect,
  reduceMotion,
}: {
  title: string
  description: string
  role: ApiSupervisorRole
  candidates: ApiDirectoryUser[]
  assignedSupervisor: ApiTeamUser | null
  pendingRequest: ApiSupervisorRequest | null
  isLoading: boolean
  error: string
  searchValue: string
  onSearchChange: (value: string) => void
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  onSelect: (candidate: ApiDirectoryUser) => void
  reduceMotion: boolean
}) {
  const roleLabel = role === "DOCTOR" ? "Doctor" : "TA"
  const RoleIcon = role === "DOCTOR" ? GraduationCap : Users
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Build the department filter from the visible candidates.
  const departments = Array.from(
    new Set(
      candidates
        .map((c) => c.department)
        .filter((d): d is NonNullable<ApiDirectoryUser["department"]> => Boolean(d)),
    ),
  ).sort()
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL")

  const filteredCandidates =
    departmentFilter === "ALL"
      ? candidates
      : candidates.filter((c) => c.department === departmentFilter)

  // Keep the assigned or pending supervisor easy to find.
  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    const aPriority = assignedSupervisor?.id === a.id ? 0 : pendingRequest?.supervisor.id === a.id ? 1 : 2
    const bPriority = assignedSupervisor?.id === b.id ? 0 : pendingRequest?.supervisor.id === b.id ? 1 : 2
    return aPriority - bPriority
  })

  return (
    <Card className="overflow-hidden rounded-[32px] border-border/60 bg-background shadow-xl shadow-primary/5">
      <CardHeader className="space-y-4 border-b border-border/40 bg-muted/5 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <RoleIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-xl font-bold tracking-tight">{title}</CardTitle>
            <CardDescription className="mt-1 text-sm leading-relaxed">{description}</CardDescription>
          </div>
          <Badge variant="outline" className="rounded-full border-primary/10 bg-primary/5 px-3 py-1 text-xs font-bold text-primary">
            {filteredCandidates.length} Available
          </Badge>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={`Search ${roleLabel.toLowerCase()}s...`}
              className="h-11 rounded-xl border-border/60 bg-background/50 pl-10 text-sm transition-all focus-visible:bg-background focus-visible:ring-primary/20"
            />
          </div>
          {departments.length > 1 && (
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="h-11 w-full rounded-xl border-border/60 bg-background/50 text-sm sm:w-[200px] transition-all focus:ring-primary/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>{d.replaceAll("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-4 md:p-6">
        {/* States */}
        {isLoading && (
          <div className="space-y-3 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-2xl border border-border/40 bg-muted/10 p-4">
                <div className="h-10 w-10 shrink-0 rounded-full bg-muted/40 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-muted/40 animate-pulse" />
                  <div className="h-2.5 w-48 rounded bg-muted/30 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm font-medium text-destructive">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {!isLoading && !error && filteredCandidates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground/40">
              <Search className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-base font-bold text-foreground">No matches found</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Try a different search term or clear your filters to find more {roleLabel.toLowerCase()}s.
            </p>
          </div>
        )}

        {/* Candidate rows */}
        {!isLoading && !error && filteredCandidates.length > 0 && (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {sortedCandidates.map((candidate, index) => {
                const isAssigned = assignedSupervisor?.id === candidate.id
                const hasAssignedOther = Boolean(assignedSupervisor) && assignedSupervisor?.id !== candidate.id
                const isPendingSameCandidate = pendingRequest?.supervisor.id === candidate.id
                const hasPendingOtherCandidate = Boolean(pendingRequest) && pendingRequest?.supervisor.id !== candidate.id
                const actionDisabled = isAssigned || hasAssignedOther || isPendingSameCandidate || hasPendingOtherCandidate
                const isExpanded = expandedId === candidate.id

                let actionLabel = `Request ${roleLabel}`
                if (isAssigned) actionLabel = "Assigned"
                else if (hasAssignedOther) actionLabel = "Full"
                else if (isPendingSameCandidate) actionLabel = "Pending"
                else if (hasPendingOtherCandidate) actionLabel = "Pending Other"

                return (
                  <motion.div
                    key={candidate.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
                    transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.3 }}
                    className={cn(
                      "overflow-hidden rounded-2xl border transition-all",
                      isAssigned
                        ? "border-emerald-500/30 bg-emerald-500/[0.03]"
                        : isPendingSameCandidate
                          ? "border-amber-500/30 bg-amber-500/[0.03]"
                          : isExpanded 
                            ? "border-primary/30 bg-primary/[0.01] shadow-md shadow-primary/5"
                            : "border-border/60 bg-background hover:border-primary/20 hover:bg-muted/5",
                    )}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedId(isExpanded ? null : candidate.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setExpandedId(isExpanded ? null : candidate.id)
                        }
                      }}
                      className="flex w-full cursor-pointer items-center gap-4 px-4 py-3.5 text-left outline-none"
                    >
                      <Avatar className="h-10 w-10 shrink-0 border-2 border-background shadow-sm">
                        <AvatarImage src={candidate.avatarUrl || "/placeholder.svg"} />
                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{getAvatarInitial(candidate)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-base font-bold leading-none text-foreground">{getFullName(candidate)}</p>
                          {isAssigned && (
                            <Badge className="h-5 gap-1 bg-emerald-500 text-white px-2 text-[9px] font-bold uppercase tracking-wider">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Current
                            </Badge>
                          )}
                          {isPendingSameCandidate && (
                            <Badge className="h-5 gap-1 bg-amber-500 text-white px-2 text-[9px] font-bold uppercase tracking-wider">
                              <Clock className="h-2.5 w-2.5" />
                              Pending
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-medium">
                          <span className="truncate">{candidate.department?.replaceAll("_", " ") || "No Department"}</span>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                          <span className="truncate">{candidate.email}</span>
                        </div>
                      </div>

                      {!isExpanded && !actionDisabled && (
                        <Button
                          size="sm"
                          className="h-9 shrink-0 rounded-xl px-4 text-xs font-bold shadow-sm shadow-primary/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                          onClick={(e) => { e.stopPropagation(); onSelect(candidate) }}
                        >
                          Request
                        </Button>
                      )}
                      
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground transition-all",
                        isExpanded && "bg-primary/10 text-primary rotate-180"
                      )}>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key="expanded"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: EASE_OUT_QUINT }}
                          className="overflow-hidden border-t border-border/40 bg-muted/5"
                        >
                          <div className="space-y-5 p-5">
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">About {getFullName(candidate).split(" ")[0]}</p>
                              {candidate.bio?.trim() ? (
                                <p className="text-sm leading-relaxed text-foreground/80">{candidate.bio}</p>
                              ) : (
                                <p className="text-sm italic text-muted-foreground/60">No bio provided by this {roleLabel.toLowerCase()}.</p>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                              {candidate.preferredTrack && (
                                <Badge variant="outline" className="rounded-lg border-primary/10 bg-primary/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                                  {candidate.preferredTrack.replaceAll("_", " ")}
                                </Badge>
                              )}
                              {candidate.academicYear && (
                                <Badge variant="outline" className="rounded-lg border-primary/10 bg-primary/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                                  {candidate.academicYear.replaceAll("_", " ")}
                                </Badge>
                              )}
                            </div>

                            <div className="flex gap-3 pt-2">
                              <Button
                                variant="outline"
                                className="group h-11 flex-1 rounded-xl font-bold border-border/60 hover:bg-primary/5 hover:text-primary hover:border-primary/30 shadow-sm transition-all justify-between px-5"
                                asChild
                              >
                                <Link href={`/dashboard/users/${candidate.id}`}>
                                  View Profile
                                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </Link>
                              </Button>
                              <Button
                                className={cn(
                                  "h-11 flex-[1.5] rounded-xl font-bold shadow-lg transition-all",
                                  actionDisabled ? "bg-muted text-muted-foreground shadow-none" : "shadow-primary/10 hover:scale-[1.01] active:scale-[0.99]"
                                )}
                                disabled={actionDisabled}
                                onClick={(e) => { e.stopPropagation(); onSelect(candidate) }}
                              >
                                {actionDisabled ? (
                                  <span>{actionLabel}</span>
                                ) : (
                                  <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Send {roleLabel} Request
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !error && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-6">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Page <span className="text-foreground">{page}</span> of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-xl border-border/60 font-bold px-4"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-xl border-border/60 font-bold px-4"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SupervisorRequestHistoryCard({ request, reduceMotion = false }: { request: ApiSupervisorRequest; reduceMotion?: boolean }) {
  return (
    <motion.div
      {...getSupervisorHoverMotion(reduceMotion)}
      className="group relative flex flex-col gap-4 rounded-2xl border border-border/60 bg-background p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-muted/50 text-[9px] font-bold uppercase tracking-wider">
              {request.supervisorRole === "DOCTOR" ? "Doctor" : "TA"}
            </Badge>
            <span className="text-[10px] font-bold text-muted-foreground/60 italic">
              {new Date(request.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="font-bold text-sm leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-1">{request.projectName}</p>
          <p className="text-[11px] text-muted-foreground font-medium truncate">{getFullName(request.supervisor)}</p>
        </div>
        <SupervisorStatusBadge status={request.status} />
      </div>

      <div className="flex items-center justify-between border-t border-border/40 pt-3">
        <div className="flex -space-x-2 overflow-hidden">
          {request.technologies.slice(0, 3).map((item) => (
            <div key={item} className="inline-flex h-6 items-center rounded-full border border-background bg-muted px-2 text-[9px] font-bold uppercase tracking-tighter">
              {item}
            </div>
          ))}
          {request.technologies.length > 3 && (
            <div className="inline-flex h-6 items-center rounded-full border border-background bg-muted px-2 text-[9px] font-bold text-muted-foreground">
              +{request.technologies.length - 3}
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-[10px] font-bold" asChild>
          <Link href={`/dashboard/teams/${request.team.id}`}>
            Details
          </Link>
        </Button>
      </div>
    </motion.div>
  )
}

function SupervisorStatusBadge({ status }: { status: ApiSupervisorRequest["status"] }) {
  if (status === "ACCEPTED") {
    return (
      <Badge className="h-6 shrink-0 gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold">
        <CheckCircle2 className="h-3 w-3" />
        Accepted
      </Badge>
    )
  }

  if (status === "DECLINED") {
    return (
      <Badge variant="outline" className="h-6 shrink-0 gap-1 border-destructive/20 bg-destructive/5 text-destructive text-[10px] font-bold">
        <XCircle className="h-3 w-3" />
        Declined
      </Badge>
    )
  }

  if (status === "CANCELLED") {
    return (
      <Badge variant="secondary" className="h-6 shrink-0 text-[10px] font-bold bg-muted/50">
        Cancelled
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="h-6 shrink-0 gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold">
      <Sparkles className="h-3 w-3" />
      Pending
    </Badge>
  )
}

function SupervisorMetaLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/15 px-3 py-3">
      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}
