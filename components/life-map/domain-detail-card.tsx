'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { LifeMapDomain } from '@/types/database'
import type { PulseCheckRating } from '@/types/pulse-check'

const STATUS_COLORS: Record<string, string> = {
  thriving: 'bg-status-thriving',
  stable: 'bg-status-stable',
  needs_attention: 'bg-status-attention',
  in_crisis: 'bg-status-crisis',
}

const STATUS_LABELS: Record<string, string> = {
  thriving: 'Thriving',
  stable: 'Stable',
  needs_attention: 'Needs attention',
  in_crisis: 'In crisis',
}

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

interface DomainDetailCardProps {
  domain: LifeMapDomain
  pulseRating?: PulseCheckRating
}

export function DomainDetailCard({ domain, pulseRating }: DomainDetailCardProps) {
  const [expanded, setExpanded] = useState(false)

  const statusColor = STATUS_COLORS[domain.status || 'stable'] || 'bg-status-stable'
  const statusLabel = STATUS_LABELS[domain.status || 'stable'] || 'Stable'

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left bg-bg-card rounded-lg shadow-sm border border-border p-4 transition-all duration-200 hover:shadow-md"
    >
      {/* Collapsed header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColor)} />
            <h3 className="text-sm font-bold text-text truncate">{domain.domain_name}</h3>
          </div>
          {domain.current_state && (
            <p className="text-xs text-text-secondary line-clamp-1 ml-4">
              {domain.current_state}
            </p>
          )}
          {domain.stated_intentions && domain.stated_intentions.length > 0 && (
            <p className="text-xs text-primary font-medium mt-0.5 line-clamp-1 ml-4">
              {domain.stated_intentions[0]}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          <span className="text-[11px] text-text-secondary">{statusLabel}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={cn(
              'text-text-secondary transition-transform duration-200',
              expanded && 'rotate-180'
            )}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-3 ml-4">
          {domain.current_state && (
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">
                Current state
              </p>
              <p className="text-sm text-text">{domain.current_state}</p>
            </div>
          )}

          {domain.whats_working && domain.whats_working.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">
                What&apos;s working
              </p>
              <ul className="text-sm text-text space-y-0.5">
                {domain.whats_working.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-status-thriving mt-0.5">+</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {domain.whats_not_working && domain.whats_not_working.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">
                What&apos;s not working
              </p>
              <ul className="text-sm text-text space-y-0.5">
                {domain.whats_not_working.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-accent-terra mt-0.5">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {domain.desires && domain.desires.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">
                Desires
              </p>
              <ul className="text-sm text-text space-y-0.5">
                {domain.desires.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {domain.tensions && domain.tensions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">
                Tensions
              </p>
              <ul className="text-sm text-text italic space-y-0.5">
                {domain.tensions.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {domain.stated_intentions && domain.stated_intentions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">
                Stated intentions
              </p>
              <ul className="text-sm text-text font-medium space-y-0.5">
                {domain.stated_intentions.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {pulseRating && (
            <div className="flex items-center gap-1.5">
              <div className={cn('w-1.5 h-1.5 rounded-full', PULSE_RATING_COLORS[pulseRating.rating] || 'bg-border')} />
              <p className="text-[11px] text-text-secondary">
                Initial pulse: {PULSE_RATING_LABELS[pulseRating.rating] || pulseRating.rating}
              </p>
            </div>
          )}

          <p className="text-[11px] text-text-secondary">
            Last updated {new Date(domain.updated_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      )}
    </button>
  )
}
