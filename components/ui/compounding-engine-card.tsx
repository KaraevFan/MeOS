interface CompoundingEngineCardProps {
  engine: string
}

export function CompoundingEngineCard({ engine }: CompoundingEngineCardProps) {
  return (
    <div className="bg-gradient-to-br from-amber-50 to-bg-card rounded-lg border border-primary/15 p-4 shadow-sm">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
        Your compounding engine
      </p>
      <p className="text-base font-bold text-text leading-snug">
        {engine}
      </p>
    </div>
  )
}
