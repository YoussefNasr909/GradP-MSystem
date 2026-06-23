"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { motion, useReducedMotion, AnimatePresence, type Variants } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Crown,
  FileText,
  Globe2,
  Hash,
  Inbox,
  Layers3,
  Lightbulb,
  Loader2,
  LockKeyhole,
  Mail,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCog,
  UserMinus,
  UserPlus,
  Users,
  Wand2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { ApiRequestError } from "@/lib/api/http"
import { mapApiUserToUiUser } from "@/lib/api/mappers"
import { usersApi } from "@/lib/api/users"
import { LeaderSupervisorsTab, SupervisorRequestInbox } from "./supervisors-panel"
import AdminTeamWorkspace from "./admin-team-workspace"
import { useAuthStore } from "@/lib/stores/auth-store"
import { TeamGradeCard } from "@/components/dashboard/team-grade-card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { teamsApi } from "@/lib/api/teams"
import type {
  ApiTeamDetail,
  ApiTeamInvitation,
  ApiTeamJoinRequest,
  ApiTeamMember,
  ApiTeamStage,
  ApiTeamVisibility,
} from "@/lib/api/types"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import { formatRoleLabel, formatTeamStage, formatTeamVisibility, getAvatarInitial, getFullName } from "@/lib/team-display"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"

const STAGES: ApiTeamStage[] = ["REQUIREMENTS", "DESIGN", "IMPLEMENTATION", "TESTING", "DEPLOYMENT", "MAINTENANCE"]
const STACK_SUGGESTIONS = ["Next.js", "React", "Node.js", "TypeScript", "Python", "FastAPI", "PostgreSQL", "Tailwind CSS"]
const DOMAINS = [
  "Medical / Healthcare",
  "Agricultural",
  "Educational",
  "Finance / Banking",
  "E-commerce",
  "Social / Community",
  "Environmental",
  "Transportation / Logistics",
  "Cybersecurity",
  "Entertainment / Media",
  "HR / Workforce",
  "Smart City / IoT",
  "Other",
]
const TEAM_SETUP_POINTS = [
  {
    icon: Crown,
    title: "One team space",
    description: "Set up the workspace once and manage the project from one place.",
  },
  {
    icon: UserPlus,
    title: "Invite students",
    description: "Share the invite code or send direct invitations right after setup.",
  },
  {
    icon: ShieldCheck,
    title: "Unlock team pages",
    description: "Tasks, meetings, submissions, and other team workflows stay protected until the team exists.",
  },
]

export default function MyTeamClient() {
  const { currentUser, setCurrentUser, hasHydrated } = useAuthStore()
  const isAdmin = currentUser?.role === "admin"
  const { data, isLoading, error, refresh } = useMyTeamState(hasHydrated && !isAdmin)
  const [joinCode, setJoinCode] = useState("")
  const [joinCodeError, setJoinCodeError] = useState("")
  const [joiningByCode, setJoiningByCode] = useState(false)
  const [joinSuccess, setJoinSuccess] = useState(false)
  const [switchingRole, setSwitchingRole] = useState<"" | "member" | "leader">("")
  const isLeader = currentUser?.role === "leader"
  const isStudent = currentUser?.role === "member"
  const isSupervisor = currentUser?.role === "doctor" || currentUser?.role === "ta"
  const reduceMotion = Boolean(useReducedMotion())

  const joinByCode = async () => {
    setJoinCodeError("")
    setJoiningByCode(true)
    setJoinSuccess(false)
    try {
      await teamsApi.joinByCode(joinCode.trim().toUpperCase())
      setJoinSuccess(true)
      toast.success("You joined the team successfully.")
      setJoinCode("")
      setJoinCodeError("")
      
      setTimeout(async () => {
        await refresh()
        setJoinSuccess(false)
      }, 1500)
    } catch (err: unknown) {
      setJoinCodeError(getJoinCodeErrorMessage(err))
    } finally {
      setJoiningByCode(false)
    }
  }

  const switchRole = async (nextRole: "STUDENT" | "LEADER") => {
    if (!currentUser) return

    const nextUiRole = nextRole === "LEADER" ? "leader" : "member"
    if (currentUser.role === nextUiRole) return

    setSwitchingRole(nextUiRole)
    try {
      const updatedUser = await usersApi.updateMyRole(nextRole)
      setCurrentUser(mapApiUserToUiUser(updatedUser))
      toast.success(
        nextRole === "LEADER"
          ? "You're now set up as a student leader. Create your team to get started."
          : "You're now set up as a student member. Browse teams or join with a code whenever you're ready.",
      )
      await refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't update your role right now.")
    } finally {
      setSwitchingRole("")
    }
  }

  if (!hasHydrated || isLoading) return <TeamPageSkeleton />
  if (isAdmin) return <AdminTeamWorkspace />
  if (error) return <CenteredCard title="Couldn't load your team" body={error} onRetry={refresh} />

  if (isStudent && !data?.team) {
      return (
      <StudentNoTeam
        invitations={data?.receivedInvitations ?? []}
        myJoinRequests={data?.myJoinRequests ?? []}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        joinCodeError={joinCodeError}
        clearJoinCodeError={() => setJoinCodeError("")}
        joiningByCode={joiningByCode}
        onJoinByCode={joinByCode}
        joinSuccess={joinSuccess}
        onBecomeLeader={() => switchRole("LEADER")}
        isSwitchingToLeader={switchingRole === "leader"}
        onRefresh={refresh}
      />
    )
  }

  if (isLeader && !data?.team) {
    return (
      <LeaderNoTeam
        onRefresh={refresh}
        onBecomeMember={() => switchRole("STUDENT")}
        isSwitchingToMember={switchingRole === "member"}
      />
    )
  }

  if (isSupervisor) {
    return (
      <SupervisorRequestInbox
        currentRole={currentUser?.role === "doctor" ? "doctor" : "ta"}
        requests={data?.supervisorRequestsReceived ?? []}
        supervisedTeams={data?.supervisedTeams ?? []}
        onRefresh={refresh}
      />
    )
  }

  if (!data?.team) return <CenteredCard title="No team found" body="There isn't any team data to show right now." />

  const team = data.team

  if (isStudent) {
    return <StudentTeamExperience team={team} currentUserId={currentUser?.id ?? ""} onRefresh={refresh} />
  }

  const pendingRequestsCount = data?.joinRequests?.filter((r) => r.status === "PENDING").length ?? 0
  const pendingInvitesCount = data?.sentInvitations?.filter((inv) => inv.status === "PENDING").length ?? 0

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 xl:p-8">
      <motion.div {...getRevealMotion(reduceMotion)}>
        <TeamHero team={team} isLeader={Boolean(isLeader)} onRefresh={refresh} />
      </motion.div>

      {/* Project grade snapshot — pulls live submissions + proposal */}
      <motion.div {...getRevealMotion(reduceMotion, 0.04)}>
        <TeamGradeCard teamId={team.id} />
      </motion.div>

      <LeaderTabsShell
        team={team}
        invitations={data.sentInvitations}
        joinRequests={data.joinRequests}
        supervisorRequestsSent={data.supervisorRequestsSent}
        isLeader={Boolean(isLeader)}
        pendingInvitesCount={pendingInvitesCount}
        pendingRequestsCount={pendingRequestsCount}
        reduceMotion={reduceMotion}
        onRefresh={refresh}
      />
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// LeaderTabsShell — Overview / People / Supervisors / Settings
//
// Replaces the old 6-tab layout. The new Overview is an "At a glance"
// action dashboard, not a duplicate of the hero. The "People" tab groups
// Members + Invitations + Join Requests as sub-tabs so the top-level nav
// stays at 4 entries. Tab content fades in via AnimatePresence.
// ───────────────────────────────────────────────────────────────────────────
function LeaderTabsShell({
  team,
  invitations,
  joinRequests,
  supervisorRequestsSent,
  isLeader,
  pendingInvitesCount,
  pendingRequestsCount,
  reduceMotion,
  onRefresh,
}: {
  team: ApiTeamDetail
  invitations: ApiTeamInvitation[]
  joinRequests: ApiTeamJoinRequest[]
  supervisorRequestsSent: import("@/lib/api/types").ApiSupervisorRequest[]
  isLeader: boolean
  pendingInvitesCount: number
  pendingRequestsCount: number
  reduceMotion: boolean
  onRefresh: () => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<string>("overview")
  const peoplePending = pendingInvitesCount + pendingRequestsCount

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
      <div className="overflow-x-auto pb-0.5">
        <TabsList className="inline-flex h-12 min-w-max items-center gap-0.5 rounded-2xl border border-border/60 bg-background/95 p-1.5 shadow-sm backdrop-blur-sm">
          <TabsTrigger value="overview" className={leaderTabClass}>
            <Inbox className="mr-1.5 h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="people" className={leaderTabClass}>
            <Users className="mr-1.5 h-3.5 w-3.5" />
            People
            <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] rounded-full px-1.5 text-[10px] font-bold">
              {team.memberCount}
            </Badge>
            {isLeader && peoplePending > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 min-w-[20px] rounded-full bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-400"
              >
                {peoplePending} pending
              </Badge>
            )}
          </TabsTrigger>
          {isLeader && (
            <TabsTrigger value="supervisors" className={leaderTabClass}>
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              Supervisors
            </TabsTrigger>
          )}
          {isLeader && (
            <TabsTrigger value="settings" className={leaderTabClass}>
              <UserCog className="mr-1.5 h-3.5 w-3.5" />
              Settings
            </TabsTrigger>
          )}
        </TabsList>
      </div>

      {/* Tab content with animated transitions */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }}
        >
          <TabsContent value="overview" forceMount={activeTab === "overview" ? true : undefined} className="mt-0">
            {activeTab === "overview" && (
              <LeaderOverview
                team={team}
                invitations={invitations}
                joinRequests={joinRequests}
                supervisorRequestsSent={supervisorRequestsSent}
                isLeader={isLeader}
                pendingInvitesCount={pendingInvitesCount}
                pendingRequestsCount={pendingRequestsCount}
                reduceMotion={reduceMotion}
                onNavigate={setActiveTab}
              />
            )}
          </TabsContent>

          <TabsContent value="people" forceMount={activeTab === "people" ? true : undefined} className="mt-0">
            {activeTab === "people" && (
              <PeopleTab
                team={team}
                invitations={invitations}
                joinRequests={joinRequests}
                isLeader={isLeader}
                pendingInvitesCount={pendingInvitesCount}
                pendingRequestsCount={pendingRequestsCount}
                onRefresh={onRefresh}
              />
            )}
          </TabsContent>

          {isLeader && (
            <TabsContent value="supervisors" forceMount={activeTab === "supervisors" ? true : undefined} className="mt-0">
              {activeTab === "supervisors" && (
                <LeaderSupervisorsTab team={team} requests={supervisorRequestsSent} onRefresh={onRefresh} />
              )}
            </TabsContent>
          )}

          {isLeader && (
            <TabsContent value="settings" forceMount={activeTab === "settings" ? true : undefined} className="mt-0">
              {activeTab === "settings" && <SettingsCard team={team} onRefresh={onRefresh} />}
            </TabsContent>
          )}
        </motion.div>
      </AnimatePresence>
    </Tabs>
  )
}

const leaderTabClass =
  "h-9 rounded-xl px-4 text-sm font-medium transition-all duration-200 ease-out hover:bg-muted/70 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.96] data-[state=active]:shadow-md"

