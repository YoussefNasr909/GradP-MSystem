"use client"

import { useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

type Variant = "destructive" | "warning" | "default"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Headline at the top of the dialog. */
  title: string
  /** Body copy — explain what's about to happen and any consequences. */
  description: string
  /** Label on the confirm button. Defaults to "Delete" for destructive variant. */
  confirmLabel?: string
  /** Label on the cancel button. Defaults to "Cancel". */
  cancelLabel?: string
  /** Visual styling — destructive (red) is the default for a delete confirm. */
  variant?: Variant
  /** Called when the user clicks the confirm button. Can be async; we'll keep
   *  the dialog open + show a spinner until the promise resolves. */
  onConfirm: () => void | Promise<void>
}

/**
 * Reusable confirmation dialog for destructive or irreversible actions.
 *
 * Replaces the native browser `confirm()` (which doesn't match our theme,
 * blocks the main thread, and looks unprofessional in screenshots). Sits
 * on top of the existing AlertDialog primitive.
 *
 * Usage:
 *
 *   const [open, setOpen] = useState(false)
 *
 *   <Button onClick={() => setOpen(true)}>Delete</Button>
 *   <ConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Delete this note?"
 *     description="The note is gone permanently. Other supervisors won't see it anymore."
 *     onConfirm={async () => { await api.delete(id); refresh() }}
 *   />
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  variant = "destructive",
  onConfirm,
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    setSubmitting(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  const resolvedLabel = confirmLabel ?? (variant === "destructive" ? "Delete" : "Confirm")

  const iconColorClass =
    variant === "destructive"
      ? "text-destructive bg-destructive/10"
      : variant === "warning"
        ? "text-amber-500 bg-amber-500/10"
        : "text-primary bg-primary/10"

  const confirmButtonClass =
    variant === "destructive"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive"
      : variant === "warning"
        ? "bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500"
        : ""

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next) }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", iconColorClass)}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription className="mt-1.5 leading-relaxed">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2">
          <AlertDialogCancel disabled={submitting}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); void handleConfirm() }}
            disabled={submitting}
            className={confirmButtonClass}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Working…
              </>
            ) : (
              resolvedLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
