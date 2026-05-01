"use client"

import { useAuthStore } from "@/lib/stores/auth-store"
import { useEffect, useState } from "react"
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
import { Plus, TrendingUp, AlertTriangle, Edit, CheckCircle, RotateCcw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { risksApi } from "@/lib/api/risks"
import type { ApiRisk, ApiRiskChance, ApiRiskSeverity, ApiRiskStatus } from "@/lib/api/types"

const CATEGORIES = ["Technical", "People", "Project", "External", "Financial", "Legal"]
const CHANCE_OPTIONS: ApiRiskChance[] = ["LOW", "MEDIUM", "HIGH"]
const SEVERITY_OPTIONS: ApiRiskSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
const STATUS_OPTIONS: ApiRiskStatus[] = ["OPEN", "MONITORING", "RESOLVED"]

function severityColor(severity: ApiRiskSeverity | null) {
  switch (severity) {
    case "CRITICAL": return "text-red-500"
    case "HIGH": return "text-orange-500"
    case "MEDIUM": return "text-yellow-500"
    case "LOW": return "text-green-500"
    default: return "text-muted-foreground"
  }
}

function severityBg(severity: ApiRiskSeverity | null) {
  switch (severity) {
    case "CRITICAL": return "bg-red-500/10 border-red-500/20"
    case "HIGH": return "bg-orange-500/10 border-orange-500/20"
    case "MEDIUM": return "bg-yellow-500/10 border-yellow-500/20"
    case "LOW": return "bg-green-500/10 border-green-500/20"
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

export default function RiskManagementPage() {
  const { currentUser } = useAuthStore()
  const [risks, setRisks] = useState<ApiRisk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState<ApiRiskStatus | "ALL">("ALL")

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addForm, setAddForm] = useState({ title: "", description: "", category: "", chance: "" as ApiRiskChance | "", impact: "" as ApiRiskChance | "", mitigation: "" })
  const [addLoading, setAddLoading] = useState(false)

  const [editingRisk, setEditingRisk] = useState<ApiRisk | null>(null)
  const [editForm, setEditForm] = useState({ title: "", description: "", category: "", chance: "" as ApiRiskChance | "", impact: "" as ApiRiskChance | "", status: "" as ApiRiskStatus | "", mitigation: "", monitoringNotes: "", resolutionNotes: "" })
  const [editLoading, setEditLoading] = useState(false)

  const [approvingRisk, setApprovingRisk] = useState<ApiRisk | null>(null)
  const [approveForm, setApproveForm] = useState({ severity: "" as ApiRiskSeverity | "", approvalNote: "" })
  const [approveLoading, setApproveLoading] = useState(false)

  const [revisionRisk, setRevisionRisk] = useState<ApiRisk | null>(null)
  const [revisionNote, setRevisionNote] = useState("")
  const [revisionLoading, setRevisionLoading] = useState(false)

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

  async function handleCreate() {
    if (!addForm.title.trim() || !addForm.description.trim() || !addForm.category || !addForm.chance || !addForm.impact) {
      toast.error("Please fill in all required fields")
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
      })
      setRisks(prev => [created, ...prev])
      setShowAddDialog(false)
      setAddForm({ title: "", description: "", category: "", chance: "", impact: "", mitigation: "" })
      toast.success("Risk added successfully")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add risk")
    } finally {
      setAddLoading(false)
    }
  }

  function openEdit(risk: ApiRisk) {
    setEditingRisk(risk)
    setEditForm({
      title: risk.title,
      description: risk.description,
      category: risk.category,
      chance: risk.chance,
      impact: risk.impact,
      status: risk.status,
      mitigation: risk.mitigation,
      monitoringNotes: risk.monitoringNotes,
      resolutionNotes: risk.resolutionNotes,
    })
  }

  async function handleEdit() {
    if (!editingRisk) return
    setEditLoading(true)
    try {
      const updated = await risksApi.update(editingRisk.id, {
        title: editForm.title.trim() || undefined,
        description: editForm.description.trim() || undefined,
        category: editForm.category || undefined,
        chance: (editForm.chance as ApiRiskChance) || undefined,
        impact: (editForm.impact as ApiRiskChance) || undefined,
        status: (editForm.status as ApiRiskStatus) || undefined,
        mitigation: editForm.mitigation.trim() || undefined,
        monitoringNotes: editForm.monitoringNotes.trim() || undefined,
        resolutionNotes: editForm.resolutionNotes.trim() || undefined,
      })
      setRisks(prev => prev.map(r => r.id === updated.id ? updated : r))
      setEditingRisk(null)
      toast.success("Risk updated")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update risk")
    } finally {
      setEditLoading(false)
    }
  }

  async function handleApprove() {
    if (!approvingRisk || !approveForm.severity) {
      toast.error("Please select a severity level")
      return
    }
    setApproveLoading(true)
    try {
      const updated = await risksApi.approve(approvingRisk.id, {
        severity: approveForm.severity as ApiRiskSeverity,
        approvalNote: approveForm.approvalNote.trim() || undefined,
      })
      setRisks(prev => prev.map(r => r.id === updated.id ? updated : r))
      setApprovingRisk(null)
      setApproveForm({ severity: "", approvalNote: "" })
      toast.success("Risk approved")
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

  const filtered = statusFilter === "ALL" ? risks : risks.filter(r => r.status === statusFilter)

  const countBySeverity = (s: ApiRiskSeverity) => risks.filter(r => r.severity === s).length

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
              Risk Management
            </h1>
            <p className="text-muted-foreground mt-2">Identify, assess, and mitigate project risks</p>
          </div>
          {currentUser?.role === "leader" || currentUser?.role === "member" ? (
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Risk
            </Button>
          ) : null}
        </div>

        {/* Risk Matrix Summary */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Risk Matrix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as ApiRiskSeverity[]).map(s => (
                <Card key={s} className={`border ${severityBg(s)}`}>
                  <CardContent className="p-4 text-center">
                    <div className={`text-2xl font-bold ${severityColor(s)}`}>{countBySeverity(s)}</div>
                    <div className="text-sm text-muted-foreground capitalize">{s.charAt(0) + s.slice(1).toLowerCase()}</div>
                  </CardContent>
                </Card>
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
                {statusFilter === "ALL" ? "No risks have been added yet." : `No risks with status "${statusFilter.toLowerCase()}".`}
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
                              {risk.approvalStatus === "PENDING" ? "Pending approval" : risk.approvalStatus === "APPROVED" ? "Approved" : "Revision requested"}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div><span className="text-muted-foreground">Chance: </span><span className="font-medium">{chanceLabel(risk.chance)}</span></div>
                          <div><span className="text-muted-foreground">Impact: </span><span className="font-medium">{chanceLabel(risk.impact)}</span></div>
                          <div><span className="text-muted-foreground">Status: </span><Badge variant="secondary">{risk.status.charAt(0) + risk.status.slice(1).toLowerCase()}</Badge></div>
                          {risk.createdBy && <div><span className="text-muted-foreground">By: </span><span className="font-medium">{risk.createdBy.fullName}</span></div>}
                        </div>
                        {risk.mitigation && (
                          <div className="bg-background/50 rounded-lg p-3">
                            <p className="text-sm font-medium mb-1">Mitigation:</p>
                            <p className="text-sm text-muted-foreground">{risk.mitigation}</p>
                          </div>
                        )}
                        {risk.approvalNote && (
                          <div className="bg-background/50 rounded-lg p-3">
                            <p className="text-sm font-medium mb-1">Supervisor note:</p>
                            <p className="text-sm text-muted-foreground">{risk.approvalNote}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex md:flex-col gap-2 shrink-0">
                        {risk.permissions.canEdit && (
                          <Button variant="outline" size="sm" onClick={() => openEdit(risk)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {risk.permissions.canApprove && risk.approvalStatus !== "APPROVED" && (
                          <Button variant="outline" size="sm" className="text-green-600 border-green-600/30 hover:bg-green-600/10" onClick={() => { setApprovingRisk(risk); setApproveForm({ severity: risk.severity ?? "", approvalNote: "" }) }}>
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        {risk.permissions.canRequestRevision && risk.approvalStatus !== "REVISION_REQUESTED" && (
                          <Button variant="outline" size="sm" className="text-orange-500 border-orange-500/30 hover:bg-orange-500/10" onClick={() => { setRevisionRisk(risk); setRevisionNote("") }}>
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
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Risk</DialogTitle>
            <DialogDescription>Identify and document a project risk</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input className="mt-1.5" placeholder="Brief description of the risk" value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea className="mt-1.5" placeholder="Detailed risk description" rows={3} value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category *</Label>
                <Select value={addForm.category} onValueChange={v => setAddForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Chance *</Label>
                <Select value={addForm.chance} onValueChange={v => setAddForm(f => ({ ...f, chance: v as ApiRiskChance }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select chance" /></SelectTrigger>
                  <SelectContent>{CHANCE_OPTIONS.map(c => <SelectItem key={c} value={c}>{chanceLabel(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Impact *</Label>
                <Select value={addForm.impact} onValueChange={v => setAddForm(f => ({ ...f, impact: v as ApiRiskChance }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select impact" /></SelectTrigger>
                  <SelectContent>{CHANCE_OPTIONS.map(c => <SelectItem key={c} value={c}>{chanceLabel(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mitigation</Label>
                <Input className="mt-1.5" placeholder="How will you mitigate this?" value={addForm.mitigation} onChange={e => setAddForm(f => ({ ...f, mitigation: e.target.value }))} />
              </div>
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
      <Dialog open={!!editingRisk} onOpenChange={open => { if (!open) setEditingRisk(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Risk</DialogTitle>
            <DialogDescription>Update risk details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input className="mt-1.5" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1.5" rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={editForm.category} onValueChange={v => setEditForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v as ApiRiskStatus }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Chance</Label>
                <Select value={editForm.chance} onValueChange={v => setEditForm(f => ({ ...f, chance: v as ApiRiskChance }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{CHANCE_OPTIONS.map(c => <SelectItem key={c} value={c}>{chanceLabel(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Impact</Label>
                <Select value={editForm.impact} onValueChange={v => setEditForm(f => ({ ...f, impact: v as ApiRiskChance }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{CHANCE_OPTIONS.map(c => <SelectItem key={c} value={c}>{chanceLabel(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Mitigation</Label>
              <Textarea className="mt-1.5" rows={2} value={editForm.mitigation} onChange={e => setEditForm(f => ({ ...f, mitigation: e.target.value }))} />
            </div>
            {editForm.status === "MONITORING" && (
              <div>
                <Label>Monitoring Notes</Label>
                <Textarea className="mt-1.5" rows={2} value={editForm.monitoringNotes} onChange={e => setEditForm(f => ({ ...f, monitoringNotes: e.target.value }))} />
              </div>
            )}
            {editForm.status === "RESOLVED" && (
              <div>
                <Label>Resolution Notes</Label>
                <Textarea className="mt-1.5" rows={2} value={editForm.resolutionNotes} onChange={e => setEditForm(f => ({ ...f, resolutionNotes: e.target.value }))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRisk(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editLoading}>
              {editLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={!!approvingRisk} onOpenChange={open => { if (!open) setApprovingRisk(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Risk</DialogTitle>
            <DialogDescription>Set the official severity and approve this risk assessment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Severity *</Label>
              <Select value={approveForm.severity} onValueChange={v => setApproveForm(f => ({ ...f, severity: v as ApiRiskSeverity }))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select severity" /></SelectTrigger>
                <SelectContent>{SEVERITY_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Approval Note (optional)</Label>
              <Textarea className="mt-1.5" rows={3} placeholder="Add a note for the team..." value={approveForm.approvalNote} onChange={e => setApproveForm(f => ({ ...f, approvalNote: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovingRisk(null)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={approveLoading} className="bg-green-600 hover:bg-green-700">
              {approveLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Revision Dialog */}
      <Dialog open={!!revisionRisk} onOpenChange={open => { if (!open) setRevisionRisk(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
            <DialogDescription>Ask the team to revise this risk assessment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Revision Note *</Label>
              <Textarea className="mt-1.5" rows={4} placeholder="Explain what needs to be revised..." value={revisionNote} onChange={e => setRevisionNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisionRisk(null)}>Cancel</Button>
            <Button onClick={handleRequestRevision} disabled={revisionLoading} variant="destructive">
              {revisionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Request Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
