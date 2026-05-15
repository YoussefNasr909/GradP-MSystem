import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function ReviewsLoading() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="rounded-2xl border border-border/60 bg-card px-5 py-5 sm:px-6">
        <Skeleton className="mb-3 h-5 w-28" />
        <Skeleton className="mb-2 h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border/60 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div>
                <Skeleton className="mb-2 h-7 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 p-4">
        <Skeleton className="mb-3 h-5 w-24" />
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(140px,1fr))_auto]">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-10 rounded-xl" />
          ))}
        </div>
      </Card>

      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border/60 p-5">
            <Skeleton className="mb-3 h-5 w-1/3" />
            <Skeleton className="mb-4 h-4 w-2/3" />
            <Skeleton className="h-10 w-full" />
          </Card>
        ))}
      </div>
    </div>
  )
}
