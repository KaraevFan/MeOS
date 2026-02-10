'use client'

import { cn } from '@/lib/utils'
import type { DomainSummary, DomainName } from '@/types/chat'

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

interface DomainCardProps {
  domain: DomainSummary
  onCorrect: (domain: DomainName) => void
}

export function DomainCard({ domain, onCorrect }: DomainCardProps) {
  return (
    <div className="w-full bg-bg-card rounded-lg shadow-md p-4 animate-fade-up relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-bold text-text">{domain.domain}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCorrect(domain.domain)}
            className="text-text-secondary hover:text-text p-1 transition-colors"
            aria-label={`Edit ${domain.domain} card`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <div className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full', STATUS_COLORS[domain.status] || 'bg-status-stable')} />
            <span className="text-xs font-medium text-text-secondary">
              {STATUS_LABELS[domain.status] || 'Stable'}
            </span>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-3">
        {domain.currentState && (
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">Current state</p>
            <p className="text-sm text-text">{domain.currentState}</p>
          </div>
        )}

        {domain.whatsWorking.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">What&apos;s working</p>
            <ul className="text-sm text-text space-y-0.5">
              {domain.whatsWorking.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-status-thriving mt-0.5">+</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {domain.whatsNotWorking.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">What&apos;s not working</p>
            <ul className="text-sm text-text space-y-0.5">
              {domain.whatsNotWorking.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-accent-terra mt-0.5">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {domain.keyTension && (
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">Key tension</p>
            <p className="text-sm text-text italic">{domain.keyTension}</p>
          </div>
        )}

        {domain.statedIntention && (
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">Stated intention</p>
            <p className="text-sm text-text font-medium">{domain.statedIntention}</p>
          </div>
        )}
      </div>
    </div>
  )
}
