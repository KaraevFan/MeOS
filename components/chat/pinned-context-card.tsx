'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Commitment } from '@/lib/markdown/extract'

interface PinnedContextCardProps {
  commitments: Commitment[]
}

export function PinnedContextCard({ commitments }: PinnedContextCardProps) {
  const [collapsed, setCollapsed] = useState(false)

  const activeCommitments = commitments.filter((c) => c.status !== 'complete')

  if (activeCommitments.length === 0) return null

  return (
    <div className="mx-4 mb-2">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full bg-bg-card rounded-lg border border-border px-3 py-2 shadow-sm text-left"
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">
            Current commitments
          </p>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={cn(
              'text-text-secondary transition-transform',
              collapsed && 'rotate-180'
            )}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {!collapsed && (
          <div className="mt-1.5 space-y-1.5">
            {activeCommitments.map((commitment, i) => {
              const activeStep = commitment.nextSteps.find((s) => s.status === 'active')
              return (
                <div key={i} className="flex items-start gap-2">
                  <span className={cn(
                    'mt-1 block w-1.5 h-1.5 rounded-full flex-shrink-0',
                    commitment.status === 'in_progress' ? 'bg-primary' : 'bg-text-secondary/30'
                  )} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text leading-snug truncate">
                      {commitment.label}
                    </p>
                    {activeStep && (
                      <p className="text-[11px] text-text-secondary truncate">
                        Next: {activeStep.label}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </button>
    </div>
  )
}
