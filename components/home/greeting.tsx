'use client'

import type { TimeState } from './home-screen'

interface GreetingProps {
  timeState: TimeState
  displayName: string | null
}

function getTimeGreeting(timeState: TimeState): string {
  switch (timeState) {
    case 'morning':
      return 'Good morning'
    case 'midday':
      return 'Good afternoon'
    case 'evening':
      return 'Good evening'
  }
}

export function Greeting({ timeState, displayName }: GreetingProps) {
  const greeting = getTimeGreeting(timeState)
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="pt-6 px-6 pb-0">
      <h1 className="text-[30px] font-bold leading-[1.15] tracking-[-0.03em] text-warm-dark">
        {greeting}{displayName ? `, ${displayName}` : ''}
      </h1>
      <p className="text-[14px] text-warm-gray mt-0.5 font-medium">
        {dateStr}
      </p>
    </div>
  )
}
