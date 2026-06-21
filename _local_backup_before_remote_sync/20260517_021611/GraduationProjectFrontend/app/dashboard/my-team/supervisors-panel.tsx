"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
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

  useEffect(() => {
    let cancelled = false
    setDoctorLoading(true)
    setDoctorError("")

    usersApi
      .directory({ role: "DOCTOR", search: doctorSearch || undefined, page: doctorPage, limit: 12 })
      .then((result) => {
        if (cancelled) return
        setDoctorTotalPages(result.meta.totalPages || 1)
        setDoctors((current) => (doctorPage === 1 ? result.items : [...current, ...result.items.filter((item) => current.every((existing) => existing.id !== item.id))]))
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
        setTas((current) => (taPage === 1 ? result.items : [...current, ...result.items.filter((item) => current.every((existing) => existing.id !== item.id))]))
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

  const pendingDoctorRequest = requests.find(
    (item) => item.supervisorRole === "DOCTOR" && item.status === "PENDING",
  ) ?? null
  const pendingTaRequest = requests.find((item) => item.supervisorRole === "TA" && item.status === "PENDING") ?? null

  return (
    <div className="space-y-6">
      <motion.section
        {...getSupervisorRevealMotion(reduceMotion)}
        className="overflow-hidden rounded-[28px] border border-border/70 bg-background shadow-sm"
      >
        <div className="grid gap-5 bg-gradient-to-br from-primary/[0.08] via-background to-background p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="min-w-0 space-y-4">
            <Badge variant="outline" className="w-fit border-primary/20 bg-background/80 text-primary">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              Supervisor setup
            </Badge>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Choose the right academic support</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Keep your Doctor and TA assignments clear, searchable, and easy to update from one focused workspace.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <SupervisorStatusPill
              label="Doctor"
              user={team.doctor}
              pendingRequest={pendingDoctorRequest}
              emptyText="No doctor assigned"
            />
            <SupervisorStatusPill
              label="TA"
              user={team.ta}
              pendingRequest={pendingTaRequest}
              emptyText="No TA assigned"
            />
          </div>
        </div>

        <div className="border-t border-border/60 p-5 sm:p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Flow</p>
          <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Review status",
              desc: "See assigned and pending supervisors before sending another request.",
            },
            {
              step: "02",
              title: "Browse profiles",
              desc: "Search by name, email, department, and read short profile notes.",
            },
            {
              step: "03",
              title: "Send request",
              desc: "Share the project snapshot and wait for their response.",
            },
          ].map(({ step, title, desc }) => (
            <motion.div
              key={step}
              {...getSupervisorRevealMotion(reduceMotion, Number(step) * 0.03)}
              className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 transition-[border-color,background-color,transform] duration-200 hover:border-primary/20 hover:bg-muted/30 motion-safe:hover:-translate-y-0.5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                {step}
              </div>
              <div>
                <p className="text-sm font-semibold leading-5">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p>
              </div>
            </motion.div>
          ))}
          </div>
        </div>
      </motion.section>

      {/* Step 1 — Current Status */}
      <motion.div {...getSupervisorRevealMotion(reduceMotion, 0.05)} className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
          <h2 className="text-base font-semibold tracking-tight">Current assignments</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
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

      {/* Request History */}
      {requests.length > 0 && (
        <motion.div {...getSupervisorRevealMotion(reduceMotion, 0.08)}>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base">Request History</CardTitle>
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

      {/* Step 2 — Browse & Request */}
      <motion.div {...getSupervisorRevealMotion(reduceMotion, 0.1)} className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
          <h2 className="text-base font-semibold tracking-tight">Browse &amp; Request Supervisors</h2>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
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
            onSearchChange={setDoctorSearch}
            canLoadMore={doctorPage < doctorTotalPages}
            onLoadMore={() => setDoctorPage((p) => p + 1)}
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
            onSearchChange={setTaSearch}
            canLoadMore={taPage < taTotalPages}
            onLoadMore={() => setTaPage((p) => p + 1)}
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl tracking-tight">Send supervision request</DialogTitle>
            <DialogDescription>
              {selectedSupervisor
                ? `Share your project snapshot with ${getFullName(selectedSupervisor)}. They'll use this to decide.`
                : "Share a brief project snapshot before sending the request."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {selectedSupervisor && (
              <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
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
                <Badge variant="outline" className="ml-auto shrink-0 border-primary/25 text-primary">
                  {selectedSupervisor.role === "DOCTOR" ? "Doctor" : "TA"}
                </Badge>
              </div>
            )}

            <div className="space-y-2">
              <Label className="font-semibold">Project Name</Label>
              <Input
                value={draft.projectName}
                onChange={(event) => setDraft((current) => ({ ...current, projectName: event.target.value }))}
                placeholder="Smart Campus Builders"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Technologies Used</Label>
              <Input
                value={draft.technologies}
                onChange={(event) => setDraft((current) => ({ ...current, technologies: event.target.value }))}
                placeholder="Next.js, Node.js, PostgreSQL"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Separate technologies with commas.</p>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Project Description</Label>
              <Textarea
                rows={5}
                value={draft.projectDescription}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, projectDescription: event.target.value }))
                }
                placeholder="Describe the problem you're solving, what you want to build, and the kind of supervision you need."
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">Minimum 10 characters. Be clear and concise.</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setSelectedSupervisor(null)} disabled={sendingRequest}>
              Cancel
            </Button>
            <Button onClick={() => void sendRequest()} disabled={sendingRequest} className="min-w-[140px]">
              {sendingRequest ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              <span className="ml-2">{sendingRequest ? "Sending..." : "Send Request"}</span>
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

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="overflow-hidden rounded-[28px] border border-border/70 shadow-sm">
        <div className="bg-gradient-to-br from-primary/[0.10] via-background to-primary/[0.04] px-5 py-6 sm:px-6 sm:py-7 md:px-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
            <div className="space-y-3">
              <Badge variant="outline" className="border-primary/25 bg-background/85 text-primary">
                {roleLabel} Inbox
              </Badge>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Supervision Requests
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Each request includes the team name, project idea, and tech stack so you can review and decide with full context.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-background/92 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Inbox Overview</p>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-1">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-amber-700 dark:text-amber-400">Pending</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{pendingRequests.length}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Reviewed</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{historyRequests.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assigned Teams */}
      {supervisedTeams.length > 0 && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base">Teams You Supervise</CardTitle>
            <CardDescription>Teams that currently list you as an active supervisor.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 xl:grid-cols-2">
            {supervisedTeams.map((team) => (
              <div key={team.id} className="rounded-[20px] border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold tracking-tight">{team.name}</p>
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                        {team.stage.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground line-clamp-2">
                      {team.bio || "No team bio added yet."}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" asChild>
                    <Link href={`/dashboard/teams/${team.id}`}>
                      Open Team
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-xl" asChild>
                    <Link href={`/dashboard/tasks?teamId=${team.id}`}>Tasks</Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-xl" asChild>
                    <Link href={`/dashboard/github?teamId=${team.id}`}>GitHub</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pending Requests */}
      {pendingRequests.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Pending Requests</h2>
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400">
              {pendingRequests.length} awaiting
            </Badge>
          </div>
          <div className="space-y-3">
            {pendingRequests.map((request) => {
              const isBusy = busyRequestId === request.id
              return (
                <div
                  key={request.id}
                  className="overflow-hidden rounded-[24px] border border-border/70 bg-background shadow-sm"
                >
                  {/* Amber accent bar */}
                  <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-amber-500" />

                  <div className="p-5 sm:p-6">
                    {/* Header row */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                            {request.supervisorRole === "DOCTOR" ? "Doctor Request" : "TA Request"}
                          </Badge>
                          <Badge variant="secondary">
                            {request.team.name}
                          </Badge>
                        </div>
                        <h3 className="text-lg font-bold tracking-tight">{request.projectName}</h3>
                      </div>
                      <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    </div>

                    {/* Description */}
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{request.projectDescription}</p>

                    {/* Tech stack */}
                    {request.technologies.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {request.technologies.map((item) => (
                          <Badge key={item} variant="secondary" className="rounded-full">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Requester info */}
                    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                      <Avatar className="h-9 w-9 border border-border/60">
                        <AvatarImage src={request.requestedBy.avatarUrl || "/placeholder.svg"} />
                        <AvatarFallback>{getAvatarInitial(request.requestedBy)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{getFullName(request.requestedBy)}</p>
                        <p className="text-xs text-muted-foreground">{request.requestedBy.email}</p>
                      </div>
                      <Badge variant="outline" className="ml-auto shrink-0">Team Leader</Badge>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Button variant="ghost" size="sm" className="self-start rounded-xl text-muted-foreground" asChild>
                        <Link href={`/dashboard/teams/${request.team.id}`}>
                          View Team Page
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive sm:flex-none sm:min-w-[110px]"
                          disabled={isBusy}
                          onClick={() => void respond(request.id, "decline")}
                        >
                          {isBusy && busyAction === "decline" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          <span className="ml-2">Decline</span>
                        </Button>
                        <Button
                          className="flex-1 rounded-xl sm:flex-none sm:min-w-[110px]"
                          disabled={isBusy}
                          onClick={() => void respond(request.id, "accept")}
                        >
                          {isBusy && busyAction === "accept" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                          <span className="ml-2">Accept</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-dashed border-border/70 p-8 text-center sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No pending requests</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            When team leaders request you as a supervisor, requests will appear here with full project details.
          </p>
        </div>
      )}

      {/* History */}
      {historyRequests.length > 0 && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base">Reviewed Requests</CardTitle>
            <CardDescription>Your past supervision decisions for reference.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 xl:grid-cols-2">
            {historyRequests.map((request) => (
              <SupervisorRequestHistoryCard key={request.id} request={request} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SupervisorStatusPill({
  label,
  user,
  pendingRequest,
  emptyText,
}: {
  label: "Doctor" | "TA"
  user: ApiTeamUser | null
  pendingRequest: ApiSupervisorRequest | null
  emptyText: string
}) {
  const Icon = label === "Doctor" ? GraduationCap : Users
  const stateLabel = user ? "Assigned" : pendingRequest ? "Pending" : "Open"
  const stateClass = user
    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : pendingRequest
      ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : "border-border/70 bg-background/70 text-muted-foreground"

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/80 p-3 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold">
          {user ? getFullName(user) : pendingRequest ? getFullName(pendingRequest.supervisor) : emptyText}
        </p>
      </div>
      <Badge variant="outline" className={cn("shrink-0 rounded-full", stateClass)}>
        {stateLabel}
      </Badge>
    </div>
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
      className="overflow-hidden rounded-[24px] border border-border/70 bg-background shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/20 hover:shadow-md"
    >
      {/* Top accent */}
      <div className={`h-1 w-full ${assignedSupervisor ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : pendingRequest ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-border/40"}`} />

      <div className="p-5">
        {/* Role header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <RoleIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{roleLabel}</p>
            <p className="text-xs text-muted-foreground">{helper}</p>
          </div>
        </div>

        {/* Status body */}
        {assignedSupervisor ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 border border-border/60">
                <AvatarImage src={assignedSupervisor.avatarUrl || "/placeholder.svg"} />
                <AvatarFallback>{getAvatarInitial(assignedSupervisor)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-5">{getFullName(assignedSupervisor)}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{assignedSupervisor.email}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className="gap-1 bg-emerald-600 text-white">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Assigned
              </Badge>
              {onRemove && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg border-destructive/25 bg-background/70 px-2.5 text-xs text-destructive transition-[background-color,border-color,transform] hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive motion-safe:hover:-translate-y-0.5"
                  onClick={onRemove}
                  disabled={isRemoving}
                >
                  {isRemoving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  <span className="ml-1">Remove</span>
                </Button>
              )}
            </div>
          </div>
        ) : pendingRequest ? (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 border border-border/60">
                <AvatarImage src={pendingRequest.supervisor.avatarUrl || "/placeholder.svg"} />
                <AvatarFallback>{getAvatarInitial(pendingRequest.supervisor)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold leading-5">{getFullName(pendingRequest.supervisor)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Request sent &mdash; waiting for response
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="mt-3 gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <Clock className="h-3 w-3" />
              Awaiting Response
            </Badge>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border/60 p-4">
            <p className="text-sm text-muted-foreground">No {roleLabel.toLowerCase()} assigned yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Browse supervisors below and send a request.</p>
          </div>
        )}
      </div>
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
      <AlertDialogContent className="max-w-md overflow-hidden rounded-[28px] border-destructive/20 p-0 shadow-2xl">
        <div className="p-6">
          <AlertDialogHeader className="space-y-4 text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
              <TriangleAlert className="h-5 w-5" />
            </div>
            <div>
              <AlertDialogTitle className="text-2xl tracking-tight">Remove {roleLabel}?</AlertDialogTitle>
              <AlertDialogDescription className="mt-2 leading-6">
                This removes the assignment from your team. It will not delete the user account or any project data.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>

          {target ? (
            <div className="mt-5 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11 border border-border/60">
                  <AvatarImage src={target.supervisor.avatarUrl || "/placeholder.svg"} />
                  <AvatarFallback>{getAvatarInitial(target.supervisor)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{supervisorName}</p>
                  <p className="truncate text-sm text-muted-foreground">{target.supervisor.email}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-background/80 px-3 py-2">
                  <span className="block text-xs text-muted-foreground">Role</span>
                  <span className="font-semibold">{roleLabel}</span>
                </div>
                <div className="rounded-xl bg-background/80 px-3 py-2">
                  <span className="block text-xs text-muted-foreground">Team</span>
                  <span className="font-semibold">Unassigned</span>
                </div>
              </div>
            </div>
          ) : null}

          <AlertDialogFooter className="mt-6 gap-3 sm:gap-3">
            <AlertDialogCancel className="h-11 rounded-xl" disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
              onClick={(event) => {
                event.preventDefault()
                onConfirm()
              }}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span className="ml-2">Remove Assignment</span>
            </AlertDialogAction>
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
  canLoadMore,
  onLoadMore,
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
  canLoadMore: boolean
  onLoadMore: () => void
  onSelect: (candidate: ApiDirectoryUser) => void
  reduceMotion: boolean
}) {
  const roleLabel = role === "DOCTOR" ? "Doctor" : "TA"
  const RoleIcon = role === "DOCTOR" ? GraduationCap : Users
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Derive a department filter dropdown from the visible candidates
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

  // Auto-pin the assigned supervisor + pending-requested supervisor to the top
  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    const aPriority = assignedSupervisor?.id === a.id ? 0 : pendingRequest?.supervisor.id === a.id ? 1 : 2
    const bPriority = assignedSupervisor?.id === b.id ? 0 : pendingRequest?.supervisor.id === b.id ? 1 : 2
    return aPriority - bPriority
  })

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/15 hover:shadow-md">
      <CardHeader className="space-y-2 border-b border-border/60 bg-muted/15 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <RoleIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Badge variant="outline" className="rounded-full text-xs">
            {filteredCandidates.length}
            {departmentFilter !== "ALL" && candidates.length !== filteredCandidates.length && (
              <span className="ml-1 text-muted-foreground">/ {candidates.length}</span>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 sm:p-5">
        {/* Search + department filter row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={`Search ${roleLabel.toLowerCase()}s by name, email, department…`}
              className="h-10 rounded-xl border-border/70 bg-background pl-9 text-sm"
            />
          </div>
          {departments.length > 1 && (
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl text-sm sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>{d.replaceAll("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* States */}
        {isLoading && (
          <div className="space-y-1.5 py-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                <div className="h-9 w-9 shrink-0 rounded-full bg-muted/40 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 rounded bg-muted/40 animate-pulse" />
                  <div className="h-2.5 w-48 rounded bg-muted/30 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!isLoading && !error && filteredCandidates.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 p-8 text-center">
            <RoleIcon className="mx-auto mb-2 h-7 w-7 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {searchValue || departmentFilter !== "ALL"
                ? "No matches. Try a different search or clear the filter."
                : `No ${roleLabel.toLowerCase()} accounts available right now.`}
            </p>
          </div>
        )}

        {/* Compact candidate rows — click to expand */}
        {!isLoading && !error && filteredCandidates.length > 0 && (
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {sortedCandidates.map((candidate, index) => {
                const isAssigned = assignedSupervisor?.id === candidate.id
                const hasAssignedOther = Boolean(assignedSupervisor) && assignedSupervisor?.id !== candidate.id
                const isPendingSameCandidate = pendingRequest?.supervisor.id === candidate.id
                const hasPendingOtherCandidate = Boolean(pendingRequest) && pendingRequest?.supervisor.id !== candidate.id
                const actionDisabled = isAssigned || hasAssignedOther || isPendingSameCandidate || hasPendingOtherCandidate
                const isExpanded = expandedId === candidate.id

                let actionLabel = `Request ${roleLabel}`
                if (isAssigned) actionLabel = "Currently your supervisor"
                else if (hasAssignedOther) actionLabel = `Your team already has a ${roleLabel.toLowerCase()}`
                else if (isPendingSameCandidate) actionLabel = "Request already sent"
                else if (hasPendingOtherCandidate) actionLabel = `Pending request to another ${roleLabel.toLowerCase()}`

                return (
                  <motion.div
                    key={candidate.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                    transition={{ delay: Math.min(index * 0.015, 0.2), duration: 0.2 }}
                    className={cn(
                      "overflow-hidden rounded-xl border transition-colors",
                      isAssigned
                        ? "border-emerald-500/35 bg-emerald-500/[0.04]"
                        : isPendingSameCandidate
                          ? "border-amber-500/35 bg-amber-500/[0.04]"
                          : "border-border/50 bg-background hover:border-primary/25",
                    )}
                  >
                    {/* Compact row — always visible */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : candidate.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                    >
                      <Avatar className="h-9 w-9 shrink-0 border border-border/40">
                        <AvatarImage src={candidate.avatarUrl || "/placeholder.svg"} />
                        <AvatarFallback className="text-xs font-medium">{getAvatarInitial(candidate)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold leading-5">{getFullName(candidate)}</p>
                          {isAssigned && (
                            <Badge className="h-4 gap-1 bg-emerald-600 px-1.5 text-[9px] text-white">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Yours
                            </Badge>
                          )}
                          {isPendingSameCandidate && (
                            <Badge variant="secondary" className="h-4 gap-1 bg-amber-500/15 px-1.5 text-[9px] text-amber-700 dark:text-amber-400">
                              <Clock className="h-2.5 w-2.5" />
                              Pending
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          {candidate.department && (
                            <>
                              <span className="truncate">{candidate.department.replaceAll("_", " ")}</span>
                              {candidate.email && <span>·</span>}
                            </>
                          )}
                          {candidate.email && <span className="truncate">{candidate.email}</span>}
                        </div>
                      </div>

                      {/* Quick request button on row — collapsed state */}
                      {!isExpanded && !actionDisabled && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8 shrink-0 rounded-lg px-3 text-xs"
                          onClick={(e) => { e.stopPropagation(); onSelect(candidate) }}
                        >
                          <Send className="h-3 w-3" />
                          <span className="ml-1">Request</span>
                        </Button>
                      )}
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="shrink-0 text-muted-foreground"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </motion.div>
                    </button>

                    {/* Expanded panel — bio + send button */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key="expanded"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }}
                          className="overflow-hidden border-t border-border/40 bg-muted/15"
                        >
                          <div className="space-y-3 p-3 sm:p-4">
                            {candidate.bio?.trim() ? (
                              <p className="text-xs leading-5 text-muted-foreground">{candidate.bio}</p>
                            ) : (
                              <p className="text-xs italic text-muted-foreground/70">
                                No bio provided.
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              {candidate.preferredTrack && (
                                <Badge variant="outline" className="rounded-full text-[10px]">
                                  Track: {candidate.preferredTrack.replaceAll("_", " ")}
                                </Badge>
                              )}
                              {candidate.academicYear && (
                                <Badge variant="outline" className="rounded-full text-[10px]">
                                  {candidate.academicYear.replaceAll("_", " ")}
                                </Badge>
                              )}
                            </div>
                            <Button
                              variant={actionDisabled ? "outline" : "default"}
                              size="sm"
                              className="h-9 w-full rounded-lg"
                              disabled={actionDisabled}
                              onClick={(e) => { e.stopPropagation(); onSelect(candidate) }}
                            >
                              {actionDisabled ? (
                                <span>{actionLabel}</span>
                              ) : (
                                <>
                                  <Send className="h-3.5 w-3.5" />
                                  <span className="ml-1.5">Request as {roleLabel}</span>
                                </>
                              )}
                            </Button>
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

        {!isLoading && !error && canLoadMore && (
          <Button
            variant="outline"
            className="h-10 w-full rounded-xl text-sm transition-transform motion-safe:hover:-translate-y-0.5"
            onClick={onLoadMore}
          >
            Load more {roleLabel.toLowerCase()}s
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function SupervisorRequestHistoryCard({ request, reduceMotion = false }: { request: ApiSupervisorRequest; reduceMotion?: boolean }) {
  return (
    <motion.div
      {...getSupervisorHoverMotion(reduceMotion)}
      className="rounded-[20px] border border-border/60 bg-background p-4 transition-[border-color,box-shadow] duration-200 hover:border-primary/20 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-5">{request.projectName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {request.supervisorRole === "DOCTOR" ? "Doctor" : "TA"} request &bull; {request.team.name}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{getFullName(request.supervisor)}</p>
        </div>
        <SupervisorStatusBadge status={request.status} />
      </div>

      {request.technologies.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {request.technologies.map((item) => (
            <Badge key={item} variant="secondary" className="rounded-full text-xs">
              {item}
            </Badge>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Sent {new Date(request.createdAt).toLocaleDateString()}
        {request.respondedAt && ` · Responded ${new Date(request.respondedAt).toLocaleDateString()}`}
      </p>
    </motion.div>
  )
}

function SupervisorStatusBadge({ status }: { status: ApiSupervisorRequest["status"] }) {
  if (status === "ACCEPTED") {
    return (
      <Badge className="shrink-0 gap-1 bg-emerald-600 text-white">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Accepted
      </Badge>
    )
  }

  if (status === "DECLINED") {
    return (
      <Badge variant="destructive" className="shrink-0 gap-1">
        <XCircle className="h-3.5 w-3.5" />
        Declined
      </Badge>
    )
  }

  if (status === "CANCELLED") {
    return <Badge variant="secondary" className="shrink-0">Cancelled</Badge>
  }

  return (
    <Badge variant="secondary" className="shrink-0 gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400">
      <Sparkles className="h-3.5 w-3.5" />
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
