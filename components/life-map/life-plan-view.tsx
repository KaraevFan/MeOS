'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ChevronIcon } from '@/components/ui/chevron-icon'
import { COMMITMENT_STATUS_DISPLAY } from '@/lib/markdown/extract'
import type { Commitment, NextStepStatus } from '@/lib/markdown/extract'

const STEP_DOT_COLOR: Record<NextStepStatus, string> = {
  upcoming: 'bg-text-secondary/30',
  active: 'bg-primary',
  done: 'bg-accent-sage',
}

interface LifePlanViewProps {
  quarterTheme: string | null
  commitments: Commitment[]
  thingsToProtect: string[]
  boundaries: string[]
}

export function LifePlanView({ quarterTheme, commitments, thingsToProtect, boundaries }: LifePlanViewProps) {
  if (commitments.length === 0 && !quarterTheme && thingsToProtect.length === 0) {
    return (
      <div className="text-center py-xl">
        <p className="text-sm text-text-secondary mb-4">
          Your life plan will take shape after you set commitments with Sage.
        </p>
        <Link
          href="/chat"
          className="inline-flex items-center justify-center h-10 px-5 bg-primary text-white rounded-md text-sm font-medium
                     hover:bg-primary-hover transition-colors"
        >
          Talk to Sage
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-lg">
      {/* Quarter theme banner */}
      {quarterTheme && (
        <div className="bg-primary/5 rounded-lg px-4 py-3 border border-primary/10">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">
            Quarter theme
          </p>
          <p className="text-sm text-text font-medium leading-relaxed">
            {quarterTheme}
          </p>
        </div>
      )}

      {/* Active commitments */}
      {commitments.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
            Active commitments
          </p>
          <div className="space-y-sm">
            {commitments.map((commitment) => (
              <CommitmentDetailCard key={commitment.label} commitment={commitment} />
            ))}
          </div>
        </div>
      )}

      {/* Things to protect */}
      {thingsToProtect.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
            Things to protect
          </p>
          <ul className="text-sm text-text space-y-1">
            {thingsToProtect.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-accent-sage mt-0.5">&#10003;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Boundaries (action-level, from life plan) */}
      {boundaries.length > 0 && (
        <div className="opacity-75">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
            Boundaries
          </p>
          <ul className="text-sm text-text-secondary space-y-1">
            {boundaries.map((boundary, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-0.5">&times;</span>
                <span>{boundary}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function CommitmentDetailCard({ commitment }: { commitment: Commitment }) {
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
          {/* Why it matters */}
          {commitment.whyItMatters && (
            <p className="text-xs text-text-secondary italic mb-3 leading-relaxed">
              {commitment.whyItMatters}
            </p>
          )}

          {/* Next steps */}
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
