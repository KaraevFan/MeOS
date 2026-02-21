'use client'

import type { DayPlanWithCaptures } from '@/types/day-plan'
import { IntentionCard } from './intention-card'
import { MorningSnapshotCard } from './morning-snapshot-card'
import { CapturedThoughts } from './captured-thoughts'

interface DayPlanViewProps {
  data: DayPlanWithCaptures
  /** YYYY-MM-DD date to display. Defaults to today. */
  date?: string
}

export function DayPlanView({ data, date }: DayPlanViewProps) {
  const { dayPlan, captures, streak } = data
  // Parse the date prop (YYYY-MM-DD) or fall back to today
  const displayDate = date ? new Date(date + 'T12:00:00') : new Date()
  const dateLabel = displayDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).toUpperCase()

  const hasAnyContent = dayPlan || captures.length > 0

  return (
    <div className="flex flex-col gap-3.5 px-4 pb-28 pt-2">
      {/* Date label */}
      <div className="px-1 mb-1">
        <p className="text-[11px] font-medium uppercase tracking-widest text-warm-gray mt-0.5">
          {dateLabel}
        </p>
      </div>

      {/* Empty state for days with no plan or captures */}
      {!hasAnyContent && (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <p className="text-[15px] text-warm-gray/50 italic">
            No plan for this day.
          </p>
        </div>
      )}

      {/* Intention Card — the emotional anchor */}
      {hasAnyContent && (
        <IntentionCard
          intention={dayPlan?.intention ?? null}
          streak={streak}
          morningCompleted={!!dayPlan?.morning_completed_at}
        />
      )}

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
      {(captures.length > 0 || dayPlan) && (
        <CapturedThoughts captures={captures} />
      )}
    </div>
  )
}
