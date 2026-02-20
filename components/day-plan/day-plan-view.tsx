'use client'

import type { DayPlanWithCaptures } from '@/types/day-plan'
import { IntentionCard } from './intention-card'
import { MorningSnapshotCard } from './morning-snapshot-card'
import { CapturedThoughts } from './captured-thoughts'

interface DayPlanViewProps {
  data: DayPlanWithCaptures
}

export function DayPlanView({ data }: DayPlanViewProps) {
  const { dayPlan, captures, streak } = data
  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).toUpperCase()

  return (
    <div className="flex flex-col gap-3.5 px-4 pb-28 pt-6">
      {/* Header */}
      <div className="px-1 mb-1">
        <p className="text-[11px] font-medium uppercase tracking-widest text-warm-gray/60">
          Your day
        </p>
        <p className="text-[11px] font-medium uppercase tracking-widest text-warm-gray mt-0.5">
          {dateLabel}
        </p>
      </div>

      {/* Intention Card — the emotional anchor */}
      <IntentionCard
        intention={dayPlan?.intention ?? null}
        streak={streak}
        morningCompleted={!!dayPlan?.morning_completed_at}
      />

      {/* Morning Snapshot — Sage's briefing */}
      {dayPlan?.morning_completed_at && (
        <MorningSnapshotCard
          energyLevel={dayPlan.energy_level}
          morningCompletedAt={dayPlan.morning_completed_at}
          priorities={dayPlan.priorities}
          openThreads={dayPlan.open_threads}
          date={dayPlan.date}
        />
      )}

      {/* Captured Thoughts — accumulates through the day */}
      <CapturedThoughts captures={captures} />
    </div>
  )
}
