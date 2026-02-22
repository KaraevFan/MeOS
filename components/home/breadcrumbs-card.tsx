import { InfoCard } from '@/components/ui/info-card'

interface BreadcrumbsCardProps {
  captures: string[]
}

export function BreadcrumbsCard({ captures }: BreadcrumbsCardProps) {
  return (
    <InfoCard borderColor="sage">
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-sage">
          Today&apos;s Breadcrumbs
        </span>
        <div className="flex flex-col gap-2">
          {captures.map((capture, i) => (
            <div
              key={i}
              className="pl-3 border-l-2 border-sage/30"
            >
              <p className="text-[14px] text-warm-dark/80 leading-relaxed italic">
                {capture}
              </p>
            </div>
          ))}
        </div>
      </div>
    </InfoCard>
  )
}
