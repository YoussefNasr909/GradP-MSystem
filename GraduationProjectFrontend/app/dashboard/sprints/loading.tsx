import { Loader2 } from "lucide-react"

export default function SprintsLoading() {
  return (
    <div className="flex min-h-[420px] items-center justify-center p-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading sprints
      </div>
    </div>
  )
}