// ───────────────────────────────────────────────────────────────────────────
// LeaderOverview — "At a glance" action dashboard
//
// Three sections: an Action Inbox (what needs your attention NOW), a team
// snapshot strip, and a Quick Actions row. Replaces the old Overview tab
// which was a duplicate of the TeamHero.
// ───────────────────────────────────────────────────────────────────────────
function LeaderOverview({
  team,
  invitations,
  joinRequests,
  supervisorRequestsSent,
  isLeader,
  pendingInvitesCount,
  pendingRequestsCount,
  reduceMotion,
  onNavigate,
}: {
  team: ApiTeamDetail
  invitations: ApiTeamInvitation[]
  joinRequests: ApiTeamJoinRequest[]
  supervisorRequestsSent: import("@/lib/api/types").ApiSupervisorRequest[]
  isLeader: boolean
  pendingInvitesCount: number
  pendingRequestsCount: number
  reduceMotion: boolean
  onNavigate: (tab: string) => void
}) {
  // Build the action inbox dynamically: only show cards that actually need action
  type ActionCard = {
    key: string
    label: string
    count: number | string
    detail: string
    accent: string
    icon: React.ElementType
    onClick: () => void
    isAction: boolean
  }
  const doctorAssigned = Boolean(team.doctor)
  const taAssigned = Boolean(team.ta)
  const supervisorRequestsPending = supervisorRequestsSent.filter((r) => r.status === "PENDING").length

  const actionCards: ActionCard[] = []
  if (isLeader) {
    if (pendingRequestsCount > 0) {
      actionCards.push({
        key: "join-requests",
        label: "Join requests waiting",
        count: pendingRequestsCount,
        detail: pendingRequestsCount === 1 ? "Review and approve or reject." : "Review and respond to each.",
        accent: "bg-amber-500",
        icon: UserPlus,
        onClick: () => onNavigate("people"),
        isAction: true,
      })
    }
    if (pendingInvitesCount > 0) {
      actionCards.push({
        key: "invitations",
        label: "Invitations sent",
        count: pendingInvitesCount,
        detail: pendingInvitesCount === 1 ? "Awaiting member response." : "Awaiting member responses.",
        accent: "bg-blue-500",
        icon: Send,
        onClick: () => onNavigate("people"),
        isAction: false,
      })
    }
    if (!doctorAssigned || !taAssigned) {
      const missing: string[] = []
      if (!doctorAssigned) missing.push("doctor")
      if (!taAssigned) missing.push("TA")
      actionCards.push({
        key: "supervisors-missing",
        label: `${missing.join(" + ")} not assigned`,
        count: missing.length,
        detail: supervisorRequestsPending > 0
          ? `${supervisorRequestsPending} request${supervisorRequestsPending === 1 ? "" : "s"} pending response.`
          : "Send a request from the Supervisors tab.",
        accent: "bg-violet-500",
        icon: ShieldCheck,
        onClick: () => onNavigate("supervisors"),
        isAction: true,
      })
    }
    if (team.memberCount + 1 < team.maxMembers) {
      const seats = team.maxMembers - team.memberCount - 1
      actionCards.push({
        key: "seats",
        label: `${seats} seat${seats === 1 ? "" : "s"} open`,
        count: seats,
        detail: "Invite more members from the People tab.",
        accent: "bg-cyan-500",
        icon: UserPlus,
        onClick: () => onNavigate("people"),
        isAction: false,
      })
    }
  }

  const allClear = actionCards.length === 0 || actionCards.every((c) => !c.isAction)

  return (
    <div className="space-y-5">
      {/* Action Inbox */}
      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {isLeader ? "Your action inbox" : "Team snapshot"}
          </h2>
          {allClear && isLeader && (
            <Badge variant="outline" className="ml-1 gap-1 border-green-500/30 text-green-500 text-[10px]">
              <CheckCircle2 className="h-3 w-3" /> All clear
            </Badge>
          )}
        </div>

        {actionCards.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {actionCards.map((card, i) => {
              const Icon = card.icon
              return (
                <motion.button
                  key={card.key}
                  type="button"
                  onClick={card.onClick}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.28 }}
                  whileHover={reduceMotion ? undefined : { y: -2 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                  className={`group relative flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 text-left transition-shadow hover:shadow-md ${
                    card.isAction ? "border-l-[3px] border-l-amber-500/60" : ""
                  }`}
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${card.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold tabular-nums">{card.count}</span>
                      {card.isAction && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-400">
                          action needed
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium">{card.label}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{card.detail}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </motion.button>
              )
            })}
          </div>
        ) : (
          <Card className="border-dashed border-border/60 p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-green-500" />
            <p className="text-sm font-medium">No pending actions right now.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your team is fully staffed and supervised. Keep an eye on submissions and tasks.
            </p>
          </Card>
        )}
      </motion.section>

      {/* Team snapshot — quick stats different from the hero */}
      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.3 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Team snapshot</h2>
        </div>
        <Card className="p-5 border-border/50">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SnapshotTile
              icon={Crown}
              label="Leader"
              value={getFullName(team.leader)}
              accent="text-amber-500 bg-amber-500/10"
            />
            <SnapshotTile
              icon={ShieldCheck}
              label="Doctor"
              value={team.doctor ? getFullName(team.doctor) : "Not assigned"}
              accent={team.doctor ? "text-blue-500 bg-blue-500/10" : "text-muted-foreground bg-muted/40"}
            />
            <SnapshotTile
              icon={ClipboardCheck}
              label="TA"
              value={team.ta ? getFullName(team.ta) : "Not assigned"}
              accent={team.ta ? "text-cyan-500 bg-cyan-500/10" : "text-muted-foreground bg-muted/40"}
            />
            <SnapshotTile
              icon={Layers3}
              label="SDLC stage"
              value={formatTeamStage(team.stage)}
              accent="text-violet-500 bg-violet-500/10"
            />
          </div>
        </Card>
      </motion.section>

      {/* Quick Actions */}
      {isLeader && (
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.3 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick actions</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <QuickActionButton icon={UserPlus} label="Invite member"   onClick={() => onNavigate("people")} />
            <QuickActionButton icon={ShieldCheck} label="Request supervisor" onClick={() => onNavigate("supervisors")} />
            <QuickActionButton icon={Pencil} label="Edit team"         onClick={() => onNavigate("settings")} />
            <QuickActionButton icon={FileText} label="Project proposal" href="/dashboard/proposals" />
          </div>
        </motion.section>
      )}
    </div>
  )
}

function SnapshotTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
    </div>
  )
}

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  href,
}: {
  icon: React.ElementType
  label: string
  onClick?: () => void
  href?: string
}) {
  const inner = (
    <div className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium">{label}</span>
      <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  )
  if (href) {
    return <Link href={href}>{inner}</Link>
  }
  return (
    <button type="button" onClick={onClick} className="text-left">
      {inner}
    </button>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// PeopleTab — groups Members + Invitations + Join Requests under sub-tabs.
// Reduces top-level navigation noise while keeping the same powerful panels.
// ───────────────────────────────────────────────────────────────────────────
function PeopleTab({
  team,
  invitations,
  joinRequests,
  isLeader,
  pendingInvitesCount,
  pendingRequestsCount,
  onRefresh,
}: {
  team: ApiTeamDetail
  invitations: ApiTeamInvitation[]
  joinRequests: ApiTeamJoinRequest[]
  isLeader: boolean
  pendingInvitesCount: number
  pendingRequestsCount: number
  onRefresh: () => Promise<void>
}) {
  return (
    <Tabs defaultValue="members" className="space-y-4">
      <TabsList className="inline-flex h-10 items-center gap-0.5 rounded-xl border border-border/60 bg-muted/30 p-1">
        <TabsTrigger value="members" className="h-8 rounded-lg px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
          Members
          <Badge variant="secondary" className="ml-1.5 h-4 min-w-[18px] rounded-full px-1 text-[9px] font-bold">
            {team.memberCount}
          </Badge>
        </TabsTrigger>
        {isLeader && (
          <TabsTrigger value="invitations" className="h-8 rounded-lg px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Invitations
            {pendingInvitesCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 min-w-[18px] rounded-full bg-primary/15 px-1 text-[9px] font-bold text-primary">
                {pendingInvitesCount}
              </Badge>
            )}
          </TabsTrigger>
        )}
        {isLeader && (
          <TabsTrigger value="requests" className="h-8 rounded-lg px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Join requests
            {pendingRequestsCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 min-w-[18px] rounded-full bg-amber-500/15 px-1 text-[9px] font-bold text-amber-700 dark:text-amber-400">
                {pendingRequestsCount}
              </Badge>
            )}
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="members" className="mt-0">
        <MembersCard team={team} onRefresh={onRefresh} />
      </TabsContent>
      {isLeader && (
        <TabsContent value="invitations" className="mt-0">
          <InvitationsCard team={team} invitations={invitations} onRefresh={onRefresh} />
        </TabsContent>
      )}
      {isLeader && (
        <TabsContent value="requests" className="mt-0">
          <JoinRequestsCard requests={joinRequests} onRefresh={onRefresh} />
        </TabsContent>
      )}
    </Tabs>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// TransferLeadershipCard — leader hands the role to a current member.
// Lives in the Settings tab right above the Danger Zone.
// ───────────────────────────────────────────────────────────────────────────
function TransferLeadershipCard({
  team,
  onRefresh,
}: {
  team: ApiTeamDetail
  onRefresh: () => Promise<void>
}) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const { currentUser, setCurrentUser } = useAuthStore()

  const candidates = team.members
    .map((m) => m.user)
    .filter((u) => u.id !== team.leader.id)

  const selected = candidates.find((c) => c.id === selectedMemberId) ?? null

  async function handleTransfer() {
    if (!selected) return
    setSubmitting(true)
    try {
      await teamsApi.transferLeadership(team.id, selected.id)
      toast.success(`Leadership transferred to ${getFullName(selected)}.`)
      // Locally demote the current user so the UI re-renders correctly
      if (currentUser?.id === team.leader.id) {
        setCurrentUser({ ...currentUser, role: "member" })
      }
      setConfirmOpen(false)
      setSelectedMemberId("")
      await onRefresh()
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't transfer leadership.")
      throw e
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-amber-500/25 shadow-sm">
      <CardHeader className="border-b border-amber-500/15 bg-amber-500/[0.04] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-500">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold">Transfer Leadership</CardTitle>
            <CardDescription>Hand the leader role to a current team member.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.03] p-4">
          <p className="text-sm font-medium">What happens when you transfer</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>• The selected member becomes the new team leader.</li>
            <li>• You stay on the team as a regular member.</li>
            <li>• You can no longer manage members, invitations, supervisors, or settings.</li>
            <li>• Both of you get a notification.</li>
          </ul>
        </div>

        {candidates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Invite at least one member to your team before you can hand off leadership.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Pick a new leader</Label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Choose a team member…" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={u.avatarUrl || "/placeholder.svg"} />
                          <AvatarFallback className="text-[9px]">{getAvatarInitial(u)}</AvatarFallback>
                        </Avatar>
                        {getFullName(u)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full rounded-xl bg-amber-600 hover:bg-amber-700"
              disabled={!selected || submitting}
              onClick={() => setConfirmOpen(true)}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              <span className="ml-2">Transfer leadership</span>
            </Button>
          </>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        variant="warning"
        title={selected ? `Hand leadership to ${getFullName(selected)}?` : "Transfer leadership"}
        description={
          selected
            ? `${getFullName(selected)} will become the team leader and gain full management rights. You'll stay on the team as a regular member — you can't undo this yourself, but the new leader can transfer it back.`
            : "Pick a member first."
        }
        confirmLabel="Hand off leadership"
        onConfirm={handleTransfer}
      />
    </Card>
  )
}

function getJoinCodeErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.code === "TEAM_NOT_FOUND") {
      return "We couldn't find a team with that invite code. Check the code and try again."
    }

    if (error.code === "TEAM_FULL") {
      return "That team is already full right now. Try another team or ask the leader for an update."
    }

    if (error.code === "ALREADY_IN_TEAM") {
      return "You're already in a team, so you can't join another one with a code."
    }
  }

  return error instanceof Error ? error.message : "That invite code didn't work. Please try again."
}

function getInviteErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.code === "INVITE_TARGET_LEADER") {
      return "This user is already a team leader. Ask them to switch to Student Member before inviting them."
    }

    if (error.code === "INVITE_TARGET_NOT_STUDENT") {
      return "Only Student Member accounts can be invited to a team."
    }

    if (error.code === "INVITE_TARGET_INACTIVE") {
      return "This student account is inactive. Ask them to reactivate it before sending an invitation."
    }
  }

  return error instanceof Error ? error.message : "Couldn't send that invitation."
}

