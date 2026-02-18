'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { SynthesisSection } from './synthesis-section'
import { DomainGrid } from './domain-grid'
import { ChevronIcon } from '@/components/ui/chevron-icon'
import { COMMITMENT_STATUS_DISPLAY } from '@/lib/markdown/extract'
import type { LifeMap, LifeMapDomain } from '@/types/database'
import type { PulseCheckRating } from '@/types/pulse-check'
import type { Commitment, NextStepStatus } from '@/lib/markdown/extract'
import type { TrendDirection } from '@/lib/supabase/pulse-check'

export interface LifePlanData {
  quarterTheme: string | null
  commitments: Commitment[]
  thingsToProtect: string[]
  boundaries: string[]
}

interface LifeMapTabsProps {
  lifeMap: LifeMap
  domains: LifeMapDomain[]
  baselineRatings: PulseCheckRating[]
  domainTrends?: Record<string, TrendDirection | null>
  lifePlanData: LifePlanData
  changedSinceLastCheckin?: string[]
}

function ChangedSinceCheckin({ domains }: { domains: string[] }) {
  if (domains.length === 0) return null
  return (
    <div className="bg-primary/5 border border-primary/15 rounded-lg p-4">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
        What changed since last check-in
      </p>
      <ul className="space-y-1 text-sm text-text">
        {domains.map((domain) => (
          <li key={domain} className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">&#8226;</span>
            <span>{domain}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const STEP_DOT_COLOR: Record<NextStepStatus, string> = {
  upcoming: 'bg-text-secondary/30',
  active: 'bg-primary',
  done: 'bg-accent-sage',
}

function CommitmentCard({ commitment }: { commitment: Commitment }) {
  const [expanded, setExpanded] = useState(false)
  const statusDisplay = COMMITMENT_STATUS_DISPLAY[commitment.status]
  const hasDetails = commitment.whyItMatters || commitment.nextSteps.length > 0

  return (
    <div className="bg-bg-card rounded-lg border border-border p-4 shadow-sm">
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={cn(
          'w-full text-left flex items-start justify-between gap-2',
          hasDetails && 'cursor-pointer'
        )}
        disabled={!hasDetails}
      >
        <div className="flex-1">
          <p className="text-sm font-medium text-text leading-snug">
            {commitment.label}
          </p>
          {!expanded && commitment.nextSteps.length > 0 && (
            <p className="text-xs text-text-secondary mt-1">
              {commitment.nextSteps.filter((s) => s.status !== 'done').length} steps remaining
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[11px] font-medium whitespace-nowrap ${statusDisplay.className}`}>
            {statusDisplay.label}
          </span>
          {hasDetails && (
            <ChevronIcon rotated={expanded} />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border">
          {commitment.whyItMatters && (
            <p className="text-xs text-text-secondary italic mb-3 leading-relaxed">
              {commitment.whyItMatters}
            </p>
          )}

          {commitment.nextSteps.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-1.5">
                Next steps
              </p>
              <ul className="space-y-1.5">
                {commitment.nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px]">
                    <span className={cn(
                      'mt-1.5 block w-1.5 h-1.5 rounded-full flex-shrink-0',
                      STEP_DOT_COLOR[step.status]
                    )} />
                    <span className={cn(
                      step.status === 'done' && 'line-through text-text-secondary',
                      step.status === 'active' && 'text-text font-medium',
                      step.status === 'upcoming' && 'text-text-secondary'
                    )}>
                      {step.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Single scrollable Life Map view — no tabs.
 * Layout: narrative identity → commitments → domain cards.
 */
export function LifeMapTabs({
  lifeMap,
  domains,
  baselineRatings,
  domainTrends,
  lifePlanData,
  changedSinceLastCheckin = [],
}: LifeMapTabsProps) {
  return (
    <div className="space-y-lg">
      <ChangedSinceCheckin domains={changedSinceLastCheckin} />

      {/* Identity section: narrative, north star, quarterly focus, tensions, boundaries */}
      <SynthesisSection lifeMap={lifeMap} />

      {/* Life plan: quarter theme + active commitments */}
      {lifePlanData.quarterTheme && (
        <div className="bg-primary/5 rounded-lg px-4 py-3 border border-primary/10">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">
            Quarter theme
          </p>
          <p className="text-sm text-text font-medium leading-relaxed">
            {lifePlanData.quarterTheme}
          </p>
        </div>
      )}

      {lifePlanData.commitments.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
            Active commitments
          </p>
          <div className="space-y-sm">
            {lifePlanData.commitments.map((commitment) => (
              <CommitmentCard key={commitment.label} commitment={commitment} />
            ))}
          </div>
        </div>
      )}

      {lifePlanData.thingsToProtect.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
            Things to protect
          </p>
          <ul className="text-sm text-text space-y-1">
            {lifePlanData.thingsToProtect.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-accent-sage mt-0.5">&#10003;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Domain cards */}
      <DomainGrid domains={domains} baselineRatings={baselineRatings} domainTrends={domainTrends} />
    </div>
  )
}
