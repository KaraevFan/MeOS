import { cn } from '@/lib/utils'
import { COMMITMENT_STATUS_DISPLAY } from '@/lib/markdown/extract'
import type { Commitment } from '@/lib/markdown/extract'

interface CommitmentCardProps {
  commitment: Commitment
}

export function CommitmentCard({ commitment }: CommitmentCardProps) {
  const statusDisplay = COMMITMENT_STATUS_DISPLAY[commitment.status]
  // Show first 2 non-done next steps (or the most recent done ones if all are done)
  const visibleSteps = commitment.nextSteps
    .filter((s) => s.status !== 'done')
    .slice(0, 2)

  return (
    <div className="bg-bg-card rounded-lg border border-border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-text leading-snug">
          {commitment.label}
        </p>
        <span className={cn('text-[11px] font-medium whitespace-nowrap', statusDisplay.className)}>
          {statusDisplay.label}
        </span>
      </div>

      {visibleSteps.length > 0 && (
        <ul className="mt-2 space-y-1">
          {visibleSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-text-secondary">
              <span className={cn(
                'mt-1 block w-1.5 h-1.5 rounded-full flex-shrink-0',
                step.status === 'active' ? 'bg-primary' : 'bg-text-secondary/30'
              )} />
              <span className={step.status === 'active' ? 'text-text' : ''}>
                {step.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
