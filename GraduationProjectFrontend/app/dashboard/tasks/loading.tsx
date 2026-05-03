import { Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-52 bg-muted-foreground/10" />
          <Skeleton className="h-4 w-72 bg-muted-foreground/10" />
        </div>
        <Skeleton className="h-9 w-28 bg-muted-foreground/10" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-3 sm:p-4">
            <Skeleton className="h-7 w-7 rounded-xl bg-muted-foreground/10" />
            <Skeleton className="mt-2 h-7 w-10 bg-muted-foreground/10" />
            <Skeleton className="mt-1 h-3 w-16 bg-muted-foreground/10" />
          </Card>
        ))}
      </div>

      {/* Loading spinner */}
      <Card className="flex items-center justify-center gap-3 p-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading tasks...</span>
      </Card>
    </div>
  )
}
