import { ALL_DOMAINS } from '@/lib/constants'
import { DomainDetailCard } from './domain-detail-card'
import type { LifeMapDomain } from '@/types/database'
import type { PulseCheckRating } from '@/types/pulse-check'

const PULSE_RATING_COLORS: Record<string, string> = {
  thriving: 'bg-status-thriving',
  good: 'bg-status-stable',
  okay: 'bg-status-stable',
  struggling: 'bg-status-attention',
  in_crisis: 'bg-status-crisis',
}

const PULSE_RATING_LABELS: Record<string, string> = {
  thriving: 'Thriving',
  good: 'Good',
  okay: 'Okay',
  struggling: 'Struggling',
  in_crisis: 'In crisis',
}

interface DomainGridProps {
  domains: LifeMapDomain[]
  baselineRatings?: PulseCheckRating[] | null
}

export function DomainGrid({ domains, baselineRatings }: DomainGridProps) {
  const domainMap = new Map(domains.map((d) => [d.domain_name, d]))
  const ratingMap = new Map((baselineRatings || []).map((r) => [r.domain, r]))

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
        Life domains
      </p>
      {ALL_DOMAINS.map((domainName) => {
        const domain = domainMap.get(domainName)
        const pulseRating = ratingMap.get(domainName)

        if (domain) {
          return <DomainDetailCard key={domainName} domain={domain} pulseRating={pulseRating} />
        }

        // Not yet explored — show pulse rating if available
        return (
          <div
            key={domainName}
            className="w-full bg-bg-card rounded-lg border border-border p-4 opacity-50"
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${pulseRating ? PULSE_RATING_COLORS[pulseRating.rating] || 'bg-border' : 'bg-border'}`} />
              <span className="text-sm text-text-secondary">{domainName}</span>
              <span className="text-xs text-text-secondary ml-auto">
                {pulseRating
                  ? `Initial pulse: ${PULSE_RATING_LABELS[pulseRating.rating] || pulseRating.rating}`
                  : 'Not yet explored'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
