'use client'

import { getTimeGreeting } from '@/lib/utils'

interface BriefingCardProps {
  firstName: string | null
  todayIntention: string | null
  yesterdayIntention: string | null
  onStart: () => void
}

export function BriefingCard({ firstName, todayIntention, yesterdayIntention, onStart }: BriefingCardProps) {
  const greeting = firstName
    ? `${getTimeGreeting()}, ${firstName}`
    : getTimeGreeting()

  // Build contextual hook based on available data
  let hook: string
  if (todayIntention) {
    hook = `You already have a plan for today: "${todayIntention}"`
  } else if (yesterdayIntention) {
    hook = `You were focused on "${yesterdayIntention}" yesterday. Ready to carry it forward or start fresh?`
  } else {
    hook = "Let's figure out what matters most today."
  }

  return (
    <div
      className="flex flex-col items-center text-center px-6 py-8 gap-4
                 animate-fade-up"
      style={{ animation: 'fade-in-up 0.4s ease-out both' }}
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
