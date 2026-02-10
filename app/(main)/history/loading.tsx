export default function HistoryLoading() {
  return (
    <div className="px-md pt-lg pb-lg max-w-lg mx-auto space-y-md animate-pulse">
      <div className="h-7 bg-border/30 rounded-md w-24" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-bg-card rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 bg-border/30 rounded-full w-24" />
            <div className="h-5 bg-border/30 rounded-full w-20" />
          </div>
          <div className="h-4 bg-border/30 rounded w-full" />
          <div className="h-4 bg-border/30 rounded w-2/3" />
        </div>
      ))}
    </div>
  )
}
