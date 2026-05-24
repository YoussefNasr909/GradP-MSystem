"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Github, Linkedin, Loader2 } from "lucide-react"
import { FallbackState } from "@/components/feedback/fallback-state"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usersApi } from "@/lib/api/users"
import type { ApiPublicUserProfile } from "@/lib/api/types"
import { useAuthStore } from "@/lib/stores/auth-store"
import { formatRoleLabel, formatTeamVisibility, getAvatarInitial, getFullName } from "@/lib/team-display"

export default function PublicUserProfilePage() {
  const params = useParams()
  const { currentUser } = useAuthStore()
  const userId = String(params?.id || "")
  const [profile, setProfile] = useState<ApiPublicUserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    usersApi
      .getPublicProfile(userId)
      .then((result) => {
        if (!cancelled) setProfile(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load this profile.")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  if (isLoading) {
    return <ProfileLoadingState />
  }

  if (error || !profile) {
    return (
      <FallbackState
        kind="not-found"
        mode="panel"
        eyebrow="Profile"
        title="We could not open this profile"
        description={error || "This user profile is unavailable or no longer exists."}
        helperText="Return to search to look for another person or try opening the profile again."
        actions={[
          { label: "Back to Search", kind: "link", href: "/dashboard/search" },
          { label: "Go Back", kind: "back", variant: "outline" },
        ]}
      />
    )
  }

  const isSelf = currentUser?.id === profile.id
  const roleLabel = formatRoleLabel(profile.role)
  const departmentLabel = formatEnumLabel(profile.department) || "Not shared"
  const academicYearLabel = formatAcademicYear(profile.academicYear) || "Not shared"
  const preferredTrackLabel = formatEnumLabel(profile.preferredTrack) || "Not shared"
  const academicIdLabel = profile.academicId || "Not shared"
  const bioText = profile.bio?.trim() || "No public bio has been added yet."
  const identityMeta = [departmentLabel, academicYearLabel].filter((value) => value !== "Not shared").join(" / ")

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6 xl:p-8">
      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={reduceMotion ? undefined : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-5"
      >
        <div className="flex flex-col gap-5 border-b border-border/70 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            <Avatar className="h-20 w-20 border border-border/70 shadow-sm">
              <AvatarImage src={profile.avatarUrl || "/placeholder.svg"} />
              <AvatarFallback className="text-xl font-semibold">{getAvatarInitial(profile)}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-md bg-primary/10 px-2.5 py-1 text-primary">
                  {roleLabel}
                </Badge>
                {isSelf ? (
                  <Badge variant="outline" className="rounded-md">
                    You
                  </Badge>
                ) : null}
                {identityMeta ? <span className="text-sm text-muted-foreground">{identityMeta}</span> : null}
              </div>

              <div className="space-y-2">
                <h1 className="break-words text-2xl font-semibold text-foreground sm:text-3xl">
                  {getFullName(profile)}
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-[15px]">{bioText}</p>
              </div>
            </div>
          </div>

          {isSelf ? (
            <Button
              variant="outline"
              className="h-10 rounded-lg border-border/70 bg-background px-4 text-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              asChild
            >
              <Link href="/dashboard/settings?tab=profile">Edit profile</Link>
            </Button>
          ) : null}
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reduceMotion ? undefined : { duration: 0.36, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]"
        >
          <div className="space-y-4">
            <ProfilePanel title="Profile details" description="Academic information this user shares publicly.">
              <div className="grid gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60 sm:grid-cols-2">
                <DetailRow label="Email" value={profile.email ?? "Hidden by privacy settings"} />
                <DetailRow label="Role" value={roleLabel} />
                <DetailRow label="Academic ID" value={academicIdLabel} />
                <DetailRow label="Department" value={departmentLabel} />
                <DetailRow label="Academic year" value={academicYearLabel} />
                <DetailRow label="Preferred track" value={preferredTrackLabel} />
              </div>
            </ProfilePanel>

            <ProfilePanel title="Current team" description="Where this user is currently collaborating.">
              {profile.currentTeam ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border/60 bg-muted/15 p-4">
                    <p className="text-base font-semibold text-foreground">{profile.currentTeam.name}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {profile.currentTeam.bio?.trim() || "No public team description has been added yet."}
                    </p>
                  </div>

                  <div className="grid gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60 sm:grid-cols-3">
                    <DetailRow
                      label="Team role"
                      value={profile.currentTeam.teamRole === "LEADER" ? "Team Leader" : "Team Member"}
                    />
                    <DetailRow label="Visibility" value={formatTeamVisibility(profile.currentTeam.visibility)} />
                    <DetailRow label="Members" value={`${profile.currentTeam.memberCount} members`} />
                  </div>

                  <Button
                    variant="outline"
                    className="group h-10 rounded-lg border-border/70 bg-background px-4 text-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                    asChild
                  >
                    <Link href={`/dashboard/teams/${profile.currentTeam.id}`}>
                      Open team
                      <ArrowRight className="ml-2 h-4 w-4 text-muted-foreground transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <PlainNotice>This user is not currently part of any team.</PlainNotice>
              )}
            </ProfilePanel>
          </div>

          <ProfilePanel title="Public links" description="External places this user chose to share.">
            {profile.linkedinUrl || profile.githubUsername ? (
              <div className="space-y-3">
                {profile.linkedinUrl ? (
                  <ExternalLinkRow
                    href={profile.linkedinUrl}
                    label="LinkedIn"
                    detail={profile.linkedinUrl}
                    icon={<Linkedin className="h-4 w-4" />}
                    reduceMotion={Boolean(reduceMotion)}
                  />
                ) : null}

                {profile.githubUsername ? (
                  <ExternalLinkRow
                    href={`https://github.com/${profile.githubUsername}`}
                    label="GitHub"
                    detail={`github.com/${profile.githubUsername}`}
                    icon={<Github className="h-4 w-4" />}
                    reduceMotion={Boolean(reduceMotion)}
                  />
                ) : null}
              </div>
            ) : (
              <PlainNotice>No public LinkedIn or GitHub links have been shared yet.</PlainNotice>
            )}
          </ProfilePanel>
        </motion.div>
      </motion.section>
    </div>
  )
}

function ProfilePanel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-background p-4 shadow-sm sm:p-5">
      <div className="mb-4 space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-background p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm leading-6 text-foreground">{value}</p>
    </div>
  )
}

function PlainNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 p-4">
      <p className="text-sm leading-7 text-muted-foreground">{children}</p>
    </div>
  )
}

function ExternalLinkRow({
  href,
  label,
  detail,
  icon,
  reduceMotion,
}: {
  href: string
  label: string
  detail: string
  icon: ReactNode
  reduceMotion: boolean
}) {
  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
      transition={reduceMotion ? undefined : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <Button
        variant="outline"
        asChild
        className="group h-auto w-full justify-between rounded-lg border-border/70 bg-background px-4 py-3 text-foreground shadow-none transition-[border-color,background-color,color] duration-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
      >
        <a href={href} target="_blank" rel="noreferrer">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary transition-colors duration-200 group-hover:bg-primary/10 group-hover:text-primary">
              {icon}
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block truncate text-xs text-muted-foreground transition-colors duration-200 group-hover:text-foreground/70">
                {detail}
              </span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
        </a>
      </Button>
    </motion.div>
  )
}

function ProfileLoadingState() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6 xl:p-8">
      <div className="flex flex-col gap-5 border-b border-border/70 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-7 w-24 rounded-md" />
              <Skeleton className="h-7 w-36 rounded-md" />
            </div>
            <Skeleton className="h-8 w-72 max-w-full rounded-md" />
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-5/6 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <div className="space-y-4">
          <LoadingPanel rows={6} columns="sm:grid-cols-2" />
          <LoadingPanel rows={3} columns="sm:grid-cols-3" />
        </div>

        <section className="rounded-xl border border-border/70 bg-background p-4 shadow-sm sm:p-5">
          <Skeleton className="h-5 w-28 rounded-md" />
          <Skeleton className="mt-2 h-4 w-56 rounded-full" />
          <Skeleton className="mt-5 h-14 rounded-lg" />
          <Skeleton className="mt-3 h-14 rounded-lg" />
        </section>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Loading public profile...
      </div>
    </div>
  )
}

function LoadingPanel({ rows, columns }: { rows: number; columns: string }) {
  return (
    <section className="rounded-xl border border-border/70 bg-background p-4 shadow-sm sm:p-5">
      <Skeleton className="h-5 w-36 rounded-md" />
      <Skeleton className="mt-2 h-4 w-64 max-w-full rounded-full" />
      <div className={`mt-5 grid gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60 ${columns}`}>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="bg-background p-3">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="mt-2 h-5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </section>
  )
}

function formatEnumLabel(value: string | null | undefined) {
  if (!value) return null

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatAcademicYear(value: string | null | undefined) {
  if (!value) return null
  return value.replace("YEAR_", "Year ")
}
