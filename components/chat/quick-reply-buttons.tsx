'use client'

import { cn } from '@/lib/utils'
import { ALL_DOMAINS } from '@/lib/constants'
import type { DomainName } from '@/types/chat'
import type { PulseCheckRating } from '@/types/pulse-check'

interface QuickReplyButtonsProps {
  domainsExplored: Set<DomainName>
  onSelect: (text: string) => void
  disabled: boolean
  pulseCheckRatings?: PulseCheckRating[] | null
}

export function QuickReplyButtons({ domainsExplored, onSelect, disabled, pulseCheckRatings }: QuickReplyButtonsProps) {
  let remainingDomains = ALL_DOMAINS.filter((d) => !domainsExplored.has(d))

  // Sort by pulse check rating (struggling first) if available
  if (pulseCheckRatings && pulseCheckRatings.length > 0) {
    const ratingMap = new Map(pulseCheckRatings.map((r) => [r.domain, r.ratingNumeric]))
    remainingDomains = [...remainingDomains].sort((a, b) => {
      const ratingA = ratingMap.get(a) ?? 3
      const ratingB = ratingMap.get(b) ?? 3
      return ratingA - ratingB // lower rating (struggling) first
    })
  }

  if (remainingDomains.length === 0 && domainsExplored.size === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide">
      {remainingDomains.map((domain) => (
        <button
          key={domain}
          onClick={() => onSelect(`Let's explore ${domain}`)}
          disabled={disabled}
          className={cn(
            'flex-shrink-0 px-3 py-1.5 rounded-full text-sm',
            'bg-bg border border-border text-text',
            'hover:bg-primary hover:text-white hover:border-primary',
            'active:scale-95 transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {domain}
        </button>
      ))}
      <button
        onClick={() => onSelect("Let's wrap up and synthesize what we've covered.")}
        disabled={disabled}
        className={cn(
          'flex-shrink-0 px-3 py-1.5 rounded-full text-sm',
          'bg-primary/10 border border-primary/30 text-primary font-medium',
          'hover:bg-primary hover:text-white hover:border-primary',
          'active:scale-95 transition-all duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        Wrap up
      </button>
    </div>
  )
}
