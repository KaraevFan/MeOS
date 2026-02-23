'use client'

import { getTimeGreeting } from '@/lib/utils'

interface BriefingCardProps {
  firstName: string | null
  todayIntention: string | null
  timezone: string
  onStart: () => void
}

export function BriefingCard({ firstName, todayIntention, timezone, onStart }: BriefingCardProps) {
  const greeting = firstName
    ? `${getTimeGreeting(timezone)}, ${firstName}`
    : getTimeGreeting(timezone)

  const hook = todayIntention
    ? `You already have a plan for today: "${todayIntention}"`
    : "Let's figure out what matters most today."

  return (
    <div
      className="flex flex-col items-center text-center px-6 py-8 gap-4
                 animate-fade-up"
    >
      <p className="text-2xl font-bold text-text tracking-tight">
        {greeting}
      </p>

      <p className="text-[15px] text-text-secondary leading-relaxed max-w-[280px]">
        {hook}
      </p>

      <button
        onClick={onStart}
        className="mt-2 h-11 px-8 text-sm font-medium text-white bg-primary rounded-full
                   hover:bg-primary-hover active:bg-primary-hover
                   transition-colors duration-150 shadow-sm"
      >
        Open Your Day
      </button>
    </div>
  )
}
