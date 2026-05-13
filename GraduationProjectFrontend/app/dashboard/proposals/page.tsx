"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  FileText, Plus, Search, Filter, Clock, CheckCircle2, XCircle, RotateCcw,
  AlertCircle, Sparkles, ArrowRight, RefreshCw, FileEdit, LockKeyhole, ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth-store"
import { proposalsApi } from "@/lib/api/proposals"
import type { ApiProposal, ApiProposalStatus } from "@/lib/api/proposals"
import { toast } from "sonner"

// ─── Status meta ─────────────────────────────────────────────────────────────

const STATUS_META: Record<
  ApiProposalStatus,
  { label: string; icon: React.ElementType; color: string; chip: string }
> = {
  DRAFT:              { label: "Draft",              icon: FileEdit,    color: "text-gray-500",   chip: "border-gray-500/30 text-gray-500 bg-gray-500/5" },
  SUBMITTED:          { label: "Submitted",          icon: Clock,       color: "text-blue-500",   chip: "border-blue-500/30 text-blue-500 bg-blue-500/5" },
  UNDER_REVIEW:       { label: "Under Review",       icon: Clock,       color: "text-purple-500", chip: "border-purple-500/30 text-purple-500 bg-purple-500/5" },
  REVISION_REQUESTED: { label: "Revision Requested", icon: RotateCcw,   color: "text-amber-500",  chip: "border-amber-500/30 text-amber-500 bg-amber-500/5" },
  APPROVED:           { label: "Approved",           icon: CheckCircle2, color: "text-green-500",  chip: "border-green-500/30 text-green-500 bg-green-500/5" },
  REJECTED:           { label: "Rejected",           icon: XCircle,     color: "text-red-500",    chip: "border-red-500/30 text-red-500 bg-red-500/5" },
}

function getInitials(n: string) {
  return n.split(" ").map(x => x[0]).join("").toUpperCase().slice(0, 2)
}

// ─── Proposal Card ───────────────────────────────────────────────────────────

