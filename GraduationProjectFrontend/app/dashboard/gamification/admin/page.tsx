"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, ShieldAlert, SlidersHorizontal, Sparkles } from "lucide-react"
import { useAuthStore } from "@/lib/stores/auth-store"
import {
  gamificationApi,
  type GamificationAdjustment,
  type GamificationCase,
  type PaginatedAdjustments,
  type PaginatedCases,
} from "@/lib/api/gamification"
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

function CasesTab({ canResolve }: { canResolve: boolean }) {
  const [status, setStatus] = useState("OPEN")
  const [cases, setCases] = useState<PaginatedCases | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [resolutionById, setResolutionById] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      setCases(await gamificationApi.getCases({ page: 1, limit: 25, status: status === "ALL" ? undefined : status }))
    } catch (err: any) {
      setError(err?.message ?? "Failed to load cases")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const resolveCase = async (item: GamificationCase, decision: "APPROVE" | "REJECT") => {
    const resolution = resolutionById[item.id]?.trim()
    if (!resolution || resolution.length < 5) return
    setBusyId(item.id)
    try {
      await gamificationApi.resolveCase(item.id, { decision, resolution })
      setResolutionById((prev) => ({ ...prev, [item.id]: "" }))
      await load()
    } catch (err: any) {
      setError(err?.message ?? "Failed to resolve case")
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
        <Select value={status} onValueChange={setStatus}>
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
    </div>
  )
}

function AdjustmentsTab({ canReview }: { canReview: boolean }) {
  const [items, setItems] = useState<PaginatedAdjustments | null>(null)
  const [status, setStatus] = useState("PENDING")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [targetType, setTargetType] = useState<"USER" | "TEAM">("USER")
  const [targetId, setTargetId] = useState("")
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
      setItems(await gamificationApi.getAdjustments({ page: 1, limit: 25, status: status === "ALL" ? undefined : status }))
    } catch (err: any) {
      setError(err?.message ?? "Failed to load adjustments")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

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
      setAmount("")
      setReason("")
      setSourceReference("")
      await load()
    } catch (err: any) {
      setFormError(err?.message ?? "Failed to create adjustment request")
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
    } catch (err: any) {
      setError(err?.message ?? "Failed to review adjustment")
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
            <Select value={targetType} onValueChange={(value: "USER" | "TEAM") => setTargetType(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="TEAM">Team</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>{targetType === "USER" ? "User ID" : "Team ID"}</Label>
            <Input value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="Paste exact ID" />
          </div>
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
        <Select value={status} onValueChange={setStatus}>
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

  const title = useMemo(() => (role === "ta" ? "Gamification Review" : "Gamification Admin"), [role])

  const generateSnapshots = async () => {
    setSnapshotBusy(true)
    setSnapshotMessage("")
    try {
      const result = await gamificationApi.generateLeaderboardSnapshots()
      setSnapshotMessage(`Generated ${result.generated} leaderboard snapshot rows.`)
    } catch (err: any) {
      setSnapshotMessage(err?.message ?? "Snapshot generation failed.")
    } finally {
      setSnapshotBusy(false)
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
            {snapshotMessage && <span className="text-sm text-muted-foreground">{snapshotMessage}</span>}
            <Button variant="outline" onClick={generateSnapshots} disabled={snapshotBusy}>
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
        </TabsList>
        <TabsContent value="cases">
          <CasesTab canResolve={canReview} />
        </TabsContent>
        <TabsContent value="adjustments">
          <AdjustmentsTab canReview={canReview} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
