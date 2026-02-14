'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronIcon } from '@/components/ui/chevron-icon'
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
          <ChevronIcon rotated={collapsed} />
        </div>

        {!collapsed && (
          <div className="mt-1.5 space-y-1.5">
            {activeCommitments.map((commitment) => {
              const activeStep = commitment.nextSteps.find((s) => s.status === 'active')
              return (
                <div key={commitment.label} className="flex items-start gap-2">
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
