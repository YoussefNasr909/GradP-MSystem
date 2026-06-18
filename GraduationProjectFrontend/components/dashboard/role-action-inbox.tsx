"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  FileText,
  Award,
  GitPullRequest,
  Star,
  ArrowRight,
  CheckCircle2,
  Inbox,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth-store"
import { submissionsApi } from "@/lib/api/submissions"
import { proposalsApi } from "@/lib/api/proposals"
import { tasksApi } from "@/lib/api/tasks"

// ─── Types ───────────────────────────────────────────────────────────────────

type ActionItem = {
  label: string
  count: number
  icon: React.ElementType
  href: string
  /** Tailwind classes for the accent strip + icon background */
  accent: string
  /** Subtitle that explains what the user must do */
  cta: string
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Role-aware "what needs my attention" inbox shown at the top of the dashboard.
 *
 * Doctor:  proposals awaiting review · submissions waiting for final grade
 * TA:      submissions awaiting first-pass review · tasks/PRs awaiting review
 *
 * Returns null for other roles (or while loading initial data the first time —
 * the skeleton handles that). All counts are real and live.
 */
export function RoleActionInbox() {
  const { currentUser } = useAuthStore()
  const role = currentUser?.role?.toLowerCase() ?? ""
  const isDoctor = role === "doctor"
  const isTa     = role === "ta"
  const isAdmin  = role === "admin"

  const [items, setItems]   = useState<ActionItem[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isDoctor && !isTa && !isAdmin) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      try {
        if (isDoctor || isAdmin) {
          const [submittedProposals, underReviewProposals, awaitingFinalGrade] = await Promise.all([
            proposalsApi.list({ status: "SUBMITTED" }).catch(() => []),
            proposalsApi.list({ status: "UNDER_REVIEW" }).catch(() => []),
            submissionsApi.list({ status: "UNDER_REVIEW" }).catch(() => []),
          ])
          const pendingProposals = [...submittedProposals, ...underReviewProposals]
          if (cancelled) return
          setItems([
            {
              label: "Proposals awaiting your review",
              count: pendingProposals.length,
              icon: FileText,
              href: "/dashboard/proposals?status=SUBMITTED",
              accent: "bg-blue-500",
              cta: "Approve, request revisions, or reject project proposals.",
            },
            {
              label: "Submissions waiting for final grade",
              count: awaitingFinalGrade.length,
              icon: Award,
              href: "/dashboard/submissions",
              accent: "bg-amber-500",
              cta: "TA reviewed these — your final grade is needed.",
            },
          ])
        } else if (isTa) {
          const [fresh, pendingPRs] = await Promise.all([
            submissionsApi.list({ status: "PENDING" }).catch(() => []),
            tasksApi.list({ status: "REVIEW" }).catch(() => []),
          ])
          if (cancelled) return
          setItems([
            {
              label: "Submissions awaiting first-pass review",
              count: fresh.length,
              icon: Star,
              href: "/dashboard/submissions",
              accent: "bg-cyan-500",
              cta: "Recommend a grade for the doctor to finalize.",
            },
            {
              label: "Tasks / PRs awaiting your review",
              count: pendingPRs.length,
              icon: GitPullRequest,
              href: "/dashboard/reviews",
              accent: "bg-purple-500",
              cta: "Approve work or request changes from teams.",
            },
          ])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [isDoctor, isTa, isAdmin])

  // Hide entirely for roles that don't have a queue
  if (!isDoctor && !isTa && !isAdmin) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2">
        <Inbox className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Your Action Inbox
        </h2>
        {!loading && items && items.every((i) => i.count === 0) && (
          <Badge variant="outline" className="ml-1 border-green-500/30 text-green-500 gap-1 text-[10px]">
            <CheckCircle2 className="h-3 w-3" /> All clear
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-16 w-full" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <AnimatePresence>
            {items?.map((item, i) => {
              const Icon = item.icon
              const hasWork = item.count > 0
              return (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                >
                  <Link href={item.href}>
                    <Card
                      className={cn(
                        "p-5 border-border/50 transition-all relative overflow-hidden group cursor-pointer",
                        hasWork
                          ? "hover:border-border hover:shadow-lg"
                          : "opacity-70 hover:opacity-90",
                      )}
                    >
                      {/* Accent strip */}
                      <div className={cn("absolute left-0 top-0 bottom-0 w-1", item.accent)} />

                      {/* Animated glow on hover when there's work */}
                      {hasWork && (
                        <motion.div
                          className={cn(
                            "absolute -right-12 -top-12 w-28 h-28 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity",
                            item.accent,
                          )}
                        />
                      )}

                      <div className="flex items-center gap-4 relative">
                        <div className={cn("p-3 rounded-xl text-white shrink-0", item.accent)}>
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <motion.span
                              key={item.count}
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className={cn(
                                "text-3xl font-bold tabular-nums",
                                hasWork ? "text-foreground" : "text-muted-foreground",
                              )}
                            >
                              {item.count}
                            </motion.span>
                            {hasWork && (
                              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500">
                                action needed
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium mt-0.5 truncate">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.cta}</p>
                        </div>

                        <motion.div
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          whileHover={{ x: 4 }}
                        >
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </motion.div>
                      </div>

                      {hasWork && (
                        <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          <Sparkles className="h-3 w-3" />
                          <span>Click to handle</span>
                        </div>
                      )}
                    </Card>
                  </Link>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.section>
  )
}
