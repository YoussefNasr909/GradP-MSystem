import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Tone = "primary" | "blue" | "emerald" | "amber" | "rose" | "violet" | "slate"

const toneClasses: Record<Tone, { icon: string; soft: string; border: string }> = {
  primary: {
    icon: "bg-primary text-primary-foreground",
    soft: "bg-primary/10 text-primary",
    border: "border-primary/20",
  },
  blue: {
    icon: "bg-blue-500 text-white",
    soft: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    border: "border-blue-500/20",
  },
  emerald: {
    icon: "bg-emerald-500 text-white",
    soft: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/20",
  },
  amber: {
    icon: "bg-amber-500 text-white",
    soft: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    border: "border-amber-500/20",
  },
  rose: {
    icon: "bg-rose-500 text-white",
    soft: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    border: "border-rose-500/20",
  },
  violet: {
    icon: "bg-violet-500 text-white",
    soft: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    border: "border-violet-500/20",
  },
  slate: {
    icon: "bg-slate-600 text-white",
    soft: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
    border: "border-slate-500/20",
  },
}

export function DashboardPageHeader({
  title,
  description,
  icon: Icon,
  badge,
  meta,
  actions,
  tone = "primary",
  className,
}: {
  title: string
  description: string
  icon: LucideIcon
  badge?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  tone?: Tone
  className?: string
}) {
  const classes = toneClasses[tone]

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-primary/[0.07] via-background to-primary/[0.03] p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm", classes.icon)}>
              <Icon className="h-5 w-5" />
            </span>
            {badge}
            {meta}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}

export function DashboardMetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "primary",
  loading = false,
  className,
}: {
  label: string
  value: ReactNode
  description?: ReactNode
  icon: LucideIcon
  tone?: Tone
  loading?: boolean
  className?: string
}) {
  const classes = toneClasses[tone]

  return (
    <Card className={cn("h-full rounded-[18px] border-border/60 bg-card p-4 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
          <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground sm:text-3xl">
            {loading ? <span className="block h-8 w-20 animate-pulse rounded-md bg-muted" /> : value}
          </div>
        </div>
        <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border", classes.soft, classes.border)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {description ? <div className="mt-3 text-xs leading-5 text-muted-foreground">{description}</div> : null}
    </Card>
  )
}

export function DashboardStateCard({
  icon: Icon,
  title,
  description,
  action,
  tone = "primary",
  className,
}: {
  icon: LucideIcon
  title: string
  description: ReactNode
  action?: ReactNode
  tone?: Tone
  className?: string
}) {
  const classes = toneClasses[tone]

  return (
    <Card className={cn("rounded-[22px] border-dashed border-border/70 bg-card p-8 text-center shadow-sm", className)}>
      <span className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border", classes.soft, classes.border)}>
        <Icon className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Card>
  )
}
