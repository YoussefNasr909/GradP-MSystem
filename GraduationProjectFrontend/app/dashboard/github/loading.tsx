import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 bg-muted-foreground/10" />
          <Skeleton className="h-4 w-80 bg-muted-foreground/10" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 bg-muted-foreground/10" />
          <Skeleton className="h-9 w-24 bg-muted-foreground/10" />
        </div>
      </div>

      {/* Repo info card */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl bg-muted-foreground/10" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-48 bg-muted-foreground/10" />
            <Skeleton className="h-3.5 w-72 bg-muted-foreground/10" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg bg-muted-foreground/10" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border/40 p-3 space-y-1.5">
              <Skeleton className="h-3.5 w-16 bg-muted-foreground/10" />
              <Skeleton className="h-6 w-10 bg-muted-foreground/10" />
            </div>
          ))}
        </div>
      </Card>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-lg bg-muted-foreground/10 shrink-0" />
        ))}
      </div>

      {/* Tab content skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="p-4 flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-lg bg-muted-foreground/10 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3 bg-muted-foreground/10" />
              <Skeleton className="h-3 w-1/3 bg-muted-foreground/10" />
            </div>
            <Skeleton className="h-7 w-16 rounded-lg bg-muted-foreground/10" />
          </Card>
        ))}
      </div>
    </div>
  )
}
