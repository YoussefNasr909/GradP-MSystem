"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import {
  Award,
  Briefcase,
  Github,
  GraduationCap,
  Link as LinkIcon,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DashboardMetricCard, DashboardPageHeader, DashboardStateCard } from "@/components/dashboard/page-shell"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import { useAuthStore } from "@/lib/stores/auth-store"
import type { UserRole } from "@/types"

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Coordinator / Admin",
  doctor: "Doctor",
  ta: "Teaching Assistant",
  leader: "Team Leader",
  member: "Student",
  support: "Support Staff",
}

const ROLE_TONES: Record<UserRole, "primary" | "blue" | "emerald" | "amber" | "rose" | "violet" | "slate"> = {
  admin: "rose",
  doctor: "blue",
  ta: "emerald",
  leader: "violet",
  member: "primary",
  support: "amber",
}

function getInitials(name?: string | null) {
  return String(name ?? "User")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function getQuickLinks(role: UserRole) {
  if (role === "admin") {
    return [
      { href: "/dashboard/users", label: "User Management", icon: ShieldCheck },
      { href: "/dashboard/reports", label: "Reports", icon: Award },
      { href: "/dashboard/analytics", label: "Analytics", icon: Sparkles },
    ]
  }

  if (role === "doctor") {
    return [
      { href: "/dashboard/teams", label: "My Teams", icon: Users },
      { href: "/dashboard/analytics", label: "Analytics", icon: Sparkles },
      { href: "/dashboard/reports", label: "Reports", icon: Award },
    ]
  }

  if (role === "ta") {
    return [
      { href: "/dashboard/teams", label: "My Teams", icon: Users },
      { href: "/dashboard/tasks", label: "Tasks", icon: Briefcase },
      { href: "/dashboard/sprints", label: "Sprints", icon: Sparkles },
    ]
  }

  return [
    { href: "/dashboard/my-team", label: "My Team", icon: Users },
    { href: "/dashboard/tasks", label: "Tasks", icon: Briefcase },
    { href: "/dashboard/sprints", label: "Sprints", icon: Sparkles },
  ]
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User
  label: string
  value?: string | null
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/25 p-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium">{value || "Not added yet"}</p>
      </div>
    </div>
  )
}

function CompactMetricValue({ children }: { children: ReactNode }) {
  return <span className="block max-w-full truncate text-lg sm:text-xl">{children}</span>
}

export default function ProfilePage() {
  const { currentUser, hasHydrated } = useAuthStore()
  const { data: myTeamState, isLoading: isTeamLoading } = useMyTeamState(Boolean(currentUser))

  if (!hasHydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-3xl">
        <DashboardStateCard
          icon={User}
          title="Sign in required"
          description="You need to sign in before you can view your profile."
          tone="rose"
        />
      </div>
    )
  }

  const roleTone = ROLE_TONES[currentUser.role]
  const roleLabel = ROLE_LABELS[currentUser.role]
  const avatarUrl = currentUser.avatar || currentUser.avatarUrl
  const teamName = myTeamState?.team?.name ?? currentUser.teamName ?? null
  const supervisedTeams = myTeamState?.supervisedTeams ?? []
  const isStudentRole = currentUser.role === "leader" || currentUser.role === "member"
  const quickLinks = getQuickLinks(currentUser.role)
  const linkedInUrl = currentUser.linkedinUrl || currentUser.socialLinks?.linkedin
  const githubUrl = currentUser.githubUsername
    ? `https://github.com/${currentUser.githubUsername.replace(/^@/, "")}`
    : currentUser.socialLinks?.github

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <DashboardPageHeader
        title="Profile"
        description="Review how your account appears across the graduation project management system."
        icon={User}
        tone={roleTone}
        badge={<Badge variant="outline" className="rounded-md">{roleLabel}</Badge>}
        actions={
          <Button asChild>
            <Link href="/dashboard/settings?tab=profile">
              <Pencil className="mr-2 h-4 w-4" />
              Edit Profile
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card className="rounded-[22px] border-border/60 p-5 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-28 w-28 border-4 border-background shadow-sm">
              <AvatarImage src={avatarUrl || undefined} alt={currentUser.name} />
              <AvatarFallback className="bg-primary/10 text-3xl font-semibold text-primary">
                {getInitials(currentUser.name)}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-xl font-semibold">{currentUser.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{currentUser.email}</p>
            <Badge className="mt-3" variant="secondary">
              {roleLabel}
            </Badge>
          </div>

          <div className="mt-6 space-y-3">
            <DetailRow icon={Mail} label="Email" value={currentUser.email} />
            <DetailRow icon={Phone} label="Phone" value={currentUser.phone} />
            <DetailRow icon={GraduationCap} label="Academic ID" value={currentUser.academicId || currentUser.studentCode} />
            <DetailRow icon={MapPin} label="Department" value={currentUser.department} />
          </div>
        </Card>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <DashboardMetricCard label="Role" value={<CompactMetricValue>{roleLabel}</CompactMetricValue>} icon={ShieldCheck} tone={roleTone} />
            <DashboardMetricCard
              label={isStudentRole ? "Team" : "Supervised teams"}
              value={<CompactMetricValue>{isStudentRole ? teamName || "None" : isTeamLoading ? "..." : supervisedTeams.length}</CompactMetricValue>}
              icon={Users}
              tone="blue"
            />
            <DashboardMetricCard label="Track" value={<CompactMetricValue>{currentUser.preferredTrack || currentUser.track || "Not set"}</CompactMetricValue>} icon={Briefcase} tone="emerald" />
            <DashboardMetricCard label="Level" value={currentUser.level ?? "-"} icon={Award} tone="amber" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
            <Card className="rounded-[22px] border-border/60 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">About</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Profile details used by teams and supervisors.</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-border/60 bg-muted/25 p-4">
                <p className="text-sm leading-7 text-muted-foreground">{currentUser.bio || "No bio has been added yet."}</p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <DetailRow icon={Users} label={isStudentRole ? "Team" : "Primary scope"} value={isStudentRole ? teamName : supervisedTeams.length ? `${supervisedTeams.length} supervised teams` : "No teams assigned"} />
                <DetailRow icon={Briefcase} label="Specialization" value={currentUser.specialization || currentUser.preferredTrack || currentUser.track} />
                <DetailRow icon={LinkIcon} label="LinkedIn" value={linkedInUrl} />
                <DetailRow icon={Github} label="GitHub" value={githubUrl} />
              </div>
            </Card>

            <Card className="rounded-[22px] border-border/60 p-5 shadow-sm">
              <h3 className="text-lg font-semibold">Quick Links</h3>
              <p className="mt-1 text-sm text-muted-foreground">Role-relevant places to continue work.</p>
              <div className="mt-5 space-y-2">
                {quickLinks.map((item) => (
                  <Button key={item.href} variant="outline" className="w-full justify-start gap-2 bg-transparent" asChild>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </Button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
