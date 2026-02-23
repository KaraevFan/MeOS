'use client'

import Link from 'next/link'
import type { DayPlanDataBlock } from '@/types/chat'

interface DayPlanConfirmationCardProps {
  data: DayPlanDataBlock
}

const ENERGY_LABELS: Record<string, string> = {
  fired_up: 'Energized',
  focused: 'Good',
  neutral: 'Neutral',
  low: 'Low',
  stressed: 'Rough',
}

export function DayPlanConfirmationCard({ data }: DayPlanConfirmationCardProps) {
  const additionalItems = data.priorities?.filter((p) => p.rank > 1) ?? []

  return (
    <div className="w-full bg-bg-card border border-border rounded-xl p-4 shadow-sm animate-fade-up">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
        <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-primary/80">
          Day Plan Set
        </span>
      </div>

      {data.intention && (
        <p className="text-[17px] font-semibold text-text mb-1">
          {data.intention}
        </p>
      )}

      {additionalItems.length > 0 && (
        <div className="mt-1.5 mb-2 space-y-0.5">
          {additionalItems.map((item) => (
            <p key={item.rank} className="text-[13px] text-text-secondary">
              + {item.text}
            </p>
          ))}
        </div>
      )}

      {data.coaching_note && (
        <p className="mt-2 text-[13px] text-text-secondary italic leading-relaxed">
          {data.coaching_note}
        </p>
      )}

      <div className="flex items-center gap-3 mt-2 text-[13px] text-text-secondary">
        {data.energy_level && (
          <span>{ENERGY_LABELS[data.energy_level] ?? data.energy_level}</span>
        )}
        {data.priorities && data.priorities.length > 0 && (
          <span>{data.priorities.length} priorit{data.priorities.length === 1 ? 'y' : 'ies'}</span>
        )}
      </div>

      <Link
        href="/day"
        className="inline-block mt-3 text-[12px] font-medium text-primary hover:text-primary-hover transition-colors"
      >
        View day plan
      </Link>
    </div>
  )
}
