'use client'

import type { InlineCardData } from '@/types/chat'

interface InlineCardProps {
  data: InlineCardData
}

export function InlineCard({ data }: InlineCardProps) {
  if (data.cardType === 'calendar') {
    return <CalendarCard items={data.items} />
  }

  return null
}

function CalendarCard({ items }: { items: string[] }) {
  // Parse calendar items like "10:00  Team standup (30m)"
  const events = items.map((item) => {
    const match = item.match(/^(\S+)\s+(.+)$/)
    if (match) {
      return { time: match[1], title: match[2] }
    }
    return { time: '', title: item }
  })

  return (
    <div
      className="w-full max-w-[85%] rounded-lg bg-bg-card border border-border shadow-sm overflow-hidden
                 animate-fade-up"
      style={{ animation: 'fade-in-up 0.3s ease-out both' }}
    >
      <div className="px-4 py-2.5 border-b border-border">
        <p className="text-[11px] font-medium text-text-secondary tracking-wide uppercase">
          Today&apos;s Calendar
        </p>
      </div>
      <div className="divide-y divide-border">
        {events.map((event, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-shrink-0 w-1 h-8 rounded-full bg-primary/30" />
            <span className="text-[13px] font-medium text-text-secondary tabular-nums w-14 flex-shrink-0">
              {event.time}
            </span>
            <span className="text-[14px] text-text truncate">
              {event.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
