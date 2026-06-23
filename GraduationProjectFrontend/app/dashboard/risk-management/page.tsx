"use client"

import { useAuthStore } from "@/lib/stores/auth-store"
import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Plus, TrendingUp, AlertTriangle, Edit, CheckCircle, RotateCcw, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import { risksApi } from "@/lib/api/risks"
import { proposalsApi, type ApiProposal } from "@/lib/api/proposals"
import type { ApiRisk, ApiRiskChance, ApiRiskSeverity, ApiRiskStatus, ApiTeamUser } from "@/lib/api/types"

const CATEGORIES = ["Technical", "People", "Project", "External", "Financial", "Legal"]
const CHANCE_OPTIONS: ApiRiskChance[] = ["LOW", "MEDIUM", "HIGH"]
const SEVERITY_OPTIONS: ApiRiskSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

type AddRiskErrors = Partial<Record<"title" | "description" | "category" | "chance" | "impact" | "monitorUserId", string>>
type EditRiskErrors = Partial<Record<"monitorUserId" | "resolutionNotes", string>>
type ApproveRiskErrors = Partial<Record<"severity", string>>

function severityColor(severity: ApiRiskSeverity | null) {
  switch (severity) {
    case "CRITICAL": return "text-rose-600 dark:text-rose-400"
    case "HIGH": return "text-orange-600 dark:text-orange-400"
    case "MEDIUM": return "text-amber-600 dark:text-amber-400"
    case "LOW": return "text-emerald-600 dark:text-emerald-400"
    default: return "text-muted-foreground"
  }
}

function severityBg(severity: ApiRiskSeverity | null) {
  switch (severity) {
    case "CRITICAL": return "bg-rose-500/10 border-rose-500/20"
    case "HIGH": return "bg-orange-500/10 border-orange-500/20"
    case "MEDIUM": return "bg-amber-500/10 border-amber-500/20"
    case "LOW": return "bg-emerald-500/10 border-emerald-500/20"
    default: return "bg-muted/50 border-border"
  }
}

function approvalBadgeVariant(status: string) {
  switch (status) {
    case "APPROVED": return "default"
    case "REVISION_REQUESTED": return "destructive"
    default: return "secondary"
  }
}

function chanceLabel(c: ApiRiskChance) {
  return c.charAt(0) + c.slice(1).toLowerCase()
}

function riskStatusLabel(risk: ApiRisk) {
  if (risk.status === "RESOLVED" && risk.approvalStatus === "PENDING") return "Resolution review"
  if (risk.status === "OPEN" && risk.approvalStatus === "PENDING") return "Awaiting TA"
  if (risk.approvalStatus === "REVISION_REQUESTED") return "Needs revision"
  return risk.status.charAt(0) + risk.status.slice(1).toLowerCase()
}

function approvalLabel(risk: ApiRisk) {
  if (risk.status === "RESOLVED" && risk.approvalStatus === "PENDING") return "Supervisor review"
  if (risk.approvalStatus === "PENDING") return "Pending TA review"
  if (risk.approvalStatus === "APPROVED" && risk.status === "RESOLVED") return "Resolution confirmed"
  if (risk.approvalStatus === "APPROVED") return "Approved"
  return "Revision requested"
}

function userDisplayName(user: ApiTeamUser) {
  return user.fullName || `${user.firstName} ${user.lastName}`.trim() || user.email
}

function compactUserName(user: { fullName?: string; firstName?: string; lastName?: string; name?: string; email?: string }) {
  return user.fullName || user.name || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || "Team member"
}

function requiredMessage(label: string) {
  return `${label} is required for this action.`
}

function fieldErrorClass(message?: string) {
  return message ? "border-destructive focus-visible:ring-destructive" : ""
}

function labelErrorClass(message?: string) {
  return message ? "text-destructive" : ""
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 break-words text-[10px] font-medium leading-4 text-destructive">{message}</p>
}

