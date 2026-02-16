import Link from 'next/link'
import { ALL_DOMAINS } from '@/lib/constants'
import { DomainDetailCard } from './domain-detail-card'
import type { LifeMapDomain } from '@/types/database'
import type { PulseCheckRating } from '@/types/pulse-check'
import type { TrendDirection } from '@/lib/supabase/pulse-check'

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
  domainTrends?: Record<string, TrendDirection | null>
}

export function DomainGrid({ domains, baselineRatings, domainTrends }: DomainGridProps) {
  const domainMap = new Map(domains.map((d) => [d.domain_name, d]))
  const ratingMap = new Map((baselineRatings || []).map((r) => [r.domain, r]))

  // Separate explored (has Sage content) from unexplored
  const explored: string[] = []
  const unexplored: string[] = []

  for (const domainName of ALL_DOMAINS) {
    const domain = domainMap.get(domainName)
    if (domain && domain.current_state) {
      explored.push(domainName)
    } else {
      unexplored.push(domainName)
    }
  }

  return (
    <div className="space-y-4">
      {/* Explored domains */}
      {explored.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
            Life domains
          </p>
          {explored.map((domainName) => {
            const domain = domainMap.get(domainName)!
            const pulseRating = ratingMap.get(domainName)
            const trend = domainTrends?.[domainName] ?? undefined
            return <DomainDetailCard key={domainName} domain={domain} pulseRating={pulseRating} trend={trend} />
          })}
        </div>
      )}

      {/* Unexplored domains */}
      {unexplored.length > 0 && (
        <div className="space-y-2">
          {explored.length > 0 && (
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1 mt-2">
              Not yet explored
            </p>
          )}
          {unexplored.map((domainName) => {
            const pulseRating = ratingMap.get(domainName)
            const domain = domainMap.get(domainName)

            // If we have a domain record without content, still show it
            if (domain) {
              return <DomainDetailCard key={domainName} domain={domain} pulseRating={pulseRating} />
            }

            return (
              <div
                key={domainName}
                className="w-full bg-bg-card rounded-lg border border-border p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${pulseRating ? PULSE_RATING_COLORS[pulseRating.rating] || 'bg-border' : 'bg-border'}`} />
                  <span className="text-sm font-medium text-text">{domainName}</span>
                  {pulseRating && (
                    <span className="text-[11px] text-text-secondary ml-1">
                      {PULSE_RATING_LABELS[pulseRating.rating] || pulseRating.rating}
                    </span>
                  )}
                </div>
                <Link
                  href={`/chat?explore=${encodeURIComponent(domainName)}`}
                  className="text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                >
                  Explore with Sage
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
