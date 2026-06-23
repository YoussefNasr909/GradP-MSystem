"use client"

import { useMemo, useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RubricItem } from "@/lib/api/submissions"

/**
 * Sensible default rubric per deliverable type.
 * Doctors/TAs can edit before saving.
 */
const DEFAULT_RUBRICS: Record<string, RubricItem[]> = {
  SRS: [
    { name: "Problem Definition",   score: 0, maxScore: 20 },
    { name: "Functional Requirements",  score: 0, maxScore: 25 },
    { name: "Non-Functional Requirements", score: 0, maxScore: 15 },
    { name: "Use Cases",            score: 0, maxScore: 20 },
    { name: "Documentation Quality", score: 0, maxScore: 20 },
  ],
  UML: [
    { name: "Class Diagram",        score: 0, maxScore: 25 },
    { name: "Sequence Diagrams",    score: 0, maxScore: 20 },
    { name: "Activity Diagrams",    score: 0, maxScore: 20 },
    { name: "Database Schema",      score: 0, maxScore: 20 },
    { name: "Architecture Diagram", score: 0, maxScore: 15 },
  ],
  CODE: [
    { name: "Functionality",        score: 0, maxScore: 30 },
    { name: "Code Quality",         score: 0, maxScore: 20 },
    { name: "Test Coverage",        score: 0, maxScore: 15 },
    { name: "Documentation",        score: 0, maxScore: 15 },
    { name: "Git Hygiene",          score: 0, maxScore: 10 },
    { name: "Security",             score: 0, maxScore: 10 },
  ],
  PROTOTYPE: [
    { name: "UI/UX Quality",        score: 0, maxScore: 30 },
    { name: "Interactivity",        score: 0, maxScore: 25 },
    { name: "Coverage of Features", score: 0, maxScore: 25 },
    { name: "Design Consistency",   score: 0, maxScore: 20 },
  ],
  TEST_PLAN: [
    { name: "Test Strategy",        score: 0, maxScore: 20 },
    { name: "Unit Tests",           score: 0, maxScore: 25 },
    { name: "Integration Tests",    score: 0, maxScore: 20 },
    { name: "Edge Cases",           score: 0, maxScore: 20 },
    { name: "Documentation",        score: 0, maxScore: 15 },
  ],
  FINAL_REPORT: [
    { name: "Structure & Clarity",  score: 0, maxScore: 25 },
    { name: "Technical Depth",      score: 0, maxScore: 30 },
    { name: "Results & Analysis",   score: 0, maxScore: 25 },
    { name: "References",           score: 0, maxScore: 10 },
    { name: "Formatting",           score: 0, maxScore: 10 },
  ],
  PRESENTATION: [
    { name: "Content Coverage",     score: 0, maxScore: 30 },
    { name: "Slide Quality",        score: 0, maxScore: 20 },
    { name: "Delivery & Confidence",score: 0, maxScore: 25 },
    { name: "Q&A Handling",         score: 0, maxScore: 25 },
  ],
}

export function getDefaultRubric(deliverableType?: string): RubricItem[] {
  if (!deliverableType) return []
  return JSON.parse(JSON.stringify(DEFAULT_RUBRICS[deliverableType] ?? []))
}

interface Props {
  /** Initial rubric to render (e.g., from existing submission). */
  value: RubricItem[]
  /** Called every time the rubric changes. Parent uses this to know the total. */
  onChange: (next: RubricItem[]) => void
  /** Compute total grade out of 100 (scale to max). */
  onTotalChange?: (total: number) => void
  /** Whether to show the "Load default rubric" button + which type to load. */
  defaultRubricType?: string
  /** Compact = no add/delete UI, just inline numeric inputs. */
  compact?: boolean
}

/**
 * Inline rubric editor. Each line has a name, a score input, and a max.
 * Total updates live; the parent can wire it to its grade field.
 */
export function RubricEditor({ value, onChange, onTotalChange, defaultRubricType, compact = false }: Props) {
  const [items, setItems] = useState<RubricItem[]>(value)

  useEffect(() => {
    setItems(value)
  }, [value])

  // Recompute scaled total whenever items change.
  const { total, possible, scaled } = useMemo(() => {
    const total    = items.reduce((s, i) => s + (Number(i.score) || 0), 0)
    const possible = items.reduce((s, i) => s + (Number(i.maxScore) || 0), 0)
    const scaled   = possible > 0 ? Math.round((total / possible) * 100) : 0
    return { total, possible, scaled }
  }, [items])

  useEffect(() => {
    onTotalChange?.(scaled)
  }, [scaled, onTotalChange])

  function update(i: number, patch: Partial<RubricItem>) {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
    setItems(next)
    onChange(next)
  }

  function remove(i: number) {
    const next = items.filter((_, idx) => idx !== i)
    setItems(next)
    onChange(next)
  }

  function add() {
    const next = [...items, { name: "", score: 0, maxScore: 10 }]
    setItems(next)
    onChange(next)
  }

  function loadDefault() {
    if (!defaultRubricType) return
    const tpl = getDefaultRubric(defaultRubricType)
    setItems(tpl)
    onChange(tpl)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Rubric</Label>
        {defaultRubricType && DEFAULT_RUBRICS[defaultRubricType] && items.length === 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={loadDefault}
          >
            <Wand2 className="h-3 w-3 mr-1" /> Load {defaultRubricType} rubric
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {items.map((it, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-[1fr_70px_70px_auto] gap-2 items-center"
            >
              <Input
                placeholder="Criterion name"
                value={it.name}
                onChange={(e) => update(i, { name: e.target.value })}
                className="h-8 text-sm"
              />
              <Input
                type="number"
                min={0}
                max={it.maxScore}
                value={it.score}
                onChange={(e) => update(i, { score: Math.max(0, Math.min(it.maxScore, Number(e.target.value) || 0)) })}
                className="h-8 text-sm text-center tabular-nums"
              />
              <Input
                type="number"
                min={1}
                max={100}
                value={it.maxScore}
                onChange={(e) => update(i, { maxScore: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
                className="h-8 text-sm text-center tabular-nums"
              />
              {!compact && (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(i)}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {!compact && (
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={add}>
          <Plus className="h-3 w-3 mr-1" /> Add criterion
        </Button>
      )}

      {items.length > 0 && (
        <motion.div
          layout
          className={cn(
            "flex items-center justify-between rounded-lg border px-3 py-2 mt-2",
            scaled >= 90 && "border-green-500/30 bg-green-500/5",
            scaled >= 80 && scaled < 90 && "border-blue-500/30 bg-blue-500/5",
            scaled >= 70 && scaled < 80 && "border-amber-500/30 bg-amber-500/5",
            scaled >= 60 && scaled < 70 && "border-orange-500/30 bg-orange-500/5",
            scaled < 60 && "border-red-500/30 bg-red-500/5",
          )}
        >
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-mono">
              {total}/{possible}
            </Badge>
            <motion.span
              key={scaled}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-lg font-bold tabular-nums"
            >
              {scaled}<span className="text-xs text-muted-foreground">/100</span>
            </motion.span>
          </div>
        </motion.div>
      )}
    </div>
  )
}
