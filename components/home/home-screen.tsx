'use client'

import { useState, useEffect } from 'react'
import { Greeting } from './greeting'
import { SessionChips } from './session-chips'
import { HeroCard } from './hero-card'
import { InfoCard } from './info-card'
import { CaptureBar } from './capture-bar'
import { AmbientCard } from './ambient-card'
import { ActiveSessionCard } from './active-session-card'
import type { SessionType } from '@/types/chat'

export type TimeState = 'morning' | 'midday' | 'evening'

export interface HomeScreenData {
  displayName: string | null
  onboardingCompleted: boolean
  checkinOverdue: boolean
  nextCheckinDate: string | null
  todayClosed: boolean
  yesterdayJournalSummary: string | null
  todayCaptureCount: number
  todayIntention: string | null
  yesterdayIntention: string | null
  activeSessionId: string | null
  activeSessionType: SessionType | null
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

export function HomeScreen({ data }: { data: HomeScreenData }) {
  const [timeState, setTimeState] = useState<TimeState>('morning')

  useEffect(() => {
    setTimeState(detectTimeState())
  }, [])

  // If there's an active session, show the resume card prominently
  if (data.activeSessionId && data.activeSessionType) {
    return (
      <div className="pb-28">
        <Greeting timeState={timeState} displayName={data.displayName} />
        <SessionChips activeState={timeState} />
        <div className="px-5 mt-4">
          <ActiveSessionCard
            sessionId={data.activeSessionId}
            sessionType={data.activeSessionType}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="pb-28">
      <Greeting timeState={timeState} displayName={data.displayName} />
      <SessionChips activeState={timeState} />

      {/* ===== MORNING ===== */}
      {timeState === 'morning' && (
        <>
          <HeroCard
            icon={SunIcon}
            title="Open Your Day"
            sageText={getMorningSageText(data)}
            ctaText="Begin morning session"
            ctaHref="/chat?type=ad_hoc"
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

          {/* Yesterday's Intention — conditional on day plan data */}
          {data.yesterdayIntention && (
            <InfoCard borderColor="blue-gray">
              <div className="flex flex-col gap-3">
                <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-blue-gray">
                  Yesterday&apos;s Intention
                </span>
                <p className="text-[15px] italic text-warm-dark/80 leading-relaxed">
                  &ldquo;{data.yesterdayIntention}&rdquo;
                </p>
              </div>
            </InfoCard>
          )}

          <AmbientCard />
        </>
      )}

      {/* ===== MID-DAY ===== */}
      {timeState === 'midday' && (
        <>
          <HeroCard
            icon={MicIcon}
            title="Quick Capture"
            sageText="Got a thought worth holding onto? Drop it here — it'll be waiting tonight."
            ctaText="Capture a thought"
            ctaHref="/chat?type=ad_hoc"
          />

          {/* Captures Today — conditional */}
          {data.todayCaptureCount > 0 && (
            <InfoCard borderColor="sage">
              <div className="flex flex-col gap-3">
                <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-sage">
                  Captures Today
                </span>
                <p className="text-[14px] text-warm-dark/85 leading-snug">
                  {data.todayCaptureCount} thought{data.todayCaptureCount === 1 ? '' : 's'} captured
                </p>
              </div>
            </InfoCard>
          )}
        </>
      )}

      {/* ===== EVENING ===== */}
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
            ctaText={data.todayClosed ? 'Update tonight\'s journal' : 'Close your day'}
            ctaHref="/chat?type=close_day"
          />
          <CaptureBar />

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
      {data.checkinOverdue && data.nextCheckinDate && (
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
      )}
    </div>
  )
}
