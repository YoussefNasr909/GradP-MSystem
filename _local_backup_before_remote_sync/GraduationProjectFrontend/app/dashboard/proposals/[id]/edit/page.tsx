"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  FileText, Plus, X, ArrowLeft, Save, Send, Lock, AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/lib/stores/auth-store"
import { proposalsApi } from "@/lib/api/proposals"
import type { ApiProposal, ProposalBody } from "@/lib/api/proposals"

// Local chip input (same as new page)
function ChipInput({
  label, items, setItems, placeholder, max = 15, min = 1,
}: {
  label: string
  items: string[]
  setItems: (next: string[]) => void
  placeholder: string
  max?: number
  min?: number
}) {
  const [v, setV] = useState("")
  function add() {
    const t = v.trim()
    if (!t) return
    if (items.includes(t)) { setV(""); return }
    if (items.length >= max) { toast.error(`Max ${max}`); return }
    setItems([...items, t]); setV("")
  }
  return (
    <div>
      <Label className="flex items-center justify-between">
        <span>{label}</span>
        <span className="text-[10px] text-muted-foreground font-normal">
          {items.length}/{max} {items.length < min && `(min ${min})`}
        </span>
      </Label>
      <div className="flex gap-2 mt-1.5">
        <Input value={v} onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }}
          placeholder={placeholder} />
        <Button type="button" variant="outline" onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      {items.length > 0 && (
        <motion.div className="flex flex-wrap gap-1.5 mt-2" layout>
          {items.map((it, i) => (
            <motion.div key={`${it}-${i}`} layout
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}>
              <Badge variant="secondary" className="text-xs gap-1 pl-2 pr-1 py-1">
                {it}
                <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="hover:text-destructive transition-colors p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

export default function EditProposalPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { currentUser } = useAuthStore()

  const [proposal, setProposal] = useState<ApiProposal | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [body, setBody] = useState<ProposalBody | null>(null)
  const [saving, setSaving]     = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    proposalsApi.get(id)
      .then((p) => {
        setProposal(p)
        setBody({
          title: p.title,
          abstract: p.abstract,
          problemStatement: p.problemStatement,
          scope: p.scope,
          methodology: p.methodology,
          timeline: p.timeline ?? "",
          objectives: [...p.objectives],
          technologies: [...p.technologies],
          deliverables: [...p.deliverables],
        })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  function set<K extends keyof ProposalBody>(key: K, value: ProposalBody[K]) {
    setBody((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function validate(b: ProposalBody) {
    if (b.title.trim().length < 5)             return "Title must be at least 5 characters"
    if (b.abstract.trim().length < 50)         return "Abstract must be at least 50 characters"
    if (b.problemStatement.trim().length < 50) return "Problem statement must be at least 50 characters"
    if (b.scope.trim().length < 20)            return "Scope must be at least 20 characters"
    if (b.methodology.trim().length < 20)      return "Methodology must be at least 20 characters"
    if (b.objectives.length   < 1)             return "Add at least 1 objective"
    if (b.technologies.length < 1)             return "Add at least 1 technology"
    if (b.deliverables.length < 1)             return "Add at least 1 deliverable"
    return null
  }

  async function handleSave() {
    if (!body || !proposal) return
    const err = validate(body)
    if (err) { toast.error(err); return }
    setSaving(true)
    try {
      const updated = await proposalsApi.update(proposal.id, body)
      toast.success("Proposal saved")
      router.push(`/dashboard/proposals/${updated.id}`)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitForReview() {
    if (!body || !proposal) return
    const err = validate(body)
    if (err) { toast.error(err); return }
    setSubmitting(true)
    try {
      await proposalsApi.update(proposal.id, body)
      const submitted = await proposalsApi.submit(proposal.id)
      toast.success("Proposal submitted for review")
      router.push(`/dashboard/proposals/${submitted.id}`)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error || !proposal || !body) {
    return (
      <div className="max-w-md mx-auto p-6">
        <Card className="p-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">Proposal not found</h2>
          <Link href="/dashboard/proposals">
            <Button variant="outline" className="mt-2"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          </Link>
        </Card>
      </div>
    )
  }

  // Permission gate (mirrors backend)
  const isAuthor = proposal.team.leaderId === currentUser?.id
  const isAdmin  = currentUser?.role === "admin"
  const canEdit  = (isAuthor || isAdmin) && proposal.status !== "APPROVED"

  if (!canEdit) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto p-6">
        <Card className="p-12 text-center">
          <Lock className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">Can&apos;t edit</h2>
          <p className="text-muted-foreground text-sm mb-6">
            {proposal.status === "APPROVED"
              ? "Approved proposals cannot be edited."
              : "Only the team leader can edit this proposal."}
          </p>
          <Link href={`/dashboard/proposals/${proposal.id}`}>
            <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back to proposal</Button>
          </Link>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      <Link href={`/dashboard/proposals/${proposal.id}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Proposal
        </Button>
      </Link>

      <div className="rounded-2xl p-6 border border-border/50 bg-card">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Edit Proposal</h1>
            <p className="text-sm text-muted-foreground">
              {proposal.status === "REVISION_REQUESTED"
                ? "The doctor requested revisions — update and resubmit."
                : "Make changes and save your draft."}
            </p>
          </div>
        </div>
      </div>

      <Card className="p-6 space-y-6 border-border/50">
        <div>
          <Label>Project Title</Label>
          <Input value={body.title} onChange={(e) => set("title", e.target.value)} className="mt-1.5" maxLength={200} />
        </div>
        <div>
          <Label>Abstract</Label>
          <Textarea value={body.abstract} onChange={(e) => set("abstract", e.target.value)} className="mt-1.5 resize-none" rows={5} maxLength={2000} />
          <p className="text-[10px] text-muted-foreground mt-1">{body.abstract.length}/2000</p>
        </div>
        <div>
          <Label>Problem Statement</Label>
          <Textarea value={body.problemStatement} onChange={(e) => set("problemStatement", e.target.value)} className="mt-1.5 resize-none" rows={5} maxLength={3000} />
          <p className="text-[10px] text-muted-foreground mt-1">{body.problemStatement.length}/3000</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Label>Scope</Label>
            <Textarea value={body.scope} onChange={(e) => set("scope", e.target.value)} className="mt-1.5 resize-none" rows={5} maxLength={3000} />
          </div>
          <div>
            <Label>Methodology</Label>
            <Textarea value={body.methodology} onChange={(e) => set("methodology", e.target.value)} className="mt-1.5 resize-none" rows={5} maxLength={3000} />
          </div>
        </div>
        <ChipInput label="Objectives"   items={body.objectives}   setItems={(n) => set("objectives", n)}   placeholder="e.g. Achieve 95% test coverage" max={15} />
        <ChipInput label="Technologies" items={body.technologies} setItems={(n) => set("technologies", n)} placeholder="e.g. React, Node.js, Postgres" max={30} />
        <ChipInput label="Deliverables" items={body.deliverables} setItems={(n) => set("deliverables", n)} placeholder="e.g. SRS document, MVP web app"  max={20} />
        <div>
          <Label>Timeline (optional)</Label>
          <Textarea value={body.timeline ?? ""} onChange={(e) => set("timeline", e.target.value)} className="mt-1.5 resize-none" rows={3} maxLength={2000} />
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-border/40">
          <Button variant="outline" onClick={() => void handleSave()} disabled={saving || submitting} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving…" : "Save Changes"}
          </Button>
          {(proposal.status === "DRAFT" || proposal.status === "REVISION_REQUESTED" || proposal.status === "REJECTED") && (
            <Button onClick={() => void handleSubmitForReview()} disabled={saving || submitting} className="flex-1">
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Submitting…" : (proposal.status === "REVISION_REQUESTED" ? "Save & Resubmit" : "Save & Submit for Review")}
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  )
}
