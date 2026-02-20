'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Greeting } from './greeting'
import { SessionChips } from './session-chips'
import { HeroCard } from './hero-card'
import { InfoCard } from './info-card'
import { CaptureBar } from './capture-bar'
import { AmbientCard } from './ambient-card'
import { ActiveSessionCard } from './active-session-card'
import { CalendarCard } from './calendar-card'
import { YesterdayIntentionCard } from './yesterday-intention-card'
import { CheckinCard } from './checkin-card'
import { BreadcrumbsCard } from './breadcrumbs-card'
import type { CalendarEvent } from '@/lib/calendar/types'
import type { SessionType } from '@/types/chat'

export type TimeState = 'morning' | 'midday' | 'evening'

export interface HomeScreenData {
  displayName: string | null
  onboardingCompleted: boolean
  checkinOverdue: boolean
  nextCheckinDate: string | null
  todayClosed: boolean
  openDayCompleted: boolean
  yesterdayJournalSummary: string | null
  todayCaptureCount: number
  todayCaptures: string[]
  todayIntention: string | null
  yesterdayIntention: string | null
  calendarEvents: CalendarEvent[]
  calendarSummary: string | null
  activeSessionId: string | null
  activeSessionType: SessionType | null
  checkinResponse: 'yes' | 'not-yet' | 'snooze' | null
}

function detectTimeState(): TimeState {
  const hour = new Date().getHours()
  if (hour < 11) return 'morning'
  if (hour < 18) return 'midday'
  return 'evening'
}

function getEveningSageText(data: HomeScreenData): string {
  if (data.todayCaptureCount > 0) {
    return `You dropped ${data.todayCaptureCount} thought${data.todayCaptureCount === 1 ? '' : 's'} today. Let's make sense of them before you rest.`
  }
  if (data.todayIntention) {
    return `This morning you set out to ${data.todayIntention}. How did it land?`
  }
  return 'Take a moment to notice what today held. Even two minutes counts.'
}

function getMorningSageText(data: HomeScreenData): string {
  if (data.yesterdayIntention && data.yesterdayJournalSummary) {
    return `Yesterday you set out to ${data.yesterdayIntention}. Your reflection flagged some things worth revisiting.`
  }
  if (data.yesterdayIntention) {
    return `Yesterday you set out to ${data.yesterdayIntention}. Let's see what today holds.`
  }
  return 'A fresh start. What matters most to you today?'
}

// Sun icon for morning hero
const SunIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

// Mic icon for midday hero
const MicIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
    <path d="M19 10v2a7 7 0 01-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
)

// Moon icon for evening hero
const MoonIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
)

// Small sun icon for morning intention recall
const SmallSunIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-gray">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

function CheckinDueCard() {
  return (
    <InfoCard borderColor="amber">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-amber-600/80">
              Check-in due
            </span>
          </div>
          <p className="text-[14px] text-warm-dark/85">
            Your weekly reflection is ready.
          </p>
        </div>
        <a
          href="/chat?type=weekly_checkin"
          className="px-4 py-2 bg-amber-500 text-white rounded-xl text-[13px] font-semibold hover:bg-amber-600 transition-colors"
        >
          Check in
        </a>
      </div>
    </InfoCard>
  )
}

