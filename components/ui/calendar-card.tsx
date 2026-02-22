'use client'

import { useState } from 'react'
import { InfoCard } from './info-card'
import type { CalendarEvent } from '@/lib/calendar/types'

interface CalendarCardProps {
  summary: string
  events: CalendarEvent[]
  className?: string
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return 'All day'
  return new Date(event.startTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDuration(event: CalendarEvent): string {
  if (event.allDay) return ''
  const start = new Date(event.startTime).getTime()
  const end = new Date(event.endTime).getTime()
  const mins = Math.round((end - start) / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}

export function CalendarCard({ summary, events, className }: CalendarCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <InfoCard borderColor="amber" className={className}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-amber-600/80">
            Today&apos;s Calendar
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-warm-gray/40 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <p className="text-[14px] text-warm-dark/85 leading-snug">
          {summary}
        </p>
      </button>

      {expanded && events.length > 0 && (
        <div className="mt-3 pt-3 border-t border-warm-dark/[0.06] flex flex-col gap-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-baseline gap-3"
            >
              <span className="text-[13px] font-medium text-amber-600/70 w-[60px] shrink-0">
                {formatEventTime(event)}
              </span>
              <span className="text-[14px] text-warm-dark/80 leading-snug">
                {event.title}
                {formatDuration(event) && (
                  <span className="text-warm-gray/60 ml-1.5 text-[12px]">
                    ({formatDuration(event)})
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </InfoCard>
  )
}
