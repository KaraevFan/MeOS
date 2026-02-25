import Link from 'next/link'
import { InfoCard } from '@/components/ui/info-card'
import { DOMAIN_SHORT_NAMES } from '@/lib/constants'
import type { DomainName } from '@/types/chat'

interface LifeMapNudgeProps {
  unmappedDomains: DomainName[]
}

function getNudgeCopy(unmapped: DomainName[]): string {
  const names = unmapped.map((d) => DOMAIN_SHORT_NAMES[d])

  if (unmapped.length === 1) {
    return `One last domain to map: ${names[0]}. Want to round it out?`
  }
  if (unmapped.length <= 3) {
    const joined = names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
    return `We're almost there — just ${joined} left to explore.`
  }
  return "There are parts of your map we haven't explored yet \u2014 want to go deeper?"
}

export function LifeMapNudge({ unmappedDomains }: LifeMapNudgeProps) {
  if (unmappedDomains.length === 0) return null

  return (
    <InfoCard borderColor="sage">
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-sage">
          Your Life Map
        </span>
        <p className="text-[15px] italic text-warm-dark/60 leading-relaxed">
          {getNudgeCopy(unmappedDomains)}
        </p>
        <Link
          href="/chat?type=life_mapping"
          className="text-[12px] font-semibold text-amber-600 hover:text-amber-700 transition-colors self-start"
        >
          Continue mapping
        </Link>
      </div>
    </InfoCard>
  )
}
