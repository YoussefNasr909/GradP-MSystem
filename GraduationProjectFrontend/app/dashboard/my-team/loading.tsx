import { Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 xl:p-8">
      {/* Spinner banner */}
      <div className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>Loading your team…</span>
      </div>

      {/* Hero card */}
      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-background shadow-sm">
        <div className="space-y-5 p-5 sm:p-6 md:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-10 w-72 sm:w-96" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full max-w-2xl" />
                <Skeleton className="h-4 w-3/4 max-w-lg" />
              </div>
            </div>
            <Skeleton className="h-11 w-44 shrink-0 rounded-xl" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-[24px] border border-border/60 p-4 space-y-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        {/* Main column */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-border/70 bg-background p-6 shadow-sm space-y-4">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3.5 w-64" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <div className="grid sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-background p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-3.5 w-56" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-border/60 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3.5 w-40" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Aside */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-border/70 bg-background p-6 shadow-sm space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-3.5 w-52" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3.5 w-32" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-2xl" />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-background p-6 shadow-sm space-y-4">
            <Skeleton className="h-6 w-36" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            </div>
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
