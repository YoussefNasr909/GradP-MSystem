export default function Loading() {
  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-5 overflow-x-hidden px-3 py-3 pb-24 sm:space-y-7 sm:px-4 sm:py-4 sm:pb-8 md:px-6">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="h-1 bg-gradient-to-r from-amber-400 via-cyan-400 to-emerald-400" />
        <div className="grid gap-3 p-3 sm:gap-6 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-7">
          <div className="space-y-3 sm:space-y-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-12 w-12 animate-pulse rounded-full bg-muted sm:h-24 sm:w-24" />
              <div className="space-y-3">
                <div className="h-7 w-44 animate-pulse rounded bg-muted sm:h-8 sm:w-48" />
                <div className="flex gap-2">
                  <div className="h-6 w-20 animate-pulse rounded bg-muted" />
                  <div className="hidden h-6 w-28 animate-pulse rounded bg-muted sm:block" />
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-2.5 sm:p-4">
              <div className="mb-3 flex items-end justify-between gap-4 sm:mb-4">
                <div className="h-10 w-36 animate-pulse rounded bg-muted sm:h-12 sm:w-40" />
                <div className="h-10 w-24 animate-pulse rounded-md bg-muted sm:h-12 sm:w-28" />
              </div>
              <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-1">
            <div className="h-16 animate-pulse rounded-lg border bg-muted/70 sm:h-20" />
            <div className="h-16 animate-pulse rounded-lg border bg-muted/70 sm:h-20" />
            <div className="h-16 animate-pulse rounded-lg border bg-muted/70 sm:h-20" />
          </div>
        </div>
      </div>

      <div className="hidden grid-cols-2 gap-2 sm:grid sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-lg border bg-card sm:h-24" />
        ))}
      </div>

      <div className="grid min-w-0 gap-5 sm:gap-7 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
        <div className="min-w-0 space-y-5 sm:space-y-7">
          <div className="space-y-3 sm:space-y-4">
            <div className="h-12 w-56 animate-pulse rounded-lg bg-muted" />
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className={`${index > 0 ? "hidden md:block " : ""}h-44 animate-pulse rounded-lg border bg-card sm:h-52`} />
              ))}
            </div>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <div className="h-12 w-52 animate-pulse rounded-lg bg-muted" />
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className={`${index > 0 ? "hidden md:block " : ""}h-44 animate-pulse rounded-lg border bg-card sm:h-56`} />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="h-96 animate-pulse rounded-lg border bg-card" />
          <div className="space-y-4">
            <div className="h-12 w-56 animate-pulse rounded-lg bg-muted" />
            <div className="grid gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-lg border bg-card" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
