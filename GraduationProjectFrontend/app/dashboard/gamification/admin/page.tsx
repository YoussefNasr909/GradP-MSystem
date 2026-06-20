"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, Coins, Crown, Gift, Loader2, Medal, Palette, RefreshCw, Search, Shield, ShieldAlert, SlidersHorizontal, Sparkles, Target } from "lucide-react"
import { useAuthStore } from "@/lib/stores/auth-store"
import { usersApi } from "@/lib/api/users"
import { teamsApi } from "@/lib/api/teams"
import { getRewardStyle } from "@/lib/gamification/reward-styles"
import type { ApiDirectoryUser, ApiTeamSummary } from "@/lib/api/types"
import {
  gamificationApi,
  type GamificationAdjustment,
  type GamificationCase,
  type PaginatedAdjustments,
  type PaginatedCases,
} from "@/lib/api/gamification"
import { economyApi, type PaginatedQuests, type PaginatedRewards, type QuestMetric, type QuestType, type RewardItem } from "@/lib/api/economy"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const STAFF_ROLES = new Set(["admin", "doctor", "ta"])
const REVIEW_ROLES = new Set(["admin", "doctor"])
const PAGE_SIZE = 25
const QUEST_TYPES: QuestType[] = ["DAILY", "WEEKLY", "MILESTONE"]
const QUEST_METRICS: QuestMetric[] = [
  "XP_EARNED",
  "TASKS_DONE",
  "SUBMISSIONS_APPROVED",
  "PRS_MERGED",
  "REVIEWS_GIVEN",
  "SPRINTS_COMPLETED",
  "WEEKLY_REPORTS_APPROVED",
  "LOGIN_STREAK",
]
const REWARD_TYPES: RewardItem["type"][] = ["TITLE", "AVATAR_FRAME", "PROFILE_THEME", "BADGE_SKIN"]
const rewardTypeIcons: Record<RewardItem["type"], typeof Gift> = {
  TITLE: Crown,
  AVATAR_FRAME: Shield,
  PROFILE_THEME: Palette,
  BADGE_SKIN: Medal,
}

type AdjustmentTargetType = "USER" | "TEAM"

type AdjustmentTargetOption = {
  id: string
  name: string
  description: string
}

function userName(user?: { firstName?: string; lastName?: string } | null) {
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Unknown user"
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function statusVariant(status: string) {
  if (status === "APPROVED") return "default"
  if (status === "REJECTED") return "destructive"
  if (status === "PENDING" || status === "OPEN" || status === "UNDER_REVIEW") return "secondary"
  return "outline"
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function userToTargetOption(user: ApiDirectoryUser): AdjustmentTargetOption {
  const name = user.fullName || userName(user)
  const details = [user.role, user.academicId, user.currentTeam?.name].filter(Boolean)
  return {
    id: user.id,
    name,
    description: details.join(" | ") || user.id,
  }
}

function teamToTargetOption(team: ApiTeamSummary): AdjustmentTargetOption {
  const details = [
    `${team.memberCount}/${team.maxMembers} members`,
    team.leader ? `Leader: ${userName(team.leader)}` : null,
  ].filter(Boolean)

  return {
    id: team.id,
    name: team.name,
    description: details.join(" | ") || team.id,
  }
}

function LoadingPanel() {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Loading
    </div>
  )
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="h-4 w-4" />
        {message}
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  )
}

