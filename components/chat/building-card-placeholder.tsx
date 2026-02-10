'use client'

export function BuildingCardPlaceholder() {
  return (
    <div className="w-full rounded-lg border border-border bg-bg-card p-4 shadow-sm animate-pulse">
      <div className="flex items-center gap-2 text-text-secondary text-sm">
        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Building your map...
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 bg-bg rounded w-3/4" />
        <div className="h-3 bg-bg rounded w-1/2" />
        <div className="h-3 bg-bg rounded w-2/3" />
      </div>
    </div>
  )
}
