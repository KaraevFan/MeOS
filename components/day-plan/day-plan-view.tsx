'use client'

import type { DayPlanWithCaptures } from '@/types/day-plan'
import type { CalendarEvent } from '@/lib/calendar/types'
import { IntentionCard } from './intention-card'
import { MorningSnapshotCard } from './morning-snapshot-card'
import { CapturedThoughts } from './captured-thoughts'
import { CalendarCard } from '@/components/ui/calendar-card'
import { CalendarConnectCard } from '@/components/ui/calendar-connect-card'

interface DayPlanViewProps {
  data: DayPlanWithCaptures
  /** YYYY-MM-DD date to display. Defaults to today. */
  date?: string
  /** Today's calendar events (only passed for today's date). */
  calendarEvents?: CalendarEvent[]
  /** Whether the user has a calendar integration connected. */
  hasCalendarIntegration?: boolean
}

export function DayPlanView({ data, date, calendarEvents, hasCalendarIntegration }: DayPlanViewProps) {
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

      {/* Calendar section — today only (single render site for connect/events) */}
      {calendarEvents && calendarEvents.length > 0 ? (
        <CalendarCard
          summary={`${calendarEvents.length} event${calendarEvents.length === 1 ? '' : 's'} today`}
          events={calendarEvents}
          className="mx-0 mt-0"
        />
      ) : hasCalendarIntegration === false ? (
        <CalendarConnectCard className="mx-0 mt-0" />
      ) : null}

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
