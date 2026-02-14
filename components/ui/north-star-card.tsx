interface NorthStarCardProps {
  /** Full north star paragraph including "because" clause */
  northStarFull: string
}

export function NorthStarCard({ northStarFull }: NorthStarCardProps) {
  return (
    <div className="bg-gradient-to-br from-amber-50 to-bg-card rounded-lg border border-primary/15 p-5 shadow-sm">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">
        Your north star
      </p>
      <p className="text-[11px] text-text-secondary mb-2 leading-relaxed">
        The area where focused effort moves everything else forward.
      </p>
      <p className="text-sm text-text font-medium leading-relaxed whitespace-pre-wrap">
        {northStarFull}
      </p>
    </div>
  )
}
