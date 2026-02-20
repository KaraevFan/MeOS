'use client'

import Link from 'next/link'

interface IntentionCardProps {
  intention: string | null
  streak: number
  morningCompleted: boolean
}

export function IntentionCard({ intention, streak, morningCompleted }: IntentionCardProps) {
  if (!morningCompleted || !intention) {
    return (
      <div className="relative overflow-hidden rounded-[22px] px-6 py-10 shadow-stone bg-dp-card/60">
        <p className="text-sm text-warm-gray/50 mb-4">
          Your intention will appear here after your morning session
        </p>
        <Link
          href="/chat?type=open_day"
          className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95"
        >
          Open the Day
        </Link>
      </div>
    )
  }

  return (
    <div
      className="relative overflow-hidden rounded-[22px] px-6 py-8 shadow-stone"
      style={{
        backgroundColor: 'rgba(201, 150, 58, 0.06)',
        backgroundImage: 'radial-gradient(ellipse at 30% 20%, rgba(201, 150, 58, 0.08) 0%, transparent 60%)',
      }}
    >
      {/* Streak badge */}
      {streak > 0 && (
        <div className="absolute right-5 top-6">
          <span className="inline-flex items-center gap-1 rounded-full bg-dp-amber/[0.12] px-2.5 py-1 text-[10px] font-semibold text-dp-amber">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-dp-amber" />
            Day {streak}
          </span>
        </div>
      )}

      {/* Date */}
      <p className="text-[11px] font-medium uppercase tracking-widest text-warm-gray">
        {new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      </p>

      {/* Intention text — the user's own words */}
      <h1
        className="mt-5 text-[27px] font-black leading-[1.15] text-dp-earth"
        style={{ letterSpacing: '-0.02em' }}
      >
        {intention}
      </h1>

      {/* Amber flourish divider */}
      <div className="mt-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-dp-amber/25" />
        <div className="h-1.5 w-1.5 rotate-45 bg-dp-amber/40" />
        <div className="h-px flex-1 bg-dp-amber/25" />
      </div>

      {/* Day in motion pill */}
      <div className="mt-4">
        <span className="inline-block rounded-full border border-dp-amber/25 bg-dp-amber/[0.08] px-3 py-1 text-[11px] font-semibold text-dp-amber">
          Day in motion
        </span>
      </div>
    </div>
  )
}
