'use client'

import Link from 'next/link'
import type { DayPlanDataBlock } from '@/types/chat'

interface DayPlanConfirmationCardProps {
  data: DayPlanDataBlock
}

const ENERGY_LABELS: Record<string, string> = {
  fired_up: 'Fired up',
  focused: 'Focused',
  neutral: 'Neutral',
  low: 'Low energy',
  stressed: 'Stressed',
}

export function DayPlanConfirmationCard({ data }: DayPlanConfirmationCardProps) {
  return (
    <div className="w-full bg-bg-card border border-border rounded-xl p-4 shadow-sm animate-fade-up">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
        <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-primary/80">
          Day Plan Set
        </span>
      </div>

      {data.intention && (
        <p className="text-[15px] font-medium text-text mb-2">
          {data.intention}
        </p>
      )}

      <div className="flex items-center gap-3 text-[13px] text-text-secondary">
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