export function HomeScreen({ data }: { data: HomeScreenData }) {
  const [timeState, setTimeState] = useState<TimeState>('morning')
  const searchParams = useSearchParams()
  const captureAutoExpand = searchParams.get('capture') === '1'

  useEffect(() => {
    setTimeState(detectTimeState())
  }, [])

  // Stable payload for LLM contextual line — only for morning/evening with data
  const morningLinePayload = useMemo(() => {
    if (!data.yesterdayIntention && !data.yesterdayJournalSummary && !data.calendarSummary) return undefined
    return {
      timeState: 'morning' as const,
      yesterdayIntention: data.yesterdayIntention,
      yesterdayJournalSummary: data.yesterdayJournalSummary,
      calendarSummary: data.calendarSummary,
    }
  }, [data.yesterdayIntention, data.yesterdayJournalSummary, data.calendarSummary])

  const eveningLinePayload = useMemo(() => {
    if (!data.todayIntention && !data.todayCaptureCount) return undefined
    return {
      timeState: 'evening' as const,
      todayIntention: data.todayIntention,
      todayCaptureCount: data.todayCaptureCount,
    }
  }, [data.todayIntention, data.todayCaptureCount])

  // Derive active session href once — used to resolve dual-CTA conflicts
  const activeSessionHref = data.activeSessionId
    ? `/chat?session=${data.activeSessionId}`
    : null
  const hasActiveOpenDay = data.activeSessionType === 'open_day' && !!activeSessionHref
  const hasActiveCloseDay = data.activeSessionType === 'close_day' && !!activeSessionHref

  return (
    <div className="pb-28">
      <Greeting timeState={timeState} displayName={data.displayName} />
      <SessionChips activeState={timeState} />

      {/* Active session resume — inline card, doesn't replace the layout */}
      {data.activeSessionId && data.activeSessionType && (
        <div className="px-5 mt-4">
          <ActiveSessionCard
            sessionId={data.activeSessionId}
            sessionType={data.activeSessionType}
          />
        </div>
      )}

      {/* ===== MORNING ===== */}
      {/* Order: Hero → CaptureBar → Yesterday's Synthesis → Calendar → Yesterday's Intention → Ambient */}
      {timeState === 'morning' && (
        <>
          <HeroCard
            icon={SunIcon}
            title={data.openDayCompleted ? 'Day Plan Set' : hasActiveOpenDay ? 'Morning Session' : 'Open Your Day'}
            sageText={
              data.openDayCompleted && data.todayIntention
                ? `Your intention: "${data.todayIntention}"${data.todayCaptureCount > 0 ? ` \u00B7 ${data.todayCaptureCount} capture${data.todayCaptureCount === 1 ? '' : 's'}` : ''}`
                : getMorningSageText(data)
            }
            ctaText={data.openDayCompleted ? 'View day plan' : hasActiveOpenDay ? 'Resume morning session' : 'Begin morning session'}
            ctaHref={data.openDayCompleted ? '/day' : hasActiveOpenDay ? activeSessionHref! : '/chat?type=open_day'}
            contextualLinePayload={data.openDayCompleted ? undefined : morningLinePayload}
          />
          <CaptureBar />

          {/* Yesterday's Synthesis — conditional on journal data */}
          {data.yesterdayJournalSummary && (
            <InfoCard borderColor="sage">
              <div className="flex flex-col gap-3">
                <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-sage">
                  From Last Night
                </span>
                <p className="text-[14px] text-warm-dark/85 leading-relaxed">
                  {data.yesterdayJournalSummary}
                </p>
              </div>
            </InfoCard>
          )}

          {/* Calendar — conditional on integration */}
          {data.calendarSummary && (
            <CalendarCard
              summary={data.calendarSummary}
              events={data.calendarEvents}
            />
          )}

          {/* Yesterday's Intention — conditional on day plan data */}
          {data.yesterdayIntention && (
            <YesterdayIntentionCard
              intention={data.yesterdayIntention}
              onCompleted={() => {
                // TODO: Mark yesterday's day plan intention as completed via API
              }}
              onCarryForward={() => {
                // TODO: Write carry-forward context for morning session via API
              }}
            />
          )}

          <AmbientCard />
        </>
      )}

      {/* ===== MID-DAY ===== */}
      {/* Order: Hero → CaptureBar → Check-In → Captures Today */}
      {timeState === 'midday' && (
        <>
          <HeroCard
            icon={MicIcon}
            title="Quick Capture"
            sageText="Got a thought worth holding onto? Drop it here — it'll be waiting tonight."
            ctaText="Capture a thought"
            ctaHref="/home?capture=1"
          />
          <CaptureBar autoExpand={captureAutoExpand} />

          {/* Check-In — conditional on open_day completed today */}
          {data.openDayCompleted && data.todayIntention && (
            <CheckinCard
              intention={data.todayIntention}
              initialResponse={data.checkinResponse}
            />
          )}

          {/* Breadcrumbs — mid-day captures */}
          {data.todayCaptures.length > 0 && (
            <BreadcrumbsCard captures={data.todayCaptures} />
          )}
        </>
      )}

      {/* ===== EVENING ===== */}
      {/* Order: Hero → CaptureBar → Breadcrumbs → Morning Intention Recall → Ambient */}
      {timeState === 'evening' && (
        <>
          <HeroCard
            icon={MoonIcon}
            title={data.todayClosed ? 'Day Logged' : 'Close Your Day'}
            sageText={
              data.todayClosed
                ? 'You already reflected tonight. Sleep well.'
                : getEveningSageText(data)
            }
            ctaText={data.todayClosed ? 'Update tonight\'s journal' : hasActiveCloseDay ? 'Resume evening reflection' : 'Close your day'}
            ctaHref={hasActiveCloseDay ? activeSessionHref! : '/chat?type=close_day'}
            contextualLinePayload={data.todayClosed ? undefined : eveningLinePayload}
          />
          <CaptureBar />

          {/* Breadcrumbs — evening, conditional on captures */}
          {data.todayCaptures.length > 0 && (
            <BreadcrumbsCard captures={data.todayCaptures} />
          )}

          {/* Morning Intention Recall — conditional on today's day plan */}
          {data.todayIntention && (
            <InfoCard borderColor="blue-gray">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {SmallSunIcon}
                  <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-blue-gray">
                    Morning Intention
                  </span>
                </div>
                <p className="text-[15px] font-medium text-warm-dark">
                  You set out to: <span className="italic text-warm-dark/70">{data.todayIntention}</span>
                </p>
              </div>
            </InfoCard>
          )}

          <AmbientCard />
        </>
      )}

      {/* Check-in nudge — shown across all states when overdue */}
      {data.checkinOverdue && data.nextCheckinDate && <CheckinDueCard />}
    </div>
  )
}
