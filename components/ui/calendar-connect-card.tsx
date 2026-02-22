'use client'

import { InfoCard } from './info-card'

const CalendarIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600/80">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

export function CalendarConnectCard({ className }: { className?: string }) {
  return (
    <InfoCard borderColor="amber" className={className}>
      <a
        href="/api/calendar/connect"
        className="flex items-center justify-between gap-3"
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            {CalendarIcon}
            <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-amber-600/80">
              Google Calendar
            </span>
          </div>
          <p className="text-[14px] text-warm-dark/85 leading-snug">
            Connect your calendar to see today&apos;s schedule in your morning briefing.
          </p>
        </div>
        <span className="shrink-0 px-3.5 py-1.5 bg-amber-500/10 text-amber-700 rounded-xl text-[13px] font-semibold">
          Connect
        </span>
      </a>
    </InfoCard>
  )
}
