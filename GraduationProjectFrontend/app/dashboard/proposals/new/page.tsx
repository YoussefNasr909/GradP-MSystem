"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AlertTriangle, CheckCircle2, Circle, FileText, Plus, X, ArrowLeft, Save, Send, Lock } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/lib/stores/auth-store"
import { proposalsApi } from "@/lib/api/proposals"
import type { ProposalBody } from "@/lib/api/proposals"

// ─── Chip Input ──────────────────────────────────────────────────────────────

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
    const trimmed = v.trim()
    if (!trimmed) return
    if (items.includes(trimmed)) {
      setV("")
      return
    }
    if (items.length >= max) {
      toast.error(`Max ${max} entries`)
      return
    }
    setItems([...items, trimmed])
    setV("")
  }

  function remove(i: number) {
    setItems(items.filter((_, idx) => idx !== i))
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
        <Input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add() }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <motion.div className="flex flex-wrap gap-1.5 mt-2" layout>
          {items.map((it, i) => (
            <motion.div
              key={`${it}-${i}`}
              layout
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <Badge variant="secondary" className="text-xs gap-1 pl-2 pr-1 py-1">
                {it}
                <button onClick={() => remove(i)} className="hover:text-destructive transition-colors p-0.5 rounded">
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

function getReadinessItems(body: ProposalBody) {
  return [
    { label: "Problem statement", done: body.problemStatement.trim().length >= 50 },
    { label: "Objectives", done: body.objectives.length > 0 },
    { label: "Scope", done: body.scope.trim().length >= 20 },
    { label: "Methodology / SDLC approach", done: body.methodology.trim().length >= 20 },
    { label: "Technology stack", done: body.technologies.length > 0 },
    { label: "Deliverables", done: body.deliverables.length > 0 },
  ]
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NewProposalPage() {
  const router = useRouter()
  const { currentUser } = useAuthStore()
  const isLeader = currentUser?.role === "leader"

  const [body, setBody] = useState<ProposalBody>({
    title: "",
    abstract: "",
    problemStatement: "",
    scope: "",
    methodology: "",
    timeline: "",
    objectives: [],
    technologies: [],
    deliverables: [],
  })
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function set<K extends keyof ProposalBody>(key: K, value: ProposalBody[K]) {
    setBody((prev) => ({ ...prev, [key]: value }))
  }

  function validate() {
    if (body.title.trim().length < 5)             return "Title must be at least 5 characters"
    if (body.abstract.trim().length < 50)         return "Abstract must be at least 50 characters"
    if (body.problemStatement.trim().length < 50) return "Problem statement must be at least 50 characters"
    if (body.scope.trim().length < 20)            return "Scope must be at least 20 characters"
    if (body.methodology.trim().length < 20)      return "Methodology must be at least 20 characters"
    if (body.objectives.length   < 1)             return "Add at least 1 objective"
    if (body.technologies.length < 1)             return "Add at least 1 technology"
    if (body.deliverables.length < 1)             return "Add at least 1 deliverable"
    return null
  }

  const readinessItems = getReadinessItems(body)
  const readinessComplete = readinessItems.filter((item) => item.done).length

  async function handleSaveDraft() {
    const err = validate()
    if (err) { toast.error(err); return }
    setSaving(true)
    try {
      const created = await proposalsApi.create(body)
      toast.success("Draft saved")
      router.push(`/dashboard/proposals/${created.id}`)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save draft")
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    const err = validate()
    if (err) { toast.error(err); return }
    setSubmitting(true)
    try {
      const created = await proposalsApi.create(body)
      const submitted = await proposalsApi.submit(created.id)
      toast.success("Proposal submitted for review")
      router.push(`/dashboard/proposals/${submitted.id}`)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit proposal")
    } finally {
      setSubmitting(false)
    }
  }

  if (!isLeader) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[60vh] flex items-center justify-center">
        <Card className="p-12 text-center max-w-md border-border/50">
          <Lock className="h-16 w-16 mx-auto mb-6 text-destructive" />
          <h2 className="text-2xl font-bold mb-3">Leader Only</h2>
          <p className="text-muted-foreground">Only the team leader can create a proposal.</p>
          <Button variant="outline" className="mt-6" onClick={() => router.back()}>Go back</Button>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
      </Button>

      <div className="rounded-2xl p-6 border border-border/50 bg-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5" />
        <div className="relative flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Create Project Proposal</h1>
            <p className="text-sm text-muted-foreground">Save as draft now, or submit for doctor review.</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <Card className="p-6 space-y-6 border-border/50">
        <div>
          <Label>Project Title</Label>
          <Input
            value={body.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. AI-Powered Personalized Learning Platform"
            className="mt-1.5"
            maxLength={200}
          />
        </div>

        <div>
          <Label>Abstract</Label>
          <Textarea
            value={body.abstract}
            onChange={(e) => set("abstract", e.target.value)}
            placeholder="A 2–3 paragraph summary of your project — what it does and why it matters."
            className="mt-1.5 resize-none"
            rows={5}
            maxLength={2000}
          />
          <p className="text-[10px] text-muted-foreground mt-1">{body.abstract.length}/2000</p>
        </div>

        <div>
          <Label>Problem Statement</Label>
          <Textarea
            value={body.problemStatement}
            onChange={(e) => set("problemStatement", e.target.value)}
            placeholder="What problem are you solving? Who suffers from it? Why is now the time?"
            className="mt-1.5 resize-none"
            rows={5}
            maxLength={3000}
          />
          <p className="text-[10px] text-muted-foreground mt-1">{body.problemStatement.length}/3000</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Label>Project Scope</Label>
            <Textarea
              value={body.scope}
              onChange={(e) => set("scope", e.target.value)}
              placeholder="What's included? What's explicitly out of scope?"
              className="mt-1.5 resize-none"
              rows={5}
              maxLength={3000}
            />
          </div>
          <div>
            <Label>Methodology</Label>
            <Textarea
              value={body.methodology}
              onChange={(e) => set("methodology", e.target.value)}
              placeholder="How will you build this? SDLC model, architecture, tools, processes."
              className="mt-1.5 resize-none"
              rows={5}
              maxLength={3000}
            />
          </div>
        </div>

        <ChipInput
          label="Objectives"
          items={body.objectives}
          setItems={(next) => set("objectives", next)}
          placeholder="e.g. Achieve 95% test coverage"
          max={15}
        />

        <ChipInput
          label="Technologies"
          items={body.technologies}
          setItems={(next) => set("technologies", next)}
          placeholder="e.g. React, Node.js, Postgres"
          max={30}
        />

        <ChipInput
          label="Deliverables"
          items={body.deliverables}
          setItems={(next) => set("deliverables", next)}
          placeholder="e.g. SRS document, MVP web app, final report"
          max={20}
        />

        <div>
          <Label>Timeline (optional)</Label>
          <Textarea
            value={body.timeline ?? ""}
            onChange={(e) => set("timeline", e.target.value)}
            placeholder="High-level milestones with target dates."
            className="mt-1.5 resize-none"
            rows={3}
            maxLength={2000}
          />
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Submission Readiness</h2>
            </div>
            <Badge variant={readinessComplete === readinessItems.length ? "default" : "secondary"}>
              {readinessComplete}/{readinessItems.length}
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {readinessItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/50" />
                )}
                <span className={!item.done ? "text-muted-foreground" : undefined}>{item.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Approval unlocks official SDLC submissions, phase advancement, and formal risk approval.
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-border/40">
          <Button variant="outline" onClick={() => void handleSaveDraft()} disabled={saving || submitting} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving…" : "Save as Draft"}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving || submitting} className="flex-1">
            <Send className="h-4 w-4 mr-2" />
            {submitting ? "Submitting…" : "Submit for Review"}
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}
