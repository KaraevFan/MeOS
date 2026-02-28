'use client'

import type { EveningReflection } from '@/types/day-plan'
import { escapeHtml, renderInlineMarkdownToHtml } from '@/lib/markdown/render-inline'

interface EveningReflectionCardProps {
  reflection: EveningReflection
  eveningCompletedAt: string
}

const ENERGY_LABELS: Record<string, { emoji: string; label: string }> = {
  fired_up: { emoji: '\uD83D\uDD25', label: 'Fired up' },
  focused: { emoji: '\uD83C\uDFAF', label: 'Focused' },
  neutral: { emoji: '\uD83D\uDE0A', label: 'Neutral' },
  low: { emoji: '\uD83D\uDE14', label: 'Low energy' },
  stressed: { emoji: '\uD83D\uDE13', label: 'Stressed' },
}

export function EveningReflectionCard({ reflection, eveningCompletedAt }: EveningReflectionCardProps) {
  const completedTime = new Date(eveningCompletedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  const energy = reflection.energy ? ENERGY_LABELS[reflection.energy] : null

  return (
    <div
      className="rounded-[18px] p-5 shadow-stone"
      style={{
        backgroundColor: '#F0EDE6',
        border: '1px solid rgba(201, 150, 58, 0.1)',
      }}
    >
      {/* Section header */}
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-warm-gray">
        Evening Reflection
      </p>

      {/* Status line */}
      <div className="mb-1 flex items-center gap-2">
        <span className="text-base" role="img" aria-label="Evening">
          {'\uD83C\uDF19'}
        </span>
        <p className="text-sm text-warm-dark/70">
          Day closed{' '}
          <span className="text-warm-gray/50">{'\u00B7'} {completedTime}</span>
        </p>
      </div>

      {/* Energy/mood */}
      {(energy || reflection.mood) && (
        <div className="mb-4 flex items-center gap-2">
          {energy && (
            <span className="text-base" role="img" aria-label="Energy">
              {energy.emoji}
            </span>
          )}
          <p className="text-sm text-warm-dark/70">
            {reflection.mood ? reflection.mood.replace(/-/g, ' ') : energy?.label}
          </p>
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-warm-dark/[0.06] mb-4" />

      {/* Sage synthesis */}
      {reflection.sage_synthesis && (
        <div
          className="text-sm leading-relaxed text-warm-dark/80"
          dangerouslySetInnerHTML={{ __html: renderInlineMarkdownToHtml(escapeHtml(reflection.sage_synthesis)) }}
        />
      )}
    </div>
  )
}