function PaginationControls({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>
        Page {page} of {totalPages} ({total} total)
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}

function RewardTypePreview({
  type,
  name,
  description,
  status,
}: {
  type: RewardItem["type"]
  name: string
  description?: string
  status?: RewardItem["status"]
}) {
  const style = getRewardStyle(type)
  const Icon = rewardTypeIcons[type] ?? Gift

  return (
    <div className={`rounded-md border p-3 ${style.previewClass}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${style.iconClass}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{name || style.previewLabel}</p>
            <Badge variant="outline" className={`text-xs ${style.badgeClass}`}>{style.label}</Badge>
            {status && <Badge variant={statusVariant(status)} className="text-xs">{status}</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{description || style.description}</p>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className={`h-3 w-10 rounded-full bg-gradient-to-r ${style.swatchClass}`} />
            {style.shortLabel} preview
          </div>
        </div>
      </div>
    </div>
  )
}

function AdjustmentTargetSearch({
  targetType,
  selectedTarget,
  onSelect,
}: {
  targetType: AdjustmentTargetType
  selectedTarget: AdjustmentTargetOption | null
  onSelect: (target: AdjustmentTargetOption | null) => void
}) {
  const [search, setSearch] = useState("")
  const [options, setOptions] = useState<AdjustmentTargetOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setSearch("")
    setOptions([])
    setError("")
  }, [targetType])

  useEffect(() => {
    let cancelled = false
    const query = search.trim()

    if (selectedTarget && query === selectedTarget.name) {
      setOptions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")
    const timer = window.setTimeout(async () => {
      try {
        const result =
          targetType === "USER"
            ? await usersApi.directory({ page: 1, limit: 8, search: query || undefined })
            : await teamsApi.list({ page: 1, limit: 8, search: query || undefined })

        if (cancelled) return

        const nextOptions =
          targetType === "USER"
            ? (result.items as ApiDirectoryUser[]).map(userToTargetOption)
            : (result.items as ApiTeamSummary[]).map(teamToTargetOption)

        setOptions(nextOptions)
      } catch (err: unknown) {
        if (!cancelled) setError(errorMessage(err, "Failed to search targets"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [search, selectedTarget, targetType])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (selectedTarget) onSelect(null)
  }

  const handleSelect = (option: AdjustmentTargetOption) => {
    onSelect(option)
    setSearch(option.name)
    setOptions([])
  }

  return (
    <div className="grid gap-2">
      <Label>{targetType === "USER" ? "User" : "Team"}</Label>
      <div className="rounded-md border bg-background">
        <div className="flex items-center gap-2 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder={targetType === "USER" ? "Search users by name or ID" : "Search teams by name"}
            className="border-0 px-0 shadow-none focus-visible:ring-0"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {selectedTarget && (
          <div className="border-t px-3 py-2 text-sm">
            <div className="font-medium">{selectedTarget.name}</div>
            <div className="text-xs text-muted-foreground">{selectedTarget.description}</div>
          </div>
        )}
        {!selectedTarget && (
          <div className="max-h-56 overflow-y-auto border-t">
            {error ? (
              <div className="px-3 py-3 text-sm text-destructive">{error}</div>
            ) : options.length > 0 ? (
              options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="block font-medium">{option.name}</span>
                  <span className="block text-xs text-muted-foreground">{option.description}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-sm text-muted-foreground">
                {loading ? "Searching..." : "No targets found."}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CasesTab({ canResolve }: { canResolve: boolean }) {
  const [status, setStatus] = useState("OPEN")
  const [page, setPage] = useState(1)
  const [cases, setCases] = useState<PaginatedCases | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [resolutionById, setResolutionById] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      setCases(await gamificationApi.getCases({ page, limit: PAGE_SIZE, status: status === "ALL" ? undefined : status }))
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load cases"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page])

  const handleStatusChange = (value: string) => {
    setStatus(value)
    setPage(1)
  }

  const resolveCase = async (item: GamificationCase, decision: "APPROVE" | "REJECT") => {
    const resolution = resolutionById[item.id]?.trim()
    if (!resolution || resolution.length < 5) return
    setBusyId(item.id)
    try {
      await gamificationApi.resolveCase(item.id, { decision, resolution })
      setResolutionById((prev) => ({ ...prev, [item.id]: "" }))
      await load()
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to resolve case"))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Suspicious XP Cases</h2>
          <p className="text-sm text-muted-foreground">Review frozen XP without exposing anti-cheat signals to students.</p>
        </div>
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["OPEN", "UNDER_REVIEW", "ESCALATED", "APPROVED", "REJECTED", "ALL"].map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? <LoadingPanel /> : error ? <ErrorPanel message={error} onRetry={load} /> : null}

      {!loading && !error && cases?.items.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">No cases match this filter.</Card>
      )}

      <div className="space-y-3">
        {cases?.items.map((item) => {
          const canAct = canResolve && ["OPEN", "UNDER_REVIEW", "ESCALATED"].includes(item.status)
          const resolution = resolutionById[item.id] ?? ""
          return (
            <Card key={item.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    <span className="font-medium">{item.team?.name ?? "No team"}</span>
                    <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    User: {userName(item.user)} · Score: {Math.round(item.score)} · Opened {formatDate(item.createdAt)}
                  </p>
                  {item.signals && (
                    <div className="mt-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded-md">
                      <strong className="text-foreground">Detection Signals:</strong>
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[10px]">
                        {JSON.stringify(item.signals, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {canAct && (
                <div className="mt-4 grid gap-3">
                  <div>
                    <Textarea
                      value={resolution}
                      onChange={(event) => setResolutionById((prev) => ({ ...prev, [item.id]: event.target.value }))}
                      placeholder="Resolution note for audit and student-safe review outcome"
                    />
                    {resolution.trim().length > 0 && resolution.trim().length < 5 && (
                      <p className="mt-1 text-xs text-muted-foreground">At least 5 characters required.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busyId === item.id || resolution.trim().length < 5} onClick={() => resolveCase(item, "APPROVE")}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve XP
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={busyId === item.id || resolution.trim().length < 5}
                      onClick={() => resolveCase(item, "REJECT")}
                    >
                      Reject XP
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
      {cases && (
        <PaginationControls
          page={cases.page}
          totalPages={cases.totalPages}
          total={cases.total}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}

function AdjustmentsTab({ canReview }: { canReview: boolean }) {
  const [items, setItems] = useState<PaginatedAdjustments | null>(null)
  const [status, setStatus] = useState("PENDING")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [targetType, setTargetType] = useState<AdjustmentTargetType>("USER")
  const [targetId, setTargetId] = useState("")
  const [selectedTarget, setSelectedTarget] = useState<AdjustmentTargetOption | null>(null)
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [sourceReference, setSourceReference] = useState("")
  const [reviewCommentById, setReviewCommentById] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      setItems(await gamificationApi.getAdjustments({ page, limit: PAGE_SIZE, status: status === "ALL" ? undefined : status }))
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load adjustments"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page])

  const handleStatusChange = (value: string) => {
    setStatus(value)
    setPage(1)
  }

  const handleTargetTypeChange = (value: AdjustmentTargetType) => {
    setTargetType(value)
    setTargetId("")
    setSelectedTarget(null)
  }

  const handleTargetSelect = (target: AdjustmentTargetOption | null) => {
    setSelectedTarget(target)
    setTargetId(target?.id ?? "")
  }

  const createRequest = async () => {
    const parsedAmount = Number(amount)
    if (!targetId.trim() || !Number.isInteger(parsedAmount) || parsedAmount === 0 || reason.trim().length < 5) return
    setSubmitting(true)
    setFormError("")
    try {
      await gamificationApi.createAdjustment({
        targetUserId: targetType === "USER" ? targetId.trim() : undefined,
        targetTeamId: targetType === "TEAM" ? targetId.trim() : undefined,
        amount: parsedAmount,
        reason: reason.trim(),
        sourceReference: sourceReference.trim() || undefined,
      })
      setTargetId("")
      setSelectedTarget(null)
      setAmount("")
      setReason("")
      setSourceReference("")
      await load()
    } catch (err: unknown) {
      setFormError(errorMessage(err, "Failed to create adjustment request"))
    } finally {
      setSubmitting(false)
    }
  }

  const review = async (item: GamificationAdjustment, decision: "APPROVE" | "REJECT") => {
    setBusyId(item.id)
    try {
      await gamificationApi.reviewAdjustment(item.id, {
        decision,
        reviewComment: reviewCommentById[item.id]?.trim() || undefined,
      })
      await load()
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to review adjustment"))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Manual XP Adjustments</h2>
        <p className="text-sm text-muted-foreground">Request corrections; doctors/admins can approve scoped requests.</p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[140px_1fr_120px]">
          <div className="grid gap-2">
            <Label>Target</Label>
            <Select value={targetType} onValueChange={(value) => handleTargetTypeChange(value as AdjustmentTargetType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="TEAM">Team</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AdjustmentTargetSearch targetType={targetType} selectedTarget={selectedTarget} onSelect={handleTargetSelect} />
          <div className="grid gap-2">
            <Label>XP</Label>
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="75 or -25" inputMode="numeric" />
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" />
          <Textarea value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} placeholder="Source reference" />
        </div>
        <Button className="mt-3" onClick={createRequest} disabled={submitting}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SlidersHorizontal className="mr-2 h-4 w-4" />}
          Request Adjustment
        </Button>
        {formError && <p className="mt-2 text-sm text-destructive">{formError}</p>}
      </Card>

      <div className="flex justify-end">
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["PENDING", "APPROVED", "REJECTED", "ALL"].map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? <LoadingPanel /> : error ? <ErrorPanel message={error} onRetry={load} /> : null}

      {!loading && !error && items?.items.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">No adjustments match this filter.</Card>
      )}

      <div className="space-y-3">
        {items?.items.map((item) => {
          const canAct = canReview && item.status === "PENDING"
          return (
            <Card key={item.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.targetTeam?.name ?? userName(item.targetUser)}</span>
                    <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.amount > 0 ? "+" : ""}{item.amount} XP · Requested by {userName(item.requestedBy)} · {formatDate(item.createdAt)}
                  </p>
                </div>
              </div>
              {canAct && (
                <div className="mt-4 grid gap-3">
                  <Textarea
                    value={reviewCommentById[item.id] ?? ""}
                    onChange={(event) => setReviewCommentById((prev) => ({ ...prev, [item.id]: event.target.value }))}
                    placeholder="Review comment"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busyId === item.id} onClick={() => review(item, "APPROVE")}>Approve</Button>
                    <Button variant="destructive" disabled={busyId === item.id} onClick={() => review(item, "REJECT")}>Reject</Button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
      {items && (
        <PaginationControls
          page={items.page}
          totalPages={items.totalPages}
          total={items.total}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}

function EconomyAdminTab({ canEdit }: { canEdit: boolean }) {
  const [questPage, setQuestPage] = useState(1)
  const [rewardPage, setRewardPage] = useState(1)
  const [quests, setQuests] = useState<PaginatedQuests | null>(null)
  const [rewards, setRewards] = useState<PaginatedRewards | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [questForm, setQuestForm] = useState({
    code: "",
    title: "",
    description: "",
    type: "DAILY" as QuestType,
    metric: "TASKS_DONE" as QuestMetric,
    targetValue: "1",
    coinReward: "10",
    sortOrder: "100",
    isActive: true,
  })
  const [rewardForm, setRewardForm] = useState({
    code: "",
    name: "",
    description: "",
    type: "TITLE" as RewardItem["type"],
    cost: "100",
    inventory: "",
    sortOrder: "100",
    status: "ACTIVE" as RewardItem["status"],
  })
  const [saving, setSaving] = useState<"quest" | "reward" | null>(null)

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const [questResult, rewardResult] = await Promise.all([
        economyApi.adminQuests({ page: questPage, limit: PAGE_SIZE, status: "ALL" }),
        economyApi.adminRewards({ page: rewardPage, limit: PAGE_SIZE, status: "ALL" }),
      ])
      setQuests(questResult)
      setRewards(rewardResult)
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load economy settings"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questPage, rewardPage])

  const createQuest = async () => {
    setSaving("quest")
    setError("")
    try {
      await economyApi.createQuest({
        code: questForm.code.trim().toUpperCase().replace(/\s+/g, "_"),
        title: questForm.title.trim(),
        description: questForm.description.trim(),
        type: questForm.type,
        metric: questForm.metric,
        targetValue: Number(questForm.targetValue),
        coinReward: Number(questForm.coinReward),
        sortOrder: Number(questForm.sortOrder),
        isActive: questForm.isActive,
      })
      setQuestForm({ code: "", title: "", description: "", type: "DAILY", metric: "TASKS_DONE", targetValue: "1", coinReward: "10", sortOrder: "100", isActive: true })
      await load()
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to create quest"))
    } finally {
      setSaving(null)
    }
  }

  const createReward = async () => {
    setSaving("reward")
    setError("")
    try {
      await economyApi.createReward({
        code: rewardForm.code.trim().toUpperCase().replace(/\s+/g, "_"),
        name: rewardForm.name.trim(),
        description: rewardForm.description.trim(),
        type: rewardForm.type,
        cost: Number(rewardForm.cost),
        inventory: rewardForm.inventory.trim() ? Number(rewardForm.inventory) : null,
        sortOrder: Number(rewardForm.sortOrder),
        status: rewardForm.status,
      })
      setRewardForm({ code: "", name: "", description: "", type: "TITLE", cost: "100", inventory: "", sortOrder: "100", status: "ACTIVE" })
      await load()
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to create reward"))
    } finally {
      setSaving(null)
    }
  }

  const toggleQuest = async (quest: PaginatedQuests["items"][number]) => {
    await economyApi.updateQuest(quest.id, {
      code: quest.code,
      title: quest.title,
      description: quest.description,
      type: quest.type,
      metric: quest.metric,
      targetValue: quest.targetValue,
      coinReward: quest.coinReward,
      startsAt: quest.startsAt,
      endsAt: quest.endsAt,
      sortOrder: quest.sortOrder,
      isActive: !quest.isActive,
      metadata: quest.metadata,
    })
    await load()
  }

  const updateRewardStatus = async (reward: PaginatedRewards["items"][number], status: RewardItem["status"]) => {
    await economyApi.updateReward(reward.id, {
      code: reward.code,
      name: reward.name,
      description: reward.description,
      type: reward.type,
      cost: reward.cost,
      inventory: reward.inventory,
      imageUrl: reward.imageUrl,
      sortOrder: reward.sortOrder,
      status,
      metadata: reward.metadata,
    })
    await load()
  }

  const questValid = questForm.code.trim().length >= 3 && questForm.title.trim().length >= 3 && questForm.description.trim().length >= 5
  const rewardValid = rewardForm.code.trim().length >= 3 && rewardForm.name.trim().length >= 3 && rewardForm.description.trim().length >= 5

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Economy Management</h2>
        <p className="text-sm text-muted-foreground">Create quest goals and store rewards without changing XP ledger rules.</p>
        {!canEdit && <p className="mt-1 text-xs text-muted-foreground">Read-only staff view. Reward and quest creation stays admin-only.</p>}
      </div>
      {error && <ErrorPanel message={error} onRetry={load} />}
      {loading ? <LoadingPanel /> : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Quests</h3>
            </div>
            {canEdit && (
              <div className="grid gap-3 rounded-md border p-3">
                <Input placeholder="Code e.g. WEEKLY_DOC_REVIEW" value={questForm.code} onChange={(event) => setQuestForm((v) => ({ ...v, code: event.target.value }))} />
                <Input placeholder="Title" value={questForm.title} onChange={(event) => setQuestForm((v) => ({ ...v, title: event.target.value }))} />
                <Textarea placeholder="Description" value={questForm.description} onChange={(event) => setQuestForm((v) => ({ ...v, description: event.target.value }))} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select value={questForm.type} onValueChange={(value) => setQuestForm((v) => ({ ...v, type: value as QuestType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{QUEST_TYPES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={questForm.metric} onValueChange={(value) => setQuestForm((v) => ({ ...v, metric: value as QuestMetric }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{QUEST_METRICS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Target" value={questForm.targetValue} onChange={(event) => setQuestForm((v) => ({ ...v, targetValue: event.target.value }))} />
                  <Input placeholder="Coin reward" value={questForm.coinReward} onChange={(event) => setQuestForm((v) => ({ ...v, coinReward: event.target.value }))} />
                </div>
                <Button disabled={!questValid || saving === "quest"} onClick={createQuest}>
                  {saving === "quest" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Coins className="mr-2 h-4 w-4" />}
                  Create Quest
                </Button>
              </div>
            )}
            <div className="space-y-2">
              {quests?.items.map((quest) => (
                <div key={quest.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{quest.title}</div>
                      <div className="text-xs text-muted-foreground">{quest.code} | {quest.type} | {quest.metric}</div>
                      <div className="text-xs text-muted-foreground">Target {quest.targetValue} | {quest.coinReward} coins</div>
                    </div>
                    {canEdit && <Button variant="outline" size="sm" onClick={() => toggleQuest(quest)}>Toggle Active</Button>}
                  </div>
                </div>
              ))}
            </div>
            {quests && <PaginationControls page={quests.page} totalPages={quests.totalPages} total={quests.total} onPageChange={setQuestPage} />}
          </Card>

          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold">Rewards</h3>
            </div>
            {canEdit && (
              <div className="grid gap-3 rounded-md border p-3">
                <Input placeholder="Code e.g. TITLE_ARCHITECT" value={rewardForm.code} onChange={(event) => setRewardForm((v) => ({ ...v, code: event.target.value }))} />
                <Input placeholder="Name" value={rewardForm.name} onChange={(event) => setRewardForm((v) => ({ ...v, name: event.target.value }))} />
                <Textarea placeholder="Description" value={rewardForm.description} onChange={(event) => setRewardForm((v) => ({ ...v, description: event.target.value }))} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select value={rewardForm.type} onValueChange={(value) => setRewardForm((v) => ({ ...v, type: value as RewardItem["type"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{REWARD_TYPES.map((value) => <SelectItem key={value} value={value}>{getRewardStyle(value).label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Cost" value={rewardForm.cost} onChange={(event) => setRewardForm((v) => ({ ...v, cost: event.target.value }))} />
                  <Input placeholder="Inventory blank = unlimited" value={rewardForm.inventory} onChange={(event) => setRewardForm((v) => ({ ...v, inventory: event.target.value }))} />
                  <Input placeholder="Sort order" value={rewardForm.sortOrder} onChange={(event) => setRewardForm((v) => ({ ...v, sortOrder: event.target.value }))} />
                </div>
                <RewardTypePreview
                  type={rewardForm.type}
                  name={rewardForm.name}
                  description={rewardForm.description}
                  status={rewardForm.status}
                />
                <Button disabled={!rewardValid || saving === "reward"} onClick={createReward}>
                  {saving === "reward" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
                  Create Reward
                </Button>
              </div>
            )}
            <div className="space-y-2">
              {rewards?.items.map((reward) => {
                const style = getRewardStyle(reward.type)
                return (
                  <div key={reward.id} className={`rounded-md border p-3 text-sm ${style.cardClass}`}>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">{reward.name}</div>
                          <div className="text-xs text-muted-foreground">{reward.code}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className={`text-xs ${style.badgeClass}`}>{style.label}</Badge>
                            <Badge variant={statusVariant(reward.status)} className="text-xs">{reward.status}</Badge>
                            <span>{reward.cost} coins</span>
                            <span>{reward.inventory ?? "unlimited"} inventory</span>
                          </div>
                        </div>
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateRewardStatus(reward, reward.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
                          >
                            {reward.status === "ACTIVE" ? "Disable" : "Enable"}
                          </Button>
                        )}
                      </div>
                      <RewardTypePreview
                        type={reward.type}
                        name={reward.name}
                        description={reward.description}
                        status={reward.status}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            {rewards && <PaginationControls page={rewards.page} totalPages={rewards.totalPages} total={rewards.total} onPageChange={setRewardPage} />}
          </Card>
        </div>
      )}
    </div>
  )
}

export default function GamificationAdminPage() {
  const { currentUser, hasHydrated } = useAuthStore()
  const role = currentUser?.role?.toLowerCase() ?? ""
  const canView = STAFF_ROLES.has(role)
  const canReview = REVIEW_ROLES.has(role)
  const [snapshotMessage, setSnapshotMessage] = useState("")
  const [snapshotBusy, setSnapshotBusy] = useState(false)
  const [processorMessage, setProcessorMessage] = useState("")
  const [processorBusy, setProcessorBusy] = useState<"pending" | "failed" | null>(null)

  const title = useMemo(() => (role === "ta" ? "Gamification Review" : "Gamification Admin"), [role])

  const generateSnapshots = async () => {
    setSnapshotBusy(true)
    setSnapshotMessage("")
    setProcessorMessage("")
    try {
      const result = await gamificationApi.generateLeaderboardSnapshots()
      setSnapshotMessage(`Generated ${result.generated} leaderboard snapshot rows.`)
    } catch (err: any) {
      setSnapshotMessage(err?.message ?? "Snapshot generation failed.")
    } finally {
      setSnapshotBusy(false)
    }
  }

  const runProcessor = async (retryFailed: boolean) => {
    setProcessorBusy(retryFailed ? "failed" : "pending")
    setProcessorMessage("")
    setSnapshotMessage("")
    try {
      const result = await gamificationApi.processEvents({ retryFailed })
      const retried = result.retried ? ` Retried ${result.retried}.` : ""
      const disabled = result.disabled && result.reason ? ` ${result.reason}` : ""
      setProcessorMessage(
        `Processed ${result.processed}, failed ${result.failed}, skipped ${result.skipped}.${retried}${disabled}`,
      )
    } catch (err: any) {
      setProcessorMessage(err?.message ?? "Event processing failed.")
    } finally {
      setProcessorBusy(null)
    }
  }

  if (!hasHydrated) return <LoadingPanel />

  if (!canView) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Access Restricted</h1>
          <p className="mt-2 text-sm text-muted-foreground">This page is available to TAs, doctors, and admins.</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/dashboard/gamification">Back to Gamification</Link>
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground">Resolve XP reviews and request manual adjustments.</p>
        </div>
        {role === "admin" && (
          <div className="flex flex-wrap items-center gap-2">
            {(processorMessage || snapshotMessage) && (
              <span className="max-w-xl text-sm text-muted-foreground">{processorMessage || snapshotMessage}</span>
            )}
            <Button variant="outline" onClick={() => runProcessor(false)} disabled={processorBusy !== null || snapshotBusy}>
              {processorBusy === "pending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Process Pending
            </Button>
            <Button variant="outline" onClick={() => runProcessor(true)} disabled={processorBusy !== null || snapshotBusy}>
              {processorBusy === "failed" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
              Retry Failed
            </Button>
            <Button variant="outline" onClick={generateSnapshots} disabled={snapshotBusy || processorBusy !== null}>
              {snapshotBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate Snapshots
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="cases" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
          <TabsTrigger value="economy">Economy</TabsTrigger>
        </TabsList>
        <TabsContent value="cases">
          <CasesTab canResolve={canReview} />
        </TabsContent>
        <TabsContent value="adjustments">
          <AdjustmentsTab canReview={canReview} />
        </TabsContent>
        <TabsContent value="economy">
          <EconomyAdminTab canEdit={role === "admin"} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