function appendMonitoringUpdate(existingNotes: string, update: string, authorName?: string) {
  const trimmedUpdate = update.trim()
  if (!trimmedUpdate) return existingNotes.trim()

  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
  const heading = `[${formatter.format(new Date())}${authorName ? ` - ${authorName}` : ""}]`
  return [existingNotes.trim(), `${heading}\n${trimmedUpdate}`].filter(Boolean).join("\n\n")
}

export default function RiskManagementPage() {
  const { currentUser } = useAuthStore()
  const isLeader = currentUser?.role === "leader"
  const isStudentRole = currentUser?.role === "leader" || currentUser?.role === "member"
  const { data: myTeamState } = useMyTeamState(isStudentRole)
  const [risks, setRisks] = useState<ApiRisk[]>([])
  const [myProposal, setMyProposal] = useState<ApiProposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState<ApiRiskStatus | "ALL">("ALL")

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addForm, setAddForm] = useState({ title: "", description: "", category: "", chance: "" as ApiRiskChance | "", impact: "" as ApiRiskChance | "", mitigation: "", monitorUserId: "" })
  const [addErrors, setAddErrors] = useState<AddRiskErrors>({})
  const [addLoading, setAddLoading] = useState(false)

  const [editingRisk, setEditingRisk] = useState<ApiRisk | null>(null)
  const [editForm, setEditForm] = useState({ title: "", description: "", category: "", chance: "" as ApiRiskChance | "", impact: "" as ApiRiskChance | "", status: "" as ApiRiskStatus | "", mitigation: "", monitoringNotes: "", monitoringUpdate: "", resolutionNotes: "", monitorUserId: "" })
  const [editErrors, setEditErrors] = useState<EditRiskErrors>({})
  const [editLoading, setEditLoading] = useState(false)

  const [approvingRisk, setApprovingRisk] = useState<ApiRisk | null>(null)
  const [approveForm, setApproveForm] = useState({ severity: "" as ApiRiskSeverity | "", approvalNote: "" })
  const [approveErrors, setApproveErrors] = useState<ApproveRiskErrors>({})
  const [approveLoading, setApproveLoading] = useState(false)

  const [revisionRisk, setRevisionRisk] = useState<ApiRisk | null>(null)
  const [revisionNote, setRevisionNote] = useState("")
  const [revisionLoading, setRevisionLoading] = useState(false)

  const teamRoster = useMemo<ApiTeamUser[]>(() => {
    const team = myTeamState?.team
    if (!team) return []

    const seen = new Set<string>()
    return [team.leader, ...team.members.map(member => member.user)].filter((user) => {
      if (!user || seen.has(user.id)) return false
      seen.add(user.id)
      return true
    })
  }, [myTeamState?.team])

  const monitorOptions = useMemo(() => {
    const options = teamRoster.map(user => ({ id: user.id, label: userDisplayName(user) }))

    if (isLeader && currentUser?.id && !options.some(option => option.id === currentUser.id)) {
      options.unshift({ id: currentUser.id, label: compactUserName(currentUser) })
    }

    return options
  }, [currentUser, isLeader, teamRoster])

  function openAddDialog() {
    setAddErrors({})
    setAddForm(form => ({
      ...form,
      monitorUserId: form.monitorUserId || currentUser?.id || monitorOptions[0]?.id || "",
    }))
    setShowAddDialog(true)
  }

  async function loadRisks() {
    setLoading(true)
    setError("")
    try {
      const data = await risksApi.list()
      setRisks(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load risks"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRisks() }, [])

  useEffect(() => {
    if (!isStudentRole) return
    proposalsApi.getMine()
      .then(setMyProposal)
      .catch(() => setMyProposal(null))
  }, [isStudentRole])

  async function handleCreate() {
    const nextErrors: AddRiskErrors = {}
    if (!addForm.title.trim()) nextErrors.title = requiredMessage("Title")
    if (!addForm.description.trim()) nextErrors.description = requiredMessage("Description")
    if (!addForm.category) nextErrors.category = requiredMessage("Category")
    if (!addForm.chance) nextErrors.chance = requiredMessage("Chance")
    if (!addForm.impact) nextErrors.impact = requiredMessage("Impact")
    if (!addForm.monitorUserId) nextErrors.monitorUserId = requiredMessage("Monitor")

    setAddErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please complete the required fields highlighted in red")
      return
    }

    setAddLoading(true)
    try {
      const created = await risksApi.create({
        title: addForm.title.trim(),
        description: addForm.description.trim(),
        category: addForm.category,
        chance: addForm.chance as ApiRiskChance,
        impact: addForm.impact as ApiRiskChance,
        mitigation: addForm.mitigation.trim() || undefined,
        monitorUserId: addForm.monitorUserId,
      })
      setRisks(prev => [created, ...prev])
      setShowAddDialog(false)
      setAddErrors({})
      setAddForm({ title: "", description: "", category: "", chance: "", impact: "", mitigation: "", monitorUserId: "" })
      toast.success("Risk added successfully")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add risk")
    } finally {
      setAddLoading(false)
    }
  }

  function openEdit(risk: ApiRisk, nextStatus?: ApiRiskStatus) {
    const status = nextStatus ?? (risk.approvalStatus === "APPROVED" && risk.status === "OPEN" ? "MONITORING" : risk.status)

    setEditingRisk(risk)
    setEditErrors({})
    setEditForm({
      title: risk.title,
      description: risk.description,
      category: risk.category,
      chance: risk.chance,
      impact: risk.impact,
      status,
      mitigation: risk.mitigation,
      monitoringNotes: risk.monitoringNotes,
      monitoringUpdate: "",
      resolutionNotes: risk.resolutionNotes,
      monitorUserId: risk.monitor?.id ?? "",
    })
  }

  function openResolutionReview(risk: ApiRisk) {
    openEdit(risk, "RESOLVED")
  }

  async function handleEdit() {
    if (!editingRisk) return
    const canManage = editingRisk.permissions.canEdit
    const nextErrors: EditRiskErrors = {}
    if (canManage && !editForm.monitorUserId) nextErrors.monitorUserId = requiredMessage("Monitor")
    if (editForm.status === "RESOLVED" && !editForm.resolutionNotes.trim()) {
      nextErrors.resolutionNotes = requiredMessage("Resolution notes")
    }

    setEditErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please complete the required fields highlighted in red")
      return
    }

    setEditLoading(true)
    try {
      const monitoringNotes = appendMonitoringUpdate(editForm.monitoringNotes, editForm.monitoringUpdate, currentUser?.name)
      const payload = canManage
        ? {
            title: editForm.title.trim() || undefined,
            description: editForm.description.trim() || undefined,
            category: editForm.category || undefined,
            chance: (editForm.chance as ApiRiskChance) || undefined,
            impact: (editForm.impact as ApiRiskChance) || undefined,
            status: (editForm.status as ApiRiskStatus) || undefined,
            mitigation: editForm.mitigation.trim() || undefined,
            monitoringNotes: monitoringNotes || undefined,
            resolutionNotes: editForm.resolutionNotes.trim() || undefined,
            monitorUserId: editForm.monitorUserId,
          }
        : {
            chance: (editForm.chance as ApiRiskChance) || undefined,
            status: (editForm.status as ApiRiskStatus) || undefined,
            monitoringNotes: monitoringNotes || undefined,
            resolutionNotes: editForm.resolutionNotes.trim() || undefined,
          }
      const updated = await risksApi.update(editingRisk.id, payload)
      setRisks(prev => prev.map(r => r.id === updated.id ? updated : r))
      setEditingRisk(null)
      setEditErrors({})
      toast.success(editForm.status === "RESOLVED" ? "Risk submitted for supervisor review" : "Risk updated")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update risk")
    } finally {
      setEditLoading(false)
    }
  }

  async function handleApprove() {
    if (!approvingRisk) return
    const nextErrors: ApproveRiskErrors = {}
    if (approvingRisk.status !== "RESOLVED" && !approveForm.severity) {
      nextErrors.severity = requiredMessage("Severity")
    }

    setApproveErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please complete the required fields highlighted in red")
      return
    }

    setApproveLoading(true)
    try {
      const updated = await risksApi.approve(approvingRisk.id, {
        severity: (approveForm.severity as ApiRiskSeverity) || undefined,
        approvalNote: approveForm.approvalNote.trim() || undefined,
      })
      setRisks(prev => prev.map(r => r.id === updated.id ? updated : r))
      setApprovingRisk(null)
      setApproveForm({ severity: "", approvalNote: "" })
      setApproveErrors({})
      toast.success(approvingRisk.status === "RESOLVED" ? "Resolution confirmed" : "Risk approved for monitoring")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to approve risk")
    } finally {
      setApproveLoading(false)
    }
  }

  async function handleRequestRevision() {
    if (!revisionRisk || !revisionNote.trim()) {
      toast.error("Please provide a note explaining what needs revision")
      return
    }
    setRevisionLoading(true)
    try {
      const updated = await risksApi.requestRevision(revisionRisk.id, { approvalNote: revisionNote.trim() })
      setRisks(prev => prev.map(r => r.id === updated.id ? updated : r))
      setRevisionRisk(null)
      setRevisionNote("")
      toast.success("Revision requested")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to request revision")
    } finally {
      setRevisionLoading(false)
    }
  }

  const scopeToAssignedMonitor = currentUser?.role !== "leader" && currentUser?.role !== "admin" && currentUser?.role !== "doctor" && currentUser?.role !== "ta"
  const visibleRisks = scopeToAssignedMonitor
    ? risks.filter(r => r.monitor?.id === currentUser?.id)
    : risks
  const filtered = statusFilter === "ALL" ? visibleRisks : visibleRisks.filter(r => r.status === statusFilter)
  const hasRoleFilteredRisks = scopeToAssignedMonitor
  const proposalApproved = myProposal?.status === "APPROVED"
  const showPreliminaryRiskBanner = isStudentRole && !proposalApproved

  const countBySeverity = (s: ApiRiskSeverity) => visibleRisks.filter(r => r.severity === s).length
  const editingCanManage = Boolean(editingRisk?.permissions.canEdit)
  const editingCanMonitor = Boolean(editingRisk?.permissions.canMonitor)
  const editStatusOptions = editingRisk?.approvalStatus === "APPROVED" ? (["MONITORING", "RESOLVED"] as ApiRiskStatus[]) : ([editingRisk?.status ?? "OPEN"] as ApiRiskStatus[])
  const isResolutionReviewMode = editingRisk?.approvalStatus === "APPROVED" && editForm.status === "RESOLVED"
  const canAskForReview = (risk: ApiRisk) =>
    (risk.permissions.canMonitor || risk.monitor?.id === currentUser?.id) &&
    risk.status !== "RESOLVED" &&
    risk.approvalStatus === "APPROVED"

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        {/* Main Header & Summary Card */}
        <Card className="border-none shadow-lg bg-gradient-to-br from-card to-muted/30 overflow-hidden relative">
          <div className="absolute -top-12 -right-12 p-12 opacity-[0.03] pointer-events-none">
            <AlertTriangle className="w-80 h-80" />
          </div>
          
          <CardContent className="p-5 md:p-6 space-y-6 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">
                  Risk Management
                </h1>
              </div>
              {isLeader ? (
                <Button className="shadow-md hover:shadow-lg transition-all" onClick={openAddDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Risk
                </Button>
              ) : null}
            </div>

            {showPreliminaryRiskBanner && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 flex gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <h2 className="font-semibold text-sm text-amber-700 dark:text-amber-500">Preliminary risk planning</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    You can log risks while the proposal is being prepared or reviewed. Formal TA approval, monitoring, and resolution review unlock after the doctor approves the proposal.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as ApiRiskSeverity[]).map(s => (
                <div key={s} className={`rounded-xl border shadow-sm transition-all hover:-translate-y-1 hover:shadow-md flex flex-col items-center justify-center p-4 ${severityBg(s)}`}>
                  <div className={`text-3xl font-black mb-1 ${severityColor(s)}`}>{countBySeverity(s)}</div>
                  <div className={`text-[11px] font-bold tracking-widest uppercase ${severityColor(s)} opacity-90`}>{s}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {(["ALL", "OPEN", "MONITORING", "RESOLVED"] as const).map(s => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>

        {/* Risk List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={loadRisks}>Try again</Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-1">No risks found</h3>
              <p className="text-sm text-muted-foreground">
                {hasRoleFilteredRisks
                  ? "No risks are assigned to you for monitoring."
                  : statusFilter === "ALL" ? "No risks have been added yet." : `No risks with status "${statusFilter.toLowerCase()}".`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map((risk, index) => (
              <motion.div
                key={risk.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`border-2 ${severityBg(risk.severity)}`}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-full ${severityBg(risk.severity)} flex items-center justify-center`}>
                          <AlertTriangle className={`w-6 h-6 ${severityColor(risk.severity)}`} />
                        </div>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-lg">{risk.title}</h3>
                            <p className="text-sm text-muted-foreground">{risk.description}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 shrink-0">
                            <Badge variant="outline">{risk.category}</Badge>
                            {risk.severity && (
                              <Badge className={`${severityColor(risk.severity)} border`} variant="outline">
                                {risk.severity.charAt(0) + risk.severity.slice(1).toLowerCase()}
                              </Badge>
                            )}
                            <Badge variant={approvalBadgeVariant(risk.approvalStatus)}>
                              {approvalLabel(risk)}
                            </Badge>
                            {risk.isPreliminary && (
                              <Badge variant="outline" className="border-amber-500/30 text-amber-600">
                                Preliminary
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                          <div><span className="text-muted-foreground">Chance: </span><span className="font-medium">{chanceLabel(risk.chance)}</span></div>
                          <div><span className="text-muted-foreground">Impact: </span><span className="font-medium">{chanceLabel(risk.impact)}</span></div>
                          <div><span className="text-muted-foreground">Status: </span><Badge variant="secondary">{riskStatusLabel(risk)}</Badge></div>
                          {risk.createdBy && <div><span className="text-muted-foreground">By: </span><span className="font-medium">{risk.createdBy.fullName}</span></div>}
                          {risk.monitor && <div><span className="text-muted-foreground">Monitor: </span><span className="font-medium">{risk.monitor.fullName}</span></div>}
                        </div>
                        {risk.mitigation && (
                          <div className="bg-background/50 rounded-lg p-3">
                            <p className="text-sm font-medium mb-1">Mitigation:</p>
                            <p className="text-sm text-muted-foreground">{risk.mitigation}</p>
                          </div>
                        )}
                        {risk.approvalNote && (
                          <div className="bg-background/50 rounded-lg p-3">
                            <p className="text-sm font-medium mb-1">Reviewer note:</p>
                            <p className="text-sm text-muted-foreground">{risk.approvalNote}</p>
                          </div>
                        )}
                        {risk.monitoringNotes && (
                          <div className="bg-background/50 rounded-lg p-3">
                            <p className="text-sm font-medium mb-1">Monitoring notes:</p>
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{risk.monitoringNotes}</p>
                          </div>
                        )}
                        {risk.resolutionNotes && (
                          <div className="bg-background/50 rounded-lg p-3">
                            <p className="text-sm font-medium mb-1">Resolution notes:</p>
                            <p className="text-sm text-muted-foreground">{risk.resolutionNotes}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex md:flex-col gap-2 shrink-0">
                        {risk.permissions.canEdit && (
                          <Button variant="outline" size="sm" title="Edit risk" onClick={() => openEdit(risk)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {!risk.permissions.canEdit && risk.permissions.canMonitor && (
                          <Button variant="outline" size="sm" title="Update monitoring" onClick={() => openEdit(risk)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {canAskForReview(risk) && (
                          <Button variant="outline" size="sm" title="Ask doctor to review this risk" className="gap-1.5 text-blue-600 border-blue-600/30 hover:bg-blue-600/10 hover:text-blue-700 dark:hover:text-blue-400" onClick={() => openResolutionReview(risk)}>
                            <Send className="w-4 h-4" />
                            <span>Ask Review</span>
                          </Button>
                        )}
                        {risk.permissions.canApprove && risk.approvalStatus !== "APPROVED" && (
                          <Button variant="outline" size="sm" title={risk.status === "RESOLVED" ? "Confirm resolution" : "Approve risk"} className="text-emerald-600 border-emerald-600/30 hover:bg-emerald-600/10 hover:text-emerald-700 dark:hover:text-emerald-400" onClick={() => { setApprovingRisk(risk); setApproveErrors({}); setApproveForm({ severity: risk.severity ?? "", approvalNote: "" }) }}>
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        {risk.permissions.canRequestRevision && risk.approvalStatus === "PENDING" && (
                          <Button variant="outline" size="sm" title={risk.status === "RESOLVED" ? "Keep monitoring" : "Request revision"} className="text-orange-600 border-orange-600/30 hover:bg-orange-600/10 hover:text-orange-700 dark:hover:text-orange-400" onClick={() => { setRevisionRisk(risk); setRevisionNote("") }}>
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Add Risk Dialog */}
      <Dialog open={showAddDialog} onOpenChange={open => { setShowAddDialog(open); if (!open) setAddErrors({}) }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Team Risk</DialogTitle>
            <DialogDescription>
              Document the risk and assign who will monitor it. Approval starts after the project proposal is approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className={labelErrorClass(addErrors.title)}>Title *</Label>
              <Input
                aria-invalid={Boolean(addErrors.title)}
                className={`mt-1.5 ${fieldErrorClass(addErrors.title)}`}
                placeholder="Brief description of the risk"
                value={addForm.title}
                onChange={e => { setAddForm(f => ({ ...f, title: e.target.value })); setAddErrors(errors => ({ ...errors, title: undefined })) }}
              />
              <FieldError message={addErrors.title} />
            </div>
            <div>
              <Label className={labelErrorClass(addErrors.description)}>Description *</Label>
              <Textarea
                aria-invalid={Boolean(addErrors.description)}
                className={`mt-1.5 ${fieldErrorClass(addErrors.description)}`}
                placeholder="Detailed risk description"
                rows={3}
                value={addForm.description}
                onChange={e => { setAddForm(f => ({ ...f, description: e.target.value })); setAddErrors(errors => ({ ...errors, description: undefined })) }}
              />
              <FieldError message={addErrors.description} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label className={labelErrorClass(addErrors.category)}>Category *</Label>
                <Select value={addForm.category} onValueChange={v => { setAddForm(f => ({ ...f, category: v })); setAddErrors(errors => ({ ...errors, category: undefined })) }}>
                  <SelectTrigger aria-invalid={Boolean(addErrors.category)} className={`mt-1.5 w-full ${fieldErrorClass(addErrors.category)}`}><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <FieldError message={addErrors.category} />
              </div>
              <div>
                <Label className={labelErrorClass(addErrors.chance)}>Chance *</Label>
                <Select value={addForm.chance} onValueChange={v => { setAddForm(f => ({ ...f, chance: v as ApiRiskChance })); setAddErrors(errors => ({ ...errors, chance: undefined })) }}>
                  <SelectTrigger aria-invalid={Boolean(addErrors.chance)} className={`mt-1.5 w-full ${fieldErrorClass(addErrors.chance)}`}><SelectValue placeholder="Select chance" /></SelectTrigger>
                  <SelectContent>{CHANCE_OPTIONS.map(c => <SelectItem key={c} value={c}>{chanceLabel(c)}</SelectItem>)}</SelectContent>
                </Select>
                <FieldError message={addErrors.chance} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label className={labelErrorClass(addErrors.impact)}>Impact *</Label>
                <Select value={addForm.impact} onValueChange={v => { setAddForm(f => ({ ...f, impact: v as ApiRiskChance })); setAddErrors(errors => ({ ...errors, impact: undefined })) }}>
                  <SelectTrigger aria-invalid={Boolean(addErrors.impact)} className={`mt-1.5 w-full ${fieldErrorClass(addErrors.impact)}`}><SelectValue placeholder="Select impact" /></SelectTrigger>
                  <SelectContent>{CHANCE_OPTIONS.map(c => <SelectItem key={c} value={c}>{chanceLabel(c)}</SelectItem>)}</SelectContent>
                </Select>
                <FieldError message={addErrors.impact} />
              </div>
              <div>
                <Label className={labelErrorClass(addErrors.monitorUserId)}>Monitor *</Label>
                <Select value={addForm.monitorUserId} onValueChange={v => { setAddForm(f => ({ ...f, monitorUserId: v })); setAddErrors(errors => ({ ...errors, monitorUserId: undefined })) }}>
                  <SelectTrigger aria-invalid={Boolean(addErrors.monitorUserId)} className={`mt-1.5 w-full ${fieldErrorClass(addErrors.monitorUserId)}`}><SelectValue placeholder="Choose monitor" /></SelectTrigger>
                  <SelectContent>
                    {monitorOptions.map(user => <SelectItem key={user.id} value={user.id}>{user.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError message={addErrors.monitorUserId} />
              </div>
            </div>
            <div>
              <Label>Mitigation</Label>
              <Textarea className="mt-1.5" rows={2} placeholder="How will you mitigate this?" value={addForm.mitigation} onChange={e => setAddForm(f => ({ ...f, mitigation: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={addLoading}>
              {addLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Risk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Risk Dialog */}
      <Dialog open={!!editingRisk} onOpenChange={open => { if (!open) { setEditingRisk(null); setEditErrors({}) } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isResolutionReviewMode ? "Ask Doctor for Review" : editingCanManage ? "Edit Risk" : "Monitor Risk"}</DialogTitle>
            <DialogDescription>
              {isResolutionReviewMode
                ? "Submit why this risk is no longer a threat so the doctor can confirm whether to resolve it or keep monitoring"
                : editingCanManage
                  ? "Update risk details and monitor assignment"
                  : "Update monitoring progress or submit this risk for supervisor review"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editingCanManage && (
              <>
                <div>
                  <Label>Title</Label>
                  <Input className="mt-1.5" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea className="mt-1.5" rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Category</Label>
                    <Select value={editForm.category} onValueChange={v => setEditForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger className="mt-1.5 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={labelErrorClass(editErrors.monitorUserId)}>Monitor *</Label>
                    <Select value={editForm.monitorUserId} onValueChange={v => { setEditForm(f => ({ ...f, monitorUserId: v })); setEditErrors(errors => ({ ...errors, monitorUserId: undefined })) }}>
                      <SelectTrigger aria-invalid={Boolean(editErrors.monitorUserId)} className={`mt-1.5 w-full ${fieldErrorClass(editErrors.monitorUserId)}`}><SelectValue placeholder="Choose monitor" /></SelectTrigger>
                      <SelectContent>
                        {monitorOptions.map(user => <SelectItem key={user.id} value={user.id}>{user.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FieldError message={editErrors.monitorUserId} />
                  </div>
                </div>
              </>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Chance</Label>
                <Select value={editForm.chance} onValueChange={v => setEditForm(f => ({ ...f, chance: v as ApiRiskChance }))}>
                  <SelectTrigger className="mt-1.5 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{CHANCE_OPTIONS.map(c => <SelectItem key={c} value={c}>{chanceLabel(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v as ApiRiskStatus }))}>
                  <SelectTrigger className="mt-1.5 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{editStatusOptions.map(s => <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {editingCanManage && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Impact</Label>
                  <Select value={editForm.impact} onValueChange={v => setEditForm(f => ({ ...f, impact: v as ApiRiskChance }))}>
                    <SelectTrigger className="mt-1.5 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{CHANCE_OPTIONS.map(c => <SelectItem key={c} value={c}>{chanceLabel(c)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mitigation</Label>
                  <Textarea className="mt-1.5" rows={2} value={editForm.mitigation} onChange={e => setEditForm(f => ({ ...f, mitigation: e.target.value }))} />
                </div>
              </div>
            )}
            {editingCanMonitor && editForm.status !== "OPEN" && (
              <div className="space-y-3">
                {editForm.monitoringNotes.trim() && (
                  <div className="rounded-md border bg-background/50 p-3">
                    <p className="text-sm font-medium">Previous monitoring updates</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{editForm.monitoringNotes}</p>
                  </div>
                )}
                <div>
                  <Label>Add Monitoring Update</Label>
                  <Textarea
                    className="mt-1.5"
                    rows={3}
                    placeholder="Add what changed, what was checked, or what the team should watch next..."
                    value={editForm.monitoringUpdate}
                    onChange={e => setEditForm(f => ({ ...f, monitoringUpdate: e.target.value }))}
                  />
                </div>
              </div>
            )}
            {editForm.status === "RESOLVED" && (
              <div>
                <Label className={labelErrorClass(editErrors.resolutionNotes)}>Resolution Notes *</Label>
                <Textarea
                  aria-invalid={Boolean(editErrors.resolutionNotes)}
                  className={`mt-1.5 ${fieldErrorClass(editErrors.resolutionNotes)}`}
                  rows={2}
                  value={editForm.resolutionNotes}
                  onChange={e => { setEditForm(f => ({ ...f, resolutionNotes: e.target.value })); setEditErrors(errors => ({ ...errors, resolutionNotes: undefined })) }}
                />
                <FieldError message={editErrors.resolutionNotes} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRisk(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editLoading}>
              {editLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editForm.status === "RESOLVED" ? "Ask Doctor to Review" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={!!approvingRisk} onOpenChange={open => { if (!open) { setApprovingRisk(null); setApproveErrors({}) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{approvingRisk?.status === "RESOLVED" ? "Confirm Resolution" : "Approve Risk"}</DialogTitle>
            <DialogDescription>
              {approvingRisk?.status === "RESOLVED"
                ? "Confirm that this risk is no longer active for the project"
                : "Set the official severity and move this risk into monitoring"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className={labelErrorClass(approveErrors.severity)}>Severity {approvingRisk?.status === "RESOLVED" ? "" : "*"}</Label>
              <Select value={approveForm.severity} onValueChange={v => { setApproveForm(f => ({ ...f, severity: v as ApiRiskSeverity })); setApproveErrors(errors => ({ ...errors, severity: undefined })) }}>
                <SelectTrigger aria-invalid={Boolean(approveErrors.severity)} className={`mt-1.5 w-full ${fieldErrorClass(approveErrors.severity)}`}><SelectValue placeholder="Select severity" /></SelectTrigger>
                <SelectContent>{SEVERITY_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
              <FieldError message={approveErrors.severity} />
            </div>
            <div>
              <Label>{approvingRisk?.status === "RESOLVED" ? "Resolution Note (optional)" : "Approval Note (optional)"}</Label>
              <Textarea className="mt-1.5" rows={3} placeholder="Add a note for the team..." value={approveForm.approvalNote} onChange={e => setApproveForm(f => ({ ...f, approvalNote: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovingRisk(null)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={approveLoading} className="bg-green-600 hover:bg-green-700">
              {approveLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {approvingRisk?.status === "RESOLVED" ? "Confirm Resolved" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Revision Dialog */}
      <Dialog open={!!revisionRisk} onOpenChange={open => { if (!open) setRevisionRisk(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{revisionRisk?.status === "RESOLVED" ? "Keep Monitoring" : "Request Revision"}</DialogTitle>
            <DialogDescription>
              {revisionRisk?.status === "RESOLVED"
                ? "Explain why this risk should remain under monitoring"
                : "Ask the team to revise this risk assessment"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{revisionRisk?.status === "RESOLVED" ? "Monitoring Note *" : "Revision Note *"}</Label>
              <Textarea className="mt-1.5" rows={4} placeholder={revisionRisk?.status === "RESOLVED" ? "Explain what the team should keep watching..." : "Explain what needs to be revised..."} value={revisionNote} onChange={e => setRevisionNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisionRisk(null)}>Cancel</Button>
            <Button onClick={handleRequestRevision} disabled={revisionLoading} variant="destructive">
              {revisionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {revisionRisk?.status === "RESOLVED" ? "Keep Monitoring" : "Request Revision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