function ProposalCard({ proposal, index, isOwn }: { proposal: ApiProposal; index: number; isOwn: boolean }) {
  const meta = STATUS_META[proposal.status]
  const StatusIcon = meta.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.3 }}
    >
      <Link href={`/dashboard/proposals/${proposal.id}`}>
        <Card className="p-5 border-border/50 hover:border-border/80 hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden">
          {isOwn && (
            <motion.div
              className="absolute -right-12 -top-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 8, repeat: Infinity }}
            />
          )}

          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className={cn("text-xs gap-1 capitalize", meta.chip)}>
                  <StatusIcon className="h-3 w-3" />
                  {meta.label}
                </Badge>
                {proposal.revisionCount > 0 && (
                  <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500">
                    rev {proposal.revisionCount}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">v{proposal.version}</Badge>
              </div>
              <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                {proposal.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Team: <span className="text-foreground font-medium">{proposal.team.name}</span>
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-1 group-hover:text-primary transition-all" />
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{proposal.abstract}</p>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {proposal.technologies.slice(0, 4).map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
              ))}
              {proposal.technologies.length > 4 && (
                <span className="text-[10px] text-muted-foreground">+{proposal.technologies.length - 4}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {proposal.authoredBy && (
                <Avatar className="h-7 w-7 ring-2 ring-background">
                  <AvatarImage src={proposal.authoredBy.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {getInitials(proposal.authoredBy.fullName)}
                  </AvatarFallback>
                </Avatar>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(proposal.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  )
}

// ─── Empty State for Leaders (no proposal yet) ───────────────────────────────

function EmptyLeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="p-12 text-center border-dashed border-2 border-border/60">
        <motion.div
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <FileText className="h-10 w-10 text-primary" />
        </motion.div>
        <h2 className="text-2xl font-bold mb-2">Start Your Project Proposal</h2>
        <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
          Every great project starts with a clear proposal. Describe your idea, scope, methodology, and deliverables — your doctor will review and approve it before you begin the SDLC.
        </p>
        <Link href="/dashboard/proposals/new">
          <Button size="lg" className="shadow-md">
            <Plus className="h-5 w-5 mr-2" />
            Create Proposal
          </Button>
        </Link>
      </Card>
    </motion.div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

function ProposalWorkflowSummary() {
  return (
    <Card className="p-5 border-border/50">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Professional Flow</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            {["Draft", "Submit", "Doctor Review", "Approved"].map((step, index) => (
              <div key={step} className="rounded-lg border border-border/60 p-3">
                <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </div>
                <p className="text-sm font-medium">{step}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">Approval gate</h3>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Teams can plan while the proposal is under review, but official SDLC submissions, phase advancement, and formal risk approval unlock only after doctor approval.
          </p>
        </div>
      </div>
    </Card>
  )
}

export default function ProposalsPage() {
  const { currentUser } = useAuthStore()
  const role = currentUser?.role?.toLowerCase() ?? ""

  const isLeader     = role === "leader"
  const isMember     = role === "member"
  const isSupervisor = role === "doctor" || role === "ta"
  const isAdmin      = role === "admin"
  const isOwnTeam    = isLeader || isMember

  const [items, setItems]         = useState<ApiProposal[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [search, setSearch]       = useState("")
  const [statusFilter, setStatus] = useState<string>("all")

  const fetchData = useCallback(async () => {
    setError(false)
    try {
      const data = await proposalsApi.list({
        search: search || undefined,
        status: (statusFilter !== "all" ? (statusFilter as ApiProposalStatus) : undefined),
      })
      setItems(data)
    } catch {
      setError(true)
    }
  }, [search, statusFilter])

  useEffect(() => {
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
    toast.success("Proposals refreshed")
  }

  // Find "my" proposal (leader's own team) so we can pin it at the top
  const myProposal = useMemo(
    () => (isOwnTeam ? items.find(p => p.team.leaderId === currentUser?.id) ?? items[0] : null),
    [items, isOwnTeam, currentUser?.id],
  )

  const stats = useMemo(() => ({
    total:    items.length,
    approved: items.filter(p => p.status === "APPROVED").length,
    pending:  items.filter(p => p.status === "SUBMITTED" || p.status === "UNDER_REVIEW").length,
    revision: items.filter(p => p.status === "REVISION_REQUESTED").length,
  }), [items])

  const leaderNeedsCreate = isLeader && !loading && items.length === 0

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 sm:p-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 border border-border/50 relative overflow-hidden bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5" />
        <motion.div
          className="absolute -right-20 -top-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none"
          animate={{ scale: [1, 1.15, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <motion.h1
              className="text-3xl font-bold mb-1.5 flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            >
              <FileText className="h-7 w-7 text-primary" />
              Project Proposals
            </motion.h1>
            <motion.p className="text-muted-foreground" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              {isLeader && "Define your project before the SDLC begins."}
              {isMember && "Track your team's project proposal."}
              {isSupervisor && "Review and approve proposals from your teams."}
              {isAdmin && "All project proposals across the program."}
            </motion.p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing}>
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
            {isLeader && items.length === 0 && !loading && (
              <Link href="/dashboard/proposals/new">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1.5" /> New Proposal
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <ProposalWorkflowSummary />

      {/* Stats (supervisor/admin only) */}
      {(isSupervisor || isAdmin) && !loading && (
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Total",           value: stats.total,    color: "from-blue-500/10",  icon: FileText },
            { label: "Approved",        value: stats.approved, color: "from-green-500/10", icon: CheckCircle2 },
            { label: "Awaiting Review", value: stats.pending,  color: "from-amber-500/10", icon: Clock },
            { label: "Needs Revision",  value: stats.revision, color: "from-red-500/10",   icon: RotateCcw },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
              <Card className="p-5 relative overflow-hidden">
                <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent", s.color)} />
                <div className="relative flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                    <s.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Leader's own proposal — highlighted */}
      {isOwnTeam && myProposal && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Your Proposal</h2>
          </div>
          <ProposalCard proposal={myProposal} index={0} isOwn />
        </motion.div>
      )}

      {/* Filters (supervisor/admin) */}
      {(isSupervisor || isAdmin) && (
        <Card className="p-4 border-border/50">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, team, or abstract…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {(Object.keys(STATUS_META) as ApiProposalStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || statusFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatus("all") }}>
                <Filter className="h-4 w-4 mr-1.5" />
                Clear
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-24 w-full" /></Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-12 text-center border-border/50">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <p className="text-muted-foreground mb-4">Failed to load proposals</p>
          <Button variant="outline" onClick={() => void fetchData()}>Try again</Button>
        </Card>
      ) : leaderNeedsCreate ? (
        <EmptyLeader />
      ) : items.length === 0 ? (
        <Card className="p-12 text-center border-border/50">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {isSupervisor || isAdmin ? "No proposals match your filters." : "No proposal found for your team yet."}
          </p>
        </Card>
      ) : (
        <div>
          {(isSupervisor || isAdmin) && (
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">All Proposals</h2>
              <Badge variant="secondary">{items.length}</Badge>
            </div>
          )}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {items
                .filter(p => !(isOwnTeam && myProposal && p.id === myProposal.id))
                .map((p, i) => (
                  <ProposalCard key={p.id} proposal={p} index={i} isOwn={false} />
                ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>
  )
}
