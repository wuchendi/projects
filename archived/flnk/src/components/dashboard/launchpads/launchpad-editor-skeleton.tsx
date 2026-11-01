import { Skeleton } from '@cdlab/ui/components/skeleton'

// Layout-matched placeholder for the launchpad editor — mirrors the top bar,
// slug row, tab fields, and the mobile preview frame. Used both as the
// `dynamic()` chunk-loading fallback and the editor's own data-loading state so
// the entry transition reads as one continuous skeleton (no big single block).
export function LaunchpadEditorSkeleton() {
  return (
    <div className="space-y-4">
      {/* Top bar: back + title + status + actions. */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-md" />
        <Skeleton className="h-9 max-w-sm flex-1" />
        <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
        <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
        <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
      </div>

      {/* Slug row. */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-48" />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Editor tabs + fields. */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex gap-1">
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-44 w-full rounded-lg" />
        </div>

        {/* Mobile live preview. */}
        <div className="lg:w-[360px] lg:shrink-0">
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="mx-auto h-[640px] w-full max-w-[360px] rounded-[2rem]" />
        </div>
      </div>
    </div>
  )
}