function StudentTeamExperience({
  team,
  currentUserId,
  onRefresh,
}: {
  team: ApiTeamDetail
  currentUserId: string
  onRefresh: () => Promise<void>
}) {
  const reduceMotion = Boolean(useReducedMotion())
  const [busy, setBusy] = useState("")
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false)
  const [bioExpanded, setBioExpanded] = useState(false)
  const sortedMembers = [...team.members].sort((left, right) => {
    if (left.teamRole === right.teamRole) return left.user.firstName.localeCompare(right.user.firstName)
    return left.teamRole === "LEADER" ? -1 : 1
  })
  const leaderMember = sortedMembers.find((member) => member.teamRole === "LEADER")
  const leader = leaderMember?.user ?? team.leader
  const currentMember = sortedMembers.find((member) => member.user.id === currentUserId)
  const seatsRemaining = Math.max(team.maxMembers - team.memberCount, 0)
  const occupancyRatio = team.maxMembers > 0 ? team.memberCount / team.maxMembers : 0
  const openSeatsLabel = seatsRemaining === 0 ? "Full team" : `${seatsRemaining} open ${seatsRemaining === 1 ? "seat" : "seats"}`

  const leaveTeam = async () => {
    setBusy("leave")
    try {
      await teamsApi.leave(team.id)
      toast.success("You left the team.")
      setIsLeaveDialogOpen(false)
      await onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't leave the team.")
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="mx-auto w-full max-w-none space-y-6 p-4 md:p-6 xl:p-8">
      <motion.section
        {...getRevealMotion(reduceMotion)}
        className="rounded-xl border border-border/70 bg-card shadow-sm"
      >
        <div className="space-y-5 p-5 sm:p-6 md:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  My Team
                </Badge>
                <Badge variant="outline">{formatTeamStage(team.stage)}</Badge>
                <Badge variant="secondary">{formatTeamVisibility(team.visibility)}</Badge>
              </div>

              <div className="space-y-3">
                <h1 className="text-2xl font-semibold sm:text-3xl">{team.name}</h1>
                <p className={`max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base ${bioExpanded ? "" : "line-clamp-2"}`}>
                  {team.bio}
                </p>
                {team.bio && team.bio.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBioExpanded((v) => !v)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {bioExpanded ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
              <motion.div {...getActionMotion(reduceMotion)} className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="group h-11 w-full border-border/70 bg-transparent text-foreground transition-[color,border-color,background-color] duration-200 hover:border-destructive/45 hover:bg-destructive/[0.08] hover:text-destructive sm:min-w-[190px]"
                  onClick={() => setIsLeaveDialogOpen(true)}
                  disabled={busy === "leave"}
                >
                  {busy === "leave" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserMinus className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
                  )}
                  <span className="ml-2">Leave Team</span>
                </Button>
              </motion.div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {team.stack.length > 0 ? (
              team.stack.map((tech) => (
                <Badge key={tech} variant="secondary" className="rounded-full px-3 py-1">
                  {tech}
                </Badge>
              ))
            ) : (
              <Badge variant="outline" className="rounded-full px-3 py-1">
                No stack details added yet
              </Badge>
            )}
          </div>

          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            <StudentMetricCard
              reduceMotion={reduceMotion}
              delay={0.05}
              label="Members"
              value={`${team.memberCount}/${team.maxMembers}`}
              helper={openSeatsLabel}
            />
            <StudentMetricCard
              reduceMotion={reduceMotion}
              delay={0.08}
              label="Stage"
              value={formatTeamStage(team.stage)}
              helper="Current project phase"
            />
            <StudentMetricCard
              reduceMotion={reduceMotion}
              delay={0.11}
              label="Visibility"
              value={formatTeamVisibility(team.visibility)}
              helper={team.visibility === "PUBLIC" ? "Visible in team browser" : "Invite-only access"}
            />
            <StudentMetricCard
              reduceMotion={reduceMotion}
              delay={0.14}
              label="Your Role"
              value={currentMember?.teamRole === "LEADER" ? "Leader" : "Member"}
              helper="Active inside this workspace"
            />
          </div>
        </div>
      </motion.section>

      <div className="space-y-6">
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <motion.section {...getRevealMotion(reduceMotion, 0.04)} {...getPanelMotion(reduceMotion)} className="min-w-0 space-y-6">
            <Card className="group/panel border-border/70 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/15 hover:shadow-md">
              <CardHeader className="space-y-2">
                <CardTitle className="text-xl">About this team</CardTitle>
                <CardDescription>The essential project and workspace details in one place.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <motion.div
                  {...getInsetMotion(reduceMotion)}
                  className="rounded-lg border border-border/60 bg-muted/20 p-4 transition-colors duration-300 group-hover/panel:bg-muted/30"
                >
                  <p className="text-sm leading-7 text-foreground/90">{team.bio}</p>
                </motion.div>

                <motion.div
                  {...getInsetMotion(reduceMotion)}
                  className="rounded-lg border border-border/60 bg-muted/20 p-4 transition-colors duration-300 group-hover/panel:bg-muted/30"
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Capacity</span>
                    <span className="font-medium text-foreground">
                      {team.memberCount}/{team.maxMembers} members
                    </span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-primary/10">
                    <motion.div
                      className="h-full origin-left rounded-full bg-primary"
                      initial={reduceMotion ? false : { scaleX: 0 }}
                      animate={{ scaleX: occupancyRatio }}
                      transition={{
                        duration: reduceMotion ? 0 : 0.42,
                        ease: [0.22, 1, 0.36, 1],
                        delay: 0.08,
                      }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{openSeatsLabel}</p>
                </motion.div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <StudentInfoRow
                    icon={<ShieldCheck className="h-4 w-4" />}
                    label="Join Requests"
                    value={team.allowJoinRequests ? "Enabled" : "Disabled"}
                  />
                  <StudentInfoRow
                    icon={
                      team.visibility === "PUBLIC" ? (
                        <Globe2 className="h-4 w-4" />
                      ) : (
                        <LockKeyhole className="h-4 w-4" />
                      )
                    }
                    label="Visibility"
                    value={formatTeamVisibility(team.visibility)}
                  />
                  <StudentInfoRow
                    icon={<Users className="h-4 w-4" />}
                    label="Seats Remaining"
                    value={String(seatsRemaining)}
                  />
                  <StudentInfoRow
                    icon={<Layers3 className="h-4 w-4" />}
                    label="Stack"
                    value={team.stack.length > 0 ? `${team.stack.length} tools added` : "Stack not added yet"}
                  />
                </div>
              </CardContent>
            </Card>

            <motion.section {...getRevealMotion(reduceMotion, 0.1)} className="w-full">
              <Card className="border-border/70 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/15 hover:shadow-md">
                <CardHeader className="space-y-2">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-xl">Team members</CardTitle>
                      <CardDescription>Everyone currently building in this workspace.</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {team.memberCount} members
                      </Badge>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        {openSeatsLabel}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {sortedMembers.map((member, index) => (
                    <motion.div
                      key={member.id}
                      {...getRevealMotion(reduceMotion, 0.06 + index * 0.03)}
                      {...getCardHoverMotion(reduceMotion)}
                    >
                      <StudentMemberCard member={member} isCurrentUser={member.user.id === currentUserId} />
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.section>
          </motion.section>

          <motion.aside {...getRevealMotion(reduceMotion, 0.08)} {...getPanelMotion(reduceMotion)} className="space-y-6">
            <Card className="group/panel border-border/70 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/15 hover:shadow-md">
              <CardHeader className="space-y-2">
                <CardTitle className="text-xl">Team leader</CardTitle>
                <CardDescription>The main contact guiding this workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border border-border/60 transition-transform duration-300 group-hover/panel:-translate-y-0.5 group-hover/panel:scale-[1.03]">
                    <AvatarImage src={leader.avatarUrl || "/placeholder.svg"} />
                    <AvatarFallback>{getAvatarInitial(leader)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{getFullName(leader)}</p>
                    <p className="text-sm text-muted-foreground">Leading this workspace</p>
                  </div>
                </div>

                <p className="text-sm leading-6 text-muted-foreground">
                  {leader.bio?.trim() || "Your team leader hasn't added a public bio yet."}
                </p>

                <div className="space-y-3">
                  <StudentInfoRow icon={<Mail className="h-4 w-4" />} label="Contact" value={leader.email} />
                  {leader.preferredTrack && (
                    <StudentInfoRow
                      icon={<Layers3 className="h-4 w-4" />}
                      label="Preferred Track"
                      value={humanizeLabel(leader.preferredTrack)}
                    />
                  )}
                  {leader.department && (
                    <StudentInfoRow
                      icon={<Sparkles className="h-4 w-4" />}
                      label="Department"
                      value={humanizeLabel(leader.department)}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {team.doctor ? (
              <Card className="group/panel border-border/70 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/15 hover:shadow-md">
                <CardHeader className="space-y-2 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-lg">Project doctor</CardTitle>
                  </div>
                  <CardDescription>The primary supervisor for your graduation project.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border border-border/60 transition-transform duration-300 group-hover/panel:-translate-y-0.5 group-hover/panel:scale-[1.03]">
                      <AvatarImage src={team.doctor.avatarUrl || "/placeholder.svg"} />
                      <AvatarFallback>{getAvatarInitial(team.doctor)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{getFullName(team.doctor)}</p>
                      <p className="text-xs text-muted-foreground">Assigned Supervisor</p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <StudentInfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={team.doctor.email} />
                    {team.doctor.department && (
                      <StudentInfoRow
                        icon={<Sparkles className="h-3.5 w-3.5" />}
                        label="Department"
                        value={humanizeLabel(team.doctor.department)}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-2 border-dashed border-border/70 bg-muted/20">
                <CardContent className="flex flex-col items-center justify-center space-y-4 p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
                    <ShieldCheck className="h-6 w-6 opacity-40" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground/80">No Doctor Assigned</p>
                    <p className="text-xs text-muted-foreground">
                      Your team doesn&apos;t have an assigned Doctor yet.
                    </p>
                  </div>
                  {currentMember?.teamRole === "LEADER" && (
                    <Button variant="outline" size="sm" className="h-9 rounded-xl border-primary/20 bg-primary/5 text-primary hover:bg-primary/10" asChild>
                      <Link href="/dashboard/proposals">
                        <UserPlus className="mr-2 h-3.5 w-3.5" />
                        Invite Doctor
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {team.ta ? (
              <Card className="group/panel border-border/70 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/15 hover:shadow-md">
                <CardHeader className="space-y-2 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                      <Users className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-lg">Teaching assistant</CardTitle>
                  </div>
                  <CardDescription>Assisting in your project&apos;s technical guidance.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border border-border/60 transition-transform duration-300 group-hover/panel:-translate-y-0.5 group-hover/panel:scale-[1.03]">
                      <AvatarImage src={team.ta.avatarUrl || "/placeholder.svg"} />
                      <AvatarFallback>{getAvatarInitial(team.ta)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{getFullName(team.ta)}</p>
                      <p className="text-xs text-muted-foreground">Assigned TA</p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <StudentInfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={team.ta.email} />
                    {team.ta.department && (
                      <StudentInfoRow
                        icon={<Sparkles className="h-3.5 w-3.5" />}
                        label="Department"
                        value={humanizeLabel(team.ta.department)}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-2 border-dashed border-border/70 bg-muted/20">
                <CardContent className="flex flex-col items-center justify-center space-y-4 p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
                    <Users className="h-6 w-6 opacity-40" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground/80">No TA Assigned</p>
                    <p className="text-xs text-muted-foreground">
                      Your team doesn&apos;t have an assigned TA yet.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.aside>
        </div>
      </div>

      <LeaveTeamDialog
        open={isLeaveDialogOpen}
        onOpenChange={setIsLeaveDialogOpen}
        teamName={team.name}
        isSubmitting={busy === "leave"}
        onConfirm={leaveTeam}
      />
    </div>
  )
}

function TeamHero({ team, isLeader, onRefresh }: { team: ApiTeamDetail; isLeader: boolean; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState("")
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [bioExpanded, setBioExpanded] = useState(false)

  const copyCode = async () => {
    if (!team.inviteCode || copied) return
    await navigator.clipboard.writeText(team.inviteCode)
    setCopied(true)
    toast.success("Invite code copied.")
    setTimeout(() => setCopied(false), 2000)
  }

  const leaveTeam = async () => {
    setBusy("leave")
    try {
      await teamsApi.leave(team.id)
      toast.success("You left the team.")
      setIsLeaveDialogOpen(false)
      await onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't leave the team.")
    } finally {
      setBusy("")
    }
  }

  return (
    <Card className="overflow-hidden rounded-xl border-border/70 py-0 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/15 hover:shadow-md">
      <div className="bg-card">
        <div className="flex flex-col gap-5 p-5 sm:p-6 md:p-7 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: team info */}
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                <Crown className="mr-1.5 h-3 w-3" />
                My Team
              </Badge>
              <Badge variant="outline">{formatTeamStage(team.stage)}</Badge>
              <Badge variant="secondary">{formatTeamVisibility(team.visibility)}</Badge>
              <Badge variant="outline" className="text-muted-foreground">
                {team.memberCount}/{team.maxMembers} members
              </Badge>
            </div>
            <div>
              <h1 className="text-2xl font-semibold sm:text-3xl">{team.name}</h1>
              <p className={`mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base ${bioExpanded ? "" : "line-clamp-2"}`}>
                {team.bio}
              </p>
              {team.bio && team.bio.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBioExpanded((v) => !v)}
                  className="mt-1 text-xs font-semibold text-primary hover:underline"
                >
                  {bioExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
            {team.stack.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {team.stack.map((tech) => (
                  <Badge key={tech} variant="secondary" className="rounded-full text-xs">
                    {tech}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Right: leader card + actions */}
          <div className="flex shrink-0 flex-col gap-3 lg:items-end">
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-4 py-3">
              <Avatar className="h-10 w-10 border border-border/60">
                <AvatarImage src={team.leader.avatarUrl || "/placeholder.svg"} />
                <AvatarFallback className="text-sm font-semibold">{getAvatarInitial(team.leader)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{getFullName(team.leader)}</p>
                <p className="text-xs text-muted-foreground">Team Leader</p>
              </div>
            </div>

            {isLeader && team.inviteCode && (
              <div className="flex items-center gap-2">
                {/* Invite code pill */}
                <div className={`relative flex h-10 items-center overflow-hidden rounded-lg border px-3 font-mono text-sm transition-all duration-300 ${
                  copied
                    ? "border-green-500/40 bg-green-500/[0.06] text-green-700 dark:text-green-400"
                    : "border-border/60 bg-background/70"
                }`}>
                  <AnimatePresence mode="wait" initial={false}>
                    {copied ? (
                      <motion.span
                        key="copied-label"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] as const }}
                        className="font-sans text-xs font-semibold"
                      >
                        Copied!
                      </motion.span>
                    ) : (
                      <motion.span
                        key="invite-code"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] as const }}
                      >
                        {team.inviteCode}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                {/* Copy button */}
                <motion.div
                  whileTap={{ scale: 0.96 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }}
                >
                  <Button
                    variant="outline"
                    size="icon"
                    className={`h-10 w-10 rounded-lg transition-all duration-300 ${
                      copied
                        ? "border-green-500/40 bg-green-500/10 text-green-600 hover:bg-green-500/15 dark:text-green-400"
                        : "border-border/60 hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                    }`}
                    onClick={() => void copyCode()}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {copied ? (
                        <motion.span
                          key="check-icon"
                          initial={{ scale: 0.3, opacity: 0, rotate: -45 }}
                          animate={{ scale: 1, opacity: 1, rotate: 0 }}
                          exit={{ scale: 0.3, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }}
                          className="flex items-center justify-center"
                        >
                          <Check className="h-4 w-4" />
                        </motion.span>
                      ) : (
                        <motion.span
                          key="copy-icon"
                          initial={{ scale: 0.3, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.3, opacity: 0 }}
                          transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] as const }}
                          className="flex items-center justify-center"
                        >
                          <Copy className="h-4 w-4" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </motion.div>
              </div>
            )}

            {!isLeader && team.permissions.canLeave && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg border-border/60 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                onClick={() => setIsLeaveDialogOpen(true)}
                disabled={busy === "leave"}
              >
                {busy === "leave" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                <span className="ml-2">Leave Team</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <LeaveTeamDialog
        open={isLeaveDialogOpen}
        onOpenChange={setIsLeaveDialogOpen}
        teamName={team.name}
        isSubmitting={busy === "leave"}
        onConfirm={leaveTeam}
      />
    </Card>
  )
}

function MembersCard({ team, onRefresh }: { team: ApiTeamDetail; onRefresh: () => Promise<void> }) {
  const [removingId, setRemovingId] = useState<string>("")
  const [memberToRemove, setMemberToRemove] = useState<ApiTeamMember | null>(null)
  const reduceMotion = Boolean(useReducedMotion())

  const removeMember = async () => {
    if (!memberToRemove) return

    const memberId = memberToRemove.user.id
    const memberName = getFullName(memberToRemove.user)

    setRemovingId(memberId)
    try {
      await teamsApi.removeMember(team.id, memberId)
      toast.success(`${memberName} was removed from the team.`)
      setMemberToRemove(null)
      try {
        await onRefresh()
      } catch {
        toast.error("Member removed, but we couldn't refresh the latest team state.")
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that member.")
    } finally {
      setRemovingId("")
    }
  }

  return (
    <>
      <Card className="overflow-hidden border-none bg-muted/30 shadow-none ring-1 ring-border/50">
        <CardHeader className="border-b bg-background/50 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">Team Members</CardTitle>
              <CardDescription>See who is in the team, review their bios, and manage membership safely.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6 sm:p-8">
          {team.members.map((member, index) => {
            const name = getFullName(member.user)
            const isLeader = member.teamRole === "LEADER"
            const isRemoving = removingId === member.user.id

            return (
              <motion.div
                key={member.id}
                {...getRevealMotion(reduceMotion, 0.02 + index * 0.03)}
                className="rounded-[24px] border border-border/60 bg-background p-5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-md"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <Avatar className="h-12 w-12 border border-border/60">
                      <AvatarImage src={member.user.avatarUrl || "/placeholder.svg"} />
                      <AvatarFallback>{getAvatarInitial(member.user)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-lg font-semibold tracking-tight">{name}</p>
                        <Badge variant={isLeader ? "default" : "secondary"}>
                          {isLeader ? "Leader" : formatRoleLabel(member.user.role)}
                        </Badge>
                      </div>
                      <p className="mt-1 break-words text-sm text-muted-foreground">{member.user.email}</p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {member.user.bio?.trim() || "No bio added yet."}
                      </p>
                    </div>
                  </div>

                  {team.permissions.canRemoveMembers && !isLeader && (
                    <Button
                      className="w-full rounded-xl md:w-auto"
                      variant="outline"
                      disabled={isRemoving}
                      onClick={() => setMemberToRemove(member)}
                    >
                      {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                      <span className="ml-2">Remove</span>
                    </Button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </CardContent>
      </Card>

      <RemoveMemberDialog
        open={Boolean(memberToRemove)}
        onOpenChange={(open) => {
          if (!open && !removingId) setMemberToRemove(null)
        }}
        member={memberToRemove}
        teamName={team.name}
        isSubmitting={Boolean(removingId)}
        onConfirm={removeMember}
      />
    </>
  )
}

function RemoveMemberDialog({
  open,
  onOpenChange,
  member,
  teamName,
  isSubmitting,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: ApiTeamMember | null
  teamName: string
  isSubmitting: boolean
  onConfirm: () => Promise<void>
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md overflow-hidden rounded-[28px] border-border/70 p-0">
        <div className="p-5 sm:p-6">
          <AlertDialogHeader className="space-y-4 text-left">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <UserMinus className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <AlertDialogTitle className="text-2xl tracking-tight">Remove team member?</AlertDialogTitle>
              <AlertDialogDescription className="leading-6">
                {member ? (
                  <>
                    Remove <span className="font-medium text-foreground">{getFullName(member.user)}</span> from <span className="font-medium text-foreground">{teamName}</span>.
                  </>
                ) : null}
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>

          {member && (
            <>
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <Avatar className="h-12 w-12 border border-border/60">
                  <AvatarImage src={member.user.avatarUrl || "/placeholder.svg"} />
                  <AvatarFallback>{getAvatarInitial(member.user)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{getFullName(member.user)}</p>
                  <p className="break-words text-sm text-muted-foreground">{member.user.email}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-destructive/15 bg-destructive/[0.03] p-4">
                <p className="text-sm font-medium text-foreground">What happens next</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  This member will lose access to the team workspace and its protected pages. You can invite them again later if needed.
                </p>
              </div>
            </>
          )}

          <AlertDialogFooter className="mt-6 gap-3 sm:gap-3">
            <Button type="button" variant="outline" className="h-11" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
              Keep Member
            </Button>
            <Button
              type="button"
              className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void onConfirm()}
              disabled={!member || isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
              <span className="ml-2">Remove Member</span>
            </Button>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
function InvitationsCard({ team, invitations, onRefresh }: { team: ApiTeamDetail; invitations: ApiTeamInvitation[]; onRefresh: () => Promise<void> }) {
  const [email, setEmail] = useState<string>("")
  const [academicId, setAcademicId] = useState<string>("")
  const [busy, setBusy] = useState<"email" | "academicId" | "">("")
  const [success, setSuccess] = useState<"email" | "academicId" | "">("")
  const [error, setError] = useState<{ mode: "email" | "academicId" | ""; message: string }>({ mode: "", message: "" })
  const [busyInvitationId, setBusyInvitationId] = useState("")
  const [invitationToCancel, setInvitationToCancel] = useState<ApiTeamInvitation | null>(null)

  const invite = async (mode: "email" | "academicId") => {
    if (busy) return
    setBusy(mode)
    setError({ mode: "", message: "" })
    try {
      if (mode === "email") {
        const trimmedEmail = email.trim().toLowerCase()
        if (!trimmedEmail.includes("@")) {
          setError({ mode: "email", message: "Please enter a valid email address." })
          setBusy("")
          return
        }
        await teamsApi.invite(team.id, { email: trimmedEmail })
      } else {
        const trimmedId = academicId.trim().toUpperCase()
        if (!trimmedId) {
          setError({ mode: "academicId", message: "Please enter an academic ID." })
          setBusy("")
          return
        }
        await teamsApi.invite(team.id, { academicId: trimmedId })
      }

      setSuccess(mode)
      toast.success("Invitation sent successfully.")
      setEmail("")
      setAcademicId("")

      setTimeout(async () => {
        await onRefresh()
        setSuccess("")
      }, 1500)
    } catch (err: unknown) {
      const message = getInviteErrorMessage(err)
      setError({ mode, message })
      toast.error(message)
    } finally {
      setBusy("")
    }
  }

  const cancelInvitation = async () => {
    if (!invitationToCancel || busyInvitationId) return

    setBusyInvitationId(invitationToCancel.id)
    try {
      await teamsApi.cancelInvitation(invitationToCancel.id)
      toast.success("Invitation canceled.")
      setInvitationToCancel(null)
      try {
        await onRefresh()
      } catch {
        toast.error("Invitation canceled, but we couldn't refresh the latest team state.")
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel that invitation.")
    } finally {
      setBusyInvitationId("")
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <Card className="border-none bg-muted/30 shadow-none ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="border-b bg-background/50 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">Send Invitations</CardTitle>
              <CardDescription>Invite registered GPMS students to your team.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 p-8">
          <div className="space-y-4">
            <Label className="text-sm font-bold tracking-wide">Invite by Email</Label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                <Input 
                  value={email} 
                  className={`h-12 pl-11 rounded-xl bg-background border-border/60 transition-all focus-visible:ring-2 focus-visible:ring-primary/20 ${
                    error.mode === "email" ? "border-destructive ring-1 ring-destructive" : ""
                  }`} 
                  placeholder="student@university.edu" 
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error.mode === "email") setError({ mode: "", message: "" })
                  }} 
                />
              </div>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button 
                  className={`h-12 w-full sm:w-auto sm:min-w-[140px] rounded-xl font-bold shadow-lg transition-all ${
                    success === "email" ? "bg-green-500 hover:bg-green-600 shadow-green-200" : "shadow-primary/10"
                  }`} 
                  disabled={!email.trim() || !!busy || success === "email"} 
                  onClick={() => void invite("email")}
                >
                  <AnimatePresence mode="wait">
                    {busy === "email" ? (
                      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </motion.div>
                    ) : success === "email" ? (
                      <motion.div key="success" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        <span>Sent</span>
                      </motion.div>
                    ) : (
                      <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>Send Invite</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
            </div>
            <AnimatePresence>
              {error.mode === "email" && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs font-medium text-destructive mt-1 flex items-center gap-1.5 px-1"
                >
                  <AlertCircle className="h-3 w-3" />
                  {error.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-muted/30 px-2 text-muted-foreground font-bold tracking-widest">OR</span></div>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-bold tracking-wide">Invite by Academic ID</Label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <ShieldCheck className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                <Input 
                  value={academicId} 
                  className={`h-12 pl-11 rounded-xl bg-background border-border/60 transition-all focus-visible:ring-2 focus-visible:ring-primary/20 font-mono tracking-wider ${
                    error.mode === "academicId" ? "border-destructive ring-1 ring-destructive" : ""
                  }`} 
                  placeholder="CS2021014" 
                  onChange={(e) => {
                    setAcademicId(e.target.value.toUpperCase())
                    if (error.mode === "academicId") setError({ mode: "", message: "" })
                  }} 
                />
              </div>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button 
                  className={`h-12 w-full sm:w-auto sm:min-w-[140px] rounded-xl font-bold shadow-lg transition-all ${
                    success === "academicId" ? "bg-green-500 hover:bg-green-600 shadow-green-200" : "shadow-primary/10"
                  }`} 
                  disabled={!academicId.trim() || !!busy || success === "academicId"} 
                  onClick={() => void invite("academicId")}
                >
                  <AnimatePresence mode="wait">
                    {busy === "academicId" ? (
                      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </motion.div>
                    ) : success === "academicId" ? (
                      <motion.div key="success" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        <span>Sent</span>
                      </motion.div>
                    ) : (
                      <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        <span>Invite ID</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
            </div>
            <AnimatePresence>
              {error.mode === "academicId" && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs font-medium text-destructive mt-1 flex items-center gap-1.5 px-1"
                >
                  <AlertCircle className="h-3 w-3" />
                  {error.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none bg-muted/30 shadow-none ring-1 ring-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold">Pending Invitations</CardTitle>
          <CardDescription>Students who haven&apos;t joined yet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-2xl bg-background flex items-center justify-center text-muted-foreground/30 ring-1 ring-border/50 mb-4">
                <Mail className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground max-w-[180px]">No pending invitations at the moment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((item) => (
                <motion.div 
                  key={item.id} 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }}
                  className="group relative flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-background p-4 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                    {getAvatarInitial(item.invitedUser)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{getFullName(item.invitedUser)}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.invitedUser.email}</p>
                  </div>
                  <div className="ml-auto flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                    <Badge variant="secondary" className="bg-slate-100/80 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 text-[10px] font-bold">
                      PENDING
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl border-border/60 bg-background text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900/60 dark:hover:text-slate-100"
                      disabled={busyInvitationId === item.id}
                      onClick={() => setInvitationToCancel(item)}
                    >
                      {busyInvitationId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      <span className="ml-1.5">Cancel</span>
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(invitationToCancel)}
        onOpenChange={(open) => {
          if (!open && !busyInvitationId) setInvitationToCancel(null)
        }}
      >
        <AlertDialogContent className="max-w-md overflow-hidden rounded-xl border-border/70 p-0">
          <div className="p-5 sm:p-6">
            <AlertDialogHeader className="space-y-4 text-left">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <AlertDialogTitle className="text-2xl tracking-tight">Cancel invitation?</AlertDialogTitle>
                <AlertDialogDescription className="leading-6">
                  {invitationToCancel ? (
                    <>
                      Remove the pending invitation for <span className="font-medium text-foreground">{getFullName(invitationToCancel.invitedUser)}</span> from <span className="font-medium text-foreground">{team.name}</span>.
                    </>
                  ) : null}
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-950/40">
              <p className="text-sm font-medium text-foreground">What happens next</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {invitationToCancel ? (
                  <>
                    This removes the invitation from <span className="font-medium text-foreground">{getFullName(invitationToCancel.invitedUser)}</span>&apos;s inbox. You can invite them again later if needed.
                  </>
                ) : null}
              </p>
            </div>

            <AlertDialogFooter className="mt-6 gap-3 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={busyInvitationId === invitationToCancel?.id}
                onClick={() => {
                  if (!busyInvitationId) setInvitationToCancel(null)
                }}
              >
                Keep Invitation
              </Button>
              <Button
                type="button"
                className="h-11 bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-950 dark:hover:bg-slate-100"
                onClick={() => void cancelInvitation()}
                disabled={!invitationToCancel || busyInvitationId === invitationToCancel?.id}
              >
                {busyInvitationId === invitationToCancel?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span className="ml-2">Cancel Invitation</span>
              </Button>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function JoinRequestsCard({ requests, onRefresh }: { requests: ApiTeamJoinRequest[]; onRefresh: () => Promise<void> }) {
  const [busyId, setBusyId] = useState<string>("")
  const [requestDecision, setRequestDecision] = useState<{
    id: string
    action: "approve" | "reject"
    requesterName: string
    requesterEmail: string
    message: string | null
  } | null>(null)

  const openRequestDecision = (request: ApiTeamJoinRequest, action: "approve" | "reject") => {
    setRequestDecision({
      id: request.id,
      action,
      requesterName: getFullName(request.user),
      requesterEmail: request.user.email,
      message: request.message,
    })
  }

  const decide = async (id: string, action: "approve" | "reject") => {
    setBusyId(id)
    try {
      if (action === "approve") await teamsApi.approveJoinRequest(id)
      else await teamsApi.rejectJoinRequest(id)
      toast.success(action === "approve" ? "Join request approved." : "Join request rejected.")
      setRequestDecision(null)
      await onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't update that request.")
    } finally {
      setBusyId("")
    }
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl tracking-tight">Join Requests</CardTitle>
            <CardDescription>Students asking to join your team. Review each request carefully.</CardDescription>
          </div>
          {requests.length > 0 && (
            <Badge variant="secondary" className="shrink-0">{requests.length} pending</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-border/60 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
              <Users className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium">No pending requests</p>
            <p className="mt-1 text-xs text-muted-foreground">When students request to join your team, they&apos;ll appear here for review.</p>
          </div>
        ) : (
          requests.map((request) => (
            <div key={request.id} className="overflow-hidden rounded-[20px] border border-border/60 bg-background shadow-sm">
              <div className="h-0.5 w-full bg-gradient-to-r from-primary/40 to-primary/10" />
              <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/60 bg-primary/10 text-sm font-bold text-primary">
                    {getAvatarInitial(request.user)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-5">{getFullName(request.user)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{request.user.email}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
                    Pending
                  </Badge>
                </div>
                {request.message && (
                  <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1">Message</p>
                    <p className="text-sm leading-5 text-foreground/80">{request.message}</p>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 rounded-xl"
                    disabled={busyId === request.id}
                    onClick={() => openRequestDecision(request, "approve")}
                  >
                    {busyId === request.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    <span className="ml-1.5">Approve</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl border-border/60"
                    disabled={busyId === request.id}
                    onClick={() => openRequestDecision(request, "reject")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <AlertDialog
        open={Boolean(requestDecision)}
        onOpenChange={(open) => {
          if (!open && !busyId) setRequestDecision(null)
        }}
      >
        <AlertDialogContent className="max-w-md overflow-hidden rounded-xl border-border/70 p-0">
          <div className="p-5 sm:p-6">
            <AlertDialogHeader className="space-y-4 text-left">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${requestDecision?.action === "approve" ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-200"}`}>
                {requestDecision?.action === "approve" ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
              </div>
              <div className="space-y-2">
                <AlertDialogTitle className="text-2xl tracking-tight">{requestDecision?.action === "approve" ? "Approve join request?" : "Reject join request?"}</AlertDialogTitle>
                <AlertDialogDescription className="leading-6">
                  {requestDecision?.action === "approve"
                    ? `${requestDecision?.requesterName} will be added to your team immediately after approval.`
                    : `${requestDecision?.requesterName} will be removed from the pending requests list. They can still send another request later.`}
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>

            <div className="mt-6 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="font-medium">{requestDecision?.requesterName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{requestDecision?.requesterEmail}</p>
              {requestDecision?.message ? (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{requestDecision.message}</p>
              ) : (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">No message was included with this request.</p>
              )}
            </div>

            <AlertDialogFooter className="mt-6 gap-3 sm:gap-3">
              <AlertDialogCancel className="h-11" disabled={busyId === requestDecision?.id} onClick={() => { if (!busyId) setRequestDecision(null) }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className={`h-11 ${requestDecision?.action === "approve" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-950 dark:hover:bg-slate-100"}`}
                onClick={(event) => {
                  event.preventDefault()
                  if (requestDecision) void decide(requestDecision.id, requestDecision.action)
                }}
                disabled={!requestDecision || busyId === requestDecision?.id}
              >
                {busyId === requestDecision?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : requestDecision?.action === "approve" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <span className="ml-2">{requestDecision?.action === "approve" ? "Approve Request" : "Reject Request"}</span>
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function SettingsCard({ team, onRefresh }: { team: ApiTeamDetail; onRefresh: () => Promise<void> }) {
  const [form, setForm] = useState<{
    name: string
    bio: string
    maxMembers: string
    visibility: ApiTeamVisibility
    allowJoinRequests: string
    stage: ApiTeamStage
    stack: string
  }>({
    name: team.name,
    bio: team.bio,
    maxMembers: String(team.maxMembers),
    visibility: team.visibility,
    allowJoinRequests: String(team.allowJoinRequests),
    stage: team.stage,
    stack: team.stack.join(", "),
  })
  const [busy, setBusy] = useState("")

  const save = async () => {
    setBusy("save")
    try {
      await teamsApi.update(team.id, {
        name: form.name,
        bio: form.bio,
        maxMembers: Number(form.maxMembers),
        visibility: form.visibility as ApiTeamVisibility,
        allowJoinRequests: form.allowJoinRequests === "true",
        stage: form.stage as ApiTeamStage,
        stack: form.stack.split(",").map((item) => item.trim()).filter(Boolean),
      })
      toast.success("Team settings updated.")
      await onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the settings.")
    } finally {
      setBusy("")
    }
  }

  const [deleteOpen, setDeleteOpen] = useState(false)

  const performTeamDelete = async () => {
    setBusy("delete")
    try {
      await teamsApi.delete(team.id)
      toast.success("Team deleted.")
      await onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the team.")
      throw err
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Main settings */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Team Settings</CardTitle>
              <CardDescription>Update the live team information and configuration.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Team Name">
              <Input
                value={form.name}
                className="h-11 rounded-xl bg-background border-border/60"
                onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              />
            </Field>
            <Field label="Maximum Members">
              <Select
                value={form.maxMembers}
                onValueChange={(value) => setForm((c) => ({ ...c, maxMembers: value }))}
              >
                <SelectTrigger className="h-11 rounded-xl bg-background border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["3", "4", "5", "6"].map((value) => (
                    <SelectItem key={value} value={value}>{value} members</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Team Bio">
            <Textarea
              rows={4}
              value={form.bio}
              className="rounded-xl bg-background border-border/60 resize-none"
              onChange={(e) => setForm((c) => ({ ...c, bio: e.target.value }))}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Visibility">
              <Select
                value={form.visibility}
                onValueChange={(value) => setForm((c) => ({ ...c, visibility: value as ApiTeamVisibility }))}
              >
                <SelectTrigger className="h-11 rounded-xl bg-background border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Public</SelectItem>
                  <SelectItem value="PRIVATE">Private</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Join Requests">
              <Select
                value={form.allowJoinRequests}
                onValueChange={(value) => setForm((c) => ({ ...c, allowJoinRequests: value }))}
              >
                <SelectTrigger className="h-11 rounded-xl bg-background border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Enabled</SelectItem>
                  <SelectItem value="false">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Stage">
              <Select
                value={form.stage}
                onValueChange={(value) => setForm((c) => ({ ...c, stage: value as ApiTeamStage }))}
              >
                <SelectTrigger className="h-11 rounded-xl bg-background border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>{formatTeamStage(stage)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Tech Stack">
            <Input
              value={form.stack}
              className="h-11 rounded-xl bg-background border-border/60 font-mono"
              placeholder="React, Node.js, PostgreSQL, Tailwind CSS…"
              onChange={(e) => setForm((c) => ({ ...c, stack: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground mt-1">Separate technologies with commas.</p>
          </Field>

          <div className="flex justify-end border-t border-border/50 pt-4">
            <Button
              className="h-11 rounded-xl px-6"
              onClick={() => void save()}
              disabled={!!busy}
            >
              {busy === "save" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Crown className="h-4 w-4" />
              )}
              <span className="ml-2">Save Changes</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transfer leadership */}
      <TransferLeadershipCard team={team} onRefresh={onRefresh} />

      {/* Danger zone */}
      <Card className="border-destructive/25 shadow-sm">
        <CardHeader className="border-b border-destructive/15 bg-destructive/[0.03] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible team actions.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="rounded-2xl border border-destructive/15 bg-destructive/[0.03] p-4">
            <p className="text-sm font-medium">Delete this team</p>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              Permanently removes the team, all members, invitations, and join requests. This cannot be undone.
            </p>
          </div>
          <Button
            className="w-full rounded-xl"
            variant="destructive"
            disabled={!!busy}
            onClick={() => setDeleteOpen(true)}
          >
            {busy === "delete" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span className="ml-2">Delete Team</span>
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${team.name}?`}
        description="The entire team — including all members, invitations, join requests, submissions, tasks, and chat history — will be permanently removed. This can't be undone."
        confirmLabel="Delete team"
        onConfirm={performTeamDelete}
      />
    </div>
  )
}

function StudentNoTeam({
  invitations,
  myJoinRequests,
  joinCode,
  setJoinCode,
  joinCodeError,
  clearJoinCodeError,
  joiningByCode,
  joinSuccess,
  onJoinByCode,
  onBecomeLeader,
  isSwitchingToLeader,
  onRefresh,
}: {
  invitations: ApiTeamInvitation[]
  myJoinRequests: ApiTeamJoinRequest[]
  joinCode: string
  setJoinCode: (value: string) => void
  joinCodeError: string
  clearJoinCodeError: () => void
  joiningByCode: boolean
  joinSuccess: boolean
  onJoinByCode: () => Promise<void>
  onBecomeLeader: () => Promise<void>
  isSwitchingToLeader: boolean
  onRefresh: () => Promise<void>
}) {
  const [busyInvitationId, setBusyInvitationId] = useState("")
  const [busyRequestId, setBusyRequestId] = useState("")
  const [cancelRequestId, setCancelRequestId] = useState<string | null>(null)
  const [invitationDecision, setInvitationDecision] = useState<{
    id: string
    teamName: string
    inviterName: string
    action: "accept" | "decline"
  } | null>(null)

  const openInvitationDecision = (invitation: ApiTeamInvitation, action: "accept" | "decline") => {
    setInvitationDecision({
      id: invitation.id,
      teamName: invitation.team.name,
      inviterName: getFullName(invitation.invitedBy),
      action,
    })
  }

  const respond = async (id: string, action: "accept" | "decline") => {
    setBusyInvitationId(id)
    try {
      if (action === "accept") await teamsApi.acceptInvitation(id)
      else await teamsApi.declineInvitation(id)
      toast.success(action === "accept" ? "Invitation accepted." : "Invitation declined.")
      setInvitationDecision(null)
      try {
        await onRefresh()
      } catch {
        toast.error("Invitation updated, but we couldn't refresh the latest team state.")
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't update that invitation.")
    } finally {
      setBusyInvitationId("")
    }
  }

  const handleCancelJoinRequest = async () => {
    if (!cancelRequestId) return
    setBusyRequestId(cancelRequestId)
    try {
      await teamsApi.cancelJoinRequest(cancelRequestId)
      toast.success("Join request cancelled.")
      setCancelRequestId(null)
      await onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel that request.")
    } finally {
      setBusyRequestId("")
    }
  }

  const reduceMotion = Boolean(useReducedMotion())

  const stagger = (i: number) => ({
    initial: reduceMotion ? {} : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: reduceMotion ? {} : { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-10">
      <Card className="overflow-hidden rounded-[40px] border-blue-500/15 bg-gradient-to-br from-blue-600/[0.03] via-background to-background shadow-2xl shadow-blue-500/5">
        <div className="flex flex-col gap-8 p-6 md:p-10 lg:p-12">
          {/* Header */}
          <motion.section {...stagger(0)} className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Find your team</h1>
            <p className="max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Join an existing workspace or launch your own project. Start collaborating with your peers in minutes.
            </p>
          </motion.section>

          <div className="grid gap-8 lg:grid-cols-12">
            {/* Left Column: Requests & Invitations */}
            <div className="lg:col-span-7 space-y-8">
              {/* Grouped Status Cards */}
              <motion.div {...stagger(1)} className="grid gap-4 sm:grid-cols-1">
                {/* My join requests - Moved to top as requested */}
                <AnimatePresence mode="popLayout">
                  {myJoinRequests.length > 0 && (
                    <motion.div
                      key="join-requests-section"
                      initial={reduceMotion ? {} : { opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">My join requests</h2>
                        </div>
                        <Badge variant="secondary" className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                          {myJoinRequests.length} pending
                        </Badge>
                      </div>

                      <div className="grid gap-4">
                        {myJoinRequests.map((item) => (
                          <div
                            key={item.id}
                            className="group relative flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:border-amber-500/30 hover:shadow-md"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1 space-y-1">
                                <h3 className="truncate text-lg font-bold tracking-tight">{item.team.name}</h3>
                                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.team.bio}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-lg px-2 text-[11px] font-bold text-muted-foreground hover:bg-destructive/5 hover:text-destructive"
                                disabled={busyRequestId === item.id}
                                onClick={() => setCancelRequestId(item.id)}
                              >
                                {busyRequestId === item.id ? (
                                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                ) : (
                                  <X className="mr-1.5 h-3 w-3" />
                                )}
                                Cancel
                              </Button>
                            </div>
                            <div className="flex items-center gap-3 border-t border-border/40 pt-4">
                              <Badge variant="secondary" className="bg-muted/50 text-[10px] font-bold uppercase tracking-wider">{formatTeamVisibility(item.team.visibility)}</Badge>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 italic">Waiting for leader approval</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* My invitations */}
                <motion.div
                  key="invitations-section"
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Mail className="h-4 w-4" />
                      </div>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">My invitations</h2>
                    </div>
                    {invitations.length > 0 && (
                      <Badge className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {invitations.length} new
                      </Badge>
                    )}
                  </div>

                  <AnimatePresence mode="wait">
                    {invitations.length === 0 ? (
                      <motion.div
                        key="empty-invites"
                        initial={reduceMotion ? {} : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 py-10 text-center"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/40 text-muted-foreground/40">
                          <Mail className="h-5 w-5" />
                        </div>
                        <p className="mt-3 text-sm font-bold">No pending invitations</p>
                        <p className="mt-1 max-w-[200px] text-xs leading-relaxed text-muted-foreground">Ask a leader for an invite or join using a team code.</p>
                      </motion.div>
                    ) : (
                      <div className="grid gap-4">
                        {invitations.map((item) => (
                          <div
                            key={item.id}
                            className="group relative flex flex-col gap-5 rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="bg-muted/50 text-[10px] font-bold uppercase tracking-wider">{formatTeamVisibility(item.team.visibility)}</Badge>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{item.team.memberCount}/{item.team.maxMembers} members</span>
                              </div>
                              <h3 className="text-xl font-bold tracking-tight">{item.team.name}</h3>
                              <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{item.team.bio}</p>
                            </div>

                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 border-2 border-background shadow-sm">
                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">{getAvatarInitial(item.invitedBy)}</AvatarFallback>
                              </Avatar>
                              <p className="text-xs text-muted-foreground">
                                Invited by <span className="font-bold text-foreground">{getFullName(item.invitedBy)}</span>
                              </p>
                            </div>

                            <div className="flex gap-3">
                              <Button
                                className="h-10 flex-1 rounded-xl font-bold shadow-sm shadow-primary/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                disabled={busyInvitationId === item.id}
                                onClick={() => openInvitationDecision(item, "accept")}
                              >
                                {busyInvitationId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                Accept
                              </Button>
                              <Button
                                variant="outline"
                                className="h-10 flex-1 rounded-xl border-border/60 font-bold transition-all hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30"
                                disabled={busyInvitationId === item.id}
                                onClick={() => openInvitationDecision(item, "decline")}
                              >
                                Decline
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            </div>

            {/* Right Column: Join Paths */}
            <div className="lg:col-span-5 space-y-8">
              <motion.div {...stagger(2)} className="grid gap-6">
                {/* Join with code - More prominent */}
                <div className="flex flex-col gap-6 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Hash className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold tracking-tight">Join with code</h2>
                      <p className="text-xs text-muted-foreground">Enter a unique invite code to join instantly.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Input
                      value={joinCode}
                      placeholder="TEAM-A1B2"
                      className={`h-12 w-full rounded-xl border-border/60 bg-muted/30 px-4 font-mono text-base uppercase tracking-wider transition-all focus-visible:bg-background focus-visible:ring-primary/20 ${
                        joinCodeError ? "border-destructive ring-1 ring-destructive/25" : ""
                      }`}
                      onChange={(e) => {
                        if (joinCodeError) clearJoinCodeError()
                        setJoinCode(e.target.value.toUpperCase())
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && joinCode.trim() && !joiningByCode && !joinSuccess) void onJoinByCode()
                      }}
                    />
                    <Button
                      className={`h-11 w-full rounded-xl font-bold shadow-sm transition-all duration-300 ${
                        joinSuccess ? "bg-emerald-600 hover:bg-emerald-600" : "hover:shadow-lg hover:shadow-primary/10"
                      }`}
                      disabled={!joinCode.trim() || joiningByCode || joinSuccess}
                      onClick={() => void onJoinByCode()}
                    >
                      <AnimatePresence mode="wait">
                        {joiningByCode ? (
                          <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Joining...
                          </motion.span>
                        ) : joinSuccess ? (
                          <motion.span key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" /> Joined
                          </motion.span>
                        ) : (
                          <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                            Join Team
                            <ArrowRight className="h-4 w-4" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Button>
                    {joinCodeError && (
                      <p className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" /> {joinCodeError}
                      </p>
                    )}
                  </div>
                </div>

                {/* Browse directory */}
                <Link href="/dashboard/teams" className="group block outline-none">
                  <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                      <Search className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold tracking-tight group-hover:text-primary transition-colors">Browse teams</h3>
                      <p className="text-xs text-muted-foreground">Find teams looking for members.</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>

                {/* Become a leader */}
                <div className="flex flex-col gap-5 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-background to-background p-6 shadow-sm">
                  <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                      <Crown className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold tracking-tight">Create a team</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Want to lead your own project? Switch to a <span className="font-bold text-foreground">Leader</span> role to build a team from scratch and recruit your own teammates.
                  </p>
                  <Button
                    variant="outline"
                    className="h-10 w-full rounded-xl border-amber-500/30 bg-amber-500/5 font-bold text-amber-700 shadow-sm transition-all hover:bg-amber-500 hover:text-white dark:text-amber-400 dark:hover:bg-amber-600"
                    disabled={isSwitchingToLeader}
                    onClick={() => void onBecomeLeader()}
                  >
                    {isSwitchingToLeader ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="mr-2 h-4 w-4" />}
                    Become a Leader
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </Card>

      {/* Join request cancellation dialog */}
      <AlertDialog
        open={Boolean(cancelRequestId)}
        onOpenChange={(open) => { if (!open && !busyRequestId) setCancelRequestId(null) }}
      >
        <AlertDialogContent className="max-w-md overflow-hidden rounded-[28px] border-border/70 p-0">
          <div className="p-5 sm:p-6">
            <AlertDialogHeader className="space-y-4 text-left">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <X className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <AlertDialogTitle className="text-2xl tracking-tight">Cancel join request?</AlertDialogTitle>
                <AlertDialogDescription className="leading-6">
                  Are you sure you want to cancel your request to join <span className="font-medium text-foreground">{myJoinRequests.find(r => r.id === cancelRequestId)?.team.name}</span>?
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>

            <div className="mt-6 rounded-2xl border border-destructive/15 bg-destructive/[0.03] p-4">
              <p className="text-sm font-medium text-foreground">What happens next</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This will remove your pending request. You can request to join this team again later if there are still open seats.
              </p>
            </div>

            <AlertDialogFooter className="mt-6 gap-3 sm:gap-3">
              <Button type="button" variant="outline" className="h-11" disabled={Boolean(busyRequestId)} onClick={() => setCancelRequestId(null)}>
                Keep Request
              </Button>
              <Button
                type="button"
                className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void handleCancelJoinRequest()}
                disabled={!cancelRequestId || Boolean(busyRequestId)}
              >
                {busyRequestId ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                <span className="ml-2">Cancel Request</span>
              </Button>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invitation decision dialog */}
      <AlertDialog
        open={Boolean(invitationDecision)}
        onOpenChange={(open) => { if (!open && !busyInvitationId) setInvitationDecision(null) }}
      >
        <AlertDialogContent className="max-w-md overflow-hidden rounded-[28px] border-border/70 p-0">
          <div className="p-5 sm:p-6">
            <AlertDialogHeader className="space-y-4 text-left">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                invitationDecision?.action === "accept"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}>
                {invitationDecision?.action === "accept"
                  ? <CheckCircle2 className="h-6 w-6" />
                  : <AlertCircle className="h-6 w-6" />}
              </div>
              <div className="space-y-2">
                <AlertDialogTitle className="text-xl">
                  {invitationDecision?.action === "accept" ? "Accept invitation?" : "Decline invitation?"}
                </AlertDialogTitle>
                <AlertDialogDescription className="leading-6">
                  {invitationDecision?.action === "accept"
                    ? <>Join <span className="font-medium text-foreground">{invitationDecision?.teamName}</span> and start collaborating right away.</>
                    : <>Remove the invitation to <span className="font-medium text-foreground">{invitationDecision?.teamName}</span> from your inbox.</>}
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>

            <div className={`mt-5 rounded-lg border p-4 ${
              invitationDecision?.action === "accept"
                ? "border-primary/15 bg-primary/[0.03]"
                : "border-border/60 bg-muted/20"
            }`}>
              <p className="text-sm font-medium">
                {invitationDecision?.action === "accept" ? "What happens next" : "Good to know"}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                {invitationDecision?.action === "accept"
                  ? `You'll join ${invitationDecision?.teamName} immediately. The invitation from ${invitationDecision?.inviterName} will be marked as accepted.`
                  : `You'll remove this invitation. You can still be invited again or join via a code if things change.`}
              </p>
            </div>

            <AlertDialogFooter className="mt-5 gap-3">
              <AlertDialogCancel
                className="h-11 rounded-lg"
                disabled={busyInvitationId === invitationDecision?.id}
                onClick={() => { if (!busyInvitationId) setInvitationDecision(null) }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className={`h-11 rounded-lg ${
                  invitationDecision?.action === "accept"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-foreground hover:bg-muted/80"
                }`}
                onClick={(e) => {
                  e.preventDefault()
                  if (invitationDecision) void respond(invitationDecision.id, invitationDecision.action)
                }}
                disabled={!invitationDecision || busyInvitationId === invitationDecision?.id}
              >
                {busyInvitationId === invitationDecision?.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : invitationDecision?.action === "accept"
                    ? <CheckCircle2 className="h-4 w-4" />
                    : <AlertCircle className="h-4 w-4" />}
                <span className="ml-2">
                  {invitationDecision?.action === "accept" ? "Accept" : "Decline"}
                </span>
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function LeaderNoTeam({
  onRefresh,
  onBecomeMember,
  isSwitchingToMember,
}: {
  onRefresh: () => Promise<void>
  onBecomeMember: () => Promise<void>
  isSwitchingToMember: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<{
    name: string
    bio: string
    stack: string
    maxMembers: string
    visibility: ApiTeamVisibility
    allowJoinRequests: boolean
    stage: ApiTeamStage
  }>({
    name: "",
    bio: "",
    stack: "",
    maxMembers: "5",
    visibility: "PUBLIC",
    allowJoinRequests: true,
    stage: "REQUIREMENTS",
  })

  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 4

  const stackItems = form.stack
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  const bioLength = form.bio.trim().length
  const reduceMotion = Boolean(useReducedMotion())

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return form.name.trim().length >= 3
      case 2:
        return bioLength >= 10
      case 3:
        return true // Stack is optional
      case 4:
        return true // Visibility always has a selection
      default:
        return false
    }
  }

  const nextStep = () => {
    if (isStepValid() && currentStep < totalSteps) {
      setCurrentStep((s) => s + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1)
    }
  }

  const slide = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as const },
        }

  const stepVariants: Variants = {
    initial: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
    }),
    animate: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
      },
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -50 : 50,
      opacity: 0,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
      },
    }),
  }

  const [direction, setDirection] = useState(0)

  type WizardPhase = "question" | "ai-form" | "ai-results" | "wizard"
  const [phase, setPhase] = useState<WizardPhase>("question")
  const [aiForm, setAiForm] = useState<{
    teamSize: string
    stack: string
    domains: string[]
    description: string
  }>({
    teamSize: "5",
    stack: "",
    domains: [],
    description: "",
  })
  const [aiIdeas, setAiIdeas] = useState<Array<{ title: string; description: string }>>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [expandedIdea, setExpandedIdea] = useState<number | null>(null)

  const aiStackItems = aiForm.stack.split(",").map((s) => s.trim()).filter(Boolean)

  const toggleDomain = (domain: string) => {
    setAiForm((s) => ({
      ...s,
      domains: s.domains.includes(domain) ? [] : [domain],
    }))
  }

  const addAiStack = (value: string) => {
    const current = new Set(aiStackItems.map((item) => item.toLowerCase()))
    if (current.has(value.toLowerCase())) return
    const newStack = aiStackItems.length > 0 ? [...aiStackItems, value].join(", ") : value
    setAiForm((s) => ({ ...s, stack: newStack }))
  }

  const generateIdeas = async () => {
    setAiLoading(true)
    try {
      const res = await fetch("/api/generate-project-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamSize: aiForm.teamSize,
          technologies: aiForm.stack,
          domains: aiForm.domains,
          description: aiForm.description,
        }),
      })
      const data = await res.json() as { ideas?: Array<{ title: string; description: string }>; error?: string }
      if (!res.ok) {
        console.error("[generate-project-ideas] Error response:", data)
        throw new Error("Failed to generate ideas")
      }
      console.log("[generate-project-ideas] Success:", data)
      setAiIdeas(data.ideas ?? [])
      setPhase("ai-results")
    } catch (err) {
      console.error("[generate-project-ideas] Caught:", err)
      toast.error("Failed to generate ideas. Please try again.")
    } finally {
      setAiLoading(false)
    }
  }

  const selectIdea = (idea: { title: string; description: string }) => {
    setForm((s) => ({
      ...s,
      name: idea.title,
      bio: idea.description.slice(0, 2000),
      maxMembers: aiForm.teamSize,
      stack: aiForm.stack,
    }))
    setPhase("wizard")
  }

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setDirection(1)
      nextStep()
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setDirection(-1)
      prevStep()
    }
  }

  const addSuggestedStack = (value: string) => {
    const current = new Set(stackItems.map((item) => item.toLowerCase()))
    if (current.has(value.toLowerCase())) return
    const newStack = stackItems.length > 0 ? [...stackItems, value].join(", ") : value
    setForm((state) => ({
      ...state,
      stack: newStack,
    }))
  }

  const createTeam = async () => {
    const canCreate = form.name.trim().length >= 3 && bioLength >= 10
    if (!canCreate) {
      toast.error("Add a team name and a short bio before creating the team.")
      return
    }

    setBusy(true)
    try {
      await teamsApi.create({
        name: form.name.trim(),
        bio: form.bio.trim(),
        stack: stackItems,
        maxMembers: Number(form.maxMembers),
        visibility: form.visibility,
        allowJoinRequests: form.visibility === "PUBLIC" ? form.allowJoinRequests : false,
        stage: form.stage,
      })
      toast.success("Team created successfully.")
      await onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the team.")
    } finally {
      setBusy(false)
    }
  }

  const steps = [
    { id: 1, title: "Identity", icon: Crown },
    { id: 2, title: "Mission", icon: Sparkles },
    { id: 3, title: "Stack", icon: Layers3 },
    { id: 4, title: "Access", icon: LockKeyhole },
  ]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <motion.div {...slide(0)} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Set up your team</h1>
          <p className="mt-1 text-muted-foreground">Launch your project workspace in minutes.</p>
        </div>

        <Button
          variant="outline"
          className="h-10 shrink-0 rounded-xl border-border/60 bg-background/50 px-4 text-sm font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
          onClick={() => void onBecomeMember()}
          disabled={isSwitchingToMember}
        >
          {isSwitchingToMember ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
          Join a team instead
        </Button>
      </motion.div>

      {/* Phase: Question */}
      {phase === "question" && (
        <motion.div {...slide(0.1)} className="flex flex-col items-center gap-8 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lightbulb className="h-8 w-8" />
          </div>
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold">Do you have a project idea?</h2>
            <p className="text-muted-foreground">Start with your own idea, or let AI help you discover one.</p>
          </div>
          <div className="grid w-full max-w-lg grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPhase("wizard")}
              className="group flex flex-col items-center gap-4 rounded-2xl border-2 border-border/60 bg-transparent p-7 text-center transition-all hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-all group-hover:bg-primary/10 group-hover:text-primary">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold">Yes, I have an idea</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">I&apos;ll set up my team and fill in the details myself.</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPhase("ai-form")}
              className="group flex flex-col items-center gap-4 rounded-2xl border-2 border-primary/30 bg-primary/[0.03] p-7 text-center transition-all hover:border-primary/60 hover:bg-primary/5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all group-hover:bg-primary/20">
                <Wand2 className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold">No, help me with AI</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Get 3 tailored project ideas based on my team&apos;s profile.</p>
              </div>
            </button>
          </div>
        </motion.div>
      )}

      {/* Phase: AI Form */}
      {phase === "ai-form" && (
        <motion.div {...slide(0.1)} className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
          {/* Form Header */}
          <div className="border-b border-border/60 bg-muted/20 px-8 py-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wand2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Tell us about your team</h2>
              <p className="text-xs text-muted-foreground">We&apos;ll use this to suggest the best project ideas for you.</p>
            </div>
          </div>

          <div className="p-8 space-y-6">
            {/* Row 1: Team Size + Domain */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-[3fr_1fr]">
              {/* Team Size */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Team Size</Label>
                <div className="grid grid-cols-4 gap-2">
                  {["3", "4", "5", "6"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAiForm((s) => ({ ...s, teamSize: v }))}
                      className={`flex flex-col items-center justify-center rounded-xl border-2 py-3 transition-all ${
                        aiForm.teamSize === v
                          ? "border-primary bg-primary/5 text-primary shadow-sm shadow-primary/10"
                          : "border-border/60 text-muted-foreground hover:border-border hover:bg-muted/30"
                      }`}
                    >
                      <span className="text-base font-bold">{v}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">Members</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">Includes you as the team leader.</p>
              </div>

              {/* Domain of Interest */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Domain of interest</Label>
                <Select
                  value={aiForm.domains[0] ?? ""}
                  onValueChange={(val) => setAiForm((s) => ({ ...s, domains: val ? [val] : [] }))}
                >
                  <SelectTrigger className="h-12 rounded-xl border-border/60 bg-muted/30 focus:ring-primary/20">
                    <SelectValue placeholder="Select a domain..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DOMAINS.map((domain) => (
                      <SelectItem key={domain} value={domain}>
                        {domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Helps AI tailor ideas to your field.</p>
              </div>
            </div>

            {/* Row 2: Technologies */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">
                Technologies you know{" "}
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                value={aiForm.stack}
                placeholder="e.g. React, Python, Node.js..."
                className="h-12 rounded-xl border-border/60 bg-muted/30 focus-visible:ring-primary/20"
                onChange={(e) => setAiForm((s) => ({ ...s, stack: e.target.value }))}
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {STACK_SUGGESTIONS.map((s) => {
                  const isAdded = aiStackItems.some((item) => item.toLowerCase() === s.toLowerCase())
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addAiStack(s)}
                      disabled={isAdded}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                        isAdded
                          ? "border-primary/40 bg-primary/10 text-primary cursor-default"
                          : "border-border/60 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                      }`}
                    >
                      {isAdded && <Check className="h-3 w-3" />}
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Row 3: Free text */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">
                What&apos;s on your mind?{" "}
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                rows={3}
                value={aiForm.description}
                placeholder="e.g. We want to build something impactful for our local community, ideally using mobile..."
                className="resize-none rounded-xl border-border/60 bg-muted/30 focus-visible:ring-primary/20"
                onChange={(e) => setAiForm((s) => ({ ...s, description: e.target.value }))}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border/60 bg-muted/10 px-8 py-5 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setPhase("question")}
              className="h-10 rounded-xl border-border/60 px-5 text-sm font-semibold"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={() => void generateIdeas()}
              disabled={aiLoading}
              className="h-10 rounded-xl px-8 text-sm font-bold shadow-sm shadow-primary/20"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Ideas
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Phase: AI Results */}
      {phase === "ai-results" && (
        <motion.div {...slide(0.1)} className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Here are 3 ideas for your team</h2>
            <p className="text-sm text-muted-foreground">Pick the one that resonates most — you can edit the details after.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {aiIdeas.map((idea, idx) => (
              <div
                key={idx}
                className="flex flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all cursor-pointer hover:border-primary/30 hover:shadow-md"
                onClick={() => setExpandedIdea(idx)}
              >
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  {idx + 1}
                </div>
                <h3 className="mb-2 text-base font-bold leading-snug">{idea.title}</h3>
                <p className="flex-1 line-clamp-4 text-xs leading-relaxed text-muted-foreground">{idea.description}</p>
                <Button
                  className="mt-4 h-9 w-full rounded-xl text-xs font-bold"
                  onClick={(e) => { e.stopPropagation(); selectIdea(idea) }}
                >
                  Use this idea
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            {/* Idea detail modal */}
            <AnimatePresence>
              {expandedIdea !== null && aiIdeas[expandedIdea] && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                  onClick={() => setExpandedIdea(null)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    className="relative w-full max-w-lg rounded-2xl border border-border/60 bg-card p-8 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedIdea(null)}
                      className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                      {expandedIdea + 1}
                    </div>
                    <h3 className="mb-4 text-xl font-bold leading-snug">{aiIdeas[expandedIdea].title}</h3>
                    <p className="max-h-60 overflow-y-auto text-sm leading-relaxed text-muted-foreground">
                      {aiIdeas[expandedIdea].description}
                    </p>
                    <Button
                      className="mt-6 h-10 w-full rounded-xl font-bold"
                      onClick={() => selectIdea(aiIdeas[expandedIdea]!)}
                    >
                      Use this idea
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setPhase("ai-form")}
              className="h-10 rounded-xl border-border/60 px-5 text-sm font-semibold"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              variant="outline"
              onClick={() => void generateIdeas()}
              disabled={aiLoading}
              className="h-10 rounded-xl border-border/60 px-5 text-sm font-semibold"
            >
              {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Regenerate
            </Button>
          </div>
        </motion.div>
      )}

      {/* Phase: Wizard (Progress + Steps) */}
      {phase === "wizard" && (<>
      {/* Progress Indicator */}
      <motion.div {...slide(0.05)} className="relative px-4 sm:px-16">
        <div className="flex justify-between">
          {steps.map((step) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = currentStep > step.id
            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : isCompleted
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                </div>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {step.title}
                </span>
              </div>
            )
          })}
        </div>
        {/* Progress line */}
        <div className="absolute left-0 top-5 -z-0 h-[2px] w-full bg-border px-16 sm:px-28">
          <motion.div
            className="h-full bg-primary transition-all duration-500"
            initial={false}
            animate={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
          />
        </div>
      </motion.div>

      {/* Main Card */}
      <motion.div
        {...slide(0.1)}
        className="relative min-h-[440px] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 hover:shadow-md"
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 p-6 md:p-10 lg:p-12">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full"
              >
                {currentStep === 1 && (
                  <div className="space-y-8">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-bold">Team Identity</h2>
                      <p className="text-muted-foreground">Choose a name that reflects your project&apos;s goals.</p>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label htmlFor="team-name" className="text-sm font-semibold">
                          Team Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="team-name"
                          value={form.name}
                          autoFocus
                          className="h-14 rounded-xl border-border/60 bg-muted/30 text-lg focus-visible:ring-primary/20"
                          placeholder="e.g. EcoTrack Solutions"
                          onChange={(e) => setForm((state) => ({ ...state, name: e.target.value }))}
                        />
                        {form.name.trim().length > 0 && form.name.trim().length < 3 && (
                          <p className="flex items-center gap-1.5 text-xs text-destructive">
                            <AlertCircle className="h-3 w-3" /> Name must be at least 3 characters.
                          </p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Team Size</Label>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                          {["3", "4", "5", "6"].map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setForm((state) => ({ ...state, maxMembers: v }))}
                              className={`flex flex-col items-center justify-center rounded-xl border-2 py-4 transition-all ${
                                form.maxMembers === v
                                  ? "border-primary bg-primary/5 text-primary shadow-sm shadow-primary/10"
                                  : "border-border/60 bg-transparent text-muted-foreground hover:border-border hover:bg-muted/30"
                              }`}
                            >
                              <span className="text-xl font-bold">{v}</span>
                              <span className="text-[10px] font-bold uppercase tracking-wider">Members</span>
                            </button>
                          ))}
                        </div>
                        <p className="text-[11px] font-medium text-muted-foreground">Includes you as the team leader.</p>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-8">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-bold">Project Mission</h2>
                      <p className="text-muted-foreground">Describe what you are building and who you need.</p>
                    </div>

                    <div className="space-y-4">
                      <Label htmlFor="team-bio" className="text-sm font-semibold">
                        Brief Description <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="team-bio"
                        rows={10}
                        maxLength={2000}
                        value={form.bio}
                        autoFocus
                        className="resize-none rounded-xl border-border/60 bg-muted/30 p-5 text-base leading-relaxed focus-visible:ring-primary/20"
                        placeholder="We're building a platform that helps local farmers track soil moisture using IoT sensors..."
                        onChange={(e) => setForm((state) => ({ ...state, bio: e.target.value }))}
                      />
                      <div className="flex items-center justify-between px-1">
                        <span
                          className={`text-xs font-medium ${
                            bioLength > 0 && bioLength < 10 ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {bioLength < 10 ? "Min 10 characters required" : "Looks good!"}
                        </span>
                        <span className="text-xs font-bold tabular-nums text-muted-foreground">
                          {bioLength}/2000
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-8">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-bold">Tech Stack</h2>
                      <p className="text-muted-foreground">List the tools and technologies you plan to use.</p>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">
                          Stack <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          value={form.stack}
                          className="h-14 rounded-xl border-border/60 bg-muted/30 text-lg focus-visible:ring-primary/20"
                          placeholder="React, Node.js, PostgreSQL..."
                          onChange={(e) => setForm((state) => ({ ...state, stack: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Suggested Technologies:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {STACK_SUGGESTIONS.map((s) => {
                            const isAdded = stackItems.some((item) => item.toLowerCase() === s.toLowerCase())
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => addSuggestedStack(s)}
                                disabled={isAdded}
                                className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium transition-all ${
                                  isAdded
                                    ? "border-primary/30 bg-primary/10 text-primary cursor-default"
                                    : "border-border/60 bg-transparent text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                                }`}
                              >
                                {isAdded && <Check className="h-4 w-4" />}
                                {s}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-8">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-bold">Visibility & Access</h2>
                      <p className="text-muted-foreground">Decide how students can discover and join your team.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setForm((state) => ({ ...state, visibility: "PUBLIC", allowJoinRequests: true }))}
                        className={`group relative flex flex-col gap-5 rounded-2xl border-2 p-6 text-left transition-all ${
                          form.visibility === "PUBLIC"
                            ? "border-primary bg-primary/[0.03]"
                            : "border-border/60 hover:border-border hover:bg-muted/30"
                        }`}
                      >
                        <div
                          className={`flex h-14 w-14 items-center justify-center rounded-xl transition-all ${
                            form.visibility === "PUBLIC"
                              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                              : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                          }`}
                        >
                          <Globe2 className="h-7 w-7" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">Public Team</p>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            Visible in the directory. Students can find you and request to join.
                          </p>
                        </div>
                        {form.visibility === "PUBLIC" && (
                          <div className="absolute right-5 top-5 rounded-full bg-primary p-1.5 text-primary-foreground shadow-sm">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setForm((state) => ({ ...state, visibility: "PRIVATE", allowJoinRequests: false }))}
                        className={`group relative flex flex-col gap-5 rounded-2xl border-2 p-6 text-left transition-all ${
                          form.visibility === "PRIVATE"
                            ? "border-primary bg-primary/[0.03]"
                            : "border-border/60 hover:border-border hover:bg-muted/30"
                        }`}
                      >
                        <div
                          className={`flex h-14 w-14 items-center justify-center rounded-xl transition-all ${
                            form.visibility === "PRIVATE"
                              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                              : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                          }`}
                        >
                          <LockKeyhole className="h-7 w-7" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">Private Team</p>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            Hidden from the directory. Only people you invite can join.
                          </p>
                        </div>
                        {form.visibility === "PRIVATE" && (
                          <div className="absolute right-5 top-5 rounded-full bg-primary p-1.5 text-primary-foreground shadow-sm">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </button>
                    </div>

                    <AnimatePresence>
                      {form.visibility === "PUBLIC" && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="rounded-xl border border-border/60 bg-muted/20 px-6 py-5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <p className="text-base font-bold">Open for requests</p>
                              <p className="text-sm text-muted-foreground">Allow students to apply to your team.</p>
                            </div>
                            <Switch
                              checked={form.allowJoinRequests}
                              onCheckedChange={(checked) =>
                                setForm((state) => ({ ...state, allowJoinRequests: checked }))
                              }
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer Controls */}
          <div className="border-t border-border/60 bg-muted/10 p-4 md:px-8 md:py-6">
            <div className="flex items-center justify-between gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 1 || busy}
                className="h-11 rounded-xl border-border/60 bg-background/50 px-5 text-sm font-semibold transition-all hover:bg-muted hover:-translate-x-0.5 disabled:opacity-0"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!isStepValid()}
                  className="h-11 rounded-xl px-8 text-sm font-bold shadow-sm shadow-primary/20 transition-all hover:translate-x-0.5 active:scale-[0.98]"
                >
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={!isStepValid() || busy}
                  onClick={() => void createTeam()}
                  className="h-11 rounded-xl px-8 text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Crown className="mr-2 h-4 w-4" />
                      Create Team
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Helper message */}
      <motion.p
        {...slide(0.15)}
        className="text-center text-xs text-muted-foreground"
      >
        {currentStep === 1 && "Start by giving your project a memorable name."}
        {currentStep === 2 && "A clear mission helps you find the right teammates."}
        {currentStep === 3 && "You can always update your stack later."}
        {currentStep === 4 && "Finalize your team's accessibility settings."}
      </motion.p>
      </>)}
    </div>
  )
}


function LeaderFormStep({
  step,
  title,
  sub,
  optional,
}: {
  step: number
  title: string
  sub: string
  optional?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <span className="text-sm font-bold">{step}</span>
      </div>
      <div>
        <p className="font-semibold text-sm leading-none">
          {title}
          {optional && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}

function MetricTile({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  const reduceMotion = Boolean(useReducedMotion())

  return (
    <motion.div
      {...getRevealMotion(reduceMotion)}
      {...getCardHoverMotion(reduceMotion)}
      className="rounded-[24px] border border-border/60 bg-background/88 p-4 shadow-sm transition-shadow duration-300 hover:shadow-md"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-3 break-words text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{helper}</p>
    </motion.div>
  )
}

function InfoLine({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return <ChecklistLine icon={icon} title={title} description={description} />
}

function TeamPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 xl:p-8">
      <div className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>Loading your team…</span>
      </div>

      {/* Hero card */}
      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-background shadow-sm">
        <div className="space-y-5 p-5 sm:p-6 md:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-6 w-20 rounded-full" />
                ))}
              </div>
              <Skeleton className="h-10 w-72 sm:w-96" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full max-w-2xl" />
                <Skeleton className="h-4 w-3/4 max-w-lg" />
              </div>
            </div>
            <Skeleton className="h-11 w-44 shrink-0 rounded-xl" />
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-6 w-20 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-[24px] border border-border/60 p-4 space-y-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-border/70 bg-background p-6 shadow-sm space-y-4">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3.5 w-64" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <div className="grid sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-border/70 bg-background p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-3.5 w-56" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-border/60 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3.5 w-40" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-3xl border border-border/70 bg-background p-6 shadow-sm space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-3.5 w-52" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3.5 w-32" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-border/70 bg-background p-6 shadow-sm space-y-4">
            <Skeleton className="h-6 w-36" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            </div>
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

function CenteredCard({ title, body, onRetry }: { title: string; body: string; onRetry?: () => Promise<void> | void }) {
  const reduceMotion = Boolean(useReducedMotion())
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <motion.div
        initial={reduceMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
        className="w-full max-w-sm text-center"
      >
        <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${
          onRetry ? "bg-destructive/10" : "bg-muted/60"
        }`}>
          {onRetry
            ? <AlertCircle className="h-7 w-7 text-destructive" />
            : <Users className="h-7 w-7 text-muted-foreground" />
          }
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{body}</p>
        {onRetry && (
          <Button className="mt-8 h-11 rounded-xl px-8" onClick={() => void onRetry()}>
            Try Again
          </Button>
        )}
      </motion.div>
    </div>
  )
}

function StudentMetricCard({
  reduceMotion,
  delay,
  label,
  value,
  helper,
}: {
  reduceMotion: boolean
  delay: number
  label: string
  value: string
  helper: string
}) {
  return (
    <motion.div
      {...getRevealMotion(reduceMotion, delay)}
      {...getCardHoverMotion(reduceMotion)}
      className="rounded-[24px] border border-border/60 bg-background/88 p-4 shadow-sm transition-shadow duration-300 hover:shadow-md"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-3 break-words text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{helper}</p>
    </motion.div>
  )
}

function StudentInfoRow({
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

function StudentMemberCard({
  member,
  isCurrentUser,
}: {
  member: ApiTeamMember
  isCurrentUser: boolean
}) {
  const name = getFullName(member.user)
  const isLeader = member.teamRole === "LEADER"
  const metadata = [member.user.department, member.user.academicYear, member.user.preferredTrack]
    .filter(Boolean)
    .map((item) => humanizeLabel(item as string))

  return (
    <Card
      className={`group/member h-full border shadow-sm transition-[border-color,background-color,box-shadow] duration-300 hover:shadow-md ${
        isLeader ? "border-primary/25 bg-primary/[0.04]" : "border-border/70 bg-background"
      }`}
    >
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 border border-border/60">
            <AvatarImage src={member.user.avatarUrl || "/placeholder.svg"} />
            <AvatarFallback>{getAvatarInitial(member.user)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold">{name}</p>
              {isCurrentUser && (
                <Badge variant="outline" className="rounded-full bg-background/80 px-2 py-0.5 text-[11px]">
                  You
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLeader ? "Team Leader" : formatRoleLabel(member.user.role)}
            </p>
            <p className="mt-2 break-words text-sm text-muted-foreground">{member.user.email}</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {member.user.bio?.trim() || "No bio added yet."}
        </p>

        {metadata.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {metadata.map((item) => (
              <Badge key={item} variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                {item}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-auto pt-5">
          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {isLeader ? "Leading this team" : "Team member"}
            </p>
          </div>

          <Button
            variant="outline"
            className="group mt-3 h-10 w-full justify-between rounded-lg border-border/70 bg-background px-4 text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary shadow-sm"
            asChild
          >
            <Link href={`/dashboard/users/${member.user.id}`}>
              View Profile
              <ArrowRight className="ml-2 h-4 w-4 text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function LeaveTeamDialog({
  open,
  onOpenChange,
  teamName,
  isSubmitting,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamName: string
  isSubmitting: boolean
  onConfirm: () => Promise<void>
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md overflow-hidden rounded-[28px] border-border/70 p-0">
        <div className="p-5 sm:p-6">
          <AlertDialogHeader className="space-y-4 text-left">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <UserMinus className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <AlertDialogTitle className="text-2xl tracking-tight">Leave team?</AlertDialogTitle>
              <AlertDialogDescription className="leading-6">
                You will leave <span className="font-medium text-foreground">{teamName}</span> and lose access to its team pages until you join another team.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>

          <div className="mt-6 rounded-2xl border border-destructive/15 bg-destructive/[0.03] p-4">
            <p className="text-sm font-medium text-foreground">Before you continue</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This only removes you from the team. You can still browse teams, join by code, or accept a new invitation later.
            </p>
          </div>

          <AlertDialogFooter className="mt-6 gap-3 sm:gap-3">
            <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void onConfirm()}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
              <span className="ml-2">Leave Team</span>
            </Button>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function getRevealMotion(reduceMotion: boolean, delay = 0) {
  if (reduceMotion) return {}

  return {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.52,
      delay,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }
}

function getCardHoverMotion(reduceMotion: boolean) {
  if (reduceMotion) return {}

  return {
    whileHover: {
      y: -6,
      scale: 1.01,
      transition: {
        duration: 0.24,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
    whileTap: {
      scale: 0.992,
      transition: {
        duration: 0.16,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
  }
}

function getPanelMotion(reduceMotion: boolean) {
  if (reduceMotion) return {}

  return {
    whileHover: {
      y: -3,
      scale: 1.004,
      transition: {
        duration: 0.22,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
  }
}

function getInsetMotion(reduceMotion: boolean) {
  if (reduceMotion) return {}

  return {
    whileHover: {
      y: -2,
      transition: {
        duration: 0.2,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
  }
}

function getActionMotion(reduceMotion: boolean) {
  if (reduceMotion) return {}

  return {
    whileHover: {
      y: -2,
      scale: 1.01,
      transition: {
        duration: 0.2,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
    whileTap: {
      scale: 0.985,
      transition: {
        duration: 0.14,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
  }
}

function humanizeLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 transition-colors hover:bg-muted/20">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  )
}

function ChecklistLine({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="group flex items-start gap-4 rounded-3xl border border-border/50 bg-background/50 p-4 transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/5">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold tracking-tight">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground/80 group-hover:text-muted-foreground transition-colors">{description}</p>
      </div>
    </div>
  )
}


















