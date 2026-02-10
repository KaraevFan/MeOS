import { ALL_DOMAINS } from '@/lib/constants'
import { DomainDetailCard } from './domain-detail-card'
import type { LifeMapDomain } from '@/types/database'

interface DomainGridProps {
  domains: LifeMapDomain[]
}

export function DomainGrid({ domains }: DomainGridProps) {
  const domainMap = new Map(domains.map((d) => [d.domain_name, d]))

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
        Life domains
      </p>
      {ALL_DOMAINS.map((domainName) => {
        const domain = domainMap.get(domainName)

        if (domain) {
          return <DomainDetailCard key={domainName} domain={domain} />
        }

        // Not yet explored
        return (
          <div
            key={domainName}
            className="w-full bg-bg-card rounded-lg border border-border p-4 opacity-50"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-border" />
              <span className="text-sm text-text-secondary">{domainName}</span>
              <span className="text-xs text-text-secondary ml-auto">Not yet explored</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
