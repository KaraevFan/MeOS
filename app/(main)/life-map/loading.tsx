export default function LifeMapLoading() {
  return (
    <div className="px-md pt-lg pb-lg max-w-lg mx-auto space-y-lg animate-pulse">
      <div className="h-7 bg-border/30 rounded-md w-36" />
      <div className="bg-bg-card rounded-lg border border-border p-5 space-y-3">
        <div className="h-4 bg-border/30 rounded w-full" />
        <div className="h-4 bg-border/30 rounded w-3/4" />
        <div className="h-4 bg-border/30 rounded w-1/2" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-bg-card rounded-lg border border-border p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-border/30" />
              <div className="h-4 bg-border/30 rounded w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
