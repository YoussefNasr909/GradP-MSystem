"use client"

import type { ReactNode } from "react"
import { useDeferredValue, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Crown,
  ExternalLink,
  Hash,
  Loader2,
  Search,
  Send,
  ShieldCheck,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { teamsApi } from "@/lib/api/teams"
import type { ApiTeamSummary } from "@/lib/api/types"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import { formatTeamVisibility, getAvatarInitial, getFullName } from "@/lib/team-display"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TeamJoinRequestDialog } from "@/components/dashboard/team-join-request-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"



function getRevealMotion(reduceMotion: boolean, delay = 0) {
  if (reduceMotion) return {}

  return {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.36, delay, ease: [0.22, 1, 0.36, 1] as const },
  }
}

export default function TeamsPage() {
  const router = useRouter()
  const reduceMotion = Boolean(useReducedMotion())
  const { currentUser } = useAuthStore()
  const { data: myTeamState, refresh: refreshMyTeam } = useMyTeamState()
  const [teams, setTeams] = useState<ApiTeamSummary[]>([])
  const [search, setSearch] = useState("")
  const [availability, setAvailability] = useState<"all" | "open" | "full">("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedTeam, setSelectedTeam] = useState<ApiTeamSummary | null>(null)
  const [joinMessage, setJoinMessage] = useState("")
  const [submittingRequest, setSubmittingRequest] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [joiningByCode, setJoiningByCode] = useState(false)
  const [isJoinCodeOpen, setIsJoinCodeOpen] = useState(false)
  const deferredSearch = useDeferredValue(search)
  const isLeader = currentUser?.role === "leader"
  const isStudent = currentUser?.role === "member"
  const isSupervisorRole = currentUser?.role === "doctor" || currentUser?.role === "ta"
  const isAdmin = currentUser?.role === "admin"
  const isSupportRole = isSupervisorRole || isAdmin
  const hasTeam = Boolean(myTeamState?.team)
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState(isSupportRole ? 8 : 9)

  const loadTeams = async () => {
    const result = await teamsApi.list({
      page,
      limit: pageSize,
      search: deferredSearch || undefined,
      availability: availability === "all" ? undefined : availability,
    })
    setTeams(result.items)
    setTotalItems(result.meta.total)
    setTotalPages(result.meta.totalPages || 1)
  }

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError("")

    teamsApi
      .list({
        page,
        limit: pageSize,
        search: deferredSearch || undefined,
        availability: availability === "all" ? undefined : availability,
      })
      .then((result) => {
        if (cancelled) return
        setTeams(result.items)
        setTotalItems(result.meta.total)
        setTotalPages(result.meta.totalPages || 1)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Couldn't load teams right now.")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [availability, deferredSearch, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [availability, deferredSearch, pageSize])

  const closeRequestDialog = () => {
    setSelectedTeam(null)
    setJoinMessage("")
  }

  const requestJoin = async () => {
    if (!selectedTeam) return
    setSubmittingRequest(true)

    try {
      await teamsApi.requestToJoin(selectedTeam.id, { message: joinMessage.trim() || undefined })
      toast.success(`Join request sent to ${selectedTeam.name}.`)
      closeRequestDialog()
      await refreshMyTeam()
      await loadTeams()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that join request.")
    } finally {
      setSubmittingRequest(false)
    }
  }

  const joinWithCode = async () => {
    if (!joinCode.trim()) return
    setJoiningByCode(true)

    try {
      await teamsApi.joinByCode(joinCode.trim().toUpperCase())
      toast.success("You joined the team successfully.")
      setJoinCode("")
      setIsJoinCodeOpen(false)
      await refreshMyTeam()
      router.push("/dashboard/my-team")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't join that team.")
    } finally {
      setJoiningByCode(false)
    }
  }

  const handleSupervisionRequest = async (requestId: string, action: "accept" | "decline") => {
    if (processingRequestId) return
    setProcessingRequestId(requestId)
    
    try {
      if (action === "accept") {
        await teamsApi.acceptSupervisorRequest(requestId)
        toast.success("Supervision request accepted. You are now supervising this team.")
      } else {
        await teamsApi.declineSupervisorRequest(requestId)
        toast.success("Supervision request declined.")
      }
      
      // Force a fresh fetch of all team data
      await refreshMyTeam()
      await loadTeams()
    } catch (err: unknown) {
      console.error("[SUPERVISION_ACTION_ERROR]", err)
      toast.error(err instanceof Error ? err.message : "Action failed. Please try again.")
    } finally {
      setProcessingRequestId(null)
    }
  }

  const clearFilters = () => {
    setSearch("")
    setAvailability("all")
    setPage(1)
  }

  const pendingSupervisionRequests = (myTeamState?.supervisorRequestsReceived || []).filter(
    (req) => req.status === "PENDING",
  )

  if (isLeader) {
    return (
      <CenteredState
        icon={<Crown className="h-9 w-9 text-primary" />}
        title="Team leaders work from My Team"
        description="Leaders can't join another team. Use My Team to create a workspace, manage invitations, and review join requests."
        actionHref="/dashboard/my-team"
        actionLabel={hasTeam ? "Open My Team" : "Create My Team"}
      />
    )
  }

  if (isStudent && hasTeam && myTeamState?.team) {
    return (
      <CenteredState
        icon={<Users className="h-9 w-9 text-primary" />}
        title={`You're already in ${myTeamState.team.name}`}
        description="Students can only belong to one team at a time. Open My Team to review members, invitations, and your current workspace."
        actionHref="/dashboard/my-team"
        actionLabel="Open My Team"
      />
    )
  }

  const displayedTeams = teams
  const emptyCopy = isSupervisorRole
    ? "No assigned teams match the current filters."
    : "No teams match the current filters."
  const heroTitle = isSupervisorRole ? "My Teams" : isAdmin ? "All Teams" : "Find your team"
  const heroDescription = isStudent
    ? "Compare project ideas, stages, and open seats. Send a request or use an invite code to join."
    : isSupervisorRole
      ? "Manage and track the progress of the graduation project teams currently under your supervision."
      : isAdmin
        ? "Browse every team in the system, check availability, and open the right workspace quickly."
        : "Explore teams, check availability, and connect with the right workspace."
  const openTeamsCount = displayedTeams.filter((team) => !team.isFull).length
  const pendingTeamsCount = teams.filter((team) => team.hasPendingRequest).length
  const invitationTeamsCount = teams.filter((team) => team.hasPendingInvitation).length

  const totalStudentsSupervised = isSupportRole 
    ? teams.reduce((acc, team) => acc + team.memberCount, 0)
    : 0

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-5 xl:p-6">
      <motion.section
        {...getRevealMotion(reduceMotion)}
        className={cn(
          "space-y-6",
          !isSupervisorRole && "border-b border-border/60 pb-5"
        )}
      >
        {isSupervisorRole ? (
          <Card className="relative overflow-hidden rounded-[32px] border-border/40 bg-white dark:bg-zinc-950 shadow-sm transition-all hover:shadow-md">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 rounded-full bg-violet-500/5 blur-3xl" />
            
            <CardContent className="relative p-8 sm:p-10">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20">
                      <Users className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h1 className="text-3xl font-bold tracking-tight text-foreground/90">{heroTitle}</h1>
                      <p className="max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground/60">{heroDescription}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:w-[500px]">
                  <div className="rounded-2xl border border-border/40 bg-muted/10 p-4 transition-all hover:bg-muted/20">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Total Teams</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-foreground/90">{totalItems}</p>
                    <p className="text-[10px] font-medium text-muted-foreground/40 italic">Supervised</p>
                  </div>
                  <div className="rounded-2xl border border-border/40 bg-muted/10 p-4 transition-all hover:bg-muted/20">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Total Students</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-foreground/90">{totalStudentsSupervised}</p>
                    <p className="text-[10px] font-medium text-muted-foreground/40 italic">Supervised</p>
                  </div>
                  <div className="rounded-2xl border border-border/40 bg-muted/10 p-4 transition-all hover:bg-muted/20">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Requests</p>
                    <p className={cn(
                      "mt-1 text-2xl font-bold tracking-tight",
                      pendingSupervisionRequests.length > 0 ? "text-amber-600" : "text-foreground/90"
                    )}>{pendingSupervisionRequests.length}</p>
                    <p className="text-[10px] font-medium text-muted-foreground/40 italic">Awaiting Approval</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{heroTitle}</h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{heroDescription}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:items-center">
                {isStudent && (
                  <Button className="h-10 rounded-lg px-4 font-medium" onClick={() => setIsJoinCodeOpen(true)}>
                    <Hash className="h-4 w-4" />
                    Join with code
                  </Button>
                )}
                {!isSupportRole && (
                  <Button variant="outline" className="h-10 rounded-lg border-border/70 bg-background px-4" asChild>
                    <Link href="/dashboard/my-team">
                      My invitations
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <DirectoryStat 
                label={isSupervisorRole ? "Total Teams" : "Teams"} 
                value={String(totalItems)} 
                helper={isSupervisorRole ? "Under your supervision" : "Matching total"} 
              />
              <DirectoryStat 
                label={isSupportRole ? "Total Students" : "Open seats"} 
                value={String(isSupportRole ? totalStudentsSupervised : openTeamsCount)} 
                helper={isSupportRole ? "Students supervised" : "Teams on this page"} 
              />
              <DirectoryStat
                label={isSupportRole ? "Supervision Requests" : "Pending activity"}
                value={String(isSupportRole ? pendingSupervisionRequests.length : pendingTeamsCount + invitationTeamsCount)}
                helper={isSupportRole ? "Awaiting your approval" : "Requests or invitations"}
              />
            </div>
          </>
        )}
      </motion.section>

      <motion.section {...getRevealMotion(reduceMotion, 0.05)}>
        {isSupportRole && pendingSupervisionRequests.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
                <Send className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Supervision requests</h2>
                <p className="text-sm text-muted-foreground">Teams have invited you to supervise their graduation projects.</p>
              </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingSupervisionRequests.map((request) => (
                <Card key={request.id} className="group overflow-hidden rounded-xl border-border/70 py-0 shadow-sm transition-[border-color,box-shadow] hover:border-primary/20 hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-semibold transition-colors group-hover:text-primary">{request.projectName}</CardTitle>
                        <CardDescription className="flex items-center gap-1.5 font-medium text-foreground/70">
                          <Users className="h-3.5 w-3.5" />
                          {request.team.name}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="line-clamp-2 text-sm text-muted-foreground leading-6">
                      {request.projectDescription}
                    </p>
                    
                    <div className="flex flex-wrap gap-1.5">
                      {request.technologies.slice(0, 4).map(tech => (
                        <Badge key={tech} variant="secondary" className="bg-background/80 text-[10px] font-medium border-border/50">{tech}</Badge>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        className="flex-1 rounded-lg shadow-sm transition-transform active:scale-[0.98]" 
                        size="sm"
                        disabled={!!processingRequestId}
                        onClick={() => void handleSupervisionRequest(request.id, "accept")}
                      >
                        {processingRequestId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                        Accept
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 rounded-lg border-destructive/20 text-destructive shadow-sm transition-all hover:bg-destructive hover:text-destructive-foreground active:scale-[0.98]" 
                        size="sm"
                        disabled={!!processingRequestId}
                        onClick={() => void handleSupervisionRequest(request.id, "decline")}
                      >
                        {processingRequestId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1.5" />}
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          <div className="p-0">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
              <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search by name, idea, leader, or stack"
                className="h-10 rounded-lg border-border/70 bg-background pl-9"
              />
              </div>
              <div className="flex gap-2">
              <Select value={availability} onValueChange={(value) => { setAvailability(value as "all" | "open" | "full"); setPage(1) }}>
                <SelectTrigger className="h-10 w-[130px] rounded-lg bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-10 shrink-0 rounded-lg px-4" onClick={clearFilters}>
                Reset
              </Button>
              </div>
            </div>

            <div className="mx-4 h-px bg-border/40 sm:mx-5" />

            <div className="space-y-4 p-4 sm:p-5">
              {error && (
                <div className="rounded-lg border border-destructive/25 bg-destructive/[0.04] p-4 text-sm text-destructive">
                  {error}
                </div>
              )}
        <motion.div {...getRevealMotion(reduceMotion, 0.08)} className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {displayedTeams.length > 0
              ? `${totalItems} team${totalItems === 1 ? "" : "s"} found`
              : emptyCopy}
          </p>
          {totalPages > 1 && (
            <p className="text-xs text-muted-foreground">Page {page} / {Math.max(totalPages, 1)}</p>
          )}
        </motion.div>
        {/* Teams Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border/70 px-6 py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Loading teams and current availability.</p>
          </div>
        ) : displayedTeams.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Search className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">
                {isSupervisorRole ? "No assigned teams matched this search" : "No teams matched this search"}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Try another keyword, change the availability filter, or clear everything to start again.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" className="rounded-lg" onClick={clearFilters}>Reset filters</Button>
                {isStudent && <Button className="rounded-lg" onClick={() => setIsJoinCodeOpen(true)}>Join with code</Button>}
              </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 lg:gap-6">
              {displayedTeams.map((team, index) => {
                const fillPercent = team.maxMembers > 0 ? Math.round((team.memberCount / team.maxMembers) * 100) : 0
                const spotsLeft = Math.max(team.maxMembers - team.memberCount, 0)
                const statusCopy = team.hasPendingInvitation
                  ? "Invitation waiting in My Team"
                  : team.hasPendingRequest
                    ? "Request already sent"
                    : team.isFull
                      ? "No seats available right now"
                      : `${spotsLeft} ${spotsLeft === 1 ? "seat" : "seats"} left`

                const isSupervisorOfTeam = isSupportRole && (team.doctor?.id === currentUser?.id || team.ta?.id === currentUser?.id)
                const supervisorRole = team.doctor?.id === currentUser?.id ? "Doctor" : "TA"

                return (
                  <motion.div
                    key={team.id}
                    {...getRevealMotion(reduceMotion, 0.04 + index * 0.03)}
                    whileHover={reduceMotion ? undefined : { y: -4 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Card className={`flex h-full flex-col overflow-hidden rounded-2xl border-border/70 py-0 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-xl ${isSupervisorOfTeam ? "ring-2 ring-primary/10 bg-gradient-to-b from-background to-primary/[0.01]" : ""}`}>
                      <CardContent className="flex h-full flex-col gap-5 p-5 lg:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3 min-h-[24px]">
                          {/* Top area simplified - badges removed as requested */}
                          <div />
                          {isSupervisorOfTeam && (
                            <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm ring-1 ring-primary/20">
                              <ShieldCheck className="h-3 w-3" />
                              Supervising
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <h2 className="text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">{team.name}</h2>
                          <p className="min-h-[60px] text-sm leading-relaxed text-muted-foreground line-clamp-3 break-words">{team.bio || "No description provided for this project yet."}</p>
                        </div>

                        <div className="group/leader relative flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 p-3 transition-colors hover:bg-muted/30">
                          <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                            <AvatarImage src={team.leader.avatarUrl || "/placeholder.svg"} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold">{getAvatarInitial(team.leader)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-foreground">{getFullName(team.leader)}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Project Leader</p>
                          </div>
                          {isSupervisorOfTeam && (
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
                              <ShieldCheck className="h-4.5 w-4.5" />
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 rounded-xl border border-border/40 bg-muted/5 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team Capacity</span>
                            </div>
                            <span className={`text-xs font-bold tabular-nums ${team.isFull ? "text-muted-foreground" : fillPercent >= 75 ? "text-amber-500" : "text-emerald-500"}`}>{team.memberCount} / {team.maxMembers}</span>
                          </div>
                          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/50">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${fillPercent}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className={`h-full rounded-full ${team.isFull ? "bg-muted-foreground/40" : fillPercent >= 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-medium text-muted-foreground">
                              {spotsLeft > 0 ? `${spotsLeft} spots remaining` : "Workspace is at full capacity"}
                            </p>
                            {!isSupportRole && <p className={`text-[10px] font-bold uppercase tracking-wider ${team.hasPendingInvitation ? "text-primary" : "text-emerald-600"}`}>{statusCopy}</p>}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {team.stack.length > 0 ? (
                            <>
                              {team.stack.slice(0, 3).map((tech) => (
                                <Badge key={tech} variant="secondary" className="rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground border-border/40">{tech}</Badge>
                              ))}
                              {team.stack.length > 3 && (
                                <Badge variant="outline" className="rounded-md px-2 py-0.5 text-[10px] font-bold text-muted-foreground">+{team.stack.length - 3}</Badge>
                              )}
                            </>
                          ) : (
                            <p className="text-[10px] italic text-muted-foreground/60">No technologies listed</p>
                          )}
                        </div>

                        <div className="mt-auto space-y-3 pt-1">
                          {!isSupportRole && (team.hasPendingInvitation || team.hasPendingRequest) && (
                            <div className={`rounded-lg px-3 py-2.5 text-sm ${team.hasPendingInvitation ? "border border-primary/20 bg-primary/5 text-primary" : "border border-border/60 bg-muted/20 text-muted-foreground"}`}>
                              {team.hasPendingInvitation ? "You already have a direct invitation from this team." : "Your join request is already waiting for review."}
                            </div>
                          )}
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Button 
                              asChild 
                              variant={isSupervisorOfTeam ? "default" : "outline"} 
                              size="sm" 
                              className={`flex-1 rounded-lg ${isSupervisorOfTeam ? "shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all" : "bg-transparent"}`}
                            >
                              <Link href={`/dashboard/teams/${team.id}`}>
                                {isSupervisorOfTeam ? "Open Workspace" : "View Details"}
                                {isSupervisorOfTeam && <ExternalLink className="ml-1.5 h-3.5 w-3.5" />}
                              </Link>
                            </Button>
                            {isSupportRole && (
                            <Button asChild size="sm" variant="outline" className="flex-1 rounded-lg border-primary/20 bg-primary/5 text-primary transition-all hover:border-primary/40 hover:bg-primary/20 hover:text-primary shadow-sm">
                              <Link href={`/dashboard/sprints?teamId=${team.id}`}>
                                Sprints
                                <ClipboardList className="ml-1.5 h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          )}
                            {!isSupportRole && (
                              team.hasPendingInvitation ? (
                                <Button asChild className="flex-1 rounded-lg">
                                  <Link href="/dashboard/my-team">Review Invitation</Link>
                                </Button>
                              ) : (
                                <Button className="flex-1 rounded-lg" disabled={!team.isJoinable} onClick={() => setSelectedTeam(team)}>
                                  {team.hasPendingRequest ? "Request Sent" : team.isFull ? "Team Full" : "Request to Join"}
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalItems > 0 && (
              <div className="mt-8 flex flex-col gap-6 border-t border-border/40 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Showing <span className="text-foreground">{displayedTeams.length}</span> of <span className="text-foreground">{totalItems}</span> teams
                    </p>
                    <div className="hidden h-4 w-px bg-border/60 sm:block" />
                    <p className="text-xs text-muted-foreground">
                      Page {page} of {Math.max(totalPages, 1)}
                    </p>
                  </div>
                  
                  {isSupportRole && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Show:</span>
                      <Select 
                        value={String(pageSize)} 
                        onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}
                      >
                        <SelectTrigger className="h-8 w-[70px] rounded-lg bg-background text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4">4</SelectItem>
                          <SelectItem value="8">8</SelectItem>
                          <SelectItem value="12">12</SelectItem>
                          <SelectItem value="24">24</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg px-3 transition-all hover:bg-muted"
                      disabled={page <= 1}
                      onClick={() => { setPage((v) => v - 1); window.scrollTo({ top: 0, behavior: "smooth" }) }}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Previous
                    </Button>
                    <div className="hidden items-center gap-1 sm:flex">
                      {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                        let pageNum = i + 1
                        if (totalPages > 5 && page > 3) {
                          pageNum = page - 3 + i
                          if (pageNum > totalPages) pageNum = totalPages - (4 - i)
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={page === pageNum ? "default" : "ghost"}
                            size="sm"
                            className={`h-8 w-8 rounded-lg p-0 text-xs font-bold transition-all ${page === pageNum ? "shadow-md shadow-primary/20" : "text-muted-foreground hover:bg-muted"}`}
                            onClick={() => { setPage(pageNum); window.scrollTo({ top: 0, behavior: "smooth" }) }}
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg px-3 transition-all hover:bg-muted"
                      disabled={page >= totalPages}
                      onClick={() => { setPage((v) => v + 1); window.scrollTo({ top: 0, behavior: "smooth" }) }}
                    >
                      Next
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
            </div>
          </div>
        </div>
      </motion.section>

      <Dialog open={isJoinCodeOpen} onOpenChange={setIsJoinCodeOpen}>
        <DialogContent className="w-[94vw] max-w-md overflow-hidden rounded-xl p-0">
          <div className="p-5 sm:p-6">
            <DialogHeader className="space-y-4 text-left">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Hash className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <DialogTitle className="text-2xl">Join with invite code</DialogTitle>
                <DialogDescription className="leading-6">
                  Enter the exact code shared by a team leader. If the team still has room, you will join immediately.
                </DialogDescription>
              </div>
            </DialogHeader>
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="join-team-code">Invite Code</Label>
                <Input id="join-team-code" value={joinCode} placeholder="SMART-25A1" className="h-11 rounded-lg font-mono uppercase" onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <p className="text-sm font-medium">Helpful tip</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Invite codes are case-insensitive here, so you can paste them directly without reformatting.</p>
              </div>
              <DialogFooter className="gap-3 sm:gap-3">
                <Button variant="outline" className="h-11 rounded-lg" onClick={() => setIsJoinCodeOpen(false)}>Cancel</Button>
                <Button className="h-11 rounded-lg" disabled={!joinCode.trim() || joiningByCode} onClick={() => void joinWithCode()}>
                  {joiningByCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  <span className="ml-2">Join team</span>
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <TeamJoinRequestDialog
        team={selectedTeam}
        open={Boolean(selectedTeam)}
        onOpenChange={(open) => {
          if (!open) closeRequestDialog()
        }}
        message={joinMessage}
        onMessageChange={setJoinMessage}
        onSubmit={() => void requestJoin()}
        isSubmitting={submittingRequest}
        title="Send join request"
        description="Keep it short and helpful. Mention what you can contribute so the leader can decide quickly."
        messageId="join-request-message"
        placeholder="I can help with frontend structure, testing, and keeping the team organized..."
      />
    </div>
  )
}

function CenteredState({ icon, title, description, actionHref, actionLabel }: { icon: ReactNode; title: string; description: string; actionHref: string; actionLabel: string }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4 md:p-6">
      <Card className="w-full max-w-2xl overflow-hidden rounded-xl border-border/70 shadow-sm">
        <CardContent className="px-6 py-10 text-center sm:px-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>
          <h2 className="mt-6 text-2xl font-semibold sm:text-3xl">{title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">{description}</p>
          <Button className="mt-6 rounded-lg px-6" asChild>
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function DirectoryStat({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background px-3.5 py-2.5">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{helper}</p>
    </div>
  )
}
